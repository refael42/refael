/**
 * Airlines under contract: who flies here, how often, and how happy they are.
 * Arrivals come from a schedule built from the contracts; every finished
 * flight moves its airline's reputation. Offers arrive like job applicants:
 * sign, haggle (ask for more or offer a discount) or let them go. An unhappy
 * airline warns first and leaves if things don't improve.
 *
 * New code: randomness comes from per-game hashes, never from the RNG.
 */
import { AIRCRAFT } from '../../data/aircraft';
import { AIRLINE_KINDS, AIRLINES, type AirlineKindDef, type AirlineNeed } from '../../data/airlines';
import { CITIES } from '../../data/cities';
import { tierDef } from '../../data/tiers';
import { hash01, hashU32 } from '../hash';
import { DAY_SECONDS } from './clock';
import { pushEvent } from './events';
import { REJECT, type AirlineOffer, type Contract, type Flight, type GameState, type Planned } from './types';
import { effects } from './upgrades';
import { layoutOf } from './layout';

/** Reputation every airline starts with. */
export const REP_START = 50;
/** Reputation an airline needs before it sends its 2nd, 3rd, 4th aircraft size. */
export const REP_FOR_SIZE: readonly number[] = [0, 55, 75, 90];
/** Reputation needed to ask an airline for more flights. */
export const REP_EXPAND = 70;
/** Seconds between two expansions of the same contract. */
export const EXPAND_COOLDOWN = 300;
/** Planned arrivals are kept this far ahead (seconds). */
export const SCHEDULE_AHEAD = 240;
/** How many recent flights the on-time rate looks at. */
export const RECENT = 10;
/** Bad flights after a warning before the airline leaves. */
export const STRIKES_TO_LEAVE = 4;
const MAX_OFFERS = 2;
/** Never plan two arrivals closer than this (seconds). */
const MIN_ARRIVAL_GAP = 10;
/** The fewest flights a day a contract that was cut keeps. */
export const MIN_PER_DAY = 4;
const OFFER_LIFETIME = 300;
const STARTER = 'meadowlark';

/** Per-game hash (salted differently from the staff one). */
function gh(s: GameState, n: number): number {
  return hash01(hashU32(s.seed ^ 0x5a17) + n);
}

export function kindOf(al: number): AirlineKindDef {
  return AIRLINE_KINDS[(AIRLINES[al] ?? AIRLINES[0]).kind];
}

/** Facilities built so far (jet bridges, lounges... arrive in later milestones). */
export function hasNeed(_s: GameState, _need: AirlineNeed): boolean {
  return false;
}

export function contractSlots(s: GameState): number {
  return tierDef(s.tier).contracts;
}

export function contractOf(s: GameState, al: number): Contract | undefined {
  for (const c of s.contracts) if (c.al === al) return c;
  return undefined;
}

export function repOf(s: GameState, al: number): number {
  return s.rep[al] ?? REP_START;
}

/** Aircraft (indices) an airline can send here now, smallest first, ignoring reputation. */
export function fleetHere(s: GameState, al: number): number[] {
  const def = AIRLINES[al];
  if (!def) return [];
  return def.fleet
    .map((id) => AIRCRAFT.findIndex((a) => a.id === id))
    .filter((k) => k >= 0 && AIRCRAFT[k].unlockTier <= s.tier && AIRCRAFT[k].unlockServed <= s.stats.served && AIRCRAFT[k].stand === 'small')
    .sort((a, b) => AIRCRAFT[a].paxMax - AIRCRAFT[b].paxMax);
}

/** The part of the fleet the airline trusts you with. */
export function fleetForRep(s: GameState, al: number): number[] {
  const all = fleetHere(s, al);
  const rep = repOf(s, al);
  const n = Math.max(1, REP_FOR_SIZE.filter((r) => rep >= r).length);
  return all.slice(0, n);
}

/** Why an airline can't fly here yet (null when it can). */
export function airlineBlocker(s: GameState, al: number): { tier: number } | { need: AirlineNeed } | null {
  const def = AIRLINES[al];
  if (def.unlockTier > s.tier) return { tier: def.unlockTier };
  for (const n of AIRLINE_KINDS[def.kind].needs) if (!hasNeed(s, n)) return { need: n };
  return null;
}

