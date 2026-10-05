import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';
import type { RenderAssets } from '../assets';
import { sprXf } from './primitives';

const TRACKING = 0.4;

export function textWidth(A: RenderAssets, text: string, scale: number): number {
  'worklet';
  let w = 0;
  for (let i = 0; i < text.length; i++) w += (A.L.advance[text.charCodeAt(i)] ?? 6) + TRACKING;
  return Math.max(0, w - TRACKING) * scale;
}

/**
 * Draws `text` with the procedural glyph font. (x, y) is the anchor; `align` 0 = left,
 * 0.5 = center, 1 = right; y is the vertical middle of the cap height.
 */
export function drawText(c: SkCanvas, A: RenderAssets, text: string, x: number, y: number, scale: number, paint: SkPaint, align = 0.5): void {
  'worklet';
  let cx = x - textWidth(A, text, scale) * align;
  const top = y - 6 * scale;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const idx = A.L.glyph[code] ?? -1;
    if (idx >= 0) sprXf(c, A, idx, cx, top, 0, scale, scale, paint);
    cx += ((A.L.advance[code] ?? 6) + TRACKING) * scale;
  }
}
