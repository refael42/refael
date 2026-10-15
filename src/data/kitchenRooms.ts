import { PropKind as K, type PropKind } from '../sim/types';

// The kitchen in rooms (owner M32: "divide the kitchen into sections: the kitchen with its cold
// and hot lines, dishwashing, vegetable cutting, service prep, everything in rooms; the kitchen
// itself is a room divided into its lines, dishwashing grows into a room of its own, vegetables a
// room of their own, prep a room, a fridge and freezer room with doors, and a small manager's
// office, very detailed"). The line room stays open to the pass (an open kitchen). Below it, off
// a corridor, bands of rooms with walls and doors; the bigger the building, the more rooms.
// Walls stand on tile edges (people only cross at the doors); the rooms' furniture blocks tiles.

export type RoomKind = 'dish' | 'cold' | 'veg' | 'office' | 'prep' | 'stores' | 'pastry' | 'butchery';
/** By index: the rooms' signs and floors are drawn by it (src/render). */
export const ROOM_KINDS: readonly RoomKind[] = ['dish', 'cold', 'veg', 'office', 'prep', 'stores', 'pastry', 'butchery'];

/** Each room's floor (src/render/art/background.ts), and the two sections of the line room's. */
export type RoomFloor = 'lineHot' | 'lineCold' | 'dishRoom' | 'coldRoom' | 'freezer' | 'vegRoom' | 'office' | 'prepRoom' | 'stores' | 'pastry' | 'butchery';
export const ROOM_FLOOR: Record<RoomKind, RoomFloor> = {
  dish: 'dishRoom',
  cold: 'coldRoom',
  veg: 'vegRoom',
  office: 'office',
  prep: 'prepRoom',
  stores: 'stores',
  pastry: 'pastry',
  butchery: 'butchery',
};
/** The line room's signs, after the rooms' (RoomSign variant). */
export const SIGN_HOT = ROOM_KINDS.length;
export const SIGN_COLD = ROOM_KINDS.length + 1;

/**
 * The rooms in the order they get their place, and the building each opens with. A band of rooms
 * takes as many as fit (two tiles wide at least); what width is left over widens them again.
 */
export const ROOMS: readonly { kind: RoomKind; tier: number }[] = [
  { kind: 'dish', tier: 0 },
  { kind: 'cold', tier: 0 },
  { kind: 'veg', tier: 2 },
  { kind: 'office', tier: 2 },
  { kind: 'prep', tier: 3 },
  { kind: 'stores', tier: 3 },
  { kind: 'pastry', tier: 4 },
  { kind: 'butchery', tier: 5 },
];

/** The widest a room grows from the width left over (the office stays small, as asked). */
const MAX_WIDTH: Partial<Record<RoomKind, number>> = { office: 3, cold: 5 };
const MAX_ROOM = 4;
const MIN_ROOM = 2;

/**
 * What stands in the rooms (RoomPiece props, `variant`): the prep tables' and the back of the
 * house's looks (0-11, src/render/art/kitchenArt.ts), then the rooms' own pieces.
 */
export const RoomItem = {
  VegBoard: 0,
  Bowls: 1,
  Plating: 2,
  Herbs: 3,
  Dough: 4,
  Spices: 5,
  Stores: 6,
  Fridge: 7,
  StockPots: 8,
  Butcher: 9,
  Pastry: 10,
  Rack: 11,
  DishMachine: 12,
  DryingRack: 13,
  CoolerShelf: 14,
  FreezerShelf: 15,
  IceChest: 16,
  Desk: 17,
  Safe: 18,
  Coffee: 19,
  Bookshelf: 20,
  VegSink: 21,
  Plant: 22,
} as const;
export const ROOM_ITEMS = 23;
/** The first of the rooms' own pieces (the ones before are the prep and back-of-house looks). */
export const ROOM_OWN = RoomItem.DishMachine;

