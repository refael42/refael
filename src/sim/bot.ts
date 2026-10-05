import { DAY } from '../data/staff';
import { UPGRADES } from '../data/upgrades';
import { ZERO, type Big } from './big';
import { canBuy, costOf, isMaxed, levelOf, upgradeDef } from './economy/upgrades';
import { signingFee } from './game/applicants';
import { autoTile } from './game/build';
import { queueCommand, tapTargets } from './game/commands';
import { TableState, type Command, type GameState } from './game/types';
import { hasRoom, headcount } from './game/workers';
import { claimable, goalDone, questLevel } from './quests';

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
/** Below this morale someone is close to quitting: the bot pays them a bonus (as a player would). */
const BOT_BONUS_MORALE = 0.3;
/**
 * A player saves up for the next building once it is within reach: when it costs no more than
 * this many minutes of income, the bot stops buying small things until it can pay for it.
 */
const SAVE_FOR_BUILDING_MINUTES = 3;
/** Income is measured over this window (sim seconds). */
const INCOME_WINDOW = 60;

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

/** The cheapest upgrade this budget buys right now, if any (`skip`: rows known not to fit). */
export function cheapestAffordable(s: GameState, budget: Big = s.coins, skip: ReadonlySet<string> = new Set()): string | null {
  let best: string | null = null;
  let bestCost = Infinity;
  for (const def of UPGRADES) {
    if (skip.has(def.id) || !canBuy(def, s.levels, budget, s.map)) continue;
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
  const earnedAt: { time: number; earned: Big }[] = [];
  /** Decor with no free tile left in this building (cleared when the building grows). */
  const noRoom = new Set<string>();
  let noRoomTier = 0;
  const buy = (s: GameState, item: string) => {
    const level = levelOf(s.levels, item);
    purchases.push({ time: s.time, item, level: level + 1, cost: costOf(upgradeDef(item), level).toNumber() });
    queueCommand(s, { type: 'buy', item });
  };
  /** True while saving up for the next building (and buys it once the money is there). */
  const saveForBuilding = (s: GameState, budget: Big): boolean => {
    const def = upgradeDef('building');
    const level = levelOf(s.levels, def.id);
    if (s.construction || isMaxed(def, s.levels, s.map) || earnedAt.length < 2) return false;
    const first = earnedAt[0]!;
    const minutes = (s.time - first.time) / 60;
    const perMinute = s.stats.earned.sub(first.earned).div(Math.max(1 / 60, minutes));
    const cost = costOf(def, level);
    if (cost.gt(perMinute.mul(SAVE_FOR_BUILDING_MINUTES))) return false;
    if (budget.gte(cost)) buy(s, def.id);
    return true;
  };
  const act = (s: GameState) => {
    if (earnedAt.length === 0 || s.time - earnedAt[earnedAt.length - 1]!.time >= 5) earnedAt.push({ time: s.time, earned: s.stats.earned });
    while (earnedAt.length > 2 && earnedAt[0]!.time < s.time - INCOME_WINDOW) earnedAt.shift();
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
    // Take quest rewards as soon as they are done; use rush hour when a quest asks for it.
    for (const i of claimable(s)) queueCommand(s, { type: 'claim', quest: i });
    const rushGoal = questLevel(s.quests.level).goals.some((g, i) => g.kind === 'rush' && !s.quests.claimed.includes(i) && !goalDone(g, s));
    if (rushGoal && !s.rush.on && s.rush.charge >= 1) queueCommand(s, { type: 'rush', on: true });
    else if (s.rush.on && s.rush.charge < 0.7) queueCommand(s, { type: 'rush', on: false });
    // A bonus for anyone close to quitting (gossips wear the others down).
    const low = s.staff.find((st) => !st.leaving && st.morale < BOT_BONUS_MORALE && s.coins.gte(st.wage.mul(2)));
    if (low) queueCommand(s, { type: 'bonus', staff: low.id });
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
    if (saveForBuilding(s, budget)) return;
    if (s.map.tier !== noRoomTier) {
      noRoom.clear();
      noRoomTier = s.map.tier;
    }
    const item = cheapestAffordable(s, budget, noRoom);
    if (!item) return;
    // Decor goes on the first free tile, like a player who does not mind where; with none left, stop trying.
    if (upgradeDef(item).build && !autoTile(s)) noRoom.add(item);
    else buy(s, item);
  };
  return { act, purchases, hires };
}
