import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';
import { F, P as PF, W, WORK_STRIDE } from '../../sim/snapshot';
import { drawText } from './text';
import { PropKind } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { isoX, isoY } from '../iso';
import { clamp01, easeOutBack, fract, spr, sprFade, sprXf } from './primitives';
import { EXPAND } from '../../data/upgrades';
import { LOOKS } from '../art/stationArt';

const EXPAND_TIER = EXPAND.tier;

// Props are static sprites plus "stateless" effects: every particle position is a pure function
// of time, so steam/bubbles/sparkles cost no memory and never need pooling or cleanup.

/** Upgrade state the renderer needs per frame (from the snapshot, plus the UI's selection). */
export interface PropLooks {
  tiers: number[];
  dishTiers: number[];
  bumps: number[];
  /** The prop the player tapped (its upgrades are open): [kind, x, y], or empty. Only that one is outlined. */
  selected: number[];
  /** Full detail (glows, sparkles on every table and chair), false when zoomed far out. */
  detail: boolean;
  /** The branch's city (its trees). */
  city: number;
}

/** Past the last baked look, stations keep a golden aura that grows with every milestone. */
const AURA_TIER = 4;

/** The sprite for a milestone tier: the last of the four looks, or the expanded model from level 100. */
function look(L: number[], tier: number): number {
  'worklet';
  if (tier >= EXPAND_TIER && L.length > LOOKS) return L[LOOKS]!;
  return L[Math.min(LOOKS - 1, L.length - 1, tier)]!;
}

/** A sprite drawn 8 times around itself as a flat silhouette: an outline or a glow. */
function silhouette(c: SkCanvas, A: RenderAssets, i: number, paint: SkPaint, w: number): void {
  'worklet';
  // Six copies read as an outline; every copy is a full sprite draw (so only the tapped piece gets one).
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    spr(c, A, i, Math.cos(a) * w, Math.sin(a) * w * 0.8, paint);
  }
}

/** The main sprite of a prop, used to outline or glow it. -1 = none. */
function baseSprite(A: RenderAssets, kind: number, variant: number, tier: number): number {
  'worklet';
  const L = A.L.look;
  if (kind === PropKind.Stove) return look(L.stove, tier);
  if (kind === PropKind.Sink) return look(L.sink, tier);
  if (kind === PropKind.Fridge) return look(L.fridge, tier);
  if (kind === PropKind.Table) return look(L.table, tier);
  if (kind === PropKind.Chair) return look(variant === 2 ? L.chairRest : variant === 1 ? L.chairSeat : L.chair, tier);
  if (kind === PropKind.Plant) return look(variant === 1 ? L.plantBush : L.plantPalm, tier);
  if (kind === PropKind.Neon) return look(L.neonBoard, tier);
  if (kind === PropKind.StreetSign) return look(L.streetSign, tier);
  if (kind === PropKind.Flowers) return look(L.flowers, tier);
  if (kind === PropKind.FloorLamp) return look(L.floorLamp, tier);
  if (kind === PropKind.Aquarium) return look(L.aquarium, tier);
  if (kind === PropKind.Statue) return look(L.statue, tier);
  if (kind === PropKind.Fountain) return look(L.fountain, tier);
  if (kind === PropKind.Piano) return look(L.piano, tier);
  if (kind === PropKind.Pass) return variant === 1 ? A.S.passLong : A.S.pass;
  if (kind === PropKind.TableSlot) return A.S.tableSlot;
  if (kind === PropKind.StoveSlot) return A.S.stoveSlot;
  return -1;
}

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

