/**
 * Incidents (M11): things that happen at the airport now and then. A
 * scheduler picks one by weight every few minutes (hashes, never the shared
 * RNG); each kind changes what the airport can do while it lasts:
 *
 * - storm: no landings, takeoffs or fueling for a while (lightning nearby)
 * - birds: the next plane to land takes a bird and needs an inspection
 * - fod: debris on the runway; it stays closed until the inspection car is back
 * - emergency: an inbound plane lands first; fire trucks stand by; praise or blame
 * - vip: a VIP flight; red carpet; a big tip if the passengers leave happy and on time
 * - airshow: announced ahead; the runway closes while the team flies; tickets sell
 * - medical: a sick passenger; the ambulance comes in by road and meets the plane
 * - celebrity: a private jet; let the press in (buzz: fuller planes) or keep it private (a tip)
 * - historic: a vintage plane visits, stands on show, visitors buy tickets
 *
 * Weekends (game days 6 and 7), holidays (real dates) and a buzz bring fuller planes.
 */
import { AIRCRAFT, aircraftIndex, planeArt, standFits, type StandSize } from '../../data/aircraft';
import { AIRLINES } from '../../data/airlines';
import { HOLIDAYS } from '../../data/holidays';
import {
  BUZZ_PAX,
  BUZZ_SECONDS,
  CELEB_PAY,
  EXHIBIT_RATE,
  INCIDENT_GAP,
  INCIDENTS,
  incidentDef,
  MEDICAL_DEADLINE,
  MEDICAL_WORK,
  VISITORS,
  WEEKEND_PAX,
  type IncidentKind,
} from '../../data/incidents';
import { tierDef, type P2 } from '../../data/tiers';
import { Big } from '../big';
import { hash01, hashU32 } from '../hash';
import { aircraftHere, fleetHere } from './airlines';
import { holidayOn } from './calendar';
import { gameClock } from './clock';
import { pushEvent } from './events';
import { doorSide, layoutOf, opsOf } from './layout';
import { chaikin, makeSample, samplePath } from './path';
import type { Flight, GameState, Incident, IncidentUnit, Planned } from './types';
import { level } from './upgrades';
import { bagBonus, bagSpot, breachChance, breachSpot, checkSeconds, droneSeconds, droneSpot, guardAtBag, guardCount, NO_GUARD_SECONDS, BAG_GOOD, PATROL_SPEED, payBonus, securityLevel, securityUnit } from './security';

const SAMPLE = makeSample();
/** Seconds an emergency may circle before it gives up on you. */
export const EMERGENCY_DEADLINE = 180;
/** Runway closed this long after an emergency landing (inspection, foam). */
const AFTER_EMERGENCY = 20;
/** The inspection car and the fire trucks (tiles per second). */
const UNIT_SPEED = 2.6;
/** Finished incidents kept for the events panel. */
const KEEP_DONE = 6;

function gh(s: GameState, n: number): number {
  return hash01(hashU32(s.seed ^ 0x1c1d) + n);
}

export function activeIncidents(s: GameState): Incident[] {
  return s.incidents.filter((i) => i.state !== 'done');
}

function live(s: GameState, kind: IncidentKind): Incident | undefined {
  return s.incidents.find((i) => i.kind === kind && i.state === 'active');
}

export function stormActive(s: GameState): boolean {
  return !!live(s, 'storm');
}

/**
 * Why a runway can't be used right now (null = it can). Runway 1 takes
 * landings (and takeoffs below the international airport), runway 2 departures.
 */
export function runwayBlocked(s: GameState, runway = 1): 'storm' | 'closed' | null {
  if (s.incidents.length === 0 && s.time >= s.runwayClosedUntil) return null;
  if (stormActive(s)) return 'storm';
  if (live(s, 'airshow')) return 'closed';
  // a drone over the field closes every runway; a hole in the fence holds the runways until it is checked
  if (live(s, 'drone')) return 'closed';
  const br = live(s, 'breach');
  if (br && !br.units.some((u) => u.state === 'work' || u.state === 'back')) return 'closed';
  if (runway === 1 && (live(s, 'fod') || s.time < s.runwayClosedUntil)) return 'closed';
  return null;
}

/** A storm or an air show: known in advance, nobody minds waiting (holding planes keep their patience). */
export function airportPaused(s: GameState): boolean {
  return s.incidents.length > 0 && (stormActive(s) || !!live(s, 'airshow'));
}

/** Any runway closure or storm: holding planes are patient, slots move (not the player's fault). */
export function airportDisrupted(s: GameState): boolean {
  return runwayBlocked(s, 1) !== null;
}

