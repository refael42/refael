import { ClipOp, Skia, TileMode, vec, type SkCanvas, type SkPath } from '@shopify/react-native-skia';
import { fill, stroke } from './kit';

// One look for every menu icon (owner M41: "the icons look cheap, make them professional"): the
// same thick plum outline, a top-to-bottom gradient face, a light bevel just inside the edge, a
// gloss over the upper half and a soft drop shadow, like the icons of the big casual games.
// Icons are drawn in a 48 x 48 box around the origin and rendered once to PNGs (src/render/icons.ts).

export const EDGE = '#2A1530';

/** A vertical (or any) linear gradient between two points. */
export function linear(x0: number, y0: number, x1: number, y1: number, colors: readonly string[], stops?: readonly number[]) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeLinearGradient(vec(x0, y0), vec(x1, y1), colors.map((c) => Skia.Color(c)), stops ? [...stops] : null, TileMode.Clamp));
  return p;
}

export function radialPaint(cx: number, cy: number, r: number, colors: readonly string[], stops?: readonly number[]) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeRadialGradient(vec(cx, cy), r, colors.map((c) => Skia.Color(c)), stops ? [...stops] : null, TileMode.Clamp));
  return p;
}

export interface Look {
  /** The face, light at the top to dark at the bottom. */
  light: string;
  base: string;
  dark: string;
  /** Outline width (0: none, for small details on top of a shape). */
  outline?: number;
  shadow?: boolean;
  gloss?: number;
}

/** A shape in the house style: shadow, outline, gradient face, inner bevel, gloss. */
export function shape(c: SkCanvas, p: SkPath, look: Look): void {
  const { light, base, dark, outline = 2.8, shadow = true, gloss = 0.3 } = look;
  const b = p.getBounds();
  if (shadow) {
    c.save();
    c.translate(0, 2.6);
    c.drawPath(p, fill(EDGE, 0.45));
    if (outline > 0) c.drawPath(p, stroke(EDGE, outline, 0.45));
    c.restore();
  }
  if (outline > 0) c.drawPath(p, stroke(EDGE, outline));
  c.drawPath(p, linear(b.x, b.y, b.x + b.width * 0.25, b.y + b.height, [light, base, dark], [0, 0.48, 1]));
  c.save();
  c.clipPath(p, ClipOp.Intersect, true);
  // The bevel: a light line just inside the edge (only its inner half shows), darker below.
  c.drawPath(p, stroke('#FFFFFF', 2.2, 0.32));
  c.translate(0, -1.6);
  c.drawPath(p, stroke(EDGE, 1.6, 0.18));
  c.translate(0, 1.6);
  if (gloss > 0) {
    // Gloss over the upper part, brightest top left.
    const g = Skia.XYWHRect(b.x - b.width * 0.15, b.y - b.height * 0.55, b.width * 1.05, b.height * 0.95);
    c.drawOval(g, linear(b.x, b.y, b.x + b.width * 0.3, b.y + b.height * 0.45, ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'], [0, 1]));
    c.drawOval(g, fill('#FFFFFF', gloss * 0.25));
  }
  c.restore();
}

/** A detail line drawn on top (outlined, so it reads at small sizes). */
export function inkLine(c: SkCanvas, p: SkPath, color: string, width: number): void {
  c.drawPath(p, stroke(EDGE, width + 2));
  c.drawPath(p, stroke(color, width));
}

/** The little white star of light on a shiny surface. */
export function sparkle(c: SkCanvas, x: number, y: number, r: number): void {
  const k = r * 0.28;
  const b = Skia.PathBuilder.Make();
  b.moveTo(x, y - r);
  b.quadTo(x + k, y - k, x + r, y);
  b.quadTo(x + k, y + k, x, y + r);
  b.quadTo(x - k, y + k, x - r, y);
  b.quadTo(x - k, y - k, x, y - r);
  b.close();
  c.drawPath(b.build(), fill('#FFFFFF', 0.95));
}

/** Gold, the house metal. */
export const GOLD: Look = { light: '#FFF4B0', base: '#FFC93A', dark: '#C77A0C' };
export const RED: Look = { light: '#FF8A7A', base: '#E2333A', dark: '#8E1420' };
export const BLUE: Look = { light: '#9FE6FF', base: '#3AA8F0', dark: '#1B4FA8' };
export const GREEN: Look = { light: '#B6F28A', base: '#3FBF4A', dark: '#16702A' };
export const PURPLE: Look = { light: '#E0B6FF', base: '#9A55E6', dark: '#4E1E96' };
export const CREAM: Look = { light: '#FFFFFF', base: '#FFF1D6', dark: '#D9B98A' };
export const STEEL: Look = { light: '#FFFFFF', base: '#C9D2DE', dark: '#6E7B8E' };
export const WOOD: Look = { light: '#F2C08A', base: '#B9763E', dark: '#6E3E1A' };
