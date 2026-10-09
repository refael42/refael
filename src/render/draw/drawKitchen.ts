import type { SkCanvas } from '@shopify/react-native-skia';
import type { RenderAssets } from '../assets';
import { clamp01, fract, spr, sprFade, sprXf } from './primitives';

// The kitchen's stations come alive (owner M29: "animations for everything, without
// exception"): the oil bubbles round the basket, the patty flips on the plancha, the wok burner
// roars, the pot steams on the range, the oven's fire flickers with the pizza inside, the sushi
// roll gets cut, the salad comes together on the cold line; and the plate being dressed sits on
// the counter. Like every prop effect, a pure function of time: nothing to pool or clean up.

/** Kinds (src/data/kitchen.ts order). */
const FRYER = 0;
const PLANCHA = 1;
const COLD = 2;
const RANGE = 3;
const WOK = 4;
const OVEN = 5;
const SUSHI = 6;

const TOP = 23;
const LOOKS = 4;

/** Screen offset of a point on a prop (tiles + px height), relative to its anchor. */
function ox(x: number, y: number): number {
  'worklet';
  return (x - y) * 32;
}
function oy(x: number, y: number, z: number): number {
  'worklet';
  return (x + y) * 16 - z;
}

function steam(c: SkCanvas, A: RenderAssets, x: number, y: number, t: number, count: number, height: number): void {
  'worklet';
  for (let i = 0; i < count; i++) {
    const age = fract(t * 0.55 + i / count);
    sprFade(c, A, A.S.steam, x + Math.sin(age * 6 + i * 2.1) * 3, y - age * height, 0.6 + age * 1.1, Math.sin(age * Math.PI) * 0.75);
  }
}

function bubbles(c: SkCanvas, A: RenderAssets, x: number, y: number, t: number, count: number, spread: number): void {
  'worklet';
  for (let i = 0; i < count; i++) {
    const age = fract(t * 1.6 + i * 0.37);
    const bx = x + Math.sin(i * 12.9898 + Math.floor(t * 1.6 + i * 0.37) * 4.1) * spread;
    sprFade(c, A, A.S.oilBubble, bx, y - age * 2, 0.6 + age * 0.8, 1 - age);
  }
}

/**
 * One station. `type`: its kind; `tier`: its look; `cooking`: a dish on the fire; `plating`: the
 * dish being dressed; `dish`: which (-1 none); `progress`: how far along; `dishTier`: the plated look.
 */
