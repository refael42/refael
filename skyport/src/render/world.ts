/**
 * Static world for a tier: the ground picture (recorded once) plus the list
 * of static sprites (buildings, trees) that need depth sorting with movers.
 */
import { BlurStyle, ClipOp, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';

import type { TierLayout } from '../data/tiers';
import { hash01 } from '../sim/hash';
import { findRoute, graphOf, routeGeometry } from '../sim/game/graph';
import { routeLineUp } from '../sim/game/layout';
import { GLYPHS } from './art/glyphs';
import { GroundPainter, rasterizeGround, recordPicture, type GroundTile } from './ground';
import { HALF_H, HALF_W, isoX, isoY } from './iso';
import { TREE_KINDS, TREE_SIZES, type SpriteSet } from './sprites';

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
  statics: StaticSprite[];
  /** World-screen bounds the camera center may move within. */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  /** Windsock sprite placement (animated). */
  windsock: { x: number; y: number };
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

export function buildWorld(L: TierLayout, sprites: SpriteSet, tier = 1, standsBuilt = 1, counters = 1, lanes = 1): World {
  const W = L.world.w;
  const H = L.world.h;
  const F = L.field;
  const statics: StaticSprite[] = [];
  const minX = isoX(0, H) - 64;
  const maxX = isoX(W, 0) + 64;
  const minY = isoY(0, 0) - 64;
  const maxY = isoY(W, H) + 64;

  const picture = recordPicture(minX, minY, maxX - minX, maxY - minY, (c: SkCanvas) => {
    const g = new GroundPainter(c);
    const blur = (r: number) => Skia.MaskFilter.MakeBlur(BlurStyle.Normal, r, true);

    // base grass and soft color patches (baked once, so blur is free at runtime)
    g.f.setColor(Skia.Color(GROUND_BASE));
    c.drawPath(diamondPath(-2, -2, W + 2, H + 2), g.f);
    g.f.setMaskFilter(blur(18));
    for (let i = 0; i < 90; i++) {
      const x = hash01(7000 + i) * W;
      const y = hash01(7100 + i) * H;
      const r = 1.5 + hash01(7200 + i) * 3.5;
      g.f.setColor(Skia.Color(hash01(7300 + i) < 0.5 ? PATCH_DARK : PATCH_LIGHT));
      g.f.setAlphaf(0.55);
      c.drawOval(Skia.XYWHRect(isoX(x, y) - r * 32, isoY(x, y) - r * 16, r * 64, r * 32), g.f);
    }
    g.f.setAlphaf(1);
    g.f.setMaskFilter(null);

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
    fields.forEach((f, i) => drawField(g, f[0], f[1], f[2], f[3], i));
    g.f.setMaskFilter(blur(6));
    g.ellipse(39.5, 31.6, 3.5, 2.5, 'rgba(60,120,80,0.35)');
    g.f.setMaskFilter(null);
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
    g.f.setMaskFilter(blur(4));
    ribbon(g, road, 1.25, 'rgba(40,70,50,0.25)');
    g.f.setMaskFilter(null);
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
    g.f.setMaskFilter(blur(4));
    g.rect(P.x0 - 0.1, P.y0 - 0.1, P.x1 + 0.1, P.y1 + 0.1, 'rgba(40,70,50,0.25)');
    g.f.setMaskFilter(null);
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
    g.f.setMaskFilter(blur(4));
    g.rect(xs0 - 0.1, ys0 - 0.1, xs1 + 0.1, ys1 + 0.1, 'rgba(60,80,90,0.25)');
    g.f.setMaskFilter(null);
    g.rect(xs0, ys0, xs1, ys1, '#e2e8f0');
    for (let x = Math.ceil(xs0); x < xs1; x++) g.line(x, ys0, x, ys1, '#cbd5e1', 1);
    for (let y = Math.ceil(ys0); y < ys1; y++) g.line(xs0, y, xs1, y, '#cbd5e1', 1);
    const rope = Skia.PathBuilder.Make();
    const postsP = Skia.PathBuilder.Make();
    // belt barriers along the long legs of each serpentine (rows 0.5 apart share
    // the divider); the ends stay open so the line can turn
    for (const line of [T.checkinQueue, T.securityQueue]) {
      for (let i = 1; i < line.length; i++) {
        const [ax, ay] = line[i - 1];
        const [bx, by] = line[i];
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 1) continue;
        const ux = (bx - ax) / len;
        const uy = (by - ay) / len;
        for (const side of [-0.25, 0.25]) {
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
    c.drawPath(postsP.build(), g.s);
    g.s.setColor(Skia.Color('#3b82f6'));
    g.s.setStrokeWidth(1.6);
    c.drawPath(rope.build(), g.s);
    // the bag conveyor
    const belt: number[] = [];
    for (const p of T.belt) belt.push(p[0], p[1], 0);
    ribbon(g, belt, 0.34, '#334155');
    ribbon(g, belt, 0.24, '#64748b');
    // baggage carousel
    g.ellipse(T.claim[0], T.claim[1], 0.62, 0.62, '#334155');
    g.ellipse(T.claim[0], T.claim[1], 0.52, 0.52, '#64748b');
    g.ellipse(T.claim[0], T.claim[1], 0.3, 0.3, '#cbd5e1');
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const bx = T.claim[0] + Math.cos(a) * 0.42;
      const by = T.claim[1] + Math.sin(a) * 0.42;
      g.f.setColor(Skia.Color(['#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9', '#ec4899'][k]));
      c.drawRect(Skia.XYWHRect(isoX(bx, by) - 3, isoY(bx, by) - 5, 6, 5), g.f);
    }

    // apron: light gravel with a soft edge, under the hut front and every stand
    const xs = L.stands.map((st) => st.pos[0]);
    const ax0 = Math.min(L.hut[0] - 0.8, ...xs) - 1.2;
    const ax1 = Math.max(...xs) + 2.6;
    const ay0 = L.hut[1] + 1.25;
    const ay1 = Math.max(...L.stands.map((st) => st.pos[1])) + 1.1;
    const apron = [ax0, ay0, ax1, ay0, ax1 + 0.3, ay1, ax0 + 0.2, ay1];
    g.f.setMaskFilter(blur(5));
    g.poly(apron, 'rgba(120,100,60,0.35)');
    g.f.setMaskFilter(null);
    g.poly(apron, GRAVEL);

    // taxi tracks and the runway: smooth dirt with a darker rim and a lighter worn center
    const gr = graphOf(tier);
    const main = findRoute(gr, gr.exit, gr.holdShort);
    const tracks: number[][] = [routeLineUp(L)];
    if (main) tracks.push(routeGeometry(gr, main).path);
    L.stands.forEach((st, i) => {
      if (i >= standsBuilt) return;
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
    } else {
      for (const path of tracks) ribbon(g, path, 0.86, DIRT_EDGE);
      g.rect(R.x0 - 0.3, R.y - hw - 0.14, R.x1 + 0.3, R.y + hw + 0.14, DIRT_EDGE);
      for (const path of tracks) ribbon(g, path, 0.7, DIRT);
      g.rect(R.x0 - 0.18, R.y - hw, R.x1 + 0.18, R.y + hw, DIRT);
      g.f.setMaskFilter(blur(5));
      g.rect(R.x0 + 0.2, R.y - 0.22, R.x1 - 0.2, R.y + 0.22, DIRT_LIGHT);
      g.f.setMaskFilter(null);
      for (let k = -2; k <= 2; k++) g.line(R.x0 + 0.3, R.y + k * 0.22, R.x0 + 1.0, R.y + k * 0.22, '#ffffff', 3.4);
      for (let x = R.x0 + 1.8; x < R.x1 - 0.8; x += 1.4) g.line(x, R.y, x + 0.7, R.y, 'rgba(255,255,255,0.75)', 2.2);
    }
    // edge lights: small white dots with soft shadows
    const lightsShadow = Skia.PathBuilder.Make();
    const lights = Skia.PathBuilder.Make();
    for (let x = R.x0; x <= R.x1 + 0.01; x += 1.5) {
      for (const side of [-1, 1]) {
        const sx = isoX(x, R.y + side * (hw + 0.08));
        const sy = isoY(x, R.y + side * (hw + 0.08));
        lightsShadow.addOval(Skia.XYWHRect(sx - 3.5, sy - 1, 8, 4));
        lights.addCircle(sx, sy - 1.5, 2.6);
      }
    }
    g.f.setColor(Skia.Color('rgba(60,40,20,0.3)'));
    c.drawPath(lightsShadow.build(), g.f);
    g.f.setColor(Skia.Color('#ffffff'));
    c.drawPath(lights.build(), g.f);

    // stands: a painted ring with a lead-in line; future stands are dashed plots
    L.stands.forEach((st, i) => {
      if (i < standsBuilt) {
        g.ellipse(st.pos[0], st.pos[1], 0.78, 0.78, '#ffffff');
        g.ellipse(st.pos[0], st.pos[1], 0.66, 0.66, GRAVEL);
        g.line(st.pos[0] + 0.55, st.pos[1] + 0.8, st.pos[0] - 0.35, st.pos[1] - 0.55, '#fbbf24', 3.4);
      } else {
        for (let k = 0; k < 16; k += 2) {
          const a0 = (k / 16) * Math.PI * 2;
          const a1 = ((k + 1) / 16) * Math.PI * 2;
          g.line(st.pos[0] + Math.cos(a0) * 0.75, st.pos[1] + Math.sin(a0) * 0.75, st.pos[0] + Math.cos(a1) * 0.75, st.pos[1] + Math.sin(a1) * 0.75, 'rgba(100,116,139,0.55)', 2.4);
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
        const gate = Math.abs(y0 - F.y0) < 0.01 && Math.abs(y1 - F.y0) < 0.01 && Math.min(x0, x1) < landX1 && Math.max(x0, x1) > landX0;
        if (gate) continue;
        for (const z of [0.24, 0.13]) {
          rails.moveTo(isoX(x0, y0), isoY(x0, y0, z));
          rails.lineTo(isoX(x1, y1), isoY(x1, y1, z));
        }
        posts.moveTo(isoX(x0, y0), isoY(x0, y0));
        posts.lineTo(isoX(x0, y0), isoY(x0, y0, 0.32));
      }
    }
    g.s.setColor(Skia.Color('#f1e6d2'));
    g.s.setStrokeWidth(1.4);
    c.drawPath(rails.build(), g.s);
    g.s.setColor(Skia.Color('#c8b08a'));
    g.s.setStrokeWidth(2.4);
    c.drawPath(posts.build(), g.s);
    // stand numbers painted next to each built stand
    L.stands.slice(0, standsBuilt).forEach((st, i) => paintText(c, String(i + 1), st.pos[0] + 0.95, st.pos[1] - 0.55, '#facc15', 0.028));
  });

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
  for (const st of L.stands.slice(standsBuilt)) {
    for (const [dx, dy] of [[-0.75, -0.5], [0.75, -0.5], [-0.75, 0.6], [0.75, 0.6]]) prop(sprites.cone, st.pos[0] + dx, st.pos[1] + dy, 0, 20);
  }

  // static sprites with depth: buildings and trees
  const T2 = L.terminal;
  T2.counters.slice(0, counters).forEach((c) => statics.push({ sprite: sprites.desk, x: isoX(c[0] - 0.3, c[1] - 0.45), y: isoY(c[0] - 0.3, c[1] - 0.45), depth: c[0] + c[1] - 0.4, r: 40 }));
  T2.lanes.slice(0, lanes).forEach((c) => statics.push({ sprite: sprites.scanner, x: isoX(c[0], c[1]), y: isoY(c[0], c[1]), depth: c[0] + c[1], r: 40 }));
  if (L.runway.surface === 'asphalt') {
    statics.push({ sprite: sprites.terminal, x: isoX(L.hut[0], L.hut[1]), y: isoY(L.hut[0], L.hut[1]), depth: L.hut[0] + 1.3 + L.hut[1] + 0.75, r: 160 });
    statics.push({ sprite: sprites.tower, x: isoX(18.6, 16.6), y: isoY(18.6, 16.6), depth: 18.6 + 16.6 + 0.3, r: 120 });
  } else {
    statics.push({ sprite: sprites.hut, x: isoX(L.hut[0], L.hut[1]), y: isoY(L.hut[0], L.hut[1]), depth: L.hut[0] + 1 + L.hut[1] + 0.7, r: 120 });
  }
  statics.push({ sprite: sprites.pump, x: isoX(L.pump[0], L.pump[1]), y: isoY(L.pump[0], L.pump[1]), depth: L.pump[0] + L.pump[1] + 0.9, r: 60 });

  // keep trees off the terminal plaza, the bag belt and the claim area
  const TT = L.terminal;
  const px0 = Math.min(...TT.counters.map((c) => c[0]), ...TT.lanes.map((c) => c[0]), ...TT.belt.map((c) => c[0])) - 1.2;
  const px1 = Math.max(...TT.checkinQueue.map((c) => c[0])) + 1.2;
  const py0 = Math.min(...TT.checkinQueue.map((c) => c[1])) - 1.2;
  const py1 = TT.claim[1] + 1;
  const treeAt = (x: number, y: number, seed: number) => {
    if (x > px0 && x < px1 && y > py0 && y < py1) return;
    const kind = Math.floor(hash01(seed * 5 + 1) * TREE_KINDS.length);
    const size = Math.floor(hash01(seed * 5 + 2) * TREE_SIZES.length);
    statics.push({ sprite: sprites.tree(kind, size), x: isoX(x, y), y: isoY(x, y), depth: x + y, r: 110 });
  };
  // tree lines outside the fence, with gaps
  let seed = 1;
  for (let x = 2; x < W - 2; x += 1.3) {
    for (const y of [F.y0 - 1.6, F.y1 + 1.8]) {
      const jitter = (hash01(seed * 7) - 0.5) * 0.8;
      if (hash01(seed * 11) < 0.62 && !(y < F.y0 && x > 20.5 && x < 24)) treeAt(x + jitter, y + jitter * 0.6, seed);
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
  treeAt(28.4, 17.8, 503);
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
    statics,
    bounds: { x0: isoX(0, H) * 0.7, y0: isoY(0, 0) + 200, x1: isoX(W, 0) * 0.7, y1: isoY(W, H) - 300 },
    windsock: { x: L.windsock[0], y: L.windsock[1] },
  };
}
