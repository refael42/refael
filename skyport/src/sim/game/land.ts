/**
 * Land expansions and facilities (owner request: the airport grows to the
 * sides like a Hay Day farm or a Clash of Clans village). See data/land.ts.
 *
 * - A wild plot (first row: any; second row: the one north of it must be the
 *   airport's) is bought for coins, then cleared over time (diamonds rush it).
 *   Clearing finds 1 or 2 diamonds and gives the manager experience.
 * - On a cleared plot one facility is built (coins and time), then upgraded to
 *   level 5. A facility fills with coins at its rate until it is full; the
 *   player collects them. The solar farm pays its coins in by itself; the
 *   garden makes no coins but puts passengers in a better mood.
 * - Prices and rates follow the airport: the tier's pay, or the income of the
 *   last minutes when that is more, so they stay worth it as the airport grows.
 * Pure and deterministic.
 */
import { FACILITIES, FACILITY_MAX, OBSTACLE_KINDS, plotsFor, type FacilityDef, type ObstacleKind, type PlotDef } from '../../data/land';
import { tierDef } from '../../data/tiers';
import { Big } from '../big';
import { hash01 } from '../hash';
import { gainXp } from './career';
import { pushEvent } from './events';
import { incomeRate } from './income';
import { layoutOf } from './layout';
import { REJECT, type GameState, type LandState, type PlotState } from './types';

/** Growth of the expansion price with each plot owned, and of a facility's price with each level. */
export const PLOT_GROWTH = 1.45;
export const LEVEL_GROWTH = 2.2;
/** Seconds of clearing for the first plot, and more for each plot owned (capped). */
export const CLEAR_BASE = 40;
export const CLEAR_STEP = 25;
export const CLEAR_MAX = 600;
/** Diamonds that rush a job, per 30 s left. */
export const RUSH_PER = 30;
/** The garden's mood bonus per level. */
export const GARDEN_MOOD = 0.012;

export function newLand(): LandState {
  return { plots: {} };
}

/** The plots this tier's world has room for. */
export function landPlots(s: GameState): PlotDef[] {
  const L = layoutOf(s.tier);
  return plotsFor(L.world.w, L.world.h);
}

export function plotDef(s: GameState, id: number): PlotDef | undefined {
  return landPlots(s).find((p) => p.id === id);
}

export function plotOf(s: GameState, id: number): PlotState | undefined {
  return s.land.plots[id];
}

export function ownedCount(s: GameState): number {
  let n = 0;
  for (const k in s.land.plots) if (s.land.plots[k].state === 2) n++;
  return n;
}

/** A price unit for this airport now (coins): the tier's pay, or a minute of income when that is more. */
function unit(s: GameState): number {
  return Math.max(800 * tierDef(s.tier).pay, 60 * incomeRate(s));
}

/** Rounds to two significant digits (prices read better). */
function round2(v: number): number {
  if (v < 100) return Math.ceil(v);
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.ceil(v / p) * p;
}

/** What the next plot costs (it grows with the plots owned). */
export function plotCost(s: GameState): number {
  return round2(2 * unit(s) * Math.pow(PLOT_GROWTH, ownedCount(s)));
}

/** Seconds to clear the next plot. */
export function clearSeconds(s: GameState): number {
  return Math.min(CLEAR_MAX, CLEAR_BASE + CLEAR_STEP * ownedCount(s));
}

/** Whether a plot can be bought now: wild, and on the first row or south of an owned one; nothing else being cleared. */
export function canBuyPlot(s: GameState, id: number): boolean {
  const def = plotDef(s, id);
  if (!def || s.land.plots[id]) return false;
  if (Object.values(s.land.plots).some((p) => p.state === 1)) return false;
  if (def.row === 0) return true;
  return s.land.plots[id - 100]?.state === 2;
}

/** The obstacles on a wild plot (kind and spot, in tiles inside the plot), the same every time. */
export function obstaclesOf(def: PlotDef): { kind: ObstacleKind; x: number; y: number }[] {
  const out: { kind: ObstacleKind; x: number; y: number }[] = [];
  const n = 6 + Math.floor(hash01(def.id * 13 + 1) * 4);
  const [x0, y0, x1, y1] = def.box;
  for (let k = 0; k < n; k++) {
    const kind = OBSTACLE_KINDS[Math.floor(hash01(def.id * 13 + k * 7 + 2) * OBSTACLE_KINDS.length)];
    // (spread on a loose grid, so they do not pile up)
    const gx = k % 3;
    const gy = Math.floor(k / 3) % 3;
    const x = x0 + 0.6 + ((gx + 0.2 + hash01(def.id * 13 + k * 7 + 3) * 0.6) / 3) * (x1 - x0 - 1.2);
    const y = y0 + 0.5 + ((gy + 0.2 + hash01(def.id * 13 + k * 7 + 4) * 0.6) / 3) * (y1 - y0 - 1.0);
    out.push({ kind, x, y });
  }
  return out;
}

/** Buys a plot: coins now, then the clearing runs. 0 or a REJECT code. */
export function buyPlot(s: GameState, id: number): number {
  if (!canBuyPlot(s, id)) return REJECT.limit;
  const cost = Big.fromNumber(plotCost(s));
  if (s.money.lt(cost)) return REJECT.noMoney;
  s.money = s.money.sub(cost);
  s.stats.spent = s.stats.spent.add(cost);
  const t = clearSeconds(s);
  s.land.plots[id] = { state: 1, left: t, total: t, f: -1, lv: 0, store: 0 };
  pushEvent(s, 'plotBought', 0, 0, id, t);
  return 0;
}