export function isWeekend(time: number): boolean {
  const d = (gameClock(time).day - 1) % 7;
  return d === 5 || d === 6;
}

/** Weekend: fuller planes (never above the seats). */
export function weekendPax(time: number, n: number, max: number): number {
  return isWeekend(time) ? Math.min(max, Math.round(n * WEEKEND_PAX)) : n;
}

/** How much fuller planes are now: the weekend, a holiday, a celebrity in the news. */
export function paxBoost(s: GameState): number {
  let k = isWeekend(s.time) ? WEEKEND_PAX : 1;
  if (s.holiday >= 0) k *= HOLIDAYS[s.holiday]?.pax ?? 1;
  if (s.time < s.buzzUntil) k *= BUZZ_PAX;
  return k;
}

/** Passengers for a new flight with the boost (never above the seats). */
export function boostPax(s: GameState, n: number, max: number): number {
  const k = paxBoost(s);
  return k === 1 ? n : Math.min(max, Math.round(n * k));
}

/** The real date changed (or arrived): which holiday is it? Announced once when one begins. */
function updateHoliday(s: GameState): void {
  const now = holidayOn(s.today);
  const h = now ? now.h : -1;
  const day = now ? now.day : 0;
  if (h === s.holiday && day === s.holidayDay) return;
  const fresh = h >= 0 && h !== s.holiday;
  s.holiday = h;
  s.holidayDay = day;
  if (fresh) pushEvent(s, 'holiday', 0, 0, h, day);
}

/** The UI tells the sim the date (an epoch day: days since 1970-01-01). */
export function setToday(s: GameState, day: number): void {
  s.today = Number.isFinite(day) ? Math.floor(day) : -1;
  updateHoliday(s);
}

// ------------------------------------------------------------------ scheduling

function cooling(s: GameState, kind: IncidentKind): boolean {
  const def = incidentDef(kind);
  const last = s.incidentLast[kind] ?? -1e9;
  return s.time - last < def.cooldown;
}

function newIncident(s: GameState, kind: IncidentKind): Incident {
  const def = incidentDef(kind);
  const inc: Incident = {
    id: s.nextId++,
    kind,
    state: def.lead > 0 ? 'announced' : 'active',
    at: s.time + def.lead,
    ends: def.duration > 0 ? s.time + def.lead + def.duration : 0,
    flight: 0,
    x: 0,
    y: 0,
    units: [],
    result: 0,
    amount: 0,
    choice: 0,
  };
  s.incidents.push(inc);
  s.incidentLast[kind] = s.time;
  pushEvent(s, inc.state === 'announced' ? 'incidentSoon' : 'incidentStart', 0, 0, INCIDENTS.findIndex((d) => d.kind === kind), inc.id, def.lead);
  return inc;
}

/** Can this kind start now? (Some need a plane in the air or room on the ground.) */
function possible(s: GameState, kind: IncidentKind): boolean {
  if (s.tierSwitch || !layoutOf(s.tier).depot) return false;
  if (activeIncidents(s).some((i) => i.kind === kind)) return false;
  // one runway closure at a time
  const closing = (k: IncidentKind) => k === 'storm' || k === 'fod' || k === 'airshow' || k === 'drone' || k === 'breach';
  if (closing(kind) && activeIncidents(s).some((i) => closing(i.kind))) return false;
  switch (kind) {
    case 'emergency':
      return s.flights.some((f) => emergencyCandidate(f));
    case 'vip':
      return freeStands(s) >= 2 && s.contracts.some((c) => fleetHere(s, c.al).length > 0);
    case 'medical':
      return s.flights.some((f) => emergencyCandidate(f));
    case 'celebrity':
      return freeStands(s) >= 2 && celebPlane(s) >= 0;
    case 'historic':
      return freeStands(s) >= 2 && freeStands(s, 'small') >= 1;
    case 'bag':
      return bagSpot(s, 1) !== null;
    default:
      return true;
  }
}

function emergencyCandidate(f: Flight): boolean {
  return (f.phase === 'inbound' || f.phase === 'holding') && !f.landCleared && !special(f);
}

/** Already part of a story (a guest, a check, an incident): leave it alone. */
function special(f: Flight): boolean {
  return f.guest || f.check > 0 || f.vip || f.emergency || f.medical || f.celeb || f.historic;
}

/** Free stands (that take this size of plane, if given). */
function freeStands(s: GameState, need?: StandSize): number {
  const L = layoutOf(s.tier);
  let n = 0;
  for (let i = 0; i < s.stands.length; i++) {
    const st = L.stands[i];
    if (!st || !s.standOpen[i] || st.hangar || s.stands[i].occupant || s.stands[i].reserved) continue;
    if (need && !standFits(st.size, need)) continue;
    n++;
  }
  return n;
}

