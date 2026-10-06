import { DELIVERY } from '../../data/delivery';
import { DISHES } from '../../data/dishes';
import { ECONOMY } from '../../data/economy';
import { big } from '../big';
import { festivalBonus, festivalDelivery } from '../festival';
import { setPose } from '../movement';
import { next, pick } from '../rng';
import { boostNow } from '../shop';
import { Emote, Facing, Held, Pose } from '../types';
import { dishPrice, emote } from './customers';
import { emit, Ev } from './events';
import { statFactor, workRate } from './people';
import { OrderState, type GameState, type Order, type Staff } from './types';
import { gainXp } from './workers';

// Deliveries (src/data/delivery.ts): orders without a guest. They come in only while a courier
// is on the team, go through the kitchen like any other order (in a bag, no plate), and pay when
// the courier is back from the ride.

type DeliverJob = Extract<Staff['job'], { kind: 'deliver' }>;

const couriersOf = (s: GameState) => s.staff.filter((st) => st.role === 'courier' && !st.leaving);

/** Delivery orders not out of the door yet. */
const waitingOrders = (s: GameState) => s.orders.filter((o) => o.delivery && o.state !== OrderState.Carried);

/** How many bags a courier takes at once: two from `bigBagLevel`. */
export const bagSize = (st: Staff): number => (st.level >= DELIVERY.bigBagLevel ? 2 : 1);

/** New orders come in (while there is someone to take them out) and old ones nobody took are cancelled. */
export function updateDeliveries(s: GameState): void {
  // Cancelled: waited too long for a courier (none on the team any more, or far too busy).
  for (const o of waitingOrders(s)) {
    const claimed = o.waiter >= 0 && s.staff.some((st) => st.id === o.waiter);
    if (s.time - o.since < DELIVERY.cancelSeconds || claimed || o.state === OrderState.Cooking || o.state === OrderState.Plating) continue;
    const p = o.slot >= 0 ? s.map.passSlots[o.slot]! : s.map.ticketRail ? { x: s.map.ticketRail.x, y: s.map.ticketRail.y0 } : { x: 0, y: 0 };
    s.orders.splice(s.orders.indexOf(o), 1);
    const r = ECONOMY.rating;
    s.rating = Math.max(r.min, Math.min(r.max, s.rating + DELIVERY.cancelRating));
    emit(s, Ev.Poof, p.x, p.y);
    emit(s, Ev.DeliveryCancel, p.x, p.y);
  }
  const couriers = couriersOf(s).length;
  if (couriers === 0 || s.construction) {
    s.nextDelivery = Math.max(s.nextDelivery, s.time + 5);
    return;
  }
  if (s.time < s.nextDelivery) return;
  const perMinute = Math.max(0.3, DELIVERY.perMinute + DELIVERY.perStar * (s.rating - 3)) * couriers;
  s.nextDelivery = s.time + (-Math.log(1 - next(s.rng)) * 60) / perMinute;
  if (waitingOrders(s).length >= couriers * DELIVERY.waitingPerCourier) return;
  const menu = DISHES.filter((d) => s.mods.menu[d.id]);
  const dish = pick(s.rng, menu).id;
  const id = s.nextId++;
  s.orders.push({ id, customer: -1, dish, state: OrderState.Queued, progress: 0, slot: -1, since: s.time, landsAt: 0, waiter: -1, quality: 1, delivery: true });
  const rail = s.map.ticketRail;
  // c = 1: the very first one (the screen explains what it is).
  emit(s, Ev.DeliveryOrder, rail.x, rail.y0, dish, 0, s.stats.delivered === 0 && s.orders.filter((o) => o.delivery).length === 1 ? 1 : 0);
}

/** What one delivery brings in: the bill with the delivery fee, and the tip. */
function deliveryPay(s: GameState, st: Staff, o: Order) {
  const price = dishPrice(s, o.dish).mul(o.quality * DELIVERY.priceMult * boostNow(s) * festivalBonus(s)).floor();
  const tip = price.mul(DELIVERY.tip * statFactor(st.stats.charm) * s.mods.tips).floor();
  return price.add(tip);
}

