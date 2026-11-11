/**
 * Static world for a tier: the ground picture (recorded once) plus the list
 * of static sprites (buildings, trees) that need depth sorting with movers.
 */
import { BlurStyle, ClipOp, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';

import { buildingWalls, type TerminalBuilding, type ZoneKind } from '../data/terminals';
import type { Rail, Satellite, TierLayout } from '../data/tiers';
import { hash01 } from '../sim/hash';
import { graphOf, routeGeometry, type Graph } from '../sim/game/graph';
import { pierOf, routeLineUp } from '../sim/game/layout';
import { meteoSpotOf, towerSpotOf } from '../sim/game/tower';
import { chaikin } from '../sim/game/path';
import { GLYPHS } from './art/glyphs';
import { GroundPainter, rasterizeGround, recordPicture, type GroundTile } from './ground';
import { HALF_H, HALF_W, isoX, isoY } from './iso';
import { BRIDGE_LEN, ROOF_SEG, TREE_KINDS, TREE_SIZES, WALL_KINDS, WALL_STEP, type SpriteSet } from './sprites';
import { WALL_SEG } from './art/terminal';

export interface StaticSprite {
  sprite: number;
  x: number;
  y: number;
  depth: number;
  /** Screen-space radius for culling. */
  r: number;
}

export interface World {
  picture: SkPicture;
  /** The picture baked into image tiles. */
  tiles: GroundTile[];
  /** The sharp part of the ground (no base grass, patches or soft shadows), drawn as vectors over the tiles when zoomed in close. */
  crisp: SkPicture;
  statics: StaticSprite[];
  /** World-screen bounds the camera center may move within. */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  /** Windsock sprite placement (animated). */
  windsock: { x: number; y: number };
  /** Where the control tower stands (it is drawn each frame: it grows with its upgrade), or null. */
  tower: [number, number] | null;
}

export const GROUND_BASE = '#8fce78';
const PATCH_DARK = '#7fc069';
const PATCH_LIGHT = '#a2dc8c';
const STRIPE_A = '#97d580';
const STRIPE_B = '#8ac873';
const DIRT = '#d6b07a';
const DIRT_EDGE = '#c49a62';
const DIRT_LIGHT = '#e2c08e';
const GRAVEL = '#ddd2b6';

function diamondPath(x0: number, y0: number, x1: number, y1: number) {
  const b = Skia.PathBuilder.Make();
  b.moveTo(isoX(x0, y0), isoY(x0, y0));
  b.lineTo(isoX(x1, y0), isoY(x1, y0));
  b.lineTo(isoX(x1, y1), isoY(x1, y1));
  b.lineTo(isoX(x0, y1), isoY(x0, y1));
  b.close();
  return b.build();
}

/**
 * The taxiways as long chains of edges (stand lead-ins excluded), so each
 * chain is drawn as one smooth ribbon.
 */
function taxiChains(gr: Graph): number[][] {
  const stand = new Set(gr.standNode.filter((n) => n >= 0));
  const lane = (e: number) => !stand.has(gr.edges[e].from) && !stand.has(gr.edges[e].to);
  const inDeg = new Array(gr.ids.length).fill(0);
  const outs: number[][] = gr.ids.map(() => []);
  gr.edges.forEach((e, i) => {
    if (!lane(i)) return;
    inDeg[e.to]++;
    outs[e.from].push(i);
  });
  const through = (n: number) => inDeg[n] === 1 && outs[n].length === 1;
  const used = new Set<number>();
  const chains: number[][] = [];
  const walk = (start: number) => {
    const chain = [start];
    used.add(start);
    let n = gr.edges[start].to;
    while (through(n) && !used.has(outs[n][0])) {
      chain.push(outs[n][0]);
      used.add(outs[n][0]);
      n = gr.edges[outs[n][0]].to;
    }
    chains.push(chain);
  };
  gr.edges.forEach((e, i) => {
    if (lane(i) && !used.has(i) && !through(e.from)) walk(i);
  });
  gr.edges.forEach((_, i) => {
    if (lane(i) && !used.has(i)) walk(i);
  });
  return chains;
}

/** Polyline shifted sideways by d tiles. */
function offsetLine(line: readonly (readonly [number, number])[], d: number): [number, number][] {
  return line.map((p, i) => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / len) * d, p[1] + (dx / len) * d];
  });
}

/** Dashes along a polyline: `on` tiles of paint every `on + off`. */
function dashes(g: GroundPainter, line: readonly (readonly [number, number])[], on: number, off: number, color: string, width: number): void {
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const len = Math.hypot(bx - ax, by - ay);
    for (let t = carry; t < len; t += on + off) {
      const t1 = Math.min(len, t + on);
      g.line(ax + ((bx - ax) * t) / len, ay + ((by - ay) * t) / len, ax + ((bx - ax) * t1) / len, ay + ((by - ay) * t1) / len, color, width);
      carry = t + on + off - len;
    }
  }
}

/** Point at distance d along a polyline, pushed sideways by side tiles. */
function pointAlong(line: readonly (readonly [number, number])[], d: number, side: number): [number, number] | null {
  let left = d;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (left <= len) {
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      return [ax + ux * left - uy * side, ay + uy * left + ux * side];
    }
    left -= len;
  }
  return null;
}

/** Where passengers cross the access road between the parking lot and check-in. */
function crossingY(L: TierLayout): number {
  const e = L.terminal.entry;
  const q = L.terminal.checkinQueue[L.terminal.checkinQueue.length - 1];
  const roadX = L.road[1][0];
  const t = (e[0] - roadX) / Math.max(0.1, e[0] - q[0]);
  return e[1] + (q[1] - e[1]) * Math.max(0, Math.min(1, t));
}

function roadPointAtY(line: readonly (readonly [number, number])[], y: number): [number, number] | null {
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    if ((y - ay) * (y - by) <= 0 && ay !== by) {
      const t = (y - ay) / (by - ay);
      return [ax + (bx - ax) * t, y];
    }
  }
  return null;
}

/** Text painted flat on the ground, reading left to right on screen (digits only). */
function paintText(c: SkCanvas, text: string, x: number, y: number, color: string, unit: number): void {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeCap(StrokeCap.Round);
  p.setStrokeJoin(StrokeJoin.Round);
  p.setColor(Skia.Color(color));
  p.setStrokeWidth(1.5);
  c.save();
  c.translate(isoX(x, y), isoY(x, y));
  // one glyph unit = `unit` tiles along the screen-right and screen-down ground directions
  c.scale(HALF_W * 2 * unit, HALF_H * 2 * unit);
  let ox = -(text.length * 7) / 2;
  for (const ch of text) {
    const polys = GLYPHS[ch];
    if (polys) {
      const b = Skia.PathBuilder.Make();
      for (const poly of polys) {
        for (let i = 0; i < poly.length; i += 2) {
          if (i === 0) b.moveTo(ox + poly[i], poly[i + 1] - 5);
          else b.lineTo(ox + poly[i], poly[i + 1] - 5);
        }
      }
      c.drawPath(b.build(), p);
    }
    ox += 7;
  }
  c.restore();
}

/** A ribbon along a world polyline (flat [x, y, z...]) with constant world width. */
function ribbon(g: GroundPainter, path: number[], width: number, color: string): void {
  const n = path.length / 3;
  if (n < 2) return;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1) * 3;
    const b = Math.min(n - 1, i + 1) * 3;
    let dx = path[b] - path[a];
    let dy = path[b + 1] - path[a + 1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const x = path[i * 3];
    const y = path[i * 3 + 1];
    left.push(x - dy * width * 0.5, y + dx * width * 0.5);
    right.push(x + dy * width * 0.5, y - dx * width * 0.5);
  }
  const pts = left.slice();
  for (let i = right.length - 2; i >= 0; i -= 2) pts.push(right[i], right[i + 1]);
  g.poly(pts, color);
  // round caps
  g.ellipse(path[0], path[1], width / 2, width / 2, color, 12);
  g.ellipse(path[(n - 1) * 3], path[(n - 1) * 3 + 1], width / 2, width / 2, color, 12);
}

function c2(g: GroundPainter, b: ReturnType<typeof Skia.PathBuilder.Make>): void {
  g.c.drawPath(b.build(), g.s);
}

