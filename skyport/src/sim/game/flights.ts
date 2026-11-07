/** Flight lifecycle: spawn, approach, landing, taxi (graph), turnaround, departure. */
import { AIRCRAFT, paxGroupOf, planeArt, standFits } from '../../data/aircraft';
import { AIRLINES } from '../../data/airlines';
import { CITIES } from '../../data/cities';
import { EXHIBIT_SECONDS } from '../../data/incidents';
import { tierDef, type TierLayout } from '../../data/tiers';
import { rand, randInt, randRange, randWeighted } from '../rng';
import { hash01, hashU32 } from '../hash';
import { storeActive } from './supplies';
import { bussed } from './buses';
import { hangarFaultFactor, startCheck, updateChecks } from './maintenance';
import { airportDisrupted, airportPaused, birdCheck, boostPax, runwayBlocked, stormActive, vipTip } from './incidents';
import { airlineFlightDone, contractOf, dueArrival, fleetForRep, fleetHere, kindOf, refillSchedule, updateGuests } from './airlines';
import { flightRevenue, nextRating } from './economy';
import { recordIncome } from './income';
import { effects, effectValue } from './upgrades';
import { CROSSWIND_LIMIT, crosswind, foggedIn, weather } from './weather';
import { pushEvent } from './events';
import { canEnter, findRoute, flowOf, safeRunEnd, graphOf, groundMove, releaseAll, releaseEdge, routeGeometry, tryReserve, tryReserveRun } from './graph';
import { doorPoint, gatePoint, layoutOf, opsOf, routeDivert, routeFinal, routeLanding, routeLineUp, routeRollout, routeTakeoff } from './layout';
import { angleDiff, chaikin, makeSample, pathLength, samplePath, type Path } from './path';
import { releaseBoarding, sendPaxHome, spawnArrivingPax, spawnDepartingPax } from './people';
import { cleanliness } from './cleaning';
import { maybeReview } from './reviews';
import { Big } from '../big';
import { incomeBoost } from './career';
import { FUEL, WANT, type Flight, type FlightPhase, type GameState, type Planned, type Want } from './types';

/** How much a passenger's mood drops for a terminal that is a mess (at 0 cleanliness). */
const DIRT_MOOD = 0.14;

const SAMPLE = makeSample();

/** Typical seconds between arrivals of the old single-airline traffic (reference for tests). */
export const ARRIVAL_GAP: readonly [number, number] = [34, 52];
const MIN_SPAWN_GAP = 4;
const HOLD_PATIENCE_S = 75;

/** Big jets carry more fuel, and radar keeps the stack orderly: both let planes circle longer. */
function holdFuel(s: GameState, f: Flight): number {
  return (1 + wakeCat(f) * 0.3) * (1 + effectValue(s, 'radar'));
}
/** Order in which a tap on the plane handles pending actions. */
const WANT_ORDER: readonly Want[] = [WANT.clearLanding, WANT.repair, WANT.bags, WANT.fuel, WANT.board, WANT.clearTakeoff];

export function isHeli(f: Flight): boolean {
  return AIRCRAFT[f.aircraft]?.stand === 'heli';
}

/**
 * Which runway the flight is on right now: 1 = the landing runway, 2 = the
 * departures runway (when the layout has one), 0 = none. Helicopters never are.
 */
export function runwayOf(f: Flight, L: TierLayout): number {
  if (isHeli(f)) return 0;
  const dep = L.depRunway ? 2 : 1;
  switch (f.phase) {
    case 'landing':
    case 'rollout':
      return 1;
    case 'lineUp':
      return dep;
    case 'takeoff': {
      const lift = opsOf(L, f.dir).takeoff.liftoffX;
      return (f.dir < 0 ? f.x > lift - 3 : f.x < lift + 3) ? dep : 0;
    }
    default:
      return 0;
  }
}

/** On a runway: at most one flight per runway at any time. */
export function onRunway(f: Flight, L: TierLayout): boolean {
  return runwayOf(f, L) !== 0;
}

const WAKE_CAT: Record<string, number> = { light: 0, medium: 1, heavy: 2, super: 3 };
/** Seconds a follower (column) waits behind a leader (row) on the same runway. */
export const WAKE_GAP: readonly (readonly number[])[] = [
  [0, 0, 0, 0],
  [6, 3, 0, 0],
  [10, 8, 5, 0],
  [14, 12, 10, 6],
];