/** The courier: wait by the scooter, fetch ready bags from the pass, ride off, come back paid. */
export function updateCourier(s: GameState, st: Staff, dt: number, walkTo: (to: { x: number; y: number }) => boolean, home: { x: number; y: number }): boolean {
  let job = st.job?.kind === 'deliver' ? st.job : null;
  if (!job) {
    if (st.leaving || st.pendingRole) return false;
    const ready = s.orders.filter((o) => o.delivery && o.state === OrderState.Ready && o.waiter < 0).sort((a, b) => a.since - b.since);
    if (ready.length === 0) {
      if (walkTo(home)) {
        setPose(st, Pose.Idle);
        st.facing = Facing.BackLeft;
      }
      return false;
    }
    const take = ready.slice(0, bagSize(st));
    for (const o of take) o.waiter = st.id;
    st.path = [];
    st.job = { kind: 'deliver', orders: take.map((o) => o.id), phase: 'toPass', left: 0, back: 0 };
    st.jobTime = 0;
    job = st.job;
  }
  const orders = job.orders.map((id) => s.orders.find((o) => o.id === id)).filter((o): o is Order => o !== undefined);
  if (job.phase === 'toPass' || job.phase === 'pack') {
    const ready = orders.filter((o) => o.state === OrderState.Ready);
    if (ready.length === 0) return drop(st, orders);
    if (job.phase === 'toPass') {
      if (walkTo(s.map.pickupSpots[ready[0]!.slot] ?? s.map.pickupSpots[0]!)) {
        setPose(st, Pose.Idle);
        st.facing = Facing.BackLeft;
        setPhase(st, job, 'pack');
      }
      return true;
    }
    st.jobTime += dt * workRate(s, st);
    if (st.jobTime < DELIVERY.packSeconds) return true;
    // The bags come off the pass (room for the next dish) and go out with the courier.
    for (const o of ready) {
      o.state = OrderState.Carried;
      o.slot = -1;
    }
    for (const o of orders) if (o.state !== OrderState.Carried) o.waiter = -1;
    st.job = { ...job, orders: ready.map((o) => o.id) };
    st.held = Held.Bag;
    st.path = [];
    setPhase(st, st.job, 'toScooter');
    return true;
  }
  if (job.phase === 'toScooter') {
    if (!walkTo(home)) return true;
    // On the scooter and away: off the map until the ride is done (faster for a quick courier).
    st.away = true;
    st.held = Held.None;
    const trip = DELIVERY.tripSeconds / (statFactor(st.stats.speed) * workRate(s, st));
    st.job = { ...job, phase: 'away', left: s.time, back: s.time + trip };
    emit(s, Ev.ScooterOff, home.x, home.y, st.slot);
    return true;
  }
  if (s.time < job.back) return true;
  // Back: every bag delivered, the money in.
  st.away = false;
  let total = big(0);
  for (const o of orders) {
    const pay = deliveryPay(s, st, o);
    total = total.add(pay);
    s.orders.splice(s.orders.indexOf(o), 1);
    s.stats.delivered += 1;
    festivalDelivery(s, o.dish);
    gainXp(s, st);
  }
  s.coins = s.coins.add(total);
  s.stats.earned = s.stats.earned.add(total);
  emit(s, Ev.Coins, st.x, st.y, total.toNumber());
  emit(s, Ev.Delivered, st.x, st.y, orders.length);
  emote(st, Emote.Coin);
  st.job = null;
  st.jobTime = 0;
  return true;
}

function setPhase(st: Staff, job: DeliverJob, phase: DeliverJob['phase']): void {
  st.job = { ...job, phase };
  st.jobTime = 0;
}

/** Nothing left to take (a cancelled order): let go of the claim and stand down. */
function drop(st: Staff, orders: Order[]): boolean {
  for (const o of orders) if (o.state !== OrderState.Carried) o.waiter = -1;
  st.job = null;
  st.jobTime = 0;
  st.path = [];
  return false;
}
