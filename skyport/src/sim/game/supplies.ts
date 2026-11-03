/**
 * Supplies: the fuel farm and the spare-parts store. Using up stock is
 * instant; refilling takes an order, a supplier's lead time and a truck that
 * drives in by road, through the gate in the north fence, and unloads.
 * Orders go out by themselves when the stock (plus what is on its way) runs
 * low; the player picks the supplier and can order urgently.
 */
import { REORDER_AT, STORES, storeCap, URGENT_LEAD, URGENT_PRICE, type StoreKind } from '../../data/supplies';
import { tierDef, type Depot, type P2 } from '../../data/tiers';
import { Big } from '../big';
import { hash01, hashU32 } from '../hash';
import { pushEvent } from './events';
import { layoutOf } from './layout';
import { chaikin, makeSample, samplePath } from './path';
import type { Delivery, GameState, StoreState } from './types';
import { level } from './upgrades';

export const STORE_KINDS: readonly StoreKind[] = ['fuel', 'parts'];
/** Truck speed on the way in and out (tiles per second). */
export const DELIVERY_SPEED = 1.5;
/** Smoothing window of the use rate (seconds). */
const USE_WINDOW = 120;

const SAMPLE = makeSample();

function gh(s: GameState, n: number): number {
  return hash01(hashU32(s.seed ^ 0x3f0d) + n);
}

export function storeIndex(kind: StoreKind): number {
  return kind === 'fuel' ? 0 : 1;
}

export function makeStore(kind: StoreKind): StoreState {
  return { stock: storeCap(kind, 0), supplier: STORES[kind].defaultSupplier, use: 0, out: false, low: false };
}

/** Is this supply counted at the current tier? (Below it, it never runs out.) */
export function storeActive(s: GameState, kind: StoreKind): boolean {
  return s.tier >= STORES[kind].fromTier && !!layoutOf(s.tier).depot;
}

export function capacity(s: GameState, kind: StoreKind): number {
  return storeCap(kind, level(s, STORES[kind].line));
}

/** Coins per unit from a supplier (urgent orders cost more). */
export function unitPrice(s: GameState, kind: StoreKind, supplier: number, urgent = false): number {
  const sup = STORES[kind].suppliers[supplier] ?? STORES[kind].suppliers[0];
  return sup.price * tierDef(s.tier).pay * (urgent ? URGENT_PRICE : 1);
}

/** Units on their way (ordered, driving or still unloading). */
export function incoming(s: GameState, kind: StoreKind): number {
  const k = storeIndex(kind);
  let n = 0;
  for (const d of s.deliveries) if (d.store === k && d.state !== 'leaving') n += d.amount * (1 - d.done);
  return n;
}

/**
 * Takes up to `want` units from the store and returns what it got. Where the
 * store isn't kept (lower tiers) the supply is unlimited.
 */
export function draw(s: GameState, kind: StoreKind, want: number): number {
  if (want <= 0) return 0;
  if (!storeActive(s, kind)) return want;
  const st = s.stores[kind];
  const got = Math.min(want, st.stock);
  st.stock -= got;
  st.use += got / USE_WINDOW;
  if (got < want - 1e-9 && !st.out) {
    st.out = true;
    pushEvent(s, 'supplyOut', 0, 0, storeIndex(kind));
  }
  return got;
}

/** Is there anything to take right now? */
export function hasStock(s: GameState, kind: StoreKind, need = 1e-9): boolean {
  return !storeActive(s, kind) || s.stores[kind].stock >= need;
}

function roundOrder(kind: StoreKind, n: number): number {
  return kind === 'fuel' ? Math.floor(n / 500) * 500 : Math.floor(n);
}

/**
 * Orders enough to fill the store. Returns false when nothing was needed or
 * there was no money for it.
 */
export function placeOrder(s: GameState, kind: StoreKind, urgent: boolean): boolean {
  if (!storeActive(s, kind)) return false;
  const st = s.stores[kind];
  const cap = capacity(s, kind);
  const want = roundOrder(kind, cap - st.stock - incoming(s, kind));
  const minimum = kind === 'fuel' ? Math.max(500, cap * 0.1) : 1;
  if (want < minimum) return false;
  const price = unitPrice(s, kind, st.supplier, urgent);
  // short of money: order what you can afford (but not a token amount)
  const afford = roundOrder(kind, Math.floor(s.money.toNumber() / Math.max(1e-9, price)));
  const amount = Math.min(want, afford);
  if (amount < minimum) {
    if (!st.low) {
      st.low = true;
      pushEvent(s, 'supplyLow', 0, 0, storeIndex(kind));
    }
    return false;
  }
  st.low = false;
  s.money = s.money.sub(Big.fromNumber(Math.ceil(amount * price)));
  const sup = STORES[kind].suppliers[st.supplier] ?? STORES[kind].suppliers[0];
  const id = s.nextId++;
  const late = !urgent && gh(s, id * 7 + 1) < sup.lateChance ? sup.lateBy * (0.5 + gh(s, id * 7 + 2)) : 0;
  const lead = urgent ? URGENT_LEAD : sup.lead + late;
  s.deliveries.push({
    id,
    store: storeIndex(kind),
    amount,
    urgent,
    eta: s.time + lead,
    state: 'ordered',
    done: 0,
    path: [],
    pathPos: 0,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    heading: 0,
  });
  pushEvent(s, 'supplyOrdered', 0, 0, storeIndex(kind), amount, urgent ? 1 : 0);
  return true;
}

