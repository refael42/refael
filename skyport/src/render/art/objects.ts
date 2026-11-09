/**
 * Static scenery and buildings with a fixed orientation: iso boxes with real
 * face shading, roofs, trees, the windsock and the fuel pump.
 * Coordinates: world tiles relative to the object origin; output in pixels.
 */
import { PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';

import { HALF_H, HALF_W, Z_PX } from '../iso';
import { edge, shade } from './color';

let fp: SkPaint | null = null;
let sp: SkPaint | null = null;
function paints() {
  if (!fp) {
    fp = Skia.Paint();
    fp.setAntiAlias(true);
    fp.setStyle(PaintStyle.Fill);
  }
  if (!sp) {
    sp = Skia.Paint();
    sp.setAntiAlias(true);
    sp.setStyle(PaintStyle.Stroke);
    sp.setStrokeJoin(StrokeJoin.Round);
    sp.setStrokeCap(StrokeCap.Round);
  }
  return { f: fp, s: sp };
}

export class IsoPen {
  constructor(
    readonly canvas: SkCanvas,
    readonly ox: number,
    readonly oy: number,
    readonly sc: number,
  ) {}

  X(x: number, y: number): number {
    return this.ox + (x - y) * HALF_W * this.sc;
  }

  Y(x: number, y: number, z: number): number {
    return this.oy + (x + y) * HALF_H * this.sc - z * Z_PX * this.sc;
  }

  /** Filled polygon from world points [x, y, z, ...] with optional outline. */
  poly(pts: number[], color: string, outline = true, ow = 1.3, alpha = 1): void {
    const { f, s } = paints();
    const b = Skia.PathBuilder.Make();
    for (let i = 0; i < pts.length; i += 3) {
      const x = this.X(pts[i], pts[i + 1]);
      const y = this.Y(pts[i], pts[i + 1], pts[i + 2]);
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    b.close();
    const path = b.build();
    if (outline) {
      s.setColor(Skia.Color(edge(color, -0.32)));
      s.setStrokeWidth(ow * (this.sc / 2));
      s.setAlphaf(alpha);
      this.canvas.drawPath(path, s);
      s.setAlphaf(1);
    }
    f.setColor(Skia.Color(color));
    f.setAlphaf(alpha);
    this.canvas.drawPath(path, f);
    f.setAlphaf(1);
  }

  line(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string, w: number): void {
    const { s } = paints();
    s.setColor(Skia.Color(color));
    s.setStrokeWidth(w * (this.sc / 2));
    this.canvas.drawLine(this.X(x0, y0), this.Y(x0, y0, z0), this.X(x1, y1), this.Y(x1, y1, z1), s);
  }

  /** Axis-aligned box: top, left (+y) and right (+x) faces. */
  box(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: string, outline = true): void {
    this.poly([x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1], shade(color, -0.28), outline);
    this.poly([x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1], shade(color, -0.1), outline);
    this.poly([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], shade(color, 0.12), outline);
  }

  /** Gable roof with the ridge along x. */
  gableX(x0: number, y0: number, x1: number, y1: number, z: number, rise: number, color: string, overhang = 0.08): void {
    const ym = (y0 + y1) / 2;
    const a = x0 - overhang;
    const b = x1 + overhang;
    const c = y0 - overhang;
    const d = y1 + overhang;
    // far slope (faces -y), near slope (faces +y), gable end at +x
    this.poly([a, c, z, b, c, z, b, ym, z + rise, a, ym, z + rise], shade(color, 0.05));
    this.poly([x1, y0, z, x1, y1, z, x1, ym, z + rise], shade('#c9a27a', -0.25));
    this.poly([a, ym, z + rise, b, ym, z + rise, b, d, z, a, d, z], shade(color, -0.12));
  }

  circle(x: number, y: number, z: number, r: number, color: string, outline = true): void {
    const { f } = paints();
    const cx = this.X(x, y);
    const cy = this.Y(x, y, z);
    if (outline) {
      f.setColor(Skia.Color(edge(color, -0.3)));
      this.canvas.drawCircle(cx, cy, r * this.sc + 0.7 * (this.sc / 2), f);
    }
    f.setColor(Skia.Color(color));
    this.canvas.drawCircle(cx, cy, r * this.sc, f);
  }

  shadow(x: number, y: number, rx: number, ry: number, alpha = 0.22): void {
    const { f } = paints();
    f.setColor(Skia.Color(`rgba(20,60,40,${alpha * 0.8})`));
    const cx = this.X(x, y);
    const cy = this.Y(x, y, 0);
    this.canvas.drawOval(Skia.XYWHRect(cx - rx * this.sc, cy - ry * this.sc, rx * 2 * this.sc, ry * 2 * this.sc), f);
  }
}

// ------------------------------------------------------------------ objects

/** Wooden hut / tiny terminal of the dirt strip. Footprint 2 x 1.4 tiles. */
export function drawHut(p: IsoPen): void {
  const wood = '#b9824f';
  p.shadow(1.2, 0.9, 70, 26, 0.2);
  p.box(0, 0, 2, 1.4, 0, 0.85, wood);
  // planks on the left face
  for (let i = 1; i < 6; i++) p.line(0, 1.4, i * 0.14, 2, 1.4, i * 0.14, shade(wood, -0.3), 1);
  // door on the +y face
  p.poly([1.25, 1.4, 0, 1.65, 1.4, 0, 1.65, 1.4, 0.62, 1.25, 1.4, 0.62], '#7a4a2a');
  p.circle(1.32, 1.4, 0.3, 0.03, '#f2d16b', false);
  // window on the +y face
  p.poly([0.35, 1.4, 0.35, 0.85, 1.4, 0.35, 0.85, 1.4, 0.65, 0.35, 1.4, 0.65], '#9fd3f0');
  p.line(0.6, 1.4, 0.35, 0.6, 1.4, 0.65, '#f4f1e8', 1.4);
  // window on the +x face
  p.poly([2, 0.4, 0.35, 2, 0.95, 0.35, 2, 0.95, 0.65, 2, 0.4, 0.65], '#8cc4e2');
  // roof
  p.gableX(0, 0, 2, 1.4, 0.85, 0.45, '#5f7d95');
  // roof ridges
  for (let i = 1; i < 8; i++) {
    const x = (i / 8) * 2;
    p.line(x, 0.7, 1.3, x, 1.48, 0.85, shade('#5f7d95', -0.25), 0.8);
  }
  // little porch bench
  p.box(0.25, 1.55, 0.95, 1.7, 0, 0.18, '#8a5a35');
}

/** Fuel pump with a small tank. Footprint ~1 x 0.8. */
export function drawFuelPump(p: IsoPen): void {
  p.shadow(0.5, 0.45, 34, 14, 0.2);
  // tank on legs
  p.box(0.05, 0.05, 0.12, 0.12, 0, 0.25, '#4a4f5c');
  p.box(0.75, 0.05, 0.82, 0.12, 0, 0.25, '#4a4f5c');
  p.box(0.02, 0.0, 0.88, 0.32, 0.22, 0.5, '#eef1f5');
  p.line(0.02, 0.32, 0.36, 0.88, 0.32, 0.36, '#e8473f', 2.4);
  // pump
  p.box(0.35, 0.5, 0.62, 0.72, 0, 0.55, '#e8473f');
  p.poly([0.4, 0.72, 0.35, 0.57, 0.72, 0.35, 0.57, 0.72, 0.48, 0.4, 0.72, 0.48], '#f4f1e8');
  p.line(0.62, 0.62, 0.35, 0.72, 0.66, 0.15, '#25262c', 1.6);
}

/** Windsock. dir = index 0..7 (world heading the sock points to), frame 0..1. */
export function drawWindsock(p: IsoPen, dir: number, frame: number): void {
  p.shadow(0, 0, 12, 5, 0.25);
  p.line(0, 0, 0, 0, 0, 1.25, '#8a94a6', 2.6);
  p.line(0, 0, 0, 0, 0, 1.25, '#e8ecf2', 1.4);
  const a = (dir / 8) * Math.PI * 2;
  const wob = frame === 0 ? 0.02 : -0.02;
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const L = 0.55;
    const r0 = 0.07 * (1 - t0 * 0.45);
    const r1 = 0.07 * (1 - t1 * 0.45);
    const x0 = Math.cos(a) * L * t0;
    const y0 = Math.sin(a) * L * t0;
    const x1 = Math.cos(a) * L * t1;
    const y1 = Math.sin(a) * L * t1;
    const z0 = 1.18 - t0 * 0.06 + wob * t0;
    const z1 = 1.18 - t1 * 0.06 + wob * t1;
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const color = i % 2 === 0 ? '#ff7a1f' : '#f8f8f8';
    p.poly(
      [x0 + nx * r0, y0 + ny * r0, z0, x1 + nx * r1, y1 + ny * r1, z1, x1, y1, z1 - r1 * 1.4, x1 - nx * r1, y1 - ny * r1, z1, x0 - nx * r0, y0 - ny * r0, z0, x0, y0, z0 - r0 * 1.4],
      color,
      true,
      1.6,
    );
  }
}

export type TreeKind = 'round' | 'roundDark' | 'pine' | 'bush' | 'birch';

/** Low-poly foliage blob: a faceted polygon lit from the upper left. */
function facetBlob(p: IsoPen, cx: number, cy: number, r: number, color: string, seed: number): void {
  const n = 7;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + seed * 0.4;
    const rr = r * (0.9 + ((i * 37 + seed * 11) % 7) / 40);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]);
  }
  const { f } = paints();
  const fillPoly = (ps: [number, number][], col: string) => {
    const b = Skia.PathBuilder.Make();
    ps.forEach(([x, y], i) => (i === 0 ? b.moveTo(x, y) : b.lineTo(x, y)));
    b.close();
    f.setColor(Skia.Color(col));
    p.canvas.drawPath(b.build(), f);
  };
  fillPoly(pts, shade(color, -0.12));
  // lit facets (upper-left half) and a bright top facet
  const c: [number, number] = [cx - r * 0.12, cy - r * 0.1];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2 - cx;
    const my = (a[1] + b[1]) / 2 - cy;
    const light = -(mx * 0.7 + my * 0.75) / r; // -1 (dark, lower right) .. 1 (lit)
    fillPoly([c, a, b], shade(color, light > 0 ? light * 0.28 : light * 0.18));
  }
}

