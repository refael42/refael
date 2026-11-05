/**
 * Airport tiers and their layouts. World units are tiles. The runway runs
 * along +x (landing toward +x); screen up-left is west (-x).
 */
import { CONCOURSE_D, shiftBuilding, T1, T1_DOORS, T3, T3_CAROUSELS, T3_HUB, T3_HUB_CAROUSELS, type TerminalBuilding, type TerminalDoors } from './terminals';
import type { StandSize } from './aircraft';

export type P2 = readonly [number, number];
export type P3 = readonly [number, number, number];

export interface StandDef {
  /** A maintenance bay in front of the hangar: only planes coming in for a check park here. */
  hangar?: boolean;
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
  /** Only planes that need exactly this size (Terminal 4's jumbo gates). */
  exact?: boolean;
}

export type BuildingKind = 'fbo' | 'pier' | 'cargo' | 'helipad' | 'hangar' | 'vertipad';

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
  /**
   * The same airport run the other way (wind from the west): approach from the
   * east, an exit for that direction, departures to the east end. The extra
   * nodes and edges join the one taxi graph; only exits and hold shorts change.
   */
  rev?: {
    approach: TierLayout['approach'];
    nodes: Readonly<Record<string, P2>>;
    edges: readonly (readonly [string, string])[];
    exit: string;
    holdShort: string;
    lineUp: readonly P2[];
    takeoff: { liftoffX: number; climb: readonly P3[] };
  };
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
  terminal: Stations;
  /** The terminal as an open-roofed building (from the small airfield on). */
  building?: TerminalBuilding;
  /** Control tower and radar mast (from the small airfield on). */
  tower?: P2;
  radar?: P2;
  /** Terminal 3 (from the city airport on): the big terminal for the big jets, with its own road and garage. */
  t3?: BigTerminal;
  /** Terminal 4 (mega hub on): the long-haul terminal for the jumbos, on the same plan as Terminal 3. */
  t4?: BigTerminal;
  /** The hub: a satellite concourse in the apron, reached from Terminal 3 by a people mover. */
  sat?: Satellite;
  /** The hub: a railway along the north edge with a station by Terminal 3. */
  rail?: Rail;
  /** The skyport: the airport hotel by Terminal 3 (its footprint and the door guests use). */
  hotel?: { box: Area; door: P2 };
  /** Spots for things upgrades add to the scene. */
  decor: { kiosk: P2; billboard: P2; benches: readonly P2[] };
  windsock: P2;
  road: readonly P2[];
  parking: { x0: number; y0: number; x1: number; y1: number };
  camera: { center: P2; zoom: number };
  /** Supply area by the north fence (from the small airfield on): fuel farm, parts store, mechanics. */
  depot?: Depot;
  /** Flights a game day the taxiways can carry on time (single shared lane = a hard limit). */
  groundCapacity: number;
}

/** Where passengers go in a terminal, in the order they meet things. */
export interface Stations {
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
  /** Doors of the terminal building (from the small airfield on): people only go in and out here. */
  doors?: TerminalDoors;
  /** The big terminal: more doors in and out, and the way past the check-in islands. */
  entrances?: readonly P2[];
  exits?: readonly P2[];
  lobby?: readonly P2[];
  /** Passport control out and in (international airport): booths and their queue lines. */
  passport?: { booths: readonly P2[]; queue: readonly P2[] };
  arrPassport?: { booths: readonly P2[]; queue: readonly P2[] };
  /** Several carousels (the claim is the first). */
  carousels?: readonly P2[];
  /** The way through the duty free (and where shoppers stop). */
  dutyFree?: readonly P2[];
  /** Where passengers wait while their gate is not known yet (the food court). */
  waitSpots?: readonly P2[];
  /** From the food court down to the gates. */
  concourse?: readonly P2[];
  /** From the jet bridges along the concourse to the baggage hall. */
  arrivalsWay?: readonly P2[];
  /** From the baggage hall through customs into the arrivals hall. */
  customs?: readonly P2[];
  /** Where the apron buses stop in front of the terminal (for the remote stands). */
  busStop?: P2;
  /** From the passport hall into the baggage hall (the big terminals). */
  toClaim?: readonly P2[];
}

