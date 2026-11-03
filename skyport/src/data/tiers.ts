/**
 * Airport tiers and their layouts. World units are tiles. The runway runs
 * along +x (landing toward +x); screen up-left is west (-x).
 */
export type P2 = readonly [number, number];
export type P3 = readonly [number, number, number];

import type { StandSize } from './aircraft';

export interface StandDef {
  id: string;
  pos: P2;
  size: StandSize;
  /** Taxi node the stand is entered from and the node it exits to (none for a helipad). */
  from?: string;
  to?: string;
  /** Upgrade line and level that build it (none = there from the start). */
  line?: string;
  level?: number;
  /** A jet bridge from the pier: passengers board straight from the gate. */
  bridge?: boolean;
}

export type BuildingKind = 'fbo' | 'pier' | 'cargo' | 'helipad';

export interface BuildingDef {
  kind: BuildingKind;
  /** Footprint corner (lowest x and y) in tiles. */
  pos: P2;
  /** Footprint size in tiles. */
  size: P2;
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
    /** Where rolling-out planes leave the runway (small planes). */
    exit: string;
    /** Every runway exit, nearest first; a plane takes the first one that leads to its stand. */
    exits?: readonly string[];
    /** Where departures wait for takeoff clearance. */
    holdShort: string;
    /** Points from the hold-short node onto the runway, ending aligned for takeoff. */
    lineUp: readonly P2[];
  };
  takeoff: { liftoffX: number; climb: readonly P3[] };
  /** A second, parallel runway used for departures only (landings keep the first one). */
  depRunway?: { x0: number; x1: number; y: number; width: number };
  /** Bigger buildings on the airside (drawn by the renderer, kept clear by build mode). */
  buildings?: readonly BuildingDef[];
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
  /** Passenger stations (landside north of the hut, airside south of it). */
  terminal: {
    /** Where departing passengers appear (walking from the parking lot). */
    entry: P2;
    /** Check-in: counter service points (more open with upgrades) and the queue line (head first). */
    counters: readonly P2[];
    checkinQueue: readonly P2[];
    /** Security: scanner lanes and their queue line (head first). */
    lanes: readonly P2[];
    securityQueue: readonly P2[];
    /** After security, the airside door they walk through. */
    airside: P2;
    /** Bag conveyor from the counters into the building. */
    belt: readonly P2[];
    /** Baggage claim carousel and the way out. */
    claim: P2;
    exit: P2;
  };
  /** Spots for things upgrades add to the scene. */
  decor: { kiosk: P2; billboard: P2; benches: readonly P2[] };
  windsock: P2;
  road: readonly P2[];
  parking: { x0: number; y0: number; x1: number; y1: number };
  camera: { center: P2; zoom: number };
  /** Flights a game day the taxiways can carry on time (single shared lane = a hard limit). */
  groundCapacity: number;
}

export interface TierDef {
  id: number;
  key: string;
  /** Missing = designed but not playable yet ("coming soon"). */
  layout?: TierLayout;
  /** What it takes to start building this tier. */
  needs: { served: number; rating: number; cost: number };
  buildSeconds: number;
  /** Multiplier on everything flights pay at this tier. */
  pay: number;
  /** Multiplier on how often planes arrive. */
  traffic: number;
  /** How many airlines can hold a contract at once. */
  contracts: number;
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
    { id: 'S2', pos: [22.8, 21.9], size: 'small', from: 'Lc', to: 'Ld', line: 'stand', level: 1 },
    { id: 'S3', pos: [20.8, 21.9], size: 'small', from: 'Ld', to: 'Le', line: 'stand', level: 2 },
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
  staffSpots: { atc: [21.2, 19.5], fueler: [27.4, 19.9], porter: [18.4, 20.5], agent: [21.4, 16.0] },
  decor: { kiosk: [23.6, 18.25], billboard: [23.2, 12.2], benches: [[25.3, 18.0], [24.7, 19.3]] },
  windsock: [20, 27.9],
  road: [
    [22.1, 17.8],
    [22.1, 17.0],
    [22.4, 12],
    [21.6, 6],
    [22.2, 0],
  ],
  parking: { x0: 23.0, y0: 15.4, x1: 25.6, y1: 17.6 },
  terminal: {
    entry: [24.3, 16.6],
    counters: [
      [20.5, 15.25],
      [19.8, 15.25],
      [19.1, 15.25],
      [18.4, 15.25],
    ],
    checkinQueue: [
      [21.0, 15.3],
      [21.0, 13.1],
      [21.5, 13.1],
      [21.5, 15.3],
    ],
    lanes: [
      [20.7, 17.2],
      [20.1, 17.2],
      [19.5, 17.2],
    ],
    securityQueue: [
      [20.7, 16.6],
      [19.0, 16.6],
      [19.0, 16.1],
      [20.7, 16.1],
    ],
    airside: [20.4, 18.0],
    belt: [
      [18.1, 14.9],
      [17.8, 15.2],
      [17.8, 17.55],
      [21.3, 17.7],
    ],
    claim: [19.5, 18.9],
    exit: [24.3, 16.6],
  },
  camera: { center: [20.8, 23.0], zoom: 0.72 },
  groundCapacity: 30,
};