export function drawTree(p: IsoPen, kind: TreeKind, size: number): void {
  const s = size;
  const k = p.sc;
  const ox = p.ox;
  const oy = p.oy;
  if (kind === 'bush') {
    p.shadow(0, 0, 18 * s, 7 * s, 0.24);
    facetBlob(p, ox - 6 * s * k, oy - 7 * s * k, 8 * s * k, '#5fb35a', 1);
    facetBlob(p, ox + 5 * s * k, oy - 8 * s * k, 9 * s * k, '#6cc062', 2);
    return;
  }
  if (kind === 'pine') {
    p.shadow(0, 0, 15 * s, 6 * s, 0.26);
    p.line(0, 0, 0, 0, 0, 0.3 * s, '#8a5a3a', 4 * s);
    const tiers = [
      { z: 0.2, w: 0.3, h: 0.6, c: '#2f8f5b' },
      { z: 0.52, w: 0.24, h: 0.52, c: '#38a167' },
      { z: 0.82, w: 0.17, h: 0.46, c: '#44b374' },
    ];
    for (const t of tiers) {
      const z = t.z * s;
      // left (lit) and right (shaded) halves of a cone
      p.poly([-t.w * s, t.w * s, z, 0, 0, z - 0.05 * s, 0, 0, z + t.h * s], shade(t.c, 0.12), false);
      p.poly([0, 0, z - 0.05 * s, t.w * s, -t.w * s, z, 0, 0, z + t.h * s], shade(t.c, -0.16), false);
    }
    return;
  }
  const leaf = kind === 'roundDark' ? '#3f9a55' : kind === 'birch' ? '#9bd065' : '#5fb35a';
  p.shadow(0, 0, 20 * s, 8 * s, 0.24);
  p.line(0, 0, 0, 0, 0, 0.5 * s, kind === 'birch' ? '#ece6da' : '#8a5a3a', 4.5 * s);
  const cy = oy - 0.95 * s * 32 * k;
  const r = 15 * s * k / 2 * 1.9;
  facetBlob(p, ox, cy, r, leaf, kind.length);
}

/** Small rock. */
export function drawRock(p: IsoPen, size: number): void {
  p.shadow(0, 0, 10 * size, 4 * size, 0.2);
  p.poly([-0.12 * size, 0.05 * size, 0, 0.1 * size, -0.08 * size, 0, 0.14 * size, 0.06 * size, 0.08 * size, -0.02 * size, 0.1 * size, 0.16 * size], '#9aa0a8');
}

/** Snack kiosk with a striped awning. Footprint ~0.9 x 0.7. */
export function drawKiosk(p: IsoPen): void {
  p.shadow(0.45, 0.4, 30, 12, 0.22);
  p.box(0, 0, 0.9, 0.7, 0, 0.55, '#f8fafc');
  p.poly([0.9, 0.12, 0.2, 0.9, 0.58, 0.2, 0.9, 0.58, 0.42, 0.9, 0.12, 0.42], '#1e293b');
  // awning stripes over the counter (+x side)
  for (let i = 0; i < 4; i++) {
    const y0 = 0.02 + i * 0.165;
    p.poly([0.9, y0, 0.62, 1.12, y0, 0.48, 1.12, y0 + 0.165, 0.48, 0.9, y0 + 0.165, 0.62], i % 2 === 0 ? '#ef4444' : '#ffffff');
  }
  p.box(-0.02, -0.02, 0.92, 0.72, 0.55, 0.62, '#f59e0b');
  p.circle(0.45, 0.35, 0.95, 0.1, '#fbbf24');
}

/** Roadside billboard advertising the airfield. */
export function drawBillboard(p: IsoPen): void {
  p.shadow(0.5, 0.1, 34, 8, 0.2);
  p.line(0.15, 0, 0, 0.15, 0, 0.75, '#64748b', 3);
  p.line(0.85, 0, 0, 0.85, 0, 0.75, '#64748b', 3);
  p.poly([-0.05, 0, 0.6, 1.05, 0, 0.6, 1.05, 0, 1.25, -0.05, 0, 1.25], '#ffffff');
  p.poly([0.0, 0, 0.66, 1.0, 0, 0.66, 1.0, 0, 1.19, 0.0, 0, 1.19], '#6366f1');
  // a tiny plane and a sun on the board
  p.poly([0.3, 0, 0.92, 0.62, 0, 1.0, 0.7, 0, 0.98, 0.42, 0, 0.88], '#ffffff', false);
  p.circle(0.82, 0, 1.06, 0.07, '#fbbf24', false);
}

/** A bench under a parasol. */
export function drawBench(p: IsoPen): void {
  p.shadow(0.3, 0.15, 22, 9, 0.2);
  p.box(0, 0, 0.6, 0.18, 0.12, 0.17, '#b45309');
  p.box(0.02, 0.0, 0.06, 0.18, 0, 0.12, '#78350f');
  p.box(0.54, 0.0, 0.58, 0.18, 0, 0.12, '#78350f');
  p.line(0.3, 0.3, 0, 0.3, 0.3, 0.75, '#e2e8f0', 2);
  const r = 0.42;
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pts.push(0.3 + Math.cos(a) * r, 0.3 + Math.sin(a) * r, 0.72);
  }
  p.poly(pts, '#14b8a6');
  p.poly([0.3 - r * 0.5, 0.3 - r * 0.2, 0.74, 0.3, 0.3, 0.85, 0.3 + r * 0.3, 0.3 - r * 0.6, 0.74], '#5eead4', false);
}

/** Construction crane with a fence, for a plot being built. */
export function drawCrane(p: IsoPen): void {
  p.shadow(0, 0, 40, 16, 0.18);
  // fence posts around the plot
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.line(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0, Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.25, '#f59e0b', 2.4);
  }
  // mast (lattice) and jib
  p.box(-0.08, -0.08, 0.08, 0.08, 0, 1.9, '#fbbf24');
  for (let z = 0.2; z < 1.9; z += 0.25) p.line(-0.08, 0.08, z, 0.08, 0.08, z + 0.2, '#b45309', 1.2);
  p.box(-0.5, -0.05, 1.1, 0.05, 1.9, 1.98, '#fbbf24');
  p.box(-0.5, -0.1, -0.3, 0.1, 1.75, 1.9, '#475569');
  p.line(0.9, 0, 1.94, 0.9, 0, 1.2, '#334155', 1.2);
  p.box(0.82, -0.08, 0.98, 0.08, 1.05, 1.2, '#64748b');
}

/** Small terminal (tier 2): white walls, a glass front, flat roof and a sign. Footprint 2.6 x 1.5. */
export function drawTerminal(p: IsoPen): void {
  p.shadow(1.4, 1.0, 92, 34, 0.2);
  p.box(0, 0, 2.6, 1.5, 0, 0.95, '#f1f5f9');
  // glass front (+y face) with mullions
  p.poly([0.15, 1.5, 0.12, 2.45, 1.5, 0.12, 2.45, 1.5, 0.78, 0.15, 1.5, 0.78], '#7dd3fc');
  for (let x = 0.45; x < 2.45; x += 0.3) p.line(x, 1.5, 0.12, x, 1.5, 0.78, '#e2e8f0', 1.2);
  p.poly([1.1, 1.5, 0.0, 1.5, 1.5, 0.0, 1.5, 1.5, 0.62, 1.1, 1.5, 0.62], '#0ea5e9');
  // side windows (+x face)
  p.poly([2.6, 0.25, 0.4, 2.6, 1.25, 0.4, 2.6, 1.25, 0.75, 2.6, 0.25, 0.75], '#bae6fd');
  // roof with a parapet and a canopy over the door
  p.box(-0.04, -0.04, 2.64, 1.54, 0.95, 1.02, '#cbd5e1');
  p.box(0.9, 1.5, 1.7, 1.95, 0.66, 0.72, '#6366f1');
  // sign on the roof
  p.box(0.7, 0.55, 1.9, 0.62, 1.02, 1.32, '#6366f1');
  p.poly([0.75, 0.62, 1.08, 1.85, 0.62, 1.08, 1.85, 0.62, 1.26, 0.75, 0.62, 1.26], '#ffffff', false);
}

