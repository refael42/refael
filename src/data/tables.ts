import type { Point } from './maps';

// Table designs (owner: "so many tables in rows looks robotic: from the start, a variety of
// tables to design with, long ones, round ones and more, placed wherever you want by the stage
// you are at"). A style is the look and the shape; how many sit at it still comes from the
// upgrades (one chair, "More chairs" for two, "Family table" for all of them), so every style
// costs the same and the choice is the player's taste and floor space.

export type TableStyle = 'round' | 'square' | 'long' | 'booth';
export const TABLE_STYLES: readonly TableStyle[] = ['round', 'square', 'long', 'booth'];

export interface TableStyleDef {
  id: TableStyle;
  /** The building it opens with (0: the first diner). */
  tier: number;
  /** Tiles the top covers, from its anchor tile (the front one): [dx, dy]. */
  top: readonly (readonly [number, number])[];
}

/**
 * round: the pedestal table (a bigger round top for four); square: a small four-legged table
 * (the big square family table for four); long: two tiles deep, six chairs when full; booth:
 * two sofas facing each other (from the bistro).
 */
export const TABLE_STYLE_DEFS: readonly TableStyleDef[] = [
  { id: 'round', tier: 0, top: [[0, 0]] },
  { id: 'square', tier: 0, top: [[0, 0]] },
  { id: 'long', tier: 0, top: [[0, -1], [0, 0]] },
  { id: 'booth', tier: 1, top: [[0, 0]] },
];

export const styleIndex = (style: TableStyle): number => TABLE_STYLES.indexOf(style);
export const styleDef = (style: TableStyle): TableStyleDef => TABLE_STYLE_DEFS[styleIndex(style)]!;
export const isTableStyle = (v: unknown): v is TableStyle => typeof v === 'string' && (TABLE_STYLES as readonly string[]).includes(v);

/** Chairs sit this far out from the middle of the top, toward -x (the first) and +x. */
const OUT = 0.62;
/** Two on one side of a table for four: this far before and behind its middle. */
const PAIR = 0.26;
/** A long table: its middle is half a tile behind its anchor, and its chairs are this far apart. */
const LONG_MID = -0.5;
const LONG_GAP = 0.62;

const sides = (y: number): Point[] => [{ x: -OUT, y }, { x: OUT, y }];
const ONE_TILE: readonly (readonly Point[])[] = [sides(0).slice(0, 1), sides(0), [...sides(-PAIR), ...sides(PAIR)]];
const LONG: readonly (readonly Point[])[] = [
  sides(LONG_MID).slice(0, 1),
  sides(LONG_MID),
  [...sides(LONG_MID - LONG_GAP), ...sides(LONG_MID), ...sides(LONG_MID + LONG_GAP)],
];

/**
 * Where each chair stands (from the anchor tile's middle), by style index, then [one chair,
 * two, every seat]. Plain data: the renderer reads it too (it lays the plates out from it).
 */
export const SEAT_LAYOUTS: readonly (readonly (readonly Point[])[])[] = TABLE_STYLES.map((st) => (st === 'long' ? LONG : ONE_TILE));
/** The middle of each style's top, from its anchor (plates slide toward it). */
export const TOP_MIDDLE: readonly Point[] = TABLE_STYLES.map((st) => ({ x: 0, y: st === 'long' ? LONG_MID : 0 }));

/** How many sit at a table of this style once it has every chair. */
export const fullSeats = (style: TableStyle): number => SEAT_LAYOUTS[styleIndex(style)]![2]!.length;

/** The chairs of a table with `seats` of them. */
export function seatLayout(style: TableStyle, seats: number): readonly Point[] {
  const all = SEAT_LAYOUTS[styleIndex(style)]!;
  return seats <= 1 ? all[0]! : seats === 2 ? all[1]! : all[2]!;
}

/** Tile centers the top stands on. */
export function topTiles(style: TableStyle, x: number, y: number): Point[] {
  return styleDef(style).top.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
}

/** Tile centers of the chairs on one side (-1: the first chair's side, 1: the one opposite). */
export function sideTiles(style: TableStyle, x: number, y: number, side: -1 | 1): Point[] {
  return styleDef(style).top.map(([dx, dy]) => ({ x: x + dx + side, y: y + dy }));
}

/** Every tile the table and all of its chairs ever take (the room is planned for the most). */
export function footprint(style: TableStyle, x: number, y: number): Point[] {
  return [...topTiles(style, x, y), ...sideTiles(style, x, y, -1), ...sideTiles(style, x, y, 1)];
}

/** A table's place: its anchor (the front tile's middle) and its design. */
export interface TableSpot {
  x: number;
  y: number;
  style: TableStyle;
}

/** Where staff stand to serve or clear a table: its front edge, clear of the chairs (every style's front is its anchor tile). */
export const SERVE_OFFSET: Point = { x: 0, y: 0.75 };
export const serveSpot = (x: number, y: number): Point => ({ x: x + SERVE_OFFSET.x, y: y + SERVE_OFFSET.y });

/**
 * The look of a table bought without picking a spot (the upgrade list, the balance bot, a save
 * from before tables had looks): a mix of the open one-tile styles, by its place in the
 * opening order, so a room filled that way is not rows of the same table.
 */
export function autoStyle(index: number, tier: number): TableStyle {
  const open = TABLE_STYLE_DEFS.filter((d) => d.tier <= tier && d.top.length === 1).map((d) => d.id);
  // A fixed shuffle (no dice): neighbors differ, and booths come every so often.
  const pattern: readonly TableStyle[] = ['round', 'square', 'booth', 'round', 'square', 'round', 'booth', 'square'];
  for (let k = 0; k < pattern.length; k++) {
    const st = pattern[(index * 5 + k) % pattern.length]!;
    if (open.includes(st)) return st;
  }
  return 'round';
}