/** The celebrity's plane: a business jet where it can park, else a light twin (-1 = none fits now). */
function celebPlane(s: GameState): number {
  for (const id of VISITORS.celebPlanes) {
    const k = aircraftIndex(id);
    if (k >= 0 && aircraftHere(s, k) && freeStands(s, AIRCRAFT[k].stand) >= 1) return k;
  }
  return -1;
}

function visitorFlight(s: GameState, spawn: (p: Planned) => Flight | null, airline: string, ac: number): Flight | null {
  const al = Math.max(0, AIRLINES.findIndex((a) => a.id === airline));
  const id = s.nextId++;
  return spawn({ id, at: s.time, al, num: 1 + Math.floor(gh(s, id) * 99), origin: Math.floor(gh(s, id + 1) * 6), dest: Math.floor(gh(s, id + 2) * 6), ac });
}

/** Picks the next incident when one is due. */
function schedule(s: GameState, spawn: (p: Planned) => Flight | null): void {
  if (s.time < s.nextIncidentAt) return;
  s.nextIncidentAt = s.time + INCIDENT_GAP[0] + (INCIDENT_GAP[1] - INCIDENT_GAP[0]) * gh(s, s.tick);
  const pool = INCIDENTS.filter((d) => d.minTier <= s.tier && !cooling(s, d.kind) && possible(s, d.kind));
  // a bird-control program makes flocks rarer
  const weight = (k: IncidentKind, w: number) =>
    k === 'birds' ? w * Math.max(0.2, 1 - 0.3 * level(s, 'birdControl')) : k === 'breach' ? w * breachChance(s) : k === 'bag' ? w * (1.2 - 0.6 * securityLevel(s)) : w;
  const total = pool.reduce((a, d) => a + weight(d.kind, d.weight), 0);
  if (total <= 0) return;
  let r = gh(s, s.tick + 7) * total;
  const def = pool.find((d) => (r -= weight(d.kind, d.weight)) < 0) ?? pool[pool.length - 1];
  startIncident(s, def.kind, spawn);
}

/** Starts an incident of this kind now (tests and the scheduler). Returns it, or null if it can't happen. */
export function startIncident(s: GameState, kind: IncidentKind, spawn: (p: Planned) => Flight | null): Incident | null {
  if (!possible(s, kind)) return null;
  const L = layoutOf(s.tier);
  if (kind === 'emergency') {
    const f = s.flights.find((x) => emergencyCandidate(x));
    if (!f) return null;
    const inc = newIncident(s, kind);
    f.emergency = true;
    // it can't circle long: a deadline, and the tower is expected to bring it in first
    f.patience = Math.max(f.patience, 0.6);
    inc.flight = f.id;
    inc.ends = s.time + EMERGENCY_DEADLINE;
    return inc;
  }
  if (kind === 'medical') {
    const f = s.flights.find((x) => emergencyCandidate(x));
    if (!f) return null;
    const inc = newIncident(s, kind);
    f.medical = true;
    f.patience = Math.max(f.patience, 0.6);
    inc.flight = f.id;
    inc.ends = s.time + MEDICAL_DEADLINE;
    return inc;
  }
  if (kind === 'celebrity') {
    const f = visitorFlight(s, spawn, VISITORS.celebAirline, celebPlane(s));
    if (!f) return null;
    const inc = newIncident(s, kind);
    f.celeb = true;
    f.payMul = CELEB_PAY;
    f.mood = Math.max(f.mood, 0.85);
    // the star and a small entourage (with plenty of luggage)
    f.paxIn = Math.min(f.paxIn, 2 + Math.floor(gh(s, f.id + 5) * 3));
    f.paxOut = Math.min(f.paxOut, 2 + Math.floor(gh(s, f.id + 6) * 3));
    f.bagsIn = f.paxIn * 2;
    f.bagsOut = f.paxOut * 2;
    inc.flight = f.id;
    return inc;
  }
  if (kind === 'historic') {
    const f = visitorFlight(s, spawn, VISITORS.historicAirline, aircraftIndex(VISITORS.historicPlane));
    if (!f) return null;
    const inc = newIncident(s, kind);
    f.historic = true;
    f.payMul = 1;
    inc.flight = f.id;
    return inc;
  }
  if (kind === 'vip') {
    const pool = s.contracts.filter((c) => fleetHere(s, c.al).length > 0);
    const c = pool[Math.floor(gh(s, s.tick + 3) * pool.length)];
    const id = s.nextId++;
    const f = spawn({ id, at: s.time, al: c.al, num: 1 + Math.floor(gh(s, id) * 99), origin: Math.floor(gh(s, id + 1) * 6), dest: Math.floor(gh(s, id + 2) * 6) });
    if (!f) return null;
    const inc = newIncident(s, kind);
    f.vip = true;
    f.mood = Math.max(f.mood, 0.85);
    inc.flight = f.id;
    return inc;
  }
  const inc = newIncident(s, kind);
  if (kind === 'bag') {
    const at = bagSpot(s, inc.id)!;
    inc.x = at[0];
    inc.y = at[1];
  }
  if (kind === 'drone') {
    const at = droneSpot(s);
    inc.x = at[0];
    inc.y = at[1];
    inc.ends = s.time + droneSeconds(s);
    // a patrol car drives out to the runway end
    if (level(s, 'patrol') > 0) inc.units.push(securityUnit(s, [at[0], at[1] + 0.6]));
  }
  if (kind === 'breach') {
    const at = breachSpot(s, inc.id);
    inc.x = at[0];
    inc.y = at[1];
    inc.units.push(securityUnit(s, at));
  }
  if (kind === 'fod') {
    // somewhere on the landing half of the runway
    const r = L.runway;
    inc.x = r.x0 + 3 + (r.x1 - r.x0 - 6) * gh(s, inc.id);
    inc.y = r.y + (gh(s, inc.id + 1) - 0.5) * 0.5;
  }
  if (kind === 'birds') {
    const td = opsOf(L, s.rwyDir).approach.touchdown;
    inc.x = td[0];
    inc.y = td[1];
  }
  return inc;
}