function sparkles(c: SkCanvas, A: RenderAssets, x: number, y: number, t: number, spread: number, seed: number, count = 2): void {
  'worklet';
  for (let i = 0; i < count; i++) {
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

function drawStove(c: SkCanvas, A: RenderAssets, active: boolean, t: number, tier: number): void {
  'worklet';
  const S = A.S;
  const P = A.paints;
  spr(c, A, look(A.L.look.stove, tier), 0, 0, P.plain);
  if (!active) return;
  // Better stoves burn hotter: bigger flames.
  const heat = 1 + Math.min(tier, AURA_TIER) * 0.12;
  sprFade(c, A, S.ovenGlow, 0, 0, 1, 0.6 + Math.sin(t * 13) * Math.sin(t * 7.3) * 0.3);
  const bx = ox(0.05, -0.45);
  const by = oy(0.05, -0.45, 23);
  for (let i = 0; i < 3; i++) {
    const flick = 0.75 + Math.sin(t * 22 + i * 2.3) * 0.25;
    sprXf(c, A, S.flame, bx - 7 + i * 7, by + 1, 0, flick * heat, flick * heat * (0.9 + Math.sin(t * 17 + i) * 0.2), P.plain);
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

function drawSink(c: SkCanvas, A: RenderAssets, active: boolean, t: number, tier: number): void {
  'worklet';
  const S = A.S;
  spr(c, A, look(A.L.look.sink, tier), 0, 0, A.paints.plain);
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

/**
 * A table and what is on it. `level` packs it (see the sim's table snapshot): while eating,
 * each chair's dish + 1 in base 8 (chair 0 first); when dirty, the number of plates left.
 */
function drawTable(c: SkCanvas, A: RenderAssets, variant: number, level: number, progress: number, bubble: number, t: number, tier: number, dishTiers: number[]): void {
  'worklet';
  const S = A.S;
  const plain = A.paints.plain;
  spr(c, A, look(A.L.look.table, tier), 0, 0, plain);
  const top = oy(0, 0, 17);
  if (variant === 1) {
    const d0 = (level % 8) - 1;
    const d1 = (Math.floor(level / 8) % 8) - 1;
    // Alone at the table the plate sits in the middle; a couple each get theirs on their side.
    const meal = (dish: number, x: number, y: number, gx: number) => {
      spr(c, A, look(A.L.plate[dish]!, dishTiers[dish] ?? 0), ox(x, y), oy(x, y, 17), plain);
      spr(c, A, S.glass, ox(gx, -0.14), oy(gx, -0.14, 17), plain);
    };
    if (d0 >= 0) meal(d0, d1 >= 0 ? -0.12 : 0.06, 0.06, -0.12);
    if (d1 >= 0) meal(d1, 0.16, 0.06, 0.18);
  } else if (variant === 2) {
    spr(c, A, S.stain, 0, 0, plain);
    spr(c, A, S.plateDirty, ox(0.05, 0.05), oy(0.05, 0.05, 17), plain);
    if (level >= 2) spr(c, A, S.plateDirty, ox(-0.16, 0.1), oy(-0.16, 0.1, 17), plain);
    spr(c, A, S.glassEmpty, ox(-0.12, -0.14), oy(-0.12, -0.14, 17), plain);
    if (bubble !== 0 || progress > 0) hint(c, A, 0, top - 18, A.S.clean, progress, t);
  }
}

export function drawProp(c: SkCanvas, A: RenderAssets, d: number[], o: number, t: number, looks: PropLooks): void {
  'worklet';
  const S = A.S;
  const plain = A.paints.plain;
  const kind = d[o + PF.kind]!;
  const variant = d[o + PF.variant]!;
  const active = d[o + PF.active]! === 1;
  const wx = d[o + F.x]!;
  const wy = d[o + F.y]!;
  const seed = d[o + F.id]! * 0.71;
  const tier = looks.tiers[kind] ?? 0;
  c.save();
  c.translate(isoX(wx, wy), isoY(wx, wy, d[o + PF.lift]!));
  // Just upgraded: a springy squash-and-stretch around the floor anchor.
  const since = t - (looks.bumps[kind] ?? -10);
  if (since >= 0 && since < 0.55) {
    const k = Math.sin(since * Math.PI * 5.5) * (1 - since / 0.55) * 0.14;
    c.scale(1 - k, 1 + k);
  }
  const base = baseSprite(A, kind, variant, tier);
  // Chairs come by the dozen right next to their glowing table: they keep no aura of their own.
  const crowd = kind === PropKind.Chair || kind === PropKind.Table;
  if (base >= 0 && tier >= AURA_TIER && kind !== PropKind.Chair && (looks.detail || !crowd)) {
    // The baked glow (one draw), breathing; the pass and slots have none.
    const glow = A.L.glow[base] ?? -1;
    if (glow >= 0) sprFade(c, A, glow, 0, 0, 1, 0.4 + Math.sin(t * 2.4 + seed) * 0.15 + Math.min(0.25, (tier - AURA_TIER) * 0.06));
  }
  const sel = looks.selected;
  if (base >= 0 && sel.length === 3 && sel[0] === kind && Math.abs(d[o + F.x]! - sel[1]!) < 0.05 && Math.abs(d[o + F.y]! - sel[2]!) < 0.05) {
    // Selected: a soft white outline that breathes, so the player sees what the menu is about.
    A.paints.outline.setAlphaf(0.65 + Math.sin(t * 6) * 0.25);
    silhouette(c, A, base, A.paints.outline, 1.8);
  }
  if (kind === PropKind.Stove) drawStove(c, A, active, t, tier);
  else if (kind === PropKind.Sink) drawSink(c, A, active, t, tier);
  else if (kind === PropKind.Table) {
    drawTable(c, A, variant, d[o + PF.level]!, d[o + PF.progress]!, d[o + PF.bubble]!, t, tier, looks.dishTiers);
  } else if (kind === PropKind.Chair) {
    // 0: the first chair; 1: the seat of the chair opposite; 2: its backrest (drawn over the sitter).
    spr(c, A, look(variant === 2 ? A.L.look.chairRest : variant === 1 ? A.L.look.chairSeat : A.L.look.chair, tier), 0, 0, plain);
  }
  else if (kind === PropKind.Pass) spr(c, A, variant === 1 ? S.passLong : S.pass, 0, 0, plain);
  else if (kind === PropKind.TableSlot) {
    // Floor space for one more table: a dashed spot with ghost furniture and a "+" when affordable.
    sprFade(c, A, S.tableSlot, 0, 0, 1, 0.7 + Math.sin(t * 3) * 0.2);
    sprFade(c, A, look(A.L.look.chair, 0), ox(-0.62, 0), oy(-0.62, 0, 0), 1, 0.28);
    sprFade(c, A, look(A.L.look.table, 0), 0, 0, 1, 0.28);
    if (variant === 1) {
      const pulse = 1 + Math.sin(t * 5) * 0.08;
      sprXf(c, A, S.plusBadge, 0, -34 - Math.abs(Math.sin(t * 2.6)) * 3, 0, pulse * 1.2, pulse * 1.2, plain);
    }
  } else if (kind === PropKind.StoveSlot) {
    // Room for a second cooking line: a dashed spot and a ghost stove.
    sprFade(c, A, S.stoveSlot, 0, 0, 1, 0.7 + Math.sin(t * 3) * 0.2);
    sprFade(c, A, look(A.L.look.stove, 0), 0, 0, 1, 0.25);
    if (variant === 1) {
      const pulse = 1 + Math.sin(t * 5) * 0.08;
      sprXf(c, A, S.plusBadge, 0, -40 - Math.abs(Math.sin(t * 2.6)) * 3, 0, pulse * 1.2, pulse * 1.2, plain);
    }
  } else if (kind === PropKind.Scaffold) {
    // Goes up piece by piece, with a little overshoot.
    const age = t - d[o + PF.since]!;
    const pop = age < 0 ? 0 : age < 0.4 ? easeOutBack(clamp01(age / 0.4)) : 1;
    if (pop > 0) sprXf(c, A, variant === 1 ? S.scaffoldY : S.scaffoldX, 0, 0, 0, 1, pop, plain);
  } else if (kind === PropKind.StreetSign) spr(c, A, look(A.L.look.streetSign, tier), 0, 0, plain);
  else if (kind === PropKind.Flowers) sprXf(c, A, look(A.L.look.flowers, tier), 0, 0, Math.sin(t * 1.3 + seed) * 1.2, 1, 1, plain);
  else if (kind === PropKind.FloorLamp || kind === PropKind.Statue || kind === PropKind.Fountain || kind === PropKind.Piano) spr(c, A, base, 0, 0, plain);
  else if (kind === PropKind.Aquarium) {
    spr(c, A, base, 0, 0, plain);
    // Two fish swim back and forth along the glass, turning at the ends.
    for (let k = 0; k < 2; k++) {
      const phase = t * (0.35 + k * 0.12) + seed + k * 2;
      const u = Math.sin(phase) * 0.3;
      const goingRight = Math.cos(phase) > 0;
      const z = 30 + k * 7 + Math.sin(t * 2 + k) * 1.5;
      sprXf(c, A, k === 0 ? S.fishOrange : S.fishBlue, ox(u, 0.2), oy(u, 0.2, z), 0, goingRight ? -1 : 1, 1, plain);
    }
  }
  else if (kind === PropKind.PassDish) {
    // Ready dish pops onto the pass, then bobs and sparkles until someone serves it.
    const age = t - d[o + PF.since]!;
    const pop = age < 0.35 ? easeOutBack(clamp01(age / 0.35)) : 1;
    const bobY = -Math.abs(Math.sin(t * 3 + seed)) * 2.5;
    sprXf(c, A, look(A.L.plate[variant]!, looks.dishTiers[variant] ?? 0), 0, bobY, 0, pop, pop, plain);
    if (age > 0.2) {
      const ring = 1 + fract(t * 0.9 + seed) * 0.8;
      A.paints.fade.setAlphaf(0.9 - fract(t * 0.9 + seed) * 0.9);
      sprXf(c, A, S.ring, 0, -4, 0, ring, ring * 0.5, A.paints.fade);
    }
    sparkles(c, A, 0, -12, t, 8, seed);
  } else if (kind === PropKind.PlatesClean) {
    // Live count: the stack visibly shrinks as dishes go out and grows as they are washed.
    const n = Math.min(10, variant);
    const plate = look(A.L.look.plateSingle, tier);
    for (let i = 0; i < n; i++) spr(c, A, plate, 0, -i * 2.2, plain);
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
  } else if (kind === PropKind.Fridge) spr(c, A, look(A.L.look.fridge, tier), 0, 0, plain);
  else if (kind === PropKind.Plant) sprXf(c, A, look(variant === 1 ? A.L.look.plantBush : A.L.look.plantPalm, tier), 0, 0, Math.sin(t * 1.1 + seed) * 1.4, 1, 1, plain);
  else if (kind === PropKind.Tree) sprXf(c, A, A.L.trees[looks.city * 2 + (variant === 1 ? 1 : 0)] ?? S.treePalm, 0, 0, Math.sin(t * 0.8 + seed) * 1.2, 1, 1, plain);
  else if (kind === PropKind.Lamp) {
    spr(c, A, S.lamp, 0, 0, plain);
    sprFade(c, A, S.glowHalo, 0, oy(0, 0, 76), 1, 0.75 + Math.sin(t * 2 + seed) * 0.2);
  } else if (kind === PropKind.SaleSign) spr(c, A, S.saleSign, 0, 0, plain);
  else if (kind === PropKind.Gift) {
    // Bobs, sparkles and blinks in its last seconds before the street sweeper takes it.
    const left = d[o + PF.since]! - t;
    if (left > 6 || Math.sin(t * 14) > -0.3) {
      const bob = Math.abs(Math.sin(t * 3.2)) * 5;
      sprFade(c, A, S.glowHalo, 0, -10, 0.8, 0.5 + Math.sin(t * 4) * 0.2);
      sprXf(c, A, S.giftBox, 0, -bob, Math.sin(t * 3.2) * 6, 1.25, 1.25, plain);
      sparkles(c, A, 0, -26, t, 12, seed, 2);
    }
  } else if (kind === PropKind.WorkSite) {
    // Jolts when tapped (the crew speeds up), the warning lamp blinks.
    const age = t - d[o + PF.since]!;
    const jolt = age >= 0 && age < 0.25 ? Math.sin(age * 60) * (1 - age / 0.25) * 6 : 0;
    sprXf(c, A, variant === 1 ? S.workCrate : S.workBarrier, 0, 0, jolt, 1, 1, plain);
    if (variant === 0 && Math.sin(t * 7 + seed) > 0) sprFade(c, A, S.glowHalo, ox(0.36, 0), oy(0.36, 0, 24), 0.35, 0.9);
  }
  else if (kind === PropKind.Neon) {
    spr(c, A, look(A.L.look.neonBoard, tier), 0, 0, plain);
    // Mostly on, with the occasional cheap-neon stutter (fancier signs stutter less).
    const stutter = Math.sin(t * 31) * Math.sin(t * 7.7 + seed) > 0.82 + tier * 0.05;
    sprFade(c, A, look(A.L.look.neonLit, tier), 0, 0, 1, stutter ? 0.25 : 0.92 + Math.sin(t * 9) * 0.08);
  }
  // Top-tier stations twinkle (not every chair: there are dozens of them).
  if (base >= 0 && tier >= 3 && kind !== PropKind.TableSlot && kind !== PropKind.StoveSlot && kind !== PropKind.Chair && (looks.detail || !crowd)) sparkles(c, A, 0, -28, t, 14, seed, kind === PropKind.Table ? 1 : 2);
  c.restore();
}

/** Where the "upgrade available" arrow floats above each kind of station (px). */
const BADGE_HEIGHT: Record<number, number> = {
  [PropKind.Stove]: 70, [PropKind.Sink]: 56, [PropKind.Fridge]: 92, [PropKind.Pass]: 64, [PropKind.PlatesClean]: 50,
  [PropKind.Table]: 46, [PropKind.Chair]: 54, [PropKind.Plant]: 86, [PropKind.Neon]: 116, [PropKind.StreetSign]: 56,
  [PropKind.Gift]: 30, [PropKind.Flowers]: 66, [PropKind.FloorLamp]: 96, [PropKind.Aquarium]: 70, [PropKind.Statue]: 90, [PropKind.Fountain]: 84, [PropKind.Piano]: 80, [PropKind.SaleSign]: 82,
};

/** Green arrows over stations with an affordable upgrade (drawn above everything in the world). */
export function drawBadges(c: SkCanvas, A: RenderAssets, badges: number[], best: number[], t: number): void {
  'worklet';
  if (best.length === 3) {
    // The best buy right now: a big spinning gold star with a glow, bouncing higher.
    const kind = best[2]!;
    const lift = kind === PropKind.PlatesClean ? 22 : 0;
    const x = isoX(best[0]!, best[1]!);
    const y = isoY(best[0]!, best[1]!, lift + (BADGE_HEIGHT[kind] ?? 50)) - Math.abs(Math.sin(t * 3.2)) * 7 - 6;
    sprFade(c, A, A.S.glowHalo, x, y + 30, 0.8, 0.6 + Math.sin(t * 4) * 0.2);
    const k = 2.8 + Math.sin(t * 5) * 0.18;
    sprXf(c, A, A.S.star, x, y - 6, Math.sin(t * 2) * 12, k, k, A.paints.plain);
  }
  for (let i = 0; i < badges.length; i += 3) {
    const x = badges[i]!;
    const y = badges[i + 1]!;
    const kind = badges[i + 2]!;
    const lift = kind === PropKind.PlatesClean ? 22 : 0;
    const bob = Math.abs(Math.sin(t * 2.8 + i)) * 4;
    const pulse = 1 + Math.sin(t * 5 + i) * 0.06;
    sprXf(c, A, A.S.arrowUp, isoX(x, y), isoY(x, y, lift + (BADGE_HEIGHT[kind] ?? 50)) - bob, 0, pulse, pulse, A.paints.plain);
  }
}

/** "1:05", "42s", "2h05": seconds left on a job. */
function timeText(left: number): string {
  'worklet';
  const s = Math.max(0, Math.ceil(left));
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (s >= 3600) return `${Math.floor(s / 3600)}h${pad(Math.floor((s % 3600) / 60))}`;
  if (s >= 60) return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  return `${s}s`;
}

/** Over each big upgrade in progress: a swinging hammer, the time left and a progress bar. */
export function drawWorks(c: SkCanvas, A: RenderAssets, works: number[], t: number): void {
  'worklet';
  const P = A.paints;
  for (let i = 0; i < works.length; i += WORK_STRIDE) {
    const wx = works[i + W.x]!;
    const wy = works[i + W.y]!;
    const kind = works[i + W.kind]!;
    const progress = works[i + W.progress]!;
    const lift = kind === PropKind.PlatesClean ? 22 : 0;
    const x = isoX(wx, wy);
    const y = isoY(wx, wy, lift + (BADGE_HEIGHT[kind] ?? 50)) - Math.abs(Math.sin(t * 2.2 + i)) * 2;
    // The hammer comes down on the station again and again.
    const swing = Math.max(0, Math.sin(t * 7 + i));
    sprXf(c, A, A.S.workHammer, x + 30, y + 2, -60 + swing * 70, 0.9, 0.9, P.plain);
    sprXf(c, A, A.S.workDial, x, y - 10, 0, 1, 1, P.plain);
    drawText(c, A, timeText(works[i + W.left]!), x, y - 10, 0.82, P.plain, 0.5);
    const w = 42;
    c.drawRRect({ rect: { x: x - w / 2 - 1.5, y: y + 3, width: w + 3, height: 7 }, rx: 3.5, ry: 3.5 }, P.barBack);
    c.drawRRect({ rect: { x: x - w / 2, y: y + 4.5, width: Math.max(3, w * progress), height: 4 }, rx: 2, ry: 2 }, P.barMid);
  }
}
