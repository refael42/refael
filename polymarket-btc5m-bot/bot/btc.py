"""Live per-second BTC price: Polymarket's real-time Binance feed, with gaps
filled from Binance's public market-data mirror."""

from __future__ import annotations

import asyncio
import logging
import time

import httpx
from polymarket import AsyncPublicClient
from polymarket.streams import CryptoPricesSpec

from .fair import VOL_LOOKBACK, BtcSeries

log = logging.getLogger("bot")

KLINES_URL = "https://data-api.binance.vision/api/v3/klines"
STALE_SECONDS = 5


async def fetch_klines(http: httpx.AsyncClient, start: int, end: int) -> dict[int, float]:
    """1-second closes for seconds start..end (Binance BTCUSDT)."""
    out: dict[int, float] = {}
    t = start
    while t <= end:
        resp = await http.get(
            KLINES_URL,
            params={"symbol": "BTCUSDT", "interval": "1s", "startTime": t * 1000, "limit": 1000},
        )
        resp.raise_for_status()
        rows = resp.json()
        if not rows:
            break
        for k in rows:
            out[int(k[0]) // 1000] = float(k[4])
        t = int(rows[-1][0]) // 1000 + 1
    return out


class LiveBtc:
    def __init__(self, public: AsyncPublicClient):
        self.public = public
        self.series = BtcSeries()
        self._tasks: list[asyncio.Task] = []
        self._last_update = 0.0

    async def start(self) -> None:
        now = int(time.time())
        async with httpx.AsyncClient(timeout=20) as http:
            for s, p in (await fetch_klines(http, now - VOL_LOOKBACK - 120, now)).items():
                self.series.add(s, p)
        self._last_update = time.time()
        self._tasks = [asyncio.create_task(self._stream()), asyncio.create_task(self._fill_gaps())]
        log.info("BTC price feed ready (%d seconds of history)", len(self.series.prices))

    async def close(self) -> None:
        for task in self._tasks:
            task.cancel()

    @property
    def fresh(self) -> bool:
        last = self.series.last_second
        return last is not None and time.time() - last < STALE_SECONDS

    async def _stream(self) -> None:
        spec = CryptoPricesSpec(topic="prices.crypto.binance", symbols=["btcusdt"])
        while True:
            try:
                async with await self.public.subscribe([spec]) as stream:
                    async for ev in stream:
                        p = ev.payload
                        self.series.add(int(p.timestamp) // 1000, float(p.value))
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # the stream can drop; reconnect
                log.warning("BTC price stream dropped (%s), reconnecting", exc)
                await asyncio.sleep(1)

    async def _fill_gaps(self) -> None:
        """Fill holes from Binance's REST mirror: right away while the stream is
        silent, and any hole in the last half hour so the volatility estimate and
        price to beat stay usable after a stream outage."""
        async with httpx.AsyncClient(timeout=20) as http:
            while True:
                await asyncio.sleep(2)
                now = int(time.time())
                self.series.trim(now - VOL_LOOKBACK - 3600)
                gap = self.series.first_gap(now - VOL_LOOKBACK - 60, now - 3)
                if gap is None:
                    continue
                try:
                    for s, p in (await fetch_klines(http, gap, now)).items():
                        self.series.add(s, p)
                except (httpx.HTTPError, ValueError) as exc:
                    log.warning("BTC backfill failed: %s", exc)
                    await asyncio.sleep(5)