/** Control tower: round shaft, glass cab, antenna. */
export function drawTower(p: IsoPen): void {
  // radii are in screen px (like the trees), heights in tiles
  p.shadow(0.3, 0.3, 30, 12, 0.22);
  for (let z = 0; z < 1.9; z += 0.03) p.circle(0, 0, z, 7, z > 1.86 ? '#f8fafc' : z < 0.05 ? '#94a3b8' : '#e2e8f0', false);
  p.circle(0, 0, 1.9, 12, '#cbd5e1');
  for (let z = 1.92; z < 2.3; z += 0.02) p.circle(0, 0, z, 11, z > 2.27 ? '#7dd3fc' : '#38bdf8', false);
  p.circle(0, 0, 2.3, 13, '#475569');
  p.line(0, 0, 2.3, 0, 0, 2.75, '#475569', 2);
  p.circle(0, 0, 2.76, 2, '#ef4444', false);
}

/** Frames of the turning radar antenna (half a turn: the antenna is symmetric). */
export const RADAR_FRAMES = 8;

/** A surveillance radar: lattice mast with a turning antenna on top. */
export function drawRadar(p: IsoPen, frame: number): void {
  p.shadow(0.1, 0.1, 18, 7, 0.2);
  p.box(-0.22, -0.22, 0.22, 0.22, 0, 0.18, '#94a3b8');
  // four legs leaning in, cross braces
  const legs: [number, number][] = [
    [-0.16, -0.16],
    [0.16, -0.16],
    [0.16, 0.16],
    [-0.16, 0.16],
  ];
  for (const [x, y] of legs) p.line(x, y, 0.18, x * 0.35, y * 0.35, 1.4, '#64748b', 1.6);
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = legs[i];
    const [bx, by] = legs[(i + 1) % 4];
    p.line(ax * 0.8, ay * 0.8, 0.5, bx * 0.55, by * 0.55, 0.95, '#94a3b8', 1);
  }
  p.box(-0.09, -0.09, 0.09, 0.09, 1.4, 1.5, '#475569');
  // the antenna: a long, slightly curved reflector, tilted up
  const a = (frame / RADAR_FRAMES) * Math.PI;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy * 0.09;
  const ny = ux * 0.09;
  const half = 0.42;
  const pts = (side: number) => [
    -ux * half + nx * side, -uy * half + ny * side, 1.54,
    ux * half + nx * side, uy * half + ny * side, 1.54,
    ux * half * 0.9 + nx * side * 2.2, uy * half * 0.9 + ny * side * 2.2, 1.82,
    -ux * half * 0.9 + nx * side * 2.2, -uy * half * 0.9 + ny * side * 2.2, 1.82,
  ];
  // back face first, then the bright front of the dish
  const front = ny + nx > 0 ? 1 : -1;
  p.poly(pts(-front), '#64748b', true, 1.2);
  p.poly(pts(front), '#e2e8f0', true, 1.2);
  p.circle(0, 0, 1.56, 2.2, '#ef4444', false);
}

/** Build mode tile highlight (iso diamond). */
export function drawTile(p: IsoPen, color: string): void {
  p.poly([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], color, false);
}

/** A check-in desk with a small screen sign. */
export function drawDesk(p: IsoPen): void {
  p.shadow(0.3, 0.15, 20, 7, 0.18);
  p.box(0, 0, 0.6, 0.28, 0, 0.32, '#f8fafc');
  p.box(-0.02, -0.02, 0.62, 0.3, 0.32, 0.36, '#6366f1');
  p.line(0.3, 0.05, 0.36, 0.3, 0.05, 0.75, '#475569', 2);
  p.box(0.12, 0.02, 0.48, 0.08, 0.66, 0.86, '#1e293b');
  p.poly([0.14, 0.08, 0.69, 0.46, 0.08, 0.69, 0.46, 0.08, 0.83, 0.14, 0.08, 0.83], '#38bdf8', false);
}

/** Security: a walk-through scanner arch next to an x-ray box. */
export function drawScanner(p: IsoPen, v = 1): void {
  if (v >= 2) {
    // (version 2 on: a round body scanner, a glass booth with two posts; version 3: a big rounded CT tunnel)
    drawScannerBooth(p);
    if (v >= 3) return drawCtTunnel(p);
  }
  p.shadow(0.2, 0.1, 22, 8, 0.18);
  p.box(-0.3, -0.06, -0.22, 0.06, 0, 0.72, '#cbd5e1');
  p.box(0.22, -0.06, 0.3, 0.06, 0, 0.72, '#cbd5e1');
  p.box(-0.3, -0.06, 0.3, 0.06, 0.72, 0.8, '#94a3b8');
  p.circle(0, 0, 0.8, 2.2, '#22c55e', false);
  p.box(0.42, -0.2, 0.95, 0.2, 0, 0.36, '#64748b');
  p.box(0.4, -0.22, 0.97, 0.22, 0.36, 0.42, '#334155');
}

/** The body scanner: a round glass booth beside the walk-through frame. */
function drawScannerBooth(p: IsoPen): void {
  p.shadow(-0.55, 0, 12, 6, 0.16);
  p.box(-0.78, -0.2, -0.38, 0.2, 0, 0.05, '#94a3b8');
  for (let z = 0.06; z < 0.8; z += 0.03) p.circle(-0.58, 0, z, 9, 'rgba(186,230,253,0.35)', false);
  p.box(-0.76, -0.04, -0.72, 0.04, 0.05, 0.82, '#cbd5e1');
  p.box(-0.44, -0.04, -0.4, 0.04, 0.05, 0.82, '#cbd5e1');
  p.circle(-0.58, 0, 0.84, 9.5, '#e2e8f0');
  p.circle(-0.58, 0, 0.86, 2, '#38bdf8', false);
}

/** The CT scanner for bags: a long rounded tunnel with a blue lit band (in place of the X-ray box). */
function drawCtTunnel(p: IsoPen): void {
  p.shadow(0.2, 0.1, 26, 9, 0.18);
  p.box(-0.3, -0.06, -0.22, 0.06, 0, 0.72, '#cbd5e1');
  p.box(0.22, -0.06, 0.3, 0.06, 0, 0.72, '#cbd5e1');
  p.box(-0.3, -0.06, 0.3, 0.06, 0.72, 0.8, '#94a3b8');
  p.circle(0, 0, 0.8, 2.2, '#22c55e', false);
  p.box(0.38, -0.24, 1.05, 0.24, 0, 0.12, '#475569');
  for (let z = 0.12; z < 0.5; z += 0.02) p.box(0.42, -0.22 + (z - 0.3) ** 2, 1.01, 0.22 - (z - 0.3) ** 2, z, z + 0.02, '#e2e8f0', false);
  p.box(0.6, -0.23, 0.68, 0.23, 0.12, 0.5, '#2563eb', false);
  p.box(0.36, -0.08, 1.07, 0.08, 0.1, 0.14, '#1e293b', false);
}

// ------------------------------------------------------------------ small props

/** Street lamp: a slim pole, an arm and a lamp head with a warm lens. */
export function drawLamp(p: IsoPen): void {
  p.shadow(0, 0, 6, 3, 0.18);
  p.box(-0.03, -0.03, 0.03, 0.03, 0, 0.04, '#475569');
  p.line(0, 0, 0.04, 0, 0, 1.25, '#64748b', 2.6);
  p.line(0, 0, 1.25, 0.18, 0, 1.3, '#64748b', 2);
  p.box(0.13, -0.04, 0.27, 0.04, 1.24, 1.3, '#334155');
  p.poly([0.14, -0.035, 1.235, 0.26, -0.035, 1.235, 0.26, 0.035, 1.235, 0.14, 0.035, 1.235], '#fde68a', false);
}

/** Orange traffic cone with a white band. */
export function drawCone(p: IsoPen): void {
  p.shadow(0, 0, 5, 2.5, 0.2);
  p.box(-0.06, -0.06, 0.06, 0.06, 0, 0.015, '#ea580c');
  // the visible half of the cone as two flat faces, plus a white band
  const tip = 0.24;
  p.poly([-0.045, 0.045, 0.015, 0.045, 0.045, 0.015, 0, 0, tip], '#f97316');
  p.poly([0.045, -0.045, 0.015, 0.045, 0.045, 0.015, 0, 0, tip], '#c2410c');
  p.poly([-0.03, 0.03, 0.1, 0.03, 0.03, 0.1, 0.022, 0.022, 0.15, -0.022, 0.022, 0.15], '#ffffff', false);
  p.poly([0.03, -0.03, 0.1, 0.03, 0.03, 0.1, 0.022, 0.022, 0.15, 0.022, -0.022, 0.15], '#e2e8f0', false);
}

