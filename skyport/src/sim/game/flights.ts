/** Flight lifecycle: spawn, approach, landing, taxi (graph), turnaround, departure. */
import { AIRCRAFT, planeArt } from '../../data/aircraft';
import { AIRLINES } from '../../data/airlines';
import { CITIES } from '../../data/cities';
import { tierDef, type TierLayout } from '../../data/tiers';
import { rand, randInt, randRange, randWeighted } from '../rng';
import { flightRevenue, nextRating } from './economy';
import { recordIncome } from './income';
import { effects } from './upgrades';
import { pushEvent } from './events';
import { canEnter, findRoute, firstSafe, graphOf, groundMove, releaseAll, releaseEdge, routeGeometry, tryReserve, tryReserveRun } from './graph';
import { doorPoint, layoutOf, routeDivert, routeFinal, routeLanding, routeLineUp, routeRollout, routeTakeoff } from './layout';
import { angleDiff, makeSample, pathLength, samplePath, type Path } from './path';
import { releaseBoarding, sendPaxHome, spawnArrivingPax, spawnDepartingPax } from './people';
import { FUEL, WANT, type Flight, type FlightPhase, type GameState, type Want } from './types';

const SAMPLE = makeSample();

/** Seconds between arrivals at the dirt strip (divided by traffic). */
export const ARRIVAL_GAP: readonly [number, number] = [34, 52];
const HOLD_PATIENCE_S = 75;
/** Order in which a tap on the plane handles pending actions. */
const WANT_ORDER: readonly Want[] = [WANT.clearLanding, WANT.bags, WANT.fuel, WANT.board, WANT.clearTakeoff];

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

export function isGround(f: Flight): boolean {
  return f.z <= 0.001 && f.phase !== 'final' && f.phase !== 'holding' && f.phase !== 'inbound' && f.phase !== 'diverted';
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
  const paxIn = randInt(s, ac.paxMin, ac.paxMax);
  const paxOut = randInt(s, ac.paxMin, ac.paxMax);
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
    heading: Math.atan2(hold[1] - sp[1], hold[0] - sp[0]),
    speed: ac.approachSpeed * 1.2,
    path: edge,
    pathPos: 0,
    stand: -1,
    paxIn,
    paxOut,
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
    mood: Math.min(1, 0.7 + rand(s) * 0.15 + effects(s).comfort),
    spawnedAt: s.time,
    dockedAt: 0,
    offBlockAt: 0,
    slot: 0,
    readyAt: s.time,
    want: WANT.clearLanding,
    onTime: 0,
    paid: 0,
    paxTimer: 1.5,
    wants: 1 << WANT.clearLanding,
    // one checked bag per passenger, a few extra on bigger planes (no RNG: keeps old games identical)
    bagsIn: paxIn + Math.floor(paxIn / 4),
    bagsOut: paxOut + Math.floor(paxOut / 4),
    bagState: FUEL.none,
    bagWork: 0,
    bagsChecked: 0,
    lostBags: 0,
    groute: null,
    gIdx: 0,
    gHeld: [],
    gStart: -1,
    gWaiting: false,
  };
  s.flights.push(f);
  pushEvent(s, 'landingRequest', f.x, f.y, f.id);
  return f;
}

export function updateSpawning(s: GameState): void {
  if (s.time < s.nextArrival) return;
  if (airborneCount(s) >= s.standsBuilt + 2) {
    s.nextArrival = s.time + 5;
    return;
  }
  spawnFlight(s);
  const t = Math.max(0.2, s.traffic * effects(s).traffic * tierDef(s.tier).traffic);
  s.nextArrival = s.time + randRange(s, ARRIVAL_GAP[0], ARRIVAL_GAP[1]) / t;
}

/** Follows f.path (air / runway legs); returns true at the end. */
function follow(f: Flight, dt: number): boolean {
  f.pathPos += f.speed * dt;
  samplePath(f.path, f.pathPos, SAMPLE);
  f.x = SAMPLE.x;
  f.y = SAMPLE.y;
  f.z = SAMPLE.z;
  f.heading = SAMPLE.heading;
  return SAMPLE.left <= 1e-6;
}

function placeOnRoute(f: Flight): void {
  if (!f.groute) return;
  samplePath(f.groute.path, f.pathPos, SAMPLE);
  f.x = SAMPLE.x;
  f.y = SAMPLE.y;
  f.z = 0;
  if (f.pathPos > 0.001) f.heading = SAMPLE.heading;
}

function turnToward(f: Flight, target: number, rate: number, dt: number): void {
  const d = angleDiff(f.heading, target);
  const step = rate * dt;
  f.heading += Math.abs(d) <= step ? d : Math.sign(d) * step;
}

export function freeStand(s: GameState): number {
  for (let i = 0; i < Math.min(s.standsBuilt, s.stands.length); i++) if (s.stands[i].occupant === 0 && s.stands[i].reserved === 0) return i;
  return -1;
}

