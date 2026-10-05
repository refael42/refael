import type { SkCanvas } from '@shopify/react-native-skia';
import { ECONOMY } from '../../data/economy';
import { Ev } from '../../sim/game/events';
import { formatNumber } from '../../sim/format';
import { E, EVENT_STRIDE, type Snapshot } from '../../sim/snapshot';
import { PropKind } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { isoX, isoY } from '../iso';
import { clamp01, easeOutBack, sprFade, sprXf } from './primitives';
import { drawText } from './text';

// Juice effects live only on the UI thread: a fixed ring buffer of records, spawned from sim
// events (or taps) and drawn as pure functions of their age. Nothing is allocated per frame.

export const FxKind = {
  Text: 1, Coin: 2, Bill: 3, Burst: 4, Poof: 5, Dish: 6, Ripple: 7, Ding: 8, Cross: 9, StarFly: 10, StarDrop: 11, PlateFly: 12,
  LevelUp: 13, Confetti: 14,
} as const;
const STRIDE = 10;
const CAP = 160;
const K = 0;
const T0 = 1;
const DUR = 2;
const X0 = 3;
const Y0 = 4;
const X1 = 5;
const Y1 = 6;
const VALUE = 7;
const STYLE = 8;

/** Text styles: color + size. */
export const TextStyle = { Coins: 0, Tip: 1, Combo: 2, Level: 3, Milestone: 4 } as const;

/** Coin style: flies from a world point (default) or from a fixed screen point (bonuses). */
const FROM_SCREEN = 1;

/** Height (px) above the floor where level-up effects pop, per station kind. */
const FX_HEIGHT: Record<number, number> = {
  [PropKind.Stove]: 60, [PropKind.Sink]: 44, [PropKind.Fridge]: 80, [PropKind.Pass]: 40, [PropKind.PlatesClean]: 44,
  [PropKind.Table]: 34, [PropKind.Chair]: 34, [PropKind.TableSlot]: 30, [PropKind.Plant]: 60, [PropKind.Neon]: 100, [PropKind.StreetSign]: 70,
};

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Screen positions of HUD targets that coins and stars fly into. */
export interface HudAnchors {
  coinX: number;
  coinY: number;
  ratingX: number;
  ratingY: number;
  /** Where bonus coin showers start (screen middle). */
  centerX: number;
  centerY: number;
}

export interface FxState {
  data: number[];
  next: number;
  lastEvent: number;
  /** Coins still in the air: the HUD only counts them when they land. */
  pending: number;
  coinBounce: number;
  ratingBounce: number;
  rolling: number;
  lastFrame: number;
  /** Sim time of the last big moment: the camera shakes briefly. */
  shakeAt: number;
}

export function createFx(): FxState {
  'worklet';
  return { data: new Array<number>(CAP * STRIDE).fill(0), next: 0, lastEvent: 0, pending: 0, coinBounce: -10, ratingBounce: -10, rolling: 0, lastFrame: 0, shakeAt: -10 };
}

export function spawnFx(
  s: FxState, kind: number, t0: number, dur: number, x0: number, y0: number, x1 = 0, y1 = 0, value = 0, style = 0,
): void {
  'worklet';
  const o = s.next * STRIDE;
  const d = s.data;
  d[o + K] = kind;
  d[o + T0] = t0;
  d[o + DUR] = dur;
  d[o + X0] = x0;
  d[o + Y0] = y0;
  d[o + X1] = x1;
  d[o + Y1] = y1;
  d[o + VALUE] = value;
  d[o + STYLE] = style;
  s.next = (s.next + 1) % CAP;
}

