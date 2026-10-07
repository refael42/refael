import type { MapDef, Point } from '../data/maps';
import { footprint, serveSpot, sideTiles, styleDef, TABLE_STYLE_DEFS, type TableSpot, type TableStyle } from '../data/tables';
import { canReach, gridWith, reachableInside, type Grid } from './grid';

// Where tables can stand in a room, and how the game lays a room out by itself (owner: "too
// much symmetry between the tables: it is not a dining hall, it is a restaurant, think of a
// better design of where they go"). Pure: the map generator uses it for each building's own
// layout, build mode (src/sim/game/build.ts) for the tables the player places.

export const tileKey = (x: number, y: number) => Math.floor(y) * 1000 + Math.floor(x);
const DINING_FLOORS: readonly string[] = ['dining', 'emerald', 'royal', 'marble', 'velvet', 'ocean', 'starlight', 'gold'];

/** Spots one building's people need free: staff spots, the line, the way in. */
export function staffSpots(map: MapDef): Point[] {
  const out: Point[] = [...map.queue, ...map.waiterIdle, ...map.cleanerIdle, map.hostSpot, map.managerSpot, map.checkerSpot, ...map.pickupSpots, map.washerSpot, map.dirtyDrop];
  if (map.packing) out.push(map.packing.table, ...map.packing.spots, map.packing.window, ...map.packing.pickups, map.packing.fridgeSpot);
  for (const d of map.doors) out.push(d.inside, { x: d.inside.x - 1, y: d.inside.y }, { x: d.inside.x + 1, y: d.inside.y }, { x: d.inside.x, y: d.inside.y - 1 });
  return out;
}

export function isDiningFloor(map: MapDef, x: number, y: number): boolean {
  return map.areas.some((a) => DINING_FLOORS.includes(a.floor) && x >= a.x0 && x < a.x1 && y >= a.y0 && y < a.y1);
}

/** Everything that must stay reachable: staff spots, each table's serving spot and chairs (from beside them). */
export function mustReach(map: MapDef, tables: readonly TableSpot[]): Point[] {
  const out = staffSpots(map);
  for (const t of tables) out.push(serveSpot(t.x, t.y), ...sideTiles(t.style, t.x, t.y, -1), ...sideTiles(t.style, t.x, t.y, 1));
  return out;
}

/**
 * A room planned for the worst case: every table with all of its chairs, the decor; the tiles
 * staff stand on to serve each table (kept clear), the tiles kept for people (`reserved`), and
 * anything else that is not free (`busy`: a crew's site).
 */
export interface Room {
  map: MapDef;
  g: Grid;
  tables: TableSpot[];
  serve: Set<number>;
  reserved: ReadonlySet<number>;
  busy?: (tx: number, ty: number) => boolean;
}

export function roomOf(map: MapDef, tables: readonly TableSpot[], placed: readonly Point[], reserved: ReadonlySet<number>, busy?: Room['busy']): Room {
  const taken = tables.flatMap((t) => footprint(t.style, t.x, t.y));
  return {
    map,
    g: gridWith(map, map.stoves.length, taken, placed),
    tables: [...tables],
    serve: new Set(tables.map((t) => serveSpot(t.x, t.y)).map((p) => tileKey(p.x, p.y))),
    reserved,
    busy,
  };
}

/** The cheap checks for one tile: dining floor, nothing on it in the worst case, not needed by anyone. */
export function tileFree(room: Room, tx: number, ty: number): boolean {
  if (!isDiningFloor(room.map, tx, ty) || room.reserved.has(tileKey(tx, ty)) || room.serve.has(tileKey(tx, ty))) return false;
  return room.g.walk[ty * room.g.w + tx] === 1 && !room.busy?.(tx, ty);
}

/** What many table spots are checked against at once: the room reached from the door, and the tiles that must keep a way in. */
export interface Near {
  reach: Uint8Array;
  must: number[];
  door: Point;
}

