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

export function holdShortPoint(L: TierLayout): P2 {
  return node(L, L.taxi.holdShort);
}

export function routeLineUp(L: TierLayout): Path {
  return chaikin(p3([holdShortPoint(L), ...L.taxi.lineUp]), 3);
}

export function routeTakeoff(L: TierLayout): Path {
  const start = L.taxi.lineUp[L.taxi.lineUp.length - 1];
  const out: Path = [start[0], start[1], 0, L.takeoff.liftoffX, L.runway.y, 0];
  for (const c of L.takeoff.climb) out.push(c[0], c[1], c[2]);
  return chaikin(out, 2);
}

export function routeRollout(L: TierLayout): Path {
  const td = L.approach.touchdown;
  const e = node(L, L.taxi.exit);
  return [td[0], td[1], 0, e[0], e[1], 0];
}

export function routeLanding(L: TierLayout): Path {
  const thr = L.approach.threshold;
  const td = L.approach.touchdown;
  return [thr[0], thr[1], thr[2], (thr[0] + td[0]) / 2, (thr[1] + td[1]) / 2, thr[2] * 0.3, td[0], td[1], 0];
}

/** From the current position/heading to the threshold, through entry and FAF. */
export function routeFinal(L: TierLayout, x: number, y: number, z: number, heading: number): Path {
  const a = L.approach;
  const ahead: Path = [x, y, z, x + Math.cos(heading) * 1.6, y + Math.sin(heading) * 1.6, z];
  const pts: Path = [...ahead, a.entry[0], a.entry[1], a.entry[2], a.faf[0], a.faf[1], a.faf[2], a.threshold[0], a.threshold[1], a.threshold[2]];
  return chaikin(pts, 3);
}

export function routeDivert(x: number, y: number, z: number, heading: number): Path {
  return chaikin([x, y, z, x + Math.cos(heading) * 2, y + Math.sin(heading) * 2, z + 0.5, -14, y - 6, 8], 2);
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

export function doorPoint(L: TierLayout, aircraft: number, x: number, y: number, heading: number): P2 {
  const art = planeArt(aircraft);
  const side = doorSide(L, x, y, heading);
  const [nx, ny] = leftOf(heading);
  const u = -art.length * 0.12;
  const v = side * (art.radius + 0.18);
  return [x + Math.cos(heading) * u + nx * v, y + Math.sin(heading) * u + ny * v];
}

