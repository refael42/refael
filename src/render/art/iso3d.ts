import { Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';
import { HALF_H, HALF_W, isoX, isoY } from '../iso';
import { darken, lighten } from './color';
import { fill, path, stroke, type Pt } from './kit';

// Low-poly "3D render" look: every solid is flat-shaded with a light top, a mid left face and a
// dark right face (light comes from the upper left). Coordinates: x/y in tiles, z in pixels.

export const P = (x: number, y: number, z = 0): Pt => [isoX(x, y), isoY(x, y, z)];

export interface Shades {
  top: string;
  left: string;
  right: string;
}

/** The house lighting model. `contrast` widens the gap between faces for crisper solids. */
export function shades(base: string, contrast = 1): Shades {
  return {
    top: lighten(base, 0.14 * contrast),
    left: base,
    right: darken(base, 0.24 * contrast),
  };
}

function poly(c: SkCanvas, pts: Pt[], color: string, alpha = 1): void {
  c.drawPath(path.poly(pts), fill(color, alpha));
}

export interface BoxSpec {
  /** Center of the footprint (tiles). */
  x: number;
  y: number;
  /** Bottom height (px). */
  z?: number;
  /** Footprint size along x and y (tiles). */
  w: number;
  d: number;
  /** Height (px). */
  h: number;
  color: string;
  shade?: Partial<Shades>;
  /** Thin bright line along the top edges: the "rendered" crispness of the reference style. */
  rim?: boolean;
  alpha?: number;
}

/** An axis-aligned box; only the three camera-facing faces are drawn. */
export function box(c: SkCanvas, b: BoxSpec): void {
  const s = { ...shades(b.color), ...b.shade };
  const z0 = b.z ?? 0;
  const z1 = z0 + b.h;
  const x0 = b.x - b.w / 2;
  const x1 = b.x + b.w / 2;
  const y0 = b.y - b.d / 2;
  const y1 = b.y + b.d / 2;
  const a = b.alpha ?? 1;
  if (b.h > 0) {
    poly(c, [P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], s.left, a);
    poly(c, [P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)], s.right, a);
  }
  poly(c, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], s.top, a);
  if (b.rim) {
    const rim = stroke(lighten(s.top, 0.5), 0.7, 0.8 * a);
    c.drawPath(path.polyline([P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1)]), rim);
  }
}

/** Upright cylinder (tables, stools, pots, plates). r in tiles. */
export function cylinder(
  c: SkCanvas,
  x: number,
  y: number,
  r: number,
  z0: number,
  h: number,
  color: string,
  topColor?: string,
): void {
  const [cx, cy0] = P(x, y, z0);
  const cy1 = cy0 - h;
  const rx = Math.SQRT2 * r * HALF_W;
  const ry = Math.SQRT2 * r * HALF_H;
  if (h > 0) {
    const side = Skia.PathBuilder.Make();
    side.moveTo(cx - rx, cy1);
    side.lineTo(cx - rx, cy0);
    side.arcToOval(Skia.XYWHRect(cx - rx, cy0 - ry, rx * 2, ry * 2), 180, -180, false);
    side.lineTo(cx + rx, cy1);
    side.close();
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setShader(
      Skia.Shader.MakeLinearGradient(
        vec(cx - rx, 0),
        vec(cx + rx, 0),
        [Skia.Color(lighten(color, 0.08)), Skia.Color(color), Skia.Color(darken(color, 0.3))],
        [0, 0.35, 1],
        TileMode.Clamp,
      ),
    );
    c.drawPath(side.build(), p);
  }
  c.drawOval(Skia.XYWHRect(cx - rx, cy1 - ry, rx * 2, ry * 2), fill(topColor ?? lighten(color, 0.14)));
}

/**
 * Draw on the +x face plane of a box (the right-front face). Inside `draw`, (a, b) are:
 * a = tiles from the face's left end, b = pixels up from the floor.
 */
export function onFaceX(c: SkCanvas, X: number, y1: number, draw: () => void): void {
  c.save();
  c.concat(Skia.Matrix([HALF_W, 0, (X - y1) * HALF_W, -HALF_H, -1, (X + y1) * HALF_H, 0, 0, 1]));
  draw();
  c.restore();
}

/** Draw on the +y face plane (the left-front face); a = tiles from x0, b = pixels up. */
export function onFaceY(c: SkCanvas, Y: number, x0: number, draw: () => void): void {
  c.save();
  c.concat(Skia.Matrix([HALF_W, 0, (x0 - Y) * HALF_W, HALF_H, -1, (x0 + Y) * HALF_H, 0, 0, 1]));
  draw();
  c.restore();
}

/** Draw on a horizontal plane at height z; coordinates are floor tiles. */
export function onTop(c: SkCanvas, z: number, draw: () => void): void {
  c.save();
  c.concat(Skia.Matrix([HALF_W, -HALF_W, 0, HALF_H, HALF_H, -z, 0, 0, 1]));
  draw();
  c.restore();
}

/** Flat rectangle in the current plane (helper for face/top drawing). */
export function rectIn(c: SkCanvas, a: number, b: number, w: number, h: number, color: string, alpha = 1): void {
  c.drawRect(Skia.XYWHRect(a, b, w, h), fill(color, alpha));
}

/** Soft dark ellipse on the floor under an object (no blur: gradients stay cheap and crisp). */
export function floorShadow(c: SkCanvas, x: number, y: number, r: number, alpha = 0.28): void {
  const [cx, cy] = P(x, y, 0);
  const rx = Math.SQRT2 * r * HALF_W;
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(
    Skia.Shader.MakeRadialGradient(vec(0, 0), rx, [Skia.Color(`rgba(20,8,24,${alpha})`), Skia.Color('rgba(20,8,24,0)')], [0.35, 1], TileMode.Clamp),
  );
  c.save();
  c.translate(cx, cy);
  c.scale(1, HALF_H / HALF_W);
  c.drawCircle(0, 0, rx, p);
  c.restore();
}

