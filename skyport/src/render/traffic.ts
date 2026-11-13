/**
 * Background traffic (render only, not part of the simulation): cars drive
 * down the access road to the terminal curb, stop to drop people off and
 * drive back; the parking lot fills up as the airport gets busier. Pure
 * functions of the layout, the sim clock and the stats: deterministic, no state.
 */
import type { P2, TierLayout } from '../data/tiers';
import { hash01 } from '../sim/hash';
import { CAR_VARIANTS } from './art/vehicles';

export interface CarPose {
  x: number;
  y: number;
  heading: number;
  variant: number;
  /** Braking / stopped (tail lights on). */
  stopped: boolean;
}

const SPEED = 1.5; // tiles per second
const PERIOD = 7; // seconds between cars
const STOP = 2.5; // seconds at the curb
const LANE = 0.22;
const BUS = CAR_VARIANTS.findIndex((v) => v.kind === 'bus');

interface Route {
  pts: number[];
  cum: number[];
  stopAt: number;
  length: number;
}

const routes = new WeakMap<readonly P2[], Route>();

/** Polyline offset sideways by d (positive = to the right of travel). */
function offset(line: readonly P2[], d: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    // right of travel in this world (+90 degrees from forward)
    out.push([line[i][0] - (dy / len) * d, line[i][1] + (dx / len) * d]);
  }
  return out;
}

/**
 * One loop: in along the right lane from the map edge to the curb, a U-turn,
 * and back out along the other lane.
 */
function routeOf(road: readonly P2[]): Route {
  const hit = routes.get(road);
  if (hit) return hit;
  const inbound = road.slice().reverse(); // edge -> curb
  const lane1 = offset(inbound, LANE);
  const lane2 = offset(road, LANE); // curb -> edge, its own right lane
  const pts: number[] = [];
  for (const p of lane1) pts.push(p[0], p[1]);
  // U-turn around the curb end
  const end = inbound[inbound.length - 1];
  const prev = inbound[inbound.length - 2];
  const fx = end[0] - prev[0];
  const fy = end[1] - prev[1];
  const fl = Math.hypot(fx, fy) || 1;
  const ux = fx / fl;
  const uy = fy / fl;
  for (let k = 1; k < 6; k++) {
    const a = (k / 6) * Math.PI;
    // from the right lane (+90) sweeping forward and over to the left lane (-90)
    const side = Math.cos(a) * LANE;
    const ahead = Math.sin(a) * LANE * 1.4;
    pts.push(end[0] - uy * side + ux * ahead, end[1] + ux * side + uy * ahead);
  }
  for (const p of lane2) pts.push(p[0], p[1]);
  const cum = [0];
  for (let i = 2; i < pts.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
  let stopAt = 0;
  for (let i = 1; i < lane1.length; i++) stopAt += Math.hypot(lane1[i][0] - lane1[i - 1][0], lane1[i][1] - lane1[i - 1][1]);
  const r: Route = { pts, cum, stopAt: Math.max(0, stopAt - 0.15), length: cum[cum.length - 1] };
  routes.set(road, r);
  return r;
}

function sample(r: Route, d: number): { x: number; y: number; heading: number } {
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < d) i++;
  const a = r.cum[i - 1];
  const t = Math.max(0, Math.min(1, (d - a) / Math.max(1e-6, r.cum[i] - a)));
  const x0 = r.pts[(i - 1) * 2];
  const y0 = r.pts[(i - 1) * 2 + 1];
  const x1 = r.pts[i * 2];
  const y1 = r.pts[i * 2 + 1];
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, heading: Math.atan2(y1 - y0, x1 - x0) };
}

