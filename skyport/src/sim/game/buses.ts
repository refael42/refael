/**
 * Apron buses (from the regional airport on). A plane at a remote stand, far
 * from Terminal 1's doors, is reached by bus: departing passengers walk out of
 * the gate door to the bus stop, ride to the plane and climb the stairs;
 * arriving passengers wait at the plane, ride back to the stop and walk in
 * through the arrivals door. Deterministic and transient (rebuilt on load).
 */
import type { P2, TierLayout } from '../../data/tiers';
import { hash01 } from '../hash';
import { doorPoint, gatePoint, layoutOf } from './layout';
import { chaikin, makeSample, samplePath } from './path';
import { arrivalsRoute } from './routes';
import { claimSpot, terminalFor } from './terminal';
import { PST, type ApronBus, type Flight, type GameState, type Person } from './types';

const SAMPLE = makeSample();
/** Passenger figures a bus carries. */
export const BUS_CAP = 18;
const BUS_SPEED = 2.2;
/** Stands farther than this from the terminal building are served by bus. */
export const BUS_DIST = 5;
/** Seconds between people getting off. */
const STEP_OFF = 0.22;

function flightById(s: GameState, id: number): Flight | undefined {
  for (const f of s.flights) if (f.id === id) return f;
  return undefined;
}

/** Does this flight's terminal use a bus to reach it? (Terminal 1, a remote stand or a jet-bridge gate.) */
export function bussed(s: GameState, f: Flight): boolean {
  const L = layoutOf(s.tier);
  if (!L.building || !L.terminal.busStop || f.stand < 0 || terminalFor(s, f) !== 0) return false;
  const st = L.stands[f.stand];
  if (!st || st.size === 'heli' || st.hangar) return false;
  if (gatePoint(L, f.stand)) return true;
  return remote(L, st.pos);
}

/** Farther than a short walk from the terminal building (its nearest wall). */
function remote(L: TierLayout, at: P2): boolean {
  const b = L.building!.box;
  const dx = Math.max(b[0] - at[0], 0, at[0] - b[2]);
  const dy = Math.max(b[1] - at[1], 0, at[1] - b[3]);
  return Math.hypot(dx, dy) > BUS_DIST;
}

/** Are there stands that need the bus at this airport? */
function busNeeded(L: TierLayout, open: readonly boolean[]): boolean {
  if (!L.building || !L.terminal.busStop) return false;
  return L.stands.some((st, i) => open[i] && !st.hangar && st.size !== 'heli' && (st.bridge || remote(L, st.pos)));
}

/** Where bus k parks at the stop (they line up along the front). */
export function busHome(L: TierLayout, k: number): P2 {
  const b = L.terminal.busStop!;
  return [b[0] + k * 1.3, b[1]];
}

/** The door side of a parked bus (facing the terminal), and the other side (facing the apron). */
function busDoor(b: ApronBus, toward: -1 | 1): P2 {
  return [b.x, b.y + toward * 0.24];
}

function drive(b: ApronBus, dt: number): boolean {
  b.pathPos += BUS_SPEED * dt;
  samplePath(b.path, b.pathPos, SAMPLE);
  b.x = SAMPLE.x;
  b.y = SAMPLE.y;
  b.heading = SAMPLE.heading;
  return SAMPLE.left <= 1e-6;
}

function routeTo(b: ApronBus, to: P2, lane: number): void {
  // out onto the apron lane in front of the terminal, along it, then in beside the plane (or back to the stop)
  const pts = [b.x, b.y, 0, b.x + 0.45, lane, 0, to[0] - 0.9, lane, 0, to[0] - 0.4, to[1], 0, to[0], to[1], 0];
  b.path = chaikin(pts, 2);
  b.pathPos = 0;
}

function walk(p: Person, pts: readonly number[]): void {
  const path = [p.x, p.y, 0];
  for (let i = 0; i + 1 < pts.length; i += 2) path.push(pts[i], pts[i + 1], 0);
  p.path = path;
  p.pathPos = 0;
  p.moving = true;
}

/** Where the bus waits beside a plane: north of its stairs (the terminal side), facing along the apron. */
function besidePlane(s: GameState, f: Flight | undefined, fallback: P2): P2 {
  if (!f) return [fallback[0], fallback[1] - 0.6];
  const L = layoutOf(s.tier);
  const d = doorPoint(L, f.aircraft, f.x, f.y, f.heading, L.hutDoor);
  return [d[0], d[1] - 0.65];
}

/** Departing passengers of a bussed flight: from the lounge out of the gate door to the bus stop. */
export function sendToBus(s: GameState, p: Person, via: readonly number[]): void {
  const L = layoutOf(s.tier);
  const b = L.terminal.busStop!;
  p.state = PST.toBus;
  walk(p, [...via, b[0] - 0.35 + hash01(p.id * 7) * 0.7, b[1] - 0.42 - hash01(p.id * 3) * 0.2]);
}

/** Arriving passengers of a bussed flight: off the stairs, a few steps away, and wait for the bus. */
export function waitForBus(p: Person): void {
  p.state = PST.waitBus;
  walk(p, [p.x - 0.4 + hash01(p.id * 5) * 0.5, p.y - 0.35 - hash01(p.id * 9) * 0.3]);
}

function ensureBuses(s: GameState, L: TierLayout): void {
  const want = busNeeded(L, s.standOpen) ? 2 : 0;
  if (s.buses.length === want) return;
  if (s.buses.length > want) {
    s.buses.length = want;
    return;
  }
  while (s.buses.length < want) {
    const [x, y] = busHome(L, s.buses.length);
    s.buses.push({ id: s.nextId++, x, y, px: x, py: y, heading: 0, path: [], pathPos: 0, state: 'idle', flight: 0, mode: 0, load: [], timer: 0 });
  }
}

