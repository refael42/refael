import { PACKING } from '../../data/delivery';
import { facingFor, setPose } from '../movement';
import { Facing, Held, Pose } from '../types';
import { emit, Ev } from './events';
import { statFactor, workRate } from './people';
import { OrderState, type GameState, type Order, type Staff } from './types';
import { gainXp } from './workers';

// The packers (src/data/delivery.ts PACKING): they take the delivery bags off the pass, pack
// them at the counter by the kitchen's front wall, and leave them on the takeaway window's
// shelf, where the couriers take them from outside.

/** Packed orders on the window shelf that no courier has taken yet. */
export const onShelf = (s: GameState): Order[] => s.orders.filter((o) => o.delivery && o.packed && o.waiter < 0);

/** How far the packing at the counter is (0..1, 0 = nobody packing): the counter shows the stages. */
export function packingProgress(s: GameState): number {
  let best = 0;
  for (const st of s.staff) if (st.job?.kind === 'pack' && st.job.phase === 'packing') best = Math.max(best, Math.min(1, st.jobTime / PACKING.seconds));
  return best;
}

/** Is a packer on the team (and the packing corner built)? Then couriers take from the window. */
export const packersOn = (s: GameState): boolean => s.map.packing !== null && s.staff.some((st) => st.role === 'packer' && !st.leaving);

/** Where a courier's scooter parks (`rider` = where they wait beside it): by the window while packers work, else by the door. */
export function parking(s: GameState, slot: number, rider: boolean): { x: number; y: number } {
  const p = packersOn(s) ? s.map.packing! : null;
  const spots = rider ? (p?.couriers ?? s.map.courierSpots) : (p?.scooters ?? s.map.scooterSpots);
  return spots[slot % spots.length]!;
}

/** One tick of a packer's shift; true while working. */
export function updatePacker(s: GameState, st: Staff, dt: number, walkTo: (to: { x: number; y: number }) => boolean, home: { x: number; y: number }): boolean {
  const corner = s.map.packing;
  if (!corner) return false;
  let job = st.job?.kind === 'pack' ? st.job : null;
  if (!job) {
    if (st.leaving || st.pendingRole) return false;
    let next: Order | undefined;
    for (const o of s.orders) if (o.delivery && o.state === OrderState.Ready && o.waiter < 0 && (!next || o.since < next.since)) next = o;
    if (!next) {
      if (walkTo(home)) {
        setPose(st, Pose.Idle);
        st.facing = facingFor(corner.table.x - st.x, corner.table.y - st.y, st.facing);
      }
      return false;
    }
    next.waiter = st.id;
    st.path = [];
    st.job = { kind: 'pack', order: next.id, phase: 'toPass' };
    st.jobTime = 0;
    job = st.job;
  }
  const order = s.orders.find((o) => o.id === job.order);
  if (!order) {
    // Cancelled while on its way: nothing to pack.
    st.job = null;
    st.held = Held.None;
    return false;
  }
  if (job.phase === 'toPass') {
    if (order.state !== OrderState.Ready) {
      if (order.waiter === st.id) order.waiter = -1;
      st.job = null;
      return false;
    }
    if (!walkTo(s.map.pickupSpots[order.slot] ?? s.map.pickupSpots[0]!)) return true;
    // At the pass: reach over for the food box.
    st.facing = Facing.BackLeft;
    st.job = { ...job, phase: 'take' };
    st.jobTime = 0;
    return true;
  }
  if (job.phase === 'take') {
    if (order.state !== OrderState.Ready) {
      if (order.waiter === st.id) order.waiter = -1;
      st.job = null;
      return false;
    }
    setPose(st, Pose.Cook);
    st.jobTime += dt * workRate(s, st);
    if (st.jobTime < PACKING.takeSeconds) return true;
    // Off the pass (room for the next dish) and into their hands, still open.
    order.state = OrderState.Carried;
    order.slot = -1;
    st.held = Held.FoodBox;
    setPose(st, Pose.Idle);
    st.path = [];
    st.job = { ...job, phase: 'toTable' };
    return true;
  }
  if (job.phase === 'toTable') {
    if (!walkTo(home)) return true;
    // The box goes down on the counter (the counter shows it going into a bag).
    st.facing = facingFor(corner.table.x - st.x, corner.table.y - st.y, st.facing);
    st.held = Held.None;
    st.job = { ...job, phase: 'packing' };
    st.jobTime = 0;
    return true;
  }
  setPose(st, Pose.Cook);
  st.jobTime += dt * workRate(s, st) * statFactor(st.stats.speed);
  if (st.jobTime < PACKING.seconds) return true;
  // Sealed and on the shelf by the window, for the next courier.
  order.packed = true;
  order.waiter = -1;
  order.since = s.time;
  st.held = Held.None;
  setPose(st, Pose.Idle);
  emit(s, Ev.Packed, corner.table.x, corner.table.y);
  gainXp(s, st);
  st.job = null;
  st.jobTime = 0;
  return true;
}
