import type { SkCanvas } from '@shopify/react-native-skia';
import { sprite, type SpriteDef } from '../sprite';
import { fill, path, stroke, type Pt } from './kit';

// A tiny chunky stroke font for in-scene numbers ("+12", "x3", "1.5K", "4.2", suffixes aa..zz).
// Drawn in code: no font file to download or license, and it matches the outlined game style.
// Glyph box: 0..12 tall (cap height), lowercase x-height from 5, descenders to 15.

type Stroke = readonly Pt[] | { pts: readonly Pt[]; smooth?: boolean; closed?: boolean; dot?: boolean };

interface Glyph {
  adv: number;
  strokes: readonly Stroke[];
}

const sm = (pts: readonly Pt[], closed = false): Stroke => ({ pts, smooth: true, closed });
const dot = (x: number, y: number): Stroke => ({ pts: [[x, y]], dot: true });

const GLYPHS: Record<string, Glyph> = {
  '0': { adv: 9.6, strokes: [sm([[4, 0], [8, 3], [8, 9], [4, 12], [0, 9], [0, 3]], true)] },
  '1': { adv: 7, strokes: [[[1, 2.8], [4, 0], [4, 12]]] },
  '2': { adv: 9.4, strokes: [sm([[0.5, 3], [4, 0], [7.6, 3], [6, 6.6], [0.5, 12]]), [[0.5, 12], [8, 12]]] },
  '3': { adv: 9.2, strokes: [sm([[0.5, 1.5], [4, 0], [7.5, 2.8], [4, 5.8]]), sm([[4, 5.8], [8, 8.8], [4, 12], [0.5, 10.5]])] },
  '4': { adv: 9.6, strokes: [[[6, 12], [6, 0], [0, 8.4], [8.6, 8.4]]] },
  '5': { adv: 9.2, strokes: [[[7.5, 0], [1, 0], [0.6, 5.2]], sm([[0.6, 5.2], [4, 4.4], [8, 7.6], [4.4, 12], [0.4, 10.8]])] },
  '6': { adv: 9.4, strokes: [sm([[7, 1], [3.6, 0], [0.3, 5], [0.6, 9.5], [4, 12], [7.8, 9], [6.5, 5.8], [3.5, 5.4], [0.6, 7.6]])] },
  '7': { adv: 8.8, strokes: [[[0, 0], [8, 0], [3, 12]]] },
  '8': { adv: 9.4, strokes: [sm([[4, 0], [7.2, 2.8], [4, 5.8], [0.8, 2.8]], true), sm([[4, 5.8], [8, 8.8], [4, 12], [0, 8.8]], true)] },
  '9': { adv: 9.4, strokes: [sm([[7.4, 4.4], [4.4, 6.6], [0.4, 3.6], [3.8, 0], [7.6, 2.6], [7.4, 7.5], [4, 12], [1, 11]])] },
  '+': { adv: 9.4, strokes: [[[4, 3], [4, 11]], [[0, 7], [8, 7]]] },
  '-': { adv: 8.4, strokes: [[[0.6, 7], [7.4, 7]]] },
  '.': { adv: 4, strokes: [dot(1.4, 11.2)] },
  '!': { adv: 4, strokes: [[[1.4, 0], [1.4, 7.6]], dot(1.4, 11.4)] },
  ':': { adv: 4, strokes: [dot(1.4, 4.6), dot(1.4, 11.2)] },
  K: { adv: 9.4, strokes: [[[0.6, 0], [0.6, 12]], [[8, 0], [0.8, 6.8]], [[3, 4.8], [8, 12]]] },
  M: { adv: 11.6, strokes: [[[0.5, 12], [0.5, 0], [5, 7], [9.5, 0], [9.5, 12]]] },
  B: { adv: 9.2, strokes: [[[0.6, 0], [0.6, 12]], sm([[0.6, 0], [5, 0], [7.4, 2.8], [5, 5.8], [0.6, 5.8]]), sm([[0.6, 5.8], [5.6, 5.8], [8, 8.9], [5.6, 12], [0.6, 12]])] },
  T: { adv: 9, strokes: [[[0, 0], [8, 0]], [[4, 0], [4, 12]]] },
  L: { adv: 8.4, strokes: [[[0.8, 0], [0.8, 12], [7.4, 12]]] },
  V: { adv: 9.4, strokes: [[[0.2, 0], [4.2, 12], [8.2, 0]]] },
  a: { adv: 8.2, strokes: [sm([[6, 6.5], [3.5, 5.2], [0.8, 8], [2.5, 12], [6, 10.5]]), [[6.2, 5.4], [6.2, 12]]] },
  b: { adv: 8.2, strokes: [[[0.8, 0], [0.8, 12]], sm([[0.8, 7], [3.8, 5.2], [6.6, 8.5], [3.8, 12], [0.8, 10.5]])] },
  c: { adv: 7.6, strokes: [sm([[6, 6.4], [3.4, 5.2], [0.6, 8.5], [3.4, 12], [6, 10.8]])] },
  d: { adv: 8.2, strokes: [[[6, 0], [6, 12]], sm([[6, 7], [3, 5.2], [0.4, 8.5], [3, 12], [6, 10.5]])] },
  e: { adv: 8, strokes: [sm([[0.8, 8.6], [6.2, 8.6], [5, 5.6], [2.4, 5.4], [0.6, 8.6], [2.6, 12], [6, 11]])] },
  f: { adv: 6.4, strokes: [sm([[5.6, 0.6], [3.4, 0.4], [2.4, 3], [2.4, 12]]), [[0.4, 5.6], [5, 5.6]]] },
  g: { adv: 8.2, strokes: [sm([[6, 7], [3, 5.2], [0.4, 8.3], [3, 11], [6, 9.8]]), sm([[6.2, 5.4], [6.2, 13], [3.4, 15.2], [0.8, 14]])] },
  h: { adv: 8, strokes: [[[0.8, 0], [0.8, 12]], sm([[0.8, 8], [3.6, 5.2], [6, 7], [6, 12]])] },
  i: { adv: 4, strokes: [[[1.6, 5.4], [1.6, 12]], dot(1.6, 2.4)] },
  j: { adv: 5.6, strokes: [sm([[4, 5.4], [4, 13.6], [2.4, 15.2], [0.4, 14.4]]), dot(4, 2.4)] },
  k: { adv: 7.6, strokes: [[[0.8, 0], [0.8, 12]], [[6, 5.2], [0.8, 9.4]], [[2.6, 8.2], [6.2, 12]]] },
  l: { adv: 4.4, strokes: [[[1.6, 0], [1.6, 10.6], [2.8, 12]]] },
  m: { adv: 10.6, strokes: [[[0.6, 5.4], [0.6, 12]], sm([[0.6, 7.6], [2.6, 5.2], [4.6, 7], [4.6, 12]]), sm([[4.6, 7.4], [6.6, 5.2], [8.8, 7], [8.8, 12]])] },
  n: { adv: 8, strokes: [[[0.8, 5.4], [0.8, 12]], sm([[0.8, 8], [3.6, 5.2], [6, 7], [6, 12]])] },
  o: { adv: 8, strokes: [sm([[3.4, 5.2], [6.4, 8.6], [3.4, 12], [0.4, 8.6]], true)] },
  p: { adv: 8.2, strokes: [[[0.8, 5.4], [0.8, 15.4]], sm([[0.8, 7], [3.8, 5.2], [6.6, 8.5], [3.8, 12], [0.8, 10.5]])] },
  q: { adv: 8.2, strokes: [[[6, 5.4], [6, 15.4]], sm([[6, 7], [3, 5.2], [0.4, 8.5], [3, 12], [6, 10.5]])] },
  r: { adv: 6.6, strokes: [[[0.8, 5.4], [0.8, 12]], sm([[0.8, 8.4], [2.8, 5.6], [5.4, 5.6]])] },
  s: { adv: 7.4, strokes: [sm([[5.6, 6], [3, 5.2], [0.8, 6.8], [3, 8.6], [5.6, 10.4], [3, 12], [0.4, 11.2]])] },
  t: { adv: 6.4, strokes: [sm([[2.4, 2], [2.4, 10.6], [3.6, 12], [5.4, 11.4]]), [[0.4, 5.6], [5, 5.6]]] },
  u: { adv: 8, strokes: [sm([[0.8, 5.4], [0.8, 10], [3.2, 12], [6, 10]]), [[6, 5.4], [6, 12]]] },
  v: { adv: 7.6, strokes: [[[0.4, 5.4], [3.2, 12], [6, 5.4]]] },
  w: { adv: 10.2, strokes: [[[0.2, 5.4], [2.2, 12], [4.4, 7.2], [6.6, 12], [8.6, 5.4]]] },
  x: { adv: 7.6, strokes: [[[0.6, 5.4], [6, 12]], [[6, 5.4], [0.6, 12]]] },
  y: { adv: 7.6, strokes: [[[0.4, 5.4], [3.2, 11.4]], sm([[6, 5.4], [3.2, 12], [1.6, 15], [0.2, 15]])] },
  z: { adv: 7.6, strokes: [[[0.6, 5.4], [6, 5.4], [0.6, 12], [6.2, 12]]] },
};

