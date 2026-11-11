/**
 * The control tower (owner request: the tower is part of the game, not only
 * the look). Its line has ten levels:
 * - every level spaces planes tighter behind each other (wake gaps, see
 *   flights.ts) and makes go-arounds rarer, up to the fifth;
 * - and some levels give the tower a new ability:
 *   2  ground control: planes taxi 10% faster;
 *   4  approach control: holding planes keep their patience 25% longer;
 *   6  automatic clearances: the tower clears landings and takeoffs itself
 *      (after a short look) when nobody else has;
 *   8  surface radar: go-arounds a further 30% rarer;
 *   (levels 6 to 10 also make go-arounds a little rarer each)
 *   10 integrated operations: runway operations 10% faster.
 * The weather station (its own line) announces storms earlier, makes
 * crosswind go-arounds rarer and gives a forecast. Pure and deterministic.
 */
import type { TierLayout } from '../../data/tiers';
import { DAY_SECONDS } from './clock';
import { clearLanding, clearTakeoff, wantsAction } from './flights';
import { graphOf } from './graph';
import { layoutOf } from './layout';
import { weatherAt, type Weather } from './weather';
import { WANT, type GameState } from './types';

export type TowerAbility = 'ground' | 'approach' | 'auto' | 'surface' | 'ops';
/** The level each ability comes with. */
export const TOWER_ABILITIES: readonly { id: TowerAbility; level: number }[] = [
  { id: 'ground', level: 2 },
  { id: 'approach', level: 4 },
  { id: 'auto', level: 6 },
  { id: 'surface', level: 8 },
  { id: 'ops', level: 10 },
];
/** Seconds the tower looks before it clears a plane itself (automatic clearances). */
export const AUTO_CLEAR_SECONDS = 5;

export function towerLevel(s: GameState): number {
  return s.upg.tower ?? 0;
}

/** The ability a level brings (null for a level without one). */
export function abilityAt(level: number): TowerAbility | null {
  return TOWER_ABILITIES.find((a) => a.level === level)?.id ?? null;
}

export function hasAbility(s: GameState, id: TowerAbility): boolean {
  const a = TOWER_ABILITIES.find((x) => x.id === id);
  return !!a && towerLevel(s) >= a.level;
}

/** Wake gaps this much shorter at a tower level (10% a level, up to 50% at the fifth). */
export function spacingAt(level: number): number {
  return Math.min(0.5, 0.1 * Math.min(5, level));
}

/**
 * Go-arounds this much rarer at a tower level: 12% a level up to 60% at the
 * fifth, then 3% more a level, and the surface radar takes a further 30% off
 * what is left.
 */
export function goAroundCutAt(level: number): number {
  const l = Math.max(0, Math.min(10, level));
  const base = 0.12 * Math.min(5, l) + 0.03 * Math.max(0, l - 5);
  return level >= 8 ? 1 - (1 - base) * 0.7 : base;
}

export function towerSpacing(s: GameState): number {
  return spacingAt(towerLevel(s));
}

export function goAroundCut(s: GameState): number {
  return goAroundCutAt(towerLevel(s));
}

/** Where the control tower stands on this tier's map (null at the dirt strip, which has none). */
export function towerSpot(tier: number): [number, number] | null {
  return towerSpotOf(layoutOf(tier));
}

/** Where the weather station stands (its fenced square's corner): on the grass north of the first terminal, by the tower. */
export function meteoSpot(tier: number): [number, number] | null {
  return meteoSpotOf(layoutOf(tier));
}

export function meteoSpotOf(L: TierLayout): [number, number] | null {
  const t = towerSpotOf(L);
  return t ? [t[0] + 1.8, t[1] - 3.2] : null;
}

/** A piece of the ILS on the map. */
export interface IlsPart {
  kind: 'loc' | 'gs';
  x: number;
  y: number;
  /** The way planes land that it serves (+1 toward +x, -1 toward -x). */
  dir: number;
}

/**
 * The ILS on the map: for each runway direction it serves, a localizer past the
 * far end on the centerline and a glideslope beside the touchdown zone (on the
 * side away from the terminals). Levels 1 and 2 serve landings toward +x; level
 * 3 (CAT III) both ways. None on a dirt strip. Each piece moves out along the
 * runway until it is clear of the taxiways.
 */
