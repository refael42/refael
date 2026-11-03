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
export function drawScanner(p: IsoPen): void {
  p.shadow(0.2, 0.1, 22, 8, 0.18);
  p.box(-0.3, -0.06, -0.22, 0.06, 0, 0.72, '#cbd5e1');
  p.box(0.22, -0.06, 0.3, 0.06, 0, 0.72, '#cbd5e1');
  p.box(-0.3, -0.06, 0.3, 0.06, 0.72, 0.8, '#94a3b8');
  p.circle(0, 0, 0.8, 2.2, '#22c55e', false);
  p.box(0.42, -0.2, 0.95, 0.2, 0, 0.36, '#64748b');
  p.box(0.4, -0.22, 0.97, 0.22, 0.36, 0.42, '#334155');
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
