import type { MapDef, Point } from '../data/maps';
import { SEAT_OFFSETS } from '../data/maps';

/**
 * Walkability grid + A*. Walls sit on tile edges, so crossing the building boundary is only
 * allowed through door tiles; furniture blocks whole tiles.
 */
export interface Grid {
  w: number;
  h: number;
  walk: Uint8Array;
  inside: Uint8Array;
  /** Pairs of tile indices that may cross the building boundary (both directions). */
  doorLinks: Set<string>;
}

const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

function tileIndex(g: Grid, tx: number, ty: number): number {
  return ty * g.w + tx;
}

function inBounds(g: Grid, tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < g.w && ty < g.h;
}

function markFootprint(g: Grid, cx: number, cy: number, w: number, d: number): void {
  for (let ty = Math.floor(cy - d / 2 + 0.01); ty < Math.ceil(cy + d / 2 - 0.01); ty++) {
    for (let tx = Math.floor(cx - w / 2 + 0.01); tx < Math.ceil(cx + w / 2 - 0.01); tx++) {
      if (inBounds(g, tx, ty)) g.walk[tileIndex(g, tx, ty)] = 0;
    }
  }
}

/**
 * How many of the map's table and stove spots are in use, how many tables (the first ones)
 * have their second chair, and the tiles of decor placed in build mode: furniture blocks tiles.
 */
export function buildGrid(map: MapDef, tableCount: number = map.startTables, stoveCount: number = map.startStoves, pairTables = 0, placed: readonly Point[] = []): Grid {
  const g: Grid = {
    w: map.width,
    h: map.height,
    walk: new Uint8Array(map.width * map.height),
    inside: new Uint8Array(map.width * map.height),
    doorLinks: new Set(),
  };
  for (const a of map.areas) {
    for (let ty = a.y0; ty < a.y1; ty++) {
      for (let tx = a.x0; tx < a.x1; tx++) g.walk[tileIndex(g, tx, ty)] = a.walkable ? 1 : 0;
    }
  }
  const b = map.building;
  for (let ty = b.y0; ty < b.y1; ty++) {
    for (let tx = b.x0; tx < b.x1; tx++) g.inside[tileIndex(g, tx, ty)] = 1;
  }
  const stoves = map.stoves.slice(0, stoveCount).map((s) => s.stove);
  for (const f of [...stoves, map.pass, map.sink, ...map.extraSinks.map((e) => e.sink), ...map.decor]) if (f.blocks) markFootprint(g, f.x, f.y, f.w, f.d);
  map.tables.slice(0, tableCount).forEach((t, i) => {
    markFootprint(g, t.x, t.y, 1, 1);
    for (const seat of SEAT_OFFSETS.slice(0, i < pairTables ? 2 : 1)) markFootprint(g, t.x + seat.x, t.y + seat.y, 1, 1);
  });
  for (const p of placed) markFootprint(g, p.x, p.y, 1, 1);
  for (const door of map.doors) {
    const a = tileIndex(g, Math.floor(door.inside.x), Math.floor(door.inside.y));
    const c = tileIndex(g, Math.floor(door.outside.x), Math.floor(door.outside.y));
    g.doorLinks.add(key(a, c));
  }
  return g;
}

/** Can a walker step between two neighboring tiles (walls and door rules included)? */
function canStep(g: Grid, a: number, b: number, goal: number): boolean {
  if (!g.walk[b] && b !== goal) return false;
  if (g.inside[a] !== g.inside[b]) return g.doorLinks.has(key(a, b));
  return true;
}

