"""Market making: rest limit bids on both Up and Down and earn the spread.

One Up share plus one Down share always pays exactly $1 at resolution, so
buying the pair for less than $1 (Up at 0.48 + Down at 0.49 = 0.97) locks in
the difference. Limit orders that rest in the book are "maker" orders: they
pay no fee. The risk is ending a window holding mostly one side because the
price ran away from it (traders who know where BTC is heading sell to stale
bids). Quotes are skewed toward the side we are short of, and capped, to
limit that.

Everything here is pure (no network), shared by the live loop, paper mode and
the backtest.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_DOWN, Decimal

from .config import Settings

TICK = Decimal("0.01")
SIDES = ("Up", "Down")


def floor_tick(price: Decimal, tick: Decimal = TICK) -> Decimal:
    return (price / tick).to_integral_value(rounding=ROUND_DOWN) * tick


@dataclass
class Inventory:
    """What we bought in one window."""

    up_shares: Decimal = Decimal(0)
    up_cost: Decimal = Decimal(0)
    down_shares: Decimal = Decimal(0)
    down_cost: Decimal = Decimal(0)

    def add(self, side: str, shares: Decimal, price: Decimal) -> None:
        if side == "Up":
            self.up_shares += shares
            self.up_cost += shares * price
        else:
            self.down_shares += shares
            self.down_cost += shares * price

    def shares(self, side: str) -> Decimal:
        return self.up_shares if side == "Up" else self.down_shares

    def cost(self, side: str) -> Decimal:
        return self.up_cost if side == "Up" else self.down_cost

    @property
    def imbalance(self) -> Decimal:
        """Positive when we hold more Up than Down."""
        return self.up_shares - self.down_shares

    @property
    def spent(self) -> Decimal:
        return self.up_cost + self.down_cost

    @property
    def pairs(self) -> Decimal:
        return min(self.up_shares, self.down_shares)

    def pnl(self, winner: str) -> Decimal:
        return self.shares(winner) - self.spent


@dataclass(frozen=True)
class Quotes:
    up: Decimal | None  # bid price for Up, or None to not bid
    down: Decimal | None
    reason: str = ""

    def price(self, side: str) -> Decimal | None:
        return self.up if side == "Up" else self.down


def make_quotes(
    s: Settings,
    fair_up: Decimal,
    ask_up: Decimal | None,
    ask_down: Decimal | None,
    inv: Inventory,
) -> Quotes:
    """Where to bid on each side right now.

    bid Up   = fair Up   - MM_HALF_SPREAD - skew
    bid Down = fair Down - MM_HALF_SPREAD + skew,  skew = MM_SKEW_PER_SHARE * (Up held - Down held)

    So holding extra Up makes the Up bid lower and the Down bid higher, which
    pulls the inventory back to balanced pairs.
    """
    fair_down = 1 - fair_up
    if min(fair_up, fair_down) < s.mm_min_price:
        return Quotes(None, None, "window already decided, not quoting")

    skew = s.mm_skew_per_share * inv.imbalance
    raw = {"Up": fair_up - s.mm_half_spread - skew, "Down": fair_down - s.mm_half_spread + skew}
    asks = {"Up": ask_up, "Down": ask_down}
    size = s.mm_order_shares

    bids: dict[str, Decimal | None] = {}
    for side in SIDES:
        bid = floor_tick(raw[side])
        if asks[side] is not None:
            bid = min(bid, asks[side] - TICK)  # a maker bid must stay below the best ask
        bid = min(bid, Decimal("0.99"))
        signed = inv.imbalance if side == "Up" else -inv.imbalance
        if bid < TICK or signed + size > s.mm_max_imbalance_shares:
            bids[side] = None
        else:
            bids[side] = bid

    # Spending cap per window: fund the side that rebalances first.
    order = ("Down", "Up") if inv.imbalance > 0 else ("Up", "Down")
    room = s.mm_max_spend_per_window - inv.spent
    for side in order:
        bid = bids[side]
        if bid is None:
            continue
        if bid * size > room:
            bids[side] = None
        else:
            room -= bid * size

    reason = "" if bids["Up"] or bids["Down"] else "inventory or spending limit reached"
    return Quotes(bids["Up"], bids["Down"], reason)


def implied_sell(asset_side: str, taker_side: str, price: Decimal) -> tuple[str, Decimal]:
    """Which side's bids a trade sold into, and at what price.

    The Up and Down books mirror each other: a bid for Up at b is the same as
    an offer of Down at 1 - b. So a taker selling Up at x hits Up bids at x, and
    a taker buying Down at q also fills Up bids at 1 - q.
    """
    other = "Down" if asset_side == "Up" else "Up"
    if taker_side == "SELL":
        return asset_side, price
    return other, 1 - price


def bid_hit(bid: Decimal, sold_at: Decimal, touch: bool = False) -> bool:
    """Would our bid have filled, given that someone sold to a bid at `sold_at`?

    Strictly: only if they sold below our price (they would have hit us first).
    With touch=True a sale at exactly our price also counts (optimistic: assumes
    we were first in the queue at that price).
    """
    return sold_at < bid or (touch and sold_at == bid)
