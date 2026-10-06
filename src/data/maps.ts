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
  /** The shift manager's post: the end of the pass, where dishes are called out. */
  managerSpot: Point;
  /** Where idle waiters wait (one spot each), the host's post by the door, idle cleaners. */
  waiterIdle: Point[];
  hostSpot: Point;
  cleanerIdle: Point[];
  /** Job applicants wait here outside the door with their CV. */
  applicantSpots: Point[];
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
export const MAX_SEATS = SEAT_OFFSETS.length;
/** Where staff stand to serve or clear a table: its front edge, clear of both chairs. */
export const SERVE_OFFSET: Point = { x: 0, y: 0.75 };
/**
 * The opposite chair faces away from the camera, so its backrest is a prop of its own placed
 * this far past the chair: it then sorts (and draws) in front of the person sitting there.
 */
export const BACKREST_SHIFT = 0.2;


// ---------- the generator ----------
// Every tier shares the kitchen strip (x 2..6) and starts at the back wall (y 2). The dining
// room reaches TIERS[t].width, and the lot for the next tier lies right of it; from the grand
// restaurant on the building also grows toward the street (TIERS[t].depth), the street moves
// down, and the kitchen gets more stoves and a longer pass. Tier 0 reproduces the original
// hand-tuned diner exactly (a test checks it), so later tiers only ADD space.

const Y0 = 2;
/** The original front wall: deeper buildings than this get the bigger kitchen. */
const BASE_DEPTH = 12;
/** Sidewalk (2 tiles), road (3) and a strip of grass in front of the building. */
const STREET = 6;
/** Tables come in blocks of two columns, three tiles apart; the first block starts here. */
const FIRST_TABLE_COLUMN = 8.5;
const BLOCK = 6;
/** Opening order inside a block: spread out first, so a few tables already fill the room. */
const BLOCK_ORDER: readonly [number, number][] = [[0, 4.5], [1, 4.5], [0, 8.5], [1, 8.5], [0, 6.5], [1, 6.5], [0, 10.5]];
/** Trees behind the building line, left to right; those behind a wall go into the backdrop. */
const BACK_TREES: readonly [number, number, number][] = [[1, 1, 0], [6, 0.9, 1], [11.5, 0.8, 0], [16, 1.2, 1], [21.5, 1, 0], [26.5, 1.1, 1], [31, 0.9, 0], [35.5, 1.2, 1], [39.5, 1, 0], [43.5, 0.9, 1], [47.5, 1.1, 0], [51, 1, 1]];
/** Stove rows on the kitchen's back wall in a deep building (the sink keeps y 8). */
const DEEP_STOVES: readonly number[] = [4, 6, 10, 12, 14, 16, 18];
/** A third dishwashing line once the kitchen is this deep (the second one is at y 11). */
const THIRD_SINK_DEPTH = 20;

/** Every table spot of a room this size, block by block. */
function roomSpots(width: number, depth: number): Point[] {
  const deep = depth > BASE_DEPTH;
  // A deeper room adds rows toward the street, keeping the front row free as the aisle.
  const extra: [number, number][] = deep ? [[1, 10.5]] : [];
  for (let y = 12.5; deep && y <= depth - 1.5; y += 2) extra.push([0, y], [1, y]);
  const spots: Point[] = [];
  for (let b = 0; FIRST_TABLE_COLUMN + b * BLOCK + 3 < width - 2; b++) {
    const c0 = FIRST_TABLE_COLUMN + b * BLOCK;
    for (const [col, y] of [...BLOCK_ORDER, ...extra]) spots.push({ x: c0 + col * 3, y });
    // The previous door corner is free now that the door moved on (deep rooms have it already).
    if (b > 0 && !deep) spots.push({ x: c0 - 3, y: 10.5 });
  }
  return spots;
}

/** A tier's spots: the smaller building's first, in the same order (tables you bought stay put), then the new ones. */
function tableSpots(tier: number): Point[] {
  const t = TIERS[tier]!;
  const all = roomSpots(t.width, t.depth);
  if (tier === 0) return all;
  const prev = tableSpots(tier - 1);
  const had = new Set(prev.map((p) => `${p.x},${p.y}`));
  return [...prev, ...all.filter((p) => !had.has(`${p.x},${p.y}`))];
}