/** Cars on the access road (or another road, e.g. Terminal 3's) at sim time `time`. */
export function roadCars(L: TierLayout, time: number, road: readonly P2[] = L.road, seed = 0): CarPose[] {
  const r = routeOf(road);
  const trip = r.length / SPEED + STOP;
  const out: CarPose[] = [];
  const last = Math.floor(time / PERIOD);
  const first = Math.max(0, Math.floor((time - trip - 4) / PERIOD));
  for (let j = first; j <= last; j++) {
    if (hash01(j * 31 + 7 + seed) < 0.2) continue; // gaps in the traffic
    const start = j * PERIOD + hash01(j * 31 + 11 + seed) * 3;
    const age = time - start;
    if (age < 0 || age > trip) continue;
    const toCurb = r.stopAt / SPEED;
    let d: number;
    let stopped = false;
    if (age < toCurb) d = age * SPEED;
    else if (age < toCurb + STOP) {
      d = r.stopAt;
      stopped = true;
    } else d = r.stopAt + (age - toCurb - STOP) * SPEED;
    // ease into and out of the stop
    if (!stopped && Math.abs(d - r.stopAt) < 0.5) stopped = d < r.stopAt;
    const p = sample(r, Math.min(r.length, d));
    const u = hash01(j * 31 + 3 + seed);
    const variant = BUS >= 0 && u < 0.08 ? BUS : Math.floor(hash01(j * 31 + 5 + seed) * CAR_VARIANTS.length) % CAR_VARIANTS.length;
    out.push({ x: p.x, y: p.y, heading: p.heading, variant: variant === BUS && u >= 0.08 ? 0 : variant, stopped });
  }
  return out;
}

/** The road's x at height y (the access road runs roughly north-south). */
export function roadXAt(road: readonly P2[], y: number): number {
  for (let i = 1; i < road.length; i++) {
    const [ax, ay] = road[i - 1];
    const [bx, by] = road[i];
    if ((y - ay) * (y - by) <= 0 && ay !== by) return ax + ((bx - ax) * (y - ay)) / (by - ay);
  }
  return road[0][0];
}

/**
 * The parking lot's way in (owner request: it was not joined to the road): a
 * driveway from the access road along the lot's middle aisle. Its centre line
 * height, the road's x there, and the lot's west edge.
 */
export function lotDriveway(L: TierLayout): { y: number; roadX: number; x0: number; half: number } {
  const P = L.parking;
  const y = (P.y0 + P.y1) / 2;
  return { y, roadX: roadXAt(L.road, y), x0: P.x0, half: 0.36 };
}

/** The bays nearest the driveway are kept for the cars that come and go (the rest are filled by the served count). */
const VISITOR_BAYS = [0, 1, 2];
const LOT_PERIOD = 14;

interface Leg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  len: number;
  /** Driven backwards (backing out of a bay). */
  back: boolean;
}

function legsOf(pts: readonly (readonly [number, number])[], backFrom = Infinity): Leg[] {
  const out: Leg[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len > 1e-6) out.push({ x0, y0, x1, y1, len, back: i <= backFrom });
  }
  return out;
}

function onLegs(legs: readonly Leg[], d: number): { x: number; y: number; heading: number } {
  let rest = d;
  for (const g of legs) {
    if (rest <= g.len || g === legs[legs.length - 1]) {
      const t = Math.max(0, Math.min(1, rest / g.len));
      const h = Math.atan2(g.y1 - g.y0, g.x1 - g.x0) + (g.back ? Math.PI : 0);
      return { x: g.x0 + (g.x1 - g.x0) * t, y: g.y0 + (g.y1 - g.y0) * t, heading: h };
    }
    rest -= g.len;
  }
  return { x: 0, y: 0, heading: 0 };
}

const lotRoutes = new WeakMap<TierLayout, { inn: Leg[][]; out: Leg[][] }>();

