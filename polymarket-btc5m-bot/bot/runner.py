"""The main loop: one decision per 5-minute window, then settle finished bets."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from decimal import Decimal

import httpx
from polymarket import AsyncPublicClient, PolymarketError

from .broker import LiveBroker, PaperBroker
from .config import Settings
from .ledger import BetRecord, Ledger
from .market import WINDOW_SECONDS, load_quote, load_window, window_start
from .strategy import Bet, decide, settle

log = logging.getLogger("bot")

GEOBLOCK_URL = "https://polymarket.com/api/geoblock"
# A window whose market is still unresolved this long after it ended is checked
# less often; Polymarket normally resolves within a couple of minutes.
SLOW_RESOLUTION_SECONDS = 30 * 60


async def geoblock_status() -> dict:
    async with httpx.AsyncClient(timeout=10) as http:
        resp = await http.get(GEOBLOCK_URL)
        resp.raise_for_status()
        return resp.json()


class Runner:
    def __init__(self, settings: Settings):
        self.s = settings
        self.ledger = Ledger(settings.data_dir, settings.mode, settings.paper_start_balance, settings.strategy)
        self.public = AsyncPublicClient()
        self.broker: PaperBroker | LiveBroker
        self._last_settle_check: dict[int, float] = {}
        self._last_collect_try: dict[int, float] = {}

    async def start(self) -> None:
        if self.s.live:
            geo = await geoblock_status()
            if geo.get("blocked"):
                raise SystemExit(
                    f"Polymarket does not accept orders from your location ({geo.get('country')}). "
                    "Live mode is disabled; paper mode still works."
                )
            self.broker = await LiveBroker.connect(self.s)
        else:
            self.broker = PaperBroker(self.public, self.ledger)
        balance = await self.broker.balance()
        if self.s.strategy == "market_maker":
            log.info(
                "Started market maker in %s mode. Balance $%.2f. Quoting +%ss to +%ss of each window, "
                "%s shares per bid, %s below fair, up to $%s per window",
                self.s.mode.upper(), balance, self.s.mm_start_second, self.s.mm_stop_second,
                self.s.mm_order_shares, self.s.mm_half_spread, self.s.mm_max_spend_per_window,
            )
        else:
            log.info(
                "Started in %s mode. Balance $%.2f. Entering each window at +%ss, formula=%s",
                self.s.mode.upper(), balance, self.s.entry_second, self.s.stake_formula,
            )

    async def close(self) -> None:
        if isinstance(self.broker, LiveBroker):
            await self.broker.close()
        await self.public.close()

    # --- loop --------------------------------------------------------------

    async def run_forever(self) -> None:
        await self.start()
        try:
            while True:
                try:
                    await self.tick(time.time())
                except (PolymarketError, httpx.HTTPError) as exc:
                    log.warning("Network/API problem, retrying shortly: %s", exc)
                await asyncio.sleep(self._sleep_seconds(time.time()))
        finally:
            self.ledger.save()
            await self.close()

    def _sleep_seconds(self, now: float) -> float:
        start = window_start(now)
        entry_at = start + self.s.entry_second
        if now < entry_at:
            return max(0.5, min(5.0, entry_at - now))
        return 5.0

    async def tick(self, now: float) -> None:
        await self.settle_finished(now)
        await self.collect_winnings()

        start = window_start(now)
        into = now - start
        if self.ledger.handled(start) or into < self.s.entry_second:
            return
        if into > self.s.entry_second + self.s.entry_grace_seconds:
            # Started (or woke up) too late for this window's entry point.
            self.ledger.mark(start, "skip: missed entry time")
            self.ledger.save()
            return
        outcome = await self.trade_window(start)
        self.ledger.mark(start, outcome)
        self.ledger.save()

    # --- one window --------------------------------------------------------

    async def risk_block(self, balance: Decimal) -> str | None:
        today = datetime.now().date()
        lost_today = -self.ledger.realized_pnl_on(today)
        if self.s.max_daily_loss_usd > 0 and lost_today >= self.s.max_daily_loss_usd:
            return f"daily loss limit reached (lost ${lost_today:.2f} today)"
        if balance <= self.s.stop_below_balance_usd:
            return f"balance ${balance:.2f} is at or below STOP_BELOW_BALANCE_USD"
        return None

    async def trade_window(self, start: int) -> str:
        window = await load_window(self.public, self.s.market_prefix, start)
        if window is None:
            log.info("No market found for %s-%s", self.s.market_prefix, start)
            return "skip: no market"
        if not window.accepting_orders or window.closed:
            return "skip: market not accepting orders"

        balance = await self.broker.balance()
        blocked = await self.risk_block(balance)
        if blocked:
            log.info("%s | not betting: %s", window.question, blocked)
            return f"skip: {blocked}"

        quote = await load_quote(self.public, window)
        decision = decide(self.s, balance, quote)
        crowd = f"Up {quote.mid_up:.3f} / Down {quote.mid_down:.3f}"
        if not isinstance(decision, Bet):
            log.info("%s | %s | skip: %s", window.question, crowd, decision.reason)
            return f"skip: {decision.reason}"

        fill = await self.broker.buy(window, decision)
        if isinstance(fill, str):
            log.warning("%s | %s | %s $%s failed: %s", window.question, crowd, decision.side, decision.stake_usd, fill)
            return f"failed: {fill}"

        self.ledger.add(
            BetRecord(
                window_start=start,
                slug=window.slug,
                question=window.question,
                condition_id=window.condition_id,
                side=decision.side,
                token_id=window.token_for(decision.side),
                confidence=str(decision.confidence),
                price=str(fill.price.quantize(Decimal("0.0001"))),
                shares=str(fill.shares.quantize(Decimal("0.000001"))),
                cost=str(fill.cost.quantize(Decimal("0.000001"))),
                fee=str(fill.fee.quantize(Decimal("0.000001"))),
                placed_at=datetime.now().isoformat(timespec="seconds"),
                order_id=fill.order_id,
            )
        )
        log.info(
            "%s | %s | BUY %s: $%.2f for %.2f shares at %.3f (fee $%.3f), balance was $%.2f",
            window.question, crowd, decision.side, fill.cost, fill.shares, fill.price, fill.fee, balance,
        )
        return "bet"

    # --- after the window --------------------------------------------------

    async def settle_finished(self, now: float) -> None:
        changed = False
        for bet in self.ledger.open_bets():
            end = bet.window_start + WINDOW_SECONDS
            if now < end:
                continue
            # Check every loop at first, then once a minute if resolution is slow.
            last = self._last_settle_check.get(bet.window_start, 0)
            if now - end > SLOW_RESOLUTION_SECONDS and now - last < 60:
                continue
            self._last_settle_check[bet.window_start] = now
            window = await load_window(self.public, self.s.market_prefix, bet.window_start)
            if window is None or not window.closed:
                continue
            if window.split:
                # Rare 50/50 resolution: each share redeems for $0.50.
                bet.status = "void"
                bet.pnl = str((bet.shares_d / 2 - bet.cost_d).quantize(Decimal("0.000001")))
                bet.settled_at = datetime.now().isoformat(timespec="seconds")
                log.warning("%s resolved 50/50; redeem it on polymarket.com", bet.slug)
                if isinstance(self.broker, PaperBroker):
                    self.ledger.paper_balance += bet.shares_d / 2
                    bet.redeemed = True
                changed = True
                continue
            if window.winner is None:
                continue  # closed but final prices not published yet
            won = window.winner == bet.side
            pnl = settle(bet.shares_d, bet.cost_d, won)
            bet.status = "won" if won else "lost"
            bet.pnl = str(pnl.quantize(Decimal("0.000001")))
            bet.settled_at = datetime.now().isoformat(timespec="seconds")
            self._last_settle_check.pop(bet.window_start, None)
            changed = True
            log.info(
                "%s | result %s | %s %s | P&L $%+.2f",
                bet.question, window.winner, "WON" if won else "LOST", bet.side, pnl,
            )
        if changed:
            self.ledger.save()
            log.info(self.ledger.summary().replace("\n", " | "))

    async def collect_winnings(self) -> None:
        changed = False
        now = time.time()
        for bet in self.ledger.unredeemed_wins():
            if now - self._last_collect_try.get(bet.window_start, 0) < 60:
                continue
            self._last_collect_try[bet.window_start] = now
            if await self.broker.collect(bet):
                bet.redeemed = True
                changed = True
        if changed:
            self.ledger.save()
