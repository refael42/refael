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

const routes = new WeakMap<TierLayout, Route>();

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
function routeOf(L: TierLayout): Route {
  const hit = routes.get(L);
  if (hit) return hit;
  const inbound = L.road.slice().reverse(); // edge -> curb
  const lane1 = offset(inbound, LANE);
  const lane2 = offset(L.road, LANE); // curb -> edge, its own right lane
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
  routes.set(L, r);
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

/** Cars on the access road at sim time `time`. */
export function roadCars(L: TierLayout, time: number): CarPose[] {
  const r = routeOf(L);
  const trip = r.length / SPEED + STOP;
  const out: CarPose[] = [];
  const last = Math.floor(time / PERIOD);
  const first = Math.max(0, Math.floor((time - trip - 4) / PERIOD));
  for (let j = first; j <= last; j++) {
    if (hash01(j * 31 + 7) < 0.2) continue; // gaps in the traffic
    const start = j * PERIOD + hash01(j * 31 + 11) * 3;
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
    const u = hash01(j * 31 + 3);
    const variant = BUS >= 0 && u < 0.08 ? BUS : Math.floor(hash01(j * 31 + 5) * CAR_VARIANTS.length) % CAR_VARIANTS.length;
    out.push({ x: p.x, y: p.y, heading: p.heading, variant: variant === BUS && u >= 0.08 ? 0 : variant, stopped });
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
    if (hash01(i * 13 + 5) >= occ) return;
    let variant = Math.floor(hash01(i * 17 + 3) * CAR_VARIANTS.length);
    if (variant === BUS) variant = 0;
    // not everyone parks perfectly straight
    const wobble = (hash01(i * 19 + 2) - 0.5) * 0.12;
    out.push({ x: b.x + wobble * 0.3, y: b.y, heading: b.heading + wobble, variant, stopped: true });
  });
  return out;
}