/** Turns new sim events into effects. World positions are in iso pixels (camera independent). */
export function processEvents(s: FxState, snap: Snapshot, hud: HudAnchors): void {
  'worklet';
  const ev = snap.events;
  for (let o = 0; o < ev.length; o += EVENT_STRIDE) {
    const id = ev[o + E.id]!;
    if (id <= s.lastEvent) continue;
    s.lastEvent = id;
    const t = ev[o + E.time]!;
    const type = ev[o + E.type]!;
    const ex = ev[o + E.x]!;
    const ey = ev[o + E.y]!;
    const a = ev[o + E.a]!;
    const wx = isoX(ex, ey);
    const wy = isoY(ex, ey);
    if (type === Ev.Coins) {
      spawnFx(s, FxKind.Text, t, 1.2, wx, wy - 46, 0, 0, a, TextStyle.Coins);
      const n = Math.min(6, 2 + Math.floor(Math.log2(a + 1)));
      for (let i = 0; i < n; i++) spawnFx(s, FxKind.Coin, t + i * 0.06, 0.75, wx + (i - n / 2) * 3, wy - 30, hud.coinX, hud.coinY, a / n);
      s.pending += a;
    } else if (type === Ev.Tip) {
      spawnFx(s, FxKind.Text, t + 0.22, 1.3, wx + 10, wy - 62, 0, 0, a, TextStyle.Tip);
      const n = Math.min(4, 1 + Math.floor(Math.log2(a + 1)));
      for (let i = 0; i < n; i++) spawnFx(s, FxKind.Bill, t + 0.25 + i * 0.08, 0.95, wx, wy - 34, hud.coinX, hud.coinY, a / n);
      s.pending += a;
    } else if (type === Ev.Combo) {
      spawnFx(s, FxKind.Text, t + 0.4, 1.3, wx - 14, wy - 76, 0, 0, a, TextStyle.Combo);
    } else if (type === Ev.DishFly) {
      const tx = isoX(a, ev[o + E.b]!);
      const ty = isoY(a, ev[o + E.b]!);
      const dish = ev[o + E.c]!;
      spawnFx(s, FxKind.Dish, t, ECONOMY.serveFlightSeconds, wx, wy - 30, tx, ty - 18, dish, snap.dishTiers[dish] ?? 0);
    } else if (type === Ev.Burst) {
      spawnFx(s, FxKind.Burst, t, 0.7, wx, wy - 22);
    } else if (type === Ev.Poof) {
      spawnFx(s, FxKind.Poof, t, 0.8, wx, wy - 24);
    } else if (type === Ev.Ding) {
      spawnFx(s, FxKind.Ding, t, 0.6, wx, wy - 32);
      spawnFx(s, FxKind.Burst, t, 0.5, wx, wy - 32);
    } else if (type === Ev.Rating) {
      if (a > 0.0001) spawnFx(s, FxKind.StarFly, t + 0.5, 1.0, wx, wy - 50, hud.ratingX, hud.ratingY);
      else if (a < -0.0001) spawnFx(s, FxKind.StarDrop, t, 1.0, wx, wy - 56);
    } else if (type === Ev.NoTable) {
      spawnFx(s, FxKind.Cross, t, 0.9, wx, wy - 70);
    } else if (type === Ev.PlateFly) {
      spawnFx(s, FxKind.PlateFly, t, 0.7, wx, wy - 20, isoX(a, ev[o + E.b]!), isoY(a, ev[o + E.b]!) - 26);
    } else if (type === Ev.Washed) {
      spawnFx(s, FxKind.Burst, t, 0.5, wx, wy - 30);
    } else if (type === Ev.Upgrade) {
      const milestone = ev[o + E.b]! === 1;
      const y = wy - (FX_HEIGHT[ev[o + E.c]!] ?? 40);
      spawnFx(s, FxKind.LevelUp, t, milestone ? 1.1 : 0.7, wx, y, 0, 0, 0, milestone ? 1 : 0);
      spawnFx(s, FxKind.Burst, t, 0.6, wx, y);
      spawnFx(s, FxKind.Text, t, milestone ? 1.8 : 1.1, wx, y - 14, 0, 0, a, milestone ? TextStyle.Milestone : TextStyle.Level);
      if (milestone) {
        s.shakeAt = t;
        for (let k = 0; k < 18; k++) spawnFx(s, FxKind.Confetti, t + k * 0.012, 1.4, wx, y, (k / 18) * Math.PI * 2, 0, k);
      }
    } else if (type === Ev.Bonus) {
      const n = 24;
      for (let k = 0; k < n; k++) {
        const jx = hud.centerX + Math.sin(k * 2.4) * 60;
        const jy = hud.centerY + Math.cos(k * 1.7) * 30;
        spawnFx(s, FxKind.Coin, t + k * 0.04, 0.9, jx, jy, hud.coinX, hud.coinY, a / n, FROM_SCREEN);
      }
      s.pending += a;
    }
  }
}

