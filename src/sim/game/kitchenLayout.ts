import { BACK_KINDS, PREP_KINDS, type Point } from '../../data/maps';
import { reachableFrom, walled, type Grid, type KitchenTiles } from '../grid';
import { staffSpots } from '../layout';
import { PropKind } from '../types';
import type { PropView } from '../types';
import type { GameState, KitchenSpot } from './types';

// The kitchen laid out by the player (owner M30: "the kitchen much more open to design, placed
// however you want"; M47: "every block in the kitchen movable, so the player arranges it the way
// they want"). In build mode every piece of kitchen furniture (a station, a prep table, any
// room's furniture, the fridge) can go to any free kitchen tile or trade places with any other,
// as long as everyone can still get to where they work: a station keeps its cook behind it
// (facing the pass), a room's work piece keeps its crew at it, and with the change made every
// cook, crew, washer, checker and packer spot, the future stations' tiles and every errand's
// spot must still be open and reachable from the door. The walls, the doors, the pass and the
// dish line are the building's and stay where they are.

/** A piece of the kitchen: a station (its index in `s.stoves`), a prep piece or another piece of furniture (its prop id). */
export type KitchenPiece = { kind: 'station'; index: number } | { kind: 'prep'; id: number } | { kind: 'item'; id: number };

/** How far behind its station a cook stands (src/data/maps.ts kitchenOf), and a crew from its work piece. */
const COOK_BEHIND = 1.05;

/** The furniture a player can move besides the stations: prep pieces, then the rooms' pieces and the fridge. */
const ITEM_KINDS: readonly number[] = [PropKind.RoomPiece, PropKind.Fridge];
const MOVABLE: readonly number[] = [PropKind.Prep, ...ITEM_KINDS];

const inKitchen = (s: GameState, x: number, y: number): boolean => {
  const b = s.map.building;
  return x >= b.x0 && x < s.map.kitchenX && y >= b.y0 && y < b.y1;
};

const propOf = (s: GameState, id: number, kinds: readonly number[]): PropView | undefined => s.props.find((p) => p.id === id && kinds.includes(p.kind));
const prepProp = (s: GameState, id: number) => propOf(s, id, [PropKind.Prep]);

/** The prop that stands for a piece (a station's too). */
function propFor(s: GameState, piece: KitchenPiece): PropView | undefined {
  if (piece.kind === 'station') {
    const sv = s.stoves[piece.index];
    return sv ? s.props.find((q) => q.id === sv.propId) : undefined;
  }
  return propOf(s, piece.id, piece.kind === 'prep' ? [PropKind.Prep] : ITEM_KINDS);
}

/** Where a piece stands (null: gone). */
export function pieceAt(s: GameState, piece: KitchenPiece): { x: number; y: number } | null {
  if (piece.kind === 'station') {
    const sv = s.stoves[piece.index];
    return sv ? { x: sv.x, y: sv.y } : null;
  }
  const p = propFor(s, piece);
  return p && inKitchen(s, p.x, p.y) ? { x: p.x, y: p.y } : null;
}

/** Every piece that can be moved now (for picking one in build mode). */
export function kitchenPieces(s: GameState): { piece: KitchenPiece; at: Point }[] {
  const out: { piece: KitchenPiece; at: Point }[] = s.stoves.map((sv, index) => ({ piece: { kind: 'station' as const, index }, at: { x: sv.x, y: sv.y } }));
  for (const p of s.props) {
    if (!MOVABLE.includes(p.kind) || !inKitchen(s, p.x, p.y)) continue;
    out.push({ piece: p.kind === PropKind.Prep ? { kind: 'prep', id: p.id } : { kind: 'item', id: p.id }, at: { x: p.x, y: p.y } });
  }
  return out;
}

/** The tiles the movable pieces take in the map's own layout, and the ones they take now (for the walkable grid). */
export function kitchenTiles(s: GameState): KitchenTiles {
  return {
    free: [...s.map.stoves.slice(0, s.stoves.length).map((st) => st.stove), ...s.map.decor.filter((f) => MOVABLE.includes(f.kind) && inKitchen(s, f.x, f.y))],
    block: [...s.stoves.map((sv) => ({ x: sv.x, y: sv.y })), ...s.props.filter((p) => MOVABLE.includes(p.kind) && inKitchen(s, p.x, p.y))],
  };
}

