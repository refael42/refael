/**
 * Airport security (owner request): guards on patrol in the terminals, the
 * security upgrades (cameras, the perimeter fence, patrol cars, a dog team,
 * drone defence) and three incidents they deal with:
 * - bag: an unattended bag in a hall. The security lanes slow down until a
 *   guard has checked it (cameras spot it sooner, the dog team checks faster);
 * - drone: a drone over the airfield. The runways close until it is gone
 *   (shorter with drone defence and a patrol car out to the runway end);
 * - breach: a hole in the perimeter fence. Departures wait until a patrol car
 *   (or the inspection car) has looked at it; a better fence makes it rarer.
 * Pure and deterministic.
 */
import { roleIndex } from '../../data/staff';
import { tierDef } from '../../data/tiers';
import { Big } from '../big';
import { hash01 } from '../hash';
import { cleanAreas } from './cleaning';
import { layoutOf } from './layout';
import type { GameState, Guard, Incident, IncidentUnit } from './types';

export const GUARD = roleIndex('guard');
/** Guard walking speed (tiles/s). */
const SPEED = 1.15;
/** Seconds to check a bag (half with the dog team). */
export const CHECK_SECONDS = 8;
/** Without cameras, seconds before somebody notices the bag (each camera level takes 2 off). */
export const NOTICE_SECONDS = 22;
/** Without any guard, the city's security comes after this long. */
export const NO_GUARD_SECONDS = 60;
/** A bag cleared within this long is handled well (a small bonus). */
export const BAG_GOOD = 35;
/** A drone keeps the runways closed this long (less with drone defence). */
export const DRONE_SECONDS = 45;
/** Patrol car speed (tiles/s). */
export const PATROL_SPEED = 2.4;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const lv = (s: GameState, id: string) => s.upg[id] ?? 0;

/** Guards on the payroll. */
export function guardCount(s: GameState): number {
  return s.staff.filter((m) => m.role === GUARD).length;
}

/** Guards the terminals need (one for every two busy areas). */
export function guardsNeeded(s: GameState): number {
  return Math.max(1, Math.ceil(cleanAreas(layoutOf(s.tier)).length / 2));
}

/** How secure the airport is, 0..1: cameras, the fence, patrol cars, guards, the dog team, drone defence. */
export function securityLevel(s: GameState): number {
  return clamp(
    0.15 +
      Math.min(10, lv(s, 'cctv')) * 0.025 +
      lv(s, 'fence') * 0.08 +
      lv(s, 'patrol') * 0.06 +
      Math.min(1, guardCount(s) / guardsNeeded(s)) * 0.2 +
      lv(s, 'k9') * 0.05 +
      lv(s, 'droneDefense') * 0.04,
  );
}

/** Seconds before an unattended bag is noticed (cameras help). */
export function noticeSeconds(s: GameState): number {
  return Math.max(2, NOTICE_SECONDS - 2 * lv(s, 'cctv'));
}

/** Seconds a drone keeps the runways closed. */
export function droneSeconds(s: GameState): number {
  return DRONE_SECONDS * Math.max(0.3, 1 - 0.3 * lv(s, 'droneDefense')) * (lv(s, 'patrol') > 0 ? 0.8 : 1);
}

/** How likely a fence breach is, against the base chance (a better fence: rarer). */
export function breachChance(s: GameState): number {
  return Math.max(0.15, 1 - 0.3 * lv(s, 'fence'));
}

// ------------------------------------------------------------------ the incidents

