"""The trading rule: bet on the side most of the market believes in.

On Polymarket the price of an outcome share is the crowd's probability for
it. If "Up" trades at 0.68, the market thinks there is a 68% chance BTC ends
the 5-minute window higher. "Following the majority" means buying whichever
side is priced above 0.50.

Everything here is pure (no network), so it is shared by the live loop, paper
trading and the backtest, and is covered by tests.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_DOWN, Decimal

from .config import Settings

HALF = Decimal("0.5")
CENT = Decimal("0.01")


@dataclass(frozen=True)
class Quote:
    """What the order book says about one window right now."""

    mid_up: Decimal
    mid_down: Decimal
    ask_up: Decimal | None  # cheapest price someone will sell Up at
    ask_down: Decimal | None


@dataclass(frozen=True)
class Bet:
    side: str  # "Up" or "Down"
    confidence: Decimal  # how sure the crowd is (midpoint of the chosen side)
    ask: Decimal  # best ask of the chosen side
    stake_usd: Decimal  # all-in spend, fee included
    max_price: Decimal  # worst price the market order may fill at


@dataclass(frozen=True)
class Skip:
    reason: str


def majority(quote: Quote) -> tuple[str, Decimal] | None:
    """Return the side the crowd favours and its price, or None on a tie."""
    if quote.mid_up > quote.mid_down:
        return "Up", quote.mid_up
    if quote.mid_down > quote.mid_up:
        return "Down", quote.mid_down
    return None


def stake_for(settings: Settings, bankroll: Decimal, confidence: Decimal) -> Decimal:
    """The "x of the money" formula. Returns dollars before caps.

    fraction    x = BET_FRACTION                           (same share every time)
    confidence  x = BET_FRACTION * (confidence - 0.5) * 2  (bet more the more
                                                           one-sided the crowd is:
                                                           0.55 -> 10% of the
                                                           fraction, 0.75 -> 50%,
                                                           0.95 -> 90%)
    fixed       FIXED_BET_USD, whatever the balance

    To use your own formula, add a branch here and a name to
    config.STAKE_FORMULAS.
    """
    if settings.stake_formula == "fixed":
        return settings.fixed_bet_usd
    if settings.stake_formula == "confidence":
        x = settings.bet_fraction * (confidence - HALF) * 2
        return bankroll * x
    return bankroll * settings.bet_fraction


def decide(settings: Settings, bankroll: Decimal, quote: Quote) -> Bet | Skip:
    picked = majority(quote)
    if picked is None:
        return Skip("market is split 50/50, no majority")
    side, confidence = picked
    ask = quote.ask_up if side == "Up" else quote.ask_down

    if confidence < settings.min_confidence:
        return Skip(f"majority {side} at {confidence} is below MIN_CONFIDENCE {settings.min_confidence}")
    if ask is None:
        return Skip(f"nobody is selling {side}")
    if ask > settings.max_entry_price:
        return Skip(f"{side} costs {ask}, above MAX_ENTRY_PRICE {settings.max_entry_price}")

    stake = stake_for(settings, bankroll, confidence)
    stake = min(stake, settings.max_bet_usd, bankroll)
    stake = stake.quantize(CENT, rounding=ROUND_DOWN)
    if stake < settings.min_bet_usd:
        return Skip(f"stake ${stake} is below MIN_BET_USD ${settings.min_bet_usd}")

    max_price = min(ask + settings.slippage, settings.max_entry_price)
    return Bet(side=side, confidence=confidence, ask=ask, stake_usd=stake, max_price=max_price)


def taker_fee_per_share(price: Decimal, rate: Decimal, exponent: int = 1) -> Decimal:
    """Polymarket taker fee: shares * rate * p * (1 - p) (exponent 1 on crypto markets)."""
    return rate * (price * (1 - price)) ** exponent


def split_stake(stake: Decimal, price: Decimal, rate: Decimal, exponent: int = 1) -> tuple[Decimal, Decimal]:
    """Split an all-in stake into (shares bought, fee paid) at a given fill price.

    The fee is charged on top of the order amount, so
    stake = shares * price + shares * fee_per_share.
    """
    shares = stake / (price + taker_fee_per_share(price, rate, exponent))
    fee = stake - shares * price
    return shares, fee


def settle(shares: Decimal, cost: Decimal, won: bool) -> Decimal:
    """Profit or loss of a finished bet. A winning share pays $1, a losing one $0."""
    payout = shares if won else Decimal(0)
    return payout - cost
