import { PropKind as K, type PropKind } from '../sim/types';

// Maps are in TILE units on the floor plane: +x runs down-right on screen, +y runs down-left
// (isometric). A tile's center is (i + 0.5, j + 0.5).

export interface Point {
  x: number;
  y: number;
}

export type FloorStyle = 'grass' | 'sidewalk' | 'road' | 'kitchen' | 'dining' | 'lot';

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
  id: 'stand';
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
  /** Line spots, front first (tile centers). */
  queue: Point[];
  /** Table tile centers; each has a chair on its -x side where the customer sits. */
  tables: Point[];
  cookSpot: Point;
  stove: Furniture;
  pass: Furniture;
  /** Ready dishes wait here (tile centers on top of the pass counter). */
  passSlots: Point[];
  /** Height (px) of the pass counter top, where ready dishes sit. */
  passTop: number;
  /** Where a waiter stands to pick up from a pass slot (same index), on the dining side. */
  pickupSpots: Point[];
  waiterIdle: Point;
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

export const STAND_MAP: MapDef = {
  id: 'stand',
  width: 22,
  height: 18,
  areas: [
    { x0: 0, y0: 0, x1: 22, y1: 18, floor: 'grass', walkable: false },
    { x0: 14, y0: 3, x1: 21, y1: 11, floor: 'lot', walkable: false },
    { x0: 0, y0: 12, x1: 22, y1: 14, floor: 'sidewalk', walkable: true },
    { x0: 0, y0: 14, x1: 22, y1: 17, floor: 'road', walkable: false },
    { x0: 2, y0: 2, x1: 6, y1: 12, floor: 'kitchen', walkable: true },
    { x0: 6, y0: 2, x1: 14, y1: 12, floor: 'dining', walkable: true },
  ],
  building: { x0: 2, y0: 2, x1: 14, y1: 12 },
  wallHeight: 64,
  doors: [{ inside: { x: 12.5, y: 11.5 }, outside: { x: 12.5, y: 12.5 } }],
  spawns: [
    { x: 0.5, y: 12.5 },
    { x: 21.5, y: 13.5 },
  ],
  queue: [
    { x: 12.5, y: 10.5 },
    { x: 13.5, y: 10.5 },
    { x: 13.5, y: 9.5 },
    { x: 13.5, y: 8.5 },
  ],
  tables: [
    { x: 8.5, y: 4.5 },
    { x: 11.5, y: 4.5 },
    { x: 8.5, y: 8.5 },
  ],
  cookSpot: { x: 3.55, y: 4 },
  stove: { kind: K.Stove, x: 2.5, y: 4, w: 1, d: 2, blocks: true },
  // The pass sits one step from the stove: the cook turns around and sets the plate down.
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
  waiterIdle: { x: 6.7, y: 6.3 },
  sink: { kind: K.Sink, x: 2.5, y: 8, w: 1, d: 2, blocks: true },
  washerSpot: { x: 3.55, y: 8 },
  dirtyDrop: { x: 3.7, y: 6.8 },
  cleanStack: { x: 2.5, y: 8.5 },
  dirtyStack: { x: 2.5, y: 7.5 },
  sinkTop: 22,
  ticketRail: { x: 4.1, y0: 3.2, step: 0.42, lift: 52, max: 7 },
  decor: [
    { kind: K.Fridge, x: 2.5, y: 10.5, w: 1, d: 1, blocks: true },
    { kind: K.Plant, x: 6.5, y: 2.5, w: 1, d: 1, blocks: true },
    { kind: K.Plant, x: 13.5, y: 2.5, w: 1, d: 1, blocks: true, variant: 1 },
    { kind: K.Plant, x: 6.5, y: 11.5, w: 1, d: 1, blocks: true },
    { kind: K.Neon, x: 10, y: 2, w: 0, d: 0, blocks: false, lift: 44 },
    { kind: K.Tree, x: 16, y: 1.2, w: 1, d: 1, blocks: false, variant: 1 },
    { kind: K.Lamp, x: 7, y: 13.8, w: 0, d: 0, blocks: false },
    { kind: K.Lamp, x: 17, y: 13.8, w: 0, d: 0, blocks: false },
    { kind: K.SaleSign, x: 17.5, y: 10.6, w: 0, d: 0, blocks: false },
  ],
  backdrop: [
    { kind: K.Tree, x: 1, y: 1, w: 1, d: 1, blocks: false },
    { kind: K.Tree, x: 6, y: 0.9, w: 1, d: 1, blocks: false, variant: 1 },
    { kind: K.Tree, x: 11.5, y: 0.8, w: 1, d: 1, blocks: false },
    { kind: K.Tree, x: 0.8, y: 5.5, w: 1, d: 1, blocks: false },
    { kind: K.Tree, x: 0.8, y: 9, w: 1, d: 1, blocks: false, variant: 1 },
  ],
};
