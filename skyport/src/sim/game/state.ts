import { tierDef } from '../../data/tiers';
import { Big } from '../big';
import { normalizeSeed } from '../rng';
import { SAVE_VERSION } from './constants';
import type { GameState, Vehicle } from './types';

export function createGame(seed: number): GameState {
  const s = normalizeSeed(seed);
  const L = tierDef(1).layout;
  const truck: Vehicle = {
    id: 1,
    kind: 'fuel',
    x: L.truckHome[0],
    y: L.truckHome[1],
    px: L.truckHome[0],
    py: L.truckHome[1],
    heading: Math.PI * 0.75,
    speed: 0,
    path: [],
    pathPos: 0,
    state: 'idle',
    flight: 0,
  };
  return {
    version: SAVE_VERSION,
    seed: s,
    rng: s,
    tick: 0,
    time: 0,
    tier: 1,
    money: Big.fromNumber(0),
    diamonds: 0,
    rating: 3,
    flights: [],
    people: [],
    vehicles: [truck],
    stands: L.stands.map(() => ({ occupant: 0, reserved: 0 })),
    fuelQueue: [],
    nextId: 2,
    nextArrival: 2,
    spotCursor: 0,
    stats: { served: 0, pax: 0, onTime: 0, late: 0, diverted: 0, earned: Big.fromNumber(0) },
    events: [],
    nextEventId: 1,
    queue: [],
  };
}

export function findFlight(s: GameState, id: number) {
  for (const f of s.flights) if (f.id === id) return f;
  return undefined;
}
