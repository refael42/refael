import { glyphAdvance } from './art/glyphs';
import type { SnapWriter } from './scene';
import type { SpriteSet } from './sprites';

/** Glyph unit in world-screen px at scale 1 (matches sprites.ts GU / ATLAS_SCALE). */
const GU = 1.5;

export function textWidth(text: string, scale: number): number {
  let w = 0;
  for (const ch of text) w += glyphAdvance(ch) * GU * scale;
  return w;
}

/** Writes text as overlay glyph sprites centered at (x, y). */
export function overlayText(w: SnapWriter, sp: SpriteSet, text: string, x: number, y: number, scale: number, color: number): void {
  let cx = x - textWidth(text, scale) / 2;
  const top = y - 5 * GU * scale;
  for (const ch of text) {
    w.over(sp.glyph(ch, color), cx, top, scale);
    cx += glyphAdvance(ch) * GU * scale;
  }
}