/** A big terminal (Terminal 3, Terminal 4): stations, the building, its road and parking garage. */
export interface BigTerminal {
  st: Stations;
  building: TerminalBuilding;
  road: readonly P2[];
  garage: readonly [number, number, number, number];
}

/** Every point of a station plan moved east by dx (Terminal 4 is built on Terminal 3's plan). */
export function shiftStations(st: Stations, dx: number): Stations {
  const shift = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      if (v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') return [v[0] + dx, v[1]];
      return v.map(shift);
    }
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shift(x)]));
    return v;
  };
  return shift(st) as Stations;
}

/** An area x0, y0, x1, y1 (tiles). */
export type Area = readonly [number, number, number, number];

export interface Satellite {
  building: TerminalBuilding;
  /** The people mover: its track (along x at y, from x0 to x1) and where the train stops at Terminal 3 and at the satellite. */
  apm: { y: number; x0: number; x1: number; stopT: number; stopS: number };
  /** Where people wait for the train on each platform. */
  platformT: Area;
  platformS: Area;
}

export interface Rail {
  /** Track line (along x) and where the middle of the train stops. */
  y: number;
  stop: number;
  /** The platform, and the footpath from it to the Terminal 3 curb. */
  platform: Area;
  path: readonly P2[];
  /** Where the line comes out of its tunnels (west and east). */
  portals: readonly [number, number];
  /** The station's entrance pavilion (its corner). */
  hall: P2;
}

export interface Depot {
  /** Service road from the main road along the outside of the fence to the gate. */
  serviceRoad: readonly P2[];
  /** Gate in the north fence. */
  gate: P2;
  /** Fuel farm (tank group center) and where the tanker parks to unload. */
  farm: P2;
  fuelBay: P2;
  /** Parts store (warehouse center) and where the delivery van stops. */
  store: P2;
  partsBay: P2;
  /** Mechanics' van parking and the point it leaves through toward the apron. */
  mech: ServiceHome;
  /** Fire station (footprint corner) and where its trucks wait. */
  fire: { station: P2; home: P2 };
}

/** The maintenance hangar on the west grass (regional airport on): two bays in front of its doors. */
const HANGAR: BuildingDef = { kind: 'hangar', pos: [8.75, 16.1], size: [6.2, 2.6] };
/**
 * Its own one-way taxi loop off the end of the main taxiway: past both bays
 * and back, so no link crosses another (planes could meet at a crossing).
 */
const HANGAR_LANE = {
  nodes: { HW1: [15.35, 22.3] as P2, HWm: [11.75, 22.3] as P2, HW2: [10.0, 22.3] as P2, HW3: [10.5, 23.9] as P2 },
  edges: [
    ['Lg', 'HW1'],
    ['HW1', 'HWm'],
    ['HWm', 'HW2'],
    ['HW2', 'HW3'],
    ['HW3', 'T3'],
  ] as [string, string][],
};
const HANGAR_BAYS: readonly StandDef[] = [
  { id: 'HG1', pos: [9.85, 20.0], size: 'medium', from: 'HWm', to: 'HW2', line: 'hangar', level: 1, hangar: true },
  { id: 'HG2', pos: [13.15, 20.0], size: 'medium', from: 'HW1', to: 'HWm', line: 'hangar', level: 2, hangar: true },
];