const OUTLINE = '#2A1530';

function drawGlyph(c: SkCanvas, g: Glyph) {
  for (const width of [4.6, 2.6]) {
    const color = width > 3 ? OUTLINE : '#FFFFFF';
    for (const s of g.strokes) {
      const spec = Array.isArray(s) ? { pts: s as readonly Pt[] } : (s as Exclude<Stroke, readonly Pt[]>);
      const paint = stroke(color, width);
      if ('dot' in spec && spec.dot) {
        const [x, y] = spec.pts[0]!;
        c.drawCircle(x, y, width / 2 + 0.3, fill(color));
      } else if ('smooth' in spec && spec.smooth) {
        c.drawPath(path.smooth(spec.pts, spec.closed ?? false), paint);
      } else {
        c.drawPath(path.polyline(spec.pts), paint);
      }
    }
  }
}

export const GLYPH_CHARS = Object.keys(GLYPHS);

/** One sprite per glyph, anchored at the glyph box's top-left. */
export const glyphSprites: Record<string, SpriteDef> = Object.fromEntries(
  GLYPH_CHARS.map((ch) => {
    const g = GLYPHS[ch]!;
    return [`glyph_${ch}`, sprite([-2.6, -2.6, g.adv + 1, 17.6], (c) => drawGlyph(c, g))];
  }),
);

export const GLYPH_ADVANCE: Record<string, number> = Object.fromEntries(GLYPH_CHARS.map((ch) => [ch, GLYPHS[ch]!.adv]));
