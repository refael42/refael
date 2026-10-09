import { Facing, PropKind as K, type PropKind } from '../sim/types';
import { TIERS, type DiningFloor, type Grow } from './buildings';
import { UNLOCK_TIER } from './unlocks';
import { BAR } from './bar';
import type { TableSpot } from './tables';
import { designTables, reservedTiles } from '../sim/layout';
import { KITCHEN_STATIONS, type Station } from './kitchen';

// Maps are in TILE units on the floor plane: +x runs down-right on screen, +y runs down-left
// (isometric). A tile's center is (i + 0.5, j + 0.5).

export interface Point {
  x: number;
  y: number;
}

/** `lot`: the next building's land (for sale); `locked`: land of later buildings; `path`: the way from the street to the door. */
export type FloorStyle = 'grass' | 'sidewalk' | 'road' | 'kitchen' | 'lot' | 'locked' | 'path' | 'park' | 'plaza' | 'gravel' | DiningFloor;

/** A floor rectangle [x0, x1) x [y0, y1), painted in order. */
export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  floor: FloorStyle;
  walkable: boolean;
}

/** A placed object. Footprint `w` x `d` tiles centered on (x, y); `blocks` = impassable. */
export interface Furniture {
  kind: PropKind;
  x: number;
  y: number;
  w: number;
  d: number;
  blocks: boolean;
  variant?: number;
  lift?: number;
  active?: boolean;
}

export interface KitchenStation {
  stove: Furniture;
  cook: Point;
  facing: Facing;
  type: Station;
}

export interface MapDef {
  id: string;
  /** Building tier (index into TIERS). */
  tier: number;
  /** Redecoration per tier: the dining floor and the wall color. */
  theme: { dining: DiningFloor; wall: string };
  width: number;
  height: number;
  areas: Area[];
  /** Interior rectangle; back walls run along its x0 (left wall) and y0 (right wall) edges. */
  building: { x0: number; y0: number; x1: number; y1: number };
  /** Where the kitchen ends and the dining room begins (the same line in every building). */
  kitchenX: number;
  /** Where the camera looks when this building opens. */
  focus: { x: number; y: number; zoom: number };
  wallHeight: number;
  /** Interior tiles on the building edge that open to the outside tile next to them. */
  doors: { inside: Point; outside: Point }[];
  /** Customers (and applicants) come from and go back to these points on the sidewalk. */
  spawns: Point[];
  /** Strollers walk the whole street, end to end (and the far sidewalk, across the road). */
  streetEnds: Point[];
  farStreetEnds: Point[];
  /** The very first customer is already strolling by the door: no empty first half-minute. */
  firstSpawn: Point;
  /** Line spots, front first (tile centers). */
  queue: Point[];
  /**
   * The building's own layout, in the order tables open: the first `startTables` exist from the
   * start, the rest come when bought without picking a spot ("New table"), each in its design.
   * The player may put tables elsewhere (build mode); how many there can be is this many.
   */
  tables: TableSpot[];
  startTables: number;
  /**
   * The kitchen's stations (src/data/kitchen.ts), all there from the start: the station (a
   * Stove prop, variant = its kind, +10 on the wall line under the hood), where its cook stands
   * and which way they look while cooking.
   */
  stoves: KitchenStation[];
  /** Room for this many cooks: the first `startStoves`, more bought ("another cook"). */
  cookCap: number;
  startStoves: number;
  /** Where a cook stands to set a plate on the pass slot of the same index (the kitchen side). */
  passDrops: Point[];
  pass: Furniture;
  /** Ready dishes wait here (tile centers on top of the pass counter). */
  passSlots: Point[];
  /** Height (px) of the pass counter top, where ready dishes sit. */
  passTop: number;
  /** Where a waiter stands to pick up from a pass slot (same index), on the dining side. */
  pickupSpots: Point[];
  /** The shift manager's post: the end of the pass, where dishes are called out. */
  managerSpot: Point;
  /** The checker's post: the head of the pass, by the back wall, looking down along the dishes. */
  checkerSpot: Point;
  /**
   * The packing corner (from the building that opens it, src/data/unlocks.ts): the counter by
   * the kitchen's front wall with the takeaway window, where the packers stand, and the spot
   * outside the window where couriers take the bags (a path leads there from the sidewalk).
   */
  packing: {
    table: Furniture;
    spots: Point[];
    window: Point;
    scooters: Point[];
    couriers: Point[];
    /** The deliveries' own pass (owner: "their own pass and fridge"): the cooks put delivery
     * food on it while packers work, the packers take it from behind (`pickups`, same index). */
    pass: Furniture;
    slots: Point[];
    pickups: Point[];
    passTop: number;
    /** The drinks fridge: a can goes into every bag; the packer stands at `fridgeSpot`. */
    fridge: Furniture;
    fridgeSpot: Point;
  } | null;
  /**
   * The bar (src/data/bar.ts): by the waiters' lane, open toward the kitchen. A straight counter
   * in the first buildings, then an L, and from the empire three sides (`stage` 1-3). Bartenders
   * stand inside (`stations`, the first one by the pass); ready drinks wait on the counter at
   * `pass` (its top `passTop` px up) for a waiter standing at `pickup`; from the grand restaurant
   * guests sit on stools around it, each served from `serve` across the counter.
   */
  bar: {
    stage: 1 | 2 | 3;
    counters: Furniture[];
    pass: Point;
    passTop: number;
    pickup: Point;
    stations: Point[];
    stools: { at: Point; facing: Facing; serve: Point }[];
  };
  /** Where idle waiters wait (one spot each), the host's post by the door, idle cleaners. */
  waiterIdle: Point[];
  hostSpot: Point;
  /** One post per host (the first is `hostSpot`): bigger buildings employ several. */
  hostSpots: Point[];
  cleanerIdle: Point[];
  /** Job applicants wait here outside the door with their CV. */
  applicantSpots: Point[];
  /** Promoters hand out flyers here on the sidewalk, either side of the door. */
  promoterSpots: Point[];
  /** The tourist bus stops here on the road (its middle), and tourists step off at `busDoor`. */
  busStop: Point;
  busDoor: Point;
  /** Couriers' scooters park here (the sidewalk's curb side), each courier waits beside theirs. */
  scooterSpots: Point[];
  courierSpots: Point[];
  /** Festival trophies won stand here, at the back of the sidewalk past the applicants. */
  trophySpots: Point[];
  sink: Furniture;
  washerSpot: Point;
  /** More dishwashing lines in the bigger kitchens: a sink and where its washer stands. All wash the same pile. */
  extraSinks: { sink: Furniture; washer: Point }[];
  /** Where dirty plates are dropped for the dishwasher. */
  dirtyDrop: Point;
  /** Plate stacks on the sink counter (tile centers) and the counter height. */
  cleanStack: Point;
  dirtyStack: Point;
  sinkTop: number;
  /** Order tickets hang along this line above the pass (kitchen side). */
  ticketRail: { x: number; y0: number; step: number; lift: number; max: number };
  decor: Furniture[];
  /**
   * Scenery behind the back walls. Purely visual: the sim ignores it and the renderer paints it
   * into the background before the walls, so the walls hide it the way they should.
   */
  backdrop: Furniture[];
}