/** A station can move while nobody cooks at it. */
const stationFree = (sv: KitchenSpot): boolean => sv.user < 0;

function moveStation(s: GameState, sv: KitchenSpot, x: number, y: number): void {
  sv.x = x;
  sv.y = y;
  sv.cook = { x: x - COOK_BEHIND, y };
  const p = s.props.find((q) => q.id === sv.propId);
  if (p) {
    p.x = x;
    p.y = y;
  }
}

// ---------- the check ----------

const tile = (g: Grid, p: Point): number => Math.floor(p.y) * g.w + Math.floor(p.x);
const tileKey = (p: Point): string => `${Math.floor(p.x)},${Math.floor(p.y)}`;

/** Where each piece would stand: the given moves on top of where they stand now. */
type Placement = Map<string, Point>;
const pieceKey = (piece: KitchenPiece): string => (piece.kind === 'station' ? `s${piece.index}` : `p${piece.id}`);

/** The spot a room's crew works from, with its work piece wherever it stands (`at`: its new place). */
function postOf(s: GameState, room: GameState['map']['rooms'][number], pieceAt: (id: number) => Point | undefined, pieceId: number): Point {
  const at = pieceId >= 0 ? pieceAt(pieceId) : undefined;
  return at ? { x: room.post.x + at.x - room.work.x, y: room.post.y + at.y - room.work.y } : room.post;
}

/** Where a room's crew stands at work now (its piece may have been moved). */
export function crewPost(s: GameState, room: GameState['map']['rooms'][number], pieceId: number): Point {
  return postOf(s, room, (id) => s.props.find((p) => p.id === id), pieceId);
}

/**
 * Would the kitchen still work with these pieces moved? The current grid with the moved pieces'
 * tiles opened and their new ones taken; then every spot someone works or walks to must be open
 * and reachable from the door, and the future stations' tiles stay free.
 */
function layoutWorks(s: GameState, moves: readonly { piece: KitchenPiece; to: Point }[]): boolean {
  if (s.construction) return false;
  const placed: Placement = new Map(moves.map((m) => [pieceKey(m.piece), m.to]));
  const g: Grid = { ...s.grid, walk: s.grid.walk.slice() };
  // Open the old tiles, then take the new ones (in kitchen bounds, on floor no one else uses).
  const taken = new Set<string>();
  for (const m of moves) {
    const from = pieceAt(s, m.piece);
    if (!from) return false;
    g.walk[tile(g, from)] = 1;
  }
  for (const m of moves) {
    if (!inKitchen(s, m.to.x, m.to.y) || taken.has(tileKey(m.to))) return false;
    taken.add(tileKey(m.to));
  }
  for (const m of moves) {
    const i = tile(g, m.to);
    if (!g.walk[i]) return false;
    g.walk[i] = 0;
  }
  const at = (id: number): Point | undefined => {
    for (const m of moves) if (m.piece.kind !== 'station' && m.piece.id === id) return m.to;
    const p = s.props.find((q) => q.id === id);
    return p ? { x: p.x, y: p.y } : undefined;
  };
  // Where people stand (open and reachable), and the staff spots of the room as the map lists
  // them (some are furniture, like the packing table: reached from beside it).
  const spots: Point[] = [...s.map.extraSinks.map((e) => e.washer), ...s.map.passDrops];
  s.stoves.forEach((sv, index) => {
    const to = placed.get(`s${index}`);
    spots.push(to ? { x: to.x - COOK_BEHIND, y: to.y } : sv.cook);
  });
  // The stations not bought yet keep their tiles (and their cooks') free.
  for (const st of s.map.stoves.slice(s.stoves.length)) {
    if (!g.walk[tile(g, st.stove)]) return false;
    spots.push(st.cook);
  }
  for (const c of s.crew) {
    const room = s.map.rooms[c.room];
    if (room) spots.push(postOf(s, room, at, c.piece));
  }
  // The errands: the walk-ins and stores' shelves, the office's coffee machine.
  for (const room of s.map.rooms) {
    if (room.kind === 'cold' || room.kind === 'stores') spots.push({ x: room.x0 + 1.5, y: room.y0 + Math.min(room.y1 - room.y0 - 1, 2) + 0.5 });
  }
  const reach = reachableFrom(g, s.map.doors[0]!.inside);
  const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h;
  const open = (p: Point) => {
    const i = tile(g, p);
    return inGrid(Math.floor(p.x), Math.floor(p.y)) && g.walk[i] === 1 && reach[i] === 1;
  };
  const reached = (p: Point) => {
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.y);
    if (!inGrid(tx, ty)) return false;
    const i = ty * g.w + tx;
    if (g.walk[i]) return reach[i] === 1;
    return SIDES.some(([dx, dy]) => inGrid(tx + dx, ty + dy) && reach[(ty + dy) * g.w + tx + dx] === 1 && !walled(g, i, (ty + dy) * g.w + tx + dx));
  };
  return spots.every(open) && staffSpots(s.map).every(reached);
}