const DIRS: readonly [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
const DIR_X = Int8Array.from(DIRS, (d) => d[0]);
const DIR_Y = Int8Array.from(DIRS, (d) => d[1]);
const DIR_COST = Float64Array.from(DIRS, (d) => d[2]);

/**
 * What closing one tile would cut off, for every tile at once (build mode asks this of hundreds
 * of tiles; a full search for each took seconds in the big buildings). One depth-first search
 * from `from` over straight steps only: a diagonal step needs both straight steps beside it
 * open and never crosses a wall, so straight steps connect exactly the tiles paths do.
 * `order` = when a tile was reached (-1 = never), `done` = the last order inside its subtree,
 * `low` = the earliest tile its subtree links back to, `parent` = where it was reached from.
 */
export interface CutTree {
  order: Int32Array;
  done: Int32Array;
  low: Int32Array;
  parent: Int32Array;
}

export function cutTree(g: Grid, from: Point): CutTree {
  const n = g.w * g.h;
  const order = new Int32Array(n).fill(-1);
  const done = new Int32Array(n);
  const low = new Int32Array(n);
  const parent = new Int32Array(n).fill(-1);
  const next = new Uint8Array(n);
  const root = tileIndex(g, Math.floor(from.x), Math.floor(from.y));
  let t = 0;
  order[root] = low[root] = t++;
  const stack = [root];
  while (stack.length > 0) {
    const cur = stack[stack.length - 1]!;
    const k = next[cur]!;
    if (k < 4) {
      next[cur] = k + 1;
      const [dx, dy] = DIRS[k]!;
      const nx = (cur % g.w) + dx;
      const ny = Math.floor(cur / g.w) + dy;
      if (!inBounds(g, nx, ny)) continue;
      const nb = tileIndex(g, nx, ny);
      if (!canStep(g, cur, nb, -1)) continue;
      if (order[nb]! < 0) {
        parent[nb] = cur;
        order[nb] = low[nb] = t++;
        stack.push(nb);
      } else if (nb !== parent[cur]) low[cur] = Math.min(low[cur]!, order[nb]!);
    } else {
      stack.pop();
      done[cur] = t - 1;
      const p = parent[cur]!;
      if (p >= 0) low[p] = Math.min(low[p]!, low[cur]!);
    }
  }
  return { order, done, low, parent };
}

/** Every tile a walker can get to from `from` (1 = reachable), with the same rules as paths. */
export function reachableFrom(g: Grid, from: Point): Uint8Array {
  const seen = new Uint8Array(g.w * g.h);
  const start = tileIndex(g, Math.floor(from.x), Math.floor(from.y));
  const queue = [start];
  seen[start] = 1;
  while (queue.length > 0) {
    const cur = queue.pop()!;
    const cx = cur % g.w;
    const cy = Math.floor(cur / g.w);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(g, nx, ny)) continue;
      const nb = tileIndex(g, nx, ny);
      if (seen[nb] || !canStep(g, cur, nb, -1)) continue;
      if (dx !== 0 && dy !== 0 && (!canStep(g, cur, tileIndex(g, cx + dx, cy), -1) || !canStep(g, cur, tileIndex(g, cx, cy + dy), -1))) continue;
      seen[nb] = 1;
      queue.push(nb);
    }
  }
  return seen;
}

/** Can someone get to point p (walk onto it, or stand next to it when it is furniture like a chair)? */
export function canReach(g: Grid, reach: Uint8Array, p: Point): boolean {
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  if (!inBounds(g, tx, ty)) return false;
  if (reach[tileIndex(g, tx, ty)]) return true;
  if (g.walk[tileIndex(g, tx, ty)]) return false;
  for (const [dx, dy] of DIRS) {
    if (dx !== 0 && dy !== 0) continue;
    if (inBounds(g, tx + dx, ty + dy) && reach[tileIndex(g, tx + dx, ty + dy)]) return true;
  }
  return false;
}

/** 8-way A* over tiles. The goal tile may be a blocked one (a chair is walked *onto*). */
/**
 * The open list of the search: a binary heap on (cost estimate, then the order tiles were first
 * found), so it picks exactly what a plain scan for the lowest estimate picked (the same paths
 * as before) without scanning every open tile each step: the late-game buildings have well over
 * a thousand tiles, and that scan made one long walk cost milliseconds.
 */
