import type { MapDef, Point } from '../data/maps';
import { CHAIR_OFFSET } from '../data/maps';

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

export function buildGrid(map: MapDef): Grid {
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
  for (const f of [map.stove, map.pass, ...map.decor]) if (f.blocks) markFootprint(g, f.x, f.y, f.w, f.d);
  for (const t of map.tables) {
    markFootprint(g, t.x, t.y, 1, 1);
    markFootprint(g, t.x + CHAIR_OFFSET.x, t.y + CHAIR_OFFSET.y, 1, 1);
  }
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

/** 8-way A* over tiles. The goal tile may be a blocked one (a chair is walked *onto*). */
function aStar(g: Grid, start: number, goal: number): number[] | null {
  const n = g.w * g.h;
  const gScore = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const gx = goal % g.w;
  const gy = Math.floor(goal / g.w);
  const h = (i: number) => {
    const dx = Math.abs((i % g.w) - gx);
    const dy = Math.abs(Math.floor(i / g.w) - gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  // The grids are tiny (hundreds of tiles), so a linear-scan open list is plenty fast.
  const open: number[] = [start];
  const fScore = new Float64Array(n).fill(Infinity);
  gScore[start] = 0;
  fScore[start] = h(start);
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]!]! < fScore[open[best]!]!) best = i;
    const cur = open[best]!;
    if (cur === goal) {
      const out = [cur];
      let c = cur;
      while (came[c]! >= 0) {
        c = came[c]!;
        out.push(c);
      }
      return out.reverse();
    }
    open.splice(best, 1);
    closed[cur] = 1;
    const cx = cur % g.w;
    const cy = Math.floor(cur / g.w);
    for (const [dx, dy, cost] of DIRS) {
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
        fScore[nb] = tentative + h(nb);
        if (!open.includes(nb)) open.push(nb);
      }
    }
  }
  return null;
}

/** Straight line between two points stays on walkable tiles without crossing walls? */
function clearLine(g: Grid, a: Point, b: Point, goal: number): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.2);
  let prev = tileIndex(g, Math.floor(a.x), Math.floor(a.y));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    for (const [ox, oy] of [[0, 0], [0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22]] as const) {
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
export function findPath(g: Grid, from: Point, to: Point): Point[] | null {
  const start = tileIndex(g, Math.floor(from.x), Math.floor(from.y));
  const goal = tileIndex(g, Math.floor(to.x), Math.floor(to.y));
  const tiles = aStar(g, start, goal);
  if (!tiles) return null;
  const raw: Point[] = tiles.slice(1, -1).map((i) => ({ x: (i % g.w) + 0.5, y: Math.floor(i / g.w) + 0.5 }));
  raw.push({ x: to.x, y: to.y });
  const out: Point[] = [];
  let anchor: Point = from;
  let i = 0;
  while (i < raw.length) {
    let far = i;
    while (far + 1 < raw.length && clearLine(g, anchor, raw[far + 1]!, goal)) far++;
    out.push(raw[far]!);
    anchor = raw[far]!;
    i = far + 1;
  }
  return out;
}

export function isWalkable(g: Grid, p: Point): boolean {
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  return inBounds(g, tx, ty) && g.walk[tileIndex(g, tx, ty)] === 1;
}
