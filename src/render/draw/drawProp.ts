import type { SkCanvas } from '@shopify/react-native-skia';
import { F, P as PF } from '../../sim/snapshot';
import { PropKind } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { isoX, isoY } from '../iso';
import { clamp01, easeOutBack, fract, spr, sprFade, sprXf } from './primitives';

// Props are static sprites plus "stateless" effects: every particle position is a pure function
// of time, so steam/bubbles/sparkles cost no memory and never need pooling or cleanup.

/** Screen offset of a point on a prop, relative to its anchor (tiles + px height). */
function ox(x: number, y: number): number {
  'worklet';
  return (x - y) * 32;
}
function oy(x: number, y: number, z: number): number {
  'worklet';
  return (x + y) * 16 - z;
}

function steamColumn(c: SkCanvas, A: RenderAssets, x: number, y: number, t: number, count: number, height: number): void {
  'worklet';
  for (let i = 0; i < count; i++) {
    const age = fract(t * 0.55 + i / count);
    sprFade(c, A, A.S.steam, x + Math.sin(age * 6 + i * 2.1) * 3, y - age * height, 0.6 + age * 1.1, Math.sin(age * Math.PI) * 0.8);
  }
}

function sparkles(c: SkCanvas, A: RenderAssets, x: number, y: number, t: number, spread: number, seed: number): void {
  'worklet';
  for (let i = 0; i < 2; i++) {
    const cycle = t * 0.7 + i * 0.5 + seed;
    const k = Math.floor(cycle);
    const s = Math.sin((cycle - k) * Math.PI);
    sprFade(c, A, A.S.sparkle, x + Math.sin(k * 12.9898 + i) * spread, y + Math.cos(k * 78.233 + i) * spread * 0.4, 0.3 + s * 0.6, s);
  }
}

/** Gentle "tap me" hint above a prop: a pulsing bubble with an icon, plus a progress ring. */
function hint(c: SkCanvas, A: RenderAssets, x: number, y: number, icon: number, progress: number, t: number): void {
  'worklet';
  if (progress > 0) {
    const r = 9;
    c.drawCircle(x, y - 6, r, A.paints.barBack);
    c.drawArc({ x: x - r, y: y - 6 - r, width: r * 2, height: r * 2 }, -90, progress * 360, false, A.paints.ring);
    sprXf(c, A, icon, x, y - 6, Math.sin(t * 30) * 12, 0.8, 0.8, A.paints.plain);
    return;
  }
  const pulse = 1 + Math.sin(t * 5) * 0.07;
  const by = y - Math.abs(Math.sin(t * 2.6)) * 2;
  sprXf(c, A, A.S.bubble, x, by, 0, pulse, pulse, A.paints.plain);
  sprXf(c, A, icon, x, by - 12.6 * pulse, 0, pulse, pulse, A.paints.plain);
}

function drawStove(c: SkCanvas, A: RenderAssets, active: boolean, t: number): void {
  'worklet';
  const S = A.S;
  const P = A.paints;
  spr(c, A, S.stove, 0, 0, P.plain);
  if (!active) return;
  sprFade(c, A, S.ovenGlow, 0, 0, 1, 0.6 + Math.sin(t * 13) * Math.sin(t * 7.3) * 0.3);
  const bx = ox(0.05, -0.45);
  const by = oy(0.05, -0.45, 23);
  for (let i = 0; i < 3; i++) {
    const flick = 0.75 + Math.sin(t * 22 + i * 2.3) * 0.25;
    sprXf(c, A, S.flame, bx - 7 + i * 7, by + 1, 0, flick, flick * (0.9 + Math.sin(t * 17 + i) * 0.2), P.plain);
  }
  spr(c, A, S.pan, bx, by - 1, P.plain);
  // Burger flip: an arc with a fake 3D flip (vertical squash through zero).
  const p = (t % 1.8) / 1.8;
  const air = p < 0.38 ? p / 0.38 : 0;
  const flip = Math.cos(air * Math.PI * 2);
  sprXf(c, A, S.patty, bx, by - 4 - Math.sin(air * Math.PI) * 14, air * 25, 1, Math.max(0.15, Math.abs(flip)), P.plain);
  const px = ox(0.05, 0.45);
  const py = oy(0.05, 0.45, 23);
  spr(c, A, S.pot, px, py, P.plain);
  steamColumn(c, A, px, py - 16, t, 4, 26);
  steamColumn(c, A, bx, by - 8, t + 0.37, 2, 16);
}

function drawSink(c: SkCanvas, A: RenderAssets, active: boolean, t: number): void {
  'worklet';
  const S = A.S;
  spr(c, A, S.sink, 0, 0, A.paints.plain);
  if (!active) return;
  const x = ox(0, 0);
  const y = oy(0, 0, 23);
  sprXf(c, A, S.washPlate, x, y, Math.sin(t * 9) * 14, 1, 1, A.paints.plain);
  for (let i = 0; i < 6; i++) {
    const age = fract(t * 0.6 + i / 6);
    sprFade(c, A, S.soap, x + Math.sin(i * 2.7) * 10 + Math.sin(age * 8 + i) * 1.5, y - age * 16, 0.7 + age * 0.5, Math.sin(age * Math.PI));
  }
  sparkles(c, A, x, y - 4, t, 6, 0.3);
}

