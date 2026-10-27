"""Finding the current 5-minute window and reading its order book."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from decimal import Decimal

from polymarket import AsyncPublicClient, AsyncSecureClient, OrderBook, PolymarketError

from .strategy import Quote

WINDOW_SECONDS = 300

Client = AsyncPublicClient | AsyncSecureClient


def window_start(ts: float) -> int:
    """Unix timestamp of the 5-minute window containing ts (windows start on :00, :05, ...)."""
    t = int(ts)
    return t - t % WINDOW_SECONDS


def slug_for(prefix: str, start: int) -> str:
    return f"{prefix}-{start}"


@dataclass(frozen=True)
class Window:
    start: int
    slug: str
    question: str
    condition_id: str
    up_token: str
    down_token: str
    accepting_orders: bool
    closed: bool
    winner: str | None  # "Up", "Down" or None while unresolved
    split: bool  # resolved 50/50 (rare): each share pays $0.50
    fee_rate: Decimal
    fee_exponent: int

    def token_for(self, side: str) -> str:
        return self.up_token if side == "Up" else self.down_token


async def load_window(client: Client, prefix: str, start: int) -> Window | None:
    """Fetch the market for one window. None if Polymarket has no such market."""
    slug = slug_for(prefix, start)
    try:
        m = await client.get_market(slug=slug)
    except PolymarketError:
        return None

    up, down = m.outcomes.yes, m.outcomes.no
    if up is None or down is None or not up.token_id or not down.token_id:
        return None
    if (up.label or "").lower() != "up":
        # Defensive: these markets always list Up first. Bail out if that ever changes.
        up, down = down, up
    if (up.label or "").lower() != "up" or (down.label or "").lower() != "down":
        return None

    winner = None
    split = False
    if m.state.closed:
        if up.price == 1 and down.price == 0:
            winner = "Up"
        elif down.price == 1 and up.price == 0:
            winner = "Down"
        elif up.price == down.price == Decimal("0.5"):
            split = True

    fee = m.trading.fee_schedule
    fee_rate = fee.rate if (m.trading.fees_enabled and fee is not None) else Decimal(0)
    fee_exponent = fee.exponent if fee is not None else 1

    return Window(
        start=start,
        slug=slug,
        question=m.question or slug,
        condition_id=str(m.condition_id),
        up_token=str(up.token_id),
        down_token=str(down.token_id),
        accepting_orders=bool(m.state.accepting_orders),
        closed=bool(m.state.closed),
        winner=winner,
        split=split,
        fee_rate=fee_rate,
        fee_exponent=fee_exponent,
    )


def _best_ask(book: OrderBook) -> Decimal | None:
    return min((lvl.price for lvl in book.asks if lvl.size > 0), default=None)


async def load_quote(client: Client, window: Window) -> Quote:
    """Crowd prices (CLOB midpoints) and the best ask on each side."""
    tokens = [window.up_token, window.down_token]
    mids, books = await asyncio.gather(
        client.get_midpoints(token_ids=tokens),
        client.get_order_books(token_ids=tokens),
    )
    mids = {str(k): v for k, v in mids.items()}
    asks = {str(b.asset_id): _best_ask(b) for b in books}
    return Quote(
        mid_up=mids[window.up_token],
        mid_down=mids[window.down_token],
        ask_up=asks.get(window.up_token),
        ask_down=asks.get(window.down_token),
    )
