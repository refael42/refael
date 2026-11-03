/**
 * Service vehicles: the fuel truck and the baggage cart. Each drives to a
 * parked plane, works, and drives home. Requests queue per service.
 */
import { AIRCRAFT, planeArt, fuelRateOf } from '../../data/aircraft';
import type { P2, TierLayout } from '../../data/tiers';
import { pushEvent } from './events';
import { doorSide, layoutOf } from './layout';
import { chaikin, makeSample, samplePath } from './path';
import { FUEL, type Flight, type GameState, type ServiceKind, type Vehicle } from './types';
import { effects } from './upgrades';

const SAMPLE = makeSample();
export const TRUCK_SPEED = 1.5;
export const CART_SPEED = 1.7;
/** Liters per second. */
export const FUEL_RATE = 26;
/** Seconds per bag (unload + load). */
export const BAG_TIME = 0.32;

function flightById(s: GameState, id: number): Flight | undefined {
  for (const f of s.flights) if (f.id === id) return f;
  return undefined;
}

function stateOf(f: Flight, kind: ServiceKind): number {
  return kind === 'fuel' ? f.fuelState : f.bagState;
}

function setState(f: Flight, kind: ServiceKind, v: number): void {
  if (kind === 'fuel') f.fuelState = v;
  else f.bagState = v;
}

function queueOf(s: GameState, kind: ServiceKind): number[] {
  return kind === 'fuel' ? s.fuelQueue : s.bagQueue;
}

/** Fuel: not while boarding. Bags: any time the plane is parked. */
export function serviceAllowed(f: Flight, kind: ServiceKind): boolean {
  if (kind === 'fuel') return f.phase === 'deboarding' || f.phase === 'turnaround';
  return f.phase === 'deboarding' || f.phase === 'turnaround' || f.phase === 'boarding';
}

/** Player or staff asks for a service. */
export function requestService(s: GameState, f: Flight, kind: ServiceKind): 'started' | 'queued' | 'rejected' {
  if (!serviceAllowed(f, kind) || stateOf(f, kind) !== FUEL.none) return 'rejected';
  setState(f, kind, FUEL.queued);
  if (s.time - f.readyAt < 4) f.mood = Math.min(1, f.mood + 0.03);
  queueOf(s, kind).push(f.id);
  const idle = s.vehicles.some((v) => v.kind === kind && v.state === 'idle');
  return idle ? 'started' : 'queued';
}

/** Back-compat helper used by older tests and the UI. */
export function requestFuel(s: GameState, f: Flight) {
  return requestService(s, f, 'fuel');
}

/** Where a vehicle parks next to the plane, and the point it approaches from. */
function servicePoint(L: TierLayout, f: Flight, kind: ServiceKind): { at: P2; approach: P2 } {
  const art = planeArt(f.aircraft);
  const door = doorSide(L, f.x, f.y, f.heading);
  const side = kind === 'fuel' ? -door : door;
  const nx = -Math.sin(f.heading);
  const ny = Math.cos(f.heading);
  const cx = Math.cos(f.heading);
  const cy = Math.sin(f.heading);
  const v = side * (art.radius + (kind === 'fuel' ? 0.5 : 0.42));
  const u = kind === 'fuel' ? art.length * 0.05 : -art.length * 0.32;
  const at: P2 = [f.x + cx * u + nx * v, f.y + cy * u + ny * v];
  const approach: P2 = [at[0] - cx * 0.9 + nx * side * 0.3, at[1] - cy * 0.9 + ny * side * 0.3];
  return { at, approach };
}

function homeOf(L: TierLayout, kind: ServiceKind) {
  return kind === 'fuel' ? L.fuel : L.bags;
}

function drive(v: Vehicle, dt: number): boolean {
  v.pathPos += v.speed * dt;
  samplePath(v.path, v.pathPos, SAMPLE);
  v.x = SAMPLE.x;
  v.y = SAMPLE.y;
  v.heading = SAMPLE.heading;
  return SAMPLE.left <= 1e-6;
}