/** Taxiway sign: a dark board with a yellow face on two legs. */
export function drawTaxiSign(p: IsoPen): void {
  p.shadow(0.2, 0, 14, 4, 0.18);
  p.line(0.05, 0, 0, 0.05, 0, 0.12, '#475569', 1.6);
  p.line(0.35, 0, 0, 0.35, 0, 0.12, '#475569', 1.6);
  p.box(-0.02, -0.04, 0.42, 0.0, 0.1, 0.32, '#111827');
  p.poly([0.02, 0.001, 0.13, 0.2, 0.001, 0.13, 0.2, 0.001, 0.29, 0.02, 0.001, 0.29], '#facc15', false);
  p.poly([0.23, 0.001, 0.13, 0.38, 0.001, 0.13, 0.38, 0.001, 0.29, 0.23, 0.001, 0.29], '#111827', false);
  // arrow on the yellow half, a letter-ish bar on the dark half
  p.line(0.05, 0.002, 0.21, 0.17, 0.002, 0.21, '#111827', 1.6);
  p.line(0.13, 0.002, 0.25, 0.17, 0.002, 0.21, '#111827', 1.6);
  p.line(0.13, 0.002, 0.17, 0.17, 0.002, 0.21, '#111827', 1.6);
  p.line(0.3, 0.002, 0.16, 0.3, 0.002, 0.26, '#facc15', 1.8);
}

/** Blue parking sign with a white P. */
export function drawParkSign(p: IsoPen): void {
  p.shadow(0, 0, 5, 2.5, 0.18);
  p.line(0, 0, 0, 0, 0, 0.7, '#94a3b8', 2.2);
  p.box(-0.13, -0.02, 0.13, 0.0, 0.62, 0.9, '#2563eb');
  // the letter P
  p.line(-0.04, 0.002, 0.66, -0.04, 0.002, 0.86, '#ffffff', 2.2);
  p.line(-0.04, 0.002, 0.86, 0.04, 0.002, 0.86, '#ffffff', 2.2);
  p.line(0.04, 0.002, 0.86, 0.06, 0.002, 0.8, '#ffffff', 2.2);
  p.line(0.06, 0.002, 0.8, 0.04, 0.002, 0.75, '#ffffff', 2.2);
  p.line(0.04, 0.002, 0.75, -0.04, 0.002, 0.75, '#ffffff', 2.2);
}

/** A row of nested luggage trolleys. */
export function drawTrolleys(p: IsoPen): void {
  p.shadow(0.25, 0.08, 18, 6, 0.18);
  for (let i = 0; i < 4; i++) {
    const x = i * 0.09;
    p.line(x, 0, 0.04, x + 0.16, 0, 0.04, '#64748b', 1.2);
    p.line(x, 0.14, 0.04, x + 0.16, 0.14, 0.04, '#64748b', 1.2);
    p.poly([x + 0.02, 0, 0.05, x + 0.16, 0, 0.05, x + 0.16, 0.14, 0.05, x + 0.02, 0.14, 0.05], '#cbd5e1', false, 1, 0.9);
    p.line(x + 0.16, 0, 0.05, x + 0.18, 0, 0.26, '#94a3b8', 1.4);
    p.line(x + 0.16, 0.14, 0.05, x + 0.18, 0.14, 0.26, '#94a3b8', 1.4);
    p.line(x + 0.18, 0, 0.26, x + 0.18, 0.14, 0.26, '#ef4444', 2);
  }
}

/** Planter box with flowers. */
export function drawPlanter(p: IsoPen, seed: number): void {
  p.shadow(0.3, 0.1, 20, 6, 0.18);
  p.box(0, 0, 0.6, 0.2, 0, 0.12, '#a8a29e');
  p.poly([0.02, 0.02, 0.121, 0.58, 0.02, 0.121, 0.58, 0.18, 0.121, 0.02, 0.18, 0.121], '#6b4f3a', false);
  const colors = ['#f43f5e', '#f59e0b', '#a855f7', '#ffffff', '#ec4899', '#facc15'];
  for (let i = 0; i < 9; i++) {
    const x = 0.06 + (i % 5) * 0.12 + (i > 4 ? 0.06 : 0);
    const y = i > 4 ? 0.13 : 0.06;
    p.circle(x, y, 0.16 + (i % 2) * 0.02, 0.05, '#4d9a3c', false);
    p.circle(x, y, 0.2 + (i % 2) * 0.02, 0.03, colors[(i + seed) % colors.length], false);
  }
}

// ------------------------------------------------------------------ bigger airports

/** Private jet lounge (FBO): a low glass pavilion with a gold trim and a canopy. Footprint 2.2 x 1.3. */
export function drawFbo(p: IsoPen): void {
  p.shadow(1.1, 0.7, 70, 26, 0.2);
  p.box(0, 0, 2.2, 1.3, 0, 0.55, '#f8fafc');
  p.poly([0.1, 1.3, 0.08, 2.1, 1.3, 0.08, 2.1, 1.3, 0.47, 0.1, 1.3, 0.47], '#1e293b');
  for (let x = 0.4; x < 2.1; x += 0.3) p.line(x, 1.3, 0.08, x, 1.3, 0.47, '#d4af7a', 1);
  p.poly([2.2, 0.15, 0.1, 2.2, 1.15, 0.1, 2.2, 1.15, 0.47, 2.2, 0.15, 0.47], '#334155');
  p.box(-0.08, -0.08, 2.28, 1.38, 0.55, 0.6, '#d4af7a');
  p.box(0.0, 0.0, 2.2, 1.3, 0.6, 0.64, '#f8fafc');
  // canopy over the door, on two slim posts
  p.line(0.75, 1.75, 0, 0.75, 1.75, 0.45, '#94a3b8', 1.6);
  p.line(1.45, 1.75, 0, 1.45, 1.75, 0.45, '#94a3b8', 1.6);
  p.box(0.6, 1.3, 1.6, 1.85, 0.45, 0.5, '#d4af7a');
  // a little potted palm by the door
  p.box(1.75, 1.45, 1.9, 1.6, 0, 0.1, '#a8a29e');
  p.circle(1.82, 1.52, 0.32, 0.12, '#16a34a', false);
}

/** One section of the gate pier (they are laid side by side). Footprint 2.15 x 1.5. */
export function drawPierSegment(p: IsoPen, end: boolean): void {
  p.shadow(1.1, 0.8, 72, 26, 0.18);
  p.box(0, 0, 2.15, 1.5, 0, 0.85, '#e2e8f0');
  // tall glass toward the apron (+y), with mullions and a darker band of gate signs
  p.poly([0.05, 1.5, 0.1, 2.1, 1.5, 0.1, 2.1, 1.5, 0.72, 0.05, 1.5, 0.72], '#7dd3fc');
  for (let x = 0.3; x < 2.1; x += 0.27) p.line(x, 1.5, 0.1, x, 1.5, 0.72, '#f1f5f9', 1);
  p.poly([0.05, 1.5, 0.62, 2.1, 1.5, 0.62, 2.1, 1.5, 0.7, 0.05, 1.5, 0.7], '#0f172a', false);
  if (end) p.poly([2.15, 0.15, 0.1, 2.15, 1.35, 0.1, 2.15, 1.35, 0.72, 2.15, 0.15, 0.72], '#bae6fd');
  // roof: a white slab with a skylight and an air unit
  p.box(-0.02, -0.02, 2.17, 1.52, 0.85, 0.92, '#cbd5e1');
  p.poly([0.4, 0.45, 0.93, 1.7, 0.45, 0.93, 1.7, 1.0, 0.93, 0.4, 1.0, 0.93], '#93c5fd', false);
  p.box(1.75, 0.2, 2.0, 0.5, 0.92, 1.05, '#94a3b8');
}

/** Jet bridge: a corridor on a wheeled leg reaching toward +y (length in tiles). */
export function drawJetBridge(p: IsoPen, len: number): void {
  p.shadow(0.2, len * 0.6, 22, 10, 0.16);
  // rotunda by the pier
  p.box(-0.22, -0.1, 0.22, 0.3, 0, 0.62, '#94a3b8');
  // the tunnel (slightly lower toward the plane)
  p.box(-0.14, 0.3, 0.14, len - 0.35, 0.38, 0.62, '#cbd5e1');
  p.poly([0.14, 0.4, 0.42, 0.14, len - 0.45, 0.42, 0.14, len - 0.45, 0.56, 0.14, 0.4, 0.56], '#e2e8f0', false);
  // wheeled leg and the cab at the plane door
  p.line(0, len - 0.6, 0, 0, len - 0.6, 0.38, '#475569', 2.4);
  p.box(-0.12, len - 0.72, 0.12, len - 0.5, 0, 0.06, '#1f2937');
  p.box(-0.2, len - 0.35, 0.2, len, 0.34, 0.66, '#94a3b8');
  p.poly([-0.2, len, 0.38, 0.2, len, 0.38, 0.2, len, 0.62, -0.2, len, 0.62], '#475569', false);
}

