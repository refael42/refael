import { TIERS } from '../../data/buildings';
import { mapForTier, type MapDef, type Point } from '../../data/maps';
import { autoStyle, footprint, serveSpot, styleDef, type TableSpot, type TableStyle } from '../../data/tables';
import { canReach, cutTree, reachableFrom, reachableInside, type CutTree, type Grid } from '../grid';
import { mustReach, nearOf, reservedTiles, roomOf, tableFits, tileFree, tileKey, type Room } from '../layout';
import type { GameState } from './types';
import { reservedBy } from './works';

export type { TableSpot } from '../../data/tables';

// Build mode: where decor and tables may go (owner: "tables of every kind, placed wherever you
// want"). A tile is buildable when it is dining-room floor, nothing stands on it, no worker,
// the line or the door needs it (now or in any bigger building), and with it taken every chair,
// table and work spot can still be reached from the door, with every table's chairs counted
// even before they are bought: the room can never get blocked. The checks themselves are in
// src/sim/layout.ts (the map generator lays its rooms out with them too).

const key = tileKey;

/** Tiles kept free in each tier: its own staff spots and bar, and the staff spots of every bigger building after it. */
const RESERVED: readonly Set<number>[] = TIERS.map((_, tier) => reservedTiles(TIERS.map((__, t) => mapForTier(t)), tier));

/**
 * Where the building's own layout puts tables (their chairs and serving spots too): decor the
 * game places by itself (the balance bot, a save whose spot is gone) keeps off them when it can,
 * so tables bought later still find room. A player may put anything there.
 */
const TABLE_ZONE: readonly Set<number>[] = TIERS.map((_, tier) => {
  const out = new Set<number>();
  for (const t of mapForTier(tier).tables) for (const p of [...footprint(t.style, t.x, t.y), serveSpot(t.x, t.y)]) out.add(key(p.x, p.y));
  return out;
});

const spotsOf = (s: GameState, ignore = -1): TableSpot[] => s.tables.filter((t) => t.index !== ignore).map((t) => ({ x: t.x, y: t.y, style: t.style }));

/**
 * The worst case: every table with all of its chairs, all decor (and pieces on the way).
 * `ignore`: a table being moved (its tiles count as free).
 */
function worstCase(s: GameState, ignore = -1): Room {
  const pending = s.works.flatMap((w) => (w.at ? [w.at] : []));
  return roomOf(s.map, spotsOf(s, ignore), [...s.placed, ...pending], RESERVED[s.map.tier]!, (tx, ty) => reservedBy(s, tx, ty));
}

const SIDES: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * The room in the worst case, read once for all its tiles: the cut tree, and for each spot
 * that must stay reachable the tiles it is reached through (its own, or for a seat, its open
 * sides). Then "does closing this tile cut anything off?" is a quick look-up per tile.
 */
interface RoomCuts {
  g: Grid;
  cuts: CutTree;
  access: number[][];
  /** Spots by the search order of their first way in (sorted), for looking up only those a cut can reach. */
  byFirst: number[];
  firstOrder: number[];
  /** Everything is reachable with nothing more taken (if not, no tile is). */
  ok: boolean;
}

function roomCuts(g: Grid, map: MapDef, reach: readonly Point[]): RoomCuts {
  const cuts = cutTree(g, map.doors[0]!.inside);
  const access = reach.map((p) => {
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.y);
    if (tx < 0 || ty < 0 || tx >= g.w || ty >= g.h) return [];
    const i = ty * g.w + tx;
    if (cuts.order[i]! >= 0) return [i];
    // Like canReach: an open spot that cannot be reached is lost; a seat is reached from beside it.
    if (g.walk[i]) return [];
    return SIDES.flatMap(([dx, dy]) => {
      const x = tx + dx;
      const y = ty + dy;
      const j = y * g.w + x;
      return x >= 0 && y >= 0 && x < g.w && y < g.h && cuts.order[j]! >= 0 ? [j] : [];
    });
  });
  const ok = access.every((a) => a.length > 0);
  const byFirst = ok ? access.map((_, i) => i).sort((a, b) => cuts.order[access[a]![0]!]! - cuts.order[access[b]![0]!]!) : [];
  const firstOrder = byFirst.map((i) => cuts.order[access[i]![0]!]!);
  return { g, cuts, access, byFirst, firstOrder, ok };
}