export function updateBuses(s: GameState, dt: number): void {
  const L = layoutOf(s.tier);
  ensureBuses(s, L);
  if (s.buses.length === 0) return;
  const lane = (L.building ? L.building.box[3] : L.hutDoor[1]) + 0.95;
  const byId = new Map<number, Person>();
  for (const p of s.people) byId.set(p.id, p);
  s.buses.forEach((b, k) => {
    b.px = b.x;
    b.py = b.y;
    // (anyone whose plane went without them has got off)
    if (b.load.length > 0) {
      const keep = b.load.filter((id) => {
        const p = byId.get(id);
        return !!p && (p.state === PST.inBus || p.state === PST.inBusA);
      });
      if (keep.length !== b.load.length) b.load = keep;
    }
    // riders go where the bus goes
    for (const id of b.load) {
      const p = byId.get(id);
      if (p) {
        p.px = p.x;
        p.py = p.y;
        p.x = b.x;
        p.y = b.y;
      }
    }
    switch (b.state) {
      case 'idle': {
        const busy = new Set(s.buses.filter((o) => o !== b && o.state !== 'idle').map((o) => o.flight));
        // departures first: someone is at (or on the way to) the stop
        const dep = s.people.find((p) => (p.state === PST.toBus || p.state === PST.atBusStop) && !busy.has(p.flight));
        if (dep) {
          b.state = 'load';
          b.mode = 0;
          b.flight = dep.flight;
          b.timer = 0;
          break;
        }
        // then arrivals waiting at a plane
        const arr = s.people.find((p) => p.state === PST.waitBus && !busy.has(p.flight));
        if (arr) {
          b.mode = 1;
          b.flight = arr.flight;
          b.state = 'go';
          routeTo(b, besidePlane(s, flightById(s, arr.flight), [arr.x, arr.y]), lane);
        }
        break;
      }
      case 'load': {
        // board whoever of this flight is at the stop
        const door = busDoor(b, -1);
        for (const p of s.people) {
          if (b.load.length >= BUS_CAP) break;
          if (p.flight !== b.flight || p.moving) continue;
          if (p.state === PST.atBusStop && Math.hypot(p.x - door[0], p.y - door[1]) < 2.2) {
            p.state = PST.inBus;
            b.load.push(p.id);
          }
        }
        b.timer += dt;
        const coming = s.people.some((p) => p.flight === b.flight && (p.state === PST.toBus || p.state === PST.atBusStop || p.state === PST.waiting || p.state === PST.toSpot));
        if (b.load.length >= BUS_CAP || (b.load.length > 0 && !coming && b.timer > 1.5)) {
          b.state = 'go';
          routeTo(b, besidePlane(s, flightById(s, b.flight), busHome(L, k)), lane);
        } else if (b.load.length === 0 && !coming && b.timer > 3) b.state = 'idle';
        break;
      }
      case 'go':
        if (drive(b, dt)) {
          b.state = b.mode === 0 ? 'drop' : 'pick';
          b.timer = 0;
        }
        break;
      case 'drop': {
        // off the bus one at a time and up the stairs
        b.timer -= dt;
        if (b.timer > 0) break;
        b.timer = STEP_OFF;
        const id = b.load.shift();
        const p = id !== undefined ? byId.get(id) : undefined;
        if (p) {
          const f = flightById(s, p.flight);
          const off = busDoor(b, 1);
          p.x = off[0];
          p.y = off[1];
          p.px = p.x;
          p.py = p.y;
          p.state = PST.toPlane;
          const to = f ? doorPoint(L, f.aircraft, f.x, f.y, f.heading, L.hutDoor) : off;
          walk(p, [to[0], to[1]]);
        }
        if (b.load.length === 0) {
          b.state = 'back';
          routeTo(b, busHome(L, k), lane);
        }
        break;
      }
      case 'pick': {
        // the arrivals walk over and climb in
        const side = busDoor(b, 1);
        for (const p of s.people) {
          if (p.flight !== b.flight) continue;
          if (p.state === PST.waitBus) {
            p.state = PST.toBusA;
            walk(p, [side[0] - 0.2 + hash01(p.id) * 0.4, side[1] + 0.05]);
          } else if (p.state === PST.atBusA && b.load.length < BUS_CAP && Math.hypot(p.x - side[0], p.y - side[1]) < 1.5) {
            p.state = PST.inBusA;
            b.load.push(p.id);
          }
        }
        b.timer += dt;
        const f = flightById(s, b.flight);
        const more = s.people.some((p) => p.flight === b.flight && (p.state === PST.waitBus || p.state === PST.toBusA || p.state === PST.atBusA));
        const deboarding = !!f && f.phase === 'deboarding';
        if (b.load.length >= BUS_CAP || (!more && !deboarding && b.timer > 1) || b.timer > 40) {
          b.state = 'back';
          routeTo(b, busHome(L, k), lane);
        }
        break;
      }
      case 'back':
        if (drive(b, dt)) {
          b.heading = 0;
          b.state = b.load.length > 0 ? 'unload' : 'idle';
          b.timer = 0;
        }
        break;
      case 'unload': {
        // at the stop: off and in through the arrivals door to the carousel
        b.timer -= dt;
        if (b.timer > 0) break;
        b.timer = STEP_OFF;
        const id = b.load.shift();
        const p = id !== undefined ? byId.get(id) : undefined;
        if (p) {
          const off = busDoor(b, -1);
          p.x = off[0];
          p.y = off[1];
          p.px = p.x;
          p.py = p.y;
          p.state = PST.toHut;
          const c = claimSpot(s, p);
          walk(p, [...arrivalsRoute(L), c[0], c[1]]);
        }
        if (b.load.length === 0) b.state = 'idle';
        break;
      }
    }
  });
}
