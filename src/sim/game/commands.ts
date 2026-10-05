import { ECONOMY } from '../../data/economy';
import { seatCustomer } from './customers';
import { serveOrder } from './kitchen';
import { CustomerState, OrderState, TableState, type Command, type GameState, type TapTarget } from './types';

/** Queued player actions are applied at the start of the next fixed step (deterministic, replayable). */
export function queueCommand(s: GameState, command: Command): void {
  s.commands.push(command);
}

/** Pixel heights of each target's visual center above the floor (for screen-space hit tests). */
const HEIGHT = { dish: 30, table: 22, customer: 22 } as const;

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
  return out;
}

function apply(s: GameState, cmd: Command): void {
  if (cmd.type === 'seat') {
    const c = s.customers.find((x) => x.id === cmd.customer);
    if (c && c.state === CustomerState.Queued) seatCustomer(s, c);
  } else if (cmd.type === 'serve') {
    const o = s.orders.find((x) => x.id === cmd.order);
    if (o && o.state === OrderState.Ready) serveOrder(s, o);
  } else {
    const t = s.tables[cmd.table];
    if (!t) return;
    if (t.state === TableState.Dirty) {
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
