import type { SkCanvas } from '@shopify/react-native-skia';
import { Accessory, Outfit } from '../../data/looks';
import { EMOTE_SECONDS, STEP_SEC } from '../../data/sim';
import { C, F } from '../../sim/snapshot';
import { Expression, Held, Pose } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { clamp01, easeOutBack, spr, sprFade, sprXf } from './primitives';

const SHOULDER_X = 8.6;
const SHOULDER_Y = -20;
const ARM_LEN = 8.6;
const HIP_X = 3.6;
const HIP_Y = -9;
const LEG_LEN = 9;
const SIT_LIFT = -16;
const DEG = Math.PI / 180;

/** Per-frame pose, derived purely from sim state + time: no animation state is stored. */
interface PoseFrame {
  bob: number;
  lift: number;
  legL: number;
  legR: number;
  footLiftR: number;
  armL: number;
  armR: number;
  sx: number;
  sy: number;
  shake: number;
  showLegs: boolean;
  eatingBite: boolean;
}

function poseFrame(pose: number, held: number, angry: boolean, t: number, phase: number): PoseFrame {
  'worklet';
  const breathe = Math.sin(t * 2.2 + phase);
  const f: PoseFrame = {
    bob: breathe * 0.45,
    lift: 0,
    legL: 0,
    legR: 0,
    footLiftR: 0,
    armL: 8 + breathe * 2,
    armR: -8 - breathe * 2,
    sx: 1 - breathe * 0.008,
    sy: 1 + breathe * 0.014,
    shake: 0,
    showLegs: true,
    eatingBite: false,
  };
  if (pose === Pose.Walk) {
    const s = Math.sin(t * 8.5 + phase);
    f.legL = s * 26;
    f.legR = -s * 26;
    f.armL = 8 - s * 22;
    f.armR = -8 - s * 22;
    f.bob = -Math.abs(Math.cos(t * 8.5 + phase)) * 1.6;
    f.sy = 1 - Math.abs(Math.sin(t * 8.5 + phase)) * 0.025;
    f.sx = 1;
  } else if (pose === Pose.Sit || pose === Pose.SitEat) {
    f.lift = SIT_LIFT;
    f.showLegs = false;
    f.armL = 28;
    f.armR = -28;
    if (pose === Pose.SitEat) {
      const p = (t * 0.9 + phase) % 1;
      const raise = 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
      f.armR = -28 - raise * 140;
      f.eatingBite = raise > 0.7;
    }
  } else if (pose === Pose.Cook) {
    const s = Math.sin(t * 7 + phase);
    f.armR = -62 + s * 26;
    f.armL = 34 + Math.sin(t * 7 + phase + 1) * 10;
    f.bob = Math.abs(s) * -0.8;
  } else if (pose === Pose.Wash) {
    f.armR = 32 + Math.sin(t * 9 + phase) * 20;
    f.armL = -32 + Math.sin(t * 9 + phase + 1.5) * 20;
    f.bob = Math.sin(t * 9 + phase) * 0.5;
  } else if (pose === Pose.Impatient) {
    f.footLiftR = Math.max(0, Math.sin(t * 13 + phase)) * 2.2;
    f.armL = 18;
    if (angry) f.shake = Math.sin(t * 50) * 0.7 * (Math.sin(t * 2 + phase) > 0.2 ? 1 : 0);
  } else if (pose === Pose.Cheer) {
    const s = Math.abs(Math.sin(t * 8 + phase));
    f.armL = 150 + s * 15;
    f.armR = -150 - s * 15;
    f.bob = -s * 3;
  }
  if (held === Held.TrayFull || held === Held.TrayEmpty) f.armR = -112 + f.bob * 2;
  else if (held === Held.Phone && pose !== Pose.Cook) f.armR = 30 + Math.sin(t * 1.3 + phase) * 3;
  return f;
}