/** Cargo warehouse: a ribbed shed with a roller door and a red stripe. Footprint 3.2 x 2.0. */
export function drawCargoShed(p: IsoPen): void {
  p.shadow(1.6, 1.0, 100, 36, 0.2);
  p.box(0, 0, 3.2, 2.0, 0, 1.0, '#cbd5e1');
  for (let x = 0.2; x < 3.2; x += 0.2) p.line(x, 2.0, 0.02, x, 2.0, 0.98, '#94a3b8', 0.8);
  p.poly([0, 2.0, 0.78, 3.2, 2.0, 0.78, 3.2, 2.0, 0.88, 0, 2.0, 0.88], '#dc2626', false);
  p.poly([0.9, 2.0, 0, 2.2, 2.0, 0, 2.2, 2.0, 0.66, 0.9, 2.0, 0.66], '#64748b');
  for (let z = 0.08; z < 0.66; z += 0.08) p.line(0.9, 2.0, z, 2.2, 2.0, z, '#475569', 0.8);
  p.poly([3.2, 0.3, 0.3, 3.2, 1.7, 0.3, 3.2, 1.7, 0.6, 3.2, 0.3, 0.6], '#94a3b8');
  // shallow gable roof
  p.gableX(0, 0, 3.2, 2.0, 1.0, 0.3, '#64748b', 0.06);
  // pallets stacked outside
  p.box(2.5, 2.25, 2.95, 2.6, 0, 0.25, '#a16207');
  p.box(2.55, 2.3, 2.9, 2.55, 0.25, 0.5, '#f59e0b');
}

// ------------------------------------------------------------------ supply area and hangar (M10)

/** A vertical tank (stacked rings): white shell, red band, a light lid with a vent. r in screen px. */
function tank(p: IsoPen, x: number, y: number, r: number, h: number): void {
  p.shadow(x + 0.15, y + 0.15, r * 1.6, r * 0.7, 0.22);
  for (let z = 0; z < h; z += 0.022) {
    const t = z / h;
    const band = t > 0.62 && t < 0.7;
    p.circle(x, y, z, r, band ? '#e8473f' : t < 0.04 ? '#cbd5e1' : shade('#eef2f6', -0.08 + t * 0.08), false);
  }
  p.circle(x, y, h, r, '#f8fafc');
  p.circle(x, y, h + 0.01, r * 0.82, '#e2e8f0', false);
  // vent and hatch on the lid
  p.box(x - 0.04, y - 0.04, x + 0.04, y + 0.04, h, h + 0.08, '#94a3b8');
  p.circle(x + 0.12, y - 0.1, h + 0.012, r * 0.18, '#64748b', false);
  // railing posts around the lid
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const rx = Math.cos(a) * (r / 32) * 0.98;
    const ry = Math.sin(a) * (r / 32) * 0.98;
    if (Math.sin(a) + Math.cos(a) < -0.2) continue;
    p.line(x + rx, y + ry, h, x + rx, y + ry, h + 0.09, '#94a3b8', 0.8);
  }
  // a hazard diamond on the front
  const fx = x + (r / 32) * 0.72;
  const fy = y + (r / 32) * 0.72;
  p.poly([fx, fy, h * 0.45, fx + 0.05, fy - 0.05, h * 0.38, fx, fy, h * 0.31, fx - 0.05, fy + 0.05, h * 0.38], '#dc2626', false);
}

/** Fuel farm: 1..4 tanks inside a low bund wall, pipes to a pump skid, a ladder, placards. Center anchor, ~2.7 x 1.7 tiles. */
export function drawFuelFarm(p: IsoPen, tanks: number): void {
  p.shadow(0, 0, 66, 26, 0.14);
  // concrete pad and the bund wall (it would hold a spill)
  p.box(-1.35, -0.85, 1.35, 0.85, 0, 0.03, '#d6dbe1', false);
  p.poly([-1.25, -0.75, 0.031, 1.25, -0.75, 0.031, 1.25, 0.75, 0.031, -1.25, 0.75, 0.031], '#bfc6cf', false);
  p.box(-1.35, -0.85, 1.35, -0.78, 0.03, 0.14, '#cbd5e1');
  p.box(-1.35, -0.85, -1.28, 0.85, 0.03, 0.14, '#cbd5e1');
  const spots: [number, number, number, number][] = [
    [-0.62, -0.18, 15, 0.95],
    [0.3, -0.25, 13, 0.82],
    [-0.75, 0.5, 11, 0.7],
    [0.95, 0.38, 10, 0.62],
  ];
  // pipes from each tank to the pump skid at the front right
  for (let i = 0; i < Math.min(tanks, spots.length); i++) {
    const [x, y] = spots[i];
    p.line(x + 0.2, y + 0.2, 0.08, 0.95, 0.55, 0.08, '#ca8a04', 2.2);
    p.line(x + 0.2, y + 0.2, 0.08, 0.95, 0.55, 0.08, '#facc15', 1.2);
  }
  for (let i = 0; i < Math.min(tanks, spots.length); i++) {
    const [x, y, r, h] = spots[i];
    tank(p, x, y, r, h);
  }
  // a stair up the side of the big tank
  const [bx, by, br, bh] = spots[0];
  for (let k = 0; k < 9; k++) {
    const a = 0.4 + k * 0.17;
    const rr = (br / 32) * 1.06;
    p.line(bx + Math.cos(a) * rr, by + Math.sin(a) * rr, (k / 9) * bh, bx + Math.cos(a + 0.17) * rr, by + Math.sin(a + 0.17) * rr, ((k + 1) / 9) * bh, '#475569', 1.4);
  }
  // a gauge board on the front of the big tank (the level is drawn on top while playing)
  p.box(bx + 0.3, by + 0.42, bx + 0.37, by + 0.49, 0.06, 0.64, '#f8fafc');
  p.line(bx + 0.335, by + 0.455, 0.09, bx + 0.335, by + 0.455, 0.61, '#334155', 3.2);
  // pump skid with two motors and a filter
  p.box(0.75, 0.42, 1.25, 0.72, 0.03, 0.1, '#64748b');
  p.box(0.8, 0.46, 0.98, 0.68, 0.1, 0.24, '#2563eb');
  p.box(1.03, 0.46, 1.2, 0.68, 0.1, 0.24, '#2563eb');
  p.box(0.86, 0.5, 0.92, 0.64, 0.24, 0.3, '#94a3b8');
  // extinguisher and a no-smoking sign by the gap in the wall
  p.box(1.25, -0.6, 1.33, -0.52, 0, 0.16, '#dc2626');
  p.box(1.26, -0.59, 1.32, -0.53, 0.16, 0.19, '#111827');
  p.line(1.3, -0.25, 0, 1.3, -0.25, 0.42, '#64748b', 1.2);
  p.circle(1.3, -0.25, 0.47, 3.4, '#dc2626');
  p.circle(1.3, -0.25, 0.47, 2.4, '#f8fafc', false);
  p.line(1.27, -0.28, 0.45, 1.33, -0.22, 0.49, '#dc2626', 0.9);
}

/** The level gauge on the big tank: 0..GAUGE_STEPS. */
export const GAUGE_STEPS = 8;
export function drawGauge(p: IsoPen, fill: number): void {
  const h = 0.5 * (fill / GAUGE_STEPS);
  const c = fill <= 1 ? '#ef4444' : fill <= 3 ? '#f59e0b' : '#22c55e';
  p.line(0, 0, 0.1, 0, 0, 0.1 + Math.max(0.012, h), c, 2.4);
  // the float marker
  p.line(-0.03, 0.03, 0.1 + h, 0.03, -0.03, 0.1 + h, '#111827', 1.4);
}

