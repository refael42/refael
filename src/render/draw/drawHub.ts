import type { SkCanvas } from '@shopify/react-native-skia';
import type { RenderAssets } from '../assets';
import { clamp01, fract, spr, sprFade, sprXf } from './primitives';

// The delivery hub comes alive (owner M30; pieces in src/render/art/hubArt.ts, rules in
// src/data/delivery.ts HUB): a box packed into a bag at each counter, the bags glowing under the
// heat lamp, the orders screen filling with tickets (a new one flashes in), the sign's bulbs
// chasing, the chargers' lights breathing while a scooter waits, the lockers lit for each bag
// waiting. A piece still to come is a faint outline with a padlock. Pure function of time.

/** Pieces (src/data/delivery.ts HubPiece order). */
const COUNTER = 0;
const BAG_WALL = 1;
const SCREEN = 2;
const GOLD_COUNTER = 3;
const SIGN = 4;
const CHARGER = 5;
const LOCKERS = 6;

function ox(x: number, y: number): number {
  'worklet';
  return (x - y) * 32;
}
function oy(x: number, y: number, z: number): number {
  'worklet';
  return (x + y) * 16 - z;
}

export function drawHub(c: SkCanvas, A: RenderAssets, piece: number, open: boolean, active: boolean, progress: number, extra: number, since: number, t: number, seed: number): void {
  'worklet';
  const S = A.S;
  const P = A.paints.plain;
  const base = A.L.hub[piece] ?? -1;
  if (!open) {
    // Still to come: its outline, faint, and a padlock that bobs.
    sprFade(c, A, base, 0, 0, 1, 0.2 + Math.sin(t * 2 + seed) * 0.05);
    spr(c, A, S.hubLock, 0, -30 - Math.abs(Math.sin(t * 2.2 + seed)) * 3, P);
    return;
  }
  spr(c, A, base, 0, 0, P);
  if (piece === COUNTER || piece === GOLD_COUNTER) {
    if (!active) return;
    // The box goes into the bag, the bag folds shut: a ring shows how far along.
    const k = clamp01(progress);
    const lift = k < 0.5 ? Math.sin((k / 0.5) * Math.PI) * 8 : 0;
    if (k < 0.75) sprXf(c, A, S.foodBox, ox(0.05, 0.05), oy(0.05, 0.05, 24) - lift, 0, 1.1, 1.1, P);
    sprXf(c, A, S.bag, ox(0.1, 0.12), oy(0.1, 0.12, 23), 0, 0.9 + (k > 0.75 ? 0.15 : 0), 0.9, P);
    const glint = fract(t * 1.6 + seed);
    sprFade(c, A, S.sparkle, ox(0, 0) + Math.sin(seed + Math.floor(t * 1.6)) * 6, oy(0, 0, 32), 0.4 + glint * 0.4, Math.sin(glint * Math.PI));
  } else if (piece === BAG_WALL) {
    // The heat lamp's glow breathing over the bags (stronger while bags wait outside).
    sprFade(c, A, S.glowHalo, ox(0, 0), oy(0, 0, 52), 0.55, (active ? 0.55 : 0.3) + Math.sin(t * 2.4 + seed) * 0.08);
  } else if (piece === SCREEN) {
    // The orders waiting, one row each, newest at the bottom (it flashes in).
    const rows = Math.min(5, extra);
    const fresh = t - since;
    for (let i = 0; i < rows; i++) {
      const row = A.L.hubRow[i % A.L.hubRow.length]!;
      const flash = i === rows - 1 && fresh >= 0 && fresh < 1.2 ? 0.45 + Math.abs(Math.sin(fresh * 9)) * 0.55 : 1;
      // Rows go down the screen's face (its own px: src/render/art/hubArt.ts SCREEN).
      sprFade(c, A, row, ox(0, 0.02), oy(0, 0.02, 49 - i * 3.6), 1, flash);
    }
    if (rows > 0 && Math.sin(t * 4 + seed) > 0.6) sprFade(c, A, S.glowHalo, ox(0.06, 0), oy(0.06, 0, 46), 0.45, 0.2);
  } else if (piece === SIGN) {
    // The bulbs chase round the lightbox; a soft red glow, brighter at night.
    const chase = Math.floor(t * 8 + seed) % 9;
    for (let i = 0; i < 9; i++) {
      if ((i + chase) % 3 !== 0) continue;
      const y = -0.47 + i * 0.118;
      sprFade(c, A, S.sparkle, ox(0.09, y), oy(0.09, y, 81), 0.35, 0.9);
      sprFade(c, A, S.sparkle, ox(0.09, y), oy(0.09, y, 58), 0.35, 0.9);
    }
    sprFade(c, A, S.glowHalo, ox(0.08, 0), oy(0.08, 0, 69), 0.9, 0.35 + Math.sin(t * 1.8 + seed) * 0.1);
  } else if (piece === CHARGER) {
    // Charging: the light breathes green.
    if (active) sprFade(c, A, S.glowHalo, ox(0, 0.08), oy(0, 0.08, 5), 0.18, 0.45 + Math.sin(t * 3 + seed) * 0.35);
  } else if (piece === LOCKERS) {
    // A locker lights up for each bag waiting to be picked up.
    const lit = Math.min(4, extra);
    for (let i = 0; i < lit; i++) {
      const x = -0.75 + 0.05 + i * 0.39 + 0.17;
      sprFade(c, A, S.glowHalo, ox(x, 0.18), oy(x, 0.18, 21), 0.22, 0.55 + Math.sin(t * 5 + i) * 0.25);
    }
  }
}
