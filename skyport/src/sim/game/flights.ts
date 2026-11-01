/** Flight lifecycle: spawn, approach, landing, taxi, turnaround, departure. */
import { AIRCRAFT } from '../../data/aircraft';
import { AIRLINES } from '../../data/airlines';
import { CITIES } from '../../data/cities';
import type { TierLayout } from '../../data/tiers';
import { rand, randInt, randRange, randWeighted } from '../rng';
import { flightRevenue, nextRating } from './economy';
import { pushEvent } from './events';
import {
  doorPoint,
  layoutOf,
  routeArrival,
  routeDeparture,
  routeDivert,
  routeFinal,
  routeLanding,
  routeLineUp,
  routeRollout,
  routeTakeoff,
} from './layout';
import { angleDiff, makeSample, pathLength, samplePath, type Path } from './path';
import { spawnArrivingPax, spawnDepartingPax, releaseBoarding, sendPaxHome } from './people';
import { FUEL, WANT, type Flight, type FlightPhase, type GameState } from './types';

const SAMPLE = makeSample();

/** Seconds between arrivals at the dirt strip. */
export const ARRIVAL_GAP: readonly [number, number] = [34, 52];
/** Most flights airborne (inbound/holding) at once. */
const MAX_AIRBORNE = 3;
const HOLD_PATIENCE_S = 75;
const TAXI_SLOW_ZONE = 0.6;

/** Phases that use the runway; at most one flight may be in them. */
export function onRunway(f: Flight, L: TierLayout): boolean {
  switch (f.phase) {
    case 'landing':
    case 'rollout':
    case 'lineUp':
      return true;
    case 'takeoff':
      return f.x < L.takeoff.liftoffX + 3;
    default:
      return false;
  }
}

/** Runway is free for a new landing or a line-up (final counts as busy). */
export function runwayFree(s: GameState, self: Flight, L: TierLayout): boolean {
  for (const f of s.flights) {
    if (f === self) continue;
    if (f.phase === 'final' || onRunway(f, L)) return false;
  }
  return true;
}

function setPhase(f: Flight, phase: FlightPhase): void {
  f.phase = phase;
  f.phaseT = 0;
}

function setPath(f: Flight, path: Path): void {
  f.path = path;
  f.pathPos = 0;
}

function airborneCount(s: GameState): number {
  let n = 0;
  for (const f of s.flights) if (f.phase === 'inbound' || f.phase === 'holding') n++;
  return n;
}

