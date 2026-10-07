import { BAR, DRINKS, drinksAt } from '../../data/bar';
import { DISHES } from '../../data/dishes';
import { ECONOMY } from '../../data/economy';
import type { Point } from '../../data/maps';
import { big, type Big } from '../big';
import { facingFor, followPath, setPose } from '../movement';
import { hash01 } from '../retention';
import { boostNow } from '../shop';
import { festivalBonus } from '../festival';
import { Bubble, Emote, Expression, Facing, Held, Pose } from '../types';
import { emit, Ev } from './events';
import { statFactor, workRate } from './people';
import { CustomerState, OrderState, type Customer, type DrinkOrder, type GameState, type Staff, type Table } from './types';
import { gainXp } from './workers';

// The bar (owner: "bartenders who shake cocktails, plain drinks too: a ready drink goes on the
// bar's pass and a waiter takes it; later guests sit at the bar and the bartenders serve them").
// Guests at tables order a drink with their meal now and then; a bartender makes it at their
// place behind the counter (a cocktail is shaken, a plain drink poured), puts it on the pass at
// the end of the counter, and a waiter (or the player's tap) takes it to the table, where it is
// paid. From the grand restaurant, some who come alone sit at the bar instead: the bartender
// makes their drink right in front of them and hands it across the counter.

/** A bar guest sits this many px up (a stool is taller than a chair). */
export const STOOL_LIFT = 7;

export const bartendersOn = (s: GameState): boolean => s.staff.some((st) => st.role === 'bartender' && !st.leaving);

/** The priciest dish on the menu now (what a drink at the bar is measured against). */
function priciestDish(s: GameState): Big {
  let best = big(0);
  for (const d of DISHES) if (s.mods.menu[d.id]) best = big(d.price).mul(s.mods.price[d.id]! * s.mods.quality).floor().max(best);
  return best;
}

/**
 * What a drink sells for: a share of the meal it comes with (so drinks keep up with the menu),
 * at the bar a share of the priciest dish; times the cocktails upgrades and who made it.
 */
export function drinkPrice(s: GameState, d: DrinkOrder, c: Customer | undefined): Big {
  const def = DRINKS[d.drink]!;
  const base = d.bar || !c ? priciestDish(s).mul(BAR.barShare) : big(DISHES[c.dish]?.price ?? 0).mul(s.mods.price[c.dish]! * s.mods.quality);
  return base.mul(def.share * s.mods.drinkPrice * d.quality * boostNow(s) * festivalBonus(s)).floor().max(1);
}

function newDrink(s: GameState, c: Customer, drink: number, bar: boolean): DrinkOrder {
  const d: DrinkOrder = { id: s.nextId++, customer: c.id, drink, state: OrderState.Queued, progress: 0, slot: -1, since: s.time, landsAt: 0, waiter: -1, bartender: -1, bar, quality: 1 };
  s.drinks.push(d);
  c.drinkOrder = d.id;
  return d;
}

/** Which drink: by the guest's id (the game's dice are left alone); at the bar mostly cocktails. */
function chooseDrink(s: GameState, c: Customer, salt: number, bar: boolean): number {
  const menu = drinksAt(s.map.tier).filter((d) => !bar || d.shaken || drinksAt(s.map.tier).every((x) => !x.shaken));
  const pick = menu[Math.floor(hash01(c.id * 4.13 + salt) * menu.length)] ?? DRINKS[0]!;
  return DRINKS.indexOf(pick);
}

/** A guest at a table ordered their meal: now and then a drink with it, once there is a bartender. */
export function maybeOrderDrink(s: GameState, c: Customer): void {
  if (!bartendersOn(s) || c.stool >= 0 || c.drinkOrder >= 0) return;
  if (hash01(c.id * 2.71 + 0.33) >= BAR.drinkChance) return;
  newDrink(s, c, chooseDrink(s, c, 0.7, false), false);
}

/** A guest leaves: a drink of theirs not yet on its way is poured out. */
export function cancelDrinks(s: GameState, c: Customer): void {
  s.drinks = s.drinks.filter((d) => d.customer !== c.id);
  c.drinkOrder = -1;
}