/** The chair sits on the tile toward -x from its table, pushed in close; the sitter faces +x. */
export const CHAIR_OFFSET: Point = { x: -0.62, y: 0 };
/** Seats around a table: the first chair, then the one opposite it (bought: "More chairs"). */
export const SEAT_OFFSETS: readonly Point[] = [CHAIR_OFFSET, { x: 0.62, y: 0 }];
/**
 * A square family table (owner request): two chairs on each side. The chairs stay in the same
 * tiles as a couple's, so nothing about the room changes but how many sit there.
 */
export const FAMILY_SEATS: readonly Point[] = [
  { x: -0.62, y: -0.26 },
  { x: 0.62, y: -0.26 },
  { x: -0.62, y: 0.26 },
  { x: 0.62, y: 0.26 },
];
export const MAX_SEATS = FAMILY_SEATS.length;
/** Where each chair of a table with this many seats stands. */
export const seatOffsetsFor = (seats: number): readonly Point[] => (seats > SEAT_OFFSETS.length ? FAMILY_SEATS : SEAT_OFFSETS);
export { SERVE_OFFSET } from './tables';
/**
 * The opposite chair faces away from the camera, so its backrest is a prop of its own placed
 * this far past the chair: it then sorts (and draws) in front of the person sitting there.
 */
export const BACKREST_SHIFT = 0.2;


// ---------- the generator ----------
// One world for every building (owner request: "every area of the map shows, locked until it
// is paid for, and it grows in every direction, not only to the right"). The last building is
// the whole site; each smaller one sits inside it and grows by TIERS[t].grow on each side:
// right (the dining room), back (more rows behind), front (into the front yard) and left (a
// wider kitchen with more lines of stoves). The street stays where the last building's front
// will be, so a small restaurant has a front yard and a path to its door. Everything inside is
// placed from the room's own edges, so the first diner is laid out exactly as it always was,
// only further into the world (a test checks it), and a later building only ADDS space.

type Rect = { x0: number; y0: number; x1: number; y1: number };

/**
 * The first diner: a kitchen 7 tiles wide (owner M29: "a huge kitchen"; it was 4 until save
 * v13), a dining room of 8, 10 rows deep.
 */
const BASE = { kitchen: 7, dining: 8, depth: 10 } as const;
/**
 * Land around the whole site (owner: "make the map bigger, prettier past the road"): grass and
 * trees left, right and behind. The saves before (v9 and older) had 2 tiles left and behind.
 */
const MARGIN_SIDE = 6;
const MARGIN_BACK = 4;
const OLD_MARGIN = 2;
/**
 * Across the street: sidewalk (2 tiles) and road (3) as before, then the far sidewalk, a park
 * with a plaza and a fountain in the middle, and a strip of grass at the bottom edge.
 */
const STREET = { sidewalk: 2, road: 3, far: 2, park: 9, edge: 1 } as const;
const STREET_DEPTH = STREET.sidewalk + STREET.road + STREET.far + STREET.park + STREET.edge;
/** The dining room's staff posts and neon signs come every this many tiles (the room's tables are laid out in src/sim/layout.ts). */
const BLOCK = 6;
/** Cooks at most per building (the kitchen has more stations than that, src/data/kitchen.ts). */
const COOK_CAP: readonly number[] = [2, 2, 3, 6, 8, 12, 14, 16];
/** Island counters come in runs of this many tiles, a gap between runs to walk through. */
const ISLAND_RUN = 4;
/** A third dishwashing line once the kitchen is this deep (the second one is at row 9). */
const THIRD_SINK_DEPTH = 18;

const LAST = TIERS.length - 1;
const grown = (side: keyof Grow, tier: number) => TIERS.slice(1, tier + 1).reduce((sum, t) => sum + t.grow[side], 0);
/** The first diner's corner in the world: room left of it and behind it for the buildings to come. */
const DINER_X0 = MARGIN_SIDE + grown('left', LAST);
const DINER_Y0 = MARGIN_BACK + grown('back', LAST);
/** Where the kitchen ends and the dining room starts, in every building. */
const KITCHEN_X = DINER_X0 + BASE.kitchen;
/** The front of the last building: the sidewalk starts here. */
const STREET_Y = DINER_Y0 + BASE.depth + grown('front', LAST);

