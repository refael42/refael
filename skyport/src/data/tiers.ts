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

export interface ServiceHome {
  home: P2;
  via: P2;
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
  /**
   * Taxiway graph: one-way edges (directed), so the ground flow is a DAG from
   * the runway exit to the stands and from the stands to the hold-short point.
   * Stand edges (lane -> stand -> lane) are added from the stand list.
   */
  taxi: {
    nodes: Readonly<Record<string, P2>>;
    edges: readonly (readonly [string, string])[];
    /** Where rolling-out planes leave the runway. */
    exit: string;
    /** Where departures wait for takeoff clearance. */
    holdShort: string;
    /** Points from the hold-short node onto the runway, ending aligned for takeoff. */
    lineUp: readonly P2[];
  };
  takeoff: { liftoffX: number; climb: readonly P3[] };
  stands: readonly StandDef[];
  hut: P2;
  hutDoor: P2;
  waitSpots: readonly P2[];
  pump: P2;
  /** Parking spots of the service vehicles. */
  fuel: ServiceHome;
  bags: ServiceHome;
  /** Where idle staff stand. */
  staffSpots: Readonly<Record<string, P2>>;
  /** Spots for things upgrades add to the scene. */
  decor: { kiosk: P2; billboard: P2; benches: readonly P2[] };
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
      T1: [28.6, 24.7],
      La: [27.6, 23.9],
      Lb: [25.8, 23.9],
      Lc: [23.8, 23.9],
      Ld: [21.8, 23.9],
      Le: [19.8, 23.9],
      T2: [16.8, 23.8],
      T3: [14.6, 23.9],
      H: [14.2, 24.7],
    },
    edges: [
      ['E', 'T1'],
      ['T1', 'La'],
      ['La', 'Lb'],
      ['Lb', 'Lc'],
      ['Lc', 'Ld'],
      ['Ld', 'Le'],
      ['Le', 'T2'],
      ['T2', 'T3'],
      ['T3', 'H'],
    ],
    exit: 'E',
    holdShort: 'H',
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
  stands: [
    { id: 'S1', pos: [24.8, 21.9], size: 'small', from: 'Lb', to: 'Lc' },
    { id: 'S2', pos: [22.8, 21.9], size: 'small', from: 'Lc', to: 'Ld' },
    { id: 'S3', pos: [20.8, 21.9], size: 'small', from: 'Ld', to: 'Le' },
  ],
  hut: [21, 17.9],
  hutDoor: [22.45, 19.35],
  waitSpots: [
    [21.35, 19.8],
    [21.75, 20.05],
    [22.15, 19.8],
    [22.85, 19.9],
    [23.25, 19.7],
    [21.55, 20.35],
    [22.0, 20.45],
    [23.0, 20.3],
    [23.45, 20.15],
    [21.2, 20.25],
    [22.5, 20.6],
    [23.65, 20.55],
  ],
  pump: [26.6, 18.9],
  fuel: { home: [26.6, 20.5], via: [26.4, 21.5] },
  bags: { home: [19.5, 20.2], via: [19.6, 21.1] },
  staffSpots: { atc: [21.2, 19.5], fueler: [27.4, 19.9], porter: [19.1, 19.6], agent: [23.4, 19.45] },
  decor: { kiosk: [23.6, 18.25], billboard: [23.2, 12.2], benches: [[20.2, 19.35], [24.7, 19.3]] },
  windsock: [20, 27.9],
  road: [
    [22.1, 17.8],
    [22.1, 17.0],
    [22.4, 12],
    [21.6, 6],
    [22.2, 0],
  ],
  parking: { x0: 23.0, y0: 15.4, x1: 25.6, y1: 17.6 },
  camera: { center: [20.8, 23.0], zoom: 0.72 },
};

export const TIERS: readonly TierDef[] = [{ id: 1, key: 'dirtStrip', layout: DIRT_STRIP }];

export function tierDef(id: number): TierDef {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}