/** Each visitor bay's way in (down the road, into the driveway, along the aisle, into the bay) and out (backing out, back to the road, away). */
function lotRoutesOf(L: TierLayout): { inn: Leg[][]; out: Leg[][] } {
  const hit = lotRoutes.get(L);
  if (hit) return hit;
  const D = lotDriveway(L);
  const bays = parkingBays(L);
  // the road's two lanes: in (toward the curb, west side) and out (toward the map edge, east side)
  const laneIn = offset(L.road.slice().reverse(), LANE).filter((p) => p[1] < D.y - 0.6);
  const laneOut = offset(L.road, LANE).filter((p) => p[1] < D.y - 0.6);
  const inn: Leg[][] = [];
  const out: Leg[][] = [];
  for (const k of VISITOR_BAYS) {
    const b = bays[k];
    if (!b) continue;
    const top = b.y < D.y;
    const aisle: [number, number] = [b.x, D.y + (top ? -0.12 : 0.12)];
    inn.push(
      legsOf([
        ...laneIn,
        [D.roadX - LANE, D.y - 0.45],
        [D.roadX + 0.15, D.y - 0.12],
        [D.x0 + 0.05, D.y],
        [b.x - 0.25, D.y],
        aisle,
        [b.x, b.y],
      ]),
    );
    const away: (readonly [number, number])[] = [
      [b.x, b.y],
      aisle,
      [b.x - 0.25, D.y],
      [D.x0 + 0.05, D.y + 0.1],
      [D.roadX + LANE + 0.2, D.y - 0.15],
      [D.roadX + LANE, D.y - 0.6],
      ...laneOut,
    ];
    // (the first leg, out of the bay, is driven backwards)
    out.push(legsOf(away, 1));
  }
  const r = { inn, out };
  lotRoutes.set(L, r);
  return r;
}

const total = (legs: readonly Leg[]) => legs.reduce((a, g) => a + g.len, 0);

/** Cars that turn off the road into the lot, park in a visitor bay for a while, back out and drive away. */
export function lotCars(L: TierLayout, time: number): CarPose[] {
  const r = lotRoutesOf(L);
  if (r.inn.length === 0) return [];
  const out: CarPose[] = [];
  const last = Math.floor(time / LOT_PERIOD);
  for (let j = Math.max(0, last - 6); j <= last; j++) {
    if (hash01(j * 37 + 5) < 0.25) continue;
    const k = j % r.inn.length;
    const inn = r.inn[k];
    const away = r.out[k];
    const tin = total(inn) / SPEED;
    const stay = 12 + hash01(j * 37 + 9) * 14;
    const tout = total(away) / SPEED;
    const age = time - (j * LOT_PERIOD + hash01(j * 37 + 2) * 2);
    if (age < 0 || age > tin + stay + tout) continue;
    let p: { x: number; y: number; heading: number };
    let stopped = false;
    if (age < tin) p = onLegs(inn, age * SPEED);
    else if (age < tin + stay) {
      p = onLegs(inn, total(inn));
      stopped = true;
    } else p = onLegs(away, (age - tin - stay) * SPEED);
    let variant = Math.floor(hash01(j * 37 + 13) * CAR_VARIANTS.length) % CAR_VARIANTS.length;
    if (variant === BUS) variant = 0;
    out.push({ x: p.x, y: p.y, heading: p.heading, variant, stopped: stopped || age < 0.2 });
  }
  return out;
}

/** Parking bays: two rows facing the middle aisle. */
export function parkingBays(L: TierLayout): { x: number; y: number; heading: number }[] {
  const P = L.parking;
  const out: { x: number; y: number; heading: number }[] = [];
  const cols = Math.floor((P.x1 - P.x0) / 0.65);
  for (let k = 0; k < cols; k++) {
    const x = P.x0 + 0.325 + k * 0.65;
    out.push({ x, y: P.y0 + 0.5, heading: -Math.PI / 2 });
    out.push({ x, y: P.y1 - 0.5, heading: Math.PI / 2 });
  }
  return out;
}

/** Parked cars: the lot fills up as more flights have been served. */
export function parkedCars(L: TierLayout, served: number): CarPose[] {
  const occ = Math.min(0.85, 0.4 + served / 150);
  const out: CarPose[] = [];
  parkingBays(L).forEach((b, i) => {
    // (the visitor bays by the driveway are for the cars that come and go)
    if (VISITOR_BAYS.includes(i) || hash01(i * 13 + 5) >= occ) return;
    let variant = Math.floor(hash01(i * 17 + 3) * CAR_VARIANTS.length);
    if (variant === BUS) variant = 0;
    // not everyone parks perfectly straight
    const wobble = (hash01(i * 19 + 2) - 0.5) * 0.12;
    out.push({ x: b.x + wobble * 0.3, y: b.y, heading: b.heading + wobble, variant, stopped: true });
  });
  return out;
}
