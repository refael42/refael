"""Replay the market maker on real past trades.

For every finished window we download every fill (maker and taker side).
Every MM_REFRESH_SECONDS the simulated bot prices its bids with make_quotes(),
using as "fair price" the median of the last few trade prices it could
already have seen. A bid counts as filled only when a real trade sold to
someone else's bid at a *worse* price than ours in the following seconds (we
would have been hit first). With --touch, a sale at exactly our price counts
too, which is the optimistic bound. Maker fees are zero; maker rebates and
liquidity rewards are not counted.
"""

from __future__ import annotations

import asyncio
import json
import os
import statistics
import time
from dataclasses import dataclass, field, replace
from decimal import Decimal
from pathlib import Path

from polymarket import AsyncPublicClient, PolymarketError

from .config import Settings
from .market import WINDOW_SECONDS, load_window, window_start
from .mm import SIDES, TICK, Inventory, bid_hit, floor_tick, make_quotes

FAIR_LOOKBACK = 9  # trade prices in the fair-price median


@dataclass(frozen=True)
class Fill:
    ts: int
    side: str  # "Up" or "Down": the side whose bid was hit
    price: Decimal
    size: Decimal


@dataclass(frozen=True)
class WindowTape:
    start: int
    winner: str
    fair_points: tuple[tuple[int, Decimal], ...]  # (ts, implied Up price), oldest first
    bid_fills: tuple[Fill, ...]  # other makers' bids that were hit, oldest first


async def _fetch(client: AsyncPublicClient, prefix: str, start: int, sem: asyncio.Semaphore) -> dict | None:
    async with sem:
        w = await load_window(client, prefix, start)
        if w is None or w.winner is None:
            return None
        try:
            takers = set()
            async for t in client.list_trades(condition_id=[w.condition_id], taker_only=True, page_size=1000).iter_items():
                takers.add((t.transaction_hash, t.wallet, t.side, str(t.asset_id), str(t.size)))
            rows = []
            async for t in client.list_trades(condition_id=[w.condition_id], taker_only=False, page_size=1000).iter_items():
                if (t.transaction_hash, t.wallet, t.side, str(t.asset_id), str(t.size)) in takers:
                    continue  # keep maker fills: they carry the exact price level that traded
                up = str(t.asset_id) == w.up_token
                rows.append([int(t.timestamp.timestamp()), int(up), int(t.side == "BUY"), str(t.price), str(t.size)])
        except PolymarketError:
            return None
        return {"start": start, "winner": w.winner, "rows": rows}


def _tape(raw: dict) -> WindowTape:
    fair, fills = [], []
    for ts, up, buy, price, size in sorted(raw["rows"]):
        p = Decimal(price)
        fair.append((ts, p if up else 1 - p))
        if buy:  # a maker bid on this side was hit
            fills.append(Fill(ts=ts, side="Up" if up else "Down", price=p, size=Decimal(size)))
    return WindowTape(start=raw["start"], winner=raw["winner"], fair_points=tuple(fair), bid_fills=tuple(fills))