function drawTable(c: SkCanvas, A: RenderAssets, variant: number, dish: number, progress: number, bubble: number, t: number): void {
  'worklet';
  const S = A.S;
  const plain = A.paints.plain;
  spr(c, A, S.table, 0, 0, plain);
  const top = oy(0, 0, 17);
  if (variant === 1) {
    spr(c, A, A.L.plate[dish]!, ox(0.06, 0.06), oy(0.06, 0.06, 17), plain);
    spr(c, A, S.glass, ox(-0.12, -0.14), oy(-0.12, -0.14, 17), plain);
  } else if (variant === 2) {
    spr(c, A, S.stain, 0, 0, plain);
    spr(c, A, S.plateDirty, ox(0.05, 0.05), oy(0.05, 0.05, 17), plain);
    spr(c, A, S.glassEmpty, ox(-0.12, -0.14), oy(-0.12, -0.14, 17), plain);
    if (bubble !== 0 || progress > 0) hint(c, A, 0, top - 18, A.S.clean, progress, t);
  }
}

export function drawProp(c: SkCanvas, A: RenderAssets, d: number[], o: number, t: number): void {
  'worklet';
  const S = A.S;
  const plain = A.paints.plain;
  const kind = d[o + PF.kind]!;
  const variant = d[o + PF.variant]!;
  const active = d[o + PF.active]! === 1;
  const wx = d[o + F.x]!;
  const wy = d[o + F.y]!;
  const seed = d[o + F.id]! * 0.71;
  c.save();
  c.translate(isoX(wx, wy), isoY(wx, wy, d[o + PF.lift]!));
  if (kind === PropKind.Stove) drawStove(c, A, active, t);
  else if (kind === PropKind.Sink) drawSink(c, A, active, t);
  else if (kind === PropKind.Table) drawTable(c, A, variant, d[o + PF.level]!, d[o + PF.progress]!, d[o + PF.bubble]!, t);
  else if (kind === PropKind.Chair) spr(c, A, S.chair, 0, 0, plain);
  else if (kind === PropKind.Pass) spr(c, A, S.pass, 0, 0, plain);
  else if (kind === PropKind.PassDish) {
    // Ready dish pops onto the pass, then bobs and sparkles until someone serves it.
    const age = t - d[o + PF.since]!;
    const pop = age < 0.35 ? easeOutBack(clamp01(age / 0.35)) : 1;
    const bobY = -Math.abs(Math.sin(t * 3 + seed)) * 2.5;
    sprXf(c, A, A.L.plate[variant]!, 0, bobY, 0, pop, pop, plain);
    if (age > 0.2) {
      const ring = 1 + fract(t * 0.9 + seed) * 0.8;
      A.paints.fade.setAlphaf(0.9 - fract(t * 0.9 + seed) * 0.9);
      sprXf(c, A, S.ring, 0, -4, 0, ring, ring * 0.5, A.paints.fade);
    }
    sparkles(c, A, 0, -12, t, 8, seed);
  } else if (kind === PropKind.PlatesClean) {
    // Live count: the stack visibly shrinks as dishes go out and grows as they are washed.
    const n = Math.min(10, variant);
    for (let i = 0; i < n; i++) spr(c, A, S.plateSingle, 0, -i * 2.2, plain);
    if (n > 0) sparkles(c, A, 0, -n * 2.2 - 4, t, 8, seed);
    if (d[o + PF.bubble]! !== 0) hint(c, A, 0, -16, A.L.bubble[d[o + PF.bubble]!]!, 0, t);
  } else if (kind === PropKind.PlatesDirty) {
    const n = Math.min(10, variant);
    for (let i = 0; i < n; i++) spr(c, A, S.plateSingleDirty, Math.sin(i * 2.3) * 1.6, -i * 2.4, plain);
    const progress = d[o + PF.progress]!;
    if (progress > 0.01 && n > 0) hint(c, A, 0, -n * 2.4 - 14, S.clean, progress, t);
  } else if (kind === PropKind.Ticket) {
    // New tickets swing on their clip, then settle with a gentle sway.
    const age = t - d[o + PF.since]!;
    const swing = Math.sin(age * 11) * Math.exp(-age * 2.5) * 22 + Math.sin(t * 1.7 + seed) * 2;
    c.save();
    c.rotate(swing, 0, 0);
    spr(c, A, S.ticket, 0, 0, plain);
    sprXf(c, A, A.L.dishIcon[variant]!, -0.4, 8, 0, 0.55, 0.55, plain);
    if (active) {
      const progress = d[o + PF.progress]!;
      c.drawRect({ x: -4.4, y: 14.8, width: 8, height: 1.6 }, A.paints.barBack);
      c.drawRect({ x: -4.4, y: 14.8, width: 8 * progress, height: 1.6 }, A.paints.barGood);
    }
    c.restore();
  } else if (kind === PropKind.Fridge) spr(c, A, S.fridge, 0, 0, plain);
  else if (kind === PropKind.Plant) sprXf(c, A, variant === 1 ? S.plantBush : S.plantPalm, 0, 0, Math.sin(t * 1.1 + seed) * 1.4, 1, 1, plain);
  else if (kind === PropKind.Tree) sprXf(c, A, variant === 1 ? S.treeRound : S.treePalm, 0, 0, Math.sin(t * 0.8 + seed) * 1.2, 1, 1, plain);
  else if (kind === PropKind.Lamp) {
    spr(c, A, S.lamp, 0, 0, plain);
    sprFade(c, A, S.glowHalo, 0, oy(0, 0, 76), 1, 0.75 + Math.sin(t * 2 + seed) * 0.2);
  } else if (kind === PropKind.SaleSign) spr(c, A, S.saleSign, 0, 0, plain);
  else if (kind === PropKind.Neon) {
    spr(c, A, S.neonBoard, 0, 0, plain);
    // Mostly on, with the occasional cheap-neon stutter.
    const stutter = Math.sin(t * 31) * Math.sin(t * 7.7 + seed) > 0.82;
    sprFade(c, A, S.neonLit, 0, 0, 1, stutter ? 0.25 : 0.92 + Math.sin(t * 9) * 0.08);
  }
  c.restore();
}
