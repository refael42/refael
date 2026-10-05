import { DAY } from '../data/staff';
import { UPGRADES } from '../data/upgrades';
import { ZERO, type Big } from './big';
import { canBuy, costOf, levelOf } from './economy/upgrades';
import { signingFee } from './game/applicants';
import { queueCommand, tapTargets } from './game/commands';
import { TableState, type Command, type GameState } from './game/types';
import { hasRoom, headcount } from './game/workers';

// A stand-in manager for headless runs (balance script, offline progress): it taps what a
// player would tap, after a human-ish reaction delay, and can buy upgrades greedily.

export interface BotOptions {
  /** Seconds a tappable thing waits before the bot reacts. */
  reaction: number;
  /** Also tap ready dishes and dirty tables (an attentive player), or only seat people. */
  helpStaff: boolean;
  /** Hire whoever applies (if there is room) and buy the cheapest affordable upgrade. */
  buy: boolean;
}

export interface Hire {
  time: number;
  role: string;
}

export interface Purchase {
  time: number;
  item: string;
  level: number;
  cost: number;
}

export interface Bot {
  /** Call once per fixed step, before `stepGame`. */
  act: (s: GameState) => void;
  purchases: Purchase[];
  hires: Hire[];
}

/** Without a dishwasher, an attentive manager taps the sink about this often. */
const WASH_TAP_SECONDS = 0.35;
/** Past this share of the day, the bot keeps the wages aside. */
const PAYDAY_SAVING = 0.75;

const keyOf = (c: Command): string => {
  switch (c.type) {
    case 'seat':
      return `seat${c.customer}`;
    case 'serve':
      return `serve${c.order}`;
    case 'clean':
      return `clean${c.table}`;
    default:
      return c.type;
  }
};

/** How many of each job a sensible manager keeps for this restaurant size. */
function wanted(s: GameState, role: string): number {
  const tables = s.tables.length;
  switch (role) {
    case 'cook':
      return s.stoves.length;
    case 'waiter':
      return 1 + Math.floor(tables / 4);
    case 'washer':
      return 1;
    case 'host':
      return tables >= 4 ? 1 : 0;
    default:
      return tables >= 6 ? 1 : 0;
  }
}

/** The cheapest upgrade this budget buys right now, if any. */
export function cheapestAffordable(s: GameState, budget: Big = s.coins): string | null {
  let best: string | null = null;
  let bestCost = Infinity;
  for (const def of UPGRADES) {
    if (!canBuy(def, s.levels, budget)) continue;
    const cost = costOf(def, levelOf(s.levels, def.id)).toNumber();
    if (cost < bestCost) {
      bestCost = cost;
      best = def.id;
    }
  }
  return best;
}

export function createBot(options: BotOptions): Bot {
  const seen = new Map<string, number>();
  const purchases: Purchase[] = [];
  const hires: Hire[] = [];
  const act = (s: GameState) => {
    const live = new Set<string>();
    const freeTable = s.tables.some((t) => t.state === TableState.Free);
    const washer = s.staff.some((st) => st.role === 'washer' && !st.leaving);
    for (const target of tapTargets(s)) {
      const cmd = target.command;
      if (cmd.type === 'wash' && washer) continue; // The dishwasher's job.
      if (cmd.type === 'seat' && !freeTable) continue;
      if (!options.helpStaff && cmd.type !== 'seat') continue;
      const key = keyOf(cmd);
      live.add(key);
      const since = seen.get(key) ?? s.time;
      seen.set(key, since);
      if (s.time - since >= (cmd.type === 'wash' ? WASH_TAP_SECONDS : options.reaction)) {
        queueCommand(s, cmd);
        seen.delete(key);
      }
    }
    for (const key of seen.keys()) if (!live.has(key)) seen.delete(key);
    if (!options.buy) return;
    // Say yes to raises; near payday, keep the day's wages in the till so it never bounces.
    for (const n of s.notices) if (n.kind === 'raise' || n.kind === 'trial') queueCommand(s, { type: 'answer', notice: n.id, yes: true });
    const wages = s.staff.reduce((sum, st) => sum.add(st.wage), ZERO);
    const budget = s.dayTime / DAY.seconds > PAYDAY_SAVING ? s.coins.sub(wages) : s.coins;
    // Someone the team needs at the door: save up for them instead of buying small upgrades.
    const applicant = s.applicants
      .filter((a) => a.state === 'waiting' && hasRoom(s, a.role) && headcount(s, a.role) < wanted(s, a.role))
      .sort((a, b) => headcount(s, a.role) - headcount(s, b.role))[0];
    if (applicant) {
      // A cook is urgent: a free trial shift rather than waiting for the fee.
      const trial = applicant.role === 'cook' && headcount(s, 'cook') === 0;
      if (trial || s.coins.sub(wages).gte(signingFee(applicant))) {
        hires.push({ time: s.time, role: applicant.role });
        queueCommand(s, { type: 'hire', applicant: applicant.id, trial });
      }
      return;
    }
    const item = cheapestAffordable(s, budget);
    if (!item) return;
    const level = levelOf(s.levels, item);
    purchases.push({ time: s.time, item, level: level + 1, cost: costOf(UPGRADES.find((u) => u.id === item)!, level).toNumber() });
    queueCommand(s, { type: 'buy', item });
  };
  return { act, purchases, hires };
}