/** Each room's furniture along its back wall, in turn from the door (the fridge goes in the cold room first). */
const ITEMS: Record<RoomKind, readonly number[]> = {
  dish: [RoomItem.DishMachine, RoomItem.DryingRack, RoomItem.Rack],
  cold: [RoomItem.CoolerShelf, RoomItem.Stores, RoomItem.CoolerShelf, RoomItem.Fridge],
  veg: [RoomItem.VegSink, RoomItem.VegBoard, RoomItem.Herbs, RoomItem.VegBoard, RoomItem.Stores, RoomItem.VegBoard],
  office: [RoomItem.Bookshelf, RoomItem.Desk, RoomItem.Safe, RoomItem.Coffee, RoomItem.Plant, RoomItem.Bookshelf],
  prep: [RoomItem.Bowls, RoomItem.Plating, RoomItem.StockPots, RoomItem.Spices, RoomItem.Dough, RoomItem.Rack],
  stores: [RoomItem.Stores, RoomItem.Rack, RoomItem.Stores, RoomItem.Fridge, RoomItem.Stores],
  pastry: [RoomItem.Pastry, RoomItem.Dough, RoomItem.Rack, RoomItem.Pastry, RoomItem.Fridge],
  butchery: [RoomItem.Butcher, RoomItem.Fridge, RoomItem.Butcher, RoomItem.Stores],
};
/** What whoever works in each room works at, best first. */
const WORK: Record<RoomKind, readonly number[]> = {
  dish: [],
  cold: [RoomItem.CoolerShelf],
  veg: [RoomItem.VegBoard, RoomItem.VegSink],
  office: [RoomItem.Desk],
  prep: [RoomItem.Plating, RoomItem.Bowls, RoomItem.StockPots],
  stores: [RoomItem.Stores, RoomItem.Rack],
  pastry: [RoomItem.Pastry, RoomItem.Dough],
  butchery: [RoomItem.Butcher],
};
const FREEZER_ITEMS = [RoomItem.FreezerShelf, RoomItem.IceChest, RoomItem.FreezerShelf];

/** A unit of wall on a tile edge: along x (the edge y = `y` from x to x + 1), or along y (x = `x`, from y to y + 1). */
export interface Edge {
  x: number;
  y: number;
  along: 'x' | 'y';
}

/** Doors: swinging doors with round windows, the cold rooms' insulated doors, the office's wooden one. */
export const DoorKind = { Swing: 0, Cold: 1, Office: 2 } as const;
export type DoorKind = (typeof DoorKind)[keyof typeof DoorKind];

/** Walls: white tiles under glass, the cold rooms' insulated panels, the office's wood and glass. */
export const WallStyle = { Tile: 0, Cold: 1, Office: 2 } as const;

export interface RoomDoor extends Edge {
  kind: DoorKind;
  room: RoomKind;
}

export interface RoomWall extends Edge {
  style: number;
}

export interface Room {
  kind: RoomKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The cold room's freezer (from this x on), behind a door of its own. */
  freezerX?: number;
  /**
   * Whoever works in the room (src/sim/game/crew.ts): the piece they work at (`task`: its
   * RoomItem), where they stand, and which way they face it (`front`: toward the camera, like
   * a cook behind a station; else with their back to us, at the room's back wall).
   */
  work: { x: number; y: number };
  post: { x: number; y: number };
  front: boolean;
  task: number;
}

interface Piece {
  kind: PropKind;
  x: number;
  y: number;
  w: number;
  d: number;
  blocks: boolean;
  variant?: number;
}

export interface RoomsPlan {
  rooms: Room[];
  walls: RoomWall[];
  doors: RoomDoor[];
  pieces: Piece[];
  /** The dish room's sinks (the first is the main one) and where each washer stands. */
  sinks: { sink: Piece; washer: { x: number; y: number } }[];
  dirtyDrop: { x: number; y: number };
  /** The upgradable fridge (the "ingredients" track) stands in the cold room. */
  fridge: Piece;
}

/** Bands of rooms: about this many rows each, never fewer than MIN_BAND, a corridor row between them. */
const BAND = 5;
const MIN_BAND = 4;