/** A free place on the bar's pass. */
function freeBarSlot(s: GameState): number {
  for (let i = 0; i < BAR.passSlots; i++) if (!s.drinks.some((d) => d.state === OrderState.Ready && d.slot === i)) return i;
  return -1;
}

/** Where a drink waits on the pass: side by side along the counter. */
export function barSlotPoint(s: GameState, slot: number): Point {
  const p = s.map.bar.pass;
  const along = (slot - (BAR.passSlots - 1) / 2) * 0.26;
  return s.map.bar.stage === 1 ? { x: p.x, y: p.y + along } : { x: p.x + along, y: p.y };
}

/** The counter between a bar guest and the bartender serving them: their drink stands there. */
export function counterBefore(s: GameState, stool: number): Point {
  const st = s.map.bar.stools[stool]!;
  return { x: (st.at.x + st.serve.x) / 2, y: (st.at.y + st.serve.y) / 2 };
}

const face = (from: Point, to: Point, was: Facing): Facing => facingFor(to.x - from.x, to.y - from.y, was);

/** The drink is in the guest's hands (or on their table): it is paid now. */
function deliver(s: GameState, d: DrinkOrder, charm: number): void {
  s.drinks = s.drinks.filter((x) => x !== d);
  const c = s.customers.find((x) => x.id === d.customer);
  if (!c) return;
  c.drinkOrder = -1;
  if (!d.bar) {
    // Only while they are still at the table (waiting for the meal or eating it).
    if (c.table < 0 || (c.state !== CustomerState.Waiting && c.state !== CustomerState.Eating)) return;
    const t: Table = s.tables[c.table]!;
    t.drinks[c.seat] = d.drink;
  }
  const price = drinkPrice(s, d, c).mul(charm).floor();
  s.coins = s.coins.add(price);
  s.stats.earned = s.stats.earned.add(price);
  emit(s, Ev.Coins, c.x, c.y, price.toNumber());
}

// ---------- the bartender ----------

/** The bartender's day: the oldest drink first (a guest at the bar first: they sit right there). */
export function updateBartender(s: GameState, st: Staff, dt: number, walk: (to: Point) => boolean, home: Point): boolean {
  let job = st.job;
  if (!job || job.kind !== 'mix') {
    if (st.leaving || st.pendingRole) return false;
    const queued = s.drinks.filter((d) => d.state === OrderState.Queued && d.bartender < 0);
    const next = queued.find((d) => d.bar) ?? queued.reduce<DrinkOrder | undefined>((a, b) => (!a || b.since < a.since ? b : a), undefined);
    if (!next) {
      st.held = Held.None;
      return false;
    }
    next.bartender = st.id;
    next.state = OrderState.Cooking;
    next.quality = statFactor(st.stats.quality);
    st.job = { kind: 'mix', drink: next.id, phase: 'toStation' };
    st.jobTime = 0;
    st.path = [];
    job = st.job;
  }
  if (job.kind !== 'mix') return false;
  const d = s.drinks.find((x) => x.id === job.drink);
  const guest = d?.bar ? s.customers.find((x) => x.id === d.customer) : undefined;
  if (!d || (d.bar && (!guest || guest.stool < 0))) {
    // Their guest left: back to their place.
    st.job = null;
    st.held = Held.None;
    return false;
  }
  const def = DRINKS[d.drink]!;
  const stool = guest ? s.map.bar.stools[guest.stool]! : null;
  const station = stool ? stool.serve : home;
  if (job.phase === 'toStation') {
    if (walk(station)) {
      st.job = { ...job, phase: 'mixing' };
      st.jobTime = 0;
    }
    return true;
  }
  if (job.phase === 'mixing') {
    // A cocktail is shaken (the shaker up by the shoulder), a plain drink poured.
    setPose(st, def.shaken ? Pose.Shake : Pose.Pour);
    st.held = def.shaken ? Held.Shaker : Held.Glass;
    st.facing = stool ? face(station, stool.at, st.facing) : Facing.FrontRight;
    d.progress = Math.min(1, d.progress + (dt * s.mods.mixSpeed * workRate(s, st)) / def.mixSeconds);
    if (d.progress >= 1) {
      st.held = Held.Glass;
      setPose(st, Pose.Idle);
      st.job = { ...job, phase: stool ? 'hand' : 'toPass' };
      st.jobTime = 0;
      st.path = [];
    }
    return true;
  }
  if (job.phase === 'toPass') {
    if (!walk(s.map.bar.stations[0]!)) return true;
    st.facing = face(s.map.bar.stations[0]!, s.map.bar.pass, st.facing);
    // The pass is full: wait with the drink in hand until a waiter takes one.
    const slot = freeBarSlot(s);
    if (slot < 0) {
      setPose(st, Pose.Idle);
      return true;
    }
    d.slot = slot;
    st.job = { ...job, phase: 'place' };
    st.jobTime = 0;
    return true;
  }
  st.jobTime += dt * workRate(s, st);
  if (st.jobTime < BAR.handoffSeconds) return true;
  st.held = Held.None;
  st.job = null;
  gainXp(s, st);
  if (job.phase === 'place') {
    d.state = OrderState.Ready;
    d.since = s.time;
    const p = barSlotPoint(s, d.slot);
    emit(s, Ev.Ding, p.x, p.y);
    return true;
  }
  // Across the counter to the guest: they start on it.
  s.drinks = s.drinks.filter((x) => x !== d);
  if (guest) {
    guest.drinkOrder = -1;
    guest.rounds += 1;
    guest.held = Held.Glass;
    guest.bubble = Bubble.None;
    guest.expression = Expression.Happy;
    guest.patience = -1;
    guest.sipping = d.drink;
    guest.state = CustomerState.Eating;
    guest.stateTime = 0;
    setPose(guest, Pose.Sip);
    // Paid as it is handed over (the bartender's charm, like a waiter's, in the tip).
    const price = drinkPrice(s, d, guest).mul(statFactor(st.stats.charm)).floor();
    s.coins = s.coins.add(price);
    s.stats.earned = s.stats.earned.add(price);
    emit(s, Ev.Coins, guest.x, guest.y, price.toNumber());
  }
  return true;
}