class OpenHeap {
  node: number[] = [];
  f: number[] = [];
  seq: number[] = [];
  get size(): number {
    return this.node.length;
  }
  private less(a: number, b: number): boolean {
    return this.f[a]! < this.f[b]! || (this.f[a] === this.f[b] && this.seq[a]! < this.seq[b]!);
  }
  private swap(a: number, b: number): void {
    const n = this.node[a]!;
    this.node[a] = this.node[b]!;
    this.node[b] = n;
    const f = this.f[a]!;
    this.f[a] = this.f[b]!;
    this.f[b] = f;
    const q = this.seq[a]!;
    this.seq[a] = this.seq[b]!;
    this.seq[b] = q;
  }
  push(node: number, f: number, seq: number): void {
    this.node.push(node);
    this.f.push(f);
    this.seq.push(seq);
    let i = this.node.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (!this.less(i, up)) break;
      this.swap(i, up);
      i = up;
    }
  }
  pop(): number {
    const top = this.node[0]!;
    const last = this.node.length - 1;
    this.swap(0, last);
    this.node.pop();
    this.f.pop();
    this.seq.pop();
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < this.node.length && this.less(l, m)) m = l;
      if (r < this.node.length && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}

function aStar(g: Grid, start: number, goal: number): number[] | null {
  const n = g.w * g.h;
  const gScore = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  /** When each tile first joined the open list (the tie-break); -1 = not yet. */
  const firstSeen = new Int32Array(n).fill(-1);
  const gx = goal % g.w;
  const gy = Math.floor(goal / g.w);
  const h = (i: number) => {
    const dx = Math.abs((i % g.w) - gx);
    const dy = Math.abs(Math.floor(i / g.w) - gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const open = new OpenHeap();
  let seq = 0;
  gScore[start] = 0;
  firstSeen[start] = seq++;
  open.push(start, h(start), firstSeen[start]!);
  while (open.size > 0) {
    const cur = open.pop();
    // A tile improved after it was queued sits in the heap twice; the older entry is stale.
    if (closed[cur]) continue;
    if (cur === goal) {
      const out = [cur];
      let c = cur;
      while (came[c]! >= 0) {
        c = came[c]!;
        out.push(c);
      }
      return out.reverse();
    }
    closed[cur] = 1;
    const cx = cur % g.w;
    const cy = Math.floor(cur / g.w);
    // Indexed, not for-of with destructuring: this is the hottest loop of the game, and the
    // phone's engine (Hermes) pays for every iterator.
    for (let k = 0; k < 8; k++) {
      const dx = DIR_X[k]!;
      const dy = DIR_Y[k]!;
      const cost = DIR_COST[k]!;
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(g, nx, ny)) continue;
      const nb = tileIndex(g, nx, ny);
      if (closed[nb] || !canStep(g, cur, nb, goal)) continue;
      // No diagonal corner-cutting past blocked tiles or walls.
      if (dx !== 0 && dy !== 0) {
        const sideA = tileIndex(g, cx + dx, cy);
        const sideB = tileIndex(g, cx, cy + dy);
        if (!canStep(g, cur, sideA, -1) || !canStep(g, cur, sideB, -1)) continue;
      }
      const tentative = gScore[cur]! + cost;
      if (tentative < gScore[nb]!) {
        came[nb] = cur;
        gScore[nb] = tentative;
        if (firstSeen[nb]! < 0) firstSeen[nb] = seq++;
        open.push(nb, tentative + h(nb), firstSeen[nb]!);
      }
    }
  }
  return null;
}

/** Path smoothing looks this many waypoints ahead at most. */
const SMOOTH_AHEAD = 16;

/** Where a straight line is sampled across its width: the middle and a walker's shoulders. */
const LINE_SAMPLES: readonly (readonly [number, number])[] = [[0, 0], [0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22]];

/** Straight line between two points stays on walkable tiles without crossing walls? */
function clearLine(g: Grid, a: Point, b: Point, goal: number): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.2);
  let prev = tileIndex(g, Math.floor(a.x), Math.floor(a.y));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    for (const [ox, oy] of LINE_SAMPLES) {
      const px = a.x + (b.x - a.x) * t + ox;
      const py = a.y + (b.y - a.y) * t + oy;
      const tx = Math.floor(px);
      const ty = Math.floor(py);
      if (!inBounds(g, tx, ty)) return false;
      const idx = tileIndex(g, tx, ty);
      if (!g.walk[idx] && idx !== goal) return false;
      if (ox === 0 && oy === 0) {
        if (idx !== prev && g.inside[idx] !== g.inside[prev] && !g.doorLinks.has(key(idx, prev))) return false;
        prev = idx;
      }
    }
  }
  return true;
}

