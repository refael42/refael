"""The market maker's loop: quote both sides of each window, then settle."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from decimal import Decimal

import httpx
from polymarket import PolymarketError
from polymarket.streams import MarketSpec

from .broker import LiveBroker
from .ledger import BetRecord
from .maker import LiveMaker, MakerFill, PaperMaker
from .market import WINDOW_SECONDS, Window, load_quote, load_window, window_start
from .mm import SIDES, Inventory, make_quotes
from .runner import Runner

log = logging.getLogger("bot")

RECONCILE_DELAY = 60  # seconds after a window ends before Polymarket's trade history is complete


class MarketMakerRunner(Runner):
    def __init__(self, settings):
        super().__init__(settings)
        self.maker: PaperMaker | LiveMaker
        self._reconciled: set[int] = set()

    async def run_forever(self) -> None:
        await self.start()
        self.maker = LiveMaker(self.broker.client) if isinstance(self.broker, LiveBroker) else PaperMaker()
        settler = asyncio.create_task(self._settle_loop())
        s = self.s
        try:
            while True:
                now = time.time()
                start = window_start(now)
                if self.ledger.handled(start) or now >= start + s.mm_stop_second - 5:
                    await asyncio.sleep(max(1.0, start + WINDOW_SECONDS + s.mm_start_second - now))
                    continue
                if now < start + s.mm_start_second:
                    await asyncio.sleep(start + s.mm_start_second - now)
                    continue
                outcome = await self.make_market(start)
                self.ledger.mark(start, outcome)
                self.ledger.save()
        finally:
            settler.cancel()
            await self.maker.close()
            self.ledger.save()
            await self.close()

    async def _settle_loop(self) -> None:
        while True:
            try:
                await self.settle_finished(time.time())
                await self.collect_winnings()
            except (PolymarketError, httpx.HTTPError) as exc:
                log.warning("Settlement check failed, retrying: %s", exc)
            await asyncio.sleep(10)

    # --- one window --------------------------------------------------------

    def _inventory(self, start: int) -> Inventory:
        """Fills already recorded for this window (after a restart)."""
        inv = Inventory()
        for side in SIDES:
            rec = self.ledger.find(start, side)
            if rec is not None:
                inv.add(side, rec.shares_d, Decimal(rec.price))
        return inv

    def _upsert(self, window: Window, side: str, shares: Decimal, cost: Decimal) -> None:
        """Set this window's record for one side to the given totals."""
        rec = self.ledger.find(window.start, side)
        if rec is None:
            rec = BetRecord(
                window_start=window.start,
                slug=window.slug,
                question=window.question,
                condition_id=window.condition_id,
                side=side,
                token_id=window.token_for(side),
                confidence="mm",
                price="0",
                shares="0",
                cost="0",
                fee="0",
                placed_at=datetime.now().isoformat(timespec="seconds"),
                order_id="mm",
            )
            self.ledger.add(rec)
        rec.shares = str(shares)
        rec.cost = str(cost)
        rec.price = str((cost / shares).quantize(Decimal("0.0001")))
        self.ledger.save()

    def _record(self, window: Window, inv: Inventory, fill: MakerFill) -> None:
        inv.add(fill.side, fill.shares, fill.price)
        if not self.s.live:
            self.ledger.paper_balance -= fill.shares * fill.price
        self._upsert(window, fill.side, inv.shares(fill.side), inv.cost(fill.side))
        log.info(
            "%s | filled %s %.2f @ %s | holding Up %.0f / Down %.0f, spent $%.2f",
            window.question, fill.side, fill.shares, fill.price, inv.up_shares, inv.down_shares, inv.spent,
        )

    async def _watch_trades(self, window: Window, inv: Inventory) -> None:
        """Paper mode: fill simulated bids from the real-time trade stream."""
        assert isinstance(self.maker, PaperMaker)
        while True:
            try:
                spec = MarketSpec(token_ids=[window.up_token, window.down_token])
                async with await self.public.subscribe([spec]) as stream:
                    async for ev in stream:
                        if ev.type != "last_trade_price":
                            continue
                        p = ev.payload
                        for fill in self.maker.on_trade(window, str(p.asset_id), p.side, p.price, p.size):
                            self._record(window, inv, fill)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # the stream can drop; reconnect
                log.warning("Trade stream dropped (%s), reconnecting", exc)
                await asyncio.sleep(1)

    async def make_market(self, start: int) -> str:
        s = self.s
        window = await load_window(self.public, s.market_prefix, start)
        if window is None:
            return "skip: no market"
        if not window.accepting_orders or window.closed:
            return "skip: market not accepting orders"

        balance = await self.broker.balance()
        blocked = await self.risk_block(balance)
        if blocked is None and balance < s.mm_max_spend_per_window:
            blocked = f"balance ${balance:.2f} is below MM_MAX_SPEND_PER_WINDOW"
        if blocked:
            log.info("%s | not quoting: %s", window.question, blocked)
            return f"skip: {blocked}"

        inv = self._inventory(start)
        watcher = asyncio.create_task(self._watch_trades(window, inv)) if isinstance(self.maker, PaperMaker) else None
        stop_at = start + s.mm_stop_second
        last_reason = None
        log.info("%s | quoting until +%ss", window.question, s.mm_stop_second)
        try:
            while time.time() < stop_at:
                t0 = time.time()
                try:
                    quote = await load_quote(self.public, window)
                    for fill in await self.maker.poll(window):
                        self._record(window, inv, fill)
                    q = make_quotes(s, quote.mid_up, quote.ask_up, quote.ask_down, inv)
                    if q.reason and q.reason != last_reason:
                        log.info("%s | %s", window.question, q.reason)
                    last_reason = q.reason
                    for fill in await self.maker.sync(window, q, s.mm_order_shares):
                        self._record(window, inv, fill)
                except (PolymarketError, httpx.HTTPError) as exc:
                    log.warning("Quote update failed: %s", exc)
                await asyncio.sleep(max(0.2, float(s.mm_refresh_seconds) - (time.time() - t0)))
        finally:
            if watcher is not None:
                watcher.cancel()
            for fill in await self.maker.cancel_all(window):
                self._record(window, inv, fill)

        if inv.spent == 0:
            log.info("%s | done, no fills", window.question)
            return "mm: no fills"
        log.info(
            "%s | done: Up %.0f @ %.3f, Down %.0f @ %.3f, %s pairs, spent $%.2f (if Up wins %+.2f, if Down wins %+.2f)",
            window.question,
            inv.up_shares, inv.up_cost / inv.up_shares if inv.up_shares else 0,
            inv.down_shares, inv.down_cost / inv.down_shares if inv.down_shares else 0,
            f"{inv.pairs:.0f}", inv.spent, inv.pnl("Up"), inv.pnl("Down"),
        )
        return "mm"

    # --- live: correct our records from Polymarket's trade history ----------

    async def settle_finished(self, now: float) -> None:
        if self.s.live:
            await self._reconcile(now)
        await super().settle_finished(now)

    async def _reconcile(self, now: float) -> None:
        assert isinstance(self.broker, LiveBroker)
        wallet = self.broker.client.wallet
        for start in sorted({b.window_start for b in self.ledger.open_bets()}):
            if start in self._reconciled or now < start + WINDOW_SECONDS + RECONCILE_DELAY:
                continue
            window = await load_window(self.public, self.s.market_prefix, start)
            if window is None:
                continue
            inv = Inventory()
            async for t in self.public.list_trades(user=wallet, condition_id=[window.condition_id], taker_only=False).iter_items():
                if t.side == "BUY":
                    inv.add("Up" if str(t.asset_id) == window.up_token else "Down", t.size, t.price)
            self._reconciled.add(start)
            if inv.spent == 0:
                continue  # history not there yet or no fills; keep our own records
            for side in SIDES:
                if inv.shares(side) > 0:
                    self._upsert(window, side, inv.shares(side), inv.cost(side))