// ------------------------------------------------------------------ units (inspection car, fire trucks)

function unitAt(kind: IncidentUnit['kind'], at: P2): IncidentUnit {
  return { kind, x: at[0], y: at[1], px: at[0], py: at[1], heading: Math.PI * 0.75, path: [], pathPos: 0, state: 'home' };
}

function sendUnit(u: IncidentUnit, pts: number[], state: IncidentUnit['state']): void {
  u.path = chaikin(pts, 3);
  u.pathPos = 0;
  u.state = state;
}

function moveUnit(u: IncidentUnit, dt: number, speed = UNIT_SPEED): boolean {
  u.pathPos += speed * dt;
  samplePath(u.path, u.pathPos, SAMPLE);
  u.x = SAMPLE.x;
  u.y = SAMPLE.y;
  u.heading = SAMPLE.heading;
  return SAMPLE.left <= 1e-6;
}

/** Where the fire trucks live (the fire station by the supply area). */
export function fireHome(s: GameState): P2 {
  const D = layoutOf(s.tier).depot;
  return D ? D.fire.home : [26.6, 20.5];
}

// ------------------------------------------------------------------ update

function finish(s: GameState, inc: Incident, result: number, amount = 0): void {
  inc.state = 'done';
  inc.result = result;
  inc.amount = amount;
  inc.ends = s.time;
  pushEvent(s, 'incidentEnd', inc.x, inc.y, INCIDENTS.findIndex((d) => d.kind === inc.kind), result, amount);
}

