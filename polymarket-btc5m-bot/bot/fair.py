"""Fair probability of "Up" from the BTC price itself.

How the market resolves: the "price to beat" is BTC's average price over the
60 seconds before the window opens, and the final price is the average over
the window's last 60 seconds. Up wins if final >= beat.

Model: BTC moves like a random walk with the volatility it showed in the last
30 minutes. At second t we know the beat, the current price, and (inside the
last minute) part of the final average, so

    P(Up) = Phi((expected final - beat) / (VOL_SCALE * sd of final))

VOL_SCALE > 1 widens the distribution for BTC's fat tails; 1.5 fitted best on
past windows. Using Binance's per-second price this reproduced the real result
of 98.4% of past windows, and the gap between this fair value and Polymarket's
price partly closes within ~5 seconds, which is what the market maker uses to
move its bids before slower quotes get picked off.
"""

from __future__ import annotations

import bisect
import math

TWAP_SECONDS = 60
WINDOW_SECONDS = 300
VOL_LOOKBACK = 1800


class BtcSeries:
    """BTC price per second (unix second -> price)."""

    def __init__(self, prices: dict[int, float] | None = None):
        self.prices: dict[int, float] = dict(prices or {})
        self._secs: list[int] = sorted(self.prices)

    def add(self, second: int, price: float) -> None:
        if second not in self.prices:
            bisect.insort(self._secs, second)
        self.prices[second] = price

    def trim(self, before: int) -> None:
        """Forget seconds older than `before` (keeps memory flat in a long run)."""
        i = bisect.bisect_left(self._secs, before)
        for sec in self._secs[:i]:
            del self.prices[sec]
        del self._secs[:i]

    @property
    def last_second(self) -> int | None:
        return self._secs[-1] if self._secs else None

    def price(self, t: int) -> float | None:
        """Last known price at or before second t."""
        if t in self.prices:
            return self.prices[t]
        i = bisect.bisect_right(self._secs, t) - 1
        return self.prices[self._secs[i]] if i >= 0 else None

    def covers(self, a: int, b: int, max_gap: int = 5) -> bool:
        """True if seconds a..b have data with no gap longer than max_gap."""
        i = bisect.bisect_left(self._secs, a - max_gap)
        prev = None
        while i < len(self._secs) and self._secs[i] <= b:
            s = self._secs[i]
            if prev is not None and s - prev > max_gap:
                return False
            prev = s
            i += 1
        return prev is not None and prev >= b - max_gap and self.price(a) is not None

    def average(self, a: int, b: int) -> float:
        return sum(self.price(t) for t in range(a, b + 1)) / (b - a + 1)

    def volatility(self, t: int, n: int = VOL_LOOKBACK) -> float:
        """Standard deviation of 1-second log returns over the n seconds before t."""
        rs = []
        prev = self.price(t - n)
        for u in range(t - n + 1, t + 1):
            cur = self.price(u)
            if prev and cur:
                rs.append(math.log(cur / prev))
            prev = cur
        return math.sqrt(sum(r * r for r in rs) / len(rs)) if rs else 0.0


def price_to_beat(btc: BtcSeries, start: int) -> float:
    return btc.average(start - TWAP_SECONDS + 1, start)


def prob_up(btc: BtcSeries, t: int, start: int, beat: float, sigma: float, vol_scale: float) -> float:
    """P(final 60-second average >= beat), using prices up to second t."""
    end = start + WINDOW_SECONDS
    first = end - TWAP_SECONDS + 1  # first second of the final average
    spot = btc.price(t)
    if t < first:
        mean = spot
        var = sigma**2 * spot**2 * ((first - t) + TWAP_SECONDS / 3)
    else:
        realized = sum(btc.price(u) for u in range(first, t + 1))
        mean = (realized + spot * (end - t)) / TWAP_SECONDS
        var = sigma**2 * spot**2 * (end - t) ** 3 / (3 * TWAP_SECONDS**2)
    if var <= 0:
        return 1.0 if mean >= beat else 0.0
    z = (mean - beat) / (vol_scale * math.sqrt(var))
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))
