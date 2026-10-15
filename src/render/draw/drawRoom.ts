import type { SkCanvas } from '@shopify/react-native-skia';
import type { RenderAssets } from '../assets';
import { drawBack } from './drawKitchen';
import { fract, spr, sprFade, sprXf } from './primitives';

// The kitchen's rooms come alive (owner M32; art in src/render/art/roomArt.ts, layout in
// src/data/kitchenRooms.ts): the dish machine steams while it runs, the walk-in and the freezer
// breathe cold, the manager's screen and lamp glow, the coffee steams, the vegetable sink's tap
// runs while someone washes; doors swing open while someone is in the doorway.

/** RoomItem values (src/data/kitchenRooms.ts): the ones before OWN are the prep and back-of-house looks. */
const OWN = 12;
const DISH_MACHINE = 12;
const COOLER = 14;
const FREEZER = 15;
const ICE = 16;
const DESK = 17;
const COFFEE = 19;
const VEG_SINK = 21;
const PLANT = 22;
/** The back-of-house looks that move (src/render/draw/drawKitchen.ts drawBack: the fridge, the stock pots, pastry). */
const BACK_ANIMATED = 6;
/** Along y: the same art mirrored (a mirror on screen swaps the floor's axes). */
const ALONG_Y = 10;
const WALL_STYLES = 3;

function ox(x: number, y: number): number {
  'worklet';
  return (x - y) * 32;
}
function oy(x: number, y: number, z: number): number {
  'worklet';
  return (x + y) * 16 - z;
}

/** Cold air spilling out and sinking. */
function coldBreath(c: SkCanvas, A: RenderAssets, x: number, y: number, t: number, seed: number, count: number): void {
  'worklet';
  for (let i = 0; i < count; i++) {
    const age = fract(t * 0.22 + i / count + seed);
    sprFade(c, A, A.S.steam, x + Math.sin(i * 2.7 + age * 2) * 6 + age * 8, y + age * 10, 0.6 + age * 1.2, Math.sin(age * Math.PI) * 0.35);
  }
}

/**
 * A piece of a room's furniture with its anchor at (px, py) (drawn straight, no canvas transform:
 * a big kitchen has a couple of hundred of them).
 */
export function drawRoomPiece(c: SkCanvas, A: RenderAssets, variant: number, active: boolean, t: number, seed: number, px: number, py: number): void {
  'worklet';
  const plain = A.paints.plain;
  if (variant < OWN) {
    spr(c, A, A.L.prep[variant] ?? -1, px, py, plain);
    if (variant >= BACK_ANIMATED) {
      c.save();
      c.translate(px, py);
      drawBack(c, A, variant, t, seed);
      c.restore();
    }
    return;
  }
  if (variant === PLANT) {
    sprXf(c, A, A.L.look.plantBush[0]!, px, py, Math.sin(t * 1.1 + seed) * 1.4, 1, 1, plain);
    return;
  }
  spr(c, A, A.L.room[variant - OWN] ?? -1, px, py, plain);
  if (variant === DISH_MACHINE) {
    // Steam from the hood's seams while a washer works; a wisp now and then while it waits.
    const n = active ? 4 : 1;
    for (let i = 0; i < n; i++) {
      const age = fract(t * (active ? 0.6 : 0.2) + i / n + seed);
      sprFade(c, A, A.S.steam, px + ox(0.04, 0.04) + Math.sin(age * 5 + i) * 5, py + oy(0.04, 0.04, 56) - age * 26, 0.7 + age * 1.3, Math.sin(age * Math.PI) * (active ? 0.7 : 0.35));
    }
  } else if (variant === COOLER) coldBreath(c, A, px + ox(0.3, 0), py + oy(0.3, 0, 30), t, seed, 2);
  else if (variant === FREEZER || variant === ICE) coldBreath(c, A, px + ox(0.3, 0), py + oy(0.3, 0, variant === ICE ? 24 : 34), t, seed, 3);
  else if (variant === DESK) {
    // The screen's light on the manager's face, the banker's lamp's warm pool.
    sprFade(c, A, A.S.glowHalo, px + ox(-0.24, -0.06), py + oy(-0.24, -0.06, 32), 0.35, 0.22 + Math.sin(t * 7 + seed) * 0.03 + (active ? 0.08 : 0));
    sprFade(c, A, A.S.glowHalo, px + ox(-0.24, 0.38), py + oy(-0.24, 0.38, 26), 0.3, 0.3);
  } else if (variant === COFFEE) {
    for (let i = 0; i < 2; i++) {
      const age = fract(t * 0.5 + i / 2 + seed);
      sprFade(c, A, A.S.steam, px + ox(0.12, 0.14) + Math.sin(age * 6) * 2, py + oy(0.12, 0.14, 26) - age * 14, 0.3 + age * 0.4, Math.sin(age * Math.PI) * (active ? 0.7 : 0.4));
    }
  } else if (variant === VEG_SINK && active) {
    // The tap runs: drops falling into the basin, a glint on the water.
    for (let i = 0; i < 3; i++) {
      const age = fract(t * 2.4 + i / 3);
      sprFade(c, A, A.S.sparkle, px + ox(-0.08, -0.04), py + oy(-0.08, -0.04, 38 - age * 12), 0.18, 1 - age);
    }
    sprFade(c, A, A.S.sparkle, px + ox(-0.1, -0.2) + Math.sin(t * 3) * 3, py + oy(-0.1, -0.2, 25), 0.35, 0.5 + Math.sin(t * 5) * 0.3);
  }
}

/** A unit of wall (variant: its style, +ALONG_Y along y) with its anchor at (px, py). */
export function drawWall(c: SkCanvas, A: RenderAssets, variant: number, px: number, py: number): void {
  'worklet';
  const style = variant % ALONG_Y;
  spr(c, A, A.L.wall[style + (variant >= ALONG_Y ? WALL_STYLES : 0)] ?? -1, px, py, A.paints.plain);
}

/** A door (variant: its kind, +ALONG_Y along y), open while someone is in the doorway. */
export function drawDoor(c: SkCanvas, A: RenderAssets, variant: number, open: boolean): void {
  'worklet';
  const kind = variant % ALONG_Y;
  const i = (open ? A.L.doorOpen[kind] : A.L.door[kind]) ?? -1;
  if (variant >= ALONG_Y) sprXf(c, A, i, 0, 0, 0, -1, 1, A.paints.plain);
  else spr(c, A, i, 0, 0, A.paints.plain);
}

/** A sign over a door, or over a line of the line room (a slight sway on its chains). */
export function drawRoomSign(c: SkCanvas, A: RenderAssets, variant: number, t: number, seed: number): void {
  'worklet';
  const i = A.L.roomSign[variant] ?? -1;
  if (variant >= A.L.roomSign.length - 2) sprXf(c, A, i, 0, 0, Math.sin(t * 0.9 + seed) * 1.6, 1, 1, A.paints.plain);
  else spr(c, A, i, 0, 0, A.paints.plain);
}
