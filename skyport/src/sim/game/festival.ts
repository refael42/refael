/**
 * Festivals and flash deals (M13).
 *
 * A festival runs for three game days, one after another, each with its own
 * theme: points come from what the theme is about (charter flights, the big
 * jets, leaving on time, VIPs, happy families, cargo). Three prize tiers pay
 * coins and diamonds as the points come in, and the top tier also gives the
 * festival's own trophy (kept for the career). Which festival comes next is a
 * hash of the seed and its number.
 *
 * A flash deal shows up every three real hours (the phone's clock, see
 * daily.ts) for twenty minutes: the best upgrade right now at 40% off, once.
 */
import { AIRCRAFT } from '../../data/aircraft';
import { tierDef } from '../../data/tiers';
import { Big } from '../big';
import { hash01 } from '../hash';
import { DAY_SECONDS } from './clock';
import { pushEvent } from './events';
import { addLevel, boughtLevel, offers, unitCost } from './upgrades';
import { levelCap, upgradeDef } from '../../data/upgrades';
import type { FestState, GameEvent, GameState } from './types';

export type FestivalKind = 'charter' | 'jumbo' | 'onTime' | 'vip' | 'family' | 'cargo';
export interface FestivalDef {
  kind: FestivalKind;
  icon: string;
  /** Points for the three prize tiers. */
  goals: readonly [number, number, number];
  /** The festival can come from this tier on. */
  tier: number;
}

export const FESTIVALS: readonly FestivalDef[] = [
  { kind: 'onTime', icon: 'clock', goals: [10, 30, 60], tier: 1 },
  { kind: 'charter', icon: 'takeoff', goals: [8, 24, 50], tier: 1 },
  { kind: 'family', icon: 'pax', goals: [10, 30, 60], tier: 2 },
  { kind: 'vip', icon: 'star', goals: [3, 8, 16], tier: 3 },
  { kind: 'jumbo', icon: 'plane', goals: [4, 12, 25], tier: 5 },
  { kind: 'cargo', icon: 'bag', goals: [4, 12, 24], tier: 5 },
];
export function newFest(): FestState {
  return { n: -1, kind: 0, points: 0, prizes: 0, trophies: {}, seen: 0, dealN: -1, dealId: '', dealTaken: -1 };
}

/** Game days a festival lasts (one starts when the last ends). */
export const FESTIVAL_DAYS = 3;
/** Prize tiers: coins (times the tier's pay) and diamonds. */
export const FESTIVAL_PRIZES: readonly { coins: number; gems: number }[] = [
  { coins: 300, gems: 0 },
  { coins: 800, gems: 5 },
  { coins: 2000, gems: 15 },
];

/** Real minutes between flash deals, and how long one lasts; the discount. */
export const DEAL_EVERY_MIN = 180;
export const DEAL_MINUTES = 20;
export const DEAL_OFF = 0.4;

/** When festival n (0, 1, ...) starts: at the start of the game, then every three days. */
export function festivalStart(n: number): number {
  return n * FESTIVAL_DAYS * DAY_SECONDS;
}

/** Which festival number n is (a hash, among those open at this tier; never the same twice in a row). */
export function festivalKind(s: GameState, n: number): number {
  const open = FESTIVALS.map((f, i) => (f.tier <= s.tier ? i : -1)).filter((i) => i >= 0);
  let k = open[Math.floor(hash01(s.seed * 151 + n * 17) * open.length)];
  if (n > 0 && open.length > 1 && k === s.fest.kind) k = open[(open.indexOf(k) + 1) % open.length];
  return k;
}

/** Points an event brings to the running festival. */
function pointsFor(s: GameState, kind: FestivalKind, e: GameEvent): number {
  switch (kind) {
    case 'onTime':
      // a flight that left on time (the board logs it as paid with no delay)
      return e.kind === 'paid' && (s.flights.find((f) => f.id === e.c)?.onTime ?? 0) > 0 ? 1 : 0;
    case 'charter': {
      if (e.kind !== 'paid') return 0;
      const f = s.flights.find((x) => x.id === e.c);
      const ac = f ? AIRCRAFT[f.aircraft] : undefined;
      // (the small planes: light singles and twins, business jets, turboprops, helicopters, air taxis)
      return ac && (ac.category === 'lightSingle' || ac.category === 'lightTwin' || ac.category === 'bizjet' || ac.category === 'turboprop' || ac.category === 'heli' || ac.category === 'evtol') ? 1 : 0;
    }
    case 'family':
      return e.kind === 'review' && e.a >= 4 ? 1 : 0;
    case 'vip':
      return e.kind === 'vipTip' || e.kind === 'celebTip' ? 1 : 0;
    case 'jumbo': {
      if (e.kind !== 'paid') return 0;
      const f = s.flights.find((x) => x.id === e.c);
      const ac = f ? AIRCRAFT[f.aircraft] : undefined;
      return ac && (ac.stand === 'huge' || ac.stand === 'hugeX' || ac.category === 'narrowX') ? 1 : 0;
    }
    case 'cargo': {
      if (e.kind !== 'paid') return 0;
      const f = s.flights.find((x) => x.id === e.c);
      return f && AIRCRAFT[f.aircraft]?.category === 'cargo' ? 1 : 0;
    }
  }
}