export function spawnFlight(s: GameState): Flight | null {
  const L = layoutOf(s.tier);
  const choices: { al: number; ac: number[] }[] = [];
  const weights: number[] = [];
  AIRLINES.forEach((al, i) => {
    if (al.unlockTier > s.tier) return;
    const acs = al.fleet
      .map((id) => AIRCRAFT.findIndex((a) => a.id === id))
      .filter((k) => k >= 0 && AIRCRAFT[k].unlockTier <= s.tier && AIRCRAFT[k].unlockServed <= s.stats.served && AIRCRAFT[k].stand === 'small');
    if (acs.length === 0) return;
    choices.push({ al: i, ac: acs });
    weights.push(al.weight);
  });
  const pick = randWeighted(s, weights);
  if (pick < 0) return null;
  const ch = choices[pick];
  const aircraft = ch.ac[randInt(s, 0, ch.ac.length - 1)];
  const ac = AIRCRAFT[aircraft];
  const cities = CITIES.map((c, i) => ({ c, i })).filter(({ c }) => c.range <= s.tier + 1);
  const origin = cities[randInt(s, 0, cities.length - 1)].i;
  let dest = cities[randInt(s, 0, cities.length - 1)].i;
  if (dest === origin) dest = cities[(cities.findIndex((c) => c.i === origin) + 1) % cities.length].i;
  const sp = L.approach.spawns[randInt(s, 0, L.approach.spawns.length - 1)];
  const hold = L.approach.hold;
  const ang = Math.atan2(sp[1] - hold[1], sp[0] - hold[0]);
  const edge: Path = [sp[0], sp[1], sp[2], hold[0] + Math.cos(ang) * L.approach.holdRadius, hold[1] + Math.sin(ang) * L.approach.holdRadius, hold[2]];
  const heading = Math.atan2(hold[1] - sp[1], hold[0] - sp[0]);
  const f: Flight = {
    id: s.nextId++,
    airline: ch.al,
    aircraft,
    num: randInt(s, 100, 899),
    origin,
    dest,
    phase: 'inbound',
    phaseT: 0,
    x: sp[0],
    y: sp[1],
    z: sp[2],
    px: sp[0],
    py: sp[1],
    pz: sp[2],
    heading,
    speed: ac.approachSpeed * 1.2,
    path: edge,
    pathPos: 0,
    stand: -1,
    paxIn: randInt(s, ac.paxMin, ac.paxMax),
    paxOut: randInt(s, ac.paxMin, ac.paxMax),
    deboarded: 0,
    paxSpawned: 0,
    boarded: 0,
    fuelNeed: Math.round(ac.fuelLoad * randRange(s, 0.45, 0.8)),
    fuel: 0,
    fuelState: FUEL.none,
    landCleared: false,
    takeoffCleared: false,
    boardingStarted: false,
    holdAngle: ang,
    holdLevel: 0,
    patience: 1,
    mood: 0.7 + rand(s) * 0.15,
    spawnedAt: s.time,
    dockedAt: 0,
    offBlockAt: 0,
    slot: 0,
    readyAt: s.time,
    want: WANT.clearLanding,
    onTime: 0,
    paid: 0,
    paxTimer: 1.5,
  };
  s.flights.push(f);
  pushEvent(s, 'landingRequest', f.x, f.y, f.id);
  return f;
}

export function updateSpawning(s: GameState): void {
  if (s.time < s.nextArrival) return;
  if (airborneCount(s) >= MAX_AIRBORNE) {
    s.nextArrival = s.time + 5;
    return;
  }
  spawnFlight(s);
  s.nextArrival = s.time + randRange(s, ARRIVAL_GAP[0], ARRIVAL_GAP[1]);
}

/** Moves along the current path; returns true at the end. */
function follow(f: Flight, dt: number, keepHeading = false): boolean {
  f.pathPos += f.speed * dt;
  samplePath(f.path, f.pathPos, SAMPLE);
  f.x = SAMPLE.x;
  f.y = SAMPLE.y;
  f.z = SAMPLE.z;
  if (!keepHeading) f.heading = SAMPLE.heading;
  return SAMPLE.left <= 1e-6;
}

function turnToward(f: Flight, target: number, rate: number, dt: number): void {
  const d = angleDiff(f.heading, target);
  const step = rate * dt;
  f.heading += Math.abs(d) <= step ? d : Math.sign(d) * step;
}

function freeStand(s: GameState): number {
  for (let i = 0; i < s.stands.length; i++) if (s.stands[i].occupant === 0 && s.stands[i].reserved === 0) return i;
  return -1;
}

/** True when a cleared arrival may start its final approach now. */
function canStartFinal(s: GameState, f: Flight, L: TierLayout): boolean {
  if (!f.landCleared || f.stand < 0) return false;
  for (const o of s.flights) {
    if (o === f) continue;
    if (o.phase === 'final' || onRunway(o, L)) return false;
    // first come first served among cleared arrivals
    if ((o.phase === 'holding' || o.phase === 'inbound') && o.landCleared && o.id < f.id) return false;
  }
  return true;
}

function canLineUp(s: GameState, f: Flight, L: TierLayout): boolean {
  for (const o of s.flights) {
    if (o === f) continue;
    if (o.phase === 'final' || onRunway(o, L)) return false;
    // landings first
    if ((o.phase === 'holding' || o.phase === 'inbound') && o.landCleared && o.stand >= 0) return false;
    if (o.phase === 'holdShort' && o.takeoffCleared && o.id < f.id) return false;
  }
  return true;
}

