"""Command line: python -m bot run | check | stats | backtest"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import time

from .config import load_settings


def setup_logging(settings) -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(message)s", "%Y-%m-%d %H:%M:%S")
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    file = logging.FileHandler(settings.data_dir / f"{settings.mode}-bot.log", encoding="utf-8")
    file.setFormatter(fmt)
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(console)
    root.addHandler(file)
    logging.getLogger("httpx").setLevel(logging.WARNING)


async def cmd_check(settings) -> None:
    """Connect, show balance and the current window's crowd without trading."""
    from polymarket import AsyncPublicClient

    from .broker import LiveBroker
    from .market import load_quote, load_window, window_start
    from .runner import geoblock_status
    from .strategy import Bet, decide

    geo = await geoblock_status()
    print(f"Location: {geo.get('country')} {geo.get('region') or ''} -> "
          f"{'BLOCKED by Polymarket' if geo.get('blocked') else 'allowed'}")

    balance = settings.paper_start_balance
    if settings.live:
        broker = await LiveBroker.connect(settings)
        try:
            balance = await broker.balance()
            print(f"Wallet {broker.client.wallet} ({broker.client.wallet_type}), balance ${balance:.2f} pUSD")
            print("Auto-redeem of winnings:", "on" if broker.can_redeem else "off (no Relayer API key)")
        finally:
            await broker.close()
    else:
        print(f"Paper mode, starting balance ${balance}")

    async with AsyncPublicClient() as client:
        start = window_start(time.time())
        window = await load_window(client, settings.market_prefix, start)
        if window is None:
            print(f"No market for {settings.market_prefix}-{start}")
            return
        quote = await load_quote(client, window)
        print(window.question)
        print(f"  Up   mid {quote.mid_up:.3f}  ask {quote.ask_up}")
        print(f"  Down mid {quote.mid_down:.3f}  ask {quote.ask_down}")
        print(f"  Taker fee rate {window.fee_rate}, {int(time.time()) - start}s into the window")
        d = decide(settings, balance, quote)
        if isinstance(d, Bet):
            print(f"  If the bot entered now: BUY {d.side} for ${d.stake_usd} (crowd {d.confidence:.3f}, max price {d.max_price})")
        else:
            print(f"  If the bot entered now: skip ({d.reason})")


async def cmd_backtest(settings, hours: float, entries: list[int], flat: bool) -> None:
    from .backtest import run_backtest

    print(f"Loading {hours:g}h of finished windows (cached after the first run)...")
    print(await run_backtest(settings, hours, entries, flat=flat))


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m bot", description="Polymarket BTC 5-minute majority bot")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run", help="run the bot (paper or live, see MODE in .env)")
    sub.add_parser("check", help="test the connection and show the current window, no trading")
    sub.add_parser("stats", help="summary of the bets so far")
    bt = sub.add_parser("backtest", help="replay the strategy on past windows")
    bt.add_argument("--hours", type=float, default=48, help="how far back (default 48)")
    bt.add_argument("--entries", default="0,60,120,180,240", help="entry seconds to compare")
    bt.add_argument("--flat", action="store_true", help="bet $1 every time instead of your formula")
    args = parser.parse_args()

    try:
        settings = load_settings()
    except ValueError as exc:
        sys.exit(f"Settings error: {exc}")

    if args.cmd == "run":
        from .runner import Runner

        setup_logging(settings)
        try:
            asyncio.run(Runner(settings).run_forever())
        except KeyboardInterrupt:
            print("\nStopped.")
    elif args.cmd == "check":
        asyncio.run(cmd_check(settings))
    elif args.cmd == "stats":
        from .ledger import Ledger

        ledger = Ledger(settings.data_dir, settings.mode, settings.paper_start_balance)
        print(f"[{settings.mode}]")
        print(ledger.summary())
        if not settings.live:
            print(f"Paper balance ${ledger.paper_balance:.2f}")
    elif args.cmd == "backtest":
        entries = [int(x) for x in args.entries.split(",") if x.strip()]
        asyncio.run(cmd_backtest(settings, args.hours, entries, args.flat))


if __name__ == "__main__":
    main()
