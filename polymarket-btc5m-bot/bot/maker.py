"""Resting bids for the market maker: simulated (paper) or real (live)."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from decimal import Decimal

from polymarket import AsyncSecureClient, OrderHeartbeatMismatchError, PolymarketError

from .market import WINDOW_SECONDS, Window
from .mm import SIDES, Quotes, bid_hit, implied_sell

log = logging.getLogger("bot")

HEARTBEAT_SECONDS = 4  # Polymarket cancels everything if it hears nothing for 10s
MIN_EXPIRY_SECONDS = 200  # orders must expire at least 3 minutes out


@dataclass(frozen=True)
class MakerFill:
    side: str
    shares: Decimal
    price: Decimal


@dataclass
class Bid:
    price: Decimal
    size: Decimal
    filled: Decimal = Decimal(0)
    order_id: str = ""

    @property
    def remaining(self) -> Decimal:
        return self.size - self.filled


class PaperMaker:
    """Bids that exist only here. They fill when the real trade stream shows
    someone selling below our price (see mm.bid_hit), so paper results only
    count fills we would certainly have had."""

    def __init__(self, touch: bool = False):
        self.touch = touch
        self.bids: dict[str, Bid] = {}

    async def sync(self, window: Window, quotes: Quotes, size: Decimal) -> list[MakerFill]:
        for side in SIDES:
            want = quotes.price(side)
            have = self.bids.get(side)
            if want is None:
                self.bids.pop(side, None)
            elif have is None or have.price != want or have.remaining <= 0:
                self.bids[side] = Bid(price=want, size=size)
        return []

    def on_trade(self, window: Window, asset_id: str, taker_side: str, price: Decimal, size: Decimal | None) -> list[MakerFill]:
        asset_side = "Up" if asset_id == window.up_token else "Down"
        side, sold_at = implied_sell(asset_side, taker_side, price)
        bid = self.bids.get(side)
        if bid is None or bid.remaining <= 0 or not bid_hit(bid.price, sold_at, self.touch):
            return []
        got = min(bid.remaining, size) if size else bid.remaining
        bid.filled += got
        return [MakerFill(side=side, shares=got, price=bid.price)]

    async def poll(self, window: Window) -> list[MakerFill]:
        return []

    async def cancel_all(self, window: Window) -> list[MakerFill]:
        self.bids.clear()
        return []

    async def close(self) -> None:
        pass


class LiveMaker:
    """Real post-only limit orders. Post-only means an order that would trade
    immediately is rejected instead, so we only ever pay maker fees (zero)."""

    def __init__(self, client: AsyncSecureClient):
        self.client = client
        self.bids: dict[str, Bid] = {}
        self._heartbeat: asyncio.Task | None = None

    # --- safety net: if the bot dies, Polymarket cancels its orders ---------

    def _ensure_heartbeat(self) -> None:
        if self._heartbeat is None:
            self._heartbeat = asyncio.create_task(self._beat())

    async def _beat(self) -> None:
        beat_id = ""
        while True:
            try:
                beat_id = (await self.client.send_order_heartbeat(heartbeat_id=beat_id)).heartbeat_id
            except OrderHeartbeatMismatchError as exc:
                beat_id = exc.heartbeat_id
                continue
            except PolymarketError as exc:
                log.warning("Order heartbeat failed: %s", exc)
            await asyncio.sleep(HEARTBEAT_SECONDS)

    # --- orders --------------------------------------------------------------

    async def _place(self, window: Window, side: str, price: Decimal, size: Decimal) -> Bid | None:
        expiration = int(max(window.start + WINDOW_SECONDS, time.time() + MIN_EXPIRY_SECONDS))
        self._ensure_heartbeat()
        try:
            resp = await self.client.place_limit_order(
                token_id=window.token_for(side),
                side="BUY",
                price=price,
                size=size,
                post_only=True,
                expiration=expiration,
            )
        except PolymarketError as exc:
            log.warning("Placing %s bid at %s failed: %s", side, price, exc)
            return None
        if not resp.ok:
            if resp.code != "post_only_would_cross":
                log.warning("%s bid at %s rejected (%s): %s", side, price, resp.code, resp.message)
            return None
        bid = Bid(price=price, size=size, order_id=str(resp.order_id))
        # A post-only order can still be partly filled by the time it is acknowledged.
        bid.filled = min(resp.taking_amount, size) if resp.status == "matched" else Decimal(0)
        return bid

    async def _refresh(self, side: str, bid: Bid) -> tuple[list[MakerFill], bool]:
        """New fills on one order, and whether it is still resting."""
        try:
            order = await self.client.get_order(order_id=bid.order_id)
        except PolymarketError:
            return [], False  # gone (filled or cancelled); fills are reconciled after the window
        fills = []
        if order.size_matched > bid.filled:
            fills.append(MakerFill(side=side, shares=order.size_matched - bid.filled, price=bid.price))
            bid.filled = order.size_matched
        resting = order.status.upper() == "LIVE" and bid.remaining > 0
        return fills, resting

    async def poll(self, window: Window) -> list[MakerFill]:
        fills: list[MakerFill] = []
        for side, bid in list(self.bids.items()):
            got, resting = await self._refresh(side, bid)
            fills += got
            if not resting:
                self.bids.pop(side, None)
        return fills

    async def _cancel(self, side: str, bid: Bid) -> list[MakerFill]:
        try:
            await self.client.cancel_order(order_id=bid.order_id)
        except PolymarketError as exc:
            log.warning("Cancel of %s bid failed: %s", side, exc)
        fills, _ = await self._refresh(side, bid)
        return fills

    async def sync(self, window: Window, quotes: Quotes, size: Decimal) -> list[MakerFill]:
        fills: list[MakerFill] = []
        for side in SIDES:
            want = quotes.price(side)
            have = self.bids.get(side)
            if have is not None and (want is None or have.price != want):
                fills += await self._cancel(side, have)
                self.bids.pop(side, None)
                have = None
            if want is not None and have is None:
                bid = await self._place(window, side, want, size)
                if bid is not None:
                    if bid.filled:
                        fills.append(MakerFill(side=side, shares=bid.filled, price=bid.price))
                    if bid.remaining > 0:
                        self.bids[side] = bid
        return fills

    async def cancel_all(self, window: Window) -> list[MakerFill]:
        fills: list[MakerFill] = []
        try:
            await self.client.cancel_market_orders(market=window.condition_id)
        except PolymarketError as exc:
            log.warning("Cancel-all for %s failed: %s", window.slug, exc)
        for side, bid in list(self.bids.items()):
            got, _ = await self._refresh(side, bid)
            fills += got
        self.bids.clear()
        return fills

    async def close(self) -> None:
        if self._heartbeat is not None:
            self._heartbeat.cancel()
