import unittest
from decimal import Decimal as D

from bot.maker import PaperMaker
from bot.market import Window
from bot.mm import Inventory, Quotes, bid_hit, implied_sell, make_quotes
from bot.mm_backtest import Fill, WindowTape, simulate_window
from tests.test_strategy import make_settings


def window() -> Window:
    return Window(
        start=1000, slug="btc-updown-5m-1000", question="q", condition_id="c",
        up_token="UP", down_token="DOWN", accepting_orders=True, closed=False,
        winner=None, split=False, fee_rate=D("0.07"), fee_exponent=1,
    )


class QuotesTest(unittest.TestCase):
    def test_bids_both_sides_below_fair(self):
        q = make_quotes(make_settings(), D("0.505"), D("0.51"), D("0.50"), Inventory())
        self.assertEqual((q.up, q.down), (D("0.49"), D("0.48")))
        self.assertLess(q.up + q.down, 1)

    def test_bids_stay_below_the_ask(self):
        s = make_settings(mm_half_spread=D("0"))
        q = make_quotes(s, D("0.50"), D("0.50"), D("0.51"), Inventory())
        self.assertEqual((q.up, q.down), (D("0.49"), D("0.50")))

    def test_skew_leans_against_inventory(self):
        inv = Inventory()
        inv.add("Up", D("10"), D("0.5"))
        q = make_quotes(make_settings(), D("0.50"), None, None, inv)
        # 10 extra Up shares * 0.002 = 2 cents lower on Up, higher on Down
        self.assertEqual((q.up, q.down), (D("0.47"), D("0.51")))

    def test_stops_adding_to_the_heavy_side(self):
        inv = Inventory()
        inv.add("Up", D("12"), D("0.5"))
        q = make_quotes(make_settings(), D("0.50"), None, None, inv)
        self.assertIsNone(q.up)  # 12 + 5 would pass the 15-share limit
        self.assertIsNotNone(q.down)

    def test_no_quotes_when_one_sided(self):
        q = make_quotes(make_settings(), D("0.90"), None, None, Inventory())
        self.assertEqual((q.up, q.down), (None, None))

    def test_spending_cap(self):
        def spent(amount):
            inv = Inventory()
            inv.add("Up", D("1"), D(amount))
            inv.add("Down", D("1"), D("0"))
            return make_quotes(make_settings(), D("0.50"), None, None, inv)

        self.assertEqual((spent("22").up, spent("22").down), (D("0.49"), None))  # $3 left: one 5-share bid
        self.assertEqual((spent("23").up, spent("23").down), (None, None))  # $2 left: none


class FillRuleTest(unittest.TestCase):
    def test_mirror_books(self):
        self.assertEqual(implied_sell("Up", "SELL", D("0.40")), ("Up", D("0.40")))
        # buying Down at 0.62 fills Up bids at 0.38
        self.assertEqual(implied_sell("Down", "BUY", D("0.62")), ("Up", D("0.38")))

    def test_only_worse_sales_fill_us(self):
        self.assertTrue(bid_hit(D("0.48"), D("0.47")))
        self.assertFalse(bid_hit(D("0.48"), D("0.48")))
        self.assertTrue(bid_hit(D("0.48"), D("0.48"), touch=True))
        self.assertFalse(bid_hit(D("0.48"), D("0.49"), touch=True))

    def test_paper_maker(self):
        w = window()
        m = PaperMaker()
        import asyncio
        asyncio.run(m.sync(w, Quotes(D("0.48"), D("0.49")), D("5")))
        self.assertEqual(m.on_trade(w, "UP", "SELL", D("0.48"), D("10")), [])
        fills = m.on_trade(w, "DOWN", "BUY", D("0.55"), D("3"))  # Up sold at 0.45
        self.assertEqual([(f.side, f.shares, f.price) for f in fills], [("Up", D("3"), D("0.48"))])
        fills = m.on_trade(w, "UP", "SELL", D("0.40"), D("10"))
        self.assertEqual(fills[0].shares, D("2"))  # only what is left of the 5-share bid
        self.assertEqual(m.on_trade(w, "UP", "SELL", D("0.30"), D("10")), [])


class InventoryTest(unittest.TestCase):
    def test_pairs_pay_one_dollar(self):
        inv = Inventory()
        inv.add("Up", D("5"), D("0.48"))
        inv.add("Down", D("5"), D("0.49"))
        self.assertEqual(inv.pnl("Up"), D("0.15"))
        self.assertEqual(inv.pnl("Down"), D("0.15"))


class BacktestTest(unittest.TestCase):
    def test_simulated_window(self):
        tape = WindowTape(
            start=1000,
            winner="Down",
            fair_points=((999, D("0.50")),),
            bid_fills=(
                Fill(ts=1001, side="Up", price=D("0.47"), size=D("5")),  # below our 0.49 Up bid: 5 Up @ 0.49
                # Holding 5 Up skews the Down bid up to 0.50, so this sale at 0.49 fills it.
                Fill(ts=1003, side="Down", price=D("0.49"), size=D("5")),
                Fill(ts=1005, side="Down", price=D("0.49"), size=D("8")),  # balanced again: Down bid 0.49, not hit
                Fill(ts=1007, side="Down", price=D("0.45"), size=D("8")),  # 5 Down @ 0.49
            ),
        )
        r = simulate_window(make_settings(mm_stop_second=10), tape)
        self.assertEqual((r.inv.up_shares, r.inv.up_cost), (D("5"), D("2.45")))
        self.assertEqual((r.inv.down_shares, r.inv.down_cost), (D("10"), D("4.95")))
        self.assertEqual(r.pnl, D("10") - D("7.40"))  # Down won


if __name__ == "__main__":
    unittest.main()