/** The supply area sits inside the north fence at x 28..35, whatever the fence's y. */
function depotAt(y0: number): Depot {
  const ys = y0 - 0.85;
  return {
    serviceRoad: [
      [22.35, ys - 0.7],
      [23.1, ys],
      [30.6, ys],
      [31.3, ys + 0.45],
    ],
    gate: [31.3, y0],
    farm: [29.4, y0 + 1.55],
    fuelBay: [31.3, y0 + 1.45],
    store: [33.75, y0 + 1.45],
    partsBay: [32.25, y0 + 0.95],
    mech: { home: [32.6, y0 + 2.75], via: [31.6, y0 + 3.6] },
    fire: { station: [25.95, y0 + 0.55], home: [26.85, y0 + 2.45] },
  };
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
  // the terminal becomes a building: check-in, security, a departures lounge and arrivals inside
  building: T1,
  hutDoor: [20.3, 19.5],
  tower: [15.6, 14.1],
  radar: [14.2, 14.9],
  terminal: {
    entry: [24.3, 16.6],
    counters: [
      [19.75, 13.5],
      [19.05, 13.5],
      [18.35, 13.5],
      [17.65, 13.5],
    ],
    checkinQueue: [
      [20.4, 14.1],
      [20.4, 12.95],
      [20.9, 12.95],
      [20.9, 14.85],
      [21.4, 14.85],
      [21.4, 12.95],
    ],
    lanes: [
      [19.5, 16.65],
      [18.8, 16.65],
      [18.1, 16.65],
    ],
    securityQueue: [
      [19.85, 16.0],
      [17.55, 16.0],
      [17.55, 15.55],
      [20.6, 15.55],
    ],
    airside: [18.4, 17.35],
    belt: [
      [20.1, 13.12],
      [17.2, 13.12],
      [17.2, 15.4],
      [16.3, 15.4],
    ],
    claim: [20.45, 18.2],
    exit: [24.3, 16.6],
    doors: T1_DOORS,
    busStop: [20.05, 20.32],
  },
  // (the baggage carts park west of the terminal front, clear of the bus stop)
  bags: { home: [16.3, 20.35], via: [16.5, 21.1] },
  waitSpots: [
    [17.25, 18.08],
    [17.65, 18.08],
    [18.05, 18.08],
    [17.25, 18.58],
    [17.65, 18.58],
    [18.05, 18.58],
    [17.25, 19.08],
    [17.65, 19.08],
    [18.05, 19.08],
    [18.6, 18.15],
    [18.65, 18.65],
    [18.45, 17.75],
  ],
  staffSpots: { atc: [16.1, 14.6], fueler: [27.4, 19.9], porter: [18.4, 20.5], agent: [19.0, 12.95] },
  decor: { kiosk: [17.0, 17.1], billboard: [23.2, 12.2], benches: [[25.4, 17.9], [24.9, 19.3]] },
  camera: { center: [20.4, 23.0], zoom: 0.68 },
  depot: depotAt(15.6),
  groundCapacity: 42,
};

/** Landing runway line of the bigger airports (moved south to make room for a parallel taxiway). */
const RWY_Y = 27.8;

/** The approach mirrored onto the east end of a runway (wind from the west). */
function approachFromEast(x1: number): TierLayout['approach'] {
  return {
    spawns: [
      [62, 14, 5.2],
      [58, 9, 5.2],
      [64, 20, 5.2],
      [52, 8, 5.2],
    ],
    hold: [x1 - 4, 21, 3.1],
    holdRadius: 1.6,
    entry: [x1 + 0.8, RWY_Y - 2.6, 2.2],
    faf: [x1 + 1.4, RWY_Y, 1.5],
    threshold: [x1 - 2.6, RWY_Y, 0.35],
    touchdown: [x1 - 5.2, RWY_Y, 0],
  };
}

/** Taxiway from the west end of the stand lane onto the parallel taxiway, for departures heading east. */
const WEST_LINK = {
  nodes: { KW1: [15.6, 25.4] as P2, KW2: [24.0, 25.6] as P2 },
  edges: [
    ['T3', 'KW1'],
    ['KW1', 'KW2'],
    ['KW2', 'T1'],
  ] as const,
};

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
      ...HANGAR_LANE.nodes,
    },
    edges: [
      ...SMALL_AIRFIELD.taxi.edges,
      ...HANGAR_LANE.edges,
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
    ...HANGAR_BAYS,
  ],
  buildings: [{ kind: 'fbo', pos: [37.4, 17.8], size: [2.2, 1.3] }, HANGAR],
  rev: {
    approach: approachFromEast(44),
    // a dog-leg to the hold so even the longest tail is clear of the K lane while waiting
    nodes: { ...WEST_LINK.nodes, HX: [43.4, 25.0], HE: [43.4, 26.3] },
    edges: [...WEST_LINK.edges, ['K2', 'HX'], ['HX', 'HE']],
    exit: 'E',
    holdShort: 'HE',
    lineUp: [
      [43.8, RWY_Y - 0.7],
      [43.5, RWY_Y - 0.05],
      [42.8, RWY_Y],
    ],
    takeoff: {
      liftoffX: 35,
      climb: [
        [26, RWY_Y, 1.1],
        [16, RWY_Y - 0.4, 2.8],
        [4, RWY_Y - 2, 5],
        [-8, RWY_Y - 5, 7.5],
      ],
    },
  },
  windsock: [20, 30.4],
  depot: depotAt(13.6),
  groundCapacity: 46,
  camera: { center: [28, 23.5], zoom: 0.5 },
};