function drawField(g: GroundPainter, x0: number, y0: number, x1: number, y1: number, kind: number): void {
  const colors = [
    ['#e6cf7a', '#d9bf68'],
    ['#a9d77a', '#9bcb6c'],
    ['#c9a27a', '#bb946c'],
    ['#efdc93', '#e3cd80'],
  ][kind % 4];
  g.rect(x0 - 0.12, y0 - 0.12, x1 + 0.12, y1 + 0.12, 'rgba(90,140,70,0.18)');
  g.rect(x0, y0, x1, y1, colors[0]);
  const rows = Math.floor((x1 - x0) / 0.45);
  const b = Skia.PathBuilder.Make();
  for (let i = 1; i < rows; i++) {
    const x = x0 + i * 0.45;
    b.moveTo(isoX(x, y0 + 0.15), isoY(x, y0 + 0.15));
    b.lineTo(isoX(x, y1 - 0.15), isoY(x, y1 - 0.15));
  }
  g.s.setColor(Skia.Color(colors[1]));
  g.s.setStrokeWidth(3);
  g.c.drawPath(b.build(), g.s);
}

// ------------------------------------------------------------------ the terminal building

/**
 * Belt barriers along the long legs of each serpentine (rows 0.5 apart share
 * the divider); the ends stay open so the line can turn.
 */
function paintQueueRopes(g: GroundPainter, lines: readonly (readonly (readonly [number, number])[])[]): void {
  const rope = Skia.PathBuilder.Make();
  const postsP = Skia.PathBuilder.Make();
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [ax, ay] = line[i - 1];
      const [bx, by] = line[i];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1) continue;
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      for (const side of [-0.2, 0.2]) {
        const sx = ax - uy * side + ux * 0.3;
        const sy = ay + ux * side + uy * 0.3;
        const run = len - 0.6;
        rope.moveTo(isoX(sx, sy), isoY(sx, sy, 0.18));
        rope.lineTo(isoX(sx + ux * run, sy + uy * run), isoY(sx + ux * run, sy + uy * run, 0.18));
        const n = Math.max(1, Math.round(run / 0.55));
        for (let k = 0; k <= n; k++) {
          const px = sx + (ux * run * k) / n;
          const py = sy + (uy * run * k) / n;
          postsP.moveTo(isoX(px, py), isoY(px, py));
          postsP.lineTo(isoX(px, py), isoY(px, py, 0.22));
        }
      }
    }
  }
  g.s.setColor(Skia.Color('#64748b'));
  g.s.setStrokeWidth(2);
  g.c.drawPath(postsP.build(), g.s);
  g.s.setColor(Skia.Color('#3b82f6'));
  g.s.setStrokeWidth(1.6);
  g.c.drawPath(rope.build(), g.s);
}

/** Under a baggage carousel (drawn in 3D with the world): its soft shadow and a yellow keep-clear ring on the floor. */
function paintCarousel(g: GroundPainter, at: readonly [number, number]): void {
  g.ellipse(at[0], at[1], 0.56, 0.56, 'rgba(51,65,85,0.18)');
  const ring = Skia.PathBuilder.Make();
  for (let k = 0; k <= 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = isoX(at[0] + Math.cos(a) * 0.66, at[1] + Math.sin(a) * 0.66);
    const y = isoY(at[0] + Math.cos(a) * 0.66, at[1] + Math.sin(a) * 0.66);
    if (k === 0) ring.moveTo(x, y);
    else ring.lineTo(x, y);
  }
  g.s.setColor(Skia.Color('#facc15'));
  g.s.setStrokeWidth(1.6);
  g.c.drawPath(ring.build(), g.s);
}

/** Under a check-in conveyor (drawn in 3D with the world): a soft shadow along it. */
function paintBeltShadow(g: GroundPainter, line: readonly (readonly [number, number])[]): void {
  const pts: number[] = [];
  for (const p of line) pts.push(p[0], p[1], 0);
  ribbon(g, pts, 0.34, 'rgba(51,65,85,0.2)');
}

/** Terminal 3 on the ground: the road with its curb and crossings, the floors, the belt, carousels and queue ropes. */
function paintT3(g: GroundPainter, T3: NonNullable<TierLayout['t3']>, blur: (r: number) => ReturnType<typeof Skia.MaskFilter.MakeBlur>): void {
  const [x0, y0, x1] = T3.building.box;
  // the sidewalk along the front, the road with its markings, a taxi rank and a bus bay
  g.rect(x0 - 0.3, y0 - 0.55, x1 + 0.6, y0, '#d6d3d1');
  for (let x = x0 - 0.3; x < x1 + 0.6; x += 0.5) g.line(x, y0 - 0.55, x, y0, '#c7c2bd', 1);
  const road: number[] = [];
  for (const p of T3.road) road.push(p[0], p[1], 0);
  g.mask(blur(4));
  ribbon(g, road, 1.25, 'rgba(40,70,50,0.25)');
  g.mask(null);
  ribbon(g, road, 1.05, '#a7b0bb');
  dashes(g, T3.road, 0.32, 0.36, '#f8fafc', 1.6);
  for (const side of [-0.43, 0.43]) {
    const e = offsetLine(T3.road, side);
    for (let i = 1; i < e.length; i++) g.line(e[i - 1][0], e[i - 1][1], e[i][0], e[i][1], 'rgba(255,255,255,0.8)', 1.2);
  }
  // the curb lane: yellow taxi boxes by the arrivals, a bus bay by the departures (Terminal 4 is on the same plan, further east)
  const cy = y0 - 0.45;
  const dx = x0 - 39.5;
  for (let x = 48.6 + dx; x < 52.6 + dx; x += 0.8) {
    g.line(x, cy - 0.12, x + 0.6, cy - 0.12, '#facc15', 1.4);
    g.line(x, cy - 0.12, x, cy + 0.12, '#facc15', 1.4);
  }
  g.rect(45.6 + dx, cy - 0.15, 47.2 + dx, cy + 0.15, 'rgba(22,163,74,0.35)');
  // zebra crossings from the garage to the doors
  for (const zx of (T3.st.entrances ?? []).map((e) => e[0])) for (let k = -3; k <= 3; k++) g.rect(zx + k * 0.13 - 0.04, cy - 0.75, zx + k * 0.13 + 0.04, cy - 0.3, '#f8fafc');
  // the garage's shadow on the ground
  const G = T3.garage;
  g.mask(blur(6));
  g.rect(G[0] - 0.1, G[1] - 0.1, G[2] + 0.3, G[3] + 0.3, 'rgba(40,60,70,0.3)');
  g.mask(null);
  // inside
  paintBuildingFloor(g, T3.building, blur);
  const st = T3.st;
  paintBeltShadow(g, st.belt);
  for (const c of st.carousels ?? [st.claim]) paintCarousel(g, c);
  const lines: (readonly (readonly [number, number])[])[] = [st.checkinQueue, st.securityQueue];
  if (st.passport) lines.push(st.passport.queue);
  if (st.arrPassport) lines.push(st.arrPassport.queue);
  paintQueueRopes(g, lines);
}

/** Distance from a point to a segment. */
function segDist(x: number, y: number, a: readonly [number, number], b: readonly [number, number]): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t);
}

/** The hub on the ground: the railway (ballast, sleepers, rails) between its tunnel portals, the platform and the footpath. */
function paintRail(g: GroundPainter, r: Rail, blur: (r: number) => ReturnType<typeof Skia.MaskFilter.MakeBlur>): void {
  const [x0, x1] = r.portals;
  const y = r.y;
  g.mask(blur(4));
  g.rect(x0, y - 0.5, x1, y + 0.5, 'rgba(40,60,50,0.25)');
  g.mask(null);
  g.rect(x0, y - 0.42, x1, y + 0.42, '#a8a29e');
  for (let x = x0 + 0.1; x < x1; x += 0.28) g.line(x, y - 0.3, x, y + 0.3, '#78716c', 2.2);
  for (const v of [-0.17, 0.17]) g.line(x0, y + v, x1, y + v, '#475569', 1.6);
  // the platform: concrete with a yellow safety line along the edge, tactile paving
  const P = r.platform;
  g.mask(blur(3));
  g.rect(P[0] - 0.05, P[1] - 0.05, P[2] + 0.1, P[3] + 0.1, 'rgba(40,60,70,0.3)');
  g.mask(null);
  g.rect(P[0], P[1], P[2], P[3], '#e7e5e4');
  for (let x = Math.ceil(P[0] * 2) / 2; x < P[2]; x += 0.5) g.line(x, P[1], x, P[3], '#d6d3d1', 1);
  g.line(P[0], P[1] + 0.08, P[2], P[1] + 0.08, '#facc15', 2);
  // the footpath down to the curb
  const path: number[] = [r.stop, P[3], 0];
  for (const p of r.path) path.push(p[0], p[1], 0);
  ribbon(g, path, 0.7, '#d6d3d1');
}