/** The first index in a sorted list whose value is at least `v`. */
function lowerBound(list: readonly number[], v: number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid]! < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** With tile (tx, ty) taken too, can everything still be reached? (One look-up in the cut tree.) */
function staysOpen(r: RoomCuts, tx: number, ty: number): boolean {
  if (!r.ok) return false;
  const { g, cuts } = r;
  const t = ty * g.w + tx;
  if (cuts.order[t]! < 0) return true;
  // The parts closing it cuts off: each subtree below it that links back no higher than it.
  const spans: [number, number][] = [];
  for (const [dx, dy] of SIDES) {
    const x = tx + dx;
    const y = ty + dy;
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
    const c = y * g.w + x;
    if (cuts.parent[c] === t && cuts.low[c]! >= cuts.order[t]!) spans.push([cuts.order[c]!, cuts.done[c]!]);
  }
  const lost = (i: number) => i === t || spans.some(([a, b]) => cuts.order[i]! >= a && cuts.order[i]! <= b);
  // A spot can only be cut off if its first way in is: look at just those (the tile itself, and
  // each part cut off), stopping at the first one with no other way in.
  const order = cuts.order[t]!;
  for (const [lo, hi] of [[order, order], ...spans] as const) {
    for (let k = lowerBound(r.firstOrder, lo); k < r.byFirst.length && r.firstOrder[k]! <= hi; k++) {
      if (!r.access[r.byFirst[k]!]!.some((i) => !lost(i))) return false;
    }
  }
  return true;
}

/** With tile (x, y) taken too, can everything still be reached from the door? The plain full
 * search: the cut tree answers the same much faster, and the tests check that they agree. */
export function keepsRoomOpenSlowly(s: GameState, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (s.construction) return false;
  const room = worstCase(s);
  if (!tileFree(room, tx, ty)) return false;
  const g = room.g;
  g.walk[ty * g.w + tx] = 0;
  const reach = reachableFrom(g, s.map.doors[0]!.inside);
  return mustReach(s.map, room.tables).every((p) => canReach(g, reach, p));
}

/** Can a decor piece go on the tile at (x, y) right now? */
export function canPlaceAt(s: GameState, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (s.construction) return false;
  const room = worstCase(s);
  return tileFree(room, tx, ty) && staysOpen(roomCuts(room.g, s.map, mustReach(s.map, room.tables)), tx, ty);
}

/** Every tile decor can go on now (tile centers), back rows first. One worst-case room for all of them. */
export function buildableTiles(s: GameState): Point[] {
  const out: Point[] = [];
  if (s.construction) return out;
  const b = s.map.building;
  const room = worstCase(s);
  let cuts: RoomCuts | null = null;
  for (let y = b.y0; y < b.y1; y++) {
    for (let x = b.x0; x < b.x1; x++) {
      if (!tileFree(room, x, y)) continue;
      cuts ??= roomCuts(room.g, s.map, mustReach(s.map, room.tables));
      if (staysOpen(cuts, x, y)) out.push({ x: x + 0.5, y: y + 0.5 });
    }
  }
  return out;
}

/**
 * Where a piece goes when nobody picked a spot (the balance bot, a save whose spot is gone):
 * the free tile nearest `near`, by default the back corner of the room, off the tables' places.
 */