export function updateIncidents(s: GameState, dt: number, spawn: (p: Planned) => Flight | null): void {
  // weekend starts
  const day = gameClock(s.time).day;
  if (day !== s.weekendDay) {
    s.weekendDay = day;
    if (isWeekend(s.time) && s.time > 1) pushEvent(s, 'weekend', 0, 0, day);
  }
  schedule(s, spawn);
  if (s.incidents.length === 0) return;
  const L = layoutOf(s.tier);
  for (const inc of s.incidents) {
    for (const u of inc.units) {
      u.px = u.x;
      u.py = u.y;
      // (units of a finished incident still drive home; the ambulance drives off to the hospital)
      if (inc.state === 'done' && u.state === 'back' && moveUnit(u, dt)) u.state = 'home';
    }
    if (inc.state === 'done') continue;
    if (inc.state === 'announced') {
      if (s.time >= inc.at) {
        inc.state = 'active';
        pushEvent(s, 'incidentStart', 0, 0, INCIDENTS.findIndex((d) => d.kind === inc.kind), inc.id, 0);
      }
      continue;
    }
    switch (inc.kind) {
      case 'storm':
        if (s.time >= inc.ends) finish(s, inc, 0);
        break;
      case 'airshow':
        if (s.time >= inc.ends) {
          // tickets and the crowd's spending, more for a better-rated airport
          const amount = Math.round(60 * tierDef(s.tier).pay * s.rating);
          s.money = s.money.add(Big.fromNumber(amount));
          s.stats.earned = s.stats.earned.add(Big.fromNumber(amount));
          finish(s, inc, 1, amount);
        }
        break;
      case 'birds':
        if (inc.flight === 0 && s.time >= inc.ends) finish(s, inc, 1);
        else if (inc.flight !== 0) {
          const f = s.flights.find((x) => x.id === inc.flight);
          // done once the plane has been looked at (or has left)
          if (!f || f.aog === 2 || f.offBlockAt > 0) finish(s, inc, 0);
        }
        break;
      case 'fod':
        updateFod(s, inc, dt, L.runway.y);
        break;
      case 'emergency':
        updateEmergency(s, inc, dt);
        break;
      case 'vip': {
        const f = s.flights.find((x) => x.id === inc.flight);
        if (!f) finish(s, inc, 0);
        else if (f.phase === 'diverted') finish(s, inc, -1);
        else if (f.paid > 0) finish(s, inc, f.vipGood ? 1 : -1, f.vipGood ? f.paid : 0);
        break;
      }
      case 'medical':
        updateMedical(s, inc, dt);
        break;
      case 'celebrity':
        updateCeleb(s, inc);
        break;
      case 'historic':
        updateHistoric(s, inc, dt);
        break;
      case 'bag':
        updateBag(s, inc, dt);
        break;
      case 'drone':
        for (const u of inc.units) if (u.state === 'out' && moveUnit(u, dt, PATROL_SPEED)) u.state = 'work';
        if (s.time >= inc.ends) {
          for (const u of inc.units) unitHome(u);
          finish(s, inc, level(s, 'droneDefense') > 0 ? 1 : 0);
        }
        break;
      case 'breach': {
        const u = inc.units[0];
        if (u && u.state === 'out' && moveUnit(u, dt, PATROL_SPEED)) {
          u.state = 'work';
          u.pathPos = 0;
        } else if (u && u.state === 'work') {
          u.pathPos += dt;
          if (u.pathPos >= 5) {
            unitHome(u);
            // (a patrol car on the airfield in time: well handled)
            finish(s, inc, u.kind === 'patrol' && s.time - inc.at < 45 ? 1 : 0);
          }
        }
        break;
      }
    }
  }
  // keep the panel short
  const done = s.incidents.filter((i) => i.state === 'done');
  if (done.length > KEEP_DONE) {
    const drop = new Set(done.slice(0, done.length - KEEP_DONE));
    s.incidents = s.incidents.filter((i) => !drop.has(i));
  }
}

/** Back to the depot the way it came. */
function unitHome(u: IncidentUnit): void {
  const back: number[] = [];
  for (let i = u.path.length - 3; i >= 0; i -= 3) back.push(u.path[i], u.path[i + 1], 0);
  u.path = [u.x, u.y, 0, ...back];
  u.pathPos = 0;
  u.state = 'back';
}

/** An unattended bag: noticed (cameras help), a guard walks to it and checks it; the lanes are slow meanwhile. */
function updateBag(s: GameState, inc: Incident, dt: number): void {
  void dt;
  if (guardCount(s) === 0) {
    // nobody of ours: the city's security comes, late
    if (s.time - inc.at >= NO_GUARD_SECONDS) finish(s, inc, 0);
    return;
  }
  const g = guardAtBag(s, inc);
  if (!g) {
    inc.choice = 0;
    return;
  }
  // (choice holds when the check began)
  if (inc.choice === 0) inc.choice = s.time;
  if (s.time - inc.choice >= checkSeconds(s)) {
    const quick = s.time - inc.at <= BAG_GOOD;
    const bonus = quick ? bagBonus(s) : 0;
    if (bonus > 0) payBonus(s, bonus);
    g.target = 0;
    finish(s, inc, quick ? 1 : 0, bonus);
  }
}

/** The inspection car drives out once the runway is empty, picks the debris up and drives back. */
function updateFod(s: GameState, inc: Incident, dt: number, ry: number): void {
  if (inc.units.length === 0) {
    // nobody on the runway any more (a landing or a takeoff roll finishes first)
    const busy = s.flights.some((f) => f.phase === 'landing' || f.phase === 'rollout' || f.phase === 'lineUp' || (f.phase === 'takeoff' && f.z < 0.5));
    if (busy) return;
    const home = fireHome(s);
    const u = unitAt('opsCar', home);
    sendUnit(u, [home[0], home[1], 0, home[0] + 0.4, ry - 2.6, 0, inc.x + 1.6, ry - 0.7, 0, inc.x + 0.35, inc.y, 0], 'out');
    inc.units.push(u);
    pushEvent(s, 'fodCar', inc.x, inc.y, inc.id);
    return;
  }
  const u = inc.units[0];
  if (u.state === 'out' && moveUnit(u, dt)) {
    u.state = 'work';
    u.pathPos = 0;
  } else if (u.state === 'work') {
    u.pathPos += dt;
    if (u.pathPos >= 4) {
      const home = fireHome(s);
      sendUnit(u, [u.x, u.y, 0, u.x - 1.2, ry - 0.9, 0, home[0] + 0.4, ry - 2.6, 0, home[0], home[1], 0], 'back');
      // the runway opens as soon as the car has the debris and drives off
      finish(s, inc, 1);
    }
  }
}