/**
 * Tier 4: a pier with jet bridges for the airliners (one gate big enough for
 * wide-bodies) and a cargo apron at the far end of the parallel taxiway.
 */
/** Terminal 3 stations (city airport); the international airport adds passport control. */
const T3_STATIONS: Stations = {
  entry: [44.0, 6.55],
  counters: [
    [42.5, 9.5],
    [44.0, 9.5],
    [41.8, 9.5],
    [44.7, 9.5],
    [41.1, 9.5],
    [45.4, 9.5],
    [40.4, 9.5],
    [46.1, 9.5],
  ],
  checkinQueue: [
    [43.25, 10.15],
    [46.7, 10.15],
    [46.7, 10.5],
    [40.0, 10.5],
    [40.0, 10.15],
  ],
  lanes: [
    [45.6, 12.35],
    [44.7, 12.35],
    [43.8, 12.35],
    [42.9, 12.35],
    [42.0, 12.35],
    [41.1, 12.35],
  ],
  securityQueue: [
    [46.0, 11.55],
    [40.3, 11.55],
    [40.3, 11.15],
    [46.9, 11.15],
    [46.9, 10.9],
  ],
  airside: [41.6, 12.9],
  belt: [
    [46.4, 8.9],
    [39.9, 8.9],
    [39.9, 9.0],
    [39.0, 9.0],
  ],
  claim: T3_CAROUSELS[0],
  carousels: T3_CAROUSELS,
  exit: [50.8, 6.85],
  doors: { entrance: [41.2, 8.0], exit: [49.6, 8.0], gate: [44.0, 17.3], arrivals: [48.4, 17.3] },
  entrances: [
    [41.2, 8.0],
    [44.8, 8.0],
  ],
  exits: [
    [49.6, 8.0],
    [52.0, 8.0],
  ],
  lobby: [[43.25, 8.6]],
  dutyFree: [
    [42.2, 14.9],
    [42.9, 14.95],
    [43.9, 14.95],
    [44.9, 14.7],
    [45.4, 14.05],
    [46.9, 14.1],
  ],
  waitSpots: [
    [46.72, 14.6],
    [47.22, 14.6],
    [47.52, 14.6],
    [48.02, 14.6],
    [48.32, 14.6],
    [48.82, 14.6],
    [46.72, 15.4],
    [47.22, 15.4],
    [48.32, 15.4],
    [48.82, 15.4],
    [47.75, 15.0],
    [47.75, 14.0],
  ],
  concourse: [
    [48.0, 15.45],
    [48.0, 16.2],
  ],
  arrivalsWay: [
    [51.6, 16.6],
    [51.6, 15.4],
  ],
  customs: [
    [50.25, 11.15],
    [50.25, 10.45],
  ],
  toClaim: [
    [51.3, 13.6],
    [51.3, 12.85],
  ],
};

const T3_INTL: Stations = {
  ...T3_STATIONS,
  passport: {
    booths: [
      [40.3, 14.55],
      [41.0, 14.55],
      [41.7, 14.55],
    ],
    queue: [
      [41.0, 13.85],
      [39.9, 13.85],
      [39.9, 13.5],
      [42.2, 13.5],
    ],
  },
  arrPassport: {
    booths: [
      [50.3, 14.2],
      [51.3, 14.2],
      [52.3, 14.2],
    ],
    queue: [
      [51.3, 14.95],
      [52.6, 14.95],
      [52.6, 15.35],
      [50.0, 15.35],
    ],
  },
};

