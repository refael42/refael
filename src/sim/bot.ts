import { UPGRADES } from '../data/upgrades';
import { canBuy, costOf, levelOf } from './economy/upgrades';
import { queueCommand, tapTargets } from './game/commands';
import { TableState, type Command, type GameState } from './game/types';

// A stand-in manager for headless runs (balance script, offline progress): it taps what a
// player would tap, after a human-ish reaction delay, and can buy upgrades greedily.

export interface BotOptions {
  /** Seconds a tappable thing waits before the bot reacts. */
  reaction: number;
  /** Also tap ready dishes and dirty tables (an attentive player), or only seat people. */
  helpStaff: boolean;
  /** Buy the cheapest affordable upgrade whenever there is one. */
  buy: boolean;
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
}

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

/** The cheapest upgrade that can be bought right now, if any. */
export function cheapestAffordable(s: GameState): string | null {
  let best: string | null = null;
  let bestCost = Infinity;
  for (const def of UPGRADES) {
    if (!canBuy(def, s.levels, s.coins)) continue;
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
  const act = (s: GameState) => {
    const live = new Set<string>();
    const freeTable = s.tables.some((t) => t.state === TableState.Free);
    for (const target of tapTargets(s)) {
      const cmd = target.command;
      if (cmd.type === 'wash') continue; // The dishwasher's job.
      if (cmd.type === 'seat' && !freeTable) continue;
      if (!options.helpStaff && cmd.type !== 'seat') continue;
      const key = keyOf(cmd);
      live.add(key);
      const since = seen.get(key) ?? s.time;
      seen.set(key, since);
      if (s.time - since >= options.reaction) {
        queueCommand(s, cmd);
        seen.delete(key);
      }
    }
    for (const key of seen.keys()) if (!live.has(key)) seen.delete(key);
    if (!options.buy) return;
    const item = cheapestAffordable(s);
    if (!item) return;
    const level = levelOf(s.levels, item);
    purchases.push({ time: s.time, item, level: level + 1, cost: costOf(UPGRADES.find((u) => u.id === item)!, level).toNumber() });
    queueCommand(s, { type: 'buy', item });
  };
  return { act, purchases };
}