export function nearOf(room: Room): Near {
  const g = room.g;
  const reach = reachableInside(g, room.map.doors[0]!.inside);
  const must = mustReach(room.map, room.tables)
    .map((p) => Math.floor(p.y) * g.w + Math.floor(p.x))
    .filter((i) => g.inside[i]);
  return { reach, must, door: room.map.doors[0]!.inside };
}

/**
 * Can a table of `style` stand with its anchor at (x, y) (tile middles)? Its top and every chair
 * it could get need free dining floor, the spot in front of it room to serve from, and with it
 * there everything (its own chairs too) must still be reachable. `near`: worked out once for
 * many spots at a time (see localCheck); without it, one full search.
 */
export function tableFits(room: Room, style: TableStyle, x: number, y: number, near?: Near): boolean {
  const g = room.g;
  const tiles = footprint(style, x, y);
  for (const p of tiles) if (!tileFree(room, Math.floor(p.x), Math.floor(p.y))) return false;
  const front = serveSpot(x, y);
  const fi = Math.floor(front.y) * g.w + Math.floor(front.x);
  if (!g.inside[fi] || !g.walk[fi] || room.busy?.(Math.floor(front.x), Math.floor(front.y))) return false;
  const idx = tiles.map((p) => Math.floor(p.y) * g.w + Math.floor(p.x));
  if (near) return localCheck(g, near, idx, styleDef(style).top.length, fi);
  for (const i of idx) g.walk[i] = 0;
  const reach = reachableInside(g, room.map.doors[0]!.inside);
  const ok = mustReach(room.map, [...room.tables, { style, x, y }]).every((p) => {
    const i = Math.floor(p.y) * g.w + Math.floor(p.x);
    // Out on the street (the line): nothing in the room can cut it off.
    return !g.inside[i] || canReach(g, reach, p);
  });
  for (const i of idx) g.walk[i] = 1;
  return ok;
}

/** Puts a table into the planned room (its tiles taken, its front kept clear). */
export function occupy(room: Room, t: TableSpot): void {
  for (const p of footprint(t.style, t.x, t.y)) room.g.walk[Math.floor(p.y) * room.g.w + Math.floor(p.x)] = 0;
  const f = serveSpot(t.x, t.y);
  room.serve.add(tileKey(f.x, f.y));
  room.tables.push(t);
}

const STRAIGHT: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** How far around the table the quick search looks for a way round it. */
const AROUND = 3;

/**
 * The quick answer: taking the tiles `idx` (the top's `tops` first, then the chairs) cuts
 * nothing off when every reachable tile touching them can still reach the others (any way that
 * crossed them can go round instead), and every spot that needs a way in still has one that is
 * not under the table. The way round is looked for close by first; only when there is none
 * nearby does it take one full search of the room. Straight steps connect exactly the tiles
 * paths do (see cutTree in src/sim/grid.ts).
 */