function startFinal(f: Flight, L: TierLayout): void {
  const ac = AIRCRAFT[f.aircraft];
  setPhase(f, 'final');
  setPath(f, routeFinal(L, f.x, f.y, f.z, f.heading));
  f.speed = ac.approachSpeed;
}

export function divert(s: GameState, f: Flight): void {
  if (f.stand >= 0) {
    const st = s.stands[f.stand];
    if (st.reserved === f.id) st.reserved = 0;
    f.stand = -1;
  }
  f.landCleared = false;
  setPhase(f, 'diverted');
  setPath(f, routeDivert(f.x, f.y, f.z, f.heading));
  f.want = WANT.none;
  f.mood = 0;
  s.stats.diverted++;
  s.rating = nextRating(s.rating, 0);
  sendPaxHome(s, f);
  pushEvent(s, 'diverted', f.x, f.y, f.id, 0, f.id);
}

export function clearLanding(s: GameState, f: Flight): boolean {
  if ((f.phase !== 'inbound' && f.phase !== 'holding') || f.landCleared) return false;
  let st = f.stand;
  if (st < 0) st = freeStand(s);
  if (st < 0) return false;
  s.stands[st].reserved = f.id;
  f.stand = st;
  f.landCleared = true;
  f.want = WANT.none;
  if (s.time - f.readyAt < 4) f.mood = Math.min(1, f.mood + 0.04);
  pushEvent(s, 'landingCleared', f.x, f.y, f.id);
  return true;
}

function dock(s: GameState, f: Flight): void {
  const ac = AIRCRAFT[f.aircraft];
  const st = s.stands[f.stand];
  st.occupant = f.id;
  st.reserved = 0;
  f.speed = 0;
  f.dockedAt = s.time;
  f.slot = s.time + ac.baseTurnaround;
  f.readyAt = s.time;
  f.want = f.fuelState === FUEL.none ? WANT.fuel : WANT.none;
  f.paxTimer = 0.4;
  setPhase(f, 'deboarding');
  pushEvent(s, 'docked', f.x, f.y, f.id);
}

function leaveStand(s: GameState, f: Flight, L: TierLayout): void {
  const st = s.stands[f.stand];
  if (st && st.occupant === f.id) st.occupant = 0;
  f.offBlockAt = s.time;
  f.onTime = s.time <= f.slot + 3 ? 1 : -1;
  if (f.onTime > 0) {
    s.stats.onTime++;
    f.mood = Math.min(1, f.mood + 0.06);
  } else {
    s.stats.late++;
    f.mood = Math.max(0, f.mood - 0.1);
  }
  setPath(f, routeDeparture(L, f.stand));
  f.speed = AIRCRAFT[f.aircraft].taxiSpeed;
  setPhase(f, 'taxiOut');
  if (!f.takeoffCleared) {
    f.want = WANT.clearTakeoff;
    f.readyAt = s.time;
  }
}

function pay(s: GameState, f: Flight): void {
  const amount = flightRevenue(f, AIRCRAFT[f.aircraft]);
  s.money = s.money.add(amount);
  s.stats.earned = s.stats.earned.add(amount);
  s.stats.served++;
  s.stats.pax += f.boarded + f.deboarded;
  s.rating = nextRating(s.rating, f.mood);
  f.paid = amount.toNumber();
  pushEvent(s, 'paid', f.x, f.y, amount.m, amount.e, f.id);
}

/** Ground waiting for the player makes passengers grumpy. */
function waitingDrain(s: GameState, f: Flight, dt: number): void {
  if (f.want !== WANT.none && s.time - f.readyAt > 3) f.mood = Math.max(0, f.mood - 0.012 * dt);
}

export function updateFlights(s: GameState, dt: number): void {
  const L = layoutOf(s.tier);
  let w = 0;
  for (let i = 0; i < s.flights.length; i++) {
    const f = s.flights[i];
    f.px = f.x;
    f.py = f.y;
    f.pz = f.z;
    f.phaseT += dt;
    const keep = updateFlight(s, f, dt, L);
    if (keep) s.flights[w++] = f;
  }
  s.flights.length = w;
}