function buildMap(tier: number): MapDef {
  const t = TIERS[tier]!;
  const next = TIERS[tier + 1];
  const x1 = t.width;
  const y1 = t.depth;
  const deep = y1 > BASE_DEPTH;
  const width = (next?.width ?? x1) + 2;
  const height = y1 + STREET;
  const door = x1 - 1.5;
  const blocks = Math.round((x1 - TIERS[0]!.width) / BLOCK);
  const behindWall = (x: number) => x < x1 + 1;
  const trees = BACK_TREES.filter(([x]) => x < width - 0.5).map(([x, y, variant]) => ({ kind: K.Tree, x, y, w: 1, d: 1, blocks: false, ...(variant ? { variant } : {}) }));
  // The kitchen: the original two stoves, or a row of them along the back wall up to the fridge.
  const fridgeY = deep ? y1 - 1.5 : 10.5;
  const stoveRows = deep ? DEEP_STOVES.filter((y) => y + 1 <= fridgeY - 0.5) : [4, 6];
  // A longer pass in a deep building: five dishes wait at once instead of three.
  const passLength = deep ? 5 : 3;
  const passY = 3 + passLength / 2;
  const slots = Array.from({ length: passLength }, (_, i) => 3.5 + i);
  return {
    id: t.id,
    tier,
    theme: { dining: t.dining, wall: t.wall },
    width,
    height,
    areas: [
      { x0: 0, y0: 0, x1: width, y1: height, floor: 'grass', walkable: false },
      ...(next ? [{ x0: x1, y0: 3, x1: next.width + 1, y1: y1 - 1, floor: 'lot' as const, walkable: false }] : []),
      { x0: 0, y0: y1, x1: width, y1: y1 + 2, floor: 'sidewalk', walkable: true },
      { x0: 0, y0: y1 + 2, x1: width, y1: y1 + 5, floor: 'road', walkable: false },
      { x0: 2, y0: Y0, x1: 6, y1, floor: 'kitchen', walkable: true },
      { x0: 6, y0: Y0, x1, y1, floor: t.dining, walkable: true },
    ],
    building: { x0: 2, y0: Y0, x1, y1 },
    wallHeight: 64,
    doors: [{ inside: { x: door, y: y1 - 0.5 }, outside: { x: door, y: y1 + 0.5 } }],
    firstSpawn: { x: door - 3, y: y1 + 0.6 },
    spawns: [
      { x: 0.5, y: y1 + 0.5 },
      { x: width - 0.5, y: y1 + 1.5 },
    ],
    queue: [
      { x: door, y: y1 - 1.5 },
      { x: door + 1, y: y1 - 1.5 },
      { x: door + 1, y: y1 - 2.5 },
      { x: door + 1, y: y1 - 3.5 },
    ],
    tables: tableSpots(tier),
    startTables: 3,
    stoves: stoveRows.map((y) => ({ stove: { kind: K.Stove, x: 2.5, y, w: 1, d: 2, blocks: true }, cook: { x: 3.55, y } })),
    startStoves: 1,
    pass: { kind: K.Pass, x: 4.5, y: passY, w: 1, d: passLength, blocks: true, ...(deep ? { variant: 1 } : {}) },
    passSlots: slots.map((y) => ({ x: 4.5, y })),
    passTop: 24,
    pickupSpots: slots.map((y) => ({ x: 5.5, y })),
    // Near the pass; bigger buildings employ more waiters, so the line of spots grows.
    waiterIdle: [
      { x: 6.7, y: 6.3 },
      { x: 6.7, y: 7.4 },
      { x: 6.7, y: 5.2 },
      ...(tier > 0 ? [{ x: 6.7, y: 8.5 }, { x: 6.7, y: 4.1 }] : []),
      ...(tier > 1 ? [{ x: 6.7, y: 9.6 }, { x: 6.7, y: 3.0 }] : []),
      // Deeper rooms: on along the kitchen wall toward the street.
      ...Array.from({ length: deep ? Math.floor((y1 - 13) / 1.1) : 0 }, (_, i) => ({ x: 6.7, y: 10.7 + i * 1.1 })),
    ],
    hostSpot: { x: x1 - 2.4, y: y1 - 1.6 },
    // At the end of the pass, where dishes are called out.
    managerSpot: { x: 5.5, y: deep ? 3 + passLength + 0.6 : 6.6 },
    cleanerIdle: [
      { x: 7.3, y: y1 - 0.7 },
      { x: 10.3, y: y1 - 0.7 },
      ...Array.from({ length: blocks }, (_, b) => ({ x: 16.3 + b * BLOCK, y: y1 - 0.7 })),
      ...(tier > 1 ? [{ x: 13.3, y: y1 - 0.7 }] : []),
    ],
    applicantSpots: [
      { x: x1 + 0.1, y: y1 + 0.7 },
      { x: x1 + 1, y: y1 + 0.95 },
    ],
    sink: { kind: K.Sink, x: 2.5, y: 8, w: 1, d: 2, blocks: true },
    washerSpot: { x: 3.55, y: 8 },
    // Facing the stoves across the walkway, below the pass.
    extraSinks: [
      ...(deep ? [{ sink: { kind: K.Sink, x: 4.5, y: 11, w: 1, d: 2, blocks: true, variant: 1 }, washer: { x: 5.55, y: 11 } }] : []),
      ...(y1 >= THIRD_SINK_DEPTH ? [{ sink: { kind: K.Sink, x: 4.5, y: 14, w: 1, d: 2, blocks: true, variant: 1 }, washer: { x: 5.55, y: 14 } }] : []),
    ],
    dirtyDrop: { x: 3.75, y: 7.25 },
    cleanStack: { x: 2.5, y: 8.5 },
    dirtyStack: { x: 2.5, y: 7.5 },
    sinkTop: 22,
    ticketRail: { x: 4.1, y0: 3.2, step: 0.42, lift: 52, max: deep ? 10 : 7 },
    decor: [
      { kind: K.Fridge, x: 2.5, y: fridgeY, w: 1, d: 1, blocks: true },
      { kind: K.Plant, x: 6.5, y: 2.5, w: 1, d: 1, blocks: true },
      { kind: K.Plant, x: x1 - 0.5, y: 2.5, w: 1, d: 1, blocks: true, variant: 1 },
      { kind: K.Plant, x: 6.5, y: y1 - 0.5, w: 1, d: 1, blocks: true },
      ...Array.from({ length: blocks + 1 }, (_, b) => ({ kind: K.Neon, x: 10 + b * BLOCK, y: 2, w: 0, d: 0, blocks: false, lift: 44 })),
      ...trees.filter((f) => !behindWall(f.x)),
      ...Array.from({ length: Math.ceil((width - 7) / 10) }, (_, i) => ({ kind: K.Lamp, x: 7 + i * 10, y: y1 + 1.8, w: 0, d: 0, blocks: false })),
      ...(next ? [{ kind: K.SaleSign, x: x1 + (next.width - x1) / 2 + 0.5, y: y1 - 1.4, w: 0, d: 0, blocks: false }] : []),
      { kind: K.StreetSign, x: x1 - 3.1, y: y1 + 0.25, w: 0, d: 0, blocks: false },
    ],
    backdrop: [
      ...trees.filter((f) => behindWall(f.x)),
      { kind: K.Tree, x: 0.8, y: 5.5, w: 1, d: 1, blocks: false },
      { kind: K.Tree, x: 0.8, y: 9, w: 1, d: 1, blocks: false, variant: 1 },
      ...(deep ? [{ kind: K.Tree, x: 0.8, y: 12.5, w: 1, d: 1, blocks: false }] : []),
      ...(y1 >= 16 ? [{ kind: K.Tree, x: 0.8, y: 15.5, w: 1, d: 1, blocks: false, variant: 1 }] : []),
      ...(y1 >= 20 ? [{ kind: K.Tree, x: 0.8, y: 19, w: 1, d: 1, blocks: false }] : []),
    ],
  };
}

const MAPS: readonly MapDef[] = TIERS.map((_, t) => buildMap(t));

export const mapForTier = (tier: number): MapDef => MAPS[Math.max(0, Math.min(MAPS.length - 1, tier))]!;

/** The first building (and the map tests use). */
export const STAND_MAP = MAPS[0]!;
