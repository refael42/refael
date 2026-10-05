import { TIERS } from '../../data/buildings';
import { mapForTier, SEAT_OFFSETS, SERVE_OFFSET, type MapDef, type Point } from '../../data/maps';
import { buildGrid, canReach, reachableFrom, type Grid } from '../grid';
import type { GameState } from './types';
import { reservedBy } from './works';

// Build mode: where decor may go. A tile is buildable when it is dining-room floor, nothing
// stands on it, nothing the restaurant needs (now or in any bigger building) uses it, and
// with it taken every chair, table and work spot can still be reached from the door, even
// with every table and every second chair in place: the room can never get blocked.

const key = (x: number, y: number) => Math.floor(y) * 1000 + Math.floor(x);
const DINING_FLOORS: readonly string[] = ['dining', 'emerald', 'royal', 'marble', 'velvet'];

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

/** With tile (tx, ty) taken too, can everything still be reached from the door? */
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
  return looksFree(s, tx, ty) && keepsRoomOpen(worstCase(s), s.map, tx, ty);
}

/** Every tile decor can go on now (tile centers), back rows first. One worst-case grid for all of them. */
export function buildableTiles(s: GameState): Point[] {
  const out: Point[] = [];
  const b = s.map.building;
  let g: Grid | null = null;
  for (let y = b.y0; y < b.y1; y++) {
    for (let x = b.x0; x < b.x1; x++) {
      if (!looksFree(s, x, y)) continue;
      g ??= worstCase(s);
      if (keepsRoomOpen(g, s.map, x, y)) out.push({ x: x + 0.5, y: y + 0.5 });
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