export function ilsParts(tier: number, level: number): IlsPart[] {
  const key = tier * 10 + Math.min(3, level);
  const hit = ilsCache.get(key);
  if (hit) return hit;
  const L = layoutOf(tier);
  const R = L.runway;
  const out: IlsPart[] = [];
  if (level > 0 && R.surface !== 'dirt') {
    const g = graphOf(tier);
    // the taxiway edges (not the runway's own)
    const onRunway = (q: readonly number[]) => Math.abs(q[1] - R.y) < 0.05 && q[0] >= R.x0 - 0.05 && q[0] <= R.x1 + 0.05;
    const taxi = g.edges.filter((e) => !(onRunway(g.pos[e.from]) && onRunway(g.pos[e.to]))).map((e) => [g.pos[e.from], g.pos[e.to]] as const);
    // how far a piece (a row across the runway's line) is from the nearest taxiway
    const room = (x: number, y0: number, y1: number) => {
      let d = Infinity;
      for (let y = y0; y <= y1 + 1e-6; y += 0.3) for (const [a, b] of taxi) d = Math.min(d, segDist(x, y, a, b));
      return d;
    };
    // the first spot along a stretch with room for a wide-body's wing beside it, else the roomiest
    const place = (from: number, step: number, n: number, y0: number, y1: number, want: number) => {
      let best = from;
      let bestRoom = -1;
      for (let k = 0; k <= n; k++) {
        const x = from + k * step;
        const r = room(x, y0, y1);
        if (r >= want) return x;
        if (r > bestRoom + 1e-6) {
          bestRoom = r;
          best = x;
        }
      }
      return best;
    };
    const F = L.field;
    for (const dir of level >= 3 ? [1, -1] : [1]) {
      const far = dir > 0 ? R.x1 : R.x0;
      const near = dir > 0 ? R.x0 : R.x1;
      // the localizer: past the end (up to 4 tiles out, inside the fence)
      const reach = Math.max(0, Math.min(4, dir > 0 ? F.x1 - 0.6 - far : far - F.x0 - 0.6) - 0.75);
      const lx = place(far + dir * 0.75, dir * 0.25, Math.floor(reach / 0.25), R.y - 1.05, R.y + 1.05, 1.5);
      out.push({ kind: 'loc', x: lx, y: R.y, dir });
      // the glideslope: down the runway from the threshold
      const gy = R.y + R.width / 2 + 0.8;
      const gx = place(near + dir * 1.4, dir * 0.25, 18, gy - 0.2, gy + 0.2, 1.0);
      out.push({ kind: 'gs', x: gx, y: gy, dir });
    }
  }
  ilsCache.set(key, out);
  return out;
}

const ilsCache = new Map<number, IlsPart[]>();

/** Distance from a point to a segment. */
function segDist(x: number, y: number, a: readonly number[], b: readonly number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

export function towerSpotOf(L: TierLayout): [number, number] | null {
  if (L.building) return [...(L.tower ?? [18.6, 16.6])] as [number, number];
  return L.runway.surface === 'asphalt' ? [18.6, 16.6] : null;
}

/** The weather station's level (0 none). */
export function meteoLevel(s: GameState): number {
  return s.upg.meteo ?? 0;
}

/** Storm warnings this many times earlier. */
export function warningMul(s: GameState): number {
  return 1 + 0.5 * meteoLevel(s);
}

/** Crosswind go-around risk this much lower (pilots get the wind as it is). */
export function crosswindCut(s: GameState): number {
  return 0.15 * meteoLevel(s);
}

/** The forecast an hour ahead (null without a weather station). */
export function forecast(s: GameState): Weather | null {
  if (meteoLevel(s) <= 0) return null;
  return weatherAt(s.seed, s.time + (DAY_SECONDS / 24) * (meteoLevel(s) >= 3 ? 2 : 1), s.tier);
}

/** Automatic clearances: once a plane has waited a few seconds, the tower clears it itself. */
export function updateTower(s: GameState): void {
  if (!hasAbility(s, 'auto') || s.tick % 15 !== 0) return;
  for (const f of s.flights) {
    if (s.time - f.readyAt < AUTO_CLEAR_SECONDS) continue;
    if ((wantsAction(f, WANT.clearLanding) && clearLanding(s, f)) || (wantsAction(f, WANT.clearTakeoff) && clearTakeoff(s, f))) return;
  }
}