/** Where an unattended bag is left: in one of the busy halls (by hash). Null when there are no halls. */
export function bagSpot(s: GameState, seed: number): [number, number] | null {
  const areas = cleanAreas(layoutOf(s.tier));
  if (areas.length === 0) return null;
  // (left by a passenger: next to one standing in a hall, where it shows)
  const inHall = s.people.filter((p) => areas.some((b) => p.x > b[0] + 0.4 && p.x < b[2] - 0.4 && p.y > b[1] + 0.4 && p.y < b[3] - 0.4));
  if (inHall.length > 0) {
    const p = inHall[Math.floor(hash01(seed * 7 + 4) * inHall.length)];
    const b = areas.find((a) => p.x > a[0] && p.x < a[2] && p.y > a[1] && p.y < a[3])!;
    return [Math.max(b[0] + 0.3, Math.min(b[2] - 0.3, p.x + 0.45)), Math.max(b[1] + 0.3, Math.min(b[3] - 0.3, p.y + 0.3))];
  }
  // (nobody about: along the front edge of a hall, in front of its counters and seats, where it shows)
  const b = areas[Math.floor(hash01(seed * 7 + 1) * areas.length)];
  return [b[0] + (b[2] - b[0]) * (0.25 + 0.5 * hash01(seed * 7 + 2)), b[3] - 0.35];
}

/** Where a drone hovers (over the far end of the runway) and where the fence was cut (a spot on its airside). */
export function droneSpot(s: GameState): [number, number] {
  const r = layoutOf(s.tier).runway;
  return [r.x1 - 2, r.y - 1.4];
}

export function breachSpot(s: GameState, seed: number): [number, number] {
  const F = layoutOf(s.tier).field;
  // the south side or the far east side, away from the terminals
  if (hash01(seed * 11) < 0.6) return [F.x0 + 3 + (F.x1 - F.x0 - 6) * hash01(seed * 11 + 1), F.y1];
  return [F.x1, F.y0 + 3 + (F.y1 - F.y0 - 6) * hash01(seed * 11 + 2)];
}

/** Where the patrol cars live (by the fire station; the inspection car stands in when there is none). */
export function patrolHome(s: GameState): [number, number] {
  const D = layoutOf(s.tier).depot;
  return D ? [D.fire.home[0] - 0.9, D.fire.home[1]] : [25.6, 20.5];
}

/** A patrol car (or the inspection car without one), driving straight out to a spot. */
export function securityUnit(s: GameState, to: [number, number]): IncidentUnit {
  const home = patrolHome(s);
  const kind: IncidentUnit['kind'] = lv(s, 'patrol') > 0 ? 'patrol' : 'opsCar';
  const F = layoutOf(s.tier).field;
  // along the inside of the fence: out to its line, then along it to the spot
  const inner: [number, number] = [Math.min(F.x1 - 0.6, Math.max(F.x0 + 0.6, to[0])), Math.min(F.y1 - 0.6, Math.max(F.y0 + 0.6, to[1]))];
  const path = [home[0], home[1], 0, home[0], inner[1], 0, inner[0], inner[1], 0];
  return { kind, x: home[0], y: home[1], px: home[0], py: home[1], heading: 0, path, pathPos: 0, state: 'out' };
}

/** Bonus for a bag cleared quickly (times the tier's pay). */
export function bagBonus(s: GameState): number {
  return Math.round(40 * tierDef(s.tier).pay);
}

/** Pays a security bonus. */
export function payBonus(s: GameState, amount: number): void {
  s.money = s.money.add(Big.fromNumber(amount));
  s.stats.earned = s.stats.earned.add(Big.fromNumber(amount));
}

// ------------------------------------------------------------------ guards on patrol

/** A point along the round of a hall (a loop just inside its walls). */
function roundPoint(b: readonly number[], t: number): [number, number] {
  const w = b[2] - b[0] - 0.6;
  const h = b[3] - b[1] - 0.6;
  const per = 2 * (w + h);
  let d = (((t % 1) + 1) % 1) * per;
  if (d < w) return [b[0] + 0.3 + d, b[1] + 0.3];
  d -= w;
  if (d < h) return [b[2] - 0.3, b[1] + 0.3 + d];
  d -= h;
  if (d < w) return [b[2] - 0.3 - d, b[3] - 0.3];
  d -= w;
  return [b[0] + 0.3, b[3] - 0.3 - d];
}

/** The bag being looked for (an active bag incident noticed by now), or null. */
function bagToCheck(s: GameState): Incident | null {
  for (const inc of s.incidents) if (inc.kind === 'bag' && inc.state === 'active' && s.time - inc.at >= noticeSeconds(s)) return inc;
  return null;
}