/**
 * Tier 2 grows the dirt strip outward in every direction. It keeps every
 * node and stand of tier 1 at the same place (planes in the air stay valid)
 * and adds a longer asphalt runway, two stands, a terminal and a tower.
 */
const SMALL_AIRFIELD: TierLayout = {
  ...DIRT_STRIP,
  world: { w: 46, h: 46 },
  field: { x0: 9.6, y0: 15.6, x1: 35.2, y1: 30.4 },
  runway: { x0: 12, x1: 34, y: 26, width: 1.5, surface: 'asphalt' },
  taxi: {
    ...DIRT_STRIP.taxi,
    nodes: { ...DIRT_STRIP.taxi.nodes, Lf: [17.8, 23.9], Lg: [15.8, 23.9] },
    edges: [
      ['E', 'T1'],
      ['T1', 'La'],
      ['La', 'Lb'],
      ['Lb', 'Lc'],
      ['Lc', 'Ld'],
      ['Ld', 'Le'],
      ['Le', 'Lf'],
      ['Lf', 'Lg'],
      ['Lg', 'T3'],
      ['T3', 'H'],
    ],
  },
  stands: [
    ...DIRT_STRIP.stands,
    { id: 'S4', pos: [18.8, 21.9], size: 'small', from: 'Le', to: 'Lf', line: 'stand', level: 3 },
    { id: 'S5', pos: [16.8, 21.9], size: 'small', from: 'Lf', to: 'Lg', line: 'stand', level: 4 },
  ],
  takeoff: { liftoffX: 21, climb: DIRT_STRIP.takeoff.climb },
  decor: { kiosk: [24.0, 18.2], billboard: [23.2, 12.2], benches: [[25.4, 17.9], [24.9, 19.3]] },
  camera: { center: [20.4, 23.0], zoom: 0.68 },
  groundCapacity: 42,
};

/** Landing runway line of the bigger airports (moved south to make room for a parallel taxiway). */
const RWY_Y = 27.8;

/**
 * Tier 3 grows east and south: the runway moves south and gets a parallel
 * taxiway, so every plane leaves it at the first exit and taxis east to the
 * new stands (a private-jet stand by its lounge and two medium stands).
 */