// ---------- waiters and the player take drinks to the tables ----------

/** The ready drink a waiter should take next (the oldest), if any. */
export const readyDrink = (s: GameState): DrinkOrder | undefined =>
  s.drinks.filter((d) => d.state === OrderState.Ready && d.waiter < 0 && !d.bar).reduce<DrinkOrder | undefined>((a, b) => (!a || b.since < a.since ? b : a), undefined);

/** A waiter's run with a drink: to the end of the bar, take it, to the table, set it down. Returns false when done. */
export function updateDrinkRun(
  s: GameState,
  st: Staff,
  dt: number,
  walk: (to: Point) => boolean,
  beside: (t: Table) => Point,
): boolean {
  const job = st.job;
  if (!job || job.kind !== 'drinkRun') return false;
  const d = s.drinks.find((x) => x.id === job.drink);
  const c = d ? s.customers.find((x) => x.id === d.customer) : undefined;
  const waiting = job.phase === 'toBar' || job.phase === 'handoff';
  if (!d || !c || c.table < 0 || (waiting && d.state !== OrderState.Ready)) return false;
  if (job.phase === 'toBar') {
    if (walk(s.map.bar.pickup)) {
      setPose(st, Pose.Idle);
      st.facing = face(s.map.bar.pickup, s.map.bar.pass, st.facing);
      st.job = { ...job, phase: 'handoff' };
      st.jobTime = 0;
    }
    return true;
  }
  if (job.phase === 'handoff') {
    st.jobTime += dt * workRate(s, st);
    if (st.jobTime < BAR.handoffSeconds) return true;
    d.state = OrderState.Carried;
    d.slot = -1;
    st.held = Held.DrinkTray;
    st.path = [];
    st.job = { ...job, phase: 'toTable' };
    return true;
  }
  const t = s.tables[c.table]!;
  if (job.phase === 'toTable') {
    if (walk(beside(t))) {
      setPose(st, Pose.Idle);
      st.facing = Facing.BackRight;
      st.job = { ...job, phase: 'serve' };
      st.jobTime = 0;
    }
    return true;
  }
  st.jobTime += dt * workRate(s, st);
  if (st.jobTime < BAR.handoffSeconds) return true;
  deliver(s, d, statFactor(st.stats.charm));
  gainXp(s, st);
  return false;
}