/** One guard for each on the payroll: they walk rounds of the halls, and to a bag when there is one. */
export function updateGuards(s: GameState, dt: number): void {
  const areas = cleanAreas(layoutOf(s.tier));
  const working = s.staff.filter((m) => m.role === GUARD);
  if (areas.length === 0 || working.length === 0) {
    s.guards.length = 0;
    return;
  }
  const ids = new Set(working.map((m) => m.id));
  if (s.guards.some((g) => !ids.has(g.staffId) || g.area >= areas.length)) s.guards = s.guards.filter((g) => ids.has(g.staffId) && g.area < areas.length);
  for (const m of working) {
    if (s.guards.some((g) => g.staffId === m.id)) continue;
    // (spread over the halls, the busiest first)
    const area = s.guards.length % areas.length;
    const p = roundPoint(areas[area], hash01(m.id));
    s.guards.push({ staffId: m.id, area, x: p[0], y: p[1], px: p[0], py: p[1], heading: 0, target: 0, until: 0 });
  }
  const bag = bagToCheck(s);
  // the guard of the bag's hall goes to it; if none, the nearest comes over (round by the corridors: out of
  // sight for the walk, in through the hall's edge nearest the bag)
  let goer: Guard | null = null;
  if (bag) {
    goer = s.guards.find((g) => g.target === bag.id) ?? null;
    if (!goer) {
      const area = areas.findIndex((b) => bag.x >= b[0] && bag.x <= b[2] && bag.y >= b[1] && bag.y <= b[3]);
      goer = s.guards.find((g) => g.area === area) ?? null;
      if (!goer) {
        let best = Infinity;
        for (const g of s.guards) {
          const d = Math.hypot(g.x - bag.x, g.y - bag.y);
          if (d < best) {
            best = d;
            goer = g;
          }
        }
        if (goer && area >= 0) {
          const b = areas[area];
          goer.until = s.time + Math.hypot(goer.x - bag.x, goer.y - bag.y) / (SPEED * 1.6);
          goer.area = area;
          // (they come in at the hall's edge nearest the bag)
          const ex = bag.x - b[0] < b[2] - bag.x ? b[0] + 0.3 : b[2] - 0.3;
          goer.x = ex;
          goer.y = bag.y;
          goer.px = ex;
          goer.py = bag.y;
        }
      }
      if (goer) goer.target = bag.id;
    }
  }
  for (const g of s.guards) {
    g.px = g.x;
    g.py = g.y;
    if (g !== goer) g.target = 0;
    const m = s.staff.find((x) => x.id === g.staffId);
    // (on a break, or on the way over from another hall)
    if (!m || m.breakUntil > s.time || g.until > s.time) continue;
    let goal: [number, number];
    if (g === goer && bag) {
      goal = [bag.x + 0.35, bag.y + 0.2];
    } else {
      const b = areas[g.area];
      goal = roundPoint(b, (s.time * SPEED) / (2 * (b[2] - b[0] + b[3] - b[1])) + hash01(g.staffId));
    }
    const dx = goal[0] - g.x;
    const dy = goal[1] - g.y;
    const d = Math.hypot(dx, dy);
    const step = SPEED * (g === goer ? 1.6 : 1) * dt;
    if (d > 1e-6) g.heading = Math.atan2(dy, dx);
    if (d <= step) {
      g.x = goal[0];
      g.y = goal[1];
    } else {
      g.x += (dx / d) * step;
      g.y += (dy / d) * step;
    }
  }
}

/** A guard on the way over from another hall is out of sight. */
export function guardShown(s: GameState, g: Guard): boolean {
  return g.until <= s.time;
}

/** The guard at the bag (null while none is there yet). */
export function guardAtBag(s: GameState, inc: Incident): Guard | null {
  return s.guards.find((g) => g.target === inc.id && Math.hypot(g.x - inc.x - 0.35, g.y - inc.y - 0.2) < 0.05) ?? null;
}

/** Seconds a guard takes to check the bag (half with the dog team). */
export function checkSeconds(s: GameState): number {
  return CHECK_SECONDS * (lv(s, 'k9') > 0 ? 0.5 : 1);
}