/** The road to Terminal 3 (curb end first) and its parking garage. */
const T3_ROAD: readonly P2[] = [
  [39.4, 7.25],
  [54.4, 7.25],
  [55.6, 6.0],
  [55.6, 0],
];
const T3_GARAGE = [40.2, 2.6, 45.6, 6.0] as const;

const CITY: TierLayout = {
  ...REGIONAL,
  field: { x0: 8, y0: 12.4, x1: 58, y1: 33.2 },
  runway: { x0: 11, x1: 55, y: RWY_Y, width: 1.8, surface: 'asphalt' },
  taxi: {
    ...REGIONAL.taxi,
    nodes: { ...REGIONAL.taxi.nodes, H: [14.2, 26.2], KR: [39.2, 25.6], K3: [52.4, 25.6], T6: [51.8, 24.7], Na: [50.8, 23.9], Nb: [46.6, 23.9], Nc: [42.0, 23.9] },
    edges: [
      ...REGIONAL.taxi.edges.filter(([a, b]) => !(a === 'K1' && b === 'K2')),
      ['K1', 'KR'],
      ['KR', 'K2'],
      ['K2', 'K3'],
      ['K3', 'T6'],
      ['T6', 'Na'],
      ['Na', 'Nb'],
      ['Nb', 'Nc'],
      ['Nc', 'Ma'],
    ],
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
    HANGAR,
  ],
  rev: {
    approach: approachFromEast(55),
    nodes: { ...WEST_LINK.nodes, ER: [38.8, RWY_Y], HX: [54.6, 25.0], HE: [54.6, 26.3] },
    edges: [...WEST_LINK.edges, ['ER', 'KR'], ['K3', 'HX'], ['HX', 'HE']],
    exit: 'ER',
    holdShort: 'HE',
    lineUp: [
      [55.0, RWY_Y - 0.7],
      [54.7, RWY_Y - 0.05],
      [54.0, RWY_Y],
    ],
    takeoff: {
      liftoffX: 46,
      climb: [
        [36, RWY_Y, 1.1],
        [24, RWY_Y - 0.4, 2.8],
        [10, RWY_Y - 2, 5],
        [-4, RWY_Y - 5, 7.5],
      ],
    },
  },
  depot: depotAt(12.4),
  t3: { st: T3_STATIONS, building: T3, road: T3_ROAD, garage: T3_GARAGE },
  // (one runway for landings and takeoffs, with wake gaps behind the jets: more than this and planes queue)
  groundCapacity: 42,
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
    nodes: { ...CITY.taxi.nodes, W1: [12.6, 24.9], W2: [9.0, 28.8], W3: [9.2, 32.0], H2: [11.4, 32.3] },
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
  rev: {
    approach: approachFromEast(57),
    nodes: { ...WEST_LINK.nodes, ER: [38.8, RWY_Y], KE1: [58.8, 26.0], KE2: [59.4, 29.6], H2E: [57.6, 32.3] },
    edges: [...WEST_LINK.edges, ['ER', 'KR'], ['K3', 'KE1'], ['KE1', 'KE2'], ['KE2', 'H2E']],
    exit: 'ER',
    holdShort: 'H2E',
    lineUp: [
      [57.9, DEP_Y - 0.5],
      [57.6, DEP_Y - 0.05],
      [57.0, DEP_Y],
    ],
    takeoff: {
      liftoffX: 46,
      climb: [
        [36, DEP_Y, 1.1],
        [24, DEP_Y + 0.6, 2.8],
        [12, DEP_Y + 1.6, 5],
        [0, DEP_Y + 2.6, 7.5],
      ],
    },
  },
  windsock: [20, 30.6],
  depot: depotAt(12.4),
  t3: { st: T3_INTL, building: T3, road: T3_ROAD, garage: T3_GARAGE },
  groundCapacity: 64,
  camera: { center: [33, 25.5], zoom: 0.4 },
};

