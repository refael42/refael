/** Routes and service points derived from the tier layout (pure, no state). */
import { planeArt } from '../../data/aircraft';
import { layoutFor, type P2, type TierLayout } from '../../data/tiers';
import { chaikin, type Path } from './path';

export function layoutOf(tier: number): TierLayout {
  return layoutFor(tier);
}

function p3(points: readonly P2[], z = 0): Path {
  const out: Path = [];
  for (const p of points) out.push(p[0], p[1], z);
  return out;
}

function node(L: TierLayout, id: string): P2 {
  const n = L.taxi.nodes[id];
  if (!n) throw new Error(`Unknown taxi node ${id}`);
  return n;
}

/** The runway operations for a direction: 1 = toward +x, -1 = the opposite setup (when the layout has one). */
export function opsOf(L: TierLayout, dir = 1) {
  if (dir < 0 && L.rev) {
    const r = L.rev;
    return { approach: r.approach, holdShort: r.holdShort, lineUp: r.lineUp, takeoff: r.takeoff, dir: -1 };
  }
  return { approach: L.approach, holdShort: L.taxi.holdShort, lineUp: L.taxi.lineUp, takeoff: L.takeoff, dir: 1 };
}

function nodeAny(L: TierLayout, id: string): P2 {
  const n = L.taxi.nodes[id] ?? L.rev?.nodes[id];
  if (!n) throw new Error(`Unknown taxi node ${id}`);
  return n;
}

export function holdShortPoint(L: TierLayout, dir = 1): P2 {
  return nodeAny(L, opsOf(L, dir).holdShort);
}

export function routeLineUp(L: TierLayout, dir = 1): Path {
  return chaikin(p3([holdShortPoint(L, dir), ...opsOf(L, dir).lineUp]), 3);
}

export function routeTakeoff(L: TierLayout, dir = 1): Path {
  const ops = opsOf(L, dir);
  const start = ops.lineUp[ops.lineUp.length - 1];
  const rwy = L.depRunway ?? L.runway;
  const out: Path = [start[0], start[1], 0, ops.takeoff.liftoffX, rwy.y, 0];
  for (const c of ops.takeoff.climb) out.push(c[0], c[1], c[2]);
  return chaikin(out, 2);
}

/** Touchdown to the runway exit (the first exit unless another one is given). */
export function routeRollout(L: TierLayout, exit?: P2, dir = 1): Path {
  const td = opsOf(L, dir).approach.touchdown;
  const e = exit ?? node(L, L.taxi.exit);
  return [td[0], td[1], 0, e[0], e[1], 0];
}

export function routeLanding(L: TierLayout, dir = 1): Path {
  const a = opsOf(L, dir).approach;
  const thr = a.threshold;
  const td = a.touchdown;
  return [thr[0], thr[1], thr[2], (thr[0] + td[0]) / 2, (thr[1] + td[1]) / 2, thr[2] * 0.3, td[0], td[1], 0];
}

/** From the current position/heading to the threshold, through entry and FAF. */
export function routeFinal(L: TierLayout, x: number, y: number, z: number, heading: number, dir = 1): Path {
  const a = opsOf(L, dir).approach;
  const ahead: Path = [x, y, z, x + Math.cos(heading) * 1.6, y + Math.sin(heading) * 1.6, z];
  const pts: Path = [...ahead, a.entry[0], a.entry[1], a.entry[2], a.faf[0], a.faf[1], a.faf[2], a.threshold[0], a.threshold[1], a.threshold[2]];
  return chaikin(pts, 3);
}

export function routeDivert(x: number, y: number, z: number, heading: number): Path {
  return chaikin([x, y, z, x + Math.cos(heading) * 2, y + Math.sin(heading) * 2, z + 0.5, -14, y - 6, 8], 2);
}

/** Where a stand's jet bridge meets the pier (null when the stand has none). */
export function gatePoint(L: TierLayout, stand: number): P2 | null {
  const st = L.stands[stand];
  if (!st || !st.bridge) return null;
  const pier = (L.buildings ?? []).find((b) => b.kind === 'pier');
  if (!pier) return null;
  return [st.pos[0] - 0.3, pier.pos[1] + pier.size[1] + 0.1];
}

/** Waiting spots in front of a gate (passengers stand along the pier). */
export function gateSpot(L: TierLayout, stand: number, k: number): P2 {
  const g = gatePoint(L, stand) ?? L.waitSpots[k % L.waitSpots.length];
  const col = k % 6;
  const row = Math.floor(k / 6) % 2;
  return [g[0] - 1.1 + col * 0.42 + row * 0.2, g[1] + 0.35 + row * 0.35];
}

/** Unit vector to the plane's left (+v) side. */
function leftOf(heading: number): [number, number] {
  return [-Math.sin(heading), Math.cos(heading)];
}

/** +1 when the passenger door should be on the left side (toward the hut). */
export function doorSide(L: TierLayout, x: number, y: number, heading: number): number {
  const [nx, ny] = leftOf(heading);
  return nx * (L.hutDoor[0] - x) + ny * (L.hutDoor[1] - y) >= 0 ? 1 : -1;
}

export function doorPoint(L: TierLayout, aircraft: number, x: number, y: number, heading: number, toward?: P2 | null): P2 {
  const art = planeArt(aircraft);
  const [lx, ly] = leftOf(heading);
  const side = toward ? (lx * (toward[0] - x) + ly * (toward[1] - y) >= 0 ? 1 : -1) : doorSide(L, x, y, heading);
  const [nx, ny] = [lx, ly];
  const u = -art.length * 0.12;
  const v = side * (art.radius + 0.18);
  return [x + Math.cos(heading) * u + nx * v, y + Math.sin(heading) * u + ny * v];
}

