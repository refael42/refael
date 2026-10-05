import { PropKind as K, type PropKind } from '../sim/types';
import { TIERS, type DiningFloor } from './buildings';

// Maps are in TILE units on the floor plane: +x runs down-right on screen, +y runs down-left
// (isometric). A tile's center is (i + 0.5, j + 0.5).

export interface Point {
  x: number;
  y: number;
}

export type FloorStyle = 'grass' | 'sidewalk' | 'road' | 'kitchen' | 'lot' | DiningFloor;

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
  wallHeight: number;
  /** Interior tiles on the building edge that open to the outside tile next to them. */
  doors: { inside: Point; outside: Point }[];
  /** Pedestrians and customers appear/vanish at these sidewalk ends. */
  spawns: Point[];
  /** The very first customer is already strolling by the door: no empty first half-minute. */
  firstSpawn: Point;
  /** Line spots, front first (tile centers). */
  queue: Point[];
  /**
   * Every table spot, in the order they open: the first `startTables` exist from the start,
   * the rest are bought ("New table"). Each has a chair on its -x side where the customer sits.
   */
  tables: Point[];
  startTables: number;
  /** Stove spots and where their cook stands; like tables, the first `startStoves` exist. */
  stoves: { stove: Furniture; cook: Point }[];
  startStoves: number;
  pass: Furniture;
  /** Ready dishes wait here (tile centers on top of the pass counter). */
  passSlots: Point[];
  /** Height (px) of the pass counter top, where ready dishes sit. */
  passTop: number;
  /** Where a waiter stands to pick up from a pass slot (same index), on the dining side. */
  pickupSpots: Point[];
  /** Where idle waiters wait (one spot each), the host's post by the door, idle cleaners. */
  waiterIdle: Point[];
  hostSpot: Point;
  cleanerIdle: Point[];
  /** Job applicants wait here outside the door with their CV. */
  applicantSpots: Point[];
  sink: Furniture;
  washerSpot: Point;
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


// ---------- the generator ----------
// Every tier shares the kitchen strip (x 2..6) and the depth (y 2..12); the dining room
// reaches TIERS[t].width, and the lot for the next tier lies right of it. Tier 0 reproduces
// the original hand-tuned diner exactly (a test checks it), so later tiers only ADD space.

const Y0 = 2;
const Y1 = 12;
const HEIGHT = 18;
/** Tables come in blocks of two columns, three tiles apart; the first block starts here. */
const FIRST_TABLE_COLUMN = 8.5;
const BLOCK = 6;
/** Opening order inside a block: spread out first, so a few tables already fill the room. */
const BLOCK_ORDER: readonly [number, number][] = [[0, 4.5], [1, 4.5], [0, 8.5], [1, 8.5], [0, 6.5], [1, 6.5], [0, 10.5]];
/** Trees behind the building line, left to right; those behind a wall go into the backdrop. */
const BACK_TREES: readonly [number, number, number][] = [[1, 1, 0], [6, 0.9, 1], [11.5, 0.8, 0], [16, 1.2, 1], [21.5, 1, 0], [26.5, 1.1, 1]];

function tableSpots(width: number): Point[] {
  const spots: Point[] = [];
  for (let b = 0; FIRST_TABLE_COLUMN + b * BLOCK + 3 < width - 2; b++) {
    const c0 = FIRST_TABLE_COLUMN + b * BLOCK;
    for (const [col, y] of BLOCK_ORDER) spots.push({ x: c0 + col * 3, y });
    // The previous door corner is free now that the door moved on.
    if (b > 0) spots.push({ x: c0 - 3, y: 10.5 });
  }
  return spots;
}