async def load_tapes(prefix: str, hours: float, cache_dir: Path) -> list[WindowTape]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    last = window_start(time.time()) - 2 * WINDOW_SECONDS
    starts = [last - i * WINDOW_SECONDS for i in range(int(hours * 3600 // WINDOW_SECONDS))][::-1]
    path = lambda s: cache_dir / f"{prefix}-{s}.json"  # noqa: E731
    missing = [s for s in starts if not path(s).exists()]
    if missing:
        sem = asyncio.Semaphore(6)
        async with AsyncPublicClient() as client:
            for i in range(0, len(missing), 24):
                got = await asyncio.gather(*(_fetch(client, prefix, s, sem) for s in missing[i : i + 24]))
                for raw in got:
                    if raw is not None:
                        tmp = path(raw["start"]).with_suffix(".tmp")
                        tmp.write_text(json.dumps(raw), encoding="utf-8")
                        os.replace(tmp, path(raw["start"]))
                print(f"  downloaded {min(i + 24, len(missing))}/{len(missing)} windows", flush=True)
    return [_tape(json.loads(path(s).read_text(encoding="utf-8"))) for s in starts if path(s).exists()]


@dataclass
class WindowResult:
    start: int
    inv: Inventory
    pnl: Decimal


def simulate_window(s: Settings, tape: WindowTape, touch: bool = False) -> WindowResult:
    inv = Inventory()
    orders: dict[str, tuple[Decimal, Decimal]] = {}  # side -> (price, remaining shares)
    step = int(s.mm_refresh_seconds)
    begin, stop = tape.start + s.mm_start_second, tape.start + s.mm_stop_second
    fi = 0  # next fair point
    ki = 0  # next bid fill
    recent: list[Decimal] = []
    fills = tape.bid_fills
    while ki < len(fills) and fills[ki].ts < begin:
        ki += 1

    t = begin
    while t < stop:
        # What the bot could know at time t: trades up to the previous second.
        while fi < len(tape.fair_points) and tape.fair_points[fi][0] < t:
            recent.append(tape.fair_points[fi][1])
            fi += 1
        fair = statistics.median(recent[-FAIR_LOOKBACK:]) if recent else Decimal("0.5")
        ask_up = floor_tick(fair) + TICK
        ask_down = floor_tick(1 - fair) + TICK
        q = make_quotes(s, fair, ask_up, ask_down, inv)
        for side in SIDES:
            price = q.price(side)
            if price is None:
                orders.pop(side, None)
            elif side not in orders or orders[side][0] != price or orders[side][1] <= 0:
                orders[side] = (price, s.mm_order_shares)

        until = min(t + step, stop)
        while ki < len(fills) and fills[ki].ts < until:
            f = fills[ki]
            ki += 1
            if f.side in orders:
                price, left = orders[f.side]
                if left > 0 and bid_hit(price, f.price, touch):
                    got = min(left, f.size)
                    inv.add(f.side, got, price)
                    orders[f.side] = (price, left - got)
        t = until

    return WindowResult(start=tape.start, inv=inv, pnl=inv.pnl(tape.winner))


@dataclass
class Summary:
    label: str
    windows: int = 0
    active: int = 0
    spent: Decimal = Decimal(0)
    pnl: Decimal = Decimal(0)
    shares: Decimal = Decimal(0)
    paired: Decimal = Decimal(0)
    worst: Decimal = Decimal(0)
    max_drawdown: Decimal = Decimal(0)
    day_pnl: dict[int, Decimal] = field(default_factory=dict)


def summarize(label: str, results: list[WindowResult]) -> Summary:
    out = Summary(label=label, windows=len(results))
    equity = peak = Decimal(0)
    first = results[0].start if results else 0
    for r in results:
        if r.inv.spent > 0:
            out.active += 1
        out.spent += r.inv.spent
        out.pnl += r.pnl
        out.shares += r.inv.up_shares + r.inv.down_shares
        out.paired += 2 * r.inv.pairs
        out.worst = min(out.worst, r.pnl)
        equity += r.pnl
        peak = max(peak, equity)
        out.max_drawdown = max(out.max_drawdown, peak - equity)
        day = (r.start - first) // 86400
        out.day_pnl[day] = out.day_pnl.get(day, Decimal(0)) + r.pnl
    return out


def report(rows: list[Summary]) -> str:
    lines = [
        f"{'settings':<34} {'active':>6} {'spent':>9} {'P&L':>9} {'ROI':>7} {'paired':>7} {'worst':>7} {'maxDD':>7}  per day",
    ]
    for r in rows:
        roi = r.pnl / r.spent * 100 if r.spent else Decimal(0)
        paired = r.paired / r.shares * 100 if r.shares else Decimal(0)
        days = " ".join(f"{v:+.0f}" for _, v in sorted(r.day_pnl.items()))
        lines.append(
            f"{r.label:<34} {r.active:>6} {r.spent:>9.2f} {r.pnl:>+9.2f} {roi:>+6.2f}% {paired:>6.0f}% "
            f"{r.worst:>+7.2f} {r.max_drawdown:>7.2f}  {days}"
        )
    lines += [
        "",
        "active = windows where at least one bid filled; spent = money used to buy shares",
        "paired = share of bought shares that ended in Up+Down pairs (pairs pay exactly $1)",
        "worst  = worst single window; maxDD = largest drop from a previous high",
    ]
    return "\n".join(lines)


async def run_mm_backtest(settings: Settings, hours: float, grid: bool = False, touch: bool = False) -> str:
    cache = settings.data_dir / f"mm-history-{settings.market_prefix}"
    tapes = await load_tapes(settings.market_prefix, hours, cache)
    if not tapes:
        return "No finished windows found."
    header = f"{len(tapes)} finished windows, fills counted {'at our price or worse (optimistic)' if touch else 'only below our price (conservative)'}"
    combos = [settings]
    if grid:
        combos = [
            replace(settings, mm_half_spread=Decimal(h), mm_stop_second=stop)
            for h in ("0.005", "0.01", "0.02", "0.03")
            for stop in (120, 180, 240)
        ]
    rows = []
    for s in combos:
        label = f"half_spread={s.mm_half_spread} stop={s.mm_stop_second}s"
        rows.append(summarize(label, [simulate_window(s, t, touch) for t in tapes]))
    return header + "\n\n" + report(rows)
