/**
 * Land expansions (owner request: the airport should grow to the sides, like
 * a Hay Day farm or a Clash of Clans village). South of the airfield's fence
 * lies wild land in plots: clear a plot of its trees and rocks (coins and
 * time) and it is the airport's; on it you build one of the facilities below,
 * which earn coins you come to collect (or, the garden, cheer the passengers
 * up), and you upgrade it level by level. The wider airports have more land.
 */

/** A plot: its id (row * 100 + column) and its footprint in tiles. */
export interface PlotDef {
  id: number;
  row: number;
  col: number;
  box: readonly [number, number, number, number];
}

export const PLOT_W = 6;
export const PLOT_H = 4.5;
/** Rows of plots start here (south of the widest fence) and step by this much; columns too. */
export const PLOT_Y0 = 38.2;
export const PLOT_ROW_STEP = 5.3;
export const PLOT_X0 = 3.5;
export const PLOT_COL_STEP = 6.6;
export const PLOT_ROWS = 2;

/** The plots that fit this world (width w, height h), west to east, the first row first. */
export function plotsFor(w: number, h: number): PlotDef[] {
  const out: PlotDef[] = [];
  for (let row = 0; row < PLOT_ROWS; row++) {
    const y0 = PLOT_Y0 + row * PLOT_ROW_STEP;
    if (y0 + PLOT_H > h - 0.8) continue;
    for (let col = 0; ; col++) {
      const x0 = PLOT_X0 + col * PLOT_COL_STEP;
      if (x0 + PLOT_W > w - 1) break;
      out.push({ id: row * 100 + col, row, col, box: [x0, y0, x0 + PLOT_W, y0 + PLOT_H] });
    }
  }
  return out;
}

export type FacilityId = 'rental' | 'parking' | 'solar' | 'school' | 'logistics' | 'garden' | 'hotel' | 'mall';

export interface FacilityDef {
  id: FacilityId;
  icon: string;
  /** Coins it makes, against the base rate (0: it makes none). */
  rate: number;
  /** Minutes of making before it is full (and stops until collected). */
  capMin: number;
  /** Its price, against the base price. */
  cost: number;
  /** The airport tier it can be built from (1: any). */
  tier?: number;
}

export const FACILITIES: readonly FacilityDef[] = [
  // car rental: busier with more passengers
  { id: 'rental', icon: 'ticket', rate: 1.0, capMin: 8, cost: 1.0 },
  // long-term parking: slow and steady, holds a lot
  { id: 'parking', icon: 'coin', rate: 0.7, capMin: 30, cost: 0.8 },
  // a solar farm: pays its coins in by itself
  { id: 'solar', icon: 'sun', rate: 0.55, capMin: 0, cost: 1.2 },
  // a flight school: coins and the manager's experience
  { id: 'school', icon: 'plane', rate: 0.8, capMin: 12, cost: 1.4 },
  // a logistics centre: the most coins, busier with cargo flights
  { id: 'logistics', icon: 'bag', rate: 1.3, capMin: 10, cost: 1.7 },
  // a garden: passengers in a better mood (no coins)
  { id: 'garden', icon: 'star', rate: 0, capMin: 0, cost: 0.9 },
  // a hotel for travellers: rich guests, from the international airport on
  { id: 'hotel', icon: 'star', rate: 1.8, capMin: 15, cost: 2.4, tier: 5 },
  // an outlet mall: the most of all, from the hub on
  { id: 'mall', icon: 'ticket', rate: 2.4, capMin: 10, cost: 3.2, tier: 6 },
];

export const FACILITY_MAX = 5;

export function facilityIndex(id: FacilityId): number {
  return FACILITIES.findIndex((f) => f.id === id);
}

/** Obstacles on wild land: what stands on a plot until it is cleared. */
export type ObstacleKind = 'tree' | 'pine' | 'rock' | 'boulder' | 'bush' | 'stump' | 'shed' | 'hay';
export const OBSTACLE_KINDS: readonly ObstacleKind[] = ['tree', 'pine', 'rock', 'boulder', 'bush', 'stump', 'shed', 'hay'];