const SIDES: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------- moves ----------

/** Can these two pieces trade places right now? */
export function canSwap(s: GameState, a: KitchenPiece, b: KitchenPiece): boolean {
  if (s.construction || pieceKey(a) === pieceKey(b)) return false;
  for (const piece of [a, b]) {
    if (!pieceAt(s, piece)) return false;
    if (piece.kind === 'station' && !stationFree(s.stoves[piece.index]!)) return false;
  }
  return layoutWorks(s, [{ piece: a, to: pieceAt(s, b)! }, { piece: b, to: pieceAt(s, a)! }]);
}

function put(s: GameState, piece: KitchenPiece, at: Point): void {
  if (piece.kind === 'station') moveStation(s, s.stoves[piece.index]!, at.x, at.y);
  else {
    const p = propFor(s, piece)!;
    p.x = at.x;
    p.y = at.y;
  }
}

/** After a change: the grid again, idle cooks to wherever their station went, walkers round what moved. */
function settle(s: GameState, rebuild: (s: GameState) => void, reroute: (s: GameState) => void): void {
  rebuild(s);
  for (const st of s.staff) if (st.role === 'cook' && !st.job) st.path = [];
  reroute(s);
}

/** Trades two pieces' places. False if one is in use (a cook at it), gone, or the kitchen would not work. */
export function swapKitchen(s: GameState, a: KitchenPiece, b: KitchenPiece, rebuild: (s: GameState) => void, reroute: (s: GameState) => void): boolean {
  if (!canSwap(s, a, b)) return false;
  const pa = pieceAt(s, a)!;
  const pb = pieceAt(s, b)!;
  put(s, a, pb);
  put(s, b, pa);
  settle(s, rebuild, reroute);
  return true;
}

/** Can a piece go to the free tile at `to` (a tile center)? */
export function canMoveKitchen(s: GameState, piece: KitchenPiece, to: Point): boolean {
  const from = pieceAt(s, piece);
  if (!from || (piece.kind === 'station' && !stationFree(s.stoves[piece.index]!))) return false;
  const target = { x: Math.floor(to.x) + 0.5, y: Math.floor(to.y) + 0.5 };
  if (tileKey(target) === tileKey(from)) return false;
  return layoutWorks(s, [{ piece, to: target }]);
}

/** Moves a piece to a free kitchen tile. */
export function moveKitchen(s: GameState, piece: KitchenPiece, to: Point, rebuild: (s: GameState) => void, reroute: (s: GameState) => void): boolean {
  if (!canMoveKitchen(s, piece, to)) return false;
  put(s, piece, { x: Math.floor(to.x) + 0.5, y: Math.floor(to.y) + 0.5 });
  settle(s, rebuild, reroute);
  return true;
}