function dispatch(s: GameState, v: Vehicle): void {
  const L = layoutOf(s.tier);
  const q = queueOf(s, v.kind);
  while (q.length > 0) {
    const id = q.shift() as number;
    const f = flightById(s, id);
    if (!f || stateOf(f, v.kind) !== FUEL.queued || !serviceAllowed(f, v.kind)) continue;
    const pt = servicePoint(L, f, v.kind);
    const h = homeOf(L, v.kind);
    v.path = chaikin([v.x, v.y, 0, h.via[0], h.via[1], 0, pt.approach[0], pt.approach[1], 0, pt.at[0], pt.at[1], 0], 3);
    v.pathPos = 0;
    v.speed = v.kind === 'fuel' ? TRUCK_SPEED : CART_SPEED;
    v.state = 'toPlane';
    v.flight = f.id;
    setState(f, v.kind, FUEL.driving);
    return;
  }
}

function goHome(s: GameState, v: Vehicle): void {
  const h = homeOf(layoutOf(s.tier), v.kind);
  v.path = chaikin([v.x, v.y, 0, v.x + Math.cos(v.heading) * 0.8, v.y + Math.sin(v.heading) * 0.8, 0, h.via[0], h.via[1], 0, h.home[0], h.home[1], 0], 3);
  v.pathPos = 0;
  v.speed = v.kind === 'fuel' ? TRUCK_SPEED : CART_SPEED;
  v.state = 'return';
  v.flight = 0;
}

/** Seconds a service takes once the vehicle is at the plane. */
export function serviceSeconds(f: Flight, kind: ServiceKind): number {
  const ac = AIRCRAFT[f.aircraft];
  return kind === 'fuel' ? f.fuelNeed / fuelRateOf(ac) : 1 + (f.bagsIn + f.bagsOut) * (ac.bagTime ?? BAG_TIME);
}

export function updateVehicles(s: GameState, dt: number): void {
  for (const v of s.vehicles) {
    v.px = v.x;
    v.py = v.y;
    switch (v.state) {
      case 'idle':
        if (queueOf(s, v.kind).length > 0) dispatch(s, v);
        break;
      case 'toPlane': {
        const f = flightById(s, v.flight);
        if (!f || !serviceAllowed(f, v.kind)) {
          if (f && stateOf(f, v.kind) === FUEL.driving) setState(f, v.kind, FUEL.none);
          goHome(s, v);
          break;
        }
        if (drive(v, dt)) {
          v.state = 'fueling';
          setState(f, v.kind, FUEL.fueling);
          pushEvent(s, v.kind === 'fuel' ? 'fuelStart' : 'bagsStart', v.x, v.y, f.id);
        }
        break;
      }
      case 'fueling': {
        const f = flightById(s, v.flight);
        if (!f) {
          goHome(s, v);
          break;
        }
        const fx = effects(s);
        if (v.kind === 'fuel') {
          f.fuel = Math.min(f.fuelNeed, f.fuel + fuelRateOf(AIRCRAFT[f.aircraft]) * fx.fuelRate * dt);
          if (f.fuel >= f.fuelNeed) {
            f.fuelState = FUEL.done;
            pushEvent(s, 'fuelDone', f.x, f.y, f.id);
            goHome(s, v);
          }
        } else {
          f.bagWork = Math.min(1, f.bagWork + (dt * fx.bagSpeed) / serviceSeconds(f, 'bags'));
          if (f.bagWork >= 1) {
            f.bagState = FUEL.done;
            pushEvent(s, 'bagsDone', f.x, f.y, f.id);
            goHome(s, v);
          }
        }
        break;
      }
      case 'return':
        if (drive(v, dt)) {
          v.state = 'idle';
          v.flight = 0;
          v.speed = 0;
          if (queueOf(s, v.kind).length > 0) dispatch(s, v);
        }
        break;
    }
  }
}

export function makeVehicle(id: number, kind: ServiceKind, L: TierLayout): Vehicle {
  const h = homeOf(L, kind);
  return {
    id,
    kind,
    x: h.home[0],
    y: h.home[1],
    px: h.home[0],
    py: h.home[1],
    heading: Math.PI * 0.75,
    speed: 0,
    path: [],
    pathPos: 0,
    state: 'idle',
    flight: 0,
  };
}

export function fuelProgress(f: Flight): number {
  return f.fuelNeed > 0 ? f.fuel / f.fuelNeed : 1;
}

export function fuelSeconds(aircraft: number): number {
  return AIRCRAFT[aircraft].fuelLoad / fuelRateOf(AIRCRAFT[aircraft]);
}
