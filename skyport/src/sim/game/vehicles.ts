/** The fuel truck: drives to a parked plane, fuels it, drives home. */
import { AIRCRAFT } from '../../data/aircraft';
import { pushEvent } from './events';
import { fuelPoint, layoutOf } from './layout';
import { chaikin, makeSample, samplePath } from './path';
import { FUEL, WANT, type Flight, type GameState, type Vehicle } from './types';

const SAMPLE = makeSample();
export const TRUCK_SPEED = 1.5;
/** Liters per second. */
export const FUEL_RATE = 26;

function flightById(s: GameState, id: number): Flight | undefined {
  for (const f of s.flights) if (f.id === id) return f;
  return undefined;
}

function drive(v: Vehicle, dt: number): boolean {
  v.pathPos += v.speed * dt;
  samplePath(v.path, v.pathPos, SAMPLE);
  v.x = SAMPLE.x;
  v.y = SAMPLE.y;
  v.heading = SAMPLE.heading;
  return SAMPLE.left <= 1e-6;
}

/** Player (or staff) asks for fuel. Returns 'started' | 'queued' | 'rejected'. */
export function requestFuel(s: GameState, f: Flight): 'started' | 'queued' | 'rejected' {
  if (f.phase !== 'deboarding' && f.phase !== 'turnaround') return 'rejected';
  if (f.fuelState !== FUEL.none) return 'rejected';
  f.fuelState = FUEL.queued;
  f.want = WANT.none;
  if (s.time - f.readyAt < 4) f.mood = Math.min(1, f.mood + 0.04);
  s.fuelQueue.push(f.id);
  const idle = s.vehicles.some((v) => v.kind === 'fuel' && v.state === 'idle');
  return idle ? 'started' : 'queued';
}

function dispatch(s: GameState, v: Vehicle): void {
  const L = layoutOf(s.tier);
  while (s.fuelQueue.length > 0) {
    const id = s.fuelQueue.shift() as number;
    const f = flightById(s, id);
    if (!f || f.fuelState !== FUEL.queued || (f.phase !== 'deboarding' && f.phase !== 'turnaround')) continue;
    const pt = fuelPoint(L, f.aircraft, f.x, f.y, f.heading);
    v.path = chaikin([v.x, v.y, 0, L.truckVia[0], L.truckVia[1], 0, pt.approach[0], pt.approach[1], 0, pt.at[0], pt.at[1], 0], 3);
    v.pathPos = 0;
    v.speed = TRUCK_SPEED;
    v.state = 'toPlane';
    v.flight = f.id;
    f.fuelState = FUEL.driving;
    return;
  }
}

export function updateVehicles(s: GameState, dt: number): void {
  const L = layoutOf(s.tier);
  for (const v of s.vehicles) {
    v.px = v.x;
    v.py = v.y;
    switch (v.state) {
      case 'idle':
        if (s.fuelQueue.length > 0) dispatch(s, v);
        break;
      case 'toPlane': {
        const f = flightById(s, v.flight);
        if (!f) {
          goHome(v, L.truckVia, L.truckHome);
          break;
        }
        if (drive(v, dt)) {
          v.state = 'fueling';
          f.fuelState = FUEL.fueling;
          pushEvent(s, 'fuelStart', v.x, v.y, f.id);
        }
        break;
      }
      case 'fueling': {
        const f = flightById(s, v.flight);
        if (!f) {
          goHome(v, L.truckVia, L.truckHome);
          break;
        }
        f.fuel = Math.min(f.fuelNeed, f.fuel + FUEL_RATE * dt);
        if (f.fuel >= f.fuelNeed) {
          f.fuelState = FUEL.done;
          pushEvent(s, 'fuelDone', f.x, f.y, f.id);
          goHome(v, L.truckVia, L.truckHome);
        }
        break;
      }
      case 'return':
        if (drive(v, dt)) {
          v.state = 'idle';
          v.flight = 0;
          v.speed = 0;
          if (s.fuelQueue.length > 0) dispatch(s, v);
        }
        break;
    }
  }
}

function goHome(v: Vehicle, via: readonly [number, number], home: readonly [number, number]): void {
  const back = [v.x - Math.cos(v.heading) * 0.0, v.y, 0];
  v.path = chaikin([back[0], back[1], 0, v.x + Math.cos(v.heading) * 0.8, v.y + Math.sin(v.heading) * 0.8, 0, via[0], via[1], 0, home[0], home[1], 0], 3);
  v.pathPos = 0;
  v.speed = TRUCK_SPEED;
  v.state = 'return';
  v.flight = 0;
}

/** Seconds of fueling left for a flight (for UI bars). */
export function fuelProgress(f: Flight): number {
  return f.fuelNeed > 0 ? f.fuel / f.fuelNeed : 1;
}

export function fuelSeconds(aircraft: number): number {
  return AIRCRAFT[aircraft].fuelLoad / FUEL_RATE;
}