function updateEmergency(s: GameState, inc: Incident, dt: number): void {
  const f = s.flights.find((x) => x.id === inc.flight);
  const L = layoutOf(s.tier);
  const ry = L.runway.y;
  // fire trucks roll out to the runway as soon as it is cleared to land
  if (f && f.landCleared && inc.units.length === 0) {
    const home = fireHome(s);
    const td = opsOf(L, f.dir || s.rwyDir).approach.touchdown;
    const dirx = f.dir || 1;
    for (let k = 0; k < 2; k++) {
      const u = unitAt('fire', [home[0] + k * 0.5, home[1] + k * 0.3]);
      const sx = td[0] + dirx * (3 + k * 3.5);
      sendUnit(u, [u.x, u.y, 0, u.x + 0.3, ry - 3, 0, sx, ry - 1.6, 0, sx + dirx * 0.6, ry - 1.25, 0], 'out');
      inc.units.push(u);
    }
    pushEvent(s, 'fireOut', td[0], ry, f.id);
  }
  for (const u of inc.units) {
    if ((u.state === 'out' || u.state === 'back') && moveUnit(u, dt)) u.state = u.state === 'out' ? 'work' : 'home';
  }
  const landed = !!f && (f.phase === 'taxiIn' || f.dockedAt > 0);
  if (landed && inc.result === 0) {
    // runway checked and cleaned before the next one lands; the trucks go home
    s.runwayClosedUntil = Math.max(s.runwayClosedUntil, s.time + AFTER_EMERGENCY);
    const amount = Math.round(AIRCRAFT[f.aircraft].landingFee * 4 * tierDef(s.tier).pay);
    s.money = s.money.add(Big.fromNumber(amount));
    s.stats.earned = s.stats.earned.add(Big.fromNumber(amount));
    s.rating = Math.min(5, s.rating + 0.15);
    s.rep[f.airline] = Math.min(100, (s.rep[f.airline] ?? 50) + 5);
    f.emergency = false;
    inc.result = 1;
    inc.amount = amount;
    pushEvent(s, 'emergencyLanded', f.x, f.y, f.id, amount);
    sendHome(s, inc);
  }
  const failed = !f || f.phase === 'diverted' || (inc.result === 0 && s.time >= inc.ends && !(f.phase === 'final' || f.phase === 'landing' || f.phase === 'rollout'));
  if (failed && inc.result === 0) {
    s.rating = Math.max(1, s.rating - 0.2);
    if (f) {
      s.rep[f.airline] = Math.max(0, (s.rep[f.airline] ?? 50) - 4);
      f.emergency = false;
    }
    inc.result = -1;
    pushEvent(s, 'emergencyMissed', f?.x ?? 0, f?.y ?? 0, inc.flight);
    sendHome(s, inc);
  }
  // done once the trucks are back
  if (inc.result !== 0 && inc.units.every((u) => u.state === 'home')) finish(s, inc, inc.result, inc.amount);
}

function sendHome(s: GameState, inc: Incident): void {
  const home = fireHome(s);
  const ry = layoutOf(s.tier).runway.y;
  for (const u of inc.units) sendUnit(u, [u.x, u.y, 0, u.x, ry - 3, 0, home[0], home[1], 0], 'back');
}

/** On touchdown during a bird incident: the first plane takes the bird. */
export function birdCheck(s: GameState, f: Flight): void {
  const inc = live(s, 'birds');
  if (!inc || inc.flight !== 0 || f.check) return;
  inc.flight = f.id;
  f.birdHit = true;
  pushEvent(s, 'birdStrike', f.x, f.y, f.id);
}

/** At departure: a VIP flight that left happy and on time tips (doubles its pay). */
export function vipTip(f: Flight): boolean {
  f.vipGood = f.vip && f.mood >= 0.7 && f.onTime > 0;
  return f.vipGood;
}

// ------------------------------------------------------------------ medical case

function addMoney(s: GameState, amount: number): void {
  s.money = s.money.add(Big.fromNumber(amount));
  s.stats.earned = s.stats.earned.add(Big.fromNumber(amount));
}