const REGIONAL: TierLayout = {
  ...SMALL_AIRFIELD,
  world: { w: 64, h: 52 },
  field: { x0: 8.4, y0: 13.6, x1: 46.4, y1: 33.2 },
  runway: { x0: 11, x1: 44, y: RWY_Y, width: 1.6, surface: 'asphalt' },
  approach: {
    ...SMALL_AIRFIELD.approach,
    entry: [10.2, RWY_Y - 2.6, 2.2],
    faf: [9.6, RWY_Y, 1.5],
    threshold: [13.6, RWY_Y, 0.35],
    touchdown: [16.2, RWY_Y, 0],
  },
  taxi: {
    nodes: {
      ...SMALL_AIRFIELD.taxi.nodes,
      E: [28.6, RWY_Y],
      T1: [28.8, 25.6],
      H: [14.2, 26.3],
      K1: [34.0, 25.6],
      K2: [41.6, 25.6],
      T5: [40.8, 24.7],
      Ma: [39.8, 23.9],
      Mb: [37.0, 23.9],
      Mc: [33.8, 23.9],
      Md: [30.6, 23.9],
    },
    edges: [
      ...SMALL_AIRFIELD.taxi.edges,
      ['T1', 'K1'],
      ['K1', 'K2'],
      ['K2', 'T5'],
      ['T5', 'Ma'],
      ['Ma', 'Mb'],
      ['Mb', 'Mc'],
      ['Mc', 'Md'],
      ['Md', 'La'],
    ],
    exit: 'E',
    holdShort: 'H',
    lineUp: [
      [14.25, RWY_Y - 0.8],
      [14.7, RWY_Y - 0.05],
      [15.4, RWY_Y],
    ],
  },
  takeoff: {
    liftoffX: 23,
    climb: [
      [32, RWY_Y, 1.1],
      [42, RWY_Y - 0.4, 2.8],
      [54, RWY_Y - 2, 5],
      [66, RWY_Y - 5, 7.5],
    ],
  },
  stands: [
    ...SMALL_AIRFIELD.stands,
    { id: 'F1', pos: [38.4, 21.6], size: 'fbo', from: 'Ma', to: 'Mb', line: 'fbo', level: 1 },
    { id: 'M1', pos: [35.4, 20.9], size: 'medium', from: 'Mb', to: 'Mc', line: 'standMed', level: 1 },
    { id: 'M2', pos: [32.2, 20.9], size: 'medium', from: 'Mc', to: 'Md', line: 'standMed', level: 2 },
  ],
  buildings: [{ kind: 'fbo', pos: [37.4, 17.8], size: [2.2, 1.3] }],
  windsock: [20, 30.4],
  groundCapacity: 36,
  camera: { center: [28, 23.5], zoom: 0.5 },
};

/**
 * Tier 4: a pier with jet bridges for the airliners (one gate big enough for
 * wide-bodies) and a cargo apron at the far end of the parallel taxiway.
 */
const CITY: TierLayout = {
  ...REGIONAL,
  field: { x0: 8, y0: 12.4, x1: 58, y1: 33.2 },
  runway: { x0: 11, x1: 55, y: RWY_Y, width: 1.8, surface: 'asphalt' },
  taxi: {
    ...REGIONAL.taxi,
    nodes: { ...REGIONAL.taxi.nodes, H: [14.2, 26.2], K3: [52.4, 25.6], T6: [51.8, 24.7], Na: [50.8, 23.9], Nb: [46.6, 23.9], Nc: [42.0, 23.9] },
    edges: [...REGIONAL.taxi.edges, ['K2', 'K3'], ['K3', 'T6'], ['T6', 'Na'], ['Na', 'Nb'], ['Nb', 'Nc'], ['Nc', 'Ma']],
  },
  takeoff: {
    liftoffX: 25,
    climb: [
      [36, RWY_Y, 1.1],
      [48, RWY_Y - 0.4, 2.8],
      [60, RWY_Y - 2, 5],
      [72, RWY_Y - 5, 7.5],
    ],
  },
  stands: [
    ...REGIONAL.stands,
    { id: 'G1', pos: [48.7, 20.3], size: 'large', from: 'Na', to: 'Nb', line: 'gates', level: 1, bridge: true },
    { id: 'G2', pos: [44.3, 20.0], size: 'huge', from: 'Nb', to: 'Nc', line: 'gates', level: 2, bridge: true },
    { id: 'C1', pos: [54.4, 21.0], size: 'cargo', from: 'T6', to: 'Na', line: 'cargoApron', level: 1 },
  ],
  buildings: [
    { kind: 'fbo', pos: [37.4, 17.8], size: [2.2, 1.3] },
    { kind: 'pier', pos: [42.2, 15.8], size: [8.6, 1.5] },
    { kind: 'cargo', pos: [53.2, 16.4], size: [3.2, 2.0] },
  ],
  groundCapacity: 36,
  camera: { center: [33, 23.5], zoom: 0.42 },
};

