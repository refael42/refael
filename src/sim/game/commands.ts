import { ECONOMY } from '../../data/economy';
import { UPGRADES } from '../../data/upgrades';
import { fromSave } from '../big';
import { emit, Ev } from './events';
import { seatCustomer } from './customers';
import { PropKind } from '../types';
import { anchorPoints, buyUpgrade } from './purchase';
import { handWash, serveOrder } from './staff';
import { CustomerState, OrderState, TableState, type Command, type GameState, type StationTarget, type TapTarget } from './types';

/** Queued player actions are applied at the start of the next fixed step (deterministic, replayable). */
export function queueCommand(s: GameState, command: Command): void {
  s.commands.push(command);
}

/** Pixel heights of each target's visual center above the floor (for screen-space hit tests). */
const HEIGHT = { dish: 30, table: 22, customer: 22, sink: 26 } as const;

/** Everything the player can tap right now. The UI projects these and picks the nearest. */
export function tapTargets(s: GameState): TapTarget[] {
  const out: TapTarget[] = [];
  for (const o of s.orders) {
    if (o.state !== OrderState.Ready) continue;
    const p = s.map.passSlots[o.slot]!;
    out.push({ x: p.x, y: p.y, height: HEIGHT.dish, command: { type: 'serve', order: o.id } });
  }
  for (const t of s.tables) {
    if (t.state === TableState.Dirty || t.state === TableState.Cleaning) {
      out.push({ x: t.x, y: t.y, height: HEIGHT.table, command: { type: 'clean', table: t.index } });
    }
  }
  for (const c of s.customers) {
    if (c.state === CustomerState.Queued) {
      out.push({ x: c.x, y: c.y, height: HEIGHT.customer, command: { type: 'seat', customer: c.id } });
    }
  }
  if (s.dirtyPlates > 0) out.push({ x: s.map.dirtyStack.x, y: s.map.dirtyStack.y, height: HEIGHT.sink, command: { type: 'wash' } });
  return out;
}

/** Visual center height (px) of each station, for tapping it to open its upgrades. */
const STATION_HEIGHT: Partial<Record<PropKind, number>> = {
  [PropKind.Stove]: 30,
  [PropKind.Sink]: 12,
  [PropKind.Fridge]: 34,
  [PropKind.Pass]: 12,
  [PropKind.PlatesClean]: 26,
  [PropKind.Table]: 14,
  [PropKind.Chair]: 14,
  [PropKind.TableSlot]: 8,
  [PropKind.Plant]: 30,
  [PropKind.Neon]: 64,
  [PropKind.StreetSign]: 34,
};

const ANCHORS: readonly PropKind[] = [...new Set(UPGRADES.map((u) => u.anchor))];

/** Every station that has upgrades, wherever it stands right now. */
export function stationTargets(s: GameState): StationTarget[] {
  const out: StationTarget[] = [];
  for (const kind of ANCHORS) {
    for (const p of anchorPoints(s, kind)) out.push({ x: p.x, y: p.y, height: STATION_HEIGHT[kind] ?? 16, kind });
  }
  return out;
}

function apply(s: GameState, cmd: Command): void {
  if (cmd.type === 'seat') {
    const c = s.customers.find((x) => x.id === cmd.customer);
    if (c && c.state === CustomerState.Queued) seatCustomer(s, c);
  } else if (cmd.type === 'serve') {
    const o = s.orders.find((x) => x.id === cmd.order);
    if (o && o.state === OrderState.Ready) serveOrder(s, o);
  } else if (cmd.type === 'wash') {
    handWash(s);
  } else if (cmd.type === 'buy') {
    buyUpgrade(s, cmd.item);
  } else if (cmd.type === 'grant') {
    const coins = fromSave(cmd.coins);
    s.coins = s.coins.add(coins);
    s.stats.earned = s.stats.earned.add(coins);
    emit(s, Ev.Bonus, 0, 0, coins.toNumber());
  } else {
    const t = s.tables[cmd.table];
    if (!t) return;
    if (t.state === TableState.Dirty) {
      // The manager does it now; a waiter who was on the way goes back to other work.
      t.waiter = -1;
      t.state = TableState.Cleaning;
      t.progress = 0;
      t.since = s.time;
    } else if (t.state === TableState.Cleaning) {
      // Tapping again scrubs faster: a tiny hands-on mini action.
      t.progress = Math.min(1, t.progress + ECONOMY.cleanTapBoost);
    }
  }
}

export function applyCommands(s: GameState): void {
  const commands = s.commands;
  s.commands = [];
  for (const cmd of commands) apply(s, cmd);
}
