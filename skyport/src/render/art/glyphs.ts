/**
 * A tiny stroke font for in-world numbers ("+32", "1.2K"). Skia on web has no
 * system fonts, so digits are drawn as rounded strokes with an outline.
 * Glyph box: 6 x 10 units, y down.
 */
import { PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas } from '@shopify/react-native-skia';

import { OUTLINE } from './color';

type Poly = number[];
export const GLYPHS: Record<string, Poly[]> = {
  '0': [[1.2, 0, 4.8, 0, 6, 1.4, 6, 8.6, 4.8, 10, 1.2, 10, 0, 8.6, 0, 1.4, 1.2, 0]],
  '1': [[1.2, 2.2, 3.4, 0, 3.4, 10], [1.2, 10, 5.6, 10]],
  '2': [[0.4, 2, 1.6, 0.2, 4.4, 0.2, 5.8, 1.6, 5.8, 3.6, 0.2, 10, 6, 10]],
  '3': [[0.6, 0.4, 5.6, 0.4, 2.8, 4, 4.8, 4.4, 6, 6.4, 5.6, 8.8, 3.8, 10, 1.6, 10, 0.2, 8.8]],
  '4': [[4.4, 10, 4.4, 0, 0, 7, 6, 7]],
  '5': [[5.6, 0.2, 0.9, 0.2, 0.5, 4.3, 3.4, 3.6, 5.6, 5, 5.8, 8, 4.4, 9.8, 1.6, 10, 0.2, 9]],
  '6': [[5.2, 0.4, 2.6, 0.4, 0.6, 2.8, 0.2, 7, 1.4, 9.8, 4.6, 9.8, 5.8, 8, 5.6, 5.6, 4, 4.2, 1.6, 4.4, 0.3, 6]],
  '7': [[0, 0.2, 6, 0.2, 2.4, 10]],
  '8': [[3, 4.6, 1, 3.6, 0.8, 1.4, 2, 0, 4, 0, 5.2, 1.4, 5, 3.6, 3, 4.6, 0.6, 6, 0.5, 8.6, 2, 10, 4, 10, 5.5, 8.6, 5.4, 6, 3, 4.6]],
  '9': [[5.6, 4, 4.4, 5.6, 1.8, 5.6, 0.3, 4, 0.4, 1.5, 1.8, 0.1, 4.4, 0.1, 5.8, 1.6, 5.8, 6, 4.4, 9, 1.2, 9.9]],
  '+': [[3, 2.6, 3, 8.4], [0.2, 5.5, 5.8, 5.5]],
  '-': [[0.6, 5.5, 5.4, 5.5]],
  '.': [[1, 9.6, 1.01, 9.6]],
  K: [[0.6, 0, 0.6, 10], [5.6, 0, 0.8, 5.4], [2.4, 4, 5.8, 10]],
  M: [[0.2, 10, 0.6, 0, 3, 6.4, 5.4, 0, 5.8, 10]],
  B: [[0.6, 10, 0.6, 0, 3.8, 0, 5.3, 1.2, 5.3, 3.6, 3.8, 4.8, 0.6, 4.8], [3.8, 4.8, 5.6, 6.2, 5.6, 8.6, 4, 10, 0.6, 10]],
  T: [[0, 0.3, 6, 0.3], [3, 0.3, 3, 10]],
  x: [[0.8, 3.5, 5.2, 10], [5.2, 3.5, 0.8, 10]],
};

export const GLYPH_CHARS = Object.keys(GLYPHS);

export function glyphAdvance(ch: string): number {
  return ch === '.' ? 3.2 : ch === '1' ? 6.4 : 7.6;
}

/** Draws one glyph with its top-left at (x, y); unit = pixels per glyph unit. */
export function drawGlyph(canvas: SkCanvas, ch: string, x: number, y: number, unit: number, color: string): void {
  const polys = GLYPHS[ch];
  if (!polys) return;
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeCap(StrokeCap.Round);
  p.setStrokeJoin(StrokeJoin.Round);
  const build = () => {
    const b = Skia.PathBuilder.Make();
    for (const poly of polys) {
      for (let i = 0; i < poly.length; i += 2) {
        const px = x + poly[i] * unit;
        const py = y + poly[i + 1] * unit;
        if (i === 0) b.moveTo(px, py);
        else b.lineTo(px, py);
      }
    }
    return b.build();
  };
  const path = build();
  p.setColor(Skia.Color(OUTLINE));
  p.setStrokeWidth(unit * 4.2);
  canvas.drawPath(path, p);
  p.setColor(Skia.Color(color));
  p.setStrokeWidth(unit * 2.2);
  canvas.drawPath(path, p);
}
