import { DESSERT, DESSERTS } from '../../data/desserts';
import { OCCASION_BY_ID } from '../../data/occasions';
import type { Point } from '../../data/maps';
import { KITCHEN } from '../../data/staff';
import { hash01 } from '../retention';
import { Bubble, Expression, Facing, Held, Pose } from '../types';
import { setPose } from '../movement';
import { emit, Ev } from './events';
import { workRate } from './people';
import type { Customer, GameState, Staff, Table } from './types';

// Desserts (owner M45: "after the meal they can order a dessert from the new dessert menu, each
// dessert by the player's level"). A guest at a table who finished may ask for the dessert
// menu, choose, and wait; a free waiter plates it at the pass and brings it (or the player taps
// the guest); the main plate goes back to the dish pile; they eat it and it is on the bill. The
// rules are in src/data/desserts.ts; the guest's side is in src/sim/game/customers.ts.

export interface DessertOrder {
  id: number;
  customer: number;
  /** Index in DESSERTS. */
  dessert: number;
  /** The waiter bringing it (-1 nobody yet). */
  waiter: number;
}

/** A guest of a private event that ends with a cake. */
const cakeFor = (s: GameState, c: Customer): boolean => {
  const b = s.occasion.current;
  return c.occasion !== undefined && !!b && b.id === c.occasion && OCCASION_BY_ID[b.kind].cake;
};

/** Desserts open at the chef's level (their indexes). */
export const openDesserts = (s: GameState): number[] => DESSERTS.flatMap((d, i) => (s.chef.level >= d.level ? [i] : []));

/** Will this guest ask for the dessert menu? Tables only, never the inspector; by their id (the dice are left alone). */
export function wantsDessert(s: GameState, c: Customer): boolean {
  if (c.table < 0 || c.inspector || c.dessertPhase) return false;
  const open = openDesserts(s).length;
  if (open === 0) return false;
  // A private event with a cake: everyone stays for it (src/data/occasions.ts).
  if (cakeFor(s, c)) return true;
  const chance = Math.min(DESSERT.maxChance, DESSERT.chance + DESSERT.perDessert * (open - 1));
  return hash01(c.id * 3.31 + 0.57) < chance;
}

/** Their choice: any open dessert, the newest a little more often. */
export function chooseDessert(s: GameState, c: Customer): number {
  const open = openDesserts(s);
  // The event's cake: the finest dessert open, the same for the whole table.
  if (cakeFor(s, c)) return open[open.length - 1] ?? 0;
  const pick = Math.floor(Math.sqrt(hash01(c.id * 5.17 + 0.23)) * open.length);
  return open[Math.min(open.length - 1, pick)] ?? 0;
}

/** What the dessert adds to the bill, as a share of the main course. */
export const dessertShare = (c: Customer): number => (c.dessertServed && c.dessert !== undefined && c.dessert >= 0 ? DESSERTS[c.dessert]!.share : 0);

/** The dessert reaches the table: the main plate goes to the dish pile, they start on it. */
export function serveDessert(s: GameState, c: Customer): void {
  s.desserts = s.desserts.filter((d) => d.customer !== c.id);
  const t = s.tables[c.table];
  if (t && t.dishes[c.seat]! >= 0) {
    t.dishes[c.seat] = -1;
    s.dirtyPlates += 1;
  }
  c.bubble = Bubble.None;
  c.held = Held.None;
  c.dessertPhase = 'eat';
  c.stateTime = 0;
  c.expression = Expression.Eating;
  setPose(c, Pose.SitEat);
  emit(s, Ev.Ding, c.x, c.y);
}

/** Still wanted: the guest is at their table waiting for it (they may have been sent home). */
const wanted = (s: GameState, d: DessertOrder): boolean => s.customers.some((c) => c.id === d.customer && c.dessertPhase === 'wait');

/** The oldest dessert nobody is bringing yet (ones nobody waits for any more are dropped). */
export function readyDessert(s: GameState): DessertOrder | undefined {
  if (s.desserts.length === 0) return undefined;
  if (s.desserts.some((d) => !wanted(s, d))) s.desserts = s.desserts.filter((d) => wanted(s, d));
  return s.desserts.find((d) => d.waiter < 0);
}

/**
 * A waiter's dessert run: to the pass, plate it with tweezers, to the table, set it down.
 * Returns false when done (or the guest is gone).
 */
export function updateDessertRun(s: GameState, st: Staff, dt: number, walk: (to: Point) => boolean, beside: (t: Table) => Point): boolean {
  const job = st.job;
  if (!job || job.kind !== 'dessert') return false;
  const d = s.desserts.find((x) => x.id === job.order);
  const c = d ? s.customers.find((x) => x.id === d.customer) : undefined;
  if (!d || !c || c.table < 0 || c.dessertPhase !== 'wait') {
    if (d) d.waiter = -1;
    return false;
  }
  if (job.phase === 'toPass') {
    if (walk(s.map.pickupSpots[0]!)) {
      st.facing = Facing.BackLeft;
      st.job = { ...job, phase: 'plate' };
      st.jobTime = 0;
    }
    return true;
  }
  if (job.phase === 'plate') {
    setPose(st, Pose.Plate);
    st.held = Held.Tweezers;
    st.jobTime += dt * workRate(s, st);
    if (st.jobTime < DESSERT.plateSeconds) return true;
    setPose(st, Pose.Idle);
    st.held = Held.DessertPlate;
    st.path = [];
    st.job = { ...job, phase: 'toTable' };
    return true;
  }
  if (job.phase === 'toTable') {
    if (walk(beside(s.tables[c.table]!))) {
      setPose(st, Pose.Idle);
      st.job = { ...job, phase: 'serve' };
      st.jobTime = 0;
    }
    return true;
  }
  st.jobTime += dt * workRate(s, st);
  if (st.jobTime < KITCHEN.handoffSeconds) return true;
  st.held = Held.None;
  serveDessert(s, c);
  return false;
}
