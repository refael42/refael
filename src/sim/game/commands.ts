import { ECONOMY } from '../../data/economy';
import { UPGRADES } from '../../data/upgrades';
import { fromSave } from '../big';
import { emit, Ev } from './events';
import { seatCustomer } from './customers';
import { PropKind } from '../types';
import { anchorPoints, buyUpgrade } from './purchase';
import { handWash, serveOrder } from './staff';
import { hire, negotiate, reject } from './applicants';
import { CustomerState, OrderState, TableState, type Command, type GameState, type PersonTarget, type StationTarget, type TapTarget } from './types';
import { answer, fire, giveBonus, reassign, scold, setRush, train } from './workers';

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
  [PropKind.StoveSlot]: 10,
  [PropKind.Flowers]: 24,
  [PropKind.FloorLamp]: 44,
  [PropKind.Aquarium]: 30,
  [PropKind.Statue]: 40,
  [PropKind.SaleSign]: 40,
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

/** People the manager can tap to open their card: the team and waiting applicants. */
export function peopleTargets(s: GameState): PersonTarget[] {
  const out: PersonTarget[] = [];
  for (const st of s.staff) if (!st.leaving) out.push({ x: st.x, y: st.y, height: HEIGHT.customer, id: st.id, applicant: false });
  for (const a of s.applicants) if (a.state === 'waiting') out.push({ x: a.x, y: a.y, height: HEIGHT.customer, id: a.id, applicant: true });
  return out;
}

function apply(s: GameState, cmd: Command): void {
  switch (cmd.type) {
    case 'hire':
      return hire(s, cmd.applicant, cmd.trial);
    case 'negotiate':
      return negotiate(s, cmd.applicant);
    case 'reject':
      return reject(s, cmd.applicant);
    case 'fire':
      return fire(s, cmd.staff);
    case 'bonus':
      return giveBonus(s, cmd.staff);
    case 'train':
      return train(s, cmd.staff);
    case 'scold':
      return scold(s, cmd.staff);
    case 'reassign':
      return reassign(s, cmd.staff, cmd.role);
    case 'answer':
      return answer(s, cmd.notice, cmd.yes);
    case 'rush':
      return setRush(s, cmd.on);
    default:
      break;
  }
  if (cmd.type === 'seat') {
    const c = s.customers.find((x) => x.id === cmd.customer);
    if (c && c.state === CustomerState.Queued) seatCustomer(s, c);
  } else if (cmd.type === 'serve') {
    const o = s.orders.find((x) => x.id === cmd.order);
    if (o && o.state === OrderState.Ready) serveOrder(s, o);
  } else if (cmd.type === 'wash') {
    handWash(s);
  } else if (cmd.type === 'buy') {
    buyUpgrade(s, cmd.item, cmd.at);
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
