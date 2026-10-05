import type { SkCanvas } from '@shopify/react-native-skia';
import { F, P as PF } from '../../sim/snapshot';
import { PropKind } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { fract, spr, sprFade, sprXf } from './primitives';

// Props are static sprites plus "stateless" effects: every particle position is a pure function
// of time, so steam/bubbles/sparkles cost no memory and never need pooling or cleanup.

function steamColumn(c: SkCanvas, A: RenderAssets, x: number, y: number, t: number, count: number, height: number): void {
  'worklet';
  for (let i = 0; i < count; i++) {
    const age = fract(t * 0.55 + i / count);
    const sx = x + Math.sin(age * 6 + i * 2.1) * 3;
    sprFade(c, A, A.S.steam, sx, y - age * height, 0.6 + age * 1.1, Math.sin(age * Math.PI) * 0.75);
  }
}

function sparkles(c: SkCanvas, A: RenderAssets, x: number, y: number, t: number, spread: number, seed: number): void {
  'worklet';
  for (let i = 0; i < 2; i++) {
    const cycle = t * 0.7 + i * 0.5 + seed;
    const k = Math.floor(cycle);
    const age = cycle - k;
    const ox = Math.sin(k * 12.9898 + i) * spread;
    const oy = Math.cos(k * 78.233 + i) * spread * 0.4;
    const s = Math.sin(age * Math.PI);
    sprFade(c, A, A.S.sparkle, x + ox, y + oy, 0.3 + s * 0.6, s);
  }
}

function drawStove(c: SkCanvas, A: RenderAssets, x: number, y: number, active: boolean, t: number): void {
  'worklet';
  const S = A.S;
  const P = A.paints;
  spr(c, A, S.stove, x, y, P.plain);
  if (!active) return;
  sprFade(c, A, S.ovenGlow, x, y, 1, 0.6 + Math.sin(t * 13) * Math.sin(t * 7.3) * 0.3);
  for (let i = 0; i < 3; i++) {
    const flick = 0.75 + Math.sin(t * 22 + i * 2.3) * 0.25;
    sprXf(c, A, S.flame, x - 21 + i * 7, y - 25.5, 0, flick, flick * (0.9 + Math.sin(t * 17 + i) * 0.2), P.plain);
  }
  spr(c, A, S.pan, x - 14, y - 28.6, P.plain);
  // Burger flip: an arc with a fake 3D flip (vertical squash through zero).
  const p = (t % 1.8) / 1.8;
  const air = p < 0.38 ? p / 0.38 : 0;
  const hop = Math.sin(air * Math.PI) * 13;
  const flip = Math.cos(air * Math.PI * 2);
  sprXf(c, A, S.patty, x - 14, y - 30 - hop, air * 30, 1, Math.max(0.15, Math.abs(flip)), P.plain);
  spr(c, A, S.pot, x + 14, y - 27, P.plain);
  steamColumn(c, A, x + 14, y - 42, t, 4, 24);
  steamColumn(c, A, x - 14, y - 34, t + 0.37, 2, 14);
}

function drawSink(c: SkCanvas, A: RenderAssets, x: number, y: number, active: boolean, t: number): void {
  'worklet';
  const S = A.S;
  spr(c, A, S.sink, x, y, A.paints.plain);
  if (!active) return;
  sprXf(c, A, S.washPlate, x - 1, y - 27, Math.sin(t * 9) * 14, 1, 1, A.paints.plain);
  for (let i = 0; i < 6; i++) {
    const age = fract(t * 0.6 + i / 6);
    const bx = x - 1 + Math.sin(i * 2.7) * 13 + Math.sin(age * 8 + i) * 1.5;
    sprFade(c, A, S.soap, bx, y - 27 - age * 16, 0.7 + age * 0.5, Math.sin(age * Math.PI));
  }
  sparkles(c, A, x - 1, y - 30, t, 6, 0.3);
}

function drawTable(c: SkCanvas, A: RenderAssets, x: number, y: number, variant: number): void {
  'worklet';
  const S = A.S;
  const plain = A.paints.plain;
  spr(c, A, S.table, x, y, plain);
  if (variant === 1) {
    spr(c, A, S.plateFood, x - 4, y - 21, plain);
    spr(c, A, S.glass, x + 14, y - 24, plain);
  } else if (variant === 2) {
    spr(c, A, S.stain, x + 7, y - 17, plain);
    spr(c, A, S.plateDirty, x - 5, y - 21, plain);
    spr(c, A, S.glassEmpty, x + 13, y - 25, plain);
  }
}

export function drawProp(c: SkCanvas, A: RenderAssets, d: number[], o: number, t: number): void {
  'worklet';
  const S = A.S;
  const plain = A.paints.plain;
  const kind = d[o + PF.kind]!;
  const variant = d[o + PF.variant]!;
  const active = d[o + PF.active]! === 1;
  const x = d[o + F.x]!;
  const y = d[o + F.y]! - d[o + PF.lift]!;
  const seed = d[o + F.id]! * 0.71;
  if (kind === PropKind.Stove) drawStove(c, A, x, y, active, t);
  else if (kind === PropKind.Sink) drawSink(c, A, x, y, active, t);
  else if (kind === PropKind.Table) drawTable(c, A, x, y, variant);
  else if (kind === PropKind.Chair) spr(c, A, variant === 1 ? S.chairFront : S.chairBehind, x, y, plain);
  else if (kind === PropKind.PlatesClean) {
    spr(c, A, S.platesClean, x, y, plain);
    sparkles(c, A, x, y - 14, t, 8, seed);
  } else if (kind === PropKind.PlatesDirty) spr(c, A, S.platesDirty, x, y, plain);
  else if (kind === PropKind.Plant) {
    sprXf(c, A, variant === 1 ? S.plantSnake : S.plantLeafy, x, y, Math.sin(t * 1.1 + seed) * 1.6, 1, 1, plain);
  } else if (kind === PropKind.Neon) {
    spr(c, A, S.neonBoard, x, y, plain);
    // Mostly on, with the occasional cheap-neon stutter.
    const stutter = Math.sin(t * 31) * Math.sin(t * 7.7 + seed) > 0.82;
    sprFade(c, A, S.neonLit, x, y, 1, stutter ? 0.25 : 0.92 + Math.sin(t * 9) * 0.08);
  }
}