/** Parts store: a ribbed warehouse, roller door up (shelves inside), loading dock, forklift, pallets. Center anchor 2.0 x 1.4. */
export function drawPartsStore(p: IsoPen): void {
  p.shadow(0.0, 0.0, 54, 24, 0.18);
  p.box(-1.0, -0.7, 1.0, 0.7, 0, 0.8, '#dbe4ee');
  for (let x = -0.9; x < 1.0; x += 0.14) p.line(x, 0.7, 0.02, x, 0.7, 0.78, '#b6c2cf', 0.7);
  for (let y = -0.6; y < 0.7; y += 0.14) p.line(1.0, y, 0.02, 1.0, y, 0.78, '#a9b6c4', 0.7);
  // the open roller door: dark inside, shelves with boxes in many colors
  p.poly([-0.55, 0.7, 0.06, 0.25, 0.7, 0.06, 0.25, 0.7, 0.6, -0.55, 0.7, 0.6], '#1f2937');
  const box = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#a855f7', '#eab308'];
  for (let row = 0; row < 3; row++) {
    const z = 0.12 + row * 0.15;
    p.line(-0.5, 0.69, z, 0.2, 0.69, z, '#64748b', 1);
    for (let k = 0; k < 5; k++) {
      const x = -0.47 + k * 0.135;
      p.poly([x, 0.69, z + 0.01, x + 0.09, 0.69, z + 0.01, x + 0.09, 0.69, z + 0.09, x, 0.69, z + 0.09], box[(row * 2 + k) % box.length], false);
    }
  }
  p.poly([-0.57, 0.7, 0.6, 0.27, 0.7, 0.6, 0.27, 0.7, 0.66, -0.57, 0.7, 0.66], '#94a3b8');
  // dock leveller and bumpers
  p.box(-0.6, 0.7, 0.3, 0.95, 0, 0.06, '#9ca3af');
  p.box(-0.62, 0.7, -0.56, 0.74, 0.06, 0.16, '#111827');
  p.box(0.26, 0.7, 0.32, 0.74, 0.06, 0.16, '#111827');
  // a small office corner with a window and a sign (a gear on blue)
  p.poly([0.45, 0.7, 0.3, 0.85, 0.7, 0.3, 0.85, 0.7, 0.55, 0.45, 0.7, 0.55], '#7dd3fc');
  p.poly([0.5, 0.7, 0.62, 0.9, 0.7, 0.62, 0.9, 0.7, 0.76, 0.5, 0.7, 0.76], '#1d4ed8');
  p.circle(0.6, 0.71, 0.69, 2.6, '#f8fafc', false);
  // shallow roof with a skylight strip and a vent
  p.gableX(-1.0, -0.7, 1.0, 0.7, 0.8, 0.18, '#8b98a8', 0.06);
  p.box(0.5, -0.3, 0.68, -0.12, 0.88, 1.0, '#94a3b8');
  // forklift: yellow body, mast, forks with a pallet of crates
  p.shadow(0.75, 1.2, 14, 6, 0.2);
  p.box(0.6, 1.05, 0.88, 1.28, 0.03, 0.18, '#facc15');
  p.box(0.66, 1.12, 0.82, 1.24, 0.18, 0.3, '#1f2937');
  p.line(0.58, 1.1, 0.03, 0.58, 1.1, 0.42, '#334155', 1.6);
  p.line(0.58, 1.24, 0.03, 0.58, 1.24, 0.42, '#334155', 1.6);
  p.box(0.38, 1.08, 0.56, 1.26, 0.06, 0.09, '#a16207');
  p.box(0.4, 1.1, 0.54, 1.24, 0.09, 0.2, '#d97706');
  // pallets by the door
  p.box(-0.95, 0.85, -0.7, 1.08, 0, 0.05, '#a16207');
  p.box(-0.93, 0.87, -0.72, 1.06, 0.05, 0.22, '#e2e8f0');
  p.box(-0.93, 0.87, -0.72, 1.06, 0.22, 0.25, '#3b82f6', false);
}

/**
 * Maintenance hangar: an arched roof over two big door openings toward +y
 * (open where a bay is built), lights inside, a blue fascia band, side
 * windows. Footprint corner anchor, 6.2 x 2.6 tiles.
 */
export function drawHangar(p: IsoPen, bays: number): void {
  const W = 6.2;
  const D = 2.6;
  const H = 1.15;
  p.shadow(W / 2, D / 2, 130, 56, 0.22);
  p.box(0, 0, W, D, 0, H, '#e5e9ef');
  // side windows (+x end) and a personnel door
  for (let y = 0.3; y < D - 0.3; y += 0.36) p.poly([W, y, 0.62, W, y + 0.24, 0.62, W, y + 0.24, 0.86, W, y, 0.86], '#93c5fd');
  p.poly([W, D - 0.55, 0, W, D - 0.3, 0, W, D - 0.3, 0.45, W, D - 0.55, 0.45], '#475569');
  // the two door openings on the apron side
  const doors: [number, number][] = [
    [0.22, 2.95],
    [3.25, 5.98],
  ];
  doors.forEach(([x0, x1], i) => {
    const open = i < bays;
    if (open) {
      p.poly([x0, D, 0, x1, D, 0, x1, D, 1.0, x0, D, 1.0], '#1e293b');
      // lights hanging from the trusses, a work platform and a tool cart inside
      for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.45) p.box(x, D - 0.02, x + 0.18, D, 0.9, 0.93, '#fef9c3', false);
      p.poly([x0 + 0.1, D, 0.02, x1 - 0.1, D, 0.02, x1 - 0.1, D, 0.05, x0 + 0.1, D, 0.05], '#475569', false);
      p.box(x0 + 0.25, D - 0.05, x0 + 0.55, D, 0.05, 0.4, '#facc15', false);
      p.box(x1 - 0.55, D - 0.05, x1 - 0.3, D, 0.05, 0.22, '#dc2626', false);
      // the door leaves slid aside
      p.box(x0 - 0.04, D, x0 + 0.06, D + 0.08, 0, 1.0, '#cbd5e1');
      p.box(x1 - 0.06, D, x1 + 0.04, D + 0.08, 0, 1.0, '#cbd5e1');
    } else {
      // closed: ribbed panels
      p.poly([x0, D, 0, x1, D, 0, x1, D, 1.0, x0, D, 1.0], '#cbd5e1');
      for (let x = x0 + 0.34; x < x1; x += 0.34) p.line(x, D + 0.002, 0, x, D + 0.002, 1.0, '#94a3b8', 0.9);
    }
  });
  // fascia band over the doors with a white wordmark of squares
  p.poly([0, D, 1.0, W, D, 1.0, W, D, H, 0, D, H], '#1d4ed8');
  for (let k = 0; k < 6; k++) p.poly([2.6 + k * 0.17, D + 0.002, 1.04, 2.72 + k * 0.17, D + 0.002, 1.04, 2.72 + k * 0.17, D + 0.002, 1.11, 2.6 + k * 0.17, D + 0.002, 1.11], '#f8fafc', false);
  // arched roof across y: strips from the back to the front, ribs along x
  const N = 10;
  const zAt = (t: number) => H + 0.55 * Math.sin(Math.PI * t);
  for (let k = 0; k < N; k++) {
    const t0 = k / N;
    const t1 = (k + 1) / N;
    const y0 = t0 * D;
    const y1 = t1 * D;
    const slope = Math.cos(Math.PI * (t0 + t1) * 0.5);
    p.poly([-0.05, y0, zAt(t0), W + 0.05, y0, zAt(t0), W + 0.05, y1, zAt(t1), -0.05, y1, zAt(t1)], shade('#94a3b8', 0.12 * slope - 0.05 * (1 - Math.abs(slope))), false);
  }
  for (let x = 0.0; x <= W + 0.01; x += 0.62) {
    for (let k = 0; k < N; k++) {
      const t0 = k / N;
      const t1 = (k + 1) / N;
      p.line(x, t0 * D, zAt(t0) + 0.005, x, t1 * D, zAt(t1) + 0.005, '#7c8a9c', 0.8);
    }
  }
  // the arched gable end (+x)
  const end: number[] = [W, 0, H];
  for (let k = 0; k <= N; k++) end.push(W, (k / N) * D, zAt(k / N));
  end.push(W, D, H);
  p.poly(end, '#d6dce4', false);
  // a skylight ridge and a windsock-style beacon on top
  p.box(W * 0.2, D * 0.45, W * 0.8, D * 0.55, zAt(0.5), zAt(0.5) + 0.04, '#bae6fd', false);
  p.line(W - 0.3, D * 0.5, zAt(0.5), W - 0.3, D * 0.5, zAt(0.5) + 0.3, '#64748b', 1.2);
  p.circle(W - 0.3, D * 0.5, zAt(0.5) + 0.32, 2.2, '#ef4444', false);
}

/** Gate in the north fence: a guard booth and a raised boom. */
export function drawGateBooth(p: IsoPen): void {
  p.shadow(0.2, 0.2, 18, 8, 0.2);
  p.box(0, 0, 0.36, 0.36, 0, 0.42, '#f1f5f9');
  p.poly([0.36, 0.06, 0.18, 0.36, 0.3, 0.18, 0.36, 0.3, 0.36, 0.36, 0.06, 0.36], '#7dd3fc');
  p.poly([0.06, 0.36, 0.18, 0.3, 0.36, 0.18, 0.3, 0.36, 0.36, 0.06, 0.36, 0.36], '#7dd3fc');
  p.box(-0.04, -0.04, 0.4, 0.4, 0.42, 0.47, '#1d4ed8');
  // the boom: a post and a striped arm raised at an angle
  p.box(0.45, 0.4, 0.53, 0.48, 0, 0.3, '#475569');
  for (let k = 0; k < 6; k++) {
    const a = k / 6;
    const b = (k + 1) / 6;
    p.line(0.49 + a * 0.35, 0.44, 0.3 + a * 0.75, 0.49 + b * 0.35, 0.44, 0.3 + b * 0.75, k % 2 ? '#f8fafc' : '#ef4444', 2.2);
  }
}