/** Every free kitchen tile a piece can go to now (tile centers): the green tiles of build mode. */
export function kitchenTargets(s: GameState, piece: KitchenPiece): Point[] {
  const from = pieceAt(s, piece);
  if (!from || s.construction || (piece.kind === 'station' && !stationFree(s.stoves[piece.index]!))) return [];
  const b = s.map.building;
  const out: Point[] = [];
  const g = s.grid;
  for (let y = b.y0; y < b.y1; y++) {
    for (let x = b.x0; x < s.map.kitchenX; x++) {
      if (!g.walk[y * g.w + x]) continue;
      const p = { x: x + 0.5, y: y + 0.5 };
      if (layoutWorks(s, [{ piece, to: p }])) out.push(p);
    }
  }
  return out;
}

// ---------- looks ----------

/** Every look a prep piece can take: the prep tables, then the back of the house. */
export const PREP_LOOKS = PREP_KINDS + BACK_KINDS;

/** Gives a prep piece its next look (`to`: a given one). */
export function restylePrep(s: GameState, id: number, to?: number): boolean {
  const p = prepProp(s, id);
  if (!p || s.construction) return false;
  p.variant = to === undefined ? (p.variant + 1) % PREP_LOOKS : Math.max(0, Math.min(PREP_LOOKS - 1, Math.floor(to)));
  return true;
}

// ---------- the save ----------

/** The kitchen as the save keeps it: where each station stands, each prep piece's tile and look, the other furniture's tiles. */
export interface SavedKitchen {
  tier: number;
  stations: { x: number; y: number }[];
  preps: { x: number; y: number; variant: number }[];
  /** The rooms' furniture and the fridge, in the map's order (M47; older saves: where the map puts them). */
  items?: { x: number; y: number }[];
}

const itemProps = (s: GameState): PropView[] => s.props.filter((p) => ITEM_KINDS.includes(p.kind) && inKitchen(s, p.x, p.y));

export function kitchenSave(s: GameState): SavedKitchen {
  return {
    tier: s.map.tier,
    stations: s.stoves.map((sv) => ({ x: sv.x, y: sv.y })),
    preps: s.props.filter((p) => p.kind === PropKind.Prep).map((p) => ({ x: p.x, y: p.y, variant: p.variant })),
    items: itemProps(s).map((p) => ({ x: p.x, y: p.y })),
  };
}

/**
 * A saved layout goes back if it is this building's, has as many pieces as it has, and works (a
 * bigger building has a new kitchen: it starts from the building's own layout; a layout that
 * would leave someone with no way to their spot is not used).
 */
export function restoreKitchen(s: GameState, saved: SavedKitchen | undefined, rebuild: (s: GameState) => void): void {
  if (!saved || saved.tier !== s.map.tier) return;
  const preps = s.props.filter((p) => p.kind === PropKind.Prep);
  const items = itemProps(s);
  if (saved.stations.length !== s.stoves.length || saved.preps.length !== preps.length) return;
  const savedItems = saved.items && saved.items.length === items.length ? saved.items : items.map((p) => ({ x: p.x, y: p.y }));
  const all = [...saved.stations, ...saved.preps, ...savedItems];
  if (all.some((p) => !inKitchen(s, p.x, p.y)) || new Set(all.map(tileKey)).size !== all.length) return;
  // Kept to undo a layout that does not work.
  const before = {
    stations: s.stoves.map((sv) => ({ x: sv.x, y: sv.y })),
    props: [...preps, ...items].map((p) => ({ p, x: p.x, y: p.y, variant: p.variant })),
  };
  const centered = (p: { x: number; y: number }) => ({ x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5 });
  saved.stations.forEach((p, i) => {
    const c = centered(p);
    moveStation(s, s.stoves[i]!, c.x, c.y);
  });
  saved.preps.forEach((p, i) => {
    const prop = preps[i]!;
    Object.assign(prop, centered(p));
    prop.variant = Math.max(0, Math.min(PREP_LOOKS - 1, Math.floor(p.variant)));
  });
  savedItems.forEach((p, i) => Object.assign(items[i]!, centered(p)));
  rebuild(s);
  if (layoutWorks(s, [])) return;
  before.stations.forEach((p, i) => moveStation(s, s.stoves[i]!, p.x, p.y));
  for (const b of before.props) Object.assign(b.p, { x: b.x, y: b.y, variant: b.variant });
  rebuild(s);
}