export function wakeCat(f: Flight): number {
  return WAKE_CAT[AIRCRAFT[f.aircraft]?.wake ?? 'light'] ?? 0;
}

/** Time after which this flight may use runway r behind the last plane that stirred the air there. */
export function wakeClearAt(s: GameState, r: number, f: Flight): number {
  const w = s.wake[r - 1];
  if (!w) return 0;
  // a better tower spaces planes tighter
  const tower = Math.max(0.5, 1 - effectValue(s, 'tower'));
  return w.at + WAKE_GAP[w.cat][wakeCat(f)] * tower;
}

function stirWake(s: GameState, r: number, f: Flight): void {
  s.wake[r - 1] = { cat: wakeCat(f), at: s.time };
}

export function isGround(f: Flight): boolean {
  return f.z <= 0.001 && f.phase !== 'final' && f.phase !== 'holding' && f.phase !== 'inbound' && f.phase !== 'diverted' && f.phase !== 'goAround';
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

/**
 * Creates an arriving flight: from a planned schedule entry, or (tests) from
 * a contracted airline picked by how often it flies.
 */
export function spawnFlight(s: GameState, planned?: Planned): Flight | null {
  const L = layoutOf(s.tier);
  let al = planned?.al ?? -1;
  if (al < 0) {
    const pool = s.contracts.length > 0 ? s.contracts.map((c) => c.al) : AIRLINES.map((_, i) => i).filter((i) => AIRLINES[i].unlockTier <= s.tier);
    const ok = pool.filter((i) => fleetHere(s, i).length > 0);
    const pick = randWeighted(s, ok.map((i) => contractOf(s, i)?.perDay ?? AIRLINES[i].weight));
    if (pick < 0) return null;
    al = ok[pick];
  }
  const fleet = fleetForRep(s, al);
  if (fleet.length === 0 && planned?.ac === undefined) return null;
  // (a special visitor brings its own plane; the roll still happens so the dice stay in step)
  const rolled = fleet.length > 0 ? fleet[randInt(s, 0, fleet.length - 1)] : -1;
  const aircraft = planned?.ac ?? rolled;
  const ac = AIRCRAFT[aircraft];
  const cities = CITIES.map((c, i) => ({ c, i })).filter(({ c }) => c.range <= s.tier + 1);
  const rolledOrigin = cities[randInt(s, 0, cities.length - 1)].i;
  const origin = planned ? planned.origin : rolledOrigin;
  let dest = cities[randInt(s, 0, cities.length - 1)].i;
  const rolledNum = randInt(s, 100, 899);
  if (dest === origin) dest = cities[(cities.findIndex((c) => c.i === origin) + 1) % cities.length].i;
  if (planned) dest = planned.dest;
  // arrivals come in from the side the wind sends them to
  const appr = opsOf(L, s.rwyDir).approach;
  const sp = appr.spawns[randInt(s, 0, appr.spawns.length - 1)];
  const hold = appr.hold;
  const ang = Math.atan2(sp[1] - hold[1], sp[0] - hold[0]);
  const edge: Path = [sp[0], sp[1], sp[2], hold[0] + Math.cos(ang) * appr.holdRadius, hold[1] + Math.sin(ang) * appr.holdRadius, hold[2]];
  // (weekends, holidays and a buzz: fuller planes)
  const paxIn = boostPax(s, randInt(s, ac.paxMin, ac.paxMax), ac.paxMax);
  const paxOut = boostPax(s, randInt(s, ac.paxMin, ac.paxMax), ac.paxMax);
  const f: Flight = {
    id: s.nextId++,
    airline: al,
    aircraft,
    num: planned ? planned.num : rolledNum,
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
    // one checked bag per passenger, a few extra on bigger planes (no RNG: keeps old games identical);
    // freighters carry pallets instead
    bagsIn: ac.paxMax === 0 ? 60 : paxIn + Math.floor(paxIn / 4),
    bagsOut: ac.paxMax === 0 ? 60 : paxOut + Math.floor(paxOut / 4),
    bagState: FUEL.none,
    bagWork: 0,
    bagsChecked: 0,
    lostBags: 0,
    groute: null,
    gIdx: 0,
    gHeld: [],
    gStart: -1,
    gWaiting: false,
    sched: planned?.at ?? s.time,
    dir: opsOf(L, s.rwyDir).dir,
    guest: false,
    goArounds: 0,
    aog: 0,
    repState: 0,
    repWork: 0,
    repNeed: 0,
    repParts: 0,
    partWait: false,
    check: 0,
    emergency: false,
    vip: false,
    vipGood: false,
    birdHit: false,
    medical: false,
    celeb: false,
    historic: false,
    holdUntil: 0,
    payMul: contractOf(s, al)?.pay ?? 1,
  };
  s.flights.push(f);
  pushEvent(s, 'landingRequest', f.x, f.y, f.id);
  return f;
}

/** Arrivals come from the schedule; a full sky delays them (they show as delayed on the board). */
export function updateSpawning(s: GameState): void {
  refillSchedule(s);
  updateGuests(s, (p) => spawnFlight(s, p));
  updateChecks(s, (p) => spawnFlight(s, p));
  if (s.time < s.nextArrival) return;
  const p = dueArrival(s);
  if (!p) return;
  if (airborneCount(s) >= s.standsBuilt + 2 + Math.round(effectValue(s, 'radar') * 4) || s.tierSwitch) {
    s.nextArrival = s.time + 5;
    return;
  }
  s.schedule.shift();
  spawnFlight(s, p);
  // two planes never pop up in the same second
  s.nextArrival = s.time + MIN_SPAWN_GAP;
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

const SIZE_RANK: Record<string, number> = { small: 0, fbo: 0, heli: 0, medium: 1, large: 2, cargo: 2, huge: 3, hugeX: 4 };

/**
 * A free, built stand the aircraft fits on: the smallest that fits (big stands
 * stay free for big planes), then the first in layout order. -1 when none.
 */
export function freeStand(s: GameState, aircraft = 0): number {
  const L = layoutOf(s.tier);
  const need = AIRCRAFT[aircraft]?.stand ?? 'small';
  const taxi = AIRCRAFT[aircraft]?.category === 'evtol';
  let best = -1;
  for (let i = 0; i < Math.min(L.stands.length, s.stands.length); i++) {
    if (!s.standOpen[i] || s.stands[i].occupant !== 0 || s.stands[i].reserved !== 0 || L.stands[i].hangar) continue;
    if (!standFits(L.stands[i].size, need) || (L.stands[i].exact && L.stands[i].size !== need)) continue;
    // (jet-bridge gates are for the airliners: a small plane waits for a stand of its size rather than block one)
    if (L.stands[i].bridge && SIZE_RANK[need] < SIZE_RANK.large) continue;
    // (air taxis go to the vertiport pads first, helicopters to the helipad)
    const pref = (k: number) => SIZE_RANK[L.stands[k].size] * 2 + ((L.stands[k].line === 'vertiport') === taxi ? 0 : 1);
    if (best < 0 || pref(i) < pref(best)) best = i;
  }
  return best;
}

/** True when a cleared arrival may start its final approach now. */
/**
 * Why a cleared plane can't start its approach right now (null = it can):
 * fog the ILS can't handle, too much crosswind for its size, wake turbulence,
 * or the runway in use.
 */
export function approachBlocker(s: GameState, f: Flight): 'fog' | 'storm' | 'closed' | 'crosswind' | 'turn' | 'wake' | 'runway' | null {
  if (foggedIn(s)) return 'fog';
  if (stormActive(s)) return 'storm';
  if (!isHeli(f) && runwayBlocked(s, 1)) return 'closed';
  const w = weather(s);
  if (!isHeli(f) && crosswind(w) > CROSSWIND_LIMIT[wakeCat(f)]) return 'crosswind';
  if (isHeli(f)) return null;
  if (s.turning) return 'turn';
  if (s.time < wakeClearAt(s, 1, f)) return 'wake';
  const L = layoutOf(s.tier);
  for (const o of s.flights) {
    if (o === f || isHeli(o)) continue;
    if (o.phase === 'final' || runwayOf(o, L) === 1) return 'runway';
  }
  return null;
}

/** Fog and crosswind permitting, could this plane land now? */
function weatherLetsIn(s: GameState, f: Flight): boolean {
  if (foggedIn(s)) return false;
  return isHeli(f) || crosswind(weather(s)) <= CROSSWIND_LIMIT[wakeCat(f)];
}

/** Lands before everyone else: an emergency, or a medical case (PAN-PAN). */
function priority(f: Flight): boolean {
  return f.emergency || f.medical;
}

function canStartFinal(s: GameState, f: Flight, L: TierLayout): boolean {
  if (!f.landCleared || f.stand < 0 || s.tierSwitch) return false;
  if (!weatherLetsIn(s, f)) return false;
  // lightning: nobody flies; a closed runway: nobody lands on it (the helipad is elsewhere)
  if (stormActive(s) || (!isHeli(f) && runwayBlocked(s, 1))) return false;
  // an emergency (or a sick passenger) lands first
  if (!priority(f) && s.flights.some((o) => priority(o) && o.landCleared && (o.phase === 'holding' || o.phase === 'inbound'))) return false;
  // a helicopter flies straight to its pad
  if (isHeli(f)) return true;
  // the runway is being turned around: hold until it is done
  if (s.turning) return false;
  if (s.time < wakeClearAt(s, 1, f)) return false;
  let lead = -1;
  for (const o of s.flights) {
    if (o === f || isHeli(o)) continue;
    if (o.phase === 'final' || o.phase === 'landing') return false;
    // the tower may clear the next approach while the last plane is still rolling out,
    // if it should be off the runway in time (if not: a go-around)
    if (o.phase === 'rollout' && !o.gWaiting) {
      if (lead < 0) lead = timeToThreshold(s, f, L);
      if (rolloutLeft(o) < lead * 0.7) continue;
    }
    if (runwayOf(o, L) === 1) return false;
    if ((o.phase === 'holding' || o.phase === 'inbound') && o.landCleared && o.id < f.id) return false;
  }
  return true;
}

/** Seconds a plane still needs to roll out and leave the runway (rough, on the safe side). */
function rolloutLeft(o: Flight): number {
  // it keeps slowing down to taxi speed, and its tail still has to clear the runway edge
  const v = (o.speed + AIRCRAFT[o.aircraft].taxiSpeed) / 2;
  return (pathLength(o.path) - o.pathPos) / Math.max(0.5, v) + 3;
}

/** Seconds from here to the runway threshold on a new approach (rough). */
function timeToThreshold(s: GameState, f: Flight, L: TierLayout): number {
  return pathLength(routeFinal(L, f.x, f.y, f.z, f.heading, s.rwyDir)) / Math.max(0.5, AIRCRAFT[f.aircraft].approachSpeed);
}

/**
 * At the threshold: is the runway clear, and is the approach stable? Crosswind
 * near the limit and thick fog make a missed approach likelier; a better tower less so.
 */
export function mustGoAround(s: GameState, f: Flight, L: TierLayout): boolean {
  if (runwayBlocked(s, 1)) return true;
  for (const o of s.flights) {
    if (o === f || isHeli(o)) continue;
    if (runwayOf(o, L) === 1) return true;
  }
  const w = weather(s);
  const cross = crosswind(w) / CROSSWIND_LIMIT[wakeCat(f)];
  let risk = 0.015 + 0.12 * Math.max(0, cross - 0.6) + (w.vis < 0.5 ? 0.04 : 0);
  risk *= Math.max(0.4, 1 - effectValue(s, 'tower') * 1.5);
  return hash01(f.id * 131 + f.goArounds * 17 + 7) < risk;
}

/** Full power, climb out along the runway, then back to the hold to try again. */
function goAround(s: GameState, f: Flight, L: TierLayout): void {
  const appr = opsOf(L, f.dir).approach;
  const d = f.dir;
  const h = appr.hold;
  const ang = Math.atan2(f.y - h[1], f.x - h[0]);
  setPhase(f, 'goAround');
  setPath(
    f,
    chaikin([f.x, f.y, f.z, f.x + d * 5, f.y, 1.4, f.x + d * 11, f.y - 2.5, 2.6, h[0] + Math.cos(ang) * appr.holdRadius, h[1] + Math.sin(ang) * appr.holdRadius, h[2]], 2),
  );
  f.speed = AIRCRAFT[f.aircraft].approachSpeed * 1.1;
  f.goArounds++;
  f.patience = Math.max(0.05, f.patience - 0.1);
  f.mood = Math.max(0, f.mood - 0.05);
  s.stats.goArounds++;
  pushEvent(s, 'goAround', f.x, f.y, f.id);
}

function canLineUp(s: GameState, f: Flight, L: TierLayout): boolean {
  const dep = L.depRunway ? 2 : 1;
  if (runwayBlocked(s, dep)) return false;
  // a cleared emergency gets the runway first
  if (dep === 1 && s.flights.some((o) => priority(o) && o.landCleared && o !== f && (o.phase === 'holding' || o.phase === 'inbound'))) return false;
  if (s.time < wakeClearAt(s, dep, f)) return false;
  for (const o of s.flights) {
    if (o === f || isHeli(o)) continue;
    if (runwayOf(o, L) === dep) return false;
    if (dep === 1) {
      if (o.phase === 'final') return false;
      // landings first (one runway for both), but only those the weather lets in right now
      // (and not during a runway change, which waits for the departures to clear out)
      if (!s.turning && (o.phase === 'holding' || o.phase === 'inbound') && o.landCleared && o.stand >= 0 && weatherLetsIn(s, o)) return false;
    }
    if (o.phase === 'holdShort' && o.takeoffCleared && o.id < f.id) return false;
  }
  return true;
}

function startFinal(s: GameState, f: Flight, L: TierLayout, speedMul = 1): void {
  setPhase(f, 'final');
  if (isHeli(f)) {
    const pad = L.stands[f.stand].pos;
    setPath(f, chaikin([f.x, f.y, f.z, (f.x + pad[0]) / 2, (f.y + pad[1]) / 2, Math.max(1.6, f.z * 0.6), pad[0], pad[1], 1.2, pad[0], pad[1], 0], 2));
    f.speed = AIRCRAFT[f.aircraft].approachSpeed;
    return;
  }
  // land into the wind: the direction is fixed for this approach
  f.dir = s.rwyDir;
  setPath(f, routeFinal(L, f.x, f.y, f.z, f.heading, f.dir));
  f.speed = AIRCRAFT[f.aircraft].approachSpeed * speedMul;
}

export function divert(s: GameState, f: Flight): void {
  // an airline knows fog and crosswind are nobody's fault: it counts as a delay, not a failure
  const wx = f.landCleared && f.stand >= 0 ? approachBlocker(s, f) : null;
  if (f.stand >= 0) {
    const st = s.stands[f.stand];
    if (st.reserved === f.id) st.reserved = 0;
    f.stand = -1;
  }
  f.landCleared = false;
  setPhase(f, 'diverted');
  setPath(f, routeDivert(f.x, f.y, f.z, f.heading));
  f.mood = 0;
  airlineFlightDone(s, f, wx === 'fog' || wx === 'crosswind' || wx === 'turn' ? 'late' : 'diverted');
  // a guest that goes on elsewhere was never yours to lose
  if (!f.guest) {
    s.stats.diverted++;
    logDeparture(s, f, 1);
    s.rating = nextRating(s.rating, 0);
  }
  sendPaxHome(s, f);
  pushEvent(s, 'diverted', f.x, f.y, f.id, 0, f.id);
}

export function clearLanding(s: GameState, f: Flight): boolean {
  if ((f.phase !== 'inbound' && f.phase !== 'holding') || f.landCleared || s.tierSwitch) return false;
  let st = f.stand;
  if (st < 0) st = freeStand(s, f.aircraft);
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
  const route = findRoute(g, flowOf(g, f.dir).standExit[f.stand], g.standNode[f.stand]);
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
  if (g.standNode[f.stand] >= 0) s.nodeHold[g.standNode[f.stand]] = f.id;
  f.groute = null;
  f.speed = 0;
  f.dockedAt = s.time;
  f.slot = s.time + ac.baseTurnaround * kindOf(f.airline).turnaround;
  // a historic plane stands on show first
  if (f.historic) {
    f.holdUntil = s.time + EXHIBIT_SECONDS;
    f.slot += EXHIBIT_SECONDS;
  }
  // a jet bridge: no stairs in the rain, people love it
  if (gatePoint(layoutOf(s.tier), f.stand)) f.mood = Math.min(1, f.mood + 0.08);
  f.paxTimer = 0.4;
  setPhase(f, 'deboarding');
  pushEvent(s, 'docked', f.x, f.y, f.id);
  checkForFault(s, f);
  // a bird on landing: the plane is looked over before it flies again
  if (f.birdHit && f.aog === 0 && storeActive(s, 'parts')) {
    groundPlane(s, f);
    f.repNeed = 30;
    f.repParts = 0;
  }
}

/** Share of arrivals that turn out to have a technical fault (from the regional airport on). */
export const AOG_CHANCE = 0.03;

/**
 * The walk-around at the stand: now and then a fault grounds the plane (AOG)
 * until a mechanic fixes it, with spare parts from the store. The airline
 * allows for part of the repair in the schedule.
 */
function checkForFault(s: GameState, f: Flight): void {
  if (f.check) {
    startCheck(f);
    return;
  }
  if (!storeActive(s, 'parts') || isHeli(f)) return;
  if (hash01(hashU32(s.seed ^ 0xa06) + f.id * 977) >= AOG_CHANCE * faultFactor(s)) return;
  groundPlane(s, f);
}

/** Grounds a parked plane with a fault (repair time and parts by its size). */
export function groundPlane(s: GameState, f: Flight): void {
  const cat = wakeCat(f);
  f.aog = 1;
  f.repState = FUEL.none;
  f.repWork = 0;
  f.repNeed = 20 + 10 * cat;
  f.repParts = cat >= 3 ? 2 : 1;
  // the airline knows a fault is nobody's fault: the repair goes into the schedule
  f.slot += f.repNeed + 10;
  pushEvent(s, 'aog', f.x, f.y, f.id);
}

/** Regular checks in the hangar make faults rarer (set by the hangar, M10c). */
export function faultFactor(s: GameState): number {
  return hangarFaultFactor(s);
}

/** Tries to start taxiing out; false while the taxiway ahead is taken. */
function tryLeaveStand(s: GameState, f: Flight): boolean {
  const g = graphOf(s.tier);
  if (isHeli(f)) {
    // rotors turning on the pad; waits there for takeoff clearance
    const pad = s.stands[f.stand];
    if (pad && pad.occupant === f.id) pad.occupant = 0;
    offBlock(s, f);
    setPhase(f, 'holdShort');
    if (!f.takeoffCleared) pushEvent(s, 'takeoffRequest', f.x, f.y, f.id);
    return true;
  }
  const from = g.standNode[f.stand];
  // nobody new pushes back while the runway is being turned around
  if (s.turning) {
    f.gWaiting = true;
    return false;
  }
  // depart into the wind: the direction is fixed when the plane leaves its stand
  const dir = s.rwyDir;
  const flow = flowOf(g, dir);
  const route = findRoute(g, from, flow.holdShort);
  if (!route) return false;
  // never stop on the shared lane: take the whole stretch up to a waiting spot at once
  if (!tryReserveRun(s, f, route, safeRunEnd(g, flow, route, 0, tailClear(f)))) {
    f.gWaiting = true;
    return false;
  }
  f.gWaiting = false;
  f.dir = dir;
  f.groute = routeGeometry(g, route, [f.x, f.y]);
  f.gIdx = 0;
  f.gStart = from;
  f.pathPos = 0;
  const st = s.stands[f.stand];
  if (st && st.occupant === f.id) st.occupant = 0;
  offBlock(s, f);
  f.speed = 0;
  setPhase(f, 'taxiOut');
  return true;
}

/** Leaving the stand: on time or late against the slot. */
function offBlock(s: GameState, f: Flight): void {
  f.offBlockAt = s.time;
  f.onTime = s.time <= f.slot + 3 ? 1 : -1;
  if (f.onTime > 0) {
    s.stats.onTime++;
    f.mood = Math.min(1, f.mood + 0.06);
  } else {
    s.stats.late++;
    f.mood = Math.max(0, f.mood - 0.1);
  }
}

function pay(s: GameState, f: Flight): void {
  const rev = flightRevenue(f, AIRCRAFT[f.aircraft], effects(s), tierDef(s.tier).pay);
  let amount = rev.total;
  // a VIP flight that leaves happy and on time tips as much again; a bad one costs you with the airline
  if (f.vip) {
    if (vipTip(f)) {
      amount = amount.add(rev.total);
      s.rep[f.airline] = Math.min(100, (s.rep[f.airline] ?? 50) + 3);
      pushEvent(s, 'vipTip', f.x, f.y, f.id, rev.total.toNumber());
    } else s.rep[f.airline] = Math.max(0, (s.rep[f.airline] ?? 50) - 2);
  }
  // (a chest's boost: double income for a while)
  if (incomeBoost(s) > 1) amount = amount.mul(Big.fromNumber(incomeBoost(s)));
  recordIncome(s, amount.toNumber(), rev.parts, f.boarded);
  s.money = s.money.add(amount);
  s.stats.earned = s.stats.earned.add(amount);
  s.stats.served++;
  if (f.guest) s.stats.guests++;
  s.stats.pax += f.boarded + f.deboarded;
  s.rating = nextRating(s.rating, f.mood);
  f.paid = amount.toNumber();
  pushEvent(s, 'paid', f.x, f.y, amount.m, amount.e, f.id);
  airlineFlightDone(s, f, f.onTime > 0 ? 'onTime' : 'late');
  logDeparture(s, f, 0);
  maybeReview(s, f, `${AIRLINES[f.airline]?.code ?? ''}${f.num}`);
}

/** Keeps the latest departures (and cancellations) for the board. */
function logDeparture(s: GameState, f: Flight, status: number): void {
  s.departed.push({ al: f.airline, num: f.num, dest: f.dest, slot: f.slot || f.sched, at: s.time, status });
  if (s.departed.length > 8) s.departed.shift();
}

/** Recomputes what the flight is waiting for (bitmask + the top action). */
export function refreshWants(s: GameState, f: Flight): void {
  let w = 0;
  const p = f.phase;
  if ((p === 'inbound' || p === 'holding') && !f.landCleared) w |= 1 << WANT.clearLanding;
  const atStand = p === 'deboarding' || p === 'turnaround' || p === 'boarding';
  if (atStand && f.bagState === FUEL.none) w |= 1 << WANT.bags;
  if ((p === 'deboarding' || p === 'turnaround') && f.fuelState === FUEL.none) w |= 1 << WANT.fuel;
  if (p === 'turnaround' && f.fuelState === FUEL.done && !f.boardingStarted && f.aog !== 1 && f.holdUntil <= s.time) w |= 1 << WANT.board;
  if ((p === 'deboarding' || p === 'turnaround') && f.aog === 1 && f.repState === FUEL.none) w |= 1 << WANT.repair;
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
  // during a runway change nobody may push back: the slots of planes at their stands move with it
  // (the same for a storm or a closed runway: the airline knows)
  if (s.turning || airportDisrupted(s)) for (const f of s.flights) if (f.dockedAt > 0 && f.offBlockAt === 0) f.slot += dt;
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
        startFinal(s, f, L, fx.runwayOps);
        return true;
      }
      if (follow(f, dt)) {
        setPhase(f, 'holding');
        const h = opsOf(L, f.dir).approach.hold;
        f.holdAngle = Math.atan2(f.y - h[1], f.x - h[0]);
        let level = 0;
        while (s.flights.some((o) => o !== f && o.phase === 'holding' && o.holdLevel === level)) level++;
        f.holdLevel = level;
      }
      return true;
    }
    case 'holding': {
      const appr = opsOf(L, f.dir).approach;
      const h = appr.hold;
      const R = appr.holdRadius;
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
        if (!airportPaused(s)) f.patience -= dt / (HOLD_PATIENCE_S * holdFuel(s, f));
        f.mood = Math.max(0, f.mood - 0.006 * dt);
      } else {
        // a runway change is nobody's fault: pilots wait it out more calmly
        // (nor a storm or a closed runway; through a storm or an air show nobody minds at all)
        if (!airportPaused(s)) f.patience -= dt / (HOLD_PATIENCE_S * 2.5 * holdFuel(s, f) * (s.turning || airportDisrupted(s) ? 2 : 1));
      }
      if (f.patience <= 0) {
        f.patience = 0;
        divert(s, f);
        return true;
      }
      if (canStartFinal(s, f, L)) startFinal(s, f, L, fx.runwayOps);
      return true;
    }
    case 'final': {
      if (follow(f, dt)) {
        if (isHeli(f)) {
          // set down on the pad: no runway, no taxiway
          f.z = 0;
          dock(s, f);
          pushEvent(s, 'touchdown', f.x, f.y, f.id);
          birdCheck(s, f);
          return true;
        }
        if (mustGoAround(s, f, L)) {
          goAround(s, f, L);
          return true;
        }
        setPhase(f, 'landing');
        setPath(f, routeLanding(L, f.dir));
      }
      return true;
    }
    case 'goAround': {
      if (follow(f, dt)) {
        // back in the stack, still cleared: it lands as soon as the tower allows
        setPhase(f, 'holding');
        const h = opsOf(L, f.dir).approach.hold;
        f.holdAngle = Math.atan2(f.y - h[1], f.x - h[0]);
        let level = 0;
        while (s.flights.some((o) => o !== f && o.phase === 'holding' && o.holdLevel === level)) level++;
        f.holdLevel = level;
      }
      return true;
    }
    case 'landing': {
      f.speed = ac.approachSpeed * 0.92;
      if (follow(f, dt)) {
        setPhase(f, 'rollout');
        const g = graphOf(s.tier);
        setPath(f, routeRollout(L, g.pos[flowOf(g, f.dir).standExit[f.stand]], f.dir));
        f.z = 0;
        stirWake(s, 1, f);
        beginArrivalRoute(s, f);
        pushEvent(s, 'touchdown', f.x, f.y, f.id);
          birdCheck(s, f);
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
      // a sick passenger: the paramedics go first, everyone else waits (and understands)
      if (f.medical) return true;
      waitingDrain(s, f, dt);
      f.paxTimer -= dt;
      if (f.deboarded < f.paxIn && f.paxTimer <= 0) {
        // off through the jet bridge into the pier, or down the stairs onto the apron (always the stairs when a bus comes)
        const gate = bussed(s, f) ? null : gatePoint(L, f.stand);
        const out = gate ?? doorPoint(L, f.aircraft, f.x, f.y, f.heading);
        const n = Math.min(paxGroupOf(base), f.paxIn - f.deboarded);
        spawnArrivingPax(s, f, out[0], out[1], n);
        f.deboarded += n;
        f.paxTimer = gate ? 0.35 : 0.55;
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
        // (dirty floors on the way through the terminal put them in a worse mood)
        if (f.paxOut > 0) f.mood = Math.max(0, f.mood - (1 - cleanliness(s)) * DIRT_MOOD);
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
      const arrived = groundMove(s, f, dt, ac.taxiSpeed, tailClear(f), flowOf(graphOf(s.tier), f.dir));
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
      if (f.takeoffCleared && isHeli(f)) {
        // lift straight up off the pad, then away to the east
        setPhase(f, 'takeoff');
        setPath(f, chaikin([f.x, f.y, 0, f.x, f.y, 1.4, f.x + 4, f.y - 1, 3, f.x + 16, f.y - 4, 6], 2));
        f.speed = ac.taxiSpeed;
        return true;
      }
      if (f.takeoffCleared && canLineUp(s, f, L)) beginLineUp(f, L);
      return true;
    }
    case 'lineUp': {
      f.speed = ac.taxiSpeed * 0.8;
      if (follow(f, dt)) {
        releaseAll(s, f);
        setPhase(f, 'takeoff');
        setPath(f, routeTakeoff(L, f.dir));
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
        if (!isHeli(f)) stirWake(s, L.depRunway ? 2 : 1, f);
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
  setPath(f, routeLineUp(L, f.dir));
}

export function clearTakeoff(s: GameState, f: Flight): boolean {
  if ((f.phase !== 'taxiOut' && f.phase !== 'holdShort') || f.takeoffCleared) return false;
  f.takeoffCleared = true;
  if (s.time - f.readyAt < 4) f.mood = Math.min(1, f.mood + 0.03);
  pushEvent(s, 'takeoffCleared', f.x, f.y, f.id);
  return true;
}

export function startBoarding(s: GameState, f: Flight): boolean {
  if (f.phase !== 'turnaround' || f.fuelState !== FUEL.done || f.boardingStarted || f.aog === 1 || f.holdUntil > s.time) return false;
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
    const group = paxGroupOf(AIRCRAFT[f.aircraft]);
    const due = Math.floor((s.time - f.spawnedAt - 1) / 0.9) + 1;
    if (due > Math.ceil(f.paxSpawned / group)) {
      const n = Math.min(group, f.paxOut - f.paxSpawned);
      spawnDepartingPax(s, f, L, n);
      f.paxSpawned += n;
    }
  }
}
