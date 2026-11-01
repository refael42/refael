/**
 * Static scenery and buildings with a fixed orientation: iso boxes with real
 * face shading, roofs, trees, the windsock and the fuel pump.
 * Coordinates: world tiles relative to the object origin; output in pixels.
 */
import { PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';

import { HALF_H, HALF_W, Z_PX } from '../iso';
import { OUTLINE, shade } from './color';

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
  poly(pts: number[], color: string, outline = true, ow = 2.2, alpha = 1): void {
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
      s.setColor(Skia.Color(OUTLINE));
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
      f.setColor(Skia.Color(OUTLINE));
      this.canvas.drawCircle(cx, cy, r * this.sc + 1.2 * (this.sc / 2), f);
    }
    f.setColor(Skia.Color(color));
    this.canvas.drawCircle(cx, cy, r * this.sc, f);
  }

  shadow(x: number, y: number, rx: number, ry: number, alpha = 0.22): void {
    const { f } = paints();
    f.setColor(Skia.Color(`rgba(15,35,20,${alpha})`));
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
  p.line(0, 0, 0, 0, 0, 1.25, '#d8dce3', 2.2);
  p.line(0, 0, 0, 0, 0, 1.25, OUTLINE, 0.6);
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

export function drawTree(p: IsoPen, kind: TreeKind, size: number): void {
  const s = size;
  if (kind === 'bush') {
    p.shadow(0, 0, 20 * s, 8 * s, 0.22);
    p.circle(-0.12 * s, 0.05 * s, 0.14 * s, 9 * s, '#4f9d4a');
    p.circle(0.12 * s, -0.04 * s, 0.16 * s, 10 * s, '#5aad52');
    p.circle(0.0, 0.0, 0.24 * s, 9 * s, '#68bd5c');
    p.circle(-0.03 * s, -0.03 * s, 0.3 * s, 3.5 * s, '#8fd67a', false);
    return;
  }
  if (kind === 'pine') {
    p.shadow(0, 0, 16 * s, 7 * s, 0.24);
    p.line(0, 0, 0, 0, 0, 0.3 * s, '#7a4a2a', 5 * s);
    const tiers = [
      { z: 0.22, w: 0.3, h: 0.55, c: '#2f7d4f' },
      { z: 0.5, w: 0.24, h: 0.5, c: '#38905a' },
      { z: 0.78, w: 0.17, h: 0.45, c: '#44a466' },
    ];
    for (const t of tiers) {
      const z = t.z * s;
      p.poly([-t.w * s, t.w * s, z, t.w * s, -t.w * s, z, 0, 0, z + t.h * s], t.c, true, 2.2);
      p.poly([0.02 * s, 0.02 * s, z, t.w * s, -t.w * s, z, 0, 0, z + t.h * s], shade(t.c, -0.15), false);
    }
    return;
  }
  const leaf = kind === 'roundDark' ? '#3f8f4a' : kind === 'birch' ? '#8cc657' : '#5aad52';
  p.shadow(0, 0, 22 * s, 9 * s, 0.24);
  p.line(0, 0, 0, 0, 0, 0.45 * s, kind === 'birch' ? '#e8e2d6' : '#7a4a2a', 5 * s);
  p.circle(-0.12 * s, 0.1 * s, 0.62 * s, 12 * s, shade(leaf, -0.12));
  p.circle(0.14 * s, -0.08 * s, 0.66 * s, 12 * s, shade(leaf, -0.04));
  p.circle(0, 0, 0.82 * s, 13 * s, leaf);
  p.circle(-0.05 * s, -0.05 * s, 0.95 * s, 6 * s, shade(leaf, 0.3), false);
}

/** Small rock. */
export function drawRock(p: IsoPen, size: number): void {
  p.shadow(0, 0, 10 * size, 4 * size, 0.2);
  p.poly([-0.12 * size, 0.05 * size, 0, 0.1 * size, -0.08 * size, 0, 0.14 * size, 0.06 * size, 0.08 * size, -0.02 * size, 0.1 * size, 0.16 * size], '#9aa0a8');
}