function drawLimb(
  c: SkCanvas, A: RenderAssets, sx: number, sy: number, angle: number, len: number,
  limb: number, end: number, limbPaint: Parameters<typeof spr>[5], endPaint: Parameters<typeof spr>[5],
): void {
  'worklet';
  sprXf(c, A, limb, sx, sy, angle, 1, 1, limbPaint);
  spr(c, A, end, sx - Math.sin(angle * DEG) * len, sy + Math.cos(angle * DEG) * len, endPaint);
}

/** One layered character: shadow, legs, arms, body, outfit, head, face, hair, hat, held item. */
export function drawCharacter(c: SkCanvas, A: RenderAssets, d: number[], o: number, alpha: number, t: number): void {
  'worklet';
  const S = A.S;
  const L = A.L;
  const P = A.paints;
  const x = d[o + F.px]! + (d[o + F.x]! - d[o + F.px]!) * alpha;
  const y = d[o + F.py]! + (d[o + F.y]! - d[o + F.py]!) * alpha;
  const facing = d[o + C.facing]!;
  const back = facing >= 2;
  const flip = facing === 1 || facing === 3;
  const pose = d[o + C.pose]!;
  const held = d[o + C.held]!;
  const outfit = d[o + C.outfit]!;
  const hair = d[o + C.hair]!;
  const hat = d[o + C.hat]!;
  const accessory = d[o + C.accessory]!;
  const expression = d[o + C.expression]!;
  const phase = d[o + F.id]! * 1.618;

  const uniform = outfit === Outfit.Chef || outfit === Outfit.Waiter;
  const shirt = uniform ? P.white : P.shirt[d[o + C.shirt]!]!;
  const skin = P.skin[d[o + C.skin]!]!;
  const handPaint = outfit === Outfit.Washer ? P.glove : skin;
  const pants = P.pants[d[o + C.pants]!]!;
  const hairPaint = P.hair[d[o + C.hairColor]!]!;

  const f = poseFrame(pose, held, expression === Expression.Angry, t, phase);
  const up = f.bob + f.lift;
  const headUp = up + Math.sin(t * 2.2 + phase - 0.7) * 0.25;

  c.save();
  c.translate(x + f.shake, y);
  if (f.showLegs) spr(c, A, S.shadow, 0, 0, P.plain);
  if (flip) c.scale(-1, 1);
  c.scale(f.sx, f.sy);

  const legs = () => {
    if (!f.showLegs) return;
    for (let side = -1; side <= 1; side += 2) {
      const angle = side < 0 ? f.legL : f.legR;
      const hx = side * HIP_X;
      const lift = side > 0 ? f.footLiftR : 0;
      sprXf(c, A, S.leg, hx, HIP_Y - lift, angle, 1, 1, pants);
      const fy = HIP_Y + Math.cos(angle * DEG) * LEG_LEN - lift - (angle * side > 0 ? Math.abs(angle) * 0.04 : 0);
      spr(c, A, S.shoe, hx - Math.sin(angle * DEG) * LEG_LEN, fy, P.plain);
    }
  };
  const arm = (side: number) => {
    const angle = side < 0 ? f.armL : f.armR;
    drawLimb(c, A, side * SHOULDER_X, SHOULDER_Y + up, angle, ARM_LEN, S.arm, S.hand, shirt, handPaint);
  };
  const heldItem = () => {
    if (held === 0) return;
    const hx = SHOULDER_X - Math.sin(f.armR * DEG) * ARM_LEN;
    const hy = SHOULDER_Y + up + Math.cos(f.armR * DEG) * ARM_LEN;
    if (held === Held.Spatula) sprXf(c, A, L.held[held]!, hx, hy, f.armR + 62, 1, 1, P.plain);
    else if (held === Held.Phone) spr(c, A, L.held[held]!, hx, hy - 1, P.plain);
    else spr(c, A, L.held[held]!, hx + 3, hy + 1, P.plain);
  };

  if (!back) {
    spr(c, A, L.hairBehind[hair]!, 0, headUp, hairPaint);
    if (accessory === Accessory.Backpack) spr(c, A, S.backpackBehind, 0, up, P.plain);
    legs();
    arm(-1);
    spr(c, A, L.bodyFront[outfit]!, 0, up, shirt);
    spr(c, A, L.overFront[outfit]!, 0, up, P.plain);
    if (accessory === Accessory.Camera) spr(c, A, S.camera, 0, up, P.plain);
    if (accessory === Accessory.Backpack) spr(c, A, S.backpackStraps, 0, up, P.plain);
    arm(1);
    spr(c, A, S.head, 0, headUp, skin);
    let face = L.face[expression]!;
    if (expression === Expression.Eating) face = f.eatingBite ? S.faceEating : S.faceChew;
    else if ((expression === Expression.Happy || expression === Expression.Neutral) && (t + phase) % 3.7 < 0.13) face = S.faceBlink;
    spr(c, A, face, 0, headUp, P.plain);
    spr(c, A, L.faceAccessory[accessory]!, 0, headUp, P.plain);
    spr(c, A, L.hairFront[hair]!, 0, headUp, hairPaint);
    spr(c, A, L.hatFront[hat]!, 0, headUp, P.plain);
    heldItem();
  } else {
    legs();
    arm(-1);
    arm(1);
    spr(c, A, L.bodyBack[outfit]!, 0, up, shirt);
    spr(c, A, L.overBack[outfit]!, 0, up, P.plain);
    if (accessory === Accessory.Backpack) spr(c, A, S.backpackBack, 0, up, P.plain);
    spr(c, A, S.headBack, 0, headUp, skin);
    spr(c, A, L.hairBack[hair]!, 0, headUp, hairPaint);
    spr(c, A, L.hatBack[hat]!, 0, headUp, P.plain);
    heldItem();
  }
  c.restore();
}

