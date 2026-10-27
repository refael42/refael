import unittest

from bot.fair import BtcSeries, price_to_beat, prob_up

START = 10_000


def series(before: float, during: float) -> BtcSeries:
    """Flat price `before` until the window opens, then `during`."""
    prices = {t: before for t in range(START - 2000, START + 1)}
    prices.update({t: during for t in range(START + 1, START + 300)})
    return BtcSeries(prices)


class FairTest(unittest.TestCase):
    sigma = 0.0001  # 1-second volatility, roughly BTC's

    def test_even_when_price_equals_the_beat(self):
        s = series(80_000, 80_000)
        self.assertAlmostEqual(prob_up(s, START + 10, START, price_to_beat(s, START), self.sigma, 1.5), 0.5)

    def test_moves_with_the_price(self):
        up = series(80_000, 80_050)
        down = series(80_000, 79_950)
        beat = price_to_beat(up, START)
        self.assertGreater(prob_up(up, START + 60, START, beat, self.sigma, 1.5), 0.6)
        self.assertLess(prob_up(down, START + 60, START, beat, self.sigma, 1.5), 0.4)

    def test_more_certain_later_in_the_window(self):
        s = series(80_000, 80_030)
        beat = price_to_beat(s, START)
        early = prob_up(s, START + 30, START, beat, self.sigma, 1.5)
        late = prob_up(s, START + 280, START, beat, self.sigma, 1.5)
        self.assertGreater(late, early)
        self.assertGreater(late, 0.95)

    def test_series_helpers(self):
        s = BtcSeries({1: 100.0, 2: 101.0, 4: 102.0})
        self.assertEqual(s.price(3), 101.0)  # carries the last price forward
        self.assertTrue(s.covers(1, 4, max_gap=2))
        self.assertFalse(s.covers(1, 4, max_gap=1))
        self.assertEqual(s.first_gap(1, 4), 3)
        self.assertIsNone(s.first_gap(1, 2))
        s.trim(3)
        self.assertEqual(sorted(s.prices), [4])
        flat = BtcSeries({t: 50.0 for t in range(0, 100)})
        self.assertEqual(flat.volatility(99, n=50), 0.0)


if __name__ == "__main__":
    unittest.main()
