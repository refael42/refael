import tempfile
import unittest
from dataclasses import replace
from datetime import datetime
from decimal import Decimal as D
from pathlib import Path

from bot.config import Settings
from bot.ledger import BetRecord, Ledger
from bot.market import window_start
from bot.strategy import Bet, Quote, Skip, decide, majority, settle, split_stake, stake_for


def make_settings(**overrides) -> Settings:
    base = Settings(
        mode="paper",
        strategy="majority",
        private_key="",
        wallet_address="",
        relayer_api_key="",
        relayer_api_key_address="",
        market_prefix="btc-updown-5m",
        entry_second=120,
        entry_grace_seconds=30,
        min_confidence=D("0.60"),
        max_entry_price=D("0.90"),
        stake_formula="fraction",
        bet_fraction=D("0.05"),
        fixed_bet_usd=D("3"),
        min_bet_usd=D("1"),
        max_bet_usd=D("10"),
        slippage=D("0.02"),
        max_daily_loss_usd=D("20"),
        stop_below_balance_usd=D("0"),
        paper_start_balance=D("100"),
        mm_half_spread=D("0.01"),
        mm_order_shares=D("5"),
        mm_max_imbalance_shares=D("15"),
        mm_skew_per_share=D("0.002"),
        mm_max_spend_per_window=D("25"),
        mm_start_second=0,
        mm_stop_second=180,
        mm_refresh_seconds=D("2"),
        mm_min_price=D("0.15"),
        data_dir=Path("data"),
    )
    return replace(base, **overrides)


def quote(up: str, ask_up: str | None = None, ask_down: str | None = None) -> Quote:
    u = D(up)
    return Quote(
        mid_up=u,
        mid_down=1 - u,
        ask_up=D(ask_up) if ask_up else u + D("0.01"),
        ask_down=D(ask_down) if ask_down else 1 - u + D("0.01"),
    )


class MajorityTest(unittest.TestCase):
    def test_picks_the_side_priced_above_half(self):
        self.assertEqual(majority(quote("0.68")), ("Up", D("0.68")))
        self.assertEqual(majority(quote("0.30")), ("Down", D("0.70")))

    def test_tie_has_no_majority(self):
        self.assertIsNone(majority(quote("0.5")))


class StakeTest(unittest.TestCase):
    def test_fraction(self):
        self.assertEqual(stake_for(make_settings(), D("200"), D("0.7")), D("10.00"))

    def test_confidence_scales_with_how_one_sided_the_crowd_is(self):
        s = make_settings(stake_formula="confidence", bet_fraction=D("0.10"))
        self.assertEqual(stake_for(s, D("100"), D("0.75")), D("5.0"))  # 10% * 0.5
        self.assertEqual(stake_for(s, D("100"), D("0.95")), D("9.0"))  # 10% * 0.9

    def test_fixed_ignores_balance(self):
        s = make_settings(stake_formula="fixed")
        self.assertEqual(stake_for(s, D("5000"), D("0.8")), D("3"))


class DecideTest(unittest.TestCase):
    def test_bets_the_majority(self):
        d = decide(make_settings(), D("100"), quote("0.30"))
        self.assertIsInstance(d, Bet)
        self.assertEqual(d.side, "Down")
        self.assertEqual(d.stake_usd, D("5.00"))
        self.assertEqual(d.max_price, D("0.73"))  # ask 0.71 + slippage 0.02

    def test_skips_a_weak_majority(self):
        self.assertIsInstance(decide(make_settings(), D("100"), quote("0.55")), Skip)

    def test_skips_when_too_expensive(self):
        self.assertIsInstance(decide(make_settings(), D("100"), quote("0.93")), Skip)

    def test_max_price_never_exceeds_cap(self):
        d = decide(make_settings(), D("100"), quote("0.88", ask_up="0.89"))
        self.assertEqual(d.max_price, D("0.90"))

    def test_caps_stake(self):
        d = decide(make_settings(), D("1000"), quote("0.7"))
        self.assertEqual(d.stake_usd, D("10"))

    def test_skips_when_stake_below_minimum(self):
        d = decide(make_settings(), D("15"), quote("0.7"))  # 5% of 15 = 0.75
        self.assertIsInstance(d, Skip)

    def test_never_bets_more_than_the_balance(self):
        s = make_settings(stake_formula="fixed", fixed_bet_usd=D("8"))
        self.assertEqual(decide(s, D("4.5"), quote("0.7")).stake_usd, D("4.50"))

    def test_no_sellers(self):
        q = Quote(mid_up=D("0.7"), mid_down=D("0.3"), ask_up=None, ask_down=D("0.31"))
        self.assertIsInstance(decide(make_settings(), D("100"), q), Skip)


class MoneyTest(unittest.TestCase):
    def test_fee_matches_polymarket_table(self):
        # Polymarket fee table: 100 shares at $0.50 on a crypto market cost $1.75 in fees.
        shares, fee = split_stake(D("51.75"), D("0.5"), D("0.07"))
        self.assertAlmostEqual(float(shares), 100, places=6)
        self.assertAlmostEqual(float(fee), 1.75, places=6)

    def test_settle(self):
        self.assertEqual(settle(D("10"), D("7"), won=True), D("3"))
        self.assertEqual(settle(D("10"), D("7"), won=False), D("-7"))


class WindowTest(unittest.TestCase):
    def test_window_start(self):
        self.assertEqual(window_start(1793089500), 1793089500)
        self.assertEqual(window_start(1793089799.9), 1793089500)
        self.assertEqual(window_start(1793089800), 1793089800)


class LedgerTest(unittest.TestCase):
    def test_round_trip_and_daily_pnl(self):
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Ledger(Path(tmp), "paper", D("100"))
            bet = BetRecord(
                window_start=1, slug="s", question="q", condition_id="c", side="Up", token_id="t",
                confidence="0.7", price="0.7", shares="10", cost="7.1", fee="0.1",
                placed_at=datetime.now().isoformat(),
            )
            bet.status, bet.pnl, bet.settled_at = "lost", "-7.1", datetime.now().isoformat()
            ledger.add(bet)
            ledger.mark(1, "bet")
            ledger.paper_balance = D("92.9")
            ledger.save()

            again = Ledger(Path(tmp), "paper", D("100"))
            self.assertEqual(again.paper_balance, D("92.9"))
            self.assertTrue(again.handled(1))
            self.assertEqual(again.realized_pnl_on(datetime.now().date()), D("-7.1"))
            self.assertTrue((Path(tmp) / "paper-trades.csv").exists())


if __name__ == "__main__":
    unittest.main()