/** Returns false when the flight leaves the game. */
function updateFlight(s: GameState, f: Flight, dt: number, L: TierLayout): boolean {
  const ac = AIRCRAFT[f.aircraft];
  switch (f.phase) {
    case 'inbound': {
      if (f.landCleared && canStartFinal(s, f, L) && f.phaseT > 1) {
        startFinal(f, L);
        return true;
      }
      if (follow(f, dt)) {
        setPhase(f, 'holding');
        const h = L.approach.hold;
        f.holdAngle = Math.atan2(f.y - h[1], f.x - h[0]);
        let level = 0;
        for (const o of s.flights) if (o !== f && o.phase === 'holding' && o.holdLevel === level) level++;
        f.holdLevel = level;
      }
      return true;
    }
    case 'holding': {
      const h = L.approach.hold;
      const R = L.approach.holdRadius;
      f.speed = ac.approachSpeed;
      f.holdAngle += (f.speed / R) * dt;
      const tx = h[0] + Math.cos(f.holdAngle) * R;
      const ty = h[1] + Math.sin(f.holdAngle) * R;
      const tz = h[2] + f.holdLevel * 0.7;
      // ease onto the circle
      const k = Math.min(1, dt * 2.5);
      f.x += (tx - f.x) * k;
      f.y += (ty - f.y) * k;
      f.z += (tz - f.z) * k;
      turnToward(f, f.holdAngle + Math.PI / 2, 3, dt);
      if (!f.landCleared) {
        f.patience -= dt / HOLD_PATIENCE_S;
        f.mood = Math.max(0, f.mood - 0.006 * dt);
      } else {
        f.patience -= dt / (HOLD_PATIENCE_S * 2.5);
      }
      if (f.patience <= 0) {
        f.patience = 0;
        divert(s, f);
        return true;
      }
      if (canStartFinal(s, f, L)) startFinal(f, L);
      return true;
    }
    case 'final': {
      if (follow(f, dt)) {
        setPhase(f, 'landing');
        setPath(f, routeLanding(L));
      }
      return true;
    }
    case 'landing': {
      f.speed = ac.approachSpeed * 0.92;
      if (follow(f, dt)) {
        setPhase(f, 'rollout');
        setPath(f, routeRollout(L));
        f.z = 0;
        pushEvent(s, 'touchdown', f.x, f.y, f.id);
      }
      return true;
    }
    case 'rollout': {
      const len = pathLength(f.path);
      const t = Math.min(1, f.pathPos / Math.max(0.01, len));
      f.speed = ac.approachSpeed * 0.85 * (1 - t) + ac.taxiSpeed * t;
      if (follow(f, dt)) {
        setPhase(f, 'taxiIn');
        setPath(f, routeArrival(L, f.stand));
        f.speed = ac.taxiSpeed;
      }
      return true;
    }
    case 'taxiIn': {
      samplePath(f.path, f.pathPos, SAMPLE);
      f.speed = ac.taxiSpeed * Math.max(0.3, Math.min(1, SAMPLE.left / TAXI_SLOW_ZONE));
      if (follow(f, dt)) dock(s, f);
      return true;
    }
    case 'deboarding': {
      waitingDrain(s, f, dt);
      f.paxTimer -= dt;
      if (f.deboarded < f.paxIn && f.paxTimer <= 0) {
        const door = doorPoint(L, f.aircraft, f.x, f.y, f.heading);
        spawnArrivingPax(s, f, door[0], door[1]);
        f.deboarded++;
        f.paxTimer = 0.55;
      }
      if (f.deboarded >= f.paxIn && f.paxTimer <= 0) setPhase(f, 'turnaround');
      return true;
    }
    case 'turnaround': {
      waitingDrain(s, f, dt);
      if (f.fuelState === FUEL.done && !f.boardingStarted && f.want !== WANT.board) {
        f.want = WANT.board;
        f.readyAt = s.time;
      }
      return true;
    }
    case 'boarding': {
      releaseBoarding(s, f, dt, L);
      if (f.boarded >= f.paxSpawned && f.paxSpawned >= f.paxOut) {
        setPhase(f, 'doorsClosed');
        pushEvent(s, 'boardingDone', f.x, f.y, f.id);
      }
      return true;
    }
    case 'doorsClosed': {
      if (f.phaseT >= 1.2) leaveStand(s, f, L);
      return true;
    }
    case 'taxiOut': {
      if (f.takeoffCleared && canLineUp(s, f, L)) {
        // keep rolling straight onto the runway
        if (follow(f, dt)) beginLineUp(f, L);
        return true;
      }
      samplePath(f.path, f.pathPos, SAMPLE);
      f.speed = ac.taxiSpeed * Math.max(0.3, Math.min(1, SAMPLE.left / TAXI_SLOW_ZONE));
      if (follow(f, dt)) {
        setPhase(f, 'holdShort');
        f.speed = 0;
        if (!f.takeoffCleared) pushEvent(s, 'takeoffRequest', f.x, f.y, f.id);
      }
      return true;
    }
    case 'holdShort': {
      waitingDrain(s, f, dt);
      if (f.takeoffCleared && canLineUp(s, f, L)) beginLineUp(f, L);
      return true;
    }
    case 'lineUp': {
      f.speed = ac.taxiSpeed * 0.8;
      if (follow(f, dt)) {
        setPhase(f, 'takeoff');
        setPath(f, routeTakeoff(L));
        f.speed = ac.taxiSpeed * 0.6;
      }
      return true;
    }
    case 'takeoff': {
      const vmax = ac.approachSpeed * 1.25;
      f.speed = Math.min(vmax, f.speed + 0.75 * dt);
      const wasGround = f.z <= 0.001;
      const end = follow(f, dt);
      if (wasGround && f.z > 0.001) {
        pay(s, f);
        pushEvent(s, 'liftoff', f.x, f.y, f.id);
      }
      return !end;
    }
    case 'diverted': {
      f.speed = ac.approachSpeed * 1.2;
      return !follow(f, dt);
    }
  }
  return true;
}

