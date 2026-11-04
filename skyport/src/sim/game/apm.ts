/**
 * The people mover (the hub): a two-car train shuttles along its track
 * between the station at the end of Terminal 3's concourse and the satellite,
 * Concourse D. Departing passengers for a D gate wait on the platform in
 * Terminal 3, ride out and walk to their gate; arriving passengers walk from
 * the jet bridge to the platform in D, ride in and go on to passport control.
 * Deterministic and transient (rebuilt on load).
 */
import type { Area, TierLayout } from '../../data/tiers';
import { hash01 } from '../hash';
import { gatePoint, layoutOf } from './layout';
import { PST, type Flight, type GameState, type Person } from './types';

/** Passenger figures the train carries. */
export const APM_CAP = 30;
/** Length of one car (the train has two). */
export const APM_CAR = 0.85;
/** Seconds with the doors open at a station (at least). */
const DWELL = 6;
const V_MAX = 2.4;
const ACCEL = 1.4;
/** Seconds between people getting off or on. */
const STEP = 0.12;
/** Where a waiting passenger is (their slot): at the food court of Terminal 3, or in the gate lounge. */
export const AT_FOOD = -3;
export const AT_GATE = -4;

function walk(p: Person, pts: readonly number[]): void {
  const path = [p.x, p.y, 0];
  for (let i = 0; i + 1 < pts.length; i += 2) path.push(pts[i], pts[i + 1], 0);
  p.path = path;
  p.pathPos = 0;
  p.moving = true;
}

function flightById(s: GameState, id: number): Flight | undefined {
  for (const f of s.flights) if (f.id === id) return f;
  return undefined;
}

/** A spot on a platform (spread out by the person's id). */
export function platformSpot(a: Area, id: number): [number, number] {
  return [a[0] + hash01(id * 17 + 3) * (a[2] - a[0]), a[1] + hash01(id * 19 + 5) * (a[3] - a[1])];
}

/** A departing passenger for a satellite gate: along Terminal 3's concourse to the platform. */
export function toApm(s: GameState, p: Person, via: readonly number[]): void {
  const sat = layoutOf(s.tier).sat;
  if (!sat) return;
  const sp = platformSpot(sat.platformT, p.id);
  p.state = PST.toApm;
  walk(p, [...via, sp[0], sp[1]]);
}

/** An arriving passenger off a satellite jet bridge: in, and along the concourse to the platform. */
export function toApmFromGate(s: GameState, p: Person): void {
  const sat = layoutOf(s.tier).sat;
  if (!sat) return;
  const sp = platformSpot(sat.platformS, p.id);
  p.state = PST.toApmA;
  walk(p, [p.x, sat.building.box[3] - 0.55, sp[0], sp[1]]);
}

/** A seat in the gate lounge by this stand's jet bridge (Terminal 3 or the satellite). */
export function loungeSeat(L: TierLayout, stand: number, k: number): [number, number] {
  const g = gatePoint(L, stand) ?? [48, 17.4];
  const col = k % 6;
  const row = Math.floor(k / 6) % 2;
  return [g[0] - 1.15 + col * 0.42, g[1] - 0.9 + row * 0.5];
}

function newTrain(L: TierLayout): GameState['apm'] {
  const a = L.sat!.apm;
  return { x: a.stopT, px: a.stopT, v: 0, at: 0, state: 'dwell', timer: 0, load: [] };
}