/** The bands' rows [y0, y1) in [y0, y1): as even as they come. */
export function bandsIn(y0: number, y1: number): [number, number][] {
  const left = y1 - y0;
  if (left < MIN_BAND) return [];
  let n = Math.max(1, Math.round((left + 1) / (BAND + 1)));
  while (n > 1 && Math.floor((left - (n - 1)) / n) < MIN_BAND) n--;
  const base = Math.floor((left - (n - 1)) / n);
  let extra = left - (n - 1) - base * n;
  const out: [number, number][] = [];
  for (let i = 0, y = y0; i < n; i++) {
    const h = base + (extra-- > 0 ? 1 : 0);
    out.push([y, y + h]);
    y += h + 1;
  }
  return out;
}

/** How the dish room's sinks stack: per column of sinks, how many pairs of columns, and a column of its own for the machine. */
function dishShape(h: number, sinks: number): { perCol: number; pairs: number; machineCol: boolean; width: number } {
  const perCol = Math.max(1, Math.floor(h / 2));
  const pairs = Math.ceil(sinks / perCol);
  // The dish machine and the racks stand in the sinks' columns where there is room, else in a column by the door.
  const machineCol = pairs * h - sinks * 2 < 2;
  return { perCol, pairs, machineCol, width: pairs * 2 + (machineCol ? 1 : 0) };
}

/** A room's usual width: what a band takes rooms by (the last band squeezes in what is left, two tiles each). */
const ROOM_WIDTH = 3;
/** The back rooms a big kitchen has more of, once every room has its place (least of them first). */
const EXTRAS: readonly RoomKind[] = ['stores', 'prep', 'veg', 'cold', 'pastry', 'butchery'];

/** Which rooms go in each band, and how wide: east to west, the dish room first by the lane. */
function lineUp(tier: number, x0: number, x1: number, bands: [number, number][], sinkCount: number): Room[] {
  const open = ROOMS.filter((r) => r.tier <= tier).map((r) => r.kind);
  const queue = open.filter((k) => k !== 'dish');
  const used = new Map<RoomKind, number>();
  const rooms: Room[] = [];
  bands.forEach(([ry0, ry1], b) => {
    const band: { kind: RoomKind; width: number }[] = [];
    let left = x1 - x0;
    if (b === 0) {
      const width = Math.min(left, dishShape(ry1 - ry0, sinkCount).width);
      band.push({ kind: 'dish', width });
      left -= width;
    }
    const take = (kind: RoomKind) => {
      band.push({ kind, width: MIN_ROOM });
      used.set(kind, (used.get(kind) ?? 0) + 1);
    };
    const last = b === bands.length - 1;
    const fit = Math.min(queue.length, Math.floor(left / (last ? MIN_ROOM : ROOM_WIDTH)));
    for (let i = 0; i < fit; i++) take(queue.shift()!);
    // Every room has its place: more of the back rooms, the ones this band lacks and the kitchen has least of.
    const extras = EXTRAS.filter((k) => open.includes(k));
    const count = () => band.filter((r) => r.kind !== 'dish').length;
    while (b > 0 && queue.length === 0 && left - ROOM_WIDTH * (count() + 1) >= 0) {
      const next = extras.filter((k) => !band.some((r) => r.kind === k)).sort((a, c) => (used.get(a) ?? 0) - (used.get(c) ?? 0))[0];
      if (!next) break;
      take(next);
    }
    left -= MIN_ROOM * count();
    // The width left widens the rooms in turn (the cold room first: from four tiles it has a freezer).
    while (left > 0 && band.length > 0) {
      const grow = band
        .filter((r) => r.kind !== 'dish' && r.width < (MAX_WIDTH[r.kind] ?? MAX_ROOM))
        .sort((a, c) => a.width - c.width || Number(c.kind === 'cold') - Number(a.kind === 'cold'))[0];
      (grow ?? band[band.length - 1]!).width += 1;
      left -= 1;
    }
    let x = x1;
    for (const r of band) {
      rooms.push({ kind: r.kind, x0: x - r.width, y0: ry0, x1: x, y1: ry1, post: { x: 0, y: 0 }, work: { x: 0, y: 0 }, front: false, task: -1 });
      x -= r.width;
    }
  });
  return rooms;
}

/**
 * Lays out the rooms in [x0, x1) x [y0, y1) (x1: the kitchen's lane by the dining room stays
 * outside them, the waiters bring the dirty plates down it; `front`: the building's front wall).
 */