/** Terminal 3 at the hub: a fourth carousel, a third exit and five passport booths for arrivals. */
const T3_HUB_ST: Stations = {
  ...T3_INTL,
  carousels: T3_HUB_CAROUSELS,
  exits: [
    [49.6, 8.0],
    [52.0, 8.0],
    [54.6, 8.0],
  ],
  arrPassport: {
    booths: [
      [50.3, 14.2],
      [51.3, 14.2],
      [52.3, 14.2],
      [53.3, 14.2],
      [54.3, 14.2],
    ],
    queue: [
      [52.3, 14.95],
      [55.3, 14.95],
      [55.3, 15.35],
      [50.0, 15.35],
    ],
  },
};

/** At the hub Terminal 3's road leaves to the east (the railway runs along the north edge). */
const T3_ROAD_HUB: readonly P2[] = [
  [39.4, 7.25],
  [57.4, 7.25],
  [58.6, 6.0],
  [58.6, 4.3],
  [59.8, 3.5],
  [92, 3.5],
];

/** Concourse D and the people mover from the end of Terminal 3's concourse. */
const HUB_SAT: Satellite = {
  building: CONCOURSE_D,
  apm: { y: 16.95, x0: 53.4, x1: 62.7, stopT: 54.55, stopS: 61.55 },
  platformT: [53.5, 16.05, 55.8, 16.45],
  platformS: [60.3, 16.0, 62.7, 16.45],
};

/** The railway along the north edge and its station by the Terminal 3 garage. */
const HUB_RAIL: Rail = {
  y: 1.3,
  stop: 49.8,
  platform: [45.9, 1.62, 53.7, 2.45],
  path: [
    [49.8, 2.7],
    [48.6, 6.3],
  ],
  portals: [27.5, 84.5],
  hall: [51.4, 2.7],
};

/**
 * Tier 6, the hub: the taxiway runs on east past the cargo apron (moved to the
 * far end) to a new lane in front of Concourse D, a satellite with three big
 * gates. The planes for the gates by Terminal 3 turn off straight from the
 * parallel taxiway; departures heading east turn off it before the new lane.
 */
const HUB_NODES = Object.fromEntries(Object.entries(INTERNATIONAL.taxi.nodes).filter(([id]) => id !== 'T6')) as Record<string, P2>;
const HUB: TierLayout = {
  ...INTERNATIONAL,
  world: { w: 90, h: 52 },
  field: { x0: 6, y0: 12.4, x1: 85, y1: 36.6 },
  taxi: {
    ...INTERNATIONAL.taxi,
    nodes: { ...HUB_NODES, K4: [82.6, 25.6], T8: [82.0, 24.7], Ca: [81.0, 23.9], Da: [76.6, 23.9], Db: [71.4, 23.9], Dc: [66.6, 23.9], Dd: [62.0, 23.9] },
    edges: [
      ...INTERNATIONAL.taxi.edges.filter(([a, b]) => !(a === 'K3' && b === 'T6') && !(a === 'T6' && b === 'Na')),
      ['K3', 'Na'],
      ['K3', 'K4'],
      ['K4', 'T8'],
      ['T8', 'Ca'],
      ['Ca', 'Da'],
      ['Da', 'Db'],
      ['Db', 'Dc'],
      ['Dc', 'Dd'],
      ['Dd', 'Na'],
    ],
  },
  stands: [
    ...INTERNATIONAL.stands.map((st) => (st.id === 'C1' ? { ...st, pos: [78.8, 21.0] as P2, from: 'Ca', to: 'Da' } : st)),
    { id: 'D1', pos: [64.0, 20.5], size: 'large', from: 'Dc', to: 'Dd', line: 'gatesD', level: 1, bridge: true },
    { id: 'D2', pos: [68.6, 20.2], size: 'huge', from: 'Db', to: 'Dc', line: 'gatesD', level: 2, bridge: true },
    { id: 'D3', pos: [73.4, 20.2], size: 'huge', from: 'Da', to: 'Db', line: 'gatesD', level: 3, bridge: true },
  ],
  buildings: [
    ...(INTERNATIONAL.buildings ?? []).map((b) => (b.kind === 'cargo' ? { ...b, pos: [77.4, 16.6] as P2 } : b)),
    { kind: 'pier', pos: [60.0, 13.4], size: [17.0, 4.2] },
  ],
  rev: {
    ...INTERNATIONAL.rev!,
    // (east of the gates by Terminal 3 the parallel taxiway runs on, so departures turn off it more steeply)
    nodes: { ...INTERNATIONAL.rev!.nodes, KE1: [57.4, 26.8] },
  },
  t3: { st: T3_HUB_ST, building: T3_HUB, road: T3_ROAD_HUB, garage: T3_GARAGE },
  sat: HUB_SAT,
  rail: HUB_RAIL,
  groundCapacity: 72,
  camera: { center: [44, 24.5], zoom: 0.36 },
};