/** Main road points beyond the service road turn-off, farthest first. */
function outerRoad(s: GameState): P2[] {
  const L = layoutOf(s.tier);
  const start = L.depot ? L.depot.serviceRoad[0] : L.road[0];
  return L.road.filter((p) => p[1] < start[1] - 0.3).sort((a, b) => a[1] - b[1]);
}

/** Where the ambulance waits on the apron (inside the gate) until the plane is at its stand. */
export function ambulanceWait(s: GameState): P2 {
  const D = layoutOf(s.tier).depot;
  return D ? [D.mech.via[0] - 0.95, D.mech.via[1] - 0.25] : [26, 20];
}

/** In by road, through the gate, to the waiting spot. */
function ambulanceIn(s: GameState): number[] {
  const D = layoutOf(s.tier).depot!;
  const pts: number[] = [];
  for (const p of outerRoad(s)) pts.push(p[0] + 0.18, p[1], 0);
  for (const p of D.serviceRoad) pts.push(p[0], p[1] + 0.18, 0);
  const w = ambulanceWait(s);
  pts.push(D.gate[0] + 0.12, D.gate[1], 0, D.gate[0] + 0.05, D.gate[1] + 0.45, 0, D.gate[0] - 0.2, D.gate[1] + 2.3, 0, w[0], w[1], 0);
  return pts;
}

/** Out through the gate and up the road (to the hospital). */
function ambulanceOut(s: GameState, from: P2): number[] {
  const D = layoutOf(s.tier).depot!;
  const via = D.mech.via;
  const pts: number[] = [from[0], from[1], 0, via[0], via[1], 0, D.gate[0] + 0.3, D.gate[1] + 1.2, 0, D.gate[0] - 0.1, D.gate[1], 0];
  for (let i = D.serviceRoad.length - 1; i >= 0; i--) pts.push(D.serviceRoad[i][0], D.serviceRoad[i][1] - 0.18, 0);
  const outer = outerRoad(s).reverse();
  for (const p of outer) pts.push(p[0] - 0.18, p[1], 0);
  return pts;
}

/**
 * Where the ambulance stops by the plane: by the service door on the side away
 * from the terminal (clear of the stairs, the jet bridge and the passengers),
 * a lane further out than the fuel truck.
 */
export function ambulanceSpot(s: GameState, f: Flight): { at: P2; approach: P2 } {
  const L = layoutOf(s.tier);
  const art = planeArt(f.aircraft);
  const side = -doorSide(L, f.x, f.y, f.heading);
  const nx = -Math.sin(f.heading);
  const ny = Math.cos(f.heading);
  const cx = Math.cos(f.heading);
  const cy = Math.sin(f.heading);
  const u = art.length * 0.3;
  const v = side * (art.radius + 0.95);
  const at: P2 = [f.x + cx * u + nx * v, f.y + cy * u + ny * v];
  const approach: P2 = [at[0] - cx * 0.9 + nx * side * 0.35, at[1] - cy * 0.9 + ny * side * 0.35];
  return { at, approach };
}

/**
 * A sick passenger: the plane gets landing priority; the ambulance comes in by
 * road once it is cleared, waits on the apron, meets it at the stand (nobody
 * gets off before the patient) and drives off to the hospital.
 */
