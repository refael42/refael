"""Settings, read from environment variables and an optional .env file."""

from __future__ import annotations

import os
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent

STAKE_FORMULAS = ("fraction", "confidence", "fixed")
STRATEGIES = ("majority", "market_maker")


def load_dotenv(path: Path) -> None:
    """Minimal .env reader: KEY=VALUE lines, # comments. Real env vars win."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _str(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _dec(name: str, default: str) -> Decimal:
    raw = _str(name, default) or default
    try:
        return Decimal(raw)
    except Exception as exc:
        raise ValueError(f"{name} must be a number, got {raw!r}") from exc


def _int(name: str, default: int) -> int:
    raw = _str(name, str(default)) or str(default)
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be a whole number, got {raw!r}") from exc


@dataclass(frozen=True)
class Settings:
    mode: str  # "paper" or "live"
    strategy: str  # "majority" (bet with the crowd) or "market_maker"

    # Account (live mode only)
    private_key: str
    wallet_address: str
    relayer_api_key: str
    relayer_api_key_address: str

    # Which markets: "<market_prefix>-<window start unix ts>", e.g. btc-updown-5m-1793089500
    market_prefix: str

    # When to enter: seconds after the 5-minute window opens
    entry_second: int
    # Stop trying to enter this many seconds after entry_second
    entry_grace_seconds: int

    # Filters
    min_confidence: Decimal  # majority side must be priced at least this (0.5 - 1)
    max_entry_price: Decimal  # never pay more than this per share

    # Stake ("x of the money")
    stake_formula: str  # fraction | confidence | fixed
    bet_fraction: Decimal  # used by "fraction" and "confidence"
    fixed_bet_usd: Decimal  # used by "fixed"
    min_bet_usd: Decimal  # skip the window if the formula gives less than this
    max_bet_usd: Decimal  # hard cap per bet

    # Execution
    slippage: Decimal  # how far above the best ask a market buy may fill

    # Risk
    max_daily_loss_usd: Decimal  # stop for the day after losing this much (0 = no limit)
    stop_below_balance_usd: Decimal  # stop when the balance drops below this

    # Paper mode
    paper_start_balance: Decimal

    # Market maker (STRATEGY=market_maker)
    mm_half_spread: Decimal  # bid this far below the fair price on each side
    mm_order_shares: Decimal  # size of each bid (Polymarket minimum is 5)
    mm_max_imbalance_shares: Decimal  # most extra shares of one side we will hold
    mm_skew_per_share: Decimal  # move quotes this much per share of imbalance
    mm_max_spend_per_window: Decimal  # most money committed in one window
    mm_start_second: int  # start quoting this many seconds into the window
    mm_stop_second: int  # cancel everything at this second
    mm_refresh_seconds: Decimal  # how often to re-price the bids
    mm_min_price: Decimal  # stop quoting when either side is cheaper than this

    data_dir: Path

    @property
    def live(self) -> bool:
        return self.mode == "live"


def load_settings() -> Settings:
    load_dotenv(PROJECT_DIR / ".env")

    mode = _str("MODE", "paper").lower()
    if mode not in ("paper", "live"):
        raise ValueError(f"MODE must be 'paper' or 'live', got {mode!r}")

    strategy = _str("STRATEGY", "majority").lower()
    if strategy not in STRATEGIES:
        raise ValueError(f"STRATEGY must be one of {', '.join(STRATEGIES)}")

    stake_formula = _str("STAKE_FORMULA", "fraction").lower()
    if stake_formula not in STAKE_FORMULAS:
        raise ValueError(f"STAKE_FORMULA must be one of {', '.join(STAKE_FORMULAS)}")

    data_dir = Path(_str("DATA_DIR", "data"))
    if not data_dir.is_absolute():
        data_dir = PROJECT_DIR / data_dir

    settings = Settings(
        mode=mode,
        strategy=strategy,
        private_key=_str("POLYMARKET_PRIVATE_KEY"),
        wallet_address=_str("POLYMARKET_WALLET_ADDRESS"),
        relayer_api_key=_str("POLYMARKET_RELAYER_API_KEY"),
        relayer_api_key_address=_str("POLYMARKET_RELAYER_API_KEY_ADDRESS"),
        market_prefix=_str("MARKET_PREFIX", "btc-updown-5m"),
        entry_second=_int("ENTRY_SECOND", 120),
        entry_grace_seconds=_int("ENTRY_GRACE_SECONDS", 30),
        min_confidence=_dec("MIN_CONFIDENCE", "0.70"),
        max_entry_price=_dec("MAX_ENTRY_PRICE", "0.95"),
        stake_formula=stake_formula,
        bet_fraction=_dec("BET_FRACTION", "0.02"),
        fixed_bet_usd=_dec("FIXED_BET_USD", "2"),
        min_bet_usd=_dec("MIN_BET_USD", "1"),
        max_bet_usd=_dec("MAX_BET_USD", "10"),
        slippage=_dec("SLIPPAGE", "0.02"),
        max_daily_loss_usd=_dec("MAX_DAILY_LOSS_USD", "20"),
        stop_below_balance_usd=_dec("STOP_BELOW_BALANCE_USD", "0"),
        paper_start_balance=_dec("PAPER_START_BALANCE", "100"),
        mm_half_spread=_dec("MM_HALF_SPREAD", "0.01"),
        mm_order_shares=_dec("MM_ORDER_SHARES", "5"),
        mm_max_imbalance_shares=_dec("MM_MAX_IMBALANCE_SHARES", "15"),
        mm_skew_per_share=_dec("MM_SKEW_PER_SHARE", "0.002"),
        mm_max_spend_per_window=_dec("MM_MAX_SPEND_PER_WINDOW", "25"),
        mm_start_second=_int("MM_START_SECOND", 0),
        mm_stop_second=_int("MM_STOP_SECOND", 180),
        mm_refresh_seconds=_dec("MM_REFRESH_SECONDS", "2"),
        mm_min_price=_dec("MM_MIN_PRICE", "0.15"),
        data_dir=data_dir,
    )
    validate(settings)
    return settings


def validate(s: Settings) -> None:
    if not 0 <= s.entry_second < 300:
        raise ValueError("ENTRY_SECOND must be between 0 and 299")
    if not Decimal("0.5") <= s.min_confidence < 1:
        raise ValueError("MIN_CONFIDENCE must be between 0.5 and 1")
    if not 0 < s.max_entry_price < 1:
        raise ValueError("MAX_ENTRY_PRICE must be between 0 and 1")
    if not 0 < s.bet_fraction <= 1:
        raise ValueError("BET_FRACTION must be between 0 and 1 (0.02 = 2%)")
    if s.max_bet_usd < s.min_bet_usd:
        raise ValueError("MAX_BET_USD must be at least MIN_BET_USD")
    if not 0 <= s.mm_start_second < s.mm_stop_second <= 295:
        raise ValueError("Need 0 <= MM_START_SECOND < MM_STOP_SECOND <= 295")
    if s.mm_order_shares < 5:
        raise ValueError("MM_ORDER_SHARES must be at least 5 (Polymarket minimum order size)")
    if s.mm_max_imbalance_shares < s.mm_order_shares:
        raise ValueError("MM_MAX_IMBALANCE_SHARES must be at least MM_ORDER_SHARES")
    if not 0 <= s.mm_half_spread < Decimal("0.5"):
        raise ValueError("MM_HALF_SPREAD must be between 0 and 0.5")
    if s.mm_refresh_seconds < 1:
        raise ValueError("MM_REFRESH_SECONDS must be at least 1")
    if s.live:
        if not s.private_key:
            raise ValueError("Live mode needs POLYMARKET_PRIVATE_KEY")
        if not s.wallet_address:
            raise ValueError("Live mode needs POLYMARKET_WALLET_ADDRESS")
        if bool(s.relayer_api_key) != bool(s.relayer_api_key_address):
            raise ValueError(
                "Set both POLYMARKET_RELAYER_API_KEY and POLYMARKET_RELAYER_API_KEY_ADDRESS, or neither"
            )
