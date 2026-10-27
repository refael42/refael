"""Replay the strategy on past 5-minute windows using Polymarket's own history.

For every finished window we look up the price of "Up" at the entry second,
let strategy.decide() pick a side and stake exactly as the live bot would,
and settle it against the real result. The fill price is the historical
midpoint plus half a typical spread, and the real taker fee is charged, so
the numbers are close to what the bot would have earned. Price history only
has one point per minute, so entry seconds are rounded down to the minute.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import asdict, dataclass, replace
from decimal import Decimal
from pathlib import Path

from polymarket import AsyncPublicClient, PolymarketError

from .config import Settings
from .market import WINDOW_SECONDS, Window, load_window, window_start
from .strategy import CENT, Bet, Quote, decide, settle, split_stake

HALF_SPREAD = Decimal("0.005")


@dataclass(frozen=True)
class History:
    window: Window
    up_by_minute: dict[int, Decimal]  # minute offset (0-4) -> price of Up


@dataclass
class Result:
    entry_second: int
    windows: int = 0
    bets: int = 0
    wins: int = 0
    staked: Decimal = Decimal(0)
    fees: Decimal = Decimal(0)
    pnl: Decimal = Decimal(0)
    sum_price: Decimal = Decimal(0)
    balance: Decimal = Decimal(0)
    peak: Decimal = Decimal(0)
    max_drawdown: Decimal = Decimal(0)


async def _fetch(client: AsyncPublicClient, prefix: str, start: int, sem: asyncio.Semaphore) -> History | None:
    async with sem:
        window = await load_window(client, prefix, start)
        if window is None or window.winner is None:
            return None
        points: dict[int, Decimal] = {}
        try:
            pages = client.list_price_history(
                asset_id=window.up_token,
                start=start,
                end=start + WINDOW_SECONDS,
                bucket_seconds=60,
            )
            async for p in pages.iter_items():
                offset = int(p.timestamp.timestamp()) - start
                if 0 <= offset < WINDOW_SECONDS:
                    points[offset // 60] = p.price
        except PolymarketError:
            return None
        return History(window=window, up_by_minute=points)


def _to_json(h: History) -> dict:
    w = asdict(h.window)
    w["fee_rate"] = str(w["fee_rate"])
    return {"window": w, "up": {str(k): str(v) for k, v in h.up_by_minute.items()}}


def _from_json(d: dict) -> History:
    w = dict(d["window"])
    w["fee_rate"] = Decimal(w["fee_rate"])
    w.setdefault("split", False)
    return History(window=Window(**w), up_by_minute={int(k): Decimal(v) for k, v in d["up"].items()})


async def load_history(prefix: str, hours: float, cache_path: Path | None = None) -> list[History]:
    """Finished windows from the last `hours`. Finished windows never change, so they are cached."""
    cache: dict[str, dict] = {}
    if cache_path and cache_path.exists():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))

    last = window_start(time.time()) - 2 * WINDOW_SECONDS  # skip windows still resolving
    count = int(hours * 3600 // WINDOW_SECONDS)
    starts = [last - i * WINDOW_SECONDS for i in range(count)][::-1]
    missing = [s for s in starts if f"{prefix}-{s}" not in cache]

    if missing:
        sem = asyncio.Semaphore(8)
        async with AsyncPublicClient() as client:
            got = await asyncio.gather(*(_fetch(client, prefix, s, sem) for s in missing))
        for h in got:
            if h is not None and len(h.up_by_minute) == 5:
                cache[h.window.slug] = _to_json(h)
        if cache_path:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = cache_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(cache), encoding="utf-8")
            os.replace(tmp, cache_path)
        fresh = {h.window.start: h for h in got if h is not None}
    else:
        fresh = {}

    out = []
    for s in starts:
        key = f"{prefix}-{s}"
        if key in cache:
            out.append(_from_json(cache[key]))
        elif s in fresh:
            out.append(fresh[s])
    return out


def _quote_at(h: History, entry_second: int) -> Quote | None:
    minute = entry_second // 60
    known = [m for m in h.up_by_minute if m <= minute]
    if not known:
        return None
    up = h.up_by_minute[max(known)]
    down = 1 - up
    return Quote(mid_up=up, mid_down=down, ask_up=up + HALF_SPREAD, ask_down=down + HALF_SPREAD)


def simulate(settings: Settings, history: list[History], entry_second: int) -> Result:
    s = replace(settings, entry_second=entry_second)
    r = Result(entry_second=entry_second, balance=s.paper_start_balance, peak=s.paper_start_balance)
    for h in history:
        quote = _quote_at(h, entry_second)
        if quote is None:
            continue
        r.windows += 1
        bet = decide(s, r.balance, quote)
        if not isinstance(bet, Bet):
            continue
        shares, fee = split_stake(bet.stake_usd, bet.ask, h.window.fee_rate, h.window.fee_exponent)
        won = h.window.winner == bet.side
        pnl = settle(shares, bet.stake_usd, won)
        r.bets += 1
        r.wins += int(won)
        r.staked += bet.stake_usd
        r.fees += fee
        r.pnl += pnl
        r.sum_price += bet.ask
        r.balance += pnl
        r.peak = max(r.peak, r.balance)
        r.max_drawdown = max(r.max_drawdown, r.peak - r.balance)
    return r


def report(results: list[Result], windows_loaded: int, settings: Settings) -> str:
    lines = [
        f"{windows_loaded} finished windows, start balance ${settings.paper_start_balance}, "
        f"formula={settings.stake_formula} fraction={settings.bet_fraction} "
        f"min_confidence={settings.min_confidence} max_price={settings.max_entry_price}",
        "",
        f"{'entry':>6} {'bets':>5} {'win%':>6} {'paid%':>6} {'ROI':>7} {'fees':>8} {'P&L':>9} {'end bal':>9} {'max DD':>8}",
    ]
    for r in results:
        if r.bets == 0:
            lines.append(f"{r.entry_second:>5}s {0:>5}  (no bets)")
            continue
        win_pct = Decimal(r.wins) / r.bets * 100
        paid_pct = r.sum_price / r.bets * 100
        roi = r.pnl / r.staked * 100
        lines.append(
            f"{r.entry_second:>5}s {r.bets:>5} {win_pct:>5.1f}% {paid_pct:>5.1f}% {roi:>6.2f}% "
            f"{r.fees.quantize(CENT):>8} {r.pnl.quantize(CENT):>9} {r.balance.quantize(CENT):>9} "
            f"{r.max_drawdown.quantize(CENT):>8}"
        )
    lines += [
        "",
        "win%  = how often the majority side was right",
        "paid% = average price paid, i.e. the win rate you need just to break even before fees",
        "ROI   = profit / total staked (fees included)",
    ]
    return "\n".join(lines)


async def run_backtest(settings: Settings, hours: float, entry_seconds: list[int], flat: bool = False) -> str:
    """flat=True bets $1 every time, so results show the edge per bet without compounding."""
    if flat:
        settings = replace(
            settings,
            stake_formula="fixed",
            fixed_bet_usd=Decimal(1),
            min_bet_usd=Decimal(1),
            max_bet_usd=Decimal(1),
            paper_start_balance=Decimal(1_000_000),
        )
    cache = settings.data_dir / f"history-{settings.market_prefix}.json"
    history = await load_history(settings.market_prefix, hours, cache)
    results = [simulate(settings, history, e) for e in entry_seconds]
    return report(results, len(history), settings)