export function autoTile(s: GameState, near: Point = { x: s.map.building.x0, y: s.map.building.y0 }): Point | null {
  const zone = TABLE_ZONE[s.map.tier]!;
  let best: Point | null = null;
  let bestD = Infinity;
  for (const p of buildableTiles(s)) {
    const d = Math.hypot(p.x - near.x, p.y - near.y) + (zone.has(key(p.x, p.y)) ? 1000 : 0);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

// ---------- tables ----------

/**
 * Can a table of `style` stand with its anchor (front tile) at (x, y)? See tableFits.
 * `ignore`: the table being moved.
 */
export function canPlaceTable(s: GameState, style: TableStyle, x: number, y: number, ignore = -1): boolean {
  if (s.construction) return false;
  return tableFits(worstCase(s, ignore), style, Math.floor(x) + 0.5, Math.floor(y) + 0.5);
}

/** Every anchor where a table of `style` fits now (tile centers): the green tiles in build mode. */
export function tableAnchors(s: GameState, style: TableStyle, ignore = -1): Point[] {
  const out: Point[] = [];
  if (s.construction) return out;
  const b = s.map.building;
  const room = worstCase(s, ignore);
  const near = nearOf(room);
  const back = Math.min(0, ...styleDef(style).top.map(([, dy]) => dy));
  for (let y = b.y0 - back; y < b.y1; y++) {
    for (let x = b.x0 + 1; x < b.x1 - 1; x++) if (tableFits(room, style, x + 0.5, y + 0.5, near)) out.push({ x: x + 0.5, y: y + 0.5 });
  }
  return out;
}

/**
 * A whole saved layout checked at once (loading a big save one table at a time took a search of
 * the room per table): every table on free floor, none on another, and everything reachable.
 */
export function layoutWorks(s: GameState, tables: readonly TableSpot[]): boolean {
  if (s.construction) return false;
  const room = worstCase(s);
  const g = room.g;
  for (const t of tables) {
    for (const p of footprint(t.style, t.x, t.y)) {
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y);
      if (!tileFree(room, tx, ty)) return false;
      g.walk[ty * g.w + tx] = 0;
    }
  }
  for (const t of tables) {
    const p = serveSpot(t.x, t.y);
    if (room.serve.has(key(p.x, p.y)) || !g.walk[Math.floor(p.y) * g.w + Math.floor(p.x)]) return false;
    room.serve.add(key(p.x, p.y));
  }
  const reach = reachableInside(g, s.map.doors[0]!.inside);
  return mustReach(s.map, [...room.tables, ...tables]).every((p) => {
    const i = Math.floor(p.y) * g.w + Math.floor(p.x);
    return !g.inside[i] || canReach(g, reach, p);
  });
}

/** The next table's spot, per walkable grid (a new grid = something moved) and what else could change it. */
const NEXT_SPOT = new WeakMap<Grid, { key: string; spot: TableSpot | null }>();

/**
 * Where the next table goes when nobody picks a spot (the upgrade list, the dashed "+", the bot):
 * the building's own layout, its next free place in opening order and design; if the player's
 * own layout took them all, the free spot nearest the back of the room. Null: no room left.
 */
export function nextTableSpot(s: GameState): TableSpot | null {
  const k = `${s.tables.length}:${s.works.length}:${s.construction ? 1 : 0}:${s.map.tier}`;
  const known = NEXT_SPOT.get(s.grid);
  if (known && known.key === k) return known.spot;
  const spot = findTableSpot(s);
  NEXT_SPOT.set(s.grid, { key: k, spot });
  return spot;
}

function findTableSpot(s: GameState): TableSpot | null {
  if (s.construction) return null;
  const room = worstCase(s);
  const near = nearOf(room);
  for (const p of s.map.tables) if (tableFits(room, p.style, p.x, p.y, near)) return p;
  const style = autoStyle(s.tables.length, s.map.tier);
  const free = tableAnchors(s, style);
  let best: Point | null = null;
  for (const p of free) if (!best || p.y < best.y || (p.y === best.y && p.x < best.x)) best = p;
  return best ? { ...best, style } : null;
}
