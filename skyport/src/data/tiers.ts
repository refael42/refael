/**
 * Airport tiers and their layouts. World units are tiles. The runway runs
 * along +x (landing toward +x); screen up-left is west (-x).
 */
export type P2 = readonly [number, number];
export type P3 = readonly [number, number, number];

export interface StandDef {
  id: string;
  pos: P2;
  size: 'small' | 'medium' | 'large' | 'huge';
  /** Taxi node the stand is entered from and the node it exits to. */
  from: string;
  to: string;
}

export interface TierLayout {
  world: { w: number; h: number };
  /** Fenced, playable area. */
  field: { x0: number; y0: number; x1: number; y1: number };
  runway: { x0: number; x1: number; y: number; width: number; surface: 'dirt' | 'asphalt' };
  approach: {
    spawns: readonly P3[];
    hold: P3;
    holdRadius: number;
    entry: P3;
    faf: P3;
    threshold: P3;
    touchdown: P3;
  };
  /** Ground route from the runway exit to the stand lane, and from the lane to the hold-short point. */
  taxi: {
    nodes: Readonly<Record<string, P2>>;
    arrival: readonly string[];
    departure: readonly string[];
    /** Points from the hold-short node onto the runway, ending aligned for takeoff. */
    lineUp: readonly P2[];
  };
  takeoff: { liftoffX: number; climb: readonly P3[] };
  stands: readonly StandDef[];
  hut: P2;
  hutDoor: P2;
  waitSpots: readonly P2[];
  pump: P2;
  truckHome: P2;
  truckVia: P2;
  windsock: P2;
  road: readonly P2[];
  parking: { x0: number; y0: number; x1: number; y1: number };
  camera: { center: P2; zoom: number };
}

export interface TierDef {
  id: number;
  key: string;
  layout: TierLayout;
}

const DIRT_STRIP: TierLayout = {
  world: { w: 46, h: 46 },
  field: { x0: 11.5, y0: 17.2, x1: 32.5, y1: 28.8 },
  runway: { x0: 13, x1: 31, y: 26, width: 1.3, surface: 'dirt' },
  approach: {
    spawns: [
      [6, 12, 5.2],
      [10, 9, 5.2],
      [3, 17, 5.2],
      [14, 8, 5.2],
    ],
    hold: [15, 21, 3.1],
    holdRadius: 1.6,
    entry: [10.2, 23.4, 2.2],
    faf: [9.6, 26, 1.5],
    threshold: [13.6, 26, 0.35],
    touchdown: [16.2, 26, 0],
  },
  taxi: {
    nodes: {
      E: [28.4, 26],
      T1: [28.6, 24.6],
      La: [27.4, 23.8],
      Lb: [25.4, 23.8],
      Lc: [23.0, 23.8],
      Ld: [20.6, 23.8],
      T2: [16.6, 23.7],
      T3: [14.6, 23.8],
      H: [14.2, 24.6],
    },
    arrival: ['E', 'T1', 'La', 'Lb'],
    departure: ['Lc', 'Ld', 'T2', 'T3', 'H'],
    lineUp: [
      [14.25, 25.5],
      [14.7, 25.95],
      [15.4, 26],
    ],
  },
  takeoff: {
    liftoffX: 21.5,
    climb: [
      [27, 26, 1.1],
      [34, 25.6, 2.8],
      [42, 24, 5],
      [52, 21, 7.5],
    ],
  },
  stands: [{ id: 'S1', pos: [24.2, 22.3], size: 'small', from: 'Lb', to: 'Lc' }],
  hut: [21, 18.6],
  hutDoor: [22.45, 20.05],
  waitSpots: [
    [21.35, 20.5],
    [21.75, 20.75],
    [22.15, 20.5],
    [22.85, 20.6],
    [23.25, 20.4],
    [21.55, 21.05],
    [22.0, 21.15],
    [23.0, 21.0],
    [23.45, 20.85],
    [21.2, 20.95],
    [22.5, 21.35],
    [23.6, 21.3],
  ],
  pump: [26.3, 19.5],
  truckHome: [25.9, 21.0],
  truckVia: [25.5, 21.9],
  windsock: [20, 27.9],
  road: [
    [22.1, 18.4],
    [22.1, 17.0],
    [22.4, 12],
    [21.6, 6],
    [22.2, 0],
  ],
  parking: { x0: 23.0, y0: 15.4, x1: 25.6, y1: 17.6 },
  camera: { center: [20.6, 23.4], zoom: 0.72 },
};

export const TIERS: readonly TierDef[] = [{ id: 1, key: 'dirtStrip', layout: DIRT_STRIP }];

export function tierDef(id: number): TierDef {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}