/** True when a cleared arrival may start its final approach now. */
function canStartFinal(s: GameState, f: Flight, L: TierLayout): boolean {
  if (!f.landCleared || f.stand < 0 || s.tierSwitch) return false;
  for (const o of s.flights) {
    if (o === f) continue;
    if (o.phase === 'final' || onRunway(o, L)) return false;
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

function startFinal(f: Flight, L: TierLayout, speedMul = 1): void {
  setPhase(f, 'final');
  setPath(f, routeFinal(L, f.x, f.y, f.z, f.heading));
  f.speed = AIRCRAFT[f.aircraft].approachSpeed * speedMul;
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
  f.mood = 0;
  s.stats.diverted++;
  s.rating = nextRating(s.rating, 0);
  sendPaxHome(s, f);
  pushEvent(s, 'diverted', f.x, f.y, f.id, 0, f.id);
}

export function clearLanding(s: GameState, f: Flight): boolean {
  if ((f.phase !== 'inbound' && f.phase !== 'holding') || f.landCleared || s.tierSwitch) return false;
  let st = f.stand;
  if (st < 0) st = freeStand(s);
  if (st < 0) return false;
  s.stands[st].reserved = f.id;
  f.stand = st;
  f.landCleared = true;
  if (s.time - f.readyAt < 4) f.mood = Math.min(1, f.mood + 0.04);
  pushEvent(s, 'landingCleared', f.x, f.y, f.id);
  return true;
}

function tailClear(f: Flight): number {
  return planeArt(f.aircraft).length * 0.5 + 0.35;
}

function beginArrivalRoute(s: GameState, f: Flight): void {
  const g = graphOf(s.tier);
  const route = findRoute(g, g.exit, g.standNode[f.stand]);
  if (!route) throw new Error('no route to stand');
  f.groute = routeGeometry(g, route);
  f.gIdx = 0;
  f.gStart = -1;
}

function dock(s: GameState, f: Flight): void {
  const g = graphOf(s.tier);
  const ac = AIRCRAFT[f.aircraft];
  const st = s.stands[f.stand];
  st.occupant = f.id;
  st.reserved = 0;
  // the stand edge is no longer needed; keep the stand node while parked
  for (const e of f.gHeld.slice()) releaseEdge(s, f, e);
  s.nodeHold[g.standNode[f.stand]] = f.id;
  f.groute = null;
  f.speed = 0;
  f.dockedAt = s.time;
  f.slot = s.time + ac.baseTurnaround;
  f.paxTimer = 0.4;
  setPhase(f, 'deboarding');
  pushEvent(s, 'docked', f.x, f.y, f.id);
}

/** Tries to start taxiing out; false while the taxiway ahead is taken. */
function tryLeaveStand(s: GameState, f: Flight): boolean {
  const g = graphOf(s.tier);
  const from = g.standNode[f.stand];
  const route = findRoute(g, from, g.holdShort);
  if (!route) return false;
  // never stop on the shared lane: take the whole stretch up to a waiting spot at once
  const k = firstSafe(g, route);
  if (!tryReserveRun(s, f, route, k < 0 ? route.length - 1 : k)) {
    f.gWaiting = true;
    return false;
  }
  f.gWaiting = false;
  f.groute = routeGeometry(g, route, [f.x, f.y]);
  f.gIdx = 0;
  f.gStart = from;
  f.pathPos = 0;
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
  f.speed = 0;
  setPhase(f, 'taxiOut');
  return true;
}

function pay(s: GameState, f: Flight): void {
  const rev = flightRevenue(f, AIRCRAFT[f.aircraft], effects(s), tierDef(s.tier).pay);
  const amount = rev.total;
  recordIncome(s, amount.toNumber(), rev.parts, f.boarded);
  s.money = s.money.add(amount);
  s.stats.earned = s.stats.earned.add(amount);
  s.stats.served++;
  s.stats.pax += f.boarded + f.deboarded;
  s.rating = nextRating(s.rating, f.mood);
  f.paid = amount.toNumber();
  pushEvent(s, 'paid', f.x, f.y, amount.m, amount.e, f.id);
}

/** Recomputes what the flight is waiting for (bitmask + the top action). */
export function refreshWants(s: GameState, f: Flight): void {
  let w = 0;
  const p = f.phase;
  if ((p === 'inbound' || p === 'holding') && !f.landCleared) w |= 1 << WANT.clearLanding;
  const atStand = p === 'deboarding' || p === 'turnaround' || p === 'boarding';
  if (atStand && f.bagState === FUEL.none) w |= 1 << WANT.bags;
  if ((p === 'deboarding' || p === 'turnaround') && f.fuelState === FUEL.none) w |= 1 << WANT.fuel;
  if (p === 'turnaround' && f.fuelState === FUEL.done && !f.boardingStarted) w |= 1 << WANT.board;
  if ((p === 'taxiOut' || p === 'holdShort') && !f.takeoffCleared) w |= 1 << WANT.clearTakeoff;
  if (w & ~f.wants) f.readyAt = s.time;
  f.wants = w;
  f.want = WANT.none;
  for (const k of WANT_ORDER) {
    if (w & (1 << k)) {
      f.want = k;
      break;
    }
  }
}

export function wantsAction(f: Flight, w: Want): boolean {
  return (f.wants & (1 << w)) !== 0;
}

/** Waiting for the player (or for the taxiway) makes passengers grumpy. */
function waitingDrain(s: GameState, f: Flight, dt: number): void {
  if ((f.want !== WANT.none && s.time - f.readyAt > 3) || f.gWaiting) f.mood = Math.max(0, f.mood - 0.012 * dt);
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
    if (keep) {
      refreshWants(s, f);
      s.flights[w++] = f;
    } else {
      releaseAll(s, f);
    }
  }
  s.flights.length = w;
}

/** Returns false when the flight leaves the game. */
function updateFlight(s: GameState, f: Flight, dt: number, L: TierLayout): boolean {
  const base = AIRCRAFT[f.aircraft];
  const fx = effects(s);
  // upgrades: smoother taxiways and runway lights speed things up
  const ac = { ...base, taxiSpeed: base.taxiSpeed * fx.taxiSpeed, approachSpeed: base.approachSpeed * fx.runwayOps };
  switch (f.phase) {
    case 'inbound': {
      if (f.landCleared && canStartFinal(s, f, L) && f.phaseT > 1) {
        startFinal(f, L, fx.runwayOps);
        return true;
      }
      if (follow(f, dt)) {
        setPhase(f, 'holding');
        const h = L.approach.hold;
        f.holdAngle = Math.atan2(f.y - h[1], f.x - h[0]);
        let level = 0;
        while (s.flights.some((o) => o !== f && o.phase === 'holding' && o.holdLevel === level)) level++;
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
      if (canStartFinal(s, f, L)) startFinal(f, L, fx.runwayOps);
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
        beginArrivalRoute(s, f);
        pushEvent(s, 'touchdown', f.x, f.y, f.id);
      }
      return true;
    }
    case 'rollout': {
      const len = pathLength(f.path);
      const left = len - f.pathPos;
      const t = Math.min(1, f.pathPos / Math.max(0.01, len));
      let v = ac.approachSpeed * 0.85 * (1 - t) + ac.taxiSpeed * t;
      const first = f.groute ? f.groute.edges[0] : -1;
      // leave the runway only onto a taxiway we hold; otherwise stop at the exit
      if (first >= 0 && left < 2.4 && !f.gHeld.includes(first) && !tryReserve(s, f, first)) {
        v = Math.min(v, Math.max(0, left) * 1.2);
        f.gWaiting = true;
      } else f.gWaiting = false;
      f.speed = v;
      if (follow(f, dt)) {
        if (first >= 0 && !f.gHeld.includes(first) && !canEnter(s, f, first)) return true;
        setPhase(f, 'taxiIn');
        f.pathPos = 0;
        f.speed = ac.taxiSpeed;
      }
      return true;
    }
    case 'taxiIn': {
      if (groundMove(s, f, dt, ac.taxiSpeed, tailClear(f))) dock(s, f);
      else placeOnRoute(f);
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
      return true;
    }
    case 'boarding': {
      waitingDrain(s, f, dt);
      releaseBoarding(s, f, dt, L);
      if (f.boarded >= f.paxSpawned && f.paxSpawned >= f.paxOut && f.bagState === FUEL.done) {
        setPhase(f, 'doorsClosed');
        pushEvent(s, 'boardingDone', f.x, f.y, f.id);
      }
      return true;
    }
    case 'doorsClosed': {
      if (f.phaseT >= 1.2) {
        if (!tryLeaveStand(s, f)) waitingDrain(s, f, dt);
      }
      return true;
    }
    case 'taxiOut': {
      const arrived = groundMove(s, f, dt, ac.taxiSpeed, tailClear(f));
      placeOnRoute(f);
      if (arrived) {
        if (f.takeoffCleared && canLineUp(s, f, L)) beginLineUp(f, L);
        else {
          setPhase(f, 'holdShort');
          f.speed = 0;
          if (!f.takeoffCleared) pushEvent(s, 'takeoffRequest', f.x, f.y, f.id);
        }
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
        releaseAll(s, f);
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
  f.groute = null;
  setPhase(f, 'lineUp');
  setPath(f, routeLineUp(L));
}

export function clearTakeoff(s: GameState, f: Flight): boolean {
  if ((f.phase !== 'taxiOut' && f.phase !== 'holdShort') || f.takeoffCleared) return false;
  f.takeoffCleared = true;
  if (s.time - f.readyAt < 4) f.mood = Math.min(1, f.mood + 0.03);
  pushEvent(s, 'takeoffCleared', f.x, f.y, f.id);
  return true;
}

export function startBoarding(s: GameState, f: Flight): boolean {
  if (f.phase !== 'turnaround' || f.fuelState !== FUEL.done || f.boardingStarted) return false;
  f.boardingStarted = true;
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
    const due = Math.floor((s.time - f.spawnedAt - 1) / 0.9) + 1;
    if (due > f.paxSpawned) {
      spawnDepartingPax(s, f, L);
      f.paxSpawned++;
    }
  }
}