/** Festival n begins (the last one's points are gone; its prizes were paid as they came). */
function startFestival(s: GameState, n: number): void {
  const f = s.fest;
  // (the first one of a game starts quietly with it)
  const quiet = f.n < 0;
  f.n = n;
  f.kind = festivalKind(s, n);
  f.points = 0;
  f.prizes = 0;
  if (!quiet) pushEvent(s, 'festivalStart', 0, 0, f.kind, n);
}

/** Pays the prize tiers the points have reached (the top one also gives the festival's trophy). */
function payPrizes(s: GameState): void {
  const f = s.fest;
  const def = FESTIVALS[f.kind];
  while (f.prizes < 3 && f.points >= def.goals[f.prizes]) {
    const p = FESTIVAL_PRIZES[f.prizes];
    const coins = Math.round(p.coins * tierDef(s.tier).pay);
    s.money = s.money.add(Big.fromNumber(coins));
    s.stats.earned = s.stats.earned.add(Big.fromNumber(coins));
    s.diamonds += p.gems;
    f.prizes++;
    if (f.prizes === 3) f.trophies[def.kind] = (f.trophies[def.kind] ?? 0) + 1;
    pushEvent(s, 'festivalPrize', coins, p.gems, f.kind, f.prizes);
  }
}

export function updateFestival(s: GameState): void {
  const f = s.fest;
  if (s.tick % 30 === 0) pickDeal(s);
  // the festival of this time (a new one every three days)
  const n = Math.floor(s.time / (FESTIVAL_DAYS * DAY_SECONDS));
  if (n !== f.n) startFestival(s, n);
  const kind = FESTIVALS[f.kind].kind;
  let i = s.events.length;
  while (i > 0 && s.events[i - 1].id > f.seen) i--;
  for (; i < s.events.length; i++) {
    const e = s.events[i];
    f.seen = e.id;
    const p = pointsFor(s, kind, e);
    if (p > 0) {
      f.points += p;
      payPrizes(s);
    }
  }
}

/** Time left in the festival (game seconds). */
export function festivalLeft(s: GameState): number {
  return Math.max(0, festivalStart(s.fest.n + 1) - s.time);
}

// ------------------------------------------------------------------ flash deals

/** The deal window of this real minute (a new one every DEAL_EVERY_MIN). */
const dealWindow = (now: number) => Math.floor(now / DEAL_EVERY_MIN);

/** The deal on now: an upgrade's next level at DEAL_OFF off, minutes left; null when none. */
export function flashDeal(s: GameState): { id: string; left: number; price: Big } | null {
  const f = s.fest;
  const now = s.daily.now;
  if (now < 0 || !f.dealId || f.dealN !== dealWindow(now) || f.dealTaken === f.dealN) return null;
  const into = now - f.dealN * DEAL_EVERY_MIN;
  if (into >= DEAL_MINUTES) return null;
  const def = upgradeDef(f.dealId);
  if (!def || boughtLevel(s, def.id) >= levelCap(def, s.tier)) return null;
  return { id: f.dealId, left: DEAL_MINUTES - into, price: unitCost(s, def, boughtLevel(s, def.id)).mul(Big.fromNumber(1 - DEAL_OFF)).ceil() };
}

/** A new deal window: the best upgrade right now (no construction ones) is the deal. */
function pickDeal(s: GameState): void {
  const f = s.fest;
  const n = dealWindow(s.daily.now);
  if (s.daily.now < 0 || f.dealN === n) return;
  f.dealN = n;
  let best: { id: string; roi: number } | null = null;
  for (const o of offers(s)) {
    if (upgradeDef(o.id)?.buildSeconds) continue;
    if (!best || o.roi > best.roi) best = o;
  }
  f.dealId = best?.id ?? '';
}

/** Buys the deal (one level at the lower price). False when there is none or no money. */
export function buyDeal(s: GameState): boolean {
  const d = flashDeal(s);
  if (!d || s.money.lt(d.price)) return false;
  s.money = s.money.sub(d.price);
  s.stats.spent = s.stats.spent.add(d.price);
  addLevel(s, d.id);
  s.fest.dealTaken = s.fest.dealN;
  pushEvent(s, 'dealBought', 0, 0, 0, 0, 0);
  return true;
}