/** The way in: down the main road, along the service road, through the gate to the bay. */
export function deliveryRoute(road: readonly P2[], depot: Depot, store: number): number[] {
  const start = depot.serviceRoad[0];
  // main road points beyond the turn-off, farthest first
  const outer = road.filter((p) => p[1] < start[1] - 0.3).sort((a, b) => a[1] - b[1]);
  const bay = store === 0 ? depot.fuelBay : depot.partsBay;
  const pts: number[] = [];
  // keep right on the roads (two-way); inside the gate, straight to the bay
  for (const p of outer) pts.push(p[0] + 0.18, p[1], 0);
  for (const p of depot.serviceRoad) pts.push(p[0], p[1] + 0.18, 0);
  pts.push(depot.gate[0] + 0.12, depot.gate[1], 0);
  pts.push(depot.gate[0] + 0.05, depot.gate[1] + 0.45, 0);
  pts.push(bay[0], bay[1], 0);
  return chaikin(pts, 3);
}

/** The way out: a loop on the apron in front of the bay, back through the gate and up the road. */
function leaveRoute(road: readonly P2[], depot: Depot, from: P2): number[] {
  const start = depot.serviceRoad[0];
  const outer = road.filter((p) => p[1] < start[1] - 0.3).sort((a, b) => b[1] - a[1]);
  const pts: number[] = [from[0], from[1], 0, from[0] + 0.55, from[1] + 0.75, 0, depot.gate[0] + 0.35, depot.gate[1] + 0.9, 0, depot.gate[0] - 0.1, depot.gate[1], 0];
  for (let i = depot.serviceRoad.length - 1; i >= 0; i--) pts.push(depot.serviceRoad[i][0], depot.serviceRoad[i][1] - 0.18, 0);
  for (const p of outer) pts.push(p[0] - 0.18, p[1], 0);
  return chaikin(pts, 3);
}

function move(d: Delivery, dt: number): boolean {
  d.pathPos += DELIVERY_SPEED * dt;
  samplePath(d.path, d.pathPos, SAMPLE);
  d.x = SAMPLE.x;
  d.y = SAMPLE.y;
  d.heading = SAMPLE.heading;
  return SAMPLE.left <= 1e-6;
}

export function updateSupplies(s: GameState, dt: number): void {
  const L = layoutOf(s.tier);
  for (const kind of STORE_KINDS) {
    if (!storeActive(s, kind)) continue;
    const st = s.stores[kind];
    st.use *= 1 - dt / USE_WINDOW;
    // (a failed order for lack of money is retried every few seconds)
    if (st.stock + incoming(s, kind) < capacity(s, kind) * REORDER_AT && (!st.low || s.tick % 150 === 0)) placeOrder(s, kind, false);
  }
  if (s.deliveries.length === 0) return;
  const depot = L.depot;
  for (const d of s.deliveries) {
    const kind = STORE_KINDS[d.store];
    d.px = d.x;
    d.py = d.y;
    switch (d.state) {
      case 'ordered':
        if (s.time >= d.eta) {
          if (!depot) {
            // (no supply area here: it simply arrives)
            d.state = 'unloading';
            break;
          }
          d.path = deliveryRoute(L.road, depot, d.store);
          d.pathPos = 0;
          move(d, 0);
          d.px = d.x;
          d.py = d.y;
          d.state = 'driving';
        }
        break;
      case 'driving':
        if (move(d, dt)) d.state = 'unloading';
        break;
      case 'unloading': {
        const cap = capacity(s, kind);
        const full = STORES[kind].unload * (0.4 + 0.6 * Math.min(1, d.amount / Math.max(1, cap)));
        const step = Math.min(1 - d.done, dt / full);
        d.done += step;
        const st = s.stores[kind];
        st.stock = Math.min(cap, st.stock + d.amount * step);
        // (back in business once there is a real amount in the tanks, not the first drops)
        if (st.out && st.stock >= cap * 0.05) st.out = false;
        if (d.done >= 1 - 1e-9) {
          d.done = 1;
          pushEvent(s, 'supplyArrived', d.x, d.y, d.store, d.amount);
          if (depot) {
            d.path = leaveRoute(L.road, depot, [d.x, d.y]);
            d.pathPos = 0;
            d.state = 'leaving';
          } else d.state = 'leaving';
        }
        break;
      }
      case 'leaving':
        if (!depot || move(d, dt)) d.pathPos = -1;
        break;
    }
  }
  s.deliveries = s.deliveries.filter((d) => d.pathPos >= 0);
}

/** Player commands: pick a supplier, or order urgently now. */
export function setSupplier(s: GameState, store: number, supplier: number): boolean {
  const kind = STORE_KINDS[store];
  if (!kind || supplier < 0 || supplier >= STORES[kind].suppliers.length) return false;
  s.stores[kind].supplier = supplier;
  return true;
}

export function urgentOrder(s: GameState, store: number): boolean {
  const kind = STORE_KINDS[store];
  if (!kind) return false;
  return placeOrder(s, kind, true);
}

/** On reaching a new tier, the stock starts full at the new capacity (the builders filled it). */
export function refillOnTierUp(s: GameState): void {
  for (const kind of STORE_KINDS) if (storeActive(s, kind)) s.stores[kind].stock = Math.max(s.stores[kind].stock, capacity(s, kind));
}
