/** Passengers walking between the plane, the hut and the waiting area. */
import { PAX_TYPES, paxTypeFrom } from '../../data/paxTypes';
import type { TierLayout } from '../../data/tiers';
import { hash01 } from '../hash';
import { doorPoint, gatePoint, layoutOf } from './layout';
import { arrivalsRoute, doorSides, entranceRoute, gateRoute, homeRoute, homeRoute3, pierWalk, zoneAt } from './routes';
import { makeSample, samplePath } from './path';
import { claimSpot, joinArrPassport, joinCheckin, leaveStations, terminalFor } from './terminal';
import { bussed, sendToBus, waitForBus } from './buses';
import { PST, type Flight, type GameState, type Person } from './types';

const SAMPLE = makeSample();

function makePerson(s: GameState, f: Flight, x: number, y: number, state: number, n = 1, term = 0): Person {
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
    slot: -1,
    until: 0,
    waited: 0,
    n,
    term,
  };
}

function walkTo(p: Person, points: number[]): void {
  const path = [p.x, p.y, 0];
  for (let i = 0; i < points.length; i += 2) path.push(points[i], points[i + 1], 0);
  p.path = path;
  p.pathPos = 0;
  p.moving = true;
}

export function spawnArrivingPax(s: GameState, f: Flight, x: number, y: number, n = 1): void {
  const L = layoutOf(s.tier);
  const term = terminalFor(s, f);
  const p = makePerson(s, f, x, y, PST.toHut, n, term);
  if (term === 1 && L.t3) {
    // Terminal 3: off the jet bridge, along the concourse to the arrivals corridor (passport control at the international airport)
    p.state = PST.toArrPass;
    walkTo(p, [x, L.t3.building.box[3] - 0.7, ...(L.t3.st.arrivalsWay ?? []).flat()]);
    s.people.push(p);
    return;
  }
  if (bussed(s, f)) {
    // a remote stand: wait by the plane for the apron bus
    s.people.push(p);
    waitForBus(p);
    return;
  }
  const c = claimSpot(s, p);
  if (L.building) {
    // into the terminal through the arrivals door (from a pier gate: along the apron first)
    const gate = gatePoint(L, f.stand);
    const walk = gate ? pierWalk(L, gate) : [];
    const back = walk.length === 4 ? [walk[0], walk[1]] : [];
    walkTo(p, [...back, ...arrivalsRoute(L), c[0], c[1]]);
  } else {
    // step away from the plane, then to the baggage carousel
    const mid: [number, number] = [(x + c[0]) / 2 + 0.3, (y + c[1]) / 2 + 0.3];
    walkTo(p, [mid[0], mid[1], c[0], c[1]]);
  }
  s.people.push(p);
}

export function spawnDepartingPax(s: GameState, f: Flight, L: TierLayout, n = 1): void {
  const term = terminalFor(s, f);
  if (term === 1 && L.t3) {
    // Terminal 3: from the garage and the curb, in through one of its doors, past the check-in islands
    const T = L.t3;
    const e = T.st.entry;
    const p = makePerson(s, f, e[0] + (hash01(s.nextId * 3) - 0.5) * 2.4, e[1] + (hash01(s.nextId * 5) - 0.5) * 0.3, PST.toEntrance, n, 1);
    s.people.push(p);
    const ins = T.st.entrances ?? [T.st.doors!.entrance];
    const d = doorSides(T.building, ins[p.id % ins.length]);
    walkTo(p, [d.out[0], d.out[1], d.in[0], d.in[1], ...(T.st.lobby ?? []).flat()]);
    return;
  }
  // they come from the parking lot and line up for check-in
  const e = L.terminal.entry;
  const p = makePerson(s, f, e[0] + (hash01(s.nextId * 3) - 0.5) * 0.6, e[1] + (hash01(s.nextId * 5) - 0.5) * 0.4, PST.inCheckin, n);
  s.people.push(p);
  if (L.building) {
    // across the road and in through the entrance; the line starts inside
    p.state = PST.toEntrance;
    walkTo(p, entranceRoute(L));
  } else joinCheckin(s, p);
}

/** Sends the next waiting passenger of the flight to the door. */
export function releaseBoarding(s: GameState, f: Flight, dt: number, L: TierLayout): void {
  f.paxTimer -= dt;
  if (f.paxTimer > 0) return;
  const gate = gatePoint(L, f.stand);
  for (const p of s.people) {
    if (p.flight === f.id && p.state === PST.waiting) {
      // through the jet bridge from the gate, or out of the gate door and across the apron to the door
      const to = gate ?? doorPoint(L, f.aircraft, f.x, f.y, f.heading);
      p.state = PST.toPlane;
      if (bussed(s, f)) {
        // a remote stand: out of the gate door to the apron bus
        sendToBus(s, p, gateRoute(L));
      } else if (p.term === 1 && L.t3 && gate) {
        // Terminal 3: from the food court down the concourse if they never got to the gate, then into the jet bridge
        const from = p.slot === -3 ? (L.t3.st.concourse ?? []).flat() : [];
        walkTo(p, [...from, gate[0], gate[1] - 0.5, gate[0], gate[1]]);
      } else if (gate && L.building && zoneAt(L.building, p.x, p.y)) {
        // a smaller plane at a jet-bridge gate: out of Terminal 1's gate door and along the apron to it
        walkTo(p, [...gateRoute(L), ...pierWalk(L, gate), to[0], to[1]]);
      } else walkTo(p, [...(gate ? [] : gateRoute(L)), to[0], to[1]]);
      f.paxTimer = gate ? 0.25 : 0.45;
      return;
    }
  }
}

const DEPARTING: readonly number[] = [
  PST.toSpot,
  PST.waiting,
  PST.toPlane,
  PST.inCheckin,
  PST.atCounter,
  PST.inSecurity,
  PST.atScanner,
  PST.toShop,
  PST.shopping,
  PST.toEntrance,
  PST.inPassport,
  PST.atBooth,
  PST.toBus,
  PST.atBusStop,
  PST.inBus,
];

/** The flight is gone: its passengers leave every queue and go home. */
export function sendPaxHome(s: GameState, f: Flight): void {
  const L = layoutOf(s.tier);
  for (const p of s.people) {
    if (p.flight !== f.id || !DEPARTING.includes(p.state)) continue;
    leaveStations(s, p);
    p.state = PST.leaving;
    if (p.term === 1 && L.t3) walkTo(p, [...homeRoute3(L, p.x, p.y), L.t3.st.entry[0], L.t3.st.entry[1]]);
    else if (L.building && L.terminal.doors && !zoneAt(L.building, p.x, p.y) && p.y > L.building.box[3]) {
      // out on the apron (at the bus stop, off the bus, on the way to the stairs): back in through the gate door first
      const d = doorSides(L.building, L.terminal.doors.gate);
      walkTo(p, [d.out[0], d.out[1], d.in[0], d.in[1], ...homeRoute(L, d.in[0], d.in[1]), L.terminal.exit[0], L.terminal.exit[1]]);
    } else walkTo(p, [...homeRoute(L, p.x, p.y), L.terminal.exit[0], L.terminal.exit[1]]);
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
            p.state = PST.atClaim;
            p.until = 0;
            break;
          case PST.toEntrance:
            joinCheckin(s, p);
            break;
          case PST.toArrPass:
            joinArrPassport(s, p);
            break;
          case PST.toBus:
            p.state = PST.atBusStop;
            break;
          case PST.toBusA:
            p.state = PST.atBusA;
            break;

          case PST.toExit:
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
            if (f) f.boarded = Math.min(f.paxOut, f.boarded + p.n);
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