/** Airlines that could send an offer right now. */
export function availableAirlines(s: GameState): number[] {
  const out: number[] = [];
  AIRLINES.forEach((_, i) => {
    if (airlineBlocker(s, i)) return;
    if (contractOf(s, i) || s.offers.some((o) => o.al === i)) return;
    if (fleetHere(s, i).length === 0) return;
    out.push(i);
  });
  return out;
}

/** Marketing brings each airline's planes more often (the tier grows the offers instead). */
function traffic(s: GameState): number {
  return Math.max(0.2, s.traffic * effects(s).traffic);
}

/** Flights per stand per game day that can be turned around without delays (rough). */
export const FLIGHTS_PER_STAND = 14;

/** About how many flights a day the airport handles on time: stands, then the taxiways. */
export function airportCapacity(s: GameState): number {
  return Math.min(s.standsBuilt * FLIGHTS_PER_STAND, layoutOf(s.tier).groundCapacity);
}

/** Total flights per game day the contracts bring (with traffic upgrades). */
export function flightsPerDay(s: GameState): number {
  let n = 0;
  for (const c of s.contracts) n += c.perDay;
  return n * traffic(s);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function makeContract(s: GameState, al: number, perDay: number, pay: number, goal: number, days: number, firstAt: number): Contract {
  return {
    al,
    perDay,
    pay,
    goal,
    signedAt: s.time,
    endsAt: days > 0 ? s.time + days * DAY_SECONDS : 0,
    flights: 0,
    onTime: 0,
    last: [],
    earned: 0,
    warned: false,
    strikes: 0,
    expandedAt: s.time,
    nextAt: firstAt,
  };
}

/** A new game starts with one small regional airline and an offer on the way. */
export function startAirlines(s: GameState): void {
  s.rep = AIRLINES.map(() => REP_START);
  const al = AIRLINES.findIndex((a) => a.id === STARTER);
  s.contracts = [makeContract(s, al, 10, 1, 0.65, 0, 2)];
  s.offers = [];
  s.nextOfferAt = 75;
  s.schedule = [];
  s.departed = [];
}

// ------------------------------------------------------------------ schedule

function plannedNum(s: GameState, al: number, k: number): number {
  return 100 + Math.floor(gh(s, al * 7919 + k * 31 + 3) * 800);
}

/** Keeps SCHEDULE_AHEAD seconds of planned arrivals, earliest first. */
export function refillSchedule(s: GameState): void {
  const horizon = s.time + SCHEDULE_AHEAD;
  const t = traffic(s);
  let added = false;
  for (const c of s.contracts) {
    if (c.perDay <= 0) continue;
    const gap = DAY_SECONDS / (c.perDay * t);
    while (c.nextAt < horizon && (c.endsAt === 0 || c.nextAt < c.endsAt)) {
      const k = s.nextId++;
      const cities = CITIES.map((x, i) => ({ x, i })).filter(({ x }) => x.range <= s.tier + 1);
      const oi = Math.floor(gh(s, k * 13 + 5) * cities.length);
      const di = (oi + 1 + Math.floor(gh(s, k * 13 + 6) * (cities.length - 1))) % cities.length;
      s.schedule.push({ id: k, at: c.nextAt, al: c.al, num: plannedNum(s, c.al, k), origin: cities[oi].i, dest: cities[di].i });
      c.nextAt += gap * (0.8 + 0.4 * gh(s, k * 13 + 7));
      added = true;
    }
  }
  if (!added) return;
  s.schedule.sort((a, b) => a.at - b.at || a.id - b.id);
  // airlines don't coordinate, the tower does: keep arrivals apart so the runway sees a steady flow
  let total = 0;
  for (const c of s.contracts) total += c.perDay;
  const minGap = Math.max(MIN_ARRIVAL_GAP, (0.6 * DAY_SECONDS) / Math.max(1, total * t));
  for (let i = 1; i < s.schedule.length; i++) {
    const want = s.schedule[i - 1].at + minGap;
    if (s.schedule[i].at < want) s.schedule[i].at = want;
  }
}

/** The next planned arrival that is due now (or null). */
export function dueArrival(s: GameState): Planned | null {
  const p = s.schedule[0];
  return p && p.at <= s.time ? p : null;
}

// ------------------------------------------------------------------ results

/** Reputation change for one finished flight. */
export function repDelta(result: 'onTime' | 'late' | 'diverted', mood: number, lostBags: number, loyalty: number): number {
  let d = result === 'onTime' ? 2 : result === 'late' ? -4 : -10;
  d += (Math.max(0, Math.min(1, mood)) - 0.6) * 3;
  d -= Math.min(3, lostBags);
  return d >= 0 ? d : d / loyalty;
}

function onTimeRate(c: Contract): number {
  if (c.last.length === 0) return 1;
  return c.last.reduce((a, b) => a + b, 0) / c.last.length;
}

export function contractRate(c: Contract): number {
  return onTimeRate(c);
}

function unhappy(s: GameState, c: Contract): boolean {
  return repOf(s, c.al) < 30 || (c.last.length >= 5 && onTimeRate(c) < c.goal - 0.2);
}

/** Books a finished flight (paid on takeoff, or diverted) on its airline. */
export function airlineFlightDone(s: GameState, f: Flight, result: 'onTime' | 'late' | 'diverted'): void {
  const k = kindOf(f.airline);
  const d = repDelta(result, f.mood, f.lostBags, k.loyalty);
  s.rep[f.airline] = Math.max(0, Math.min(100, repOf(s, f.airline) + d));
  const c = contractOf(s, f.airline);
  if (!c) return;
  c.flights++;
  if (result === 'onTime') c.onTime++;
  c.earned += f.paid;
  c.last.push(result === 'onTime' ? 1 : 0);
  if (c.last.length > RECENT) c.last.shift();
  const bad = unhappy(s, c);
  if (!c.warned) {
    if (bad) {
      c.warned = true;
      c.strikes = 0;
      pushEvent(s, 'airlineWarning', 0, 0, c.al);
    }
    return;
  }
  if (!bad && repOf(s, c.al) >= 40) {
    c.warned = false;
    c.strikes = 0;
    pushEvent(s, 'airlineHappy', 0, 0, c.al);
    return;
  }
  if (result !== 'onTime') c.strikes++;
  if (c.strikes < STRIKES_TO_LEAVE) return;
  if (s.contracts.length > 1) {
    leave(s, c);
    return;
  }
  // your only airline doesn't walk out (no traffic would be a dead end): it cuts flights
  c.strikes = 0;
  c.perDay = Math.max(MIN_PER_DAY, c.perDay - kindOf(c.al).step);
  pushEvent(s, 'airlineWarning', 0, 0, c.al, 1, c.perDay);
}

function dropContract(s: GameState, c: Contract): void {
  s.contracts = s.contracts.filter((x) => x !== c);
  s.schedule = s.schedule.filter((p) => p.al !== c.al);
}

function leave(s: GameState, c: Contract): void {
  s.rep[c.al] = Math.max(0, repOf(s, c.al) - 10);
  dropContract(s, c);
  pushEvent(s, 'airlineLeft', 0, 0, c.al);
}

// ------------------------------------------------------------------ offers

export function makeOffer(s: GameState, al: number): AirlineOffer {
  const id = s.nextId++;
  const k = kindOf(al);
  const rep = repOf(s, al);
  const u = gh(s, id * 17 + 1);
  return {
    id,
    al,
    perDay: Math.max(1, Math.min(k.maxPerDay, Math.round(k.perDay * tierDef(s.tier).traffic * (0.85 + 0.3 * gh(s, id * 17 + 2))))),
    pay: round2(k.pay * (0.9 + 0.2 * u) * (0.9 + rep / 500)),
    goal: k.goal,
    days: k.days,
    expiresAt: s.time + OFFER_LIFETIME + Math.floor(gh(s, id * 17 + 3) * 90),
    negotiated: false,
  };
}

/** Offers come and go; seasonal contracts end. Call once per step. */
export function updateAirlines(s: GameState): void {
  if (s.offers.length > 0) {
    const before = s.offers.length;
    s.offers = s.offers.filter((o) => o.expiresAt > s.time);
    if (s.offers.length !== before) pushEvent(s, 'offerExpired', 0, 0, before - s.offers.length);
  }
  for (const c of s.contracts.slice()) {
    if (c.endsAt === 0 || s.time < c.endsAt) continue;
    // a season ends after its last planned flight has gone
    const met = onTimeRate(c) >= c.goal;
    const bonus = met ? Math.round(c.earned * 0.2) : 0;
    if (bonus > 0) {
      s.money = s.money.add(bonus);
      s.stats.earned = s.stats.earned.add(bonus);
    }
    s.rep[c.al] = Math.max(0, Math.min(100, repOf(s, c.al) + (met ? 5 : -3)));
    dropContract(s, c);
    pushEvent(s, 'contractEnded', 0, 0, c.al, bonus, met ? 1 : 0);
  }
  if (s.time < s.nextOfferAt) return;
  s.nextOfferAt = s.time + 110 + gh(s, s.tick * 3 + 11) * 80;
  if (s.offers.length >= MAX_OFFERS) return;
  const pool = availableAirlines(s);
  if (pool.length === 0) return;
  // airlines that like you come first
  const w = pool.map((i) => AIRLINES[i].weight * (0.5 + repOf(s, i) / 100));
  const total = w.reduce((a, b) => a + b, 0);
  let u = gh(s, s.tick * 3 + 13) * total;
  let pick = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    u -= w[i];
    if (u < 0) {
      pick = pool[i];
      break;
    }
  }
  const o = makeOffer(s, pick);
  s.offers.push(o);
  pushEvent(s, 'offerArrived', 0, 0, o.al, o.id);
}

