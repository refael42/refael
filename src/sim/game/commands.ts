import { ECONOMY } from '../../data/economy';
import { UPGRADES } from '../../data/upgrades';
import { fromSave } from '../big';
import { emit, Ev } from './events';
import { seatCustomer } from './customers';
import { PropKind } from '../types';
import { anchorPoints, buyUpgrade, rerouteWalkers, siteOf } from './purchase';
import { moveDecor } from './create';
import { openBranch } from '../franchise';
import { claimDaily, openGift } from '../retention';
import { collectWheel, spinWheel } from '../wheel';
import { canPlaceAt } from './build';
import { finishWorkNow, hurryWork } from './works';
import type { BulkStep } from '../../data/works';
import { freeHost, handWash, serveOrder, startEscort } from './staff';
import { hire, negotiate, reject } from './applicants';
import { CustomerState, OrderState, TableState, type Command, type GameState, type PersonTarget, type StationTarget, type TapTarget } from './types';
import { claimQuest } from '../quests';
import { addGems, buyDeal, buyShopItem, grantCoins } from '../shop';
import { claimFestival, syncFestival } from '../festival';
import { startBus } from './bus';
import { answer, fire, giveBonus, reassign, scold, setRush, train } from './workers';

/** Queued player actions are applied at the start of the next fixed step (deterministic, replayable). */
export function queueCommand(s: GameState, command: Command): void {
  s.commands.push(command);
}

/** Pixel heights of each target's visual center above the floor (for screen-space hit tests). */
const HEIGHT = { dish: 30, table: 22, customer: 22, sink: 26, work: 60, gift: 16 } as const;

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
  // The present on the sidewalk.
  if (s.gift) out.push({ x: s.gift.x, y: s.gift.y, height: HEIGHT.gift, command: { type: 'gift' } });
  // A big upgrade in progress: tap the timer over it to speed the crew up.
  for (const w of s.works) {
    const p = siteOf(s, w);
    out.push({ x: p.x, y: p.y, height: HEIGHT.work, command: { type: 'hurry', work: w.id } });
  }
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
  [PropKind.Fountain]: 36,
  [PropKind.Piano]: 36,
  [PropKind.SaleSign]: 40,
  [PropKind.LockSign]: 40,
};

/** Stations with upgrades, and the padlocks on land for later (they open the building upgrades). */
const ANCHORS: readonly PropKind[] = [...new Set([...UPGRADES.map((u) => u.anchor), PropKind.LockSign])];

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
      return train(s, cmd.staff, cmd.count === undefined ? 1 : (cmd.count as BulkStep));
    case 'scold':
      return scold(s, cmd.staff);
    case 'reassign':
      return reassign(s, cmd.staff, cmd.role);
    case 'answer':
      return answer(s, cmd.notice, cmd.yes);
    case 'rush':
      return setRush(s, cmd.on);
    case 'claim':
      return claimQuest(s, cmd.quest);
    case 'shop':
      buyShopItem(s, cmd.item);
      return;
    case 'gems':
      return addGems(s, cmd.amount);
    case 'festival':
      return syncFestival(s, cmd.now);
    case 'festivalClaim':
      claimFestival(s);
      return;
    case 'deal':
      buyDeal(s, cmd.now);
      return;
    case 'testBus':
      return startBus(s);
    default:
      break;
  }
  if (cmd.type === 'seat') {
    const c = s.customers.find((x) => x.id === cmd.customer);
    if (c && c.state === CustomerState.Queued) {
      // A host free at the stand walks them in; otherwise they go alone.
      const host = freeHost(s);
      if (host) startEscort(s, host, c);
      else seatCustomer(s, c);
    }
  } else if (cmd.type === 'serve') {
    const o = s.orders.find((x) => x.id === cmd.order);
    if (o && o.state === OrderState.Ready) serveOrder(s, o);
  } else if (cmd.type === 'wash') {
    handWash(s);
  } else if (cmd.type === 'buy') {
    buyUpgrade(s, cmd.item, cmd.at, cmd.step);
  } else if (cmd.type === 'hurry') {
    const w = s.works.find((x) => x.id === cmd.work);
    if (w) hurryWork(s, w.id, siteOf(s, w));
  } else if (cmd.type === 'finish') {
    finishWorkNow(s, cmd.work);
  } else if (cmd.type === 'branch') {
    openBranch(s);
  } else if (cmd.type === 'gift') {
    openGift(s);
  } else if (cmd.type === 'daily') {
    claimDaily(s, cmd.today, cmd.yesterday);
  } else if (cmd.type === 'spin') {
    spinWheel(s, cmd.now, cmd.paid);
  } else if (cmd.type === 'wheel') {
    collectWheel(s);
  } else if (cmd.type === 'move') {
    if (moveDecor(s, cmd.from, cmd.to, canPlaceAt)) {
      rerouteWalkers(s);
      emit(s, Ev.Poof, cmd.from.x, cmd.from.y);
      emit(s, Ev.Ding, Math.floor(cmd.to.x) + 0.5, Math.floor(cmd.to.y) + 0.5);
    }
  } else if (cmd.type === 'grant') {
    const coins = fromSave(cmd.coins);
    grantCoins(s, coins);
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