/** Terminal 4 is built on Terminal 3's plan, this far east. */
const T4_DX = 41;
/** Terminal 4's three jumbo gates (jet-bridge doors in its south wall). */
const T4_GATES = [84.3, 88.7, 93.1];
const T4_BUILDING: TerminalBuilding = (() => {
  const b = shiftBuilding(T3, T4_DX);
  return {
    ...b,
    // three gates for the jumbos instead of Terminal 3's two
    doors: [...b.doors.filter((d) => d.kind !== 'gate'), ...T4_GATES.map((x) => ({ kind: 'gate' as const, at: [x, 17.3] as P2, width: 0.5 }))],
    furniture: [
      ...b.furniture.filter((f) => f.kind !== 'gateDesk' && f.kind !== 'signGate' && !(f.kind === 'plant' && f.at[1] > 16.5)),
      ...T4_GATES.flatMap((x) => [
        { kind: 'gateDesk' as const, at: [x - 0.6, 16.95] as P2 },
        { kind: 'signGate' as const, at: [x, 16.6] as P2 },
      ]),
      // its own touches: a sculpture in the arrivals hall, a play corner in the concourse
      { kind: 'sculpture', at: [91.6, 9.6] },
      { kind: 'kidsPlay', at: [91.0, 16.05] },
    ],
  };
})();

/**
 * Tier 7, the mega hub: Terminal 4, the long-haul terminal on Terminal 3's
 * plan, east of Concourse D, with two jumbo gates (only the jumbos park
 * there, and their passengers use Terminal 4 from the curb to the plane).
 * The cargo apron moves to the far east end again.
 */
const MEGA: TierLayout = {
  ...HUB,
  world: { w: 112, h: 52 },
  field: { x0: 6, y0: 12.4, x1: 108.5, y1: 36.6 },
  taxi: {
    ...HUB.taxi,
    nodes: { ...HUB.taxi.nodes, K4: [107.0, 25.6], T8: [106.4, 24.7], Ca: [105.4, 23.9], Ea: [100.8, 23.9], Ee: [96.8, 23.9], Eb: [91.4, 23.9], Ec: [87.0, 23.9], Ed: [82.6, 23.9] },
    edges: [...HUB.taxi.edges.filter(([a, b]) => !(a === 'Ca' && b === 'Da')), ['Ca', 'Ea'], ['Ea', 'Ee'], ['Ee', 'Eb'], ['Eb', 'Ec'], ['Ec', 'Ed'], ['Ed', 'Da']],
  },
  stands: [
    ...HUB.stands.map((st) => (st.id === 'C1' ? { ...st, pos: [103.2, 21.0] as P2, from: 'Ca', to: 'Ea' } : st)),
    { id: 'E1', pos: [89.0, 20.3], size: 'hugeX', from: 'Eb', to: 'Ec', line: 'gatesE', level: 1, bridge: true, exact: true },
    { id: 'E2', pos: [84.6, 20.0], size: 'hugeX', from: 'Ec', to: 'Ed', line: 'gatesE', level: 2, bridge: true, exact: true },
    { id: 'E3', pos: [93.4, 20.2], size: 'hugeX', from: 'Ee', to: 'Eb', line: 'gatesE', level: 3, bridge: true, exact: true },
    // a second cargo stand (the cargo apron is a long taxi away now)
    { id: 'C2', pos: [99.0, 21.0], size: 'cargo', from: 'Ea', to: 'Ee', line: 'cargoApron', level: 2 },
  ],
  buildings: [
    ...(HUB.buildings ?? []).map((b) => (b.kind === 'cargo' ? { ...b, pos: [101.8, 16.6] as P2 } : b)),
    { kind: 'cargo', pos: [97.4, 16.6], size: [3.2, 2.0] },
    { kind: 'pier', pos: [83.2, 15.8], size: [10.6, 1.5] },
  ],
  t3: { ...HUB.t3!, road: [...T3_ROAD_HUB.slice(0, -1), [114, 3.5]] },
  t4: {
    st: shiftStations(T3_INTL, T4_DX),
    building: T4_BUILDING,
    road: [
      [79.2, 3.5],
      [79.2, 6.0],
      [80.4, 7.25],
      [95.4, 7.25],
      [96.6, 6.0],
      [96.6, 3.5],
    ],
    garage: [97.8, 4.3, 103.2, 7.7],
  },
  rail: { ...HUB_RAIL, portals: [27.5, 106] },
  groundCapacity: 76,
  camera: { center: [55, 24.5], zoom: 0.32 },
};