export function signOffer(s: GameState, offerId: number): number {
  const o = s.offers.find((x) => x.id === offerId);
  if (!o) return REJECT.unknownFlight;
  if (s.contracts.length >= contractSlots(s)) return REJECT.limit;
  if (airlineBlocker(s, o.al)) return REJECT.needs;
  s.offers = s.offers.filter((x) => x !== o);
  s.contracts.push(makeContract(s, o.al, o.perDay, o.pay, o.goal, o.days, s.time + 20));
  pushEvent(s, 'contractSigned', 0, 0, o.al);
  return 0;
}

/** Chance that asking for more pay works (better reputation, better odds). */
export function askChance(s: GameState, o: AirlineOffer): number {
  return Math.max(0.15, Math.min(0.85, 0.35 + (repOf(s, o.al) - 50) / 100));
}

/** mode 0: ask for 15% more pay (they may walk away); 1: 12% less pay for more flights. */
export function negotiateOffer(s: GameState, offerId: number, mode: number): number {
  const o = s.offers.find((x) => x.id === offerId);
  if (!o) return REJECT.unknownFlight;
  if (o.negotiated) return REJECT.limit;
  o.negotiated = true;
  const k = kindOf(o.al);
  if (mode === 1) {
    o.pay = round2(o.pay * 0.88);
    o.perDay = Math.min(k.maxPerDay, o.perDay + k.step);
    pushEvent(s, 'offerResult', 0, 0, o.al, 1, 1);
    return 0;
  }
  if (gh(s, o.id * 211 + 7) < askChance(s, o)) {
    o.pay = round2(o.pay * 1.15);
    pushEvent(s, 'offerResult', 0, 0, o.al, 0, 1);
  } else {
    s.offers = s.offers.filter((x) => x !== o);
    s.rep[o.al] = Math.max(0, repOf(s, o.al) - 3);
    pushEvent(s, 'offerResult', 0, 0, o.al, 0, 0);
  }
  return 0;
}