/** Someone gets off at this station: departures at the satellite walk to their gate, arrivals in Terminal 3 go on to passport control. */
function getOff(s: GameState, L: TierLayout, p: Person, x: number): void {
  const sat = L.sat!;
  p.x = x;
  p.y = sat.apm.y - 0.3;
  p.px = p.x;
  p.py = p.y;
  if (p.state === PST.inApmA) {
    p.state = PST.toArrPass;
    const sp = platformSpot(sat.platformT, p.id);
    walk(p, [sp[0], sp[1], ...(L.t3?.st.arrivalsWay ?? []).flat()]);
    return;
  }
  const f = flightById(s, p.flight);
  const sp = platformSpot(sat.platformS, p.id);
  if (!f || f.stand < 0) {
    // their plane left without them: back on the next train (out of sight)
    p.state = PST.leaving;
    walk(p, [sp[0], sp[1]]);
    return;
  }
  const seat = loungeSeat(L, f.stand, p.spot);
  p.state = PST.toSpot;
  p.slot = AT_GATE;
  // some stroll past the shops and the food court first, when there is time
  const b = sat.building.box;
  const stroll = f.phase !== 'boarding' && hash01(p.id * 23 + 7) < 0.4 ? [b[0] + 2.4 + hash01(p.id * 29) * 8.5, b[1] + 1.25 + hash01(p.id * 31) * 0.6] : [];
  walk(p, [sp[0], sp[1], ...stroll, seat[0], seat[1]]);
}

export function updateApm(s: GameState, dt: number): void {
  const L = layoutOf(s.tier);
  if (!L.sat) {
    s.apm = null;
    return;
  }
  if (!s.apm) s.apm = newTrain(L);
  const t = s.apm!;
  const a = L.sat.apm;
  t.px = t.x;
  const byId = new Map<number, Person>();
  for (const p of s.people) byId.set(p.id, p);
  // (anyone who is not riding any more has got off)
  if (t.load.length > 0) {
    const keep = t.load.filter((id) => {
      const p = byId.get(id);
      return !!p && (p.state === PST.inApm || p.state === PST.inApmA);
    });
    if (keep.length !== t.load.length) t.load = keep;
  }
  // riders go where the train goes (spread along the two cars)
  for (let i = 0; i < t.load.length; i++) {
    const p = byId.get(t.load[i]);
    if (!p) continue;
    p.px = p.x;
    p.py = p.y;
    p.x = t.x + (hash01(p.id * 37) - 0.5) * APM_CAR * 1.6;
    p.y = a.y;
  }
  if (t.state === 'dwell') {
    t.timer += dt;
    // the doors: off first, then on, one person per step
    const step = Math.floor(t.timer / STEP) !== Math.floor((t.timer - dt) / STEP);
    let busy = false;
    const offState = t.at === 1 ? PST.inApm : PST.inApmA;
    const off = t.load.findIndex((id) => byId.get(id)?.state === offState);
    if (off >= 0) {
      busy = true;
      if (step) {
        const p = byId.get(t.load[off])!;
        t.load.splice(off, 1);
        getOff(s, L, p, t.x + (hash01(p.id * 41) - 0.5) * APM_CAR * 1.6);
      }
    } else if (t.load.length < APM_CAP) {
      const onState = t.at === 0 ? PST.atApm : PST.atApmA;
      const p = s.people.find((q) => q.state === onState && !q.moving);
      if (p) {
        busy = true;
        if (step) {
          p.state = t.at === 0 ? PST.inApm : PST.inApmA;
          t.load.push(p.id);
        }
      }
    }
    if (t.timer >= DWELL && !busy) {
      t.state = 'run';
      t.at = 1 - t.at;
      t.v = 0;
      t.timer = 0;
    }
    return;
  }
  // run: speed up, cruise, brake into the next station
  const target = t.at === 1 ? a.stopS : a.stopT;
  const dist = Math.abs(target - t.x);
  const speed = Math.min(V_MAX, Math.sqrt(2 * ACCEL * dist) + 0.05, Math.abs(t.v) + ACCEL * dt);
  const move = Math.min(dist, speed * dt);
  t.x += Math.sign(target - t.x) * move;
  t.v = Math.sign(target - t.x) * speed;
  if (Math.abs(target - t.x) < 1e-4) {
    t.x = target;
    t.v = 0;
    t.state = 'dwell';
    t.timer = 0;
  }
}
