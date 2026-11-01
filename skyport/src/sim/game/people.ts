/** Passengers walking between the plane, the hut and the waiting area. */
import { PAX_TYPES, paxTypeFrom } from '../../data/paxTypes';
import type { TierLayout } from '../../data/tiers';
import { hash01 } from '../hash';
import { doorPoint, layoutOf } from './layout';
import { makeSample, samplePath } from './path';
import { PST, type Flight, type GameState, type Person } from './types';

const SAMPLE = makeSample();

function makePerson(s: GameState, f: Flight, x: number, y: number, state: number): Person {
  const id = s.nextId++;
  const outfit = paxTypeFrom(hash01(id * 7 + 3));
  return {
    id,
    flight: f.id,
    outfit,
    state,
    x,
    y,
    px: x,
    py: y,
    heading: 0,
    speed: PAX_TYPES[outfit].speed * (0.9 + hash01(id * 13 + 5) * 0.2),
    path: [],
    pathPos: 0,
    spot: -1,
    moving: true,
  };
}

function walkTo(p: Person, points: number[]): void {
  const path = [p.x, p.y, 0];
  for (let i = 0; i < points.length; i += 2) path.push(points[i], points[i + 1], 0);
  p.path = path;
  p.pathPos = 0;
  p.moving = true;
}

export function spawnArrivingPax(s: GameState, f: Flight, x: number, y: number): void {
  const L = layoutOf(s.tier);
  const p = makePerson(s, f, x, y, PST.toHut);
  // step away from the plane first, then to the hut door
  const mid: [number, number] = [(x + L.hutDoor[0]) / 2 + 0.3, (y + L.hutDoor[1]) / 2 + 0.25];
  walkTo(p, [mid[0], mid[1], L.hutDoor[0], L.hutDoor[1]]);
  s.people.push(p);
}

export function spawnDepartingPax(s: GameState, f: Flight, L: TierLayout): void {
  const p = makePerson(s, f, L.hutDoor[0], L.hutDoor[1], PST.toSpot);
  const spot = s.spotCursor++ % L.waitSpots.length;
  p.spot = spot;
  const sp = L.waitSpots[spot];
  walkTo(p, [sp[0], sp[1]]);
  s.people.push(p);
}

/** Sends the next waiting passenger of the flight to the door. */
export function releaseBoarding(s: GameState, f: Flight, dt: number, L: TierLayout): void {
  f.paxTimer -= dt;
  if (f.paxTimer > 0) return;
  for (const p of s.people) {
    if (p.flight === f.id && p.state === PST.waiting) {
      const door = doorPoint(L, f.aircraft, f.x, f.y, f.heading);
      p.state = PST.toPlane;
      walkTo(p, [door[0], door[1]]);
      f.paxTimer = 0.45;
      return;
    }
  }
}

/** The flight is gone: its waiting passengers walk back into the hut. */
export function sendPaxHome(s: GameState, f: Flight): void {
  const L = layoutOf(s.tier);
  for (const p of s.people) {
    if (p.flight !== f.id) continue;
    if (p.state === PST.toSpot || p.state === PST.waiting || p.state === PST.toPlane) {
      p.state = PST.leaving;
      walkTo(p, [L.hutDoor[0], L.hutDoor[1]]);
    }
  }
}

function flightById(s: GameState, id: number): Flight | undefined {
  for (const f of s.flights) if (f.id === id) return f;
  return undefined;
}

export function updatePeople(s: GameState, dt: number): void {
  let w = 0;
  for (let i = 0; i < s.people.length; i++) {
    const p = s.people[i];
    p.px = p.x;
    p.py = p.y;
    let keep = true;
    if (p.moving) {
      p.pathPos += p.speed * dt;
      samplePath(p.path, p.pathPos, SAMPLE);
      p.x = SAMPLE.x;
      p.y = SAMPLE.y;
      p.heading = SAMPLE.heading;
      if (SAMPLE.left <= 1e-6) {
        p.moving = false;
        switch (p.state) {
          case PST.toHut:
          case PST.leaving:
            keep = false;
            break;
          case PST.toSpot:
            p.state = PST.waiting;
            // face the apron while waiting
            p.heading = Math.PI / 2;
            break;
          case PST.toPlane: {
            const f = flightById(s, p.flight);
            if (f) f.boarded++;
            keep = false;
            break;
          }
        }
      }
    }
    if (keep) s.people[w++] = p;
  }
  s.people.length = w;
}