export function declineOffer(s: GameState, offerId: number): number {
  const before = s.offers.length;
  s.offers = s.offers.filter((x) => x.id !== offerId);
  return s.offers.length === before ? REJECT.unknownFlight : 0;
}

/** Can the airline be asked for more flights now? */
export function canExpand(s: GameState, c: Contract): boolean {
  return repOf(s, c.al) >= REP_EXPAND && c.perDay < kindOf(c.al).maxPerDay && s.time - c.expandedAt >= EXPAND_COOLDOWN && c.endsAt === 0;
}

export function expandContract(s: GameState, al: number): number {
  const c = contractOf(s, al);
  if (!c) return REJECT.unknownFlight;
  if (!canExpand(s, c)) return REJECT.needs;
  c.perDay = Math.min(kindOf(al).maxPerDay, c.perDay + kindOf(al).step);
  c.expandedAt = s.time;
  pushEvent(s, 'contractExpanded', 0, 0, al, c.perDay);
  return 0;
}

/** Walking away from a contract hurts that airline's opinion of you. */
export function endContract(s: GameState, al: number): number {
  const c = contractOf(s, al);
  if (!c) return REJECT.unknownFlight;
  if (s.contracts.length <= 1) return REJECT.limit;
  s.rep[al] = Math.max(0, repOf(s, al) - 15);
  dropContract(s, c);
  pushEvent(s, 'contractEnded', 0, 0, al, 0, 2);
  return 0;
}
