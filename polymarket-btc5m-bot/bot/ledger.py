"""Record of every bet the bot made, saved to data/<mode>-ledger.json.

Paper and live keep separate ledgers so practice runs never mix with real
money. A CSV copy (data/<mode>-trades.csv) is rewritten on every change so
the history can be opened in Excel or Google Sheets.
"""

from __future__ import annotations

import csv
import json
import os
from dataclasses import asdict, dataclass, fields
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

KEEP_ATTEMPTS = 300  # how many recent windows to remember as "already handled"


@dataclass
class BetRecord:
    window_start: int
    slug: str
    question: str
    condition_id: str
    side: str
    token_id: str
    confidence: str  # crowd's price for the side when we decided
    price: str  # average fill price
    shares: str
    cost: str  # total spent, fee included
    fee: str
    placed_at: str
    order_id: str = ""
    status: str = "open"  # open | won | lost | void
    pnl: str = "0"
    settled_at: str = ""
    redeemed: bool = False

    @property
    def cost_d(self) -> Decimal:
        return Decimal(self.cost)

    @property
    def shares_d(self) -> Decimal:
        return Decimal(self.shares)

    @property
    def pnl_d(self) -> Decimal:
        return Decimal(self.pnl)


class Ledger:
    def __init__(self, data_dir: Path, mode: str, paper_start_balance: Decimal):
        data_dir.mkdir(parents=True, exist_ok=True)
        self.path = data_dir / f"{mode}-ledger.json"
        self.csv_path = data_dir / f"{mode}-trades.csv"
        self.bets: list[BetRecord] = []
        self.attempted: dict[str, str] = {}  # window start -> what happened
        self.paper_balance = paper_start_balance
        if self.path.exists():
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            known = {f.name for f in fields(BetRecord)}
            self.bets = [BetRecord(**{k: v for k, v in b.items() if k in known}) for b in raw.get("bets", [])]
            self.attempted = raw.get("attempted", {})
            self.paper_balance = Decimal(raw.get("paper_balance", str(paper_start_balance)))

    def save(self) -> None:
        recent = sorted(self.attempted, key=int)[-KEEP_ATTEMPTS:]
        self.attempted = {k: self.attempted[k] for k in recent}
        payload = {
            "paper_balance": str(self.paper_balance),
            "attempted": self.attempted,
            "bets": [asdict(b) for b in self.bets],
        }
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=1), encoding="utf-8")
        os.replace(tmp, self.path)
        self._write_csv()

    def _write_csv(self) -> None:
        names = [f.name for f in fields(BetRecord)]
        tmp = self.csv_path.with_suffix(".tmp")
        with tmp.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=names)
            writer.writeheader()
            for b in self.bets:
                writer.writerow(asdict(b))
        os.replace(tmp, self.csv_path)

    # --- windows -----------------------------------------------------------

    def handled(self, start: int) -> bool:
        return str(start) in self.attempted

    def mark(self, start: int, outcome: str) -> None:
        self.attempted[str(start)] = outcome

    # --- bets --------------------------------------------------------------

    def add(self, bet: BetRecord) -> None:
        self.bets.append(bet)

    def open_bets(self) -> list[BetRecord]:
        return [b for b in self.bets if b.status == "open"]

    def unredeemed_wins(self) -> list[BetRecord]:
        """Bets with something to collect: wins, and 50/50 resolutions ("void")."""
        return [b for b in self.bets if b.status in ("won", "void") and not b.redeemed]

    def realized_pnl_on(self, day: date) -> Decimal:
        total = Decimal(0)
        for b in self.bets:
            if b.settled_at and datetime.fromisoformat(b.settled_at).date() == day:
                total += b.pnl_d
        return total

    def summary(self) -> str:
        settled = [b for b in self.bets if b.status in ("won", "lost")]
        if not self.bets:
            return "No bets yet."
        wins = sum(1 for b in settled if b.status == "won")
        staked = sum((b.cost_d for b in settled), Decimal(0))
        fees = sum((Decimal(b.fee) for b in settled), Decimal(0))
        pnl = sum((b.pnl_d for b in settled), Decimal(0))
        avg_price = (
            sum((Decimal(b.price) for b in settled), Decimal(0)) / len(settled) if settled else Decimal(0)
        )
        lines = [
            f"Bets: {len(self.bets)} ({len(self.open_bets())} still open)",
        ]
        if settled:
            lines += [
                f"Won {wins} of {len(settled)} ({Decimal(wins) / len(settled) * 100:.1f}%), "
                f"average price paid {avg_price * 100:.1f}c "
                f"(the win rate needed just to break even)",
                f"Staked ${staked:.2f}, fees ${fees:.2f}, P&L ${pnl:+.2f} "
                f"({(pnl / staked * 100) if staked else 0:+.2f}% of staked)",
            ]
        return "\n".join(lines)