/** The building of tier `t` in world tiles. */
export function tierRect(t: number): Rect {
  return {
    x0: DINER_X0 - grown('left', t),
    y0: DINER_Y0 - grown('back', t),
    x1: KITCHEN_X + BASE.dining + grown('right', t),
    y1: DINER_Y0 + BASE.depth + grown('front', t),
  };
}

const WORLD = { width: tierRect(LAST).x1 + MARGIN_SIDE, height: STREET_Y + STREET_DEPTH };

/**
 * How far the first diner's dining room sits from where it was in the oldest maps (its kitchen
 * ended at x = 6, its back wall at y = 2): old saves move by this, all steps together.
 */
export const WORLD_SHIFT: Point = { x: KITCHEN_X - 6, y: DINER_Y0 - 2 };

/**
 * Where the first diner's corner was in the saves of v8 and v9 (2 tiles of grass, then room for
 * the buildings up to the galaxy): v7 saves moved there, v9 saves move on to where it is now
 * (more land round the site, and the crown's growth left and back).
 */
const V9_DINER: Point = { x: OLD_MARGIN + 4, y: OLD_MARGIN + 8 };
/** Where it was in v10 saves, before the buildings grew north (more land behind the site). */
const V10_DINER: Point = { x: MARGIN_SIDE + 6, y: MARGIN_BACK + 10 };
/** Where the first diner's corner was in v11-v13 saves; its kitchen was 4 tiles wide then (the big kitchen, M29, pushed the room right). */
const V13_DINER: Point = { x: MARGIN_SIDE + 6, y: DINER_Y0 };
const V13_KITCHEN_X = V13_DINER.x + 4;
export const SAVE_SHIFT = {
  v8: { x: V9_DINER.x - 2, y: V9_DINER.y - 2 },
  v10: { x: V10_DINER.x - V9_DINER.x, y: V10_DINER.y - V9_DINER.y },
  v11: { x: V13_DINER.x - V10_DINER.x, y: V13_DINER.y - V10_DINER.y },
  v14: { x: KITCHEN_X - V13_KITCHEN_X, y: 0 },
} as const;

/** `outer` minus `inner` (inside it), as up to four rectangles: behind, in front, left, right. */
function ring(outer: Rect, inner: Rect): Rect[] {
  const out: Rect[] = [
    { x0: outer.x0, y0: outer.y0, x1: outer.x1, y1: inner.y0 },
    { x0: outer.x0, y0: inner.y1, x1: outer.x1, y1: outer.y1 },
    { x0: outer.x0, y0: inner.y0, x1: inner.x0, y1: inner.y1 },
    { x0: inner.x1, y0: inner.y0, x1: outer.x1, y1: inner.y1 },
  ];
  return out.filter((r) => r.x1 > r.x0 && r.y1 > r.y0);
}

/** A number in [0, 1) from two integers: the scenery is placed by it, the same every time. */
const scatterK = (a: number, b: number): number => {
  const h = Math.sin(a * 91.3 + b * 47.9) * 24634.6345;
  return h - Math.floor(h);
};

/** Prep tables come in this many setups (src/render/art/kitchenArt.ts). */
export const PREP_KINDS = 6;

/** The back of the house (prep variants PREP_KINDS + these): stores, reach-in fridge, stock pot, butchery, pastry, speed rack. */
export const BACK_KINDS = 6;
const Back = { Stores: 0, Fridge: 1, Stock: 2, Butcher: 3, Pastry: 4, Rack: 5 } as const;
/** A corner is four pieces that belong together. */
const BACK_CORNERS: readonly (readonly number[])[] = [
  [Back.Fridge, Back.Stores, Back.Stores, Back.Rack],
  [Back.Stock, Back.Stock, Back.Stock, Back.Fridge],
  [Back.Butcher, Back.Butcher, Back.Butcher, Back.Fridge],
  [Back.Pastry, Back.Rack, Back.Pastry, Back.Pastry],
];

/**
 * The kitchen (owner M29: "an open kitchen, Michelin level"). Columns counted from the dining
 * room (X = KITCHEN_X - x): the waiters' lane (0.5), the pass (1.5), then lines of stations at
 * X = 2.5, 4.5, 6.5... each with its cooks standing behind it (X + 1) FACING THE ROOM, so the
 * guests watch the wok toss and the sushi cut. The first line is the chef's line, right behind
 * the pass along its slots: its cooks set the plate straight onto the pass. The cooks of the
 * lines behind carry their plates round to the ends of the pass. Lines come in runs of four
 * with a gap to walk through; the back row stays free to walk along. Runs a station started
 * are finished with prep tables (a board of vegetables, bowls, plates being dressed, herbs...).
 */
