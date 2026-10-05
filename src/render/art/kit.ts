import { BlurStyle, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkPaint, type SkPath } from '@shopify/react-native-skia';

// Shared paint and path helpers for the procedural art.

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

/** Soft glowing line (neon tubes, sparkles, flying bills). */
export function glowStroke(color: string, width: number, alpha: number, sigma: number): SkPaint {
  const p = stroke(color, width, alpha);
  p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, true));
  return p;
}

function builderPath(pts: readonly Pt[], closed: boolean): SkPath {
  const b = Skia.PathBuilder.Make();
  pts.forEach(([x, y], i) => (i === 0 ? b.moveTo(x, y) : b.lineTo(x, y)));
  if (closed) b.close();
  return b.build();
}

const rect = (x: number, y: number, w: number, h: number) => Skia.XYWHRect(x, y, w, h);

export const path = {
  rrect: (x: number, y: number, w: number, h: number, r: number) => Skia.Path.RRect(Skia.RRectXY(rect(x, y, w, h), r, r)),
  oval: (cx: number, cy: number, rx: number, ry: number) => Skia.Path.Oval(rect(cx - rx, cy - ry, rx * 2, ry * 2)),
  circle: (cx: number, cy: number, r: number) => Skia.Path.Circle(cx, cy, r),
  poly: (pts: readonly Pt[]) => builderPath(pts, true),
  polyline: (pts: readonly Pt[]) => builderPath(pts, false),
  /** Smooth closed (or open) curve through points (Catmull-Rom). Gives organic shapes. */
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
};