export function planRooms(tier: number, x0: number, x1: number, y0: number, y1: number, front: number, sinkCount: number): RoomsPlan {
  const rooms = lineUp(tier, x0, x1, bandsIn(y0, y1), sinkCount);
  const walls: RoomWall[] = [];
  const doors: RoomDoor[] = [];
  const pieces: Piece[] = [];
  const sinks: RoomsPlan['sinks'] = [];
  let dirtyDrop = { x: x1 - 0.5, y: y0 - 0.5 };
  let fridge: Piece | null = null;
  const put = (x: number, y: number, variant: number) => pieces.push({ kind: K.RoomPiece, x: x + 0.5, y: y + 0.5, w: 1, d: 1, blocks: true, variant });
  const doorKind = (kind: RoomKind): DoorKind => (kind === 'cold' ? DoorKind.Cold : kind === 'office' ? DoorKind.Office : DoorKind.Swing);
  const wallStyle = (kind: RoomKind) => (kind === 'cold' ? WallStyle.Cold : kind === 'office' ? WallStyle.Office : WallStyle.Tile);

  for (const room of rooms) {
    const { kind } = room;
    const w = room.x1 - room.x0;
    const h = room.y1 - room.y0;
    const taken = new Set<string>();
    const free = (x: number, y: number) => !taken.has(`${x},${y}`);
    const take = (x: number, y: number) => taken.add(`${x},${y}`);
    let aisle = room.x0 + 1;
    if (kind === 'dish') {
      // Sinks two tiles each, stacked down their columns, each washer beside theirs; the main
      // sink nearest the lane. The way in from the lane is the top row on the east side, the
      // nearest the pass: the waiters bring the dirty plates there.
      const shape = dishShape(h, sinkCount);
      const east = room.x1 - (shape.machineCol ? 1 : 0);
      for (let k = 0; k < sinkCount; k++) {
        const col = east - 2 - Math.floor(k / shape.perCol) * 2;
        if (col < room.x0) break;
        const row = room.y0 + (k % shape.perCol) * 2;
        sinks.push({ sink: { kind: K.Sink, x: col + 0.5, y: row + 1, w: 1, d: 2, blocks: true, ...(k > 0 ? { variant: 1 } : {}) }, washer: { x: col + 1.55, y: row + 1 } });
        take(col, row);
        take(col, row + 1);
      }
      const doorRow = room.y0;
      doors.push({ x: room.x1, y: doorRow, along: 'y', kind: DoorKind.Swing, room: kind });
      dirtyDrop = { x: room.x1 - 0.55, y: doorRow + 0.5 };
      // The washers' columns stay free to walk; the dish machine and the racks fill the rest
      // (the door's row aside).
      for (let c = east - 1; c >= room.x0; c -= 2) for (let y = room.y0; y < room.y1; y++) take(c, y);
      let k = 0;
      for (let x = room.x1 - 1; x >= room.x0; x--) {
        for (let y = room.y0; y < room.y1; y++) {
          if (!free(x, y) || (x === room.x1 - 1 && y === doorRow)) continue;
          put(x, y, ITEMS.dish[k++ % ITEMS.dish.length]!);
          take(x, y);
        }
      }
      // The way in from the corridor: the westmost washer's column.
      aisle = Math.max(room.x0, east - 1 - (shape.pairs - 1) * 2);
      room.work = { x: sinks[0]?.sink.x ?? room.x0 + 0.5, y: sinks[0]?.sink.y ?? room.y0 + 1 };
      room.post = sinks[0]?.washer ?? { x: aisle + 0.5, y: room.y0 + 0.5 };
    } else {
      for (let y = room.y0; y < room.y1; y++) take(aisle, y);
      if (kind === 'cold' && w >= 4) {
        // A walk-in cooler and, behind an insulated door of its own, the freezer.
        const split = room.x0 + 2;
        room.freezerX = split;
        doors.push({ x: split, y: room.y0 + 1, along: 'y', kind: DoorKind.Cold, room: kind });
        for (let y = room.y0; y < room.y1; y++) if (y !== room.y0 + 1) walls.push({ x: split, y, along: 'y', style: WallStyle.Cold });
        for (let y = room.y0; y < room.y1; y++) take(split, y);
        let f = 0;
        for (let y = room.y0; y < room.y1; y++) {
          for (let x = split + 1; x < room.x1; x++) {
            put(x, y, FREEZER_ITEMS[f++ % FREEZER_ITEMS.length]!);
            take(x, y);
          }
        }
      }
      // Along the back wall first (the west column), then the rest; the cold room's first tile is the fridge.
      const list = ITEMS[kind];
      let k = 0;
      for (let x = room.x0; x < room.x1; x++) {
        for (let y = room.y0; y < room.y1; y++) {
          if (!free(x, y)) continue;
          take(x, y);
          if (kind === 'cold' && !fridge) {
            fridge = { kind: K.Fridge, x: x + 0.5, y: y + 0.5, w: 1, d: 1, blocks: true };
            continue;
          }
          put(x, y, list[k++ % list.length]!);
        }
      }
      // Whoever works here: at the room's own work (the vegetables' board, the butcher's
      // block...), on the aisle's far side if it is there (facing us across it), else at the back
      // wall; the office's manager at the desk, in its chair.
      const mine = pieces.filter((p) => p.x > room.x0 && p.x < room.x1 && p.y > room.y0 && p.y < room.y1);
      const wanted = WORK[kind];
      const at =
        wanted.flatMap((v) => mine.filter((p) => p.variant === v && p.x > aisle + 1).sort((a, c) => a.y - c.y)).find(() => true) ??
        wanted.flatMap((v) => mine.filter((p) => p.variant === v && p.x < aisle).sort((a, c) => a.y - c.y)).find(() => true);
      if (at) {
        room.front = at.x > aisle + 1;
        room.work = { x: at.x, y: at.y };
        room.task = at.variant ?? -1;
        room.post = { x: room.front ? at.x - 1.05 : kind === 'office' ? at.x + 0.66 : at.x + 1.05, y: at.y };
      } else {
        room.work = { x: room.x0 + 0.5, y: room.y0 + 1.5 };
        room.post = { x: aisle + 0.5, y: room.y0 + 1.5 };
      }
    }
    doors.push({ x: aisle, y: room.y0, along: 'x', kind: doorKind(kind), room: kind });
    // Its walls: the north side (the door aside), the south side unless it is the building's
    // front, the west side unless it is the building's side wall; the east side on the room by
    // the lane (the next room's west wall is this one's east wall).
    const style = wallStyle(kind);
    for (let x = room.x0; x < room.x1; x++) {
      if (x !== aisle) walls.push({ x, y: room.y0, along: 'x', style });
      if (room.y1 < front) walls.push({ x, y: room.y1, along: 'x', style });
    }
    if (room.x0 > x0) for (let y = room.y0; y < room.y1; y++) walls.push({ x: room.x0, y, along: 'y', style });
    if (room.x1 === x1) {
      for (let y = room.y0; y < room.y1; y++) if (!doors.some((d) => d.along === 'y' && d.x === x1 && d.y === y)) walls.push({ x: x1, y, along: 'y', style });
    }
  }
  // No room for a cold room (no building is that small): the fridge at the corridor's end.
  fridge ??= { kind: K.Fridge, x: x0 + 0.5, y: y0 - 0.5, w: 1, d: 1, blocks: true };
  return { rooms, walls, doors, pieces, sinks, dirtyDrop, fridge };
}

/**
 * The rooms' crew (src/sim/game/crew.ts): seconds at their work before an errand (to the
 * walk-in for supplies, the manager to the coffee machine or out to watch the line), how long
 * they stop there, how fast they walk.
 */
export const CREW = {
  work: { min: 14, max: 32 },
  stop: { min: 2, max: 4 },
  speed: 1.3,
  /** An errand is a trip to the walk-in this often (else a short stretch where they are). */
  fetchChance: 0.6,
  /** Someone this close to a doorway (tiles, across it / along it) holds the door open. */
  doorReach: 0.8,
  doorHalf: 0.5,
} as const;