/** The people mover's guideway: a concrete track with running pads and a guide rail, a yellow line along each platform. */
function paintApm(g: GroundPainter, sat: Satellite, blur: (r: number) => ReturnType<typeof Skia.MaskFilter.MakeBlur>): void {
  const a = sat.apm;
  g.mask(blur(3));
  g.rect(a.x0, a.y - 0.32, a.x1, a.y + 0.34, 'rgba(40,60,70,0.3)');
  g.mask(null);
  g.rect(a.x0, a.y - 0.27, a.x1, a.y + 0.27, '#cbd5e1');
  for (const v of [-0.15, 0.15]) g.line(a.x0, a.y + v, a.x1, a.y + v, '#94a3b8', 2.4);
  g.line(a.x0, a.y, a.x1, a.y, '#64748b', 1.2);
  for (const P of [sat.platformT, sat.platformS]) g.line(P[0] - 0.1, a.y - 0.33, P[2] + 0.05, a.y - 0.33, '#facc15', 1.8);
}

const ZONE_FLOOR: Record<ZoneKind, [string, string]> = {
  checkin: ['#e9eef4', '#d8e0ea'],
  security: ['#e1e5ea', '#cfd5dd'],
  departures: ['#ead9c0', '#dcc9ad'],
  arrivals: ['#e4efe7', '#d2e2d7'],
  passport: ['#e6e3ef', '#d4cfe2'],
  dutyFree: ['#f3e8d2', '#e6d6b6'],
  food: ['#f1e2d6', '#e3cfbf'],
  lounge: ['#d9cfe6', '#c8bcd9'],
  gates: ['#ead9c0', '#dcc9ad'],
  customs: ['#e4efe7', '#d2e2d7'],
  station: ['#dfe7ef', '#c9d4e0'],
};

/** Floors by zone (tiles, a carpet in the lounges), a soft shadow under the walls, door mats. */
function paintBuildingFloor(g: GroundPainter, b: TerminalBuilding, blur: (r: number) => ReturnType<typeof Skia.MaskFilter.MakeBlur>): void {
  const [x0, y0, x1, y1] = b.box;
  g.mask(blur(5));
  g.rect(x0 - 0.15, y0 - 0.1, x1 + 0.2, y1 + 0.2, 'rgba(40,60,70,0.3)');
  g.mask(null);
  for (const z of b.zones) {
    const [a, c, e, f] = z.box;
    const [base, line] = ZONE_FLOOR[z.kind];
    g.rect(a, c, e, f, base);
    const step = z.kind === 'departures' || z.kind === 'gates' || z.kind === 'lounge' ? 0.25 : 0.5;
    for (let x = Math.ceil(a / step) * step; x < e; x += step) g.line(x, c, x, f, line, step < 0.5 ? 0.6 : 1);
    for (let y = Math.ceil(c / step) * step; y < f; y += step) g.line(a, y, e, y, line, step < 0.5 ? 0.6 : 1);
  }
  // a yellow-and-black line where security starts, door mats at every door
  const sec = b.zones.find((z) => z.kind === 'security');
  if (sec) for (let x = sec.box[0]; x < sec.box[2]; x += 0.2) g.line(x, sec.box[3] - 0.04, x + 0.1, sec.box[3] - 0.04, '#facc15', 1.6);
  for (const d of b.doors) {
    const alongX = Math.abs(d.at[1] - y0) < 1e-6 || Math.abs(d.at[1] - y1) < 1e-6;
    const h = d.width / 2;
    if (alongX) g.rect(d.at[0] - h, d.at[1] - 0.18, d.at[0] + h, d.at[1] + 0.18, '#475569');
    else g.rect(d.at[0] - 0.18, d.at[1] - h, d.at[0] + 0.18, d.at[1] + h, '#475569');
  }
}

/** Wall pieces (short, so people sort right against them), door frames, canopies and furniture. */
function buildingStatics(b: TerminalBuilding, sprites: SpriteSet, statics: StaticSprite[], tier: number): void {
  const push = (sprite: number, x: number, y: number, depth: number, r = 60) => statics.push({ sprite, x: isoX(x, y), y: isoY(x, y), depth, r });
  for (const w of buildingWalls(b)) {
    const alongX = w.a[1] === w.b[1];
    const lo = alongX ? Math.min(w.a[0], w.b[0]) : Math.min(w.a[1], w.b[1]);
    const hi = alongX ? Math.max(w.a[0], w.b[0]) : Math.max(w.a[1], w.b[1]);
    const kind = WALL_KINDS.indexOf(w.kind);
    const bias = w.kind === 'back' ? -0.05 : 0.08;
    for (let a = lo; a < hi - 1e-6; a += WALL_SEG) {
      const len = Math.min(WALL_SEG, hi - a);
      if (len < WALL_STEP * 0.5) continue;
      const [x, y] = alongX ? [a, w.a[1]] : [w.a[0], a];
      const [mx, my] = alongX ? [a + len / 2, w.a[1]] : [w.a[0], a + len / 2];
      push(sprites.wallPiece(kind, !alongX, len), x, y, mx + my + bias, 40);
    }
  }
  const [bx0, by0, bx1, by1] = b.box;
  for (const d of b.doors) {
    if (d.kind === 'train') continue;
    const onY = Math.abs(d.at[0] - bx0) < 1e-6 || Math.abs(d.at[0] - bx1) < 1e-6;
    const h = d.width / 2;
    const tall = Math.abs(d.at[1] - by0) < 1e-6 || Math.abs(d.at[0] - bx0) < 1e-6;
    const sx = onY ? d.at[0] : d.at[0] - h;
    const sy = onY ? d.at[1] - h : d.at[1];
    push(sprites.doorFrame(onY, d.width, tall), sx, sy, d.at[0] + d.at[1] + 0.1, 50);
    // canopies over the doors people use, out over the curb or the apron
    if ((d.kind === 'entrance' || d.kind === 'exit') && Math.abs(d.at[0] - bx1) < 1e-6) {
      const cx = onY ? d.at[0] : d.at[0] - h - 0.15;
      const cy = onY ? d.at[1] - h - 0.15 : d.at[1];
      push(sprites.canopy(onY, d.width), cx, cy, d.at[0] + d.at[1] + 0.9, 70);
    }
  }
  void by1;
  for (const f of b.furniture) {
    if ((f.tier ?? 0) > tier) continue;
    const [x, y] = f.at;
    if (f.kind === 'seats') push(sprites.seats(f.n ?? 3), x, y, x + (f.n ?? 3) * 0.2 + y + 0.1, 70);
    else if (f.kind === 'shelf') push(sprites.shelf(f.n ?? 0), x, y, x + y + 0.45, 60);
    else if (f.kind === 'foodStall') push(sprites.foodStall(f.n ?? 0), x, y, x + y + 0.4, 60);
    else if (f.kind === 'baggageRoom') push(sprites.termProp(f.kind), x, y, x + y + 1.0, 90);
    else if (f.kind.startsWith('sign')) push(sprites.termProp(f.kind), x, y, x + y + 0.6, 60);
    else push(sprites.termProp(f.kind), x, y, x + y + 0.2, 60);
  }
}

/** Painted ring radius of a stand by its size. */
const RING: Record<string, number> = { small: 0.78, fbo: 0.9, heli: 0.8, medium: 1.05, large: 1.3, cargo: 1.5, huge: 1.55, hugeX: 1.75 };