/** The player taps a ready drink: it flies to its table. */
export function serveDrink(s: GameState, d: DrinkOrder, to: Point): void {
  const from = barSlotPoint(s, d.slot);
  emit(s, Ev.DishFly, from.x, from.y, to.x, to.y, -1 - d.drink);
  d.state = OrderState.Flying;
  d.slot = -1;
  d.waiter = -1;
  d.landsAt = s.time + ECONOMY.serveFlightSeconds;
}

/** Drinks the player tossed land on their tables. */
export function landFlyingDrinks(s: GameState): void {
  for (const d of s.drinks.filter((x) => x.state === OrderState.Flying && s.time >= x.landsAt)) deliver(s, d, 1);
}

// ---------- guests at the bar ----------

const freeStool = (s: GameState): number => s.barSeats.findIndex((id) => id < 0);

/**
 * Someone who came alone sits at the bar instead of waiting in line: from the building with
 * stools, when one is free and a bartender works (by their id: the game's dice are left alone).
 */
export function maybeBarGuest(s: GameState, c: Customer): boolean {
  if (c.partySize !== 1 || !bartendersOn(s) || hash01(c.id * 1.37 + 0.21) >= BAR.barGuestChance) return false;
  const k = freeStool(s);
  if (k < 0) return false;
  s.barSeats[k] = c.id;
  c.stool = k;
  c.queueSlot = -1;
  c.state = CustomerState.ToTable;
  c.stateTime = 0;
  return true;
}

/** A bar guest done (or fed up): off the stool and home. */
function leaveBar(s: GameState, c: Customer, sendHome: (c: Customer) => void): void {
  if (c.stool >= 0 && s.barSeats[c.stool] === c.id) s.barSeats[c.stool] = -1;
  c.stool = -1;
  c.lift = 0;
  cancelDrinks(s, c);
  sendHome(c);
}

/** A guest at the bar: to the stool, order, wait, sip, perhaps another round, go. */
export function updateBarGuest(s: GameState, c: Customer, dt: number, sendHome: (c: Customer) => void, walkout: (c: Customer) => void): void {
  const stool = s.map.bar.stools[c.stool];
  if (!stool) return leaveBar(s, c, sendHome);
  if (c.state === CustomerState.ToTable) {
    if (c.path.length === 0 || followPath(c, c.path, c.walkSpeed, dt)) {
      c.x = stool.at.x;
      c.y = stool.at.y;
      setPose(c, Pose.Sit);
      c.facing = stool.facing;
      c.lift = STOOL_LIFT;
      orderAtBar(s, c);
    }
    return;
  }
  if (c.state === CustomerState.Waiting) {
    c.patienceLeft -= dt;
    c.patience = c.patienceMax > 0 ? Math.max(0, c.patienceLeft / c.patienceMax) : 1;
    if (c.patienceLeft <= 0) {
      // Fed up: no money (and the room sees it, a little).
      c.expression = Expression.Angry;
      c.emote = Emote.Anger;
      c.emoteTime = 0;
      emit(s, Ev.Poof, c.x, c.y);
      walkout(c);
      leaveBar(s, c, sendHome);
    }
    return;
  }
  if (c.state === CustomerState.Eating) {
    if (c.stateTime < BAR.sipSeconds) return;
    // Another round now and then (by their id and the round), while a bartender is on.
    if (c.rounds < 2 && bartendersOn(s) && hash01(c.id * 3.9 + c.rounds * 0.71) < BAR.secondRound) {
      orderAtBar(s, c);
      return;
    }
    c.held = Held.None;
    c.sipping = -1;
    c.emote = Emote.Heart;
    c.emoteTime = 0;
    s.stats.served += 1;
    leaveBar(s, c, sendHome);
  }
}

function orderAtBar(s: GameState, c: Customer): void {
  const d = newDrink(s, c, chooseDrink(s, c, 0.4 + c.rounds, true), true);
  c.held = Held.None;
  c.sipping = -1;
  c.bubble = Bubble.DrinkBase + d.drink;
  c.patienceMax = BAR.barPatience * s.mods.patience;
  c.patienceLeft = c.patienceMax;
  c.patience = 1;
  c.state = CustomerState.Waiting;
  c.stateTime = 0;
  setPose(c, Pose.Sit);
}