/** Diamonds that rush the job on a plot now (clearing or building). */
export function rushCost(s: GameState, id: number): number {
  const p = s.land.plots[id];
  if (!p || p.left <= 0) return 0;
  return Math.max(1, Math.ceil(p.left / RUSH_PER));
}

export function rushPlot(s: GameState, id: number): number {
  const p = s.land.plots[id];
  const gems = rushCost(s, id);
  if (!p || gems <= 0) return REJECT.limit;
  if (s.diamonds < gems) return REJECT.noMoney;
  s.diamonds -= gems;
  p.left = 0.001;
  return 0;
}

/** What building (level 0 → 1) or upgrading a facility on this plot costs next. */
export function facilityCost(s: GameState, f: number, level: number): number {
  const def = FACILITIES[f];
  return def ? round2(1.5 * unit(s) * def.cost * Math.pow(LEVEL_GROWTH, level)) : 0;
}

export function facilitySeconds(level: number): number {
  return 30 * (level + 1);
}

/** Builds a facility on an owned, empty plot, or upgrades the one there. 0 or a REJECT code. */
export function buildFacility(s: GameState, id: number, f: number): number {
  const p = s.land.plots[id];
  if (!p || p.state !== 2 || p.left > 0) return REJECT.limit;
  if (p.f >= 0 && p.f !== f) return REJECT.limit;
  if (!FACILITIES[f] || p.lv >= FACILITY_MAX) return REJECT.limit;
  const cost = Big.fromNumber(facilityCost(s, f, p.lv));
  if (s.money.lt(cost)) return REJECT.noMoney;
  s.money = s.money.sub(cost);
  s.stats.spent = s.stats.spent.add(cost);
  p.f = f;
  const t = facilitySeconds(p.lv);
  p.left = t;
  p.total = t;
  pushEvent(s, 'facilityStart', 0, 0, id, f, p.lv + 1);
  return 0;
}

/** Coins a facility makes a second at its level (0 for the garden). */
export function facilityRate(s: GameState, p: PlotState): number {
  const def = FACILITIES[p.f];
  if (!def || p.lv <= 0 || def.rate <= 0) return 0;
  let r = 0.06 * unit(s) / 60 * def.rate * (1 + 0.6 * (p.lv - 1));
  // (the car rental is busier with more passengers; the logistics centre with cargo flights)
  if (def.id === 'rental') r *= 1 + Math.min(1, s.stats.served / 2000);
  if (def.id === 'logistics') r *= 1 + Math.min(1, (s.stats.checks + s.tier) / 20);
  return r;
}

/** How many coins a facility holds when full. */
export function facilityCap(s: GameState, p: PlotState): number {
  const def = FACILITIES[p.f];
  return def ? facilityRate(s, p) * def.capMin * 60 : 0;
}

/** Collects what a facility has made. 0 or a REJECT code. */
export function collectFacility(s: GameState, id: number): number {
  const p = s.land.plots[id];
  if (!p || p.store < 1) return REJECT.limit;
  const coins = Math.floor(p.store);
  p.store -= coins;
  s.money = s.money.add(Big.fromNumber(coins));
  s.stats.earned = s.stats.earned.add(Big.fromNumber(coins));
  // (the flight school's students also teach the manager a thing or two)
  if (FACILITIES[p.f]?.id === 'school') gainXp(s, 1 + p.lv);
  pushEvent(s, 'collected', 0, 0, id, coins);
  return 0;
}

/** The garden's mood bonus (all gardens, by level). */
export function gardenMood(s: GameState): number {
  let m = 0;
  for (const k in s.land.plots) {
    const p = s.land.plots[k];
    if (FACILITIES[p.f]?.id === 'garden' && p.left <= 0) m += GARDEN_MOOD * p.lv;
  }
  return Math.min(0.12, m);
}

/** Runs the clearings and the builds, and the facilities' making. Every half second. */
export function updateLand(s: GameState): void {
  if (s.tick % 15 !== 0) return;
  const dt = 0.5;
  for (const k in s.land.plots) {
    const id = Number(k);
    const p = s.land.plots[k];
    if (p.left > 0) {
      p.left = Math.max(0, p.left - dt);
      if (p.left > 0) continue;
      if (p.state === 1) {
        // cleared: the land is the airport's; diamonds turn up under the rocks
        p.state = 2;
        const gems = 1 + (hash01(s.seed * 31 + id * 7) < 0.35 ? 1 : 0);
        s.diamonds += gems;
        gainXp(s, 6 + ownedCount(s));
        pushEvent(s, 'plotCleared', 0, 0, id, gems);
      } else if (p.f >= 0) {
        p.lv = Math.min(FACILITY_MAX, p.lv + 1);
        s.upgRev++;
        pushEvent(s, 'facilityBuilt', 0, 0, id, p.f, p.lv);
      }
      continue;
    }
    if (p.state !== 2 || p.lv <= 0) continue;
    const def: FacilityDef | undefined = FACILITIES[p.f];
    const rate = facilityRate(s, p);
    if (!def || rate <= 0) continue;
    if (def.capMin <= 0) {
      // (the solar farm pays in by itself)
      const coins = rate * dt;
      s.money = s.money.add(Big.fromNumber(coins));
      s.stats.earned = s.stats.earned.add(Big.fromNumber(coins));
    } else p.store = Math.min(facilityCap(s, p), p.store + rate * dt);
  }
}