function updateMedical(s: GameState, inc: Incident, dt: number): void {
  const f = s.flights.find((x) => x.id === inc.flight);
  if (f && f.landCleared && inc.units.length === 0) {
    const pts = ambulanceIn(s);
    const u = unitAt('ambulance', [pts[0], pts[1]]);
    sendUnit(u, pts, 'out');
    inc.units.push(u);
    pushEvent(s, 'ambulanceOut', f.x, f.y, f.id);
  }
  const u = inc.units[0];
  if (u) {
    if (u.state === 'out' && moveUnit(u, dt)) u.state = 'wait';
    if (u.state === 'wait' && f && f.medical && f.dockedAt > 0) {
      const spot = ambulanceSpot(s, f);
      const D = layoutOf(s.tier).depot!;
      sendUnit(u, [u.x, u.y, 0, D.mech.via[0], D.mech.via[1], 0, spot.approach[0], spot.approach[1], 0, spot.at[0], spot.at[1], 0], 'go');
    }
    if (u.state === 'go' && moveUnit(u, dt)) {
      u.state = 'work';
      u.pathPos = 0;
    }
    if (u.state === 'work' && f) {
      u.pathPos += dt;
      if (u.pathPos >= MEDICAL_WORK) {
        // the patient is in good hands: everyone else may get off now
        f.medical = false;
        const amount = Math.round(AIRCRAFT[f.aircraft].landingFee * 2 * tierDef(s.tier).pay);
        addMoney(s, amount);
        s.rating = Math.min(5, s.rating + 0.1);
        s.rep[f.airline] = Math.min(100, (s.rep[f.airline] ?? 50) + 3);
        pushEvent(s, 'medicalDone', u.x, u.y, f.id, amount);
        sendUnit(u, ambulanceOut(s, [u.x, u.y]), 'back');
        finish(s, inc, 1, amount);
        return;
      }
    }
  }
  // flown elsewhere: diverted, or still circling past the deadline
  const circling = !!f && !f.landCleared && (f.phase === 'inbound' || f.phase === 'holding');
  if (!f || f.phase === 'diverted' || (s.time >= inc.ends && circling)) {
    s.rating = Math.max(1, s.rating - 0.1);
    if (f) {
      s.rep[f.airline] = Math.max(0, (s.rep[f.airline] ?? 50) - 3);
      f.medical = false;
    }
    pushEvent(s, 'medicalMissed', f?.x ?? 0, f?.y ?? 0, inc.flight);
    // the ambulance turns round where it is
    if (u && u.state !== 'back') sendUnit(u, u.state === 'out' ? [u.x, u.y, 0, ...ambulanceIn(s).slice(0, 3)] : ambulanceOut(s, [u.x, u.y]), 'back');
    finish(s, inc, -1);
  }
}

// ------------------------------------------------------------------ celebrity

/** Let the press in (false) or keep the visit private (true), until the plane leaves. */
export function setCelebPrivacy(s: GameState, incident: number, priv: boolean): boolean {
  const inc = s.incidents.find((i) => i.id === incident && i.kind === 'celebrity' && i.state === 'active');
  if (!inc) return false;
  const f = s.flights.find((x) => x.id === inc.flight);
  if (!f || f.offBlockAt > 0) return false;
  inc.choice = priv ? 1 : 0;
  return true;
}

/**
 * A celebrity's private plane. With the press in, a good visit makes the news
 * (buzz: fuller planes for a day) and a bad one makes worse news; kept
 * private, a good visit tips as much again as the flight paid.
 */
function updateCeleb(s: GameState, inc: Incident): void {
  const f = s.flights.find((x) => x.id === inc.flight);
  if (!f) {
    finish(s, inc, 0);
    return;
  }
  if (f.phase === 'diverted') {
    finish(s, inc, -1);
    return;
  }
  if (f.dockedAt > 0 && inc.x === 0) {
    inc.x = f.x;
    inc.y = f.y;
    pushEvent(s, 'celebDocked', f.x, f.y, f.id, inc.choice === 0 ? 1 : 0);
  }
  if (f.paid <= 0) return;
  const good = f.mood >= 0.7 && f.onTime > 0;
  if (inc.choice === 1) {
    if (good) {
      addMoney(s, f.paid);
      pushEvent(s, 'celebTip', f.x, f.y, f.id, f.paid);
    }
    finish(s, inc, good ? 1 : -1, good ? f.paid : 0);
    return;
  }
  if (good) {
    s.buzzUntil = Math.max(s.buzzUntil, s.time + BUZZ_SECONDS);
    s.rating = Math.min(5, s.rating + 0.05);
    pushEvent(s, 'buzz', f.x, f.y, f.id);
  } else {
    s.rating = Math.max(1, s.rating - 0.15);
    pushEvent(s, 'badPress', f.x, f.y, f.id);
  }
  finish(s, inc, good ? 1 : -1, 0);
}

// ------------------------------------------------------------------ historic plane

/** Ticket coins a second while a historic plane is on show. */
export function exhibitRate(s: GameState): number {
  return EXHIBIT_RATE * tierDef(s.tier).pay * s.rating;
}

/** A historic plane on a visit: on show at its stand (boarding waits), visitors buy tickets. */
function updateHistoric(s: GameState, inc: Incident, dt: number): void {
  const f = s.flights.find((x) => x.id === inc.flight);
  if (!f || f.phase === 'diverted') {
    // it flew on to another airport
    finish(s, inc, 0);
    return;
  }
  if (f.dockedAt <= 0) return;
  if (inc.x === 0) {
    inc.x = f.x;
    inc.y = f.y;
    pushEvent(s, 'exhibitOpen', f.x, f.y, f.id);
  }
  if (s.time < f.holdUntil) {
    inc.amount += exhibitRate(s) * dt;
    return;
  }
  const amount = Math.round(inc.amount);
  addMoney(s, amount);
  finish(s, inc, 1, amount);
}