/** A traffic cone with a reflective band, a tripod warning triangle (AOG). */
export function drawWarnTriangle(p: IsoPen): void {
  p.line(-0.06, 0, 0, 0, 0, 0.14, '#111827', 1);
  p.line(0.06, 0, 0, 0, 0, 0.14, '#111827', 1);
  p.poly([-0.09, 0, 0.12, 0.09, 0, 0.12, 0, 0, 0.28], '#ef4444');
  p.poly([-0.05, 0, 0.15, 0.05, 0, 0.15, 0, 0, 0.24], '#f8fafc', false);
}

// ------------------------------------------------------------------ incidents (M11)

/** Fire station: two bays with red roll-up doors, a hose-drying tower, a siren. Footprint corner anchor 1.7 x 1.3. */
export function drawFireStation(p: IsoPen): void {
  p.shadow(0.85, 0.65, 50, 22, 0.2);
  p.box(0, 0, 1.7, 1.3, 0, 0.62, '#f1f5f9');
  // two red doors on the apron side with windows across the top
  for (const x0 of [0.12, 0.9]) {
    p.poly([x0, 1.3, 0.02, x0 + 0.68, 1.3, 0.02, x0 + 0.68, 1.3, 0.48, x0, 1.3, 0.48], '#dc2626');
    for (let z = 0.08; z < 0.46; z += 0.07) p.line(x0, 1.302, z, x0 + 0.68, 1.302, z, '#b91c1c', 0.7);
    p.poly([x0 + 0.06, 1.303, 0.38, x0 + 0.62, 1.303, 0.38, x0 + 0.62, 1.303, 0.45, x0 + 0.06, 1.303, 0.45], '#bfdbfe', false);
  }
  // red band and a white "112"-style plate
  p.poly([0, 1.3, 0.52, 1.7, 1.3, 0.52, 1.7, 1.3, 0.6, 0, 1.3, 0.6], '#dc2626', false);
  p.poly([0.75, 1.303, 0.53, 0.95, 1.303, 0.53, 0.95, 1.303, 0.59, 0.75, 1.303, 0.59], '#f8fafc', false);
  p.box(-0.04, -0.04, 1.74, 1.34, 0.62, 0.68, '#94a3b8');
  // hose tower at the back corner with a siren on top
  p.box(1.3, 0.05, 1.62, 0.37, 0.62, 1.35, '#e2e8f0');
  p.poly([1.62, 0.12, 0.8, 1.62, 0.3, 0.8, 1.62, 0.3, 1.25, 1.62, 0.12, 1.25], '#cbd5e1');
  p.box(1.28, 0.03, 1.64, 0.39, 1.35, 1.4, '#475569');
  p.circle(1.46, 0.21, 1.47, 3.4, '#ef4444');
  // a hydrant by the door
  p.box(0.02, 1.42, 0.1, 1.5, 0, 0.14, '#ef4444');
  p.circle(0.06, 1.46, 0.15, 2.2, '#b91c1c', false);
}

/** Debris on the runway: a few scattered bits and a glint. */
export function drawDebris(p: IsoPen): void {
  p.poly([-0.12, -0.05, 0.01, 0.0, -0.1, 0.01, 0.06, -0.02, 0.01, -0.04, 0.04, 0.01], '#64748b');
  p.poly([0.1, 0.04, 0.01, 0.18, 0.02, 0.01, 0.16, 0.1, 0.01], '#94a3b8');
  p.box(-0.02, 0.08, 0.06, 0.12, 0, 0.03, '#78716c');
  p.circle(-0.05, 0.12, 0.02, 1.4, '#e2e8f0', false);
}

/** A bird in flight (dark gull), wings up (0) or down (1). */
export function drawBird(p: IsoPen, frame: number): void {
  const up = frame === 0 ? 0.07 : -0.03;
  p.line(0, 0, 0, -0.12, -0.04, up, '#1f2937', 1.6);
  p.line(0, 0, 0, 0.12, 0.04, up, '#1f2937', 1.6);
  p.circle(0, 0, 0, 1.1, '#334155', false);
}

/** VIP red carpet from the stand toward the terminal, gold-edged, with brass stanchions and ropes. Along -y, 1.6 long. */
export function drawRedCarpet(p: IsoPen): void {
  p.poly([-0.17, 0, 0.005, 0.17, 0, 0.005, 0.17, -1.6, 0.005, -0.17, -1.6, 0.005], '#b91c1c', false);
  p.line(-0.17, 0, 0.006, -0.17, -1.6, 0.006, '#facc15', 1.2);
  p.line(0.17, 0, 0.006, 0.17, -1.6, 0.006, '#facc15', 1.2);
  for (const side of [-0.26, 0.26]) {
    for (let k = 0; k < 4; k++) {
      const y = -0.15 - k * 0.45;
      p.line(side, y, 0, side, y, 0.22, '#ca8a04', 1.6);
      p.circle(side, y, 0.23, 1.6, '#fde047', false);
      if (k < 3) p.line(side, y, 0.18, side, y - 0.45, 0.18, '#7f1d1d', 1.4);
    }
  }
}

/** A rain streak (screen-space line slanting with the wind). */
export function drawRain(p: IsoPen): void {
  p.line(0, 0, 0.5, 0.05, 0.05, 0.0, 'rgba(203,213,225,0.75)', 1);
}

// ------------------------------------------------------------------ upgrade versions (owner request)

/** Kiosk version 1: a snack cart on two wheels with a striped umbrella. */
export function drawSnackCart(p: IsoPen): void {
  p.shadow(0.35, 0.25, 22, 9, 0.2);
  p.circle(0.12, 0.42, 0.08, 4, '#1e293b');
  p.circle(0.58, 0.42, 0.08, 4, '#1e293b');
  p.box(0, 0, 0.7, 0.45, 0.1, 0.42, '#fde68a');
  p.box(0, 0.45, 0.7, 0.46, 0.18, 0.36, '#f59e0b', false);
  p.line(0.7, 0.22, 0.32, 0.92, 0.22, 0.38, '#78350f', 2);
  p.line(0.35, 0.22, 0.42, 0.35, 0.22, 0.95, '#e2e8f0', 1.6);
  const r = 0.38;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    p.poly([0.35, 0.22, 1.05, 0.35 + Math.cos(a0) * r, 0.22 + Math.sin(a0) * r, 0.9, 0.35 + Math.cos(a1) * r, 0.22 + Math.sin(a1) * r, 0.9], i % 2 ? '#ffffff' : '#ef4444', false);
  }
}

/** Kiosk version 3: the kiosk with a little terrace, two tables under parasols. */
export function drawCafe(p: IsoPen): void {
  drawKiosk(p);
  for (const [x, y, c] of [
    [1.35, 0.15, '#0ea5e9'],
    [1.35, 0.75, '#22c55e'],
  ] as const) {
    p.shadow(x, y, 14, 6, 0.16);
    p.line(x, y, 0, x, y, 0.28, '#475569', 1.6);
    p.circle(x, y, 0.28, 6, '#f8fafc');
    p.box(x - 0.22, y - 0.05, x - 0.14, y + 0.05, 0, 0.18, '#94a3b8');
    p.box(x + 0.14, y - 0.05, x + 0.22, y + 0.05, 0, 0.18, '#94a3b8');
    p.line(x, y, 0.28, x, y, 0.7, '#e2e8f0', 1.4);
    const r = 0.26;
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.66);
    }
    p.poly(pts, c);
  }
}

/** Kiosk version 4: a glass food shop with a flat roof and a sign on top. */
export function drawFoodShop(p: IsoPen): void {
  p.shadow(0.6, 0.45, 40, 15, 0.22);
  p.box(0, 0, 1.2, 0.9, 0, 0.08, '#cbd5e1');
  p.box(0.04, 0.04, 1.16, 0.86, 0.08, 0.72, '#bae6fd');
  for (let x = 0.24; x < 1.16; x += 0.23) p.line(x, 0.86, 0.08, x, 0.86, 0.72, '#f8fafc', 1.2);
  for (let y = 0.24; y < 0.86; y += 0.23) p.line(1.16, y, 0.08, 1.16, y, 0.72, '#f8fafc', 1.2);
  // the counter and shelves inside, seen through the glass
  p.box(0.2, 0.55, 0.95, 0.7, 0.08, 0.32, '#f59e0b');
  p.box(0.15, 0.1, 0.9, 0.22, 0.08, 0.55, '#e2e8f0');
  p.box(-0.02, -0.02, 1.22, 0.92, 0.72, 0.8, '#1e293b');
  p.box(0.25, 0.4, 0.95, 0.46, 0.8, 1.05, '#f43f5e');
  p.poly([0.3, 0.46, 0.86, 0.9, 0.46, 0.86, 0.9, 0.46, 1.0, 0.3, 0.46, 1.0], '#ffffff', false);
}

