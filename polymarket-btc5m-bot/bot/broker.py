"""Placing bets: PaperBroker simulates them, LiveBroker sends real orders."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal

from polymarket import AsyncPublicClient, AsyncSecureClient, PolymarketError, RelayerApiKey, UserInputError

from .config import Settings
from .ledger import BetRecord, Ledger
from .market import Window
from .strategy import Bet, split_stake, taker_fee_per_share

log = logging.getLogger("bot")

PUSD_DECIMALS = 6


@dataclass(frozen=True)
class Fill:
    price: Decimal
    shares: Decimal
    cost: Decimal  # all-in, fee included
    fee: Decimal
    order_id: str = ""


class PaperBroker:
    """Fills at the real order book's price for the stake, without sending anything."""

    def __init__(self, client: AsyncPublicClient, ledger: Ledger):
        self.client = client
        self.ledger = ledger

    async def balance(self) -> Decimal:
        return self.ledger.paper_balance

    async def buy(self, window: Window, bet: Bet) -> Fill | str:
        token = window.token_for(bet.side)
        try:
            price = await self.client.estimate_market_price(
                token_id=token, side="BUY", amount=bet.stake_usd, order_type="FAK"
            )
        except PolymarketError as exc:
            return f"could not price the order: {exc}"
        if price > bet.max_price:
            return f"would fill at {price}, above max price {bet.max_price}"
        shares, fee = split_stake(bet.stake_usd, price, window.fee_rate, window.fee_exponent)
        self.ledger.paper_balance -= bet.stake_usd
        return Fill(price=price, shares=shares, cost=bet.stake_usd, fee=fee, order_id="paper")

    async def collect(self, bet: BetRecord) -> bool:
        self.ledger.paper_balance += bet.shares_d
        return True


class LiveBroker:
    def __init__(self, client: AsyncSecureClient, can_redeem: bool):
        self.client = client
        self.can_redeem = can_redeem
        self._warned_redeem = False

    @classmethod
    async def connect(cls, settings: Settings) -> "LiveBroker":
        api_key = None
        if settings.relayer_api_key:
            api_key = RelayerApiKey(key=settings.relayer_api_key, address=settings.relayer_api_key_address)
        client = await AsyncSecureClient.create(
            private_key=settings.private_key,
            wallet=settings.wallet_address,
            api_key=api_key,
        )
        can_redeem = api_key is not None or client.wallet_type == "EOA"
        log.info("Connected: wallet %s (%s)", client.wallet, client.wallet_type)
        return cls(client, can_redeem)

    async def close(self) -> None:
        await self.client.close()

    async def balance(self) -> Decimal:
        info = await self.client.get_balance_allowance(asset_type="COLLATERAL")
        return Decimal(info.balance) / (10**PUSD_DECIMALS)

    async def buy(self, window: Window, bet: Bet) -> Fill | str:
        token = window.token_for(bet.side)
        try:
            resp = await self.client.place_market_order(
                token_id=token,
                side="BUY",
                amount=bet.stake_usd,
                max_spend=bet.stake_usd,  # fee comes out of the stake, not on top of it
                max_price=bet.max_price,
                order_type="FAK",  # take what is there up to max_price, cancel the rest
            )
        except PolymarketError as exc:
            return f"order failed: {type(exc).__name__}: {exc}"
        if not resp.ok:
            return f"order rejected ({resp.code}): {resp.message}"
        spent, shares = resp.making_amount, resp.taking_amount
        if shares <= 0 or spent <= 0:
            return f"order not filled (status {resp.status})"
        price = spent / shares
        fee = shares * taker_fee_per_share(price, window.fee_rate, window.fee_exponent)
        return Fill(price=price, shares=shares, cost=spent + fee, fee=fee, order_id=str(resp.order_id))

    async def collect(self, bet: BetRecord) -> bool:
        """Redeem a winning position so the $1/share lands back in the balance."""
        if not self.can_redeem:
            if not self._warned_redeem:
                log.warning(
                    "Winnings are not redeemed automatically without a Relayer API key. "
                    "Click Claim on polymarket.com, or set POLYMARKET_RELAYER_API_KEY "
                    "and POLYMARKET_RELAYER_API_KEY_ADDRESS."
                )
                self._warned_redeem = True
            return False
        try:
            handle = await self.client.redeem_positions(condition_id=bet.condition_id)
            await handle.wait()
        except UserInputError as exc:
            # Typically "no balance to redeem": it was already claimed on the website.
            log.info("Nothing to redeem for %s (%s)", bet.slug, exc)
            return True
        except PolymarketError as exc:
            log.warning("Redeem of %s failed, will retry: %s", bet.slug, exc)
            return False
        log.info("Redeemed %s shares of %s", bet.shares, bet.slug)
        return True