/**
 * Waypoints from `from` to `to` (tile coordinates), smoothed so walkers cut across open floor
 * instead of zig-zagging tile by tile. Returns null when unreachable.
 */
/**
 * Searches already done on this grid, by start and goal tile. The same walks come up again and
 * again (a waiter's spot to a table, the door to the line), and a grid never changes once
 * built (new furniture builds a new one), so the answer can be kept. Bounded: cleared when full.
 */
const SEARCHES = new WeakMap<Grid, Map<number, number[] | null>>();
const SEARCH_CACHE_MAX = 4000;

function searchTiles(g: Grid, start: number, goal: number): number[] | null {
  let cache = SEARCHES.get(g);
  if (!cache) {
    cache = new Map();
    SEARCHES.set(g, cache);
  }
  const k = start * g.w * g.h + goal;
  const hit = cache.get(k);
  if (hit !== undefined) return hit;
  if (cache.size >= SEARCH_CACHE_MAX) cache.clear();
  const tiles = aStar(g, start, goal);
  cache.set(k, tiles);
  return tiles;
}

/**
 * Finished (smoothed) paths on this grid, by the exact start and end points: people mostly walk
 * between the same spots (their post, the side of a table), and smoothing a long path costs more
 * than the search. Each caller gets its own copy (walking eats the path as it goes).
 */
const PATHS = new WeakMap<Grid, Map<string, Point[] | null>>();

export function findPath(g: Grid, from: Point, to: Point): Point[] | null {
  let cache = PATHS.get(g);
  if (!cache) {
    cache = new Map();
    PATHS.set(g, cache);
  }
  const k = `${from.x},${from.y},${to.x},${to.y}`;
  let path = cache.get(k);
  if (path === undefined) {
    if (cache.size >= SEARCH_CACHE_MAX) cache.clear();
    path = smoothPath(g, from, to);
    cache.set(k, path);
  }
  return path ? path.map((p) => ({ x: p.x, y: p.y })) : null;
}

function smoothPath(g: Grid, from: Point, to: Point): Point[] | null {
  const start = tileIndex(g, Math.floor(from.x), Math.floor(from.y));
  const goal = tileIndex(g, Math.floor(to.x), Math.floor(to.y));
  const tiles = searchTiles(g, start, goal);
  if (!tiles) return null;
  const raw: Point[] = tiles.slice(1, -1).map((i) => ({ x: (i % g.w) + 0.5, y: Math.floor(i / g.w) + 0.5 }));
  raw.push({ x: to.x, y: to.y });
  const out: Point[] = [];
  let anchor: Point = from;
  let i = 0;
  while (i < raw.length) {
    // Straight to the end if nothing is in the way (open floor: one check instead of dozens).
    if (raw.length - i > 2 && clearLine(g, anchor, raw[raw.length - 1]!, goal)) {
      out.push(raw[raw.length - 1]!);
      break;
    }
    // Otherwise as far as the line stays clear, looking a limited way ahead: each check is a
    // whole line from the anchor, so an unlimited look-ahead cost the square of the path.
    let far = i;
    while (far + 1 < raw.length && far + 1 - i <= SMOOTH_AHEAD && clearLine(g, anchor, raw[far + 1]!, goal)) far++;
    out.push(raw[far]!);
    anchor = raw[far]!;
    i = far + 1;
  }
  return out;
}

/** Can someone at `from` still walk this path straight from point to point (nothing new in the way)? */
export function pathStillClear(g: Grid, from: Point, path: readonly Point[]): boolean {
  if (path.length === 0) return true;
  const last = path[path.length - 1]!;
  const goal = tileIndex(g, Math.floor(last.x), Math.floor(last.y));
  let a = from;
  for (const b of path) {
    if (!clearLine(g, a, b, goal)) return false;
    a = b;
  }
  return true;
}

export function isWalkable(g: Grid, p: Point): boolean {
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  return inBounds(g, tx, ty) && g.walk[tileIndex(g, tx, ty)] === 1;
}