function kitchenOf(tier: number, r: Rect, passLength: number, packing: boolean): { stoves: KitchenStation[]; prep: Furniture[] } {
  const W = KITCHEN_X - r.x0;
  const D = r.y1 - r.y0;
  const tile = (X: number, row: number): Point => ({ x: KITCHEN_X - X, y: r.y0 + row + 0.5 });
  // The front rows stay free: the way along the kitchen to the door side, and the packing corner.
  const lastRow = D - (packing ? 3 : 2);
  type Slot = { X: number; row: number; run: number };
  // The chef's line: one station behind each pass slot. Then each line's runs.
  const chef: Slot[] = Array.from({ length: passLength }, (_, i) => ({ X: 2.5, row: 1 + i, run: 0 }));
  const lines: Slot[][][] = [];
  let runId = 1;
  for (let X = 4.5; X + 1 <= W - 0.5; X += 2) {
    const line: Slot[][] = [];
    let row = 1;
    while (row <= lastRow) {
      const run: Slot[] = [];
      for (let k = 0; k < ISLAND_RUN && row <= lastRow; k++, row++) run.push({ X, row, run: runId });
      line.push(run);
      runId++;
      row += 1;
    }
    lines.push(line);
  }
  // Stations fill the chef's line, then the runs nearest the pass across every line, then the
  // next runs down: the whole width of the kitchen cooks.
  const order: Slot[] = [...chef];
  for (let k = 0; lines.some((l) => l[k]); k++) for (const line of lines) if (line[k]) order.push(...line[k]!);
  const plan = KITCHEN_STATIONS[Math.min(tier, KITCHEN_STATIONS.length - 1)]!;
  const stoves: KitchenStation[] = [];
  const used = new Set<Slot>();
  const usedRuns = new Set<number>();
  for (const type of plan) {
    const slot = order.find((x) => !used.has(x));
    if (!slot) break;
    used.add(slot);
    usedRuns.add(slot.run);
    const at = tile(slot.X, slot.row);
    stoves.push({
      stove: { kind: K.Stove, x: at.x, y: at.y, w: 1, d: 1, blocks: true, variant: type },
      cook: { x: at.x - 1.05, y: at.y },
      facing: Facing.FrontRight,
      type,
    });
  }
  // Prep tables finish the runs the stations started. In a big kitchen every other run behind
  // them is a corner of the back of the house (the stores, the butchery, pastry, the stock
  // pots), each run its own, so a big kitchen reads as a place, not rows of the same table.
  const prep: Furniture[] = [];
  const add = (slot: Slot, variant: number) => {
    const at = tile(slot.X, slot.row);
    prep.push({ kind: K.Prep, x: at.x, y: at.y, w: 1, d: 1, blocks: true, variant });
  };
  lines.forEach((line, li) => {
    line.forEach((run, k) => {
      if (run.some((x) => used.has(x))) {
        for (const x of run) if (!used.has(x)) add(x, Math.floor(scatterK(tile(x.X, x.row).x, tile(x.X, x.row).y) * PREP_KINDS));
      } else if (k % 2 === 1 && line.slice(0, k).some((r) => r.some((x) => used.has(x)))) {
        // Shifted by line and by run: no corner sits beside one like it, along a line or across.
        const theme = BACK_CORNERS[(li + Math.floor(k / 2)) % BACK_CORNERS.length]!;
        run.forEach((x, i) => add(x, PREP_KINDS + theme[i % theme.length]!));
      }
    });
  });
  return { stoves, prep };
}


