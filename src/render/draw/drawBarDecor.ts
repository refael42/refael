import type { SkCanvas } from '@shopify/react-native-skia';
import type { RenderAssets } from '../assets';
import { fract, spr, sprFade } from './primitives';

// The bar's pieces come alive (owner M30; art in src/render/art/barDecorArt.ts): glints on the
// hanging glasses, foam on a pint while the bartenders work, the neon's glow and its stutter,
// dry-ice fog rolling off the bowl, bubbles up the champagne tower, the chandelier's sparkle.

const RACK = 0;
const TAPS = 1;
const NEON = 2;
const DRY_ICE = 3;
const CHAMPAGNE = 4;
const CHANDELIER = 5;

export function drawBarDecor(c: SkCanvas, A: RenderAssets, piece: number, active: boolean, t: number, seed: number): void {
  'worklet';
  const S = A.S;
  spr(c, A, A.L.barDecor[piece] ?? -1, 0, 0, A.paints.plain);
  if (piece === RACK) {
    const g = fract(t * 0.7 + seed);
    sprFade(c, A, S.sparkle, -8 + Math.sin(Math.floor(t * 0.7 + seed) * 3.1) * 14, -62, 0.4 + g * 0.3, Math.sin(g * Math.PI));
  } else if (piece === TAPS) {
    if (active) {
      const g = fract(t * 1.4 + seed);
      sprFade(c, A, S.sparkle, 6, -16, 0.35 + g * 0.3, Math.sin(g * Math.PI));
    }
  } else if (piece === NEON) {
    // Mostly on, a cheap tube's stutter now and then.
    const stutter = Math.sin(t * 29 + seed) * Math.sin(t * 6.1) > 0.9;
    sprFade(c, A, S.glowHalo, 0, -14, 0.55, stutter ? 0.12 : 0.42 + Math.sin(t * 2.2) * 0.08);
  } else if (piece === DRY_ICE) {
    // Fog rolls over the rim and spreads along the counter.
    for (let i = 0; i < 4; i++) {
      const age = fract(t * 0.35 + i / 4 + seed);
      sprFade(c, A, S.steam, Math.sin(i * 2.3 + age * 3) * (4 + age * 10), -8 - age * 6, 0.7 + age * 1.6, Math.sin(age * Math.PI) * 0.7);
    }
  } else if (piece === CHAMPAGNE) {
    for (let i = 0; i < 3; i++) {
      const age = fract(t * 1.1 + i / 3 + seed);
      sprFade(c, A, S.sparkle, Math.sin(i * 4.1) * 5, -6 - age * 18, 0.25 + age * 0.2, 1 - age);
    }
  } else if (piece === CHANDELIER) {
    sprFade(c, A, S.glowHalo, 0, -66, 0.9, 0.35 + Math.sin(t * 1.6 + seed) * 0.08);
    for (let i = 0; i < 3; i++) {
      const g = fract(t * 0.9 + i / 3 + seed);
      const a = (Math.floor(t * 0.9 + i / 3 + seed) * 2.7 + i) % 6.28;
      sprFade(c, A, S.sparkle, Math.cos(a) * 14, -62 + Math.sin(a) * 6, 0.35 + g * 0.3, Math.sin(g * Math.PI));
    }
  }
}