/** Bubbles and bars go in a second pass so a prop in front never hides them. */
export function drawCharacterOverlay(c: SkCanvas, A: RenderAssets, d: number[], o: number, alpha: number, t: number): void {
  'worklet';
  const emote = d[o + C.emote]!;
  const patience = d[o + C.patience]!;
  if (emote === 0 && patience < 0) return;
  const x = d[o + F.px]! + (d[o + F.x]! - d[o + F.px]!) * alpha;
  const pose = d[o + C.pose]!;
  const lift = pose === Pose.Sit || pose === Pose.SitEat ? SIT_LIFT : 0;
  const top = d[o + F.py]! + (d[o + F.y]! - d[o + F.py]!) * alpha + lift - 48;
  let barY = top;
  if (patience >= 0) {
    const P = A.paints;
    const w = 20;
    c.drawRRect({ rect: { x: x - w / 2 - 1, y: barY - 1, width: w + 2, height: 5 }, rx: 2.5, ry: 2.5 }, P.barBack);
    const fillPaint = patience > 0.5 ? P.barGood : patience > 0.25 ? P.barMid : P.barLow;
    c.drawRRect({ rect: { x: x - w / 2, y: barY, width: Math.max(1.5, w * patience), height: 3 }, rx: 1.5, ry: 1.5 }, fillPaint);
    // The clock icon means the bar never relies on color alone.
    sprXf(c, A, A.S.clock, x - w / 2 - 3.5, barY + 1.5, 0, 0.5, 0.5, P.plain);
    barY -= 4;
  }
  if (emote !== 0) {
    const age = d[o + C.emoteTime]! - (1 - alpha) * STEP_SEC;
    if (age < 0) return;
    const pop = age < 0.3 ? easeOutBack(clamp01(age / 0.3)) : 1;
    const fade = clamp01((EMOTE_SECONDS - age) / 0.3);
    const by = barY - 1 - Math.sin(age * 3.5) * 0.8;
    sprFade(c, A, A.S.bubble, x, by, pop, fade);
    sprFade(c, A, A.L.emote[emote]!, x, by - 11.8 * pop, pop * 0.95, fade);
  }
}