function localCheck(g: Grid, near: Near, idx: readonly number[], tops: number, front: number): boolean {
  const under = new Set(idx);
  const open = (i: number) => g.walk[i] === 1 && g.inside[i] === 1 && !under.has(i);
  const reached = (i: number) => open(i) && near.reach[i] === 1;
  // Its own front and chairs: the front reached, each chair with a free side.
  if (!near.reach[front]) return false;
  const side = (i: number) => STRAIGHT.some(([dx, dy]) => reached(i + dy * g.w + dx));
  if (!idx.slice(tops).every(side)) return false;
  // Everything else that needs a way in, around the table.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const i of idx) {
    x0 = Math.min(x0, i % g.w);
    x1 = Math.max(x1, i % g.w);
    y0 = Math.min(y0, Math.floor(i / g.w));
    y1 = Math.max(y1, Math.floor(i / g.w));
  }
  for (const m of near.must) {
    const mx = m % g.w;
    const my = Math.floor(m / g.w);
    if (mx < x0 - 1 || mx > x1 + 1 || my < y0 - 1 || my > y1 + 1) continue;
    if (g.walk[m] ? !reached(m) : !side(m)) return false;
  }
  // The tiles touching it, reached before: they must still reach one another.
  const ring: number[] = [];
  for (const i of idx) {
    for (const [dx, dy] of STRAIGHT) {
      const j = i + dy * g.w + dx;
      if (reached(j) && !ring.includes(j)) ring.push(j);
    }
  }
  if (ring.length <= 1) return true;
  const seen = new Set<number>([ring[0]!]);
  const queue = [ring[0]!];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    const cx = cur % g.w;
    const cy = Math.floor(cur / g.w);
    for (const [dx, dy] of STRAIGHT) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < x0 - AROUND || nx > x1 + AROUND || ny < y0 - AROUND || ny > y1 + AROUND) continue;
      const j = ny * g.w + nx;
      if (seen.has(j) || !open(j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  if (ring.every((r) => seen.has(r))) return true;
  // No way round close by: one search of the whole room with the table in, and everything that
  // needs a way in still has one (a corner nobody needs may be closed off).
  for (const i of idx) g.walk[i] = 0;
  const all = reachableInside(g, near.door);
  for (const i of idx) g.walk[i] = 1;
  const got = (i: number) => g.walk[i] === 1 && !under.has(i) && all[i] === 1;
  const reachedNow = (i: number) => got(i) || (!g.walk[i] || under.has(i) ? STRAIGHT.some(([dx, dy]) => got(i + dy * g.w + dx)) : false);
  return reachedNow(front) && idx.slice(tops).every(reachedNow) && near.must.every(reachedNow);
}

// ---------- the room the game lays out ----------

/** A number in [0, 1) from two integers: the same layout every time, different from row to row. */
const mix = (a: number, b: number): number => {
  const h = Math.sin(a * 91.7 + b * 47.3 + 13.1) * 24634.6345;
  return h - Math.floor(h);
};

/**
 * One building's tables, the way a restaurant is furnished rather than a canteen: sofas in a
 * row along the back wall (small square tables in the first diner), then rows of tables in
 * small groups (one or two side by side) with room to walk between the groups, each row set
 * off a little from the one before, the designs mixed group by group (round, square, now and
 * then a long table or a booth); the corner by the door is left to the line and the host.
 * `prev`: the smaller building's tables, which stay where they were (they come first).
 * Opening order: spread over the room first, so a few tables already fill it.
 */
export function designTables(map: MapDef, prev: readonly TableSpot[], reserved: ReadonlySet<number>): TableSpot[] {
  const r = map.building;
  const kx = map.kitchenX;
  const tier = map.tier;
  const open = (st: TableStyle) => TABLE_STYLE_DEFS.some((d) => d.id === st && d.tier <= tier);
  const door = map.doors[0]!.inside;
  const room = roomOf(map, [], [], reserved);
  const placed: TableSpot[] = [];
  const tryAdd = (t: TableSpot): boolean => {
    // Keep the corner by the door clear: the line, the host and the way in.
    if (t.x > door.x - 4 && t.y > door.y - 3.2) return false;
    if (!tableFits(room, t.style, t.x, t.y, nearOf(room))) return false;
    occupy(room, t);
    placed.push(t);
    return true;
  };
  const kept = prev.filter((t) => tryAdd(t));
  // Each group: one design, one to three tables side by side, then a walkway of one or two tiles.
  const groups = (y: number, row: number, styleOf: (g: number) => TableStyle, sizes: readonly number[], start: number, longShift = 0) => {
    let x = kx + 2.5 + start;
    for (let g = 0; x + 1 < r.x1 - 1; g++) {
      const size = sizes[Math.floor(mix(row * 7 + g, tier + 3) * sizes.length)]!;
      const style = styleOf(g);
      for (let k = 0; k < size && x + 1 < r.x1 - 1; k++, x += 3) {
        // A long table needs the row behind it free: where it does not fit, a round one.
        if (!tryAdd({ x, y: style === 'long' ? y + longShift : y, style }) && style === 'long') tryAdd({ x, y, style: 'round' });
      }
      x += mix(g, row + tier * 11) < 0.6 ? 1 : 2;
    }
  };
  // Along the back wall: sofas in twos and threes (booths sit snug against a wall; tables for two
  // in the diner), now and then a long table.
  // (A long table there stands back against the wall: its front a row further in.)
  groups(r.y0 + 0.5, 0, (g) => (mix(g, tier + 9) < 0.25 ? 'long' : open('booth') ? 'booth' : 'square'), [2, 2, 3], mix(0, tier) < 0.5 ? 0 : 1, 1);
  // Then the rows: set off from each other, a wider aisle now and then (behind it long tables
  // fit: a long one reaches a row back).
  // Each row starts a different distance in from the one before it, where that costs no table
  // (the first diner is two tables wide: there it cannot).
  const width = r.x1 - 1 - (kx + 1);
  const fit = (st: number) => Math.floor((width - st) / 3);
  let start = 0;
  for (let y = r.y0 + 2.5, row = 1; y <= r.y1 - 1.5; row++) {
    const turn = 1 + Math.floor(mix(row, tier) * 2);
    const next = [(start + turn) % 3, (start + 3 - turn) % 3, start];
    start = next.find((st) => fit(st) === fit(0)) ?? 0;
    const wide = mix(row, tier + 13) < 0.25;
    if (wide) y += 1;
    if (y > r.y1 - 1.5) break;
    const longs = wide ? 0.35 : 0.12;
    groups(
      y,
      row,
      (g) => {
        const roll = mix(g * 3 + row, tier * 5 + 1);
        return roll < longs ? 'long' : roll < longs + 0.14 && open('booth') ? 'booth' : roll < 0.6 ? 'round' : 'square';
      },
      [1, 2, 2, 3],
      start,
    );
    y += 2;
  }
  // Last, single tables wherever a gap still takes one (a room holds about as many as a canteen
  // would, only not in lines): the back rows first, alternating designs.
  for (let y = r.y0 + 0.5, k = 0; y < r.y1 - 1; y += 1) {
    for (let x = kx + 2.5; x + 1 < r.x1 - 1; x += 1) if (tryAdd({ x, y, style: mix(x, y) < 0.55 ? 'round' : 'square' })) k++;
  }
  const fresh = placed.filter((t) => !kept.includes(t));
  return [...kept, ...spreadOut(fresh, kept, door)];
}

/** Farthest first: each next table the one farthest from those already open (the first: nearest the middle of the room). */
function spreadOut(spots: readonly TableSpot[], before: readonly TableSpot[], door: Point): TableSpot[] {
  const left = [...spots];
  const out: TableSpot[] = [];
  const chosen: Point[] = [...before];
  if (chosen.length === 0 && left.length > 0) {
    // The first table: halfway between the door and the back of the room, a classic round one if there is one.
    const cx = left.reduce((sum, t) => sum + t.x, 0) / left.length;
    const cy = left.reduce((sum, t) => sum + t.y, 0) / left.length;
    const score = (t: TableSpot) => Math.hypot(t.x - cx, t.y - (cy + door.y) / 2) + (t.style === 'round' ? 0 : 2);
    const first = left.reduce((a, b) => (score(b) < score(a) ? b : a));
    out.push(first);
    chosen.push(first);
    left.splice(left.indexOf(first), 1);
  }
  while (left.length > 0) {
    let best = 0;
    let bestD = -1;
    left.forEach((t, i) => {
      const d = Math.min(...chosen.map((c) => Math.hypot(c.x - t.x, c.y - t.y)));
      if (d > bestD + 1e-9) {
        bestD = d;
        best = i;
      }
    });
    const next = left.splice(best, 1)[0]!;
    out.push(next);
    chosen.push(next);
  }
  return out;
}