function buildMap(tier: number): MapDef {
  const t = TIERS[tier]!;
  const next = TIERS[tier + 1];
  const x1 = t.width;
  const width = (next?.width ?? x1) + 2;
  const door = x1 - 1.5;
  const blocks = Math.round((x1 - TIERS[0]!.width) / BLOCK);
  const behindWall = (x: number) => x < x1 + 1;
  const trees = BACK_TREES.filter(([x]) => x < width - 0.5).map(([x, y, variant]) => ({ kind: K.Tree, x, y, w: 1, d: 1, blocks: false, ...(variant ? { variant } : {}) }));
  return {
    id: t.id,
    tier,
    theme: { dining: t.dining, wall: t.wall },
    width,
    height: HEIGHT,
    areas: [
      { x0: 0, y0: 0, x1: width, y1: HEIGHT, floor: 'grass', walkable: false },
      ...(next ? [{ x0: x1, y0: 3, x1: next.width + 1, y1: 11, floor: 'lot' as const, walkable: false }] : []),
      { x0: 0, y0: 12, x1: width, y1: 14, floor: 'sidewalk', walkable: true },
      { x0: 0, y0: 14, x1: width, y1: 17, floor: 'road', walkable: false },
      { x0: 2, y0: Y0, x1: 6, y1: Y1, floor: 'kitchen', walkable: true },
      { x0: 6, y0: Y0, x1, y1: Y1, floor: t.dining, walkable: true },
    ],
    building: { x0: 2, y0: Y0, x1, y1: Y1 },
    wallHeight: 64,
    doors: [{ inside: { x: door, y: 11.5 }, outside: { x: door, y: 12.5 } }],
    firstSpawn: { x: door - 3, y: 12.6 },
    spawns: [
      { x: 0.5, y: 12.5 },
      { x: width - 0.5, y: 13.5 },
    ],
    queue: [
      { x: door, y: 10.5 },
      { x: door + 1, y: 10.5 },
      { x: door + 1, y: 9.5 },
      { x: door + 1, y: 8.5 },
    ],
    tables: tableSpots(x1),
    startTables: 3,
    stoves: [
      { stove: { kind: K.Stove, x: 2.5, y: 4, w: 1, d: 2, blocks: true }, cook: { x: 3.55, y: 4 } },
      { stove: { kind: K.Stove, x: 2.5, y: 6, w: 1, d: 2, blocks: true }, cook: { x: 3.55, y: 6 } },
    ],
    startStoves: 1,
    pass: { kind: K.Pass, x: 4.5, y: 4.5, w: 1, d: 3, blocks: true },
    passSlots: [
      { x: 4.5, y: 3.5 },
      { x: 4.5, y: 4.5 },
      { x: 4.5, y: 5.5 },
    ],
    passTop: 24,
    pickupSpots: [
      { x: 5.5, y: 3.5 },
      { x: 5.5, y: 4.5 },
      { x: 5.5, y: 5.5 },
    ],
    // Near the pass; bigger buildings employ more waiters, so the line of spots grows.
    waiterIdle: [
      { x: 6.7, y: 6.3 },
      { x: 6.7, y: 7.4 },
      { x: 6.7, y: 5.2 },
      ...(tier > 0 ? [{ x: 6.7, y: 8.5 }, { x: 6.7, y: 4.1 }] : []),
      ...(tier > 1 ? [{ x: 6.7, y: 9.6 }, { x: 6.7, y: 3.0 }] : []),
    ],
    hostSpot: { x: x1 - 2.4, y: 10.4 },
    cleanerIdle: [
      { x: 7.3, y: 11.3 },
      { x: 10.3, y: 11.3 },
      ...Array.from({ length: blocks }, (_, b) => ({ x: 16.3 + b * BLOCK, y: 11.3 })),
      ...(tier > 1 ? [{ x: 13.3, y: 11.3 }] : []),
    ],
    applicantSpots: [
      { x: x1 + 0.1, y: 12.7 },
      { x: x1 + 1, y: 12.95 },
    ],
    sink: { kind: K.Sink, x: 2.5, y: 8, w: 1, d: 2, blocks: true },
    washerSpot: { x: 3.55, y: 8 },
    dirtyDrop: { x: 3.75, y: 7.25 },
    cleanStack: { x: 2.5, y: 8.5 },
    dirtyStack: { x: 2.5, y: 7.5 },
    sinkTop: 22,
    ticketRail: { x: 4.1, y0: 3.2, step: 0.42, lift: 52, max: 7 },
    decor: [
      { kind: K.Fridge, x: 2.5, y: 10.5, w: 1, d: 1, blocks: true },
      { kind: K.Plant, x: 6.5, y: 2.5, w: 1, d: 1, blocks: true },
      { kind: K.Plant, x: x1 - 0.5, y: 2.5, w: 1, d: 1, blocks: true, variant: 1 },
      { kind: K.Plant, x: 6.5, y: 11.5, w: 1, d: 1, blocks: true },
      ...Array.from({ length: blocks + 1 }, (_, b) => ({ kind: K.Neon, x: 10 + b * BLOCK, y: 2, w: 0, d: 0, blocks: false, lift: 44 })),
      ...trees.filter((f) => !behindWall(f.x)),
      ...Array.from({ length: Math.ceil((width - 7) / 10) }, (_, i) => ({ kind: K.Lamp, x: 7 + i * 10, y: 13.8, w: 0, d: 0, blocks: false })),
      ...(next ? [{ kind: K.SaleSign, x: x1 + (next.width - x1) / 2 + 0.5, y: 10.6, w: 0, d: 0, blocks: false }] : []),
      { kind: K.StreetSign, x: x1 - 3.1, y: 12.25, w: 0, d: 0, blocks: false },
    ],
    backdrop: [...trees.filter((f) => behindWall(f.x)), { kind: K.Tree, x: 0.8, y: 5.5, w: 1, d: 1, blocks: false }, { kind: K.Tree, x: 0.8, y: 9, w: 1, d: 1, blocks: false, variant: 1 }],
  };
}

const MAPS: readonly MapDef[] = TIERS.map((_, t) => buildMap(t));

export const mapForTier = (tier: number): MapDef => MAPS[Math.max(0, Math.min(MAPS.length - 1, tier))]!;

/** The first building (and the map tests use). */
export const STAND_MAP = MAPS[0]!;