/** A number in [0, 1) from two integers: the scenery is placed by it, the same every time. */
const scatter = (a: number, b: number): number => {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

/** Trees all round the site: two rows behind it and three columns down each side (baked into the backdrop). */
function siteTrees(width: number): Furniture[] {
  const out: Furniture[] = [];
  const tree = (x: number, y: number, k: number): Furniture => ({ kind: K.Tree, x, y, w: 1, d: 1, blocks: false, ...(scatter(x, y + k) > 0.5 ? { variant: 1 } : {}) });
  for (const [row, y] of [[0, 0.9], [1, 2.7]] as const) {
    for (let x = 1 + row * 1.6, i = 0; x < width - 0.6; x += 3.2, i++) out.push(tree(x + (scatter(i, row) - 0.5) * 0.8, y + (scatter(row, i) - 0.5) * 0.5, i));
  }
  for (const side of [0, 1]) {
    for (const [col, dx] of [[0, 0.9], [1, 2.7], [2, 4.5]] as const) {
      for (let y = MARGIN_BACK + 0.8 + col * 1.3, i = 0; y < STREET_Y - 0.8; y += 3, i++) {
        const x = side === 0 ? dx : width - dx;
        out.push(tree(x + (scatter(i, col + side * 3) - 0.5) * 0.6, y, i + col));
      }
    }
  }
  return out;
}

/** Across the road (the same for every building): the far sidewalk, cars by its curb, and the park. */
function acrossTheStreet(width: number, doors: readonly number[]): { areas: Area[]; decor: Furniture[] } {
  const road = STREET_Y + STREET.sidewalk;
  const far = road + STREET.road;
  const park = far + STREET.far;
  const plazaX = Math.round(width / 2);
  const plaza = { x0: plazaX - 4, y0: park + 1, x1: plazaX + 4, y1: park + 8 };
  const pathY = park + 4;
  const fx = (kind: PropKind, x: number, y: number, variant = 0): Furniture => ({ kind, x, y, w: 0, d: 0, blocks: false, ...(variant ? { variant } : {}) });
  const decor: Furniture[] = [];
  // Cars parked along the far curb, never on a crosswalk.
  for (let x = 3, i = 0; x < width - 2; x += 5.5, i++) {
    if (doors.some((d) => Math.abs(d - x) < 2.6)) continue;
    if (scatter(i, 7) < 0.25) continue;
    decor.push(fx(K.Car, x + (scatter(i, 3) - 0.5), road + 2.45, Math.floor(scatter(i, 5) * 4)));
  }
  // Street lamps on the far sidewalk, between the near ones.
  for (let x = 12; x < width; x += 10) decor.push(fx(K.Lamp, x, far + 0.2));
  // The plaza: a fountain in the middle, benches facing it, flowers at the corners.
  decor.push(fx(K.ParkFountain, plazaX, park + 4.5));
  for (const [dx, dy, facing] of [[-2.6, 2.2, 0], [2.6, 2.2, 0], [-2.6, 6.8, 1], [2.6, 6.8, 1]] as const) decor.push(fx(K.Bench, plazaX + dx, park + dy, facing));
  for (const [dx, dy] of [[-3.5, 1.5], [3.5, 1.5], [-3.5, 7.5], [3.5, 7.5]] as const) decor.push(fx(K.Planter, plazaX + dx, park + dy, (dx > 0 ? 1 : 0)));
  // Market stalls along the front of the park, either side of the plaza.
  for (const [dx, v] of [[-7.5, 0], [-11, 1], [7.5, 2], [11, 0]] as const) if (plazaX + dx > 2 && plazaX + dx < width - 2) decor.push(fx(K.Stall, plazaX + dx, park + 0.9, v));
  // A playground off to one side.
  decor.push(fx(K.Slide, plazaX - 16, park + 6.5));
  // Benches along the gravel path, and trees all over the park (not on the plaza, the path or the playground).
  for (let x = 4, i = 0; x < width - 3; x += 9, i++) if (Math.abs(x - plazaX) > 6 && Math.abs(x - (plazaX - 16)) > 3) decor.push(fx(K.Bench, x, pathY - 0.45, 0));
  for (const [row, y] of [[0, park + 2], [1, park + 6.6], [2, park + 8.3]] as const) {
    for (let x = 1.5 + row * 1.7, i = 0; x < width - 1; x += 3.4, i++) {
      const tx = x + (scatter(i, row + 9) - 0.5) * 0.9;
      const ty = y + (scatter(row + 9, i) - 0.5) * 0.5;
      if (tx > plaza.x0 - 1.2 && tx < plaza.x1 + 1.2 && ty < plaza.y1 + 0.5) continue;
      if (Math.abs(tx - (plazaX - 16)) < 2.5 && ty > park + 5) continue;
      if (row === 0 && [-7.5, -11, 7.5, 11].some((dx) => Math.abs(tx - (plazaX + dx)) < 1.6)) continue;
      decor.push({ kind: K.Tree, x: tx, y: ty, w: 1, d: 1, blocks: false, ...(scatter(i, row) > 0.5 ? { variant: 1 } : {}) });
    }
  }
  // Flower planters dotted along the path.
  for (let x = 8.5, i = 0; x < width - 3; x += 13, i++) if (Math.abs(x - plazaX) > 6) decor.push(fx(K.Planter, x, pathY + 1.4, i % 2));
  const areas: Area[] = [
    { x0: 0, y0: far, x1: width, y1: far + STREET.far, floor: 'sidewalk', walkable: true },
    { x0: 0, y0: park, x1: width, y1: park + STREET.park, floor: 'park', walkable: false },
    { x0: 0, y0: pathY, x1: width, y1: pathY + 1, floor: 'gravel', walkable: false },
    { x0: plazaX - 18, y0: park + 5, x1: plazaX - 14, y1: park + 8, floor: 'gravel', walkable: false },
    { ...plaza, floor: 'plaza', walkable: false },
  ];
  return { areas, decor };
}

/** How many bartenders' places (and stools along the side) the bar has in each building. */
const BAR_LEN: readonly number[] = [3, 3, 4, 4, 5, 5, 6, 6];
/** The bar's counter top (px): the height drinks stand at. */
const BAR_TOP = 24;

/**
 * The bar of building `tier`: a column for the bartenders right by the waiters' lane (the side
 * open toward the kitchen), the counter on its far side, stools beyond it. It stays where the
 * first diner had it, growing longer and gaining sides with the buildings.
 */
function barOf(tier: number, y1: number): MapDef['bar'] {
  const stage = tier >= 4 ? 3 : tier >= BAR.seatsTier ? 2 : 1;
  const len = BAR_LEN[tier] ?? 3;
  const ix = KITCHEN_X + 1.5;
  const cx = ix + 1;
  const r0 = DINER_Y0 + 2.5;
  const r1 = r0 + len - 1;
  const piece = (x: number, y: number, variant: number): Furniture => ({ kind: K.BarCounter, x, y, w: 1, d: 1, blocks: true, variant });
  const counters: Furniture[] = [];
  for (let y = r0; y <= r1; y++) counters.push(piece(cx, y, 0));
  if (stage >= 2) counters.push(piece(ix, r0 - 1, 1), piece(cx, r0 - 1, 2));
  if (stage >= 3) counters.push(piece(ix, r1 + 1, 4), piece(cx, r1 + 1, 3));
  // Ready drinks wait at the end of the counter nearest the waiters.
  const pass = stage === 1 ? { x: cx, y: r0 } : { x: ix, y: r0 - 1 };
  const passPiece = counters.find((c) => c.x === pass.x && c.y === pass.y)!;
  passPiece.variant = (passPiece.variant ?? 0) + 10;
  const stools: MapDef['bar']['stools'] = [];
  if (tier >= BAR.seatsTier) {
    for (let y = r0; y <= r1; y++) stools.push({ at: { x: cx + 1, y }, facing: Facing.BackLeft, serve: { x: ix, y } });
    if (stage >= 3) {
      stools.push({ at: { x: ix, y: r0 - 2 }, facing: Facing.FrontLeft, serve: { x: ix, y: r0 } });
      if (r1 + 2 < y1 - 1) stools.push({ at: { x: ix, y: r1 + 2 }, facing: Facing.BackRight, serve: { x: ix, y: r1 } });
    }
  }
  return {
    stage,
    counters,
    pass,
    passTop: BAR_TOP,
    pickup: stage === 1 ? { x: cx, y: r0 - 1 } : { x: ix - 1, y: r0 - 1 },
    stations: Array.from({ length: len }, (_, k) => ({ x: ix, y: r0 + k })),
    stools,
  };
}

const ALL_DOORS = TIERS.map((_, t) => tierRect(t).x1 - 1.5);
const ACROSS = acrossTheStreet(WORLD.width, ALL_DOORS);
const SITE_TREES = siteTrees(WORLD.width);

function buildMap(tier: number): MapDef {
  const t = TIERS[tier]!;
  const r = tierRect(tier);
  const { x1, y1 } = r;
  const depth = y1 - r.y0;
  const deep = depth > BASE.depth;
  const { width, height } = WORLD;
  const door = x1 - 1.5;
  const KX = KITCHEN_X;
  const blocks = Math.round((x1 - KX - BASE.dining) / BLOCK);
  const fridgeY = deep ? y1 - 1.5 : r.y0 + 8.5;
  // A longer pass in a deep building: five dishes wait at once instead of three.
  const passLength = deep ? 5 : 3;
  const slots = Array.from({ length: passLength }, (_, i) => r.y0 + 1.5 + i);
  // The dish pit: behind the chef's line, below the pass (further down in a deep kitchen, whose pass is longer).
  const sinkRow = deep ? 7 : 6;
  const kitchen = kitchenOf(tier, r, passLength, tier >= UNLOCK_TIER.packer);
  // The land of the buildings to come: the next one for sale, the others fenced off and locked.
  const future = TIERS.slice(tier + 1).flatMap((_, k) => {
    const u = tier + 1 + k;
    return ring(tierRect(u), tierRect(u - 1)).map((piece) => ({ piece, tier: u }));
  });
  // One sign per building to come, on the side of its land the camera sees best: beside the
  // dining room (right), toward the street (front), behind the back wall at its far end (it is
  // clear of the wall there), or past the kitchen at its front end.
  const signFor = (u: number): Point | null => {
    const pieces = future.filter((f) => f.tier === u).map((f) => f.piece);
    const right = pieces.find((p) => p.x0 >= x1);
    if (right) return { x: (right.x0 + right.x1) / 2 + 0.5, y: u === tier + 1 ? y1 - 1.4 : (right.y0 + right.y1) / 2 };
    const front = pieces.find((p) => p.y0 >= y1 && (p.x1 - p.x0) * (p.y1 - p.y0) >= 6);
    if (front) return { x: (front.x0 + front.x1) / 2, y: (front.y0 + front.y1) / 2 };
    const back = pieces.find((p) => p.y1 <= r.y0);
    if (back) return { x: back.x1 - 1, y: (back.y0 + back.y1) / 2 };
    const left = pieces.find((p) => p.x1 <= r.x0);
    return left ? { x: (left.x0 + left.x1) / 2, y: left.y1 - 1 } : null;
  };
  const saleAt = tier + 1 < TIERS.length ? signFor(tier + 1) : null;
  // From the sidewalk to the door, while there is a front yard.
  const path: Area[] = y1 < STREET_Y ? [{ x0: Math.floor(door), y0: y1, x1: Math.floor(door) + 1, y1: STREET_Y, floor: 'path', walkable: true }] : [];
  // The packing corner: its counter in the kitchen's front row, next to the dining room (clear
  // of the stoves, the sinks and the fridge in every kitchen), the packers behind and beside it,
  // and outside the takeaway window a path of its own out to the sidewalk.
  // The kitchen's front row, from the dining room in: the packing counter, the deliveries' own
  // pass (two tiles), the drinks fridge; the packers work in the row behind them.
  const windowScooterX = (i: number) => (i < 4 ? KX + 0.4 + i * 1.6 : KX - 3 - (i - 4) * 1.6);
  const packing: MapDef['packing'] =
    tier >= UNLOCK_TIER.packer
      ? {
          table: { kind: K.PackTable, x: KX - 1.5, y: y1 - 0.5, w: 1, d: 1, blocks: true },
          spots: [
            { x: KX - 1.5, y: y1 - 1.45 },
            { x: KX - 2.6, y: y1 - 1.6 },
            { x: KX - 3.6, y: y1 - 1.6 },
          ],
          window: { x: KX - 1.5, y: y1 + 0.55 },
          // While packers work here the scooters park by the window (the bags come out there),
          // on both sides of its path.
          scooters: Array.from({ length: 14 }, (_, i) => ({ x: windowScooterX(i), y: STREET_Y + 1.72 })),
          couriers: Array.from({ length: 14 }, (_, i) => ({ x: windowScooterX(i) + 0.75, y: STREET_Y + 1.62 })),
          pass: { kind: K.DeliveryPass, x: KX - 3, y: y1 - 0.5, w: 2, d: 1, blocks: true },
          slots: [KX - 3.62, KX - 3, KX - 2.38].map((x) => ({ x, y: y1 - 0.5 })),
          pickups: [KX - 3.62, KX - 3, KX - 2.38].map((x) => ({ x, y: y1 - 1.42 })),
          passTop: 22,
          fridge: { kind: K.DrinksFridge, x: KX - 4.5, y: y1 - 0.5, w: 1, d: 1, blocks: true },
          fridgeSpot: { x: KX - 4.5, y: y1 - 1.45 },
        }
      : null;
  if (packing && y1 < STREET_Y) path.push({ x0: KX - 2, y0: y1, x1: KX - 1, y1: STREET_Y, floor: 'path', walkable: true });
  const bar = barOf(tier, y1);
  return {
    id: t.id,
    tier,
    theme: { dining: t.dining, wall: t.wall },
    width,
    height,
    areas: [
      { x0: 0, y0: 0, x1: width, y1: height, floor: 'grass', walkable: false },
      ...future.map(({ piece, tier: u }) => ({ ...piece, floor: (u === tier + 1 ? 'lot' : 'locked') as FloorStyle, walkable: false })),
      { x0: 0, y0: STREET_Y, x1: width, y1: STREET_Y + 2, floor: 'sidewalk', walkable: true },
      { x0: 0, y0: STREET_Y + 2, x1: width, y1: STREET_Y + 5, floor: 'road', walkable: false },
      ...ACROSS.areas,
      { x0: r.x0, y0: r.y0, x1: KX, y1, floor: 'kitchen', walkable: true },
      { x0: KX, y0: r.y0, x1, y1, floor: t.dining, walkable: true },
      ...path,
    ],
    building: { ...r },
    kitchenX: KX,
    focus: { x: (r.x0 + x1) / 2 + 0.6, y: (r.y0 + y1) / 2 - 0.6 + (STREET_Y - y1) * 0.25, zoom: t.zoom },
    wallHeight: 64,
    doors: [{ inside: { x: door, y: y1 - 0.5 }, outside: { x: door, y: y1 + 0.5 } }],
    firstSpawn: { x: door - 3, y: STREET_Y + 0.6 },
    // Around the corner on either side, as far from the door as the first diner's street ends
    // were (the street is the whole site now: from its ends the walk took half a minute).
    spawns: [
      { x: Math.max(0.5, door - 12), y: STREET_Y + 0.5 },
      { x: Math.min(width - 0.5, door + 9), y: STREET_Y + 1.5 },
    ],
    streetEnds: [
      { x: 0.5, y: STREET_Y + 0.5 },
      { x: width - 0.5, y: STREET_Y + 1.5 },
    ],
    farStreetEnds: [
      { x: 0.5, y: STREET_Y + 5.6 },
      { x: width - 0.5, y: STREET_Y + 6.4 },
    ],
    queue: [
      { x: door, y: y1 - 1.5 },
      { x: door + 1, y: y1 - 1.5 },
      { x: door + 1, y: y1 - 2.5 },
      { x: door + 1, y: y1 - 3.5 },
    ],
    tables: [],
    startTables: 3,
    stoves: kitchen.stoves,
    cookCap: COOK_CAP[tier] ?? COOK_CAP[COOK_CAP.length - 1]!,
    startStoves: 1,
    pass: { kind: K.Pass, x: KX - 1.5, y: r.y0 + 1 + passLength / 2, w: 1, d: passLength, blocks: true, ...(deep ? { variant: 1 } : {}) },
    passSlots: slots.map((y) => ({ x: KX - 1.5, y })),
    passTop: 24,
    pickupSpots: slots.map((y) => ({ x: KX - 0.5, y })),
    // The ends of the pass, where the cooks of the lines behind set their plates down.
    passDrops: [
      { x: KX - 2.45, y: r.y0 + 0.5 },
      { x: KX - 2.45, y: r.y0 + 1.5 + passLength },
    ],
    // Near the pass; bigger buildings employ more waiters, so the line of spots grows.
    waiterIdle: [
      { x: KX + 0.7, y: r.y0 + 4.3 },
      { x: KX + 0.7, y: r.y0 + 5.4 },
      { x: KX + 0.7, y: r.y0 + 3.2 },
      ...(tier > 0 ? [{ x: KX + 0.7, y: r.y0 + 6.5 }, { x: KX + 0.7, y: r.y0 + 2.1 }] : []),
      ...(tier > 1 ? [{ x: KX + 0.7, y: r.y0 + 7.6 }, { x: KX + 0.7, y: r.y0 + 1.0 }] : []),
      // Deeper rooms: on along the kitchen wall toward the street.
      ...Array.from({ length: deep ? Math.floor((depth - 11) / 1.1) : 0 }, (_, i) => ({ x: KX + 0.7, y: r.y0 + 8.7 + i * 1.1 })),
    ],
    hostSpot: { x: x1 - 2.4, y: y1 - 1.6 },
    hostSpots: [
      { x: x1 - 2.4, y: y1 - 1.6 },
      { x: x1 - 3.5, y: y1 - 1.6 },
      { x: x1 - 2.4, y: y1 - 2.7 },
    ],
    checkerSpot: { x: KX - 1.5, y: r.y0 + 0.55 },
    packing,
    bar,
    // At the end of the pass, where dishes are called out.
    managerSpot: { x: KX - 0.5, y: deep ? r.y0 + 1 + passLength + 0.6 : r.y0 + 4.6 },
    cleanerIdle: [
      { x: KX + 1.3, y: y1 - 0.7 },
      { x: KX + 4.3, y: y1 - 0.7 },
      ...Array.from({ length: blocks }, (_, b) => ({ x: KX + 10.3 + b * BLOCK, y: y1 - 0.7 })),
      ...(tier > 1 ? [{ x: KX + 7.3, y: y1 - 0.7 }] : []),
      // A deep room employs more of them than its width has posts: more along the front aisle.
      ...(deep ? Array.from({ length: blocks + 1 }, (_, b) => ({ x: KX + 13.3 + b * BLOCK, y: y1 - 0.7 })).filter((p) => p.x < x1 - 4) : []),
    ],
    // On the sidewalk beside the way in.
    applicantSpots: [
      { x: door + 1.6, y: STREET_Y + 0.7 },
      { x: door + 2.5, y: STREET_Y + 0.95 },
    ],
    // Past the applicants, in the lane by the sidewalk; the bus door is at its back end.
    busStop: { x: Math.min(width - 3, door + 5.5), y: STREET_Y + 2.75 },
    busDoor: { x: Math.min(width - 3, door + 5.5) - 1.1, y: STREET_Y + 1.7 },
    // Left of the door, by the curb: out of the way of the line, the applicants and the bus; the
    // courier waits just behind their scooter (beside it, not on it).
    scooterSpots: Array.from({ length: 14 }, (_, i) => ({ x: Math.max(1.2, door - 3.2 - i * 1.6), y: STREET_Y + 1.72 })),
    courierSpots: Array.from({ length: 14 }, (_, i) => ({ x: Math.max(1.2, door - 3.2 - i * 1.6) + 0.75, y: STREET_Y + 1.62 })),
    trophySpots: Array.from({ length: 6 }, (_, i) => ({ x: Math.min(width - 6, door + 3.4) + i * 0.8, y: STREET_Y + 0.22 })),
    // On the sidewalk's back half (people walk past in front), away from the door and the line.
    promoterSpots: [
      { x: door - 4, y: STREET_Y + 0.55 },
      { x: Math.max(1.5, door - 9), y: STREET_Y + 0.55 },
      { x: Math.max(2.5, door - 14), y: STREET_Y + 0.55 },
    ],
    sink: { kind: K.Sink, x: KX - 3.5, y: r.y0 + sinkRow, w: 1, d: 2, blocks: true },
    washerSpot: { x: KX - 2.45, y: r.y0 + sinkRow },
    // Facing the stoves across the walkway, below the pass.
    extraSinks: [
      ...(deep ? [{ sink: { kind: K.Sink, x: KX - 1.5, y: r.y0 + 9, w: 1, d: 2, blocks: true, variant: 1 }, washer: { x: KX - 0.45, y: r.y0 + 9 } }] : []),
      ...(depth >= THIRD_SINK_DEPTH ? [{ sink: { kind: K.Sink, x: KX - 1.5, y: r.y0 + 12, w: 1, d: 2, blocks: true, variant: 1 }, washer: { x: KX - 0.45, y: r.y0 + 12 } }] : []),
    ],
    dirtyDrop: { x: KX - 2.25, y: r.y0 + sinkRow - 0.75 },
    cleanStack: { x: KX - 3.5, y: r.y0 + sinkRow + 0.5 },
    dirtyStack: { x: KX - 3.5, y: r.y0 + sinkRow - 0.5 },
    sinkTop: 22,
    ticketRail: { x: KX - 1.9, y0: r.y0 + 1.2, step: 0.42, lift: 52, max: deep ? 10 : 7 },
    decor: [
      { kind: K.Fridge, x: r.x0 + 0.5, y: fridgeY, w: 1, d: 1, blocks: true },
      ...kitchen.prep,
      ...(packing ? [packing.table, packing.pass, packing.fridge] : []),
      ...bar.counters,
      ...bar.stools.map((st) => ({ kind: K.BarStool, ...st.at, w: 1, d: 1, blocks: true, variant: st.facing })),
      { kind: K.Plant, x: KX + 0.5, y: r.y0 + 0.5, w: 1, d: 1, blocks: true },
      { kind: K.Plant, x: x1 - 0.5, y: r.y0 + 0.5, w: 1, d: 1, blocks: true, variant: 1 },
      { kind: K.Plant, x: KX + 0.5, y: y1 - 0.5, w: 1, d: 1, blocks: true },
      ...Array.from({ length: blocks + 1 }, (_, b) => ({ kind: K.Neon, x: KX + 4 + b * BLOCK, y: r.y0, w: 0, d: 0, blocks: false, lift: 44 })),
      ...ACROSS.decor,
      ...Array.from({ length: Math.ceil((width - 7) / 10) }, (_, i) => ({ kind: K.Lamp, x: 7 + i * 10, y: STREET_Y + 1.8, w: 0, d: 0, blocks: false })),
      // The next building's land is for sale (tap the sign); the land after it is locked.
      ...(saleAt ? [{ kind: K.SaleSign, ...saleAt, w: 0, d: 0, blocks: false }] : []),
      ...TIERS.map((_, u) => u)
        .filter((u) => u > tier + 1)
        .flatMap((u) => {
          const at = signFor(u);
          return at ? [{ kind: K.LockSign, ...at, w: 0, d: 0, blocks: false, variant: u }] : [];
        }),
      { kind: K.StreetSign, x: door - 1.6, y: STREET_Y + 0.25, w: 0, d: 0, blocks: false },
    ],
    // Trees all round the site, baked into the background (nobody walks among them).
    backdrop: SITE_TREES,
  };
}

const BARE: readonly MapDef[] = TIERS.map((_, t) => buildMap(t));

/**
 * Each building's tables, laid out around what its people need (and the people of every bigger
 * building after it): the smaller building's tables stay put, the new room around them gets its own.
 */
const MAPS: readonly MapDef[] = (() => {
  const out: MapDef[] = [];
  let prev: TableSpot[] = [];
  BARE.forEach((map, tier) => {
    prev = designTables(map, prev, reservedTiles(BARE, tier));
    out.push({ ...map, tables: prev });
  });
  return out;
})();

export const mapForTier = (tier: number): MapDef => MAPS[Math.max(0, Math.min(MAPS.length - 1, tier))]!;

/** The first building (and the map tests use). */
export const STAND_MAP = MAPS[0]!;