/** Billboard version 1: a painted board on two wooden posts. */
export function drawBoardPainted(p: IsoPen): void {
  p.shadow(0.4, 0.1, 26, 7, 0.18);
  p.line(0.15, 0, 0, 0.15, 0, 0.6, '#92400e', 3);
  p.line(0.65, 0, 0, 0.65, 0, 0.6, '#92400e', 3);
  p.poly([0, 0, 0.45, 0.8, 0, 0.45, 0.8, 0, 0.92, 0, 0, 0.92], '#fef3c7');
  p.poly([0.12, 0, 0.62, 0.55, 0, 0.75, 0.6, 0, 0.72, 0.2, 0, 0.6], '#0ea5e9', false);
}

/** Frames of the LED billboards' adverts. */
export const LED_FRAMES = 4;
const LED_ADS: readonly [string, string, string][] = [
  ['#6366f1', '#ffffff', '#fbbf24'],
  ['#ef4444', '#fde68a', '#ffffff'],
  ['#10b981', '#ffffff', '#0ea5e9'],
  ['#f59e0b', '#1e293b', '#ffffff'],
];

/** An advert on an LED screen: a background, a plane or a cup, and a line of text. */
function ledAd(p: IsoPen, x0: number, x1: number, z0: number, z1: number, frame: number): void {
  const [bg, fg, accent] = LED_ADS[frame % LED_ADS.length];
  p.poly([x0, 0.001, z0, x1, 0.001, z0, x1, 0.001, z1, x0, 0.001, z1], bg, false);
  const w = x1 - x0;
  const h = z1 - z0;
  const cx = x0 + w * 0.35;
  const cz = z0 + h * 0.55;
  if (frame % 2 === 0) {
    // a plane climbing
    p.poly([cx - w * 0.18, 0.002, cz - h * 0.1, cx + w * 0.18, 0.002, cz + h * 0.12, cx + w * 0.12, 0.002, cz + h * 0.16, cx - w * 0.2, 0.002, cz - h * 0.04], fg, false);
    p.poly([cx - w * 0.02, 0.002, cz, cx + w * 0.06, 0.002, cz - h * 0.2, cx + w * 0.1, 0.002, cz - h * 0.18, cx + w * 0.06, 0.002, cz + h * 0.04], fg, false);
  } else {
    // a cup of coffee
    p.poly([cx - w * 0.1, 0.002, cz - h * 0.2, cx + w * 0.1, 0.002, cz - h * 0.2, cx + w * 0.12, 0.002, cz + h * 0.15, cx - w * 0.12, 0.002, cz + h * 0.15], fg, false);
  }
  p.circle(x0 + w * 0.82, 0.002, z0 + h * 0.75, 2.5, accent, false);
  for (let k = 0; k < 3; k++) p.line(x0 + w * 0.6, 0.002, z0 + h * (0.25 + k * 0.15), x0 + w * (0.88 - k * 0.08), 0.002, z0 + h * (0.25 + k * 0.15), fg, 1.4);
}

/** Billboard version 3: an LED screen on a steel pole, its advert changing (frame). */
export function drawLedBoard(p: IsoPen, frame: number): void {
  p.shadow(0.5, 0.1, 32, 8, 0.2);
  p.box(0.42, -0.06, 0.58, 0.06, 0, 0.62, '#64748b');
  p.box(-0.08, -0.05, 1.08, 0.0, 0.58, 1.32, '#0f172a');
  ledAd(p, -0.02, 1.02, 0.64, 1.26, frame);
}

/** Billboard version 4: a tall pylon with two LED screens, one above the other. */
export function drawLedTower(p: IsoPen, frame: number): void {
  p.shadow(0.5, 0.1, 38, 9, 0.22);
  p.box(0.38, -0.08, 0.62, 0.08, 0, 2.1, '#475569');
  p.box(-0.12, -0.05, 1.12, 0.0, 0.62, 1.32, '#0f172a');
  ledAd(p, -0.06, 1.06, 0.68, 1.26, frame);
  p.box(-0.12, -0.05, 1.12, 0.0, 1.4, 2.1, '#0f172a');
  ledAd(p, -0.06, 1.06, 1.46, 2.04, frame + 1);
  p.box(-0.14, -0.07, 1.14, 0.02, 2.1, 2.16, '#e2e8f0');
}

/** Benches version 3: a bench under a wooden pergola with climbing plants. */
export function drawPergola(p: IsoPen): void {
  p.shadow(0.35, 0.25, 28, 11, 0.2);
  p.box(0, 0, 0.6, 0.18, 0.12, 0.17, '#b45309');
  p.box(0.02, 0.0, 0.06, 0.18, 0, 0.12, '#78350f');
  p.box(0.54, 0.0, 0.58, 0.18, 0, 0.12, '#78350f');
  for (const [x, y] of [
    [-0.1, -0.1],
    [0.7, -0.1],
    [-0.1, 0.5],
    [0.7, 0.5],
  ] as const) p.box(x - 0.03, y - 0.03, x + 0.03, y + 0.03, 0, 0.8, '#92400e');
  for (let x = -0.15; x <= 0.76; x += 0.13) p.box(x, -0.14, x + 0.04, 0.54, 0.8, 0.84, '#a16207');
  for (const [x, y] of [
    [-0.1, -0.1],
    [0.7, 0.5],
    [0.3, 0.2],
  ] as const) p.circle(x, y, 0.86, 7, '#16a34a', false);
  p.circle(0.7, -0.1, 0.62, 4, '#22c55e', false);
  p.circle(-0.1, 0.5, 0.5, 4, '#22c55e', false);
}

/** Control tower versions: 1 the small one (drawTower), 2 taller with a wider cab, 3 a modern flared one. */
export function drawTowerV(p: IsoPen, v: number): void {
  if (v <= 1) return drawTower(p);
  const shaft = v === 2 ? 2.6 : 3.3;
  const rs = v === 2 ? 8 : 9;
  const cab = v === 2 ? 14 : 17;
  p.shadow(0.35, 0.35, 34, 14, 0.24);
  // the base building
  p.box(-0.32, -0.32, 0.32, 0.32, 0, 0.32, '#cbd5e1');
  for (let z = 0.32; z < shaft; z += 0.03) {
    // (the modern one tapers in and flares out under the cab)
    const k = v === 3 ? 1 - 0.18 * Math.sin(((z - 0.32) / (shaft - 0.32)) * Math.PI) : 1;
    p.circle(0, 0, z, rs * k, z < 0.36 ? '#94a3b8' : '#e2e8f0', false);
  }
  // thin rings up the shaft (its concrete sections)
  for (let z = 0.7; z < shaft - 0.2; z += 0.5) p.circle(0, 0, z, rs + 0.6, '#cbd5e1', false);
  p.circle(0, 0, shaft, cab - 1, '#cbd5e1');
  for (let z = shaft + 0.02; z < shaft + 0.42; z += 0.02) p.circle(0, 0, z, cab - 1 + (z - shaft) * 6, z > shaft + 0.39 ? '#7dd3fc' : '#0ea5e9', false);
  p.circle(0, 0, shaft + 0.44, cab + 2, '#334155');
  p.circle(0, 0, shaft + 0.5, cab - 2, '#475569');
  // antennas and the radar ball on the roof
  p.line(-0.05, 0, shaft + 0.5, -0.05, 0, shaft + 1.0, '#475569', 2);
  p.line(0.08, 0.04, shaft + 0.5, 0.08, 0.04, shaft + 0.8, '#475569', 1.5);
  if (v === 3) p.circle(0.05, -0.05, shaft + 0.62, 5, '#f8fafc');
}

/** The tower's top (where its beacon blinks), in tiles above the ground. */
export function towerTop(v: number): number {
  return v <= 1 ? 2.76 : v === 2 ? 3.6 : 4.3;
}

/** Radar version 3: a white radome on a short tower (it does not turn). */
export function drawRadome(p: IsoPen): void {
  p.shadow(0.1, 0.1, 22, 9, 0.22);
  p.box(-0.26, -0.26, 0.26, 0.26, 0, 0.7, '#94a3b8');
  p.box(-0.3, -0.3, 0.3, 0.3, 0.7, 0.76, '#64748b');
  for (let z = 0.76; z < 1.28; z += 0.02) {
    const r = Math.sqrt(Math.max(0, 1 - ((z - 1.0) / 0.3) ** 2)) * 15;
    p.circle(0, 0, z, r, z > 1.2 ? '#ffffff' : '#f1f5f9', false);
  }
  for (let k = 0; k < 4; k++) p.circle(0, 0, 0.85 + k * 0.1, 15 - Math.abs(k - 1.5) * 2, 'rgba(148,163,184,0.35)', false);
}