function textFor(value: number, style: number): string {
  'worklet';
  if (style === TextStyle.Combo) return 'x' + Math.round(value) + '!';
  if (style === TextStyle.Level) return 'LV ' + Math.round(value);
  if (style === TextStyle.Milestone) return 'LV ' + Math.round(value) + '!';
  return '+' + formatNumber(value);
}

/** Effects that live in the world (drawn inside the camera transform). */
export function drawWorldFx(c: SkCanvas, A: RenderAssets, s: FxState, t: number): void {
  'worklet';
  const d = s.data;
  const P = A.paints;
  for (let i = 0; i < CAP; i++) {
    const o = i * STRIDE;
    const kind = d[o + K]!;
    if (kind === 0 || kind === FxKind.Coin || kind === FxKind.Bill || kind === FxKind.StarFly || kind === FxKind.Ripple) continue;
    const age = t - d[o + T0]!;
    const dur = d[o + DUR]!;
    if (age < 0) continue;
    if (age > dur) {
      d[o + K] = 0;
      continue;
    }
    const p = age / dur;
    const x = d[o + X0]!;
    const y = d[o + Y0]!;
    if (kind === FxKind.Text) {
      const style = d[o + STYLE]!;
      const pop = age < 0.22 ? easeOutBack(clamp01(age / 0.22)) : 1;
      const scale = (style === TextStyle.Coins ? 1.05 : style === TextStyle.Milestone ? 1.9 : 1.35) * pop;
      const paint = style === TextStyle.Tip || style === TextStyle.Level ? P.gold : style === TextStyle.Combo || style === TextStyle.Milestone ? P.orange : P.plain;
      paint.setAlphaf(clamp01((1 - p) / 0.3));
      drawText(c, A, textFor(d[o + VALUE]!, style), x, y - p * 26, scale, paint);
      paint.setAlphaf(1);
    } else if (kind === FxKind.Burst) {
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        const r = 6 + easeOutBack(p) * 18;
        sprFade(c, A, A.S.sparkle, x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.6, 0.9 - p * 0.5, 1 - p);
      }
    } else if (kind === FxKind.Poof) {
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 + 0.4;
        sprFade(c, A, A.S.puff, x + Math.cos(ang) * p * 14, y + Math.sin(ang) * p * 7 - p * 8, 0.8 + p * 1.4, 1 - p);
      }
    } else if (kind === FxKind.PlateFly) {
      const e = p * p * (3 - 2 * p);
      const dx = x + (d[o + X1]! - x) * e;
      const dy = y + (d[o + Y1]! - y) * e - Math.sin(p * Math.PI) * 50;
      sprXf(c, A, A.S.plateSingleDirty, dx, dy, p * 360, 1.2, 1.2, P.plain);
    } else if (kind === FxKind.Dish) {
      // A served dish arcs from the pass to the table.
      const e = p * p * (3 - 2 * p);
      const dx = x + (d[o + X1]! - x) * e;
      const dy = y + (d[o + Y1]! - y) * e - Math.sin(p * Math.PI) * 40;
      sprXf(c, A, A.L.plate[d[o + VALUE]!]![d[o + STYLE]!]!, dx, dy, Math.sin(p * Math.PI) * 18, 1 + Math.sin(p * Math.PI) * 0.35, 1 + Math.sin(p * Math.PI) * 0.35, P.plain);
    } else if (kind === FxKind.Ding) {
      const r = 0.6 + p * 1.6;
      sprFade(c, A, A.S.ring, x, y, r, 1 - p);
    } else if (kind === FxKind.Cross) {
      const pop = age < 0.25 ? easeOutBack(clamp01(age / 0.25)) : 1;
      sprFade(c, A, A.S.cross, x + Math.sin(age * 40) * (1 - p) * 2, y, pop * 1.3, clamp01((1 - p) / 0.3));
    } else if (kind === FxKind.StarDrop) {
      sprFade(c, A, A.S.starGray, x, y + p * 20, 1.2 - p * 0.4, 1 - p);
    } else if (kind === FxKind.LevelUp) {
      // An expanding golden ring (two for milestones) around the upgraded station.
      const big = d[o + STYLE]! === 1;
      sprFade(c, A, A.S.ring, x, y, 0.8 + easeOutBack(p) * (big ? 2.6 : 1.6), 1 - p);
      if (big) sprFade(c, A, A.S.ring, x, y, 0.5 + p * 3.6, (1 - p) * 0.7);
    } else if (kind === FxKind.Confetti) {
      // Tossed up and out, then flutters down; each piece has its own color and spin.
      const ang = d[o + X1]!;
      const k = d[o + VALUE]!;
      const r = 20 + easeOutBack(clamp01(p * 2)) * 30;
      const cx = x + Math.cos(ang) * r + Math.sin(age * 6 + k) * 4;
      const cy = y - 20 + Math.sin(ang) * r * 0.5 - Math.sin(clamp01(p * 2) * Math.PI) * 24 + p * p * 60;
      const tints = [P.gold, P.red, P.green, P.orange, P.white];
      const paint = tints[k % tints.length]!;
      paint.setAlphaf(clamp01((1 - p) / 0.25));
      sprXf(c, A, A.S.confetti, cx, cy, age * 420 + k * 40, 1, Math.abs(Math.cos(age * 9 + k)), paint);
      paint.setAlphaf(1);
    }
  }
}

