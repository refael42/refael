import {
  BlurStyle,
  ClipOp,
  PaintStyle,
  PathOp,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkPaint,
  type SkPath,
} from '@shopify/react-native-skia';
import { darken, lighten } from './color';

/** Ink = the outline color shared by every sprite; a single ink is what makes the style cohesive. */
export const INK = '#4A2F27';
export const LINE = 1.5;

export type Pt = readonly [number, number];

export function fill(color: string, alpha = 1): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  p.setAlphaf(alpha);
  return p;
}

export function stroke(color: string, width: number, alpha = 1): SkPaint {
  const p = fill(color, alpha);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeJoin(StrokeJoin.Round);
  p.setStrokeCap(StrokeCap.Round);
  return p;
}

export function blurred(color: string, alpha: number, sigma: number): SkPaint {
  const p = fill(color, alpha);
  p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, true));
  return p;
}

/** Soft glowing line (neon tubes, magic sparkles). */
export function glowStroke(color: string, width: number, alpha: number, sigma: number): SkPaint {
  const p = stroke(color, width, alpha);
  p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, true));
  return p;
}

export const rect = (x: number, y: number, w: number, h: number) => Skia.XYWHRect(x, y, w, h);

function builderPath(pts: readonly Pt[], closed: boolean): SkPath {
  const b = Skia.PathBuilder.Make();
  pts.forEach(([x, y], i) => (i === 0 ? b.moveTo(x, y) : b.lineTo(x, y)));
  if (closed) b.close();
  return b.build();
}

function combine(a: SkPath, b: SkPath, op: PathOp): SkPath {
  return Skia.Path.MakeFromOp(a, b, op) ?? a;
}

export const path = {
  rrect: (x: number, y: number, w: number, h: number, r: number) => Skia.Path.RRect(Skia.RRectXY(rect(x, y, w, h), r, r)),
  oval: (cx: number, cy: number, rx: number, ry: number) => Skia.Path.Oval(rect(cx - rx, cy - ry, rx * 2, ry * 2)),
  circle: (cx: number, cy: number, r: number) => Skia.Path.Circle(cx, cy, r),
  poly: (pts: readonly Pt[]) => builderPath(pts, true),
  polyline: (pts: readonly Pt[]) => builderPath(pts, false),
  /** Smooth closed (or open) curve through points (Catmull-Rom). Gives organic, hand-drawn shapes. */
  smooth: (pts: readonly Pt[], closed = true, tension = 1) => {
    const b = Skia.PathBuilder.Make();
    const n = pts.length;
    const at = (i: number) => (closed ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
    b.moveTo(pts[0]![0], pts[0]![1]);
    const segments = closed ? n : n - 1;
    const k = tension / 6;
    for (let i = 0; i < segments; i++) {
      const p0 = at(i - 1);
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = at(i + 2);
      b.cubicTo(
        p1[0] + (p2[0] - p0[0]) * k,
        p1[1] + (p2[1] - p0[1]) * k,
        p2[0] - (p3[0] - p1[0]) * k,
        p2[1] - (p3[1] - p1[1]) * k,
        p2[0],
        p2[1],
      );
    }
    if (closed) b.close();
    return b.build();
  },
  union: (a: SkPath, b: SkPath) => combine(a, b, PathOp.Union),
  minus: (a: SkPath, b: SkPath) => combine(a, b, PathOp.Difference),
};

export interface InkOptions {
  /** Shade color, or false for flat. Defaults to a warm darker tone of the base. */
  shade?: string | false;
  /** Highlight color, or false. Defaults to a lighter tone of the base. */
  light?: string | false;
  line?: number;
  ink?: string | false;
  /** How far the lit area is pushed up-left; bigger objects want bigger values. */
  depth?: number;
  alpha?: number;
}

/**
 * The house style in one function: outline behind, warm shade crescent bottom-right, base,
 * soft highlight top-left. Light always comes from the top-left.
 */
export function ink(c: SkCanvas, p: SkPath, base: string, o: InkOptions = {}): void {
  const line = o.line ?? LINE;
  const depth = o.depth ?? 1.8;
  const alpha = o.alpha ?? 1;
  if (o.ink !== false) c.drawPath(p, stroke(o.ink ?? INK, line * 2, alpha));
  const shade = o.shade === undefined ? darken(base, 0.16) : o.shade;
  c.drawPath(p, fill(shade || base, alpha));
  if (shade || o.light !== false) {
    c.save();
    c.clipPath(p, ClipOp.Intersect, true);
    if (shade) {
      // The lit area is the same shape nudged up-left; the clip leaves a shade crescent.
      c.save();
      c.translate(-depth * 0.55, -depth);
      c.drawPath(p, fill(base, alpha));
      c.restore();
    }
    const light = o.light === undefined ? lighten(base, 0.45) : o.light;
    if (light) {
      const b = p.getBounds();
      c.drawOval(
        rect(b.x + b.width * 0.12, b.y + b.height * 0.1, b.width * 0.42, b.height * 0.28),
        blurred(light, 0.55 * alpha, Math.max(0.6, Math.min(b.width, b.height) * 0.08)),
      );
    }
    c.restore();
  }
}

/** A plain outlined stroke line (seams, mouths, cloth folds). */
export function line(c: SkCanvas, pts: readonly Pt[], color = INK, width = LINE, smoothCurve = false): void {
  c.drawPath(smoothCurve ? path.smooth(pts, false) : path.polyline(pts), stroke(color, width));
}

export function dot(c: SkCanvas, x: number, y: number, r: number, color: string, alpha = 1): void {
  c.drawCircle(x, y, r, fill(color, alpha));
}

/** Soft contact shadow under an object; grounds everything in the scene. */
export function contactShadow(c: SkCanvas, cx: number, cy: number, rx: number, ry: number, alpha = 0.22): void {
  c.drawOval(rect(cx - rx, cy - ry, rx * 2, ry * 2), blurred('#3A1F18', alpha, Math.max(1, ry * 0.45)));
}
