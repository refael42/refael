import { TIERS } from '../../data/buildings';
import { mapForTier, SEAT_OFFSETS, SERVE_OFFSET, type MapDef, type Point } from '../../data/maps';
import { buildGrid, canReach, cutTree, reachableFrom, type CutTree, type Grid } from '../grid';
import type { GameState } from './types';
import { reservedBy } from './works';

// Build mode: where decor may go. A tile is buildable when it is dining-room floor, nothing
// stands on it, nothing the restaurant needs (now or in any bigger building) uses it, and
// with it taken every chair, table and work spot can still be reached from the door, even
// with every table and every second chair in place: the room can never get blocked.

const key = (x: number, y: number) => Math.floor(y) * 1000 + Math.floor(x);
const DINING_FLOORS: readonly string[] = ['dining', 'emerald', 'royal', 'marble', 'velvet', 'ocean', 'starlight'];

/** Spots one building needs free: tables and their chairs and serving spots, staff spots, the line. */
function spotsOf(map: MapDef): Point[] {
  const out: Point[] = [];
  for (const t of map.tables) {
    out.push(t, { x: t.x + SERVE_OFFSET.x, y: t.y + SERVE_OFFSET.y });
    for (const seat of SEAT_OFFSETS) out.push({ x: t.x + seat.x, y: t.y + seat.y });
  }
  out.push(...map.queue, ...map.waiterIdle, ...map.cleanerIdle, map.hostSpot, map.managerSpot, ...map.pickupSpots, map.washerSpot, map.dirtyDrop);
  for (const d of map.doors) out.push(d.inside, { x: d.inside.x - 1, y: d.inside.y }, { x: d.inside.x + 1, y: d.inside.y }, { x: d.inside.x, y: d.inside.y - 1 });
  return out;
}

/** Tiles kept free in each tier: its own needs and those of every bigger building after it. */
const RESERVED: readonly Set<number>[] = TIERS.map((_, tier) => {
  const out = new Set<number>();
  for (let t = tier; t < TIERS.length; t++) for (const p of spotsOf(mapForTier(t))) out.add(key(p.x, p.y));
  return out;
});

/** Where everything must stay reachable from (staff spots and the seats; chairs count via a neighbor). */
const MUST_REACH = new WeakMap<MapDef, Point[]>();
function mustReach(map: MapDef): Point[] {
  let out = MUST_REACH.get(map);
  if (!out) {
    out = spotsOf(map).filter((p) => !map.tables.some((t) => t.x === p.x && t.y === p.y));
    MUST_REACH.set(map, out);
  }
  return out;
}

function isDiningFloor(map: MapDef, x: number, y: number): boolean {
  return map.areas.some((a) => DINING_FLOORS.includes(a.floor) && x >= a.x0 && x < a.x1 && y >= a.y0 && y < a.y1);
}

/** The cheap checks: dining floor, free right now, not needed by anything. */
function looksFree(s: GameState, tx: number, ty: number): boolean {
  const map = s.map;
  if (s.construction || !isDiningFloor(map, tx, ty) || RESERVED[map.tier]!.has(key(tx, ty))) return false;
  return s.grid.walk[ty * s.grid.w + tx] === 1 && !reservedBy(s, tx, ty);
}

/** The worst case: every table bought, every second chair, all decor (and pieces on the way). */
function worstCase(s: GameState): Grid {
  const map = s.map;
  const pending = s.works.flatMap((w) => (w.at ? [w.at] : []));
  return buildGrid(map, map.tables.length, map.stoves.length, map.tables.length, [...s.placed, ...pending]);
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

function roomCuts(g: Grid, map: MapDef): RoomCuts {
  const cuts = cutTree(g, map.doors[0]!.inside);
  const access = mustReach(map).map((p) => {
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

/** With tile (tx, ty) taken too, can everything still be reached from the door? The plain full
 * search: the cut tree answers the same much faster, and the tests check that they agree. */
export function keepsRoomOpenSlowly(s: GameState, x: number, y: number): boolean {
  return looksFree(s, Math.floor(x), Math.floor(y)) && keepsRoomOpen(worstCase(s), s.map, Math.floor(x), Math.floor(y));
}

function keepsRoomOpen(g: Grid, map: MapDef, tx: number, ty: number): boolean {
  const i = ty * g.w + tx;
  const was = g.walk[i]!;
  g.walk[i] = 0;
  const reach = reachableFrom(g, map.doors[0]!.inside);
  const ok = mustReach(map).every((p) => canReach(g, reach, p));
  g.walk[i] = was;
  return ok;
}

/** Can a decor piece go on the tile at (x, y) right now? */
export function canPlaceAt(s: GameState, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return looksFree(s, tx, ty) && staysOpen(roomCuts(worstCase(s), s.map), tx, ty);
}

/** Every tile decor can go on now (tile centers), back rows first. One worst-case room for all of them. */
export function buildableTiles(s: GameState): Point[] {
  const out: Point[] = [];
  const b = s.map.building;
  let room: RoomCuts | null = null;
  for (let y = b.y0; y < b.y1; y++) {
    for (let x = b.x0; x < b.x1; x++) {
      if (!looksFree(s, x, y)) continue;
      room ??= roomCuts(worstCase(s), s.map);
      if (staysOpen(room, x, y)) out.push({ x: x + 0.5, y: y + 0.5 });
    }
  }
  return out;
}

/**
 * Where a piece goes when nobody picked a spot (the balance bot, a save whose spot is gone):
 * the free tile nearest `near`, by default the back corner of the room.
 */
export function autoTile(s: GameState, near: Point = { x: s.map.building.x0, y: s.map.building.y0 }): Point | null {
  let best: Point | null = null;
  let bestD = Infinity;
  for (const p of buildableTiles(s)) {
    const d = Math.hypot(p.x - near.x, p.y - near.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