/** Effects that fly into the HUD (screen space). Landing coins bump the counter. */
export function drawScreenFx(c: SkCanvas, A: RenderAssets, s: FxState, t: number, cam: Camera): void {
  'worklet';
  const d = s.data;
  for (let i = 0; i < CAP; i++) {
    const o = i * STRIDE;
    const kind = d[o + K]!;
    if (kind !== FxKind.Coin && kind !== FxKind.Bill && kind !== FxKind.StarFly && kind !== FxKind.Ripple) continue;
    const age = t - d[o + T0]!;
    const dur = d[o + DUR]!;
    if (age < 0) continue;
    if (age > dur) {
      if (kind === FxKind.Coin || kind === FxKind.Bill) {
        s.pending = Math.max(0, s.pending - d[o + VALUE]!);
        s.coinBounce = t;
      } else if (kind === FxKind.StarFly) {
        s.ratingBounce = t;
      }
      d[o + K] = 0;
      continue;
    }
    const p = age / dur;
    if (kind === FxKind.Ripple) {
      A.paints.ripple.setAlphaf(1 - p);
      c.drawCircle(d[o + X0]!, d[o + Y0]!, 8 + p * 22, A.paints.ripple);
      continue;
    }
    // Start in the world (follows the camera) or on screen, end at a fixed HUD point.
    const onScreen = d[o + STYLE]! === FROM_SCREEN;
    const sx = onScreen ? d[o + X0]! : cam.x + d[o + X0]! * cam.zoom;
    const sy = onScreen ? d[o + Y0]! : cam.y + d[o + Y0]! * cam.zoom;
    const ex = d[o + X1]!;
    const ey = d[o + Y1]!;
    const e = p * p;
    const midX = (sx + ex) / 2 + (kind === FxKind.Bill ? Math.sin(age * 9 + i) * 30 : 0);
    const midY = Math.min(sy, ey) - 90;
    const q = 1 - e;
    const x = q * q * sx + 2 * q * e * midX + e * e * ex;
    const y = q * q * sy + 2 * q * e * midY + e * e * ey;
    if (kind === FxKind.Coin) {
      const spin = Math.abs(Math.cos(age * 14 + i));
      sprXf(c, A, A.S.coin, x, y, 0, (0.4 + spin * 1.1) * (1.4 - p * 0.4), 1.4 - p * 0.4, A.paints.plain);
    } else if (kind === FxKind.Bill) {
      sprXf(c, A, A.S.bill, x, y, Math.sin(age * 10 + i) * 35, 1.3 - p * 0.4, (1.3 - p * 0.4) * (0.6 + Math.abs(Math.sin(age * 8)) * 0.4), A.paints.plain);
    } else {
      sprXf(c, A, A.S.star, x, y, age * 360, 1.6 - p * 0.6, 1.6 - p * 0.6, A.paints.plain);
    }
  }
}