export function drawStation(c: SkCanvas, A: RenderAssets, type: number, tier: number, cooking: boolean, plating: boolean, dish: number, progress: number, dishTier: number, t: number, seed: number): void {
  'worklet';
  const S = A.S;
  const P = A.paints.plain;
  const looks = A.L.station[type] ?? A.L.station[0]!;
  spr(c, A, looks[Math.min(LOOKS - 1, looks.length - 1, tier)]!, 0, 0, P);
  const food = dish >= 0 ? (A.L.cooking[dish] ?? -1) : -1;
  // Hotter flames as the kitchen is upgraded.
  const heat = 1 + Math.min(tier, 4) * 0.1;
  if (type === FRYER) {
    // The oil shimmers all day; the basket in it while something fries.
    bubbles(c, A, ox(0, -0.23), oy(0, -0.23, TOP), t + seed, cooking ? 6 : 2, 7);
    if (cooking) {
      if (food >= 0) sprXf(c, A, food, ox(-0.05, -0.23), oy(-0.05, -0.23, TOP + 1) + Math.sin(t * 9) * 0.6, 0, 0.7, 0.7, P);
      bubbles(c, A, ox(0, 0.23), oy(0, 0.23, TOP), t * 1.3 + seed, 4, 7);
      steam(c, A, ox(0, -0.1), oy(0, -0.1, TOP + 6), t + seed, 3, 22);
    }
  } else if (type === PLANCHA) {
    if (cooking) {
      // The patty (or steak, or shawarma) hops up and turns over now and then; smoke rises.
      const p = (t * 0.6 + seed) % 1;
      const air = p < 0.3 ? p / 0.3 : 0;
      const turn = Math.cos(air * Math.PI * 2);
      if (food >= 0) sprXf(c, A, food, ox(-0.05, 0.05), oy(-0.05, 0.05, TOP + 2) - Math.sin(air * Math.PI) * 12, air * 30, 0.8, 0.8 * Math.max(0.15, Math.abs(turn)), P);
      steam(c, A, ox(0, 0.05), oy(0, 0.05, TOP + 6), t + seed, 4, 26);
      bubbles(c, A, ox(0, 0.05), oy(0, 0.05, TOP + 1), t * 2 + seed, 4, 8);
    }
  } else if (type === COLD) {
    if (cooking && food >= 0) {
      // The dish comes together on the board, piece by piece; a leaf drops in now and then.
      const k = 0.55 + clamp01(progress) * 0.35;
      sprXf(c, A, food, ox(0.33, 0), oy(0.33, 0, TOP + 1), 0, k, k, P);
      const drop = fract(t * 0.9 + seed);
      if (drop < 0.5) sprFade(c, A, S.tossLeaf, ox(0.33, 0) + Math.sin(seed * 9) * 3, oy(0.33, 0, TOP + 16 - drop * 26), 0.9, 1 - drop * 1.6);
    }
  } else if (type === RANGE) {
    // The stock pot simmers all day; the burner under the pan lights while a dish cooks.
    steam(c, A, ox(0.2, -0.22), oy(0.2, -0.22, TOP + 16), t + seed, cooking ? 4 : 2, 24);
    if (cooking) {
      const bx = ox(-0.2, 0.22);
      const by = oy(-0.2, 0.22, TOP);
      for (let i = 0; i < 3; i++) {
        const flick = 0.75 + Math.sin(t * 22 + i * 2.3) * 0.25;
        sprXf(c, A, S.flame, bx - 6 + i * 6, by + 1, 0, flick * heat, flick * heat, P);
      }
      if (food >= 0) sprXf(c, A, food, bx, by - 2 + Math.sin(t * 6) * 0.4, 0, 0.75, 0.75, P);
      steam(c, A, bx, by - 8, t * 1.2 + seed, 3, 18);
    }
  } else if (type === WOK) {
    const bx = ox(0, 0.02);
    const by = oy(0, 0.02, TOP);
    if (cooking) {
      // The ring burner roars, the flame jumping up each time the wok comes down.
      const beat = fract(t * 1.1 + seed);
      const burst = beat < 0.35 ? Math.sin((beat / 0.35) * Math.PI) : 0;
      sprXf(c, A, S.fireBurst, bx, by + 2, Math.sin(t * 9) * 6, 0.8 + burst * 0.7 * heat, 0.6 + burst * 1.3 * heat, P);
      for (let i = 0; i < 4; i++) {
        const flick = 0.8 + Math.sin(t * 25 + i * 1.7) * 0.2;
        sprXf(c, A, S.flame, bx - 9 + i * 6, by + 2, 0, flick * heat, flick * heat * 1.2, P);
      }
    } else {
      spr(c, A, S.wokRest, bx, by - 1, P);
    }
  } else if (type === OVEN) {
    // The wood fire never goes out: a glow in the mouth, brighter with a pizza inside.
    const mx = ox(0.05, 0.4);
    const my = oy(0.05, 0.4, 21.5);
    const flicker = 0.55 + Math.sin(t * 11 + seed) * Math.sin(t * 6.3) * 0.25;
    sprFade(c, A, S.glowHalo, mx - 1, my - 5, 0.32, (cooking ? 0.95 : 0.55) * flicker);
    for (let i = 0; i < 3; i++) {
      const f = 0.6 + Math.sin(t * 19 + i * 2.1 + seed) * 0.3;
      sprXf(c, A, S.flame, mx - 5 + i * 4, my - 1, 0, f, f * 0.9, P);
    }
    if (cooking && food >= 0) sprXf(c, A, food, mx, my - 2, 0, 0.45, 0.45, P);
    steam(c, A, ox(-0.1, 0, ), oy(-0.1, 0, 74), t * 0.6 + seed, 3, 30);
  } else if (type === SUSHI) {
    if (cooking && food >= 0) {
      // The roll on the board, cut piece by piece; a slice of fish flips onto it now and then.
      sprXf(c, A, food, ox(-0.2, -0.05), oy(-0.2, -0.05, TOP + 1), 0, 0.75, 0.75, P);
      const hop = fract(t * 0.8 + seed);
      if (hop < 0.4) sprXf(c, A, S.fishSlice, ox(0.15, 0.1) - hop * 30, oy(0.15, 0.1, TOP + 4) - Math.sin((hop / 0.4) * Math.PI) * 9, hop * 400, 1, 1, P);
    }
  }
  if (plating && dish >= 0) {
    // The plate on the counter in front of the cook, being dressed: a glint now and then.
    const plate = A.L.plate[dish];
    if (plate) spr(c, A, plate[Math.min(LOOKS - 1, plate.length - 1, dishTier)]!, ox(-0.32, 0), oy(-0.32, 0, TOP), P);
    const glint = fract(t * 1.5 + seed);
    sprFade(c, A, S.sparkle, ox(-0.32, 0) + Math.sin(seed + Math.floor(t * 1.5)) * 4, oy(-0.32, 0, TOP + 6), 0.4 + glint * 0.4, Math.sin(glint * Math.PI));
  }
}

/** Back-of-house pieces (prep variants from 6: src/data/maps.ts BACK_KINDS) that move. */
const BACK_STOCK = 8;
const BACK_PASTRY = 10;
const BACK_FRIDGE = 7;

/** The back of the house is alive too: the stock pots simmer and steam, the mixer turns, the fridge hums. */
export function drawBack(c: SkCanvas, A: RenderAssets, variant: number, t: number, seed: number): void {
  'worklet';
  const S = A.S;
  if (variant === BACK_STOCK) {
    bubbles(c, A, ox(0, 0), oy(0, 0, 39), t + seed, 4, 9);
    steam(c, A, ox(0, 0), oy(0, 0, 44), t * 0.8 + seed, 4, 34);
  } else if (variant === BACK_PASTRY) {
    // The whisk spins in the bowl: a blur that wobbles, a puff of flour now and then.
    const bx = ox(-0.12, -0.2);
    const by = oy(-0.12, -0.2, TOP + 9);
    sprXf(c, A, S.sparkle, bx + Math.sin(t * 18) * 2.5, by + Math.cos(t * 18) * 1, t * 600, 0.5, 0.5, A.paints.plain);
    const puff = fract(t * 0.45 + seed);
    if (puff < 0.5) sprFade(c, A, S.steam, bx + puff * 8, by - 4 - puff * 14, 0.5 + puff, (0.5 - puff) * 0.9);
  } else if (variant === BACK_FRIDGE) {
    // The door opens a crack now and then: a breath of cold.
    const breath = fract(t * 0.12 + seed);
    if (breath < 0.25) sprFade(c, A, S.steam, ox(0.36, 0) + breath * 30, oy(0.36, 0, 20) + breath * 8, 0.7 + breath * 2, (0.25 - breath) * 2);
  }
}
