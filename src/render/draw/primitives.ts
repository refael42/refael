import { FilterMode, MipmapMode, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';
import type { RenderAssets } from '../assets';

// UI-thread drawing helpers. Every function here is a worklet: it runs once per frame per sprite,
// so it must not allocate Skia objects or touch React.

/** Draws sprite `i` with its anchor at (x, y). */
export function spr(c: SkCanvas, A: RenderAssets, i: number, x: number, y: number, paint: SkPaint): void {
  'worklet';
  if (i < 0) return;
  const d = A.dst[i]!;
  c.drawImageRectOptions(
    A.image,
    A.src[i]!,
    { x: x + d.x, y: y + d.y, width: d.width, height: d.height },
    FilterMode.Linear,
    MipmapMode.None,
    paint,
  );
}

/** Draws sprite `i` rotated (degrees, clockwise) and scaled around its anchor. */
export function sprXf(
  c: SkCanvas,
  A: RenderAssets,
  i: number,
  x: number,
  y: number,
  rotation: number,
  sx: number,
  sy: number,
  paint: SkPaint,
): void {
  'worklet';
  if (i < 0) return;
  c.save();
  c.translate(x, y);
  if (rotation !== 0) c.rotate(rotation, 0, 0);
  if (sx !== 1 || sy !== 1) c.scale(sx, sy);
  c.drawImageRectOptions(A.image, A.src[i]!, A.dst[i]!, FilterMode.Linear, MipmapMode.None, paint);
  c.restore();
}

/**
 * A HUD sprite from the sharp (screen-resolution) atlas; falls back to the world atlas.
 * Mipmapped because the HUD draws most of them smaller than they were baked.
 */
export function sharpSpr(c: SkCanvas, A: RenderAssets, i: number, x: number, y: number, scale: number, paint: SkPaint): void {
  'worklet';
  const src = A.sharp.src[i];
  if (!src) {
    sprXf(c, A, i, x, y, 0, scale, scale, paint);
    return;
  }
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  c.drawImageRectOptions(A.sharp.image, src, A.sharp.dst[i]!, FilterMode.Linear, MipmapMode.Linear, paint);
  c.restore();
}

/** Sprite with an alpha fade, using the shared fade paint. */
export function sprFade(c: SkCanvas, A: RenderAssets, i: number, x: number, y: number, scale: number, alpha: number): void {
  'worklet';
  if (alpha <= 0.01) return;
  A.paints.fade.setAlphaf(Math.min(1, alpha));
  sprXf(c, A, i, x, y, 0, scale, scale, A.paints.fade);
}

/** Overshooting ease: makes pop-ins feel springy. */
export function easeOutBack(p: number): number {
  'worklet';
  const c1 = 1.70158;
  const q = p - 1;
  return 1 + (c1 + 1) * q * q * q + c1 * q * q;
}

export function clamp01(v: number): number {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Fractional part, for looping stateless effects (steam, bubbles, sparkles). */
export function fract(v: number): number {
  'worklet';
  return v - Math.floor(v);
}