/**
 * Tier 8, the skyport: a vertiport for electric air taxis beside the old
 * helipad (their passengers use Terminal 1, like the helicopters'), and the
 * airport hotel west of Terminal 3, reached by a short drive off its road.
 */
const SKYPORT: TierLayout = {
  ...MEGA,
  stands: [
    ...MEGA.stands,
    { id: 'V1', pos: [34.1, 17.3], size: 'heli', line: 'vertiport', level: 1 },
    { id: 'V2', pos: [35.9, 17.3], size: 'heli', line: 'vertiport', level: 2 },
    { id: 'V3', pos: [29.9, 17.4], size: 'heli', line: 'vertiport', level: 3 },
  ],
  buildings: [
    ...(MEGA.buildings ?? []),
    { kind: 'vertipad', pos: [33.3, 16.5], size: [1.6, 1.6] },
    { kind: 'vertipad', pos: [35.1, 16.5], size: [1.6, 1.6] },
    { kind: 'vertipad', pos: [29.1, 16.6], size: [1.6, 1.6] },
  ],
  t3: { ...MEGA.t3!, road: [[33.6, 7.25], ...MEGA.t3!.road] },
  hotel: { box: [32.4, 3.0, 37.4, 6.4], door: [36.4, 6.6] },
  groundCapacity: 78,
};

export const TIERS: readonly TierDef[] = [
  { id: 1, key: 'dirtStrip', layout: DIRT_STRIP, needs: { served: 0, rating: 0, cost: 0 }, buildSeconds: 0, pay: 1, traffic: 1, contracts: 2 },
  { id: 2, key: 'smallAirfield', layout: SMALL_AIRFIELD, needs: { served: 10, rating: 3.5, cost: 250 }, buildSeconds: 90, pay: 2, traffic: 1.3, contracts: 3 },
  { id: 3, key: 'regional', layout: REGIONAL, needs: { served: 150, rating: 4, cost: 25000 }, buildSeconds: 240, pay: 5, traffic: 1.6, contracts: 4 },
  { id: 4, key: 'city', layout: CITY, needs: { served: 500, rating: 4.2, cost: 400000 }, buildSeconds: 480, pay: 12, traffic: 2, contracts: 5 },
  { id: 5, key: 'international', layout: INTERNATIONAL, needs: { served: 1500, rating: 4.4, cost: 8e6 }, buildSeconds: 900, pay: 30, traffic: 2.5, contracts: 6 },
  { id: 6, key: 'hub', layout: HUB, needs: { served: 4000, rating: 4.5, cost: 2e8 }, buildSeconds: 1500, pay: 80, traffic: 3, contracts: 7 },
  { id: 7, key: 'megaHub', layout: MEGA, needs: { served: 10000, rating: 4.6, cost: 6e9 }, buildSeconds: 2400, pay: 220, traffic: 3.5, contracts: 8 },
  { id: 8, key: 'skyport', layout: SKYPORT, needs: { served: 25000, rating: 4.8, cost: 2e11 }, buildSeconds: 3600, pay: 600, traffic: 4, contracts: 9 },
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