/** Departures runway of the international airport. */
const DEP_Y = 33.4;

/**
 * Tier 5: departures move to a second runway to the south, reached by a taxiway
 * around the west end of the first one (no runway crossings); a helipad.
 */
const INTERNATIONAL: TierLayout = {
  ...CITY,
  field: { x0: 6, y0: 12.4, x1: 60, y1: 36.6 },
  runway: { x0: 11, x1: 57, y: RWY_Y, width: 1.8, surface: 'asphalt' },
  depRunway: { x0: 13, x1: 58, y: DEP_Y, width: 1.8 },
  taxi: {
    ...CITY.taxi,
    nodes: { ...CITY.taxi.nodes, W1: [12.0, 24.4], W2: [9.0, 28.8], W3: [9.2, 32.0], H2: [11.4, 32.3] },
    edges: [...CITY.taxi.edges.filter(([a, b]) => !(a === 'T3' && b === 'H')), ['T3', 'W1'], ['W1', 'W2'], ['W2', 'W3'], ['W3', 'H2']],
    holdShort: 'H2',
    lineUp: [
      [11.9, DEP_Y - 0.5],
      [12.7, DEP_Y - 0.05],
      [13.8, DEP_Y],
    ],
  },
  takeoff: {
    liftoffX: 27,
    climb: [
      [38, DEP_Y, 1.1],
      [50, DEP_Y + 0.6, 2.8],
      [62, DEP_Y + 1.6, 5],
      [74, DEP_Y + 2.6, 7.5],
    ],
  },
  stands: [...CITY.stands, { id: 'P1', pos: [32.0, 17.4], size: 'heli', line: 'helipad', level: 1 }],
  buildings: [...(CITY.buildings ?? []), { kind: 'helipad', pos: [31.2, 16.6], size: [1.6, 1.6] }],
  windsock: [20, 30.6],
  groundCapacity: 46,
  camera: { center: [33, 25.5], zoom: 0.4 },
};

export const TIERS: readonly TierDef[] = [
  { id: 1, key: 'dirtStrip', layout: DIRT_STRIP, needs: { served: 0, rating: 0, cost: 0 }, buildSeconds: 0, pay: 1, traffic: 1, contracts: 2 },
  { id: 2, key: 'smallAirfield', layout: SMALL_AIRFIELD, needs: { served: 10, rating: 3.5, cost: 250 }, buildSeconds: 90, pay: 2, traffic: 1.3, contracts: 3 },
  { id: 3, key: 'regional', layout: REGIONAL, needs: { served: 150, rating: 4, cost: 25000 }, buildSeconds: 240, pay: 5, traffic: 1.6, contracts: 4 },
  { id: 4, key: 'city', layout: CITY, needs: { served: 500, rating: 4.2, cost: 400000 }, buildSeconds: 480, pay: 12, traffic: 2, contracts: 5 },
  { id: 5, key: 'international', layout: INTERNATIONAL, needs: { served: 1500, rating: 4.4, cost: 8e6 }, buildSeconds: 900, pay: 30, traffic: 2.5, contracts: 6 },
  { id: 6, key: 'hub', needs: { served: 4000, rating: 4.5, cost: 2e8 }, buildSeconds: 1500, pay: 80, traffic: 3, contracts: 7 },
  { id: 7, key: 'megaHub', needs: { served: 10000, rating: 4.6, cost: 6e9 }, buildSeconds: 2400, pay: 220, traffic: 3.5, contracts: 8 },
  { id: 8, key: 'skyport', needs: { served: 25000, rating: 4.8, cost: 2e11 }, buildSeconds: 3600, pay: 600, traffic: 4, contracts: 9 },
];

export function tierDef(id: number): TierDef {
  return TIERS.find((t) => t.id === id && t.layout) ?? TIERS[0];
}

/** The tier after `id`, playable or not (undefined at the top). */
export function nextTier(id: number): TierDef | undefined {
  return TIERS.find((t) => t.id === id + 1);
}

/** Layout of a playable tier (falls back to the dirt strip). */
export function layoutFor(id: number): TierLayout {
  return (tierDef(id).layout ?? DIRT_STRIP) as TierLayout;
}