function beginLineUp(f: Flight, L: TierLayout): void {
  setPhase(f, 'lineUp');
  setPath(f, routeLineUp(L));
  f.want = WANT.none;
}

export function clearTakeoff(s: GameState, f: Flight): boolean {
  if ((f.phase !== 'taxiOut' && f.phase !== 'holdShort') || f.takeoffCleared) return false;
  f.takeoffCleared = true;
  f.want = WANT.none;
  if (s.time - f.readyAt < 4) f.mood = Math.min(1, f.mood + 0.03);
  pushEvent(s, 'takeoffCleared', f.x, f.y, f.id);
  return true;
}

export function startBoarding(s: GameState, f: Flight): boolean {
  if (f.phase !== 'turnaround' || f.fuelState !== FUEL.done || f.boardingStarted) return false;
  f.boardingStarted = true;
  f.want = WANT.none;
  if (s.time - f.readyAt < 4) f.mood = Math.min(1, f.mood + 0.04);
  f.paxTimer = 0;
  setPhase(f, 'boarding');
  pushEvent(s, 'boardingStart', f.x, f.y, f.id);
  return true;
}

/** Departing passengers trickle out of the hut while the flight is around. */
export function updateDepartingPax(s: GameState): void {
  const L = layoutOf(s.tier);
  for (const f of s.flights) {
    if (f.phase === 'diverted' || f.paxSpawned >= f.paxOut) continue;
    if (f.phase === 'taxiOut' || f.phase === 'holdShort' || f.phase === 'lineUp' || f.phase === 'takeoff') continue;
    // one passenger every 0.9 s, starting a second after the flight appears
    const due = Math.floor((s.time - f.spawnedAt - 1) / 0.9) + 1;
    if (due > f.paxSpawned) {
      spawnDepartingPax(s, f, L);
      f.paxSpawned++;
    }
  }
}
