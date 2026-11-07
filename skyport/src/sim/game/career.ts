/**
 * The manager's career (M13): experience and levels, and achievements.
 *
 * Experience comes from what happens in the game, read off the events each
 * step: every flight that leaves (more for bigger planes), upgrades, hires,
 * goals, a new stage, the guide's stars, the inspector found, events handled
 * well. Each level pays coins; every fifth level also gives a chest (diamonds
 * and double income for a while). Achievements have four medals each, from
 * counts of the stats and of the career counters kept here; a medal reached is
 * collected for diamonds. Pure and deterministic.
 */
import { ACHIEVEMENTS, MEDAL_GEMS, type AchMetric } from '../../data/achievements';
import { AIRCRAFT } from '../../data/aircraft';
import { tierDef } from '../../data/tiers';
import { Big } from '../big';
import { pushEvent } from './events';
import type { CareerState, GameState } from './types';

/** Experience for the next level, from this one. */
export function xpToNext(level: number): number {
  return Math.round(25 * Math.pow(level, 1.25));
}
/** Coins for reaching a level (times the tier's pay). */
export const LEVEL_COINS = 50;
/** Every this many levels, a chest. */
export const CHEST_EVERY = 5;
/** A chest: diamonds and double income for this many game seconds. */
export const CHEST_GEMS = 10;
export const BOOST_SECONDS = 180;

export function newCareer(): CareerState {
  return { level: 1, xp: 0, chests: 0, boostUntil: 0, counts: {}, medals: ACHIEVEMENTS.map(() => 0), seen: 0 };
}

const bump = (c: CareerState, k: string, n = 1) => (c.counts[k] = (c.counts[k] ?? 0) + n);

/** Adds experience; levels up (with their rewards) as it fills. */
export function gainXp(s: GameState, n: number): void {
  const c = s.career;
  c.xp += n;
  while (c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level++;
    const coins = Math.round(LEVEL_COINS * c.level * tierDef(s.tier).pay);
    s.money = s.money.add(Big.fromNumber(coins));
    s.stats.earned = s.stats.earned.add(Big.fromNumber(coins));
    const chest = c.level % CHEST_EVERY === 0;
    if (chest) c.chests++;
    pushEvent(s, 'managerLevel', 0, 0, c.level, coins, chest ? 1 : 0);
  }
}

/** Double income while a chest's boost lasts. */
export function incomeBoost(s: GameState): number {
  return s.time < s.career.boostUntil ? 2 : 1;
}

/** Opens a chest: diamonds, and double income for a while (more time if one is already on). */
export function openChest(s: GameState): boolean {
  const c = s.career;
  if (c.chests <= 0) return false;
  c.chests--;
  s.diamonds += CHEST_GEMS;
  c.boostUntil = Math.max(s.time, c.boostUntil) + BOOST_SECONDS;
  pushEvent(s, 'chestOpened', 0, 0, CHEST_GEMS, BOOST_SECONDS);
  return true;
}

/** How far along an achievement's metric is. */
export function metric(s: GameState, m: AchMetric): number {
  const st = s.stats;
  const c = s.career.counts;
  switch (m) {
    case 'served':
      return st.served;
    case 'pax':
      return st.pax;
    case 'earned':
      return st.earned.toNumber();
    case 'onTime':
      return st.onTime;
    case 'sales':
      return st.sales.toNumber();
    case 'checks':
      return st.checks;
    case 'guests':
      return st.guests;
    case 'stands':
      return Math.max(c.stands ?? 0, s.standsBuilt);
    case 'staff':
      return Math.max(c.staff ?? 0, s.staff.length);
    case 'airlines':
      return Math.max(c.airlines ?? 0, s.contracts.length);
    case 'tier':
      return Math.max(c.tier ?? 0, s.tier);
    case 'upgrades':
      return Object.values(s.upg).reduce((a, b) => a + b, 0);
    case 'level':
      return s.career.level;
    default:
      return c[m] ?? 0;
  }
}

/** Medals an achievement has reached (0..4) and collected. */
export function medalsOf(s: GameState, i: number): { reached: number; claimed: number; value: number; next: number } {
  const a = ACHIEVEMENTS[i];
  const value = metric(s, a.metric);
  let reached = 0;
  while (reached < 4 && value >= a.medals[reached]) reached++;
  return { reached, claimed: s.career.medals[i] ?? 0, value, next: reached < 4 ? a.medals[reached] : a.medals[3] };
}

/** Medals waiting to be collected. */
export function medalsToClaim(s: GameState): number {
  let n = 0;
  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const m = medalsOf(s, i);
    n += Math.max(0, m.reached - m.claimed);
  }
  return n;
}

/** Collects every medal an achievement has reached (diamonds for each). */
export function claimMedals(s: GameState, i: number): boolean {
  if (i < 0 || i >= ACHIEVEMENTS.length) return false;
  const m = medalsOf(s, i);
  if (m.reached <= m.claimed) return false;
  let gems = 0;
  for (let k = m.claimed; k < m.reached; k++) gems += MEDAL_GEMS[k];
  s.career.medals[i] = m.reached;
  s.diamonds += gems;
  pushEvent(s, 'medal', 0, 0, i, m.reached, gems);
  return true;
}

/** Experience for a flight that left: bigger planes give more. */
function flightXp(s: GameState, flightId: number): number {
  const f = s.flights.find((x) => x.id === flightId);
  const ac = f ? AIRCRAFT[f.aircraft] : undefined;
  return ac ? 2 + Math.ceil(ac.paxMax / 60) : 3;
}

/** Reads the step's new events: experience and career counters. */
export function updateCareer(s: GameState): void {
  const c = s.career;
  // (only the new ones: from the end back to the last one seen)
  let i = s.events.length;
  while (i > 0 && s.events[i - 1].id > c.seen) i--;
  const end = s.events.length;
  for (; i < end; i++) {
    const e = s.events[i];
    c.seen = e.id;
    switch (e.kind) {
      case 'paid':
        gainXp(s, flightXp(s, e.c));
        break;
      case 'upgraded':
        gainXp(s, 2 * Math.max(1, e.a));
        break;
      case 'hired':
        gainXp(s, 5);
        break;
      case 'goalDone':
        gainXp(s, 10);
        break;
      case 'milestone':
        gainXp(s, 5);
        break;
      case 'tierUp':
        gainXp(s, 40 * e.a);
        break;
      case 'guideEdition':
        bump(c, 'guideStars', e.a);
        gainXp(s, 20 * e.a);
        break;
      case 'inspectorLeft':
        if (e.a === 1) {
          bump(c, 'inspectors');
          gainXp(s, 15);
        }
        break;
      case 'review':
        if (e.a >= 5) {
          bump(c, 'fiveStars');
          gainXp(s, 1);
        }
        break;
      case 'incidentEnd':
        if (e.b > 0) {
          bump(c, 'incidents');
          gainXp(s, 8);
        }
        break;
      case 'emergencyLanded':
        bump(c, 'emergencies');
        gainXp(s, 10);
        break;
      case 'holiday':
        if (e.b === 1) bump(c, 'holidays');
        break;
    }
  }
  // the best ever of what can go down again (a new airport later starts over)
  c.counts.stands = Math.max(c.counts.stands ?? 0, s.standsBuilt);
  c.counts.staff = Math.max(c.counts.staff ?? 0, s.staff.length);
  c.counts.airlines = Math.max(c.counts.airlines ?? 0, s.contracts.length);
  c.counts.tier = Math.max(c.counts.tier ?? 0, s.tier);
}