export function buildWorld(L: TierLayout, sprites: SpriteSet, tier = 1, open: readonly boolean[] = [true], counters = 1, lanes = 1, farmLevel = 0, fenceLevel = 0, scanV = 1): World {
  const W = L.world.w;
  const H = L.world.h;
  const F = L.field;
  const hangarBays = L.stands.filter((st, i) => st.hangar && open[i]).length;
  const statics: StaticSprite[] = [];
  let towerAt: [number, number] | null = null;
  const minX = isoX(0, H) - 64;
  const maxX = isoX(W, 0) + 64;
  const minY = isoY(0, 0) - 64;
  const maxY = isoY(W, H) + 64;

  const paintGround = (c: SkCanvas, crisp: boolean) => {
    const g = new GroundPainter(c, crisp);
    const blur = (r: number) => Skia.MaskFilter.MakeBlur(BlurStyle.Normal, r, true);

    // base grass and soft color patches (baked once, so blur is free at runtime; the tiles have them)
    g.f.setColor(Skia.Color(GROUND_BASE));
    if (!crisp) c.drawPath(diamondPath(-2, -2, W + 2, H + 2), g.f);
    g.mask(blur(18));
    for (let i = 0; i < 90 && !crisp; i++) {
      const x = hash01(7000 + i) * W;
      const y = hash01(7100 + i) * H;
      const r = 1.5 + hash01(7200 + i) * 3.5;
      g.f.setColor(Skia.Color(hash01(7300 + i) < 0.5 ? PATCH_DARK : PATCH_LIGHT));
      g.f.setAlphaf(0.55);
      c.drawOval(Skia.XYWHRect(isoX(x, y) - r * 32, isoY(x, y) - r * 16, r * 64, r * 32), g.f);
    }
    g.f.setAlphaf(1);
    g.mask(null);

    // farm fields and a pond
    const fields: [number, number, number, number][] = [
      [2, 30, 9, 36],
      [2, 37, 8, 43],
      [10, 32, 17, 38],
      [19, 33, 26, 40],
      [28, 32, 36, 37],
      [36, 20, 43, 27],
      [36, 9, 43, 16],
      [27, 4, 34, 10],
      [3, 3, 9, 9],
      [12, 4, 18, 11],
    ];
    // (the hub's bigger world: more farmland east, clear of the road and the railway)
    if (W >= 80)
      fields.push(
        [63, 4.8, 70, 10.2],
        [72, 4.8, 80, 10.2],
        [62, 40, 70, 46],
        [72, 40, 80, 47],
      );
    const clear = [L.t3, L.t4].flatMap((T) => (T ? [T.building.box, [T.garage[0] - 1, T.garage[1] - 1, T.garage[2] + 1, T.garage[3] + 1] as const] : []));
    if (L.hotel) clear.push([L.hotel.box[0] - 1.5, L.hotel.box[1] - 1, L.hotel.box[2] + 1, L.hotel.box[3] + 1.5]);
    fields.forEach((f, i) => {
      if (clear.some((b) => f[0] < b[2] && f[2] > b[0] && f[1] < b[3] + 1.5 && f[3] > b[1] - 1.5)) return;
      drawField(g, f[0], f[1], f[2], f[3], i);
    });
    g.mask(blur(6));
    g.ellipse(39.5, 31.6, 3.5, 2.5, 'rgba(60,120,80,0.35)');
    g.mask(null);
    g.ellipse(39.5, 31.5, 3.2, 2.2, '#4fb3d9');
    g.ellipse(39.3, 31.3, 2.6, 1.7, '#6cc8ea');
    g.ellipse(38.5, 30.8, 1.0, 0.45, '#b6e8fa');

    // the airfield: mowing stripes along the runway
    c.save();
    c.clipPath(diamondPath(F.x0, F.y0, F.x1, F.y1), ClipOp.Intersect, true);
    g.f.setColor(Skia.Color(STRIPE_A));
    c.drawPath(diamondPath(F.x0, F.y0, F.x1, F.y1), g.f);
    for (let y = F.y0; y < F.y1; y += 2.4) g.rect(F.x0, y, F.x1, Math.min(F.y1, y + 1.2), STRIPE_B);
    c.restore();

    // a few flowers outside the field
    const dotColors = ['#ffffff', '#fde047', '#f9a8d4'];
    const dots = dotColors.map(() => Skia.PathBuilder.Make());
    for (let i = 0; i < 260; i++) {
      const x = hash01(i * 3 + 1) * W;
      const y = hash01(i * 3 + 2) * H;
      if (x > F.x0 && x < F.x1 && y > F.y0 && y < F.y1) continue;
      const k = hash01(i * 3 + 3);
      dots[k < 0.4 ? 0 : k < 0.75 ? 1 : 2].addCircle(isoX(x, y), isoY(x, y), 1.7);
    }
    dotColors.forEach((col, i) => {
      g.f.setColor(Skia.Color(col));
      c.drawPath(dots[i].build(), g.f);
    });

    // road and parking (asphalt with a soft shadow)
    const road: number[] = [];
    for (const p of L.road) road.push(p[0], p[1], 0);
    g.mask(blur(4));
    ribbon(g, road, 1.25, 'rgba(40,70,50,0.25)');
    g.mask(null);
    ribbon(g, road, 1.05, '#a7b0bb');
    // road paint: solid edge lines, a dashed center line, a zebra crossing by the terminal
    for (const side of [-0.43, 0.43]) {
      const edgeLine = offsetLine(L.road, side);
      for (let i = 1; i < edgeLine.length; i++) g.line(edgeLine[i - 1][0], edgeLine[i - 1][1], edgeLine[i][0], edgeLine[i][1], 'rgba(255,255,255,0.8)', 1.2);
    }
    dashes(g, L.road, 0.32, 0.36, '#f8fafc', 1.6);
    const cross = roadPointAtY(L.road, crossingY(L));
    if (cross) {
      for (let k = -3; k <= 3; k++) {
        const x = cross[0] + k * 0.13;
        g.rect(x - 0.04, cross[1] - 0.22, x + 0.04, cross[1] + 0.22, '#f8fafc');
      }
    }
    const P = L.parking;
    g.mask(blur(4));
    g.rect(P.x0 - 0.1, P.y0 - 0.1, P.x1 + 0.1, P.y1 + 0.1, 'rgba(40,70,50,0.25)');
    g.mask(null);
    g.rect(P.x0, P.y0, P.x1, P.y1, '#a7b0bb');
    for (let x = P.x0 + 0.65; x < P.x1; x += 0.65) {
      g.line(x, P.y0 + 0.12, x, P.y0 + 0.9, '#f1f5f9', 2);
      g.line(x, P.y1 - 0.9, x, P.y1 - 0.12, '#f1f5f9', 2);
    }
    // driving arrows down the middle aisle
    for (let x = P.x0 + 0.5; x < P.x1 - 0.3; x += 0.9) {
      const ym = (P.y0 + P.y1) / 2;
      g.line(x, ym, x + 0.28, ym, '#e2e8f0', 1.6);
      g.line(x + 0.28, ym, x + 0.18, ym - 0.07, '#e2e8f0', 1.6);
      g.line(x + 0.28, ym, x + 0.18, ym + 0.07, '#e2e8f0', 1.6);
    }

    // terminal plaza: paving under check-in and security, rope posts along the queues
    const T = L.terminal;
    const xs0 = Math.min(...T.counters.map((c) => c[0]), ...T.lanes.map((c) => c[0])) - 0.6;
    const xs1 = Math.max(...T.checkinQueue.map((c) => c[0])) + 0.5;
    const ys0 = Math.min(...T.checkinQueue.map((c) => c[1])) - 0.5;
    const ys1 = Math.max(...T.lanes.map((c) => c[1])) + 0.2;
    if (L.building) paintBuildingFloor(g, L.building, blur);
    else {
      g.mask(blur(4));
      g.rect(xs0 - 0.1, ys0 - 0.1, xs1 + 0.1, ys1 + 0.1, 'rgba(60,80,90,0.25)');
      g.mask(null);
      g.rect(xs0, ys0, xs1, ys1, '#e2e8f0');
      for (let x = Math.ceil(xs0); x < xs1; x++) g.line(x, ys0, x, ys1, '#cbd5e1', 1);
      for (let y = Math.ceil(ys0); y < ys1; y++) g.line(xs0, y, xs1, y, '#cbd5e1', 1);
    }
    paintQueueRopes(g, [T.checkinQueue, T.securityQueue]);
    // the bag conveyor (drawn in 3D with the world): its shadow
    paintBeltShadow(g, T.belt);
    // Terminal 3: its road and curb, the floors, the belt, three carousels and the queue lines
    if (L.t3) paintT3(g, L.t3, blur);
    if (L.t4) paintT3(g, L.t4, blur);
    // the baggage carousel (drawn in 3D with the world): its floor ring
    paintCarousel(g, T.claim);

    // apron: light gravel with a soft edge, under the hut front and every stand
    const xs = L.stands.map((st) => st.pos[0]);
    const ax0 = Math.min(L.hut[0] - 0.8, ...xs) - 1.2;
    const ax1 = Math.max(...xs) + 2.6;
    const ay0 = L.building ? L.building.box[3] : L.hut[1] + 1.25;
    const ay1 = Math.max(...L.stands.map((st) => st.pos[1])) + 1.1;
    const apron = [ax0, ay0, ax1, ay0, ax1 + 0.3, ay1, ax0 + 0.2, ay1];
    g.mask(blur(5));
    g.poly(apron, 'rgba(120,100,60,0.35)');
    g.mask(null);
    g.poly(apron, GRAVEL);
    // concrete in front of the bigger buildings, out to the stand lane
    for (const bd of L.buildings ?? []) {
      if (bd.kind === 'helipad' || bd.kind === 'vertipad' || (bd.kind === 'hangar' && hangarBays === 0)) continue;
      g.rect(bd.pos[0] - 0.6, bd.pos[1] + bd.size[1] - 0.3, bd.pos[0] + bd.size[0] + 0.6, ay1, GRAVEL);
    }
    // the hangar apron: concrete slabs with yellow lead-in lines into each open door
    if (hangarBays > 0) {
      const hb = (L.buildings ?? []).find((b) => b.kind === 'hangar')!;
      g.rect(hb.pos[0] - 0.3, hb.pos[1] + hb.size[1], hb.pos[0] + hb.size[0] + 0.3, hb.pos[1] + hb.size[1] + 2.5, '#c9ced6');
      for (let x = hb.pos[0]; x < hb.pos[0] + hb.size[0]; x += 1.03) g.line(x, hb.pos[1] + hb.size[1], x, hb.pos[1] + hb.size[1] + 2.5, 'rgba(100,116,139,0.35)', 1);
      L.stands.forEach((st, i) => {
        if (!st.hangar || !open[i]) return;
        g.line(st.pos[0], hb.pos[1] + hb.size[1] - 0.05, st.pos[0], st.pos[1] + 0.9, '#facc15', 2.6);
      });
    }
    // the supply area: a concrete yard inside the gate, the service road outside
    if (L.depot) {
      const D = L.depot;
      g.rect(D.farm[0] - 1.55, D.farm[1] - 1.05, tier >= 3 ? D.store[0] + 1.25 : D.fuelBay[0] + 0.9, D.farm[1] + 1.25, '#d4d8de');
      // the fire station's forecourt with red-and-white bay markings
      const FS = D.fire.station;
      g.rect(FS[0] - 0.15, FS[1] - 0.1, FS[0] + 1.85, FS[1] + 2.1, '#cfd4db');
      for (const x0 of [FS[0] + 0.12, FS[0] + 0.9]) {
        g.line(x0, FS[1] + 1.35, x0, FS[1] + 2.05, '#dc2626', 2);
        g.line(x0 + 0.68, FS[1] + 1.35, x0 + 0.68, FS[1] + 2.05, '#dc2626', 2);
      }
      g.line(FS[0] + 0.1, FS[1] + 2.0, FS[0] + 1.6, FS[1] + 2.0, '#f8fafc', 1.6);
      const road: number[] = [];
      for (const p of D.serviceRoad) road.push(p[0], p[1], 0);
      road.push(D.gate[0], D.gate[1], 0, D.gate[0], D.gate[1] + 0.6, 0);
      const smooth = chaikin(road, 2);
      ribbon(g, smooth, 0.74, '#4b5563');
      ribbon(g, smooth, 0.62, '#6b7280');
      // dashed center line on the service road
      for (let k = 0; k + 1 < D.serviceRoad.length; k++) {
        const [ax, ay] = D.serviceRoad[k];
        const [bx, by] = D.serviceRoad[k + 1];
        const n = Math.floor(Math.hypot(bx - ax, by - ay) / 0.5);
        for (let i = 0; i < n; i += 2) g.line(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, ax + ((bx - ax) * (i + 0.8)) / n, ay + ((by - ay) * (i + 0.8)) / n, '#e2e8f0', 1);
      }
      // painted bays for the tanker and the van, a stop line at the gate
      g.ellipse(D.fuelBay[0], D.fuelBay[1], 0.42, 0.42, 'rgba(250,204,21,0.25)');
      g.line(D.gate[0] - 0.32, D.gate[1] + 0.05, D.gate[0] + 0.32, D.gate[1] + 0.05, '#f8fafc', 2);
    }

    // the hub: Concourse D's floors, the people mover's guideway, the railway and its station
    if (L.sat) {
      paintBuildingFloor(g, L.sat.building, blur);
      paintApm(g, L.sat, blur);
    }
    if (L.rail) paintRail(g, L.rail, blur);
    // the hotel's forecourt: paving, a fountain pool, flower beds
    if (L.hotel) {
      const H = L.hotel.box;
      g.mask(blur(5));
      g.rect(H[0] - 0.2, H[1] - 0.2, H[2] + 0.3, H[3] + 0.3, 'rgba(40,60,70,0.3)');
      g.mask(null);
      g.rect(H[0] - 0.3, H[3], H[2] + 0.3, H[3] + 0.7, '#e7e5e4');
      for (let x = H[0] - 0.3; x < H[2] + 0.3; x += 0.5) g.line(x, H[3], x, H[3] + 0.7, '#d6d3d1', 1);
      g.ellipse(H[0] + 1.2, H[3] + 0.35, 0.42, 0.24, '#7dd3fc');
      g.ellipse(H[0] + 1.2, H[3] + 0.35, 0.2, 0.11, '#e0f2fe');
      for (const fx of [H[0] + 2.4, H[0] + 3.2]) g.ellipse(fx, H[3] + 0.35, 0.28, 0.16, '#f472b6');
    }

    // taxi tracks and the runway: smooth dirt with a darker rim and a lighter worn center
    const gr = graphOf(tier);
    const tracks: number[][] = [routeLineUp(L)];
    for (const chain of taxiChains(gr)) tracks.push(routeGeometry(gr, chain).path);
    L.stands.forEach((st, i) => {
      if (!open[i] || !st.from) return;
      const sn = gr.standNode[i];
      const inE = gr.out[gr.ids.indexOf(st.from)].find((e) => gr.edges[e].to === sn);
      const outE = gr.out[sn][0];
      if (inE !== undefined && outE !== undefined) tracks.push(routeGeometry(gr, [inE, outE]).path);
    });
    const R = L.runway;
    const hw = R.width / 2;
    if (R.surface === 'asphalt') {
      // asphalt: dark runway with white markings, taxiways with a yellow centerline
      for (const path of tracks) ribbon(g, path, 0.92, '#4b5563');
      g.rect(R.x0 - 0.3, R.y - hw - 0.12, R.x1 + 0.3, R.y + hw + 0.12, '#4b5563');
      for (const path of tracks) ribbon(g, path, 0.76, '#6b7280');
      g.rect(R.x0 - 0.2, R.y - hw, R.x1 + 0.2, R.y + hw, '#5b6472');
      for (const path of tracks) {
        const c = Skia.PathBuilder.Make();
        for (let i = 0; i < path.length; i += 3) {
          const x = isoX(path[i], path[i + 1]);
          const y = isoY(path[i], path[i + 1]);
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        g.s.setColor(Skia.Color('#fbbf24'));
        g.s.setStrokeWidth(1.8);
        c2(g, c);
      }
      g.line(R.x0, R.y - hw + 0.08, R.x1, R.y - hw + 0.08, '#e5e7eb', 1.6);
      g.line(R.x0, R.y + hw - 0.08, R.x1, R.y + hw - 0.08, '#e5e7eb', 1.6);
      for (let k = -3; k <= 3; k++) g.line(R.x0 + 0.3, R.y + k * 0.2, R.x0 + 1.3, R.y + k * 0.2, '#ffffff', 3.2);
      for (let k = -3; k <= 3; k++) g.line(R.x1 - 1.3, R.y + k * 0.2, R.x1 - 0.3, R.y + k * 0.2, '#ffffff', 3.2);
      for (let x = R.x0 + 2; x < R.x1 - 1.5; x += 1.2) g.line(x, R.y, x + 0.6, R.y, '#ffffff', 2.4);
      // touchdown zone bars after the threshold
      for (let k = 0; k < 3; k++) for (const side of [-1, 1]) g.rect(R.x0 + 3 + k * 1.1, R.y + side * hw * 0.45 - 0.07, R.x0 + 3.6 + k * 1.1, R.y + side * hw * 0.45 + 0.07, '#ffffff');
      const D = L.depRunway;
      if (D) {
        const dh = D.width / 2;
        g.rect(D.x0 - 0.3, D.y - dh - 0.12, D.x1 + 0.3, D.y + dh + 0.12, '#4b5563');
        g.rect(D.x0 - 0.2, D.y - dh, D.x1 + 0.2, D.y + dh, '#5b6472');
        g.line(D.x0, D.y - dh + 0.08, D.x1, D.y - dh + 0.08, '#e5e7eb', 1.6);
        g.line(D.x0, D.y + dh - 0.08, D.x1, D.y + dh - 0.08, '#e5e7eb', 1.6);
        for (let k = -3; k <= 3; k++) g.line(D.x0 + 0.3, D.y + k * 0.2, D.x0 + 1.3, D.y + k * 0.2, '#ffffff', 3.2);
        for (let x = D.x0 + 2; x < D.x1 - 1.5; x += 1.2) g.line(x, D.y, x + 0.6, D.y, '#ffffff', 2.4);
      }
    } else {
      for (const path of tracks) ribbon(g, path, 0.86, DIRT_EDGE);
      g.rect(R.x0 - 0.3, R.y - hw - 0.14, R.x1 + 0.3, R.y + hw + 0.14, DIRT_EDGE);
      for (const path of tracks) ribbon(g, path, 0.7, DIRT);
      g.rect(R.x0 - 0.18, R.y - hw, R.x1 + 0.18, R.y + hw, DIRT);
      g.mask(blur(5));
      g.rect(R.x0 + 0.2, R.y - 0.22, R.x1 - 0.2, R.y + 0.22, DIRT_LIGHT);
      g.mask(null);
      for (let k = -2; k <= 2; k++) g.line(R.x0 + 0.3, R.y + k * 0.22, R.x0 + 1.0, R.y + k * 0.22, '#ffffff', 3.4);
      for (let x = R.x0 + 1.8; x < R.x1 - 0.8; x += 1.4) g.line(x, R.y, x + 0.7, R.y, 'rgba(255,255,255,0.75)', 2.2);
    }
    // edge lights: small white dots with soft shadows
    const lightsShadow = Skia.PathBuilder.Make();
    const lights = Skia.PathBuilder.Make();
    for (const RR of [R, L.depRunway]) {
      if (!RR) continue;
      const h2 = RR.width / 2;
      for (let x = RR.x0; x <= RR.x1 + 0.01; x += 1.5) {
        for (const side of [-1, 1]) {
          const sx = isoX(x, RR.y + side * (h2 + 0.08));
          const sy = isoY(x, RR.y + side * (h2 + 0.08));
          lightsShadow.addOval(Skia.XYWHRect(sx - 3.5, sy - 1, 8, 4));
          lights.addCircle(sx, sy - 1.5, 2.6);
        }
      }
    }
    g.f.setColor(Skia.Color('rgba(60,40,20,0.3)'));
    c.drawPath(lightsShadow.build(), g.f);
    g.f.setColor(Skia.Color('#ffffff'));
    c.drawPath(lights.build(), g.f);

    // stands: a painted ring with a lead-in line; future stands are dashed plots
    for (const bd of L.buildings ?? []) {
      if (bd.kind !== 'helipad') continue;
      const cx = bd.pos[0] + bd.size[0] / 2;
      const cy = bd.pos[1] + bd.size[1] / 2;
      g.rect(bd.pos[0], bd.pos[1], bd.pos[0] + bd.size[0], bd.pos[1] + bd.size[1], '#94a3b8');
      g.ellipse(cx, cy, 0.66, 0.66, '#f8fafc');
      g.ellipse(cx, cy, 0.56, 0.56, '#64748b');
      g.line(cx - 0.2, cy - 0.25, cx - 0.2, cy + 0.25, '#f8fafc', 3);
      g.line(cx + 0.2, cy - 0.25, cx + 0.2, cy + 0.25, '#f8fafc', 3);
      g.line(cx - 0.2, cy, cx + 0.2, cy, '#f8fafc', 3);
    }
    // the vertiport: dark pads with a cyan ring of lights and a V, a walkway to the old helipad
    for (const bd of L.buildings ?? []) {
      if (bd.kind !== 'vertipad') continue;
      const cx = bd.pos[0] + bd.size[0] / 2;
      const cy = bd.pos[1] + bd.size[1] / 2;
      g.rect(bd.pos[0], bd.pos[1], bd.pos[0] + bd.size[0], bd.pos[1] + bd.size[1], '#475569');
      g.ellipse(cx, cy, 0.66, 0.66, '#22d3ee');
      g.ellipse(cx, cy, 0.6, 0.6, '#334155');
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        g.ellipse(cx + Math.cos(a) * 0.63, cy + Math.sin(a) * 0.63, 0.04, 0.04, '#ecfeff');
      }
      g.line(cx - 0.22, cy - 0.25, cx, cy + 0.25, '#f8fafc', 3);
      g.line(cx + 0.22, cy - 0.25, cx, cy + 0.25, '#f8fafc', 3);
    }
    L.stands.forEach((st, i) => {
      if (st.size === 'heli') return; // the helipad is a building
      const r = RING[st.size] ?? 0.78;
      if (open[i]) {
        g.ellipse(st.pos[0], st.pos[1], r, r, '#ffffff');
        g.ellipse(st.pos[0], st.pos[1], r - 0.12, r - 0.12, GRAVEL);
        g.line(st.pos[0] + r * 0.7, st.pos[1] + r, st.pos[0] - r * 0.45, st.pos[1] - r * 0.7, '#fbbf24', 3.4);
        // (the small details: a white stop bar across the lead-in where the nose wheel stops, and for
        // the airliners' stands a red dashed line round the stand that ground vehicles must not cross)
        const bx = st.pos[0] - r * 0.45;
        const by = st.pos[1] - r * 0.7;
        const nx = 1.7 / Math.hypot(1.7, 1.15);
        const ny = -1.15 / Math.hypot(1.7, 1.15);
        g.line(bx - nx * 0.2, by - ny * 0.2, bx + nx * 0.2, by + ny * 0.2, '#ffffff', 3);
        if (st.size !== 'small') {
          const rr = r + 0.16;
          for (let k = 0; k < 44; k += 2) {
            const a0 = (k / 44) * Math.PI * 2;
            const a1 = ((k + 1) / 44) * Math.PI * 2;
            g.line(st.pos[0] + Math.cos(a0) * rr, st.pos[1] + Math.sin(a0) * rr, st.pos[0] + Math.cos(a1) * rr, st.pos[1] + Math.sin(a1) * rr, 'rgba(220,38,38,0.55)', 1.1);
          }
        }
      } else {
        for (let k = 0; k < 16; k += 2) {
          const a0 = (k / 16) * Math.PI * 2;
          const a1 = ((k + 1) / 16) * Math.PI * 2;
          g.line(st.pos[0] + Math.cos(a0) * r, st.pos[1] + Math.sin(a0) * r, st.pos[0] + Math.cos(a1) * r, st.pos[1] + Math.sin(a1) * r, 'rgba(100,116,139,0.55)', 2.4);
        }
      }
    });

    // fence: slim light posts and rails, with a gate for the road
    const sides: [number, number, number, number][] = [
      [F.x0, F.y0, F.x1, F.y0],
      [F.x1, F.y0, F.x1, F.y1],
      [F.x1, F.y1, F.x0, F.y1],
      [F.x0, F.y1, F.x0, F.y0],
    ];
    const rails = Skia.PathBuilder.Make();
    const posts = Skia.PathBuilder.Make();
    const wire = Skia.PathBuilder.Make();
    const sensors: [number, number, number][] = [];
    // along the landside the terminal, the road and the parking lot are the boundary: no fence there
    const TL = L.terminal;
    const landX0 = Math.min(...TL.counters.map((q) => q[0]), ...TL.lanes.map((q) => q[0]), ...TL.belt.map((q) => q[0])) - 0.9;
    const landX1 = L.parking.x1 + 0.15;
    for (const [ax, ay, bx, by] of sides) {
      const n = Math.round(Math.hypot(bx - ax, by - ay));
      for (let i = 0; i < n; i++) {
        const x0 = ax + ((bx - ax) * i) / n;
        const y0 = ay + ((by - ay) * i) / n;
        const x1 = ax + ((bx - ax) * (i + 1)) / n;
        const y1 = ay + ((by - ay) * (i + 1)) / n;
        const onNorth = Math.abs(y0 - F.y0) < 0.01 && Math.abs(y1 - F.y0) < 0.01;
        const depotGate = !!L.depot && onNorth && Math.min(x0, x1) < L.depot.gate[0] + 0.45 && Math.max(x0, x1) > L.depot.gate[0] - 0.45;
        const gate = depotGate || (onNorth && Math.min(x0, x1) < landX1 && Math.max(x0, x1) > landX0);
        // (no fence through a terminal building)
        const inBuilding = [L.building?.box, L.t3?.building.box, L.t4?.building.box].some((b) => !!b && (x0 + x1) / 2 > b[0] - 0.2 && (x0 + x1) / 2 < b[2] + 0.2 && (y0 + y1) / 2 > b[1] - 0.2 && (y0 + y1) / 2 < b[3] + 0.2);
        if (gate || inBuilding) continue;
        // (the security fence grows: taller with more wires, then barbed wire on top, then sensors)
        const railsZ = fenceLevel >= 1 ? [0.46, 0.34, 0.22, 0.1] : [0.24, 0.13];
        for (const z of railsZ) {
          rails.moveTo(isoX(x0, y0), isoY(x0, y0, z));
          rails.lineTo(isoX(x1, y1), isoY(x1, y1, z));
        }
        const top = fenceLevel >= 1 ? 0.56 : 0.32;
        posts.moveTo(isoX(x0, y0), isoY(x0, y0));
        posts.lineTo(isoX(x0, y0), isoY(x0, y0, top));
        if (fenceLevel >= 2) {
          // barbed wire: a zigzag along the top
          const k = 6;
          wire.moveTo(isoX(x0, y0), isoY(x0, y0, top));
          for (let j = 1; j <= k; j++) {
            const t = j / k;
            wire.lineTo(isoX(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), isoY(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, top + (j % 2 ? 0.05 : 0)));
          }
        }
        if (fenceLevel >= 3 && i % 3 === 0) sensors.push([x0, y0, top]);
      }
    }
    g.s.setColor(Skia.Color(fenceLevel >= 1 ? '#cbd5e1' : '#f1e6d2'));
    g.s.setStrokeWidth(fenceLevel >= 1 ? 1.1 : 1.4);
    c.drawPath(rails.build(), g.s);
    g.s.setColor(Skia.Color(fenceLevel >= 1 ? '#64748b' : '#c8b08a'));
    g.s.setStrokeWidth(2.4);
    c.drawPath(posts.build(), g.s);
    if (fenceLevel >= 2) {
      g.s.setColor(Skia.Color('#94a3b8'));
      g.s.setStrokeWidth(1);
      c.drawPath(wire.build(), g.s);
    }
    // the smart fence's sensor boxes, with a green light each
    for (const [x, y, z] of sensors) {
      g.f.setColor(Skia.Color('#1e293b'));
      c.drawRect(Skia.XYWHRect(isoX(x, y) - 2, isoY(x, y, z - 0.08) - 2, 4, 4), g.f);
      g.f.setColor(Skia.Color('#22c55e'));
      c.drawCircle(isoX(x, y), isoY(x, y, z - 0.08) - 3, 1.2, g.f);
    }
    // stand numbers painted next to each built stand
    L.stands.forEach((st, i) => {
      if (open[i] && st.size !== 'heli' && !st.hangar) paintText(c, String(i + 1), st.pos[0] + (RING[st.size] ?? 0.78) + 0.17, st.pos[1] - 0.55, '#facc15', 0.028);
    });
  };
  const picture = recordPicture(minX, minY, maxX - minX, maxY - minY, (c: SkCanvas) => paintGround(c, false));
  const crisp = recordPicture(minX, minY, maxX - minX, maxY - minY, (c: SkCanvas) => paintGround(c, true));

  // small props: lamps, signs, trolleys, planters, and cones around plots still to be built
  const prop = (sprite: number, x: number, y: number, d = 0, r = 50) => statics.push({ sprite, x: isoX(x, y), y: isoY(x, y), depth: x + y + d, r });
  const PK = L.parking;
  for (const [x, y] of [[PK.x0 - 0.12, PK.y0 - 0.12], [PK.x1 + 0.12, PK.y0 - 0.12], [PK.x1 + 0.12, PK.y1 + 0.12]] as const) prop(sprites.lamp, x, y);
  prop(sprites.parkSign, PK.x1 + 0.3, PK.y0 + 0.25);
  for (const d of [3.5, 7.5, 11.5, 15.5]) {
    const at = pointAlong(L.road, d, 0.75);
    if (at) prop(sprites.lamp, at[0], at[1]);
  }
  prop(sprites.trolleys, PK.x0 + 0.95, PK.y0 - 0.32, 0.2);
  prop(sprites.planter(0), 18.6, 12.25);
  prop(sprites.planter(1), 20.4, 12.25);
  const T0 = L.taxi.nodes;
  if (T0.H) prop(sprites.taxiSign, T0.H[0] - 0.55, T0.H[1] - 0.75, 0.1);
  if (T0.E) prop(sprites.taxiSign, T0.E[0] + 0.7, T0.E[1] - 1.2, 0.1);
  L.stands.forEach((st, i) => {
    if (open[i]) return;
    const r = RING[st.size] ?? 0.78;
    for (const [dx, dy] of [[-1, -0.65], [1, -0.65], [-1, 0.8], [1, 0.8]]) prop(sprites.cone, st.pos[0] + dx * r, st.pos[1] + dy * r, 0, 20);
  });

  // bigger airports: lounge, pier (in sections so planes in front sort right), cargo shed, jet bridges
  for (const bd of L.buildings ?? []) {
    const [bx, by] = bd.pos;
    if (bd.kind === 'fbo') prop(sprites.fbo, bx, by, bd.size[0] + bd.size[1], 160);
    if (bd.kind === 'cargo') prop(sprites.cargoShed, bx, by, bd.size[0] + bd.size[1], 200);
    if (bd.kind === 'pier' && !L.t3) {
      const n = Math.round(bd.size[0] / 2.15);
      for (let k = 0; k < n; k++) prop(sprites.pier(k === n - 1), bx + k * 2.15, by, 2.15 * 0.5 + bd.size[1], 140);
    }
  }
  if (hangarBays > 0) {
    const hb = (L.buildings ?? []).find((b) => b.kind === 'hangar')!;
    prop(sprites.hangar(hangarBays), hb.pos[0], hb.pos[1], hb.size[0] * 0.5 + hb.size[1], 260);
  }
  // the supply area: fuel farm (more tanks as it grows), parts store (regional on), gate booth
  if (L.depot) {
    const D = L.depot;
    const tanks = [1, 2, 2, 3, 3, 4][Math.max(0, Math.min(5, farmLevel))];
    prop(sprites.fuelFarm(tanks), D.farm[0], D.farm[1], 0.2, 120);
    if (tier >= 3) prop(sprites.partsStore, D.store[0], D.store[1], 0.4, 100);
    prop(sprites.gateBooth, D.gate[0] + 0.5, D.gate[1] + 0.12, 0.3, 40);
    prop(sprites.fireStation, D.fire.station[0], D.fire.station[1], 1.7 + 1.3, 90);
  }
  L.stands.forEach((st, i) => {
    if (!open[i] || !st.bridge) return;
    const pier = pierOf(L, i);
    if (!pier) return;
    const gx = st.pos[0] - 0.3;
    const gy = pier.pos[1] + pier.size[1] - 0.05;
    prop(sprites.jetBridge, gx, gy, BRIDGE_LEN, 120);
  });

  // static sprites with depth: buildings and trees
  const T2 = L.terminal;
  T2.counters.slice(0, counters).forEach((c) => statics.push({ sprite: sprites.desk, x: isoX(c[0] - 0.3, c[1] - 0.45), y: isoY(c[0] - 0.3, c[1] - 0.45), depth: c[0] + c[1] - 0.4, r: 40 }));
  T2.lanes.slice(0, lanes).forEach((c) => statics.push({ sprite: sprites.scannerV(scanV), x: isoX(c[0], c[1]), y: isoY(c[0], c[1]), depth: c[0] + c[1], r: 40 }));
  for (const T3 of [L.t3, L.t4]) {
    if (!T3) continue;
    buildingStatics(T3.building, sprites, statics, tier);
    const st = T3.st;
    const n3 = Math.min(st.counters.length, counters * 2);
    st.counters.slice(0, n3).forEach((c) => statics.push({ sprite: sprites.desk, x: isoX(c[0] - 0.3, c[1] - 0.45), y: isoY(c[0] - 0.3, c[1] - 0.45), depth: c[0] + c[1] - 0.4, r: 40 }));
    st.lanes.slice(0, Math.min(st.lanes.length, lanes * 2)).forEach((c) => statics.push({ sprite: sprites.scannerV(scanV), x: isoX(c[0], c[1]), y: isoY(c[0], c[1]), depth: c[0] + c[1], r: 40 }));
    for (const b of [...(st.passport?.booths ?? []), ...(st.arrPassport?.booths ?? [])]) statics.push({ sprite: sprites.termProp('booth'), x: isoX(b[0] - 0.22, b[1] - 0.15), y: isoY(b[0] - 0.22, b[1] - 0.15), depth: b[0] + b[1] + 0.1, r: 40 });
    const G = T3.garage;
    statics.push({ sprite: sprites.garage, x: isoX(G[0], G[1]), y: isoY(G[0], G[1]), depth: G[0] + G[1] + 3.6, r: 260 });
    const bx = T3.building.box[0] + 6.2;
    const by = T3.building.box[1] - 1.6;
    statics.push({ sprite: sprites.busStop, x: isoX(bx, by), y: isoY(bx, by), depth: bx + by + 0.35, r: 60 });
  }
  if (L.sat) buildingStatics(L.sat.building, sprites, statics, tier);
  if (L.hotel) {
    const H = L.hotel.box;
    statics.push({ sprite: sprites.hotel, x: isoX(H[0], H[1]), y: isoY(H[0], H[1]), depth: H[0] + H[1] + 5.4, r: 320 });
  }
  if (L.rail) {
    const r = L.rail;
    const at = (sprite: number, x: number, y: number, depth: number, rr = 120) => statics.push({ sprite, x: isoX(x, y), y: isoY(x, y), depth, r: rr });
    at(sprites.tunnelPortal(true), r.portals[0], r.y, r.portals[0] + r.y + 1.0, 200);
    at(sprites.tunnelPortal(false), r.portals[1], r.y, r.portals[1] + r.y + 1.0, 200);
    // the platform roof in short pieces, posts every other piece
    const P = r.platform;
    let k = 0;
    for (let x = P[0]; x < P[2] - 0.3; x += ROOF_SEG, k++) at(sprites.platformRoof(k % 2 === 0), x, (P[1] + P[3]) / 2, x + ROOF_SEG / 2 + P[3] + 0.3, 100);
    at(sprites.stationHall, r.hall[0], r.hall[1], r.hall[0] + 0.6 + r.hall[1] + 0.4, 100);
  }
  if (L.building) {
    buildingStatics(L.building, sprites, statics, tier);
    towerAt = towerSpotOf(L);
  } else if (L.runway.surface === 'asphalt') {
    statics.push({ sprite: sprites.terminal, x: isoX(L.hut[0], L.hut[1]), y: isoY(L.hut[0], L.hut[1]), depth: L.hut[0] + 1.3 + L.hut[1] + 0.75, r: 160 });
    towerAt = towerSpotOf(L);
  } else {
    statics.push({ sprite: sprites.hut, x: isoX(L.hut[0], L.hut[1]), y: isoY(L.hut[0], L.hut[1]), depth: L.hut[0] + 1 + L.hut[1] + 0.7, r: 120 });
  }
  statics.push({ sprite: sprites.pump, x: isoX(L.pump[0], L.pump[1]), y: isoY(L.pump[0], L.pump[1]), depth: L.pump[0] + L.pump[1] + 0.9, r: 60 });

  // keep trees off the terminal plaza, the bag belt and the claim area
  const TT = L.terminal;
  const BB = L.building?.box;
  const px0 = Math.min(...TT.counters.map((c) => c[0]), ...TT.lanes.map((c) => c[0]), ...TT.belt.map((c) => c[0]), BB ? BB[0] - 1.6 : 99) - 1.2;
  const px1 = Math.max(...TT.checkinQueue.map((c) => c[0]), BB ? BB[2] : 0) + 1.2;
  const py0 = Math.min(...TT.checkinQueue.map((c) => c[1]), BB ? BB[1] : 99) - 1.2;
  const py1 = Math.max(TT.claim[1], BB ? BB[3] : 0) + 1;
  // (and off the weather station's square)
  const met = meteoSpotOf(L);
  const treeAt = (x: number, y: number, seed: number) => {
    if (x > px0 && x < px1 && y > py0 && y < py1) return;
    if (met && x > met[0] - 0.9 && x < met[0] + 2 && y > met[1] - 0.9 && y < met[1] + 2) return;
    for (const T of [L.t3, L.t4]) if (T && x > Math.min(T.building.box[0], T.garage[0]) - 2 && x < Math.max(T.building.box[2], T.garage[2]) + 3.2 && y > T.garage[1] - 1.5 && y < T.building.box[3] + 0.5) return;
    if (L.rail && y < L.rail.y + 1.6 && y > L.rail.y - 1.4 && x > L.rail.portals[0] - 2 && x < L.rail.portals[1] + 2) return;
    if (L.rail && x > L.rail.platform[0] - 1 && x < L.rail.platform[2] + 1 && y < 7.6) return;
    if (L.hotel && x > L.hotel.box[0] - 1.2 && x < L.hotel.box[2] + 1.2 && y > L.hotel.box[1] - 1.2 && y < L.hotel.box[3] + 1.4) return;
    for (const T of [L.t3, L.t4]) if (T && T.road.some((p, i) => i > 0 && segDist(x, y, T.road[i - 1], p) < 1.1)) return;
    const kind = Math.floor(hash01(seed * 5 + 1) * TREE_KINDS.length);
    const size = Math.floor(hash01(seed * 5 + 2) * TREE_SIZES.length);
    statics.push({ sprite: sprites.tree(kind, size), x: isoX(x, y), y: isoY(x, y), depth: x + y, r: 110 });
  };
  // tree lines outside the fence, with gaps
  let seed = 1;
  for (let x = 2; x < W - 2; x += 1.3) {
    for (const y of [F.y0 - 1.6, F.y1 + 1.8]) {
      const jitter = (hash01(seed * 7) - 0.5) * 0.8;
      // (gaps for the main road and the service road to the supply gate)
      const roadGap = y < F.y0 && ((x > 20.5 && x < 24) || (!!L.depot && x > 21.5 && x < L.depot.gate[0] + 1));
      if (hash01(seed * 11) < 0.62 && !roadGap) treeAt(x + jitter, y + jitter * 0.6, seed);
      seed++;
    }
  }
  for (let y = 4; y < H - 3; y += 1.4) {
    for (const x of [F.x0 - 1.8, F.x1 + 1.8]) {
      const jitter = (hash01(seed * 7) - 0.5) * 0.8;
      if (hash01(seed * 11) < 0.55) treeAt(x + jitter * 0.6, y + jitter, seed);
      seed++;
    }
  }
  // a little grove near the hut
  if (L.runway.surface !== 'asphalt') treeAt(18.6, 17.9, 501);
  if (!L.depot || L.depot.farm[1] + 1.5 < 17.8) treeAt(28.4, 17.8, 503);
  // scattered trees in the countryside
  for (let i = 0; i < 70; i++) {
    const x = hash01(2000 + i) * W;
    const y = hash01(3000 + i) * H;
    if (x > F.x0 - 3 && x < F.x1 + 3 && y > F.y0 - 3 && y < F.y1 + 3) continue;
    if (Math.abs(x - 22) < 1.5 && y < F.y0) continue; // keep the road clear
    treeAt(x, y, 4000 + i);
  }

  // only tiles that touch the world diamond (|sx|/a + |sy-c|/b <= 1)
  const a = (W + H) * HALF_W * 0.5 + 64;
  const cy = isoY(W / 2, H / 2);
  const b = (W + H) * HALF_H * 0.5 + 64;
  const tiles = rasterizeGround(picture, minX, minY, maxX - minX, maxY - minY, 512, 1, (tx, ty, size) => {
    const dx = tx > 0 ? tx : tx + size < 0 ? -(tx + size) : 0;
    const dy = ty > cy ? ty - cy : ty + size < cy ? cy - (ty + size) : 0;
    return dx / a + dy / b <= 1;
  });
  return {
    picture,
    tiles,
    crisp,
    statics,
    bounds: { x0: isoX(0, H) * 0.7, y0: isoY(0, 0) + 200, x1: isoX(W, 0) * 0.7, y1: isoY(W, H) - 300 },
    windsock: { x: L.windsock[0], y: L.windsock[1] },
    tower: towerAt,
  };
}
