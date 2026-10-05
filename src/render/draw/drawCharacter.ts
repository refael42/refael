import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';
import { Accessory, Outfit } from '../../data/looks';
import { EMOTE_SECONDS, STEP_SEC } from '../../data/sim';
import { C, F } from '../../sim/snapshot';
import { Expression, Held, Pose } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { isoX, isoY } from '../iso';
import { clamp01, easeOutBack, spr, sprFade, sprXf } from './primitives';

const ARM_R = 0.165;

/** Screen offset (px) of a point in the character's own frame (f fwd, r right, z up). */
function lx(viewB: boolean, f: number, r: number): number {
  'worklet';
  return viewB ? (f - r) * 32 : (f + r) * 32;
}
function ly(viewB: boolean, f: number, r: number, z: number): number {
  'worklet';
  return viewB ? (-r - f) * 16 - z : (f - r) * 16 - z;
}

/** One blocky character. All animation is a pure function of sim state + time. */
export function drawCharacter(c: SkCanvas, A: RenderAssets, d: number[], o: number, alpha: number, t: number): void {
  'worklet';
  const S = A.S;
  const L = A.L;
  const P = A.paints;
  const wx = d[o + F.px]! + (d[o + F.x]! - d[o + F.px]!) * alpha;
  const wy = d[o + F.py]! + (d[o + F.y]! - d[o + F.py]!) * alpha;
  const facing = d[o + C.facing]!;
  const viewB = facing >= 2;
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
  const shirt: SkPaint = uniform ? P.white : P.shirt[d[o + C.shirt]!]!;
  const skin = P.skin[d[o + C.skin]!]!;
  const handPaint = outfit === Outfit.Washer ? P.glove : skin;
  const pants = P.pants[d[o + C.pants]!]!;
  const hairPaint = P.hair[d[o + C.hairColor]!]!;

  // ----- pose -----
  const breathe = Math.sin(t * 2.4 + phase);
  let bob = breathe * 0.35;
  let nearLeg = 0;
  let farLeg = 0;
  let nearLift = 0;
  let farLift = 0;
  let nearArm = 0;
  let farArm = 0;
  let armUpLift = 0;
  let showLegs = true;
  let armUp = held !== Held.None && held !== Held.Spatula;
  let biting = false;
  if (pose === Pose.Walk) {
    const s = Math.sin(t * 9 + phase);
    nearLeg = s * 0.055;
    farLeg = -s * 0.055;
    nearLift = Math.max(0, s) * 1.8;
    farLift = Math.max(0, -s) * 1.8;
    nearArm = -s * 0.045;
    farArm = s * 0.045;
    bob = Math.abs(Math.cos(t * 9 + phase)) * 1.3;
  } else if (pose === Pose.Sit || pose === Pose.SitEat) {
    showLegs = false;
    bob = -1.5 + breathe * 0.3;
    if (pose === Pose.SitEat) {
      const p = (t * 0.9 + phase) % 1;
      const raise = 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
      armUp = true;
      armUpLift = raise * 7;
      biting = raise > 0.7;
    }
  } else if (pose === Pose.Cook || pose === Pose.Wash) {
    armUp = true;
    const rate = pose === Pose.Cook ? 7 : 10;
    armUpLift = Math.max(0, Math.sin(t * rate + phase)) * (pose === Pose.Cook ? 5 : 2.5);
    farArm = Math.sin(t * rate + phase + 1.5) * 0.03;
    bob = Math.abs(Math.sin(t * rate + phase)) * 0.6;
  } else if (pose === Pose.Impatient) {
    nearLift = Math.max(0, Math.sin(t * 13 + phase)) * 2;
  } else if (pose === Pose.Phone) {
    armUp = true;
  } else if (pose === Pose.Cheer) {
    bob = Math.abs(Math.sin(t * 8 + phase)) * 4;
  }
  const shake = expression === Expression.Angry && pose === Pose.Impatient ? Math.sin(t * 50) * 0.6 : 0;
  const up = -bob;

  // ----- sprite set for this view -----
  const v = viewB ? 1 : 0;
  const pick = (front: number, back: number) => (v === 1 ? back : front);

  c.save();
  c.translate(isoX(wx, wy) + shake, isoY(wx, wy));
  if (showLegs) spr(c, A, S.charShadow, 0, 0, P.plain);
  if (flip) c.scale(-1, 1);
  c.scale(1 - breathe * 0.008, 1 + breathe * 0.012);

  const leg = (near: boolean, shift: number, lift: number) => {
    const dx = lx(viewB, shift, 0);
    const dy = ly(viewB, shift, 0, lift);
    spr(c, A, near ? pick(S.legNearF, S.legNearB) : pick(S.legFarF, S.legFarB), dx, dy, pants);
    spr(c, A, near ? pick(S.shoeNearF, S.shoeNearB) : pick(S.shoeFarF, S.shoeFarB), dx, dy, P.plain);
  };

  if (showLegs) leg(false, farLeg, farLift);
  const fax = lx(viewB, farArm, 0);
  const fay = ly(viewB, farArm, 0, 0) + up;
  spr(c, A, pick(S.armFarF, S.armFarB), fax, fay, shirt);
  spr(c, A, pick(S.handFarF, S.handFarB), fax, fay, handPaint);
  if (!viewB && accessory === Accessory.Backpack) spr(c, A, S.backpackF, 0, up, P.plain);
  if (showLegs) leg(true, nearLeg, nearLift);

  spr(c, A, pick(S.torsoF, S.torsoB), 0, up, shirt);
  if (outfit === Outfit.Hoodie) spr(c, A, pick(S.hoodF, S.hoodB), 0, up, shirt);
  spr(c, A, viewB ? L.outfit.B[outfit]! : L.outfit.F[outfit]!, 0, up, P.plain);
  if (accessory === Accessory.Camera) spr(c, A, pick(S.cameraF, S.cameraB), 0, up, P.plain);
  if (accessory === Accessory.Backpack) spr(c, A, pick(S.backpackStrapsF, S.backpackB), 0, up, P.plain);

  let hx: number;
  let hy: number;
  if (armUp) {
    spr(c, A, pick(S.armUpF, S.armUpB), 0, up - armUpLift, shirt);
    spr(c, A, pick(S.handUpF, S.handUpB), 0, up - armUpLift, handPaint);
    hx = lx(viewB, 0.15, -ARM_R);
    hy = ly(viewB, 0.15, -ARM_R, 24) + up - armUpLift;
  } else {
    const nax = lx(viewB, nearArm, 0);
    const nay = ly(viewB, nearArm, 0, 0) + up;
    spr(c, A, pick(S.armNearF, S.armNearB), nax, nay, shirt);
    spr(c, A, pick(S.handNearF, S.handNearB), nax, nay, handPaint);
    hx = lx(viewB, nearArm, -ARM_R);
    hy = ly(viewB, nearArm, -ARM_R, 10) + up;
  }

  spr(c, A, pick(S.headF, S.headB), 0, up, skin);
  if (!viewB) {
    let face = L.face[expression]!;
    if (expression === Expression.Eating) face = biting ? S.faceEating : S.faceChew;
    else if ((expression === Expression.Happy || expression === Expression.Neutral) && (t + phase) % 3.7 < 0.13) face = S.faceBlink;
    spr(c, A, face, 0, up, P.plain);
    spr(c, A, L.faceAccessory[accessory]!, 0, up, P.plain);
  }
  spr(c, A, viewB ? L.hair.B[hair]! : L.hair.F[hair]!, 0, up, hairPaint);
  spr(c, A, viewB ? L.hat.B[hat]! : L.hat.F[hat]!, 0, up, P.plain);

  if (held !== Held.None) {
    if (held === Held.TrayFull || held === Held.TrayEmpty || held === Held.DirtyPlates) {
      spr(c, A, L.held[held]!, lx(viewB, 0.1, -0.3), ly(viewB, 0.1, -0.3, 23) + up, P.plain);
    } else if (held === Held.Spatula) {
      const sx = lx(viewB, 0.04, -ARM_R);
      const sy = ly(viewB, 0.04, -ARM_R, 10) + up - Math.max(0, Math.sin(t * 7 + phase)) * 4;
      spr(c, A, L.held[held]!, sx, sy, P.plain);
    } else {
      spr(c, A, L.held[held]!, hx, hy, P.plain);
    }
  }
  c.restore();
}

/** Bubbles and bars go in a second pass so nothing in front ever hides them. */
export function drawCharacterOverlay(c: SkCanvas, A: RenderAssets, d: number[], o: number, alpha: number, t: number): void {
  'worklet';
  const emote = d[o + C.emote]!;
  const patience = d[o + C.patience]!;
  const bubble = d[o + C.bubble]!;
  if (emote === 0 && patience < 0 && bubble === 0) return;
  const wx = d[o + F.px]! + (d[o + F.x]! - d[o + F.px]!) * alpha;
  const wy = d[o + F.py]! + (d[o + F.y]! - d[o + F.py]!) * alpha;
  const x = isoX(wx, wy);
  let top = isoY(wx, wy) - 54;
  const P = A.paints;
  if (patience >= 0) {
    const w = 22;
    c.drawRRect({ rect: { x: x - w / 2 - 1.5, y: top - 1.5, width: w + 3, height: 6 }, rx: 3, ry: 3 }, P.barBack);
    const fillPaint = patience > 0.5 ? P.barGood : patience > 0.25 ? P.barMid : P.barLow;
    c.drawRRect({ rect: { x: x - w / 2, y: top, width: Math.max(2, w * patience), height: 3 }, rx: 1.5, ry: 1.5 }, fillPaint);
    // The clock icon means the bar never relies on color alone.
    sprXf(c, A, A.S.clock, x - w / 2 - 5, top + 1.5, 0, 0.55, 0.55, P.plain);
    top -= 4;
  }
  if (emote !== 0) {
    const age = d[o + C.emoteTime]! - (1 - alpha) * STEP_SEC;
    if (age >= 0) {
      const pop = age < 0.3 ? easeOutBack(clamp01(age / 0.3)) : 1;
      const fade = clamp01((EMOTE_SECONDS - age) / 0.3);
      const by = top - Math.sin(age * 3.5) * 0.8;
      sprFade(c, A, A.S.bubble, x, by, pop, fade);
      sprFade(c, A, A.L.emote[emote]!, x, by - 12.6 * pop, pop, fade);
      return;
    }
  }
  if (bubble !== 0) {
    // Persistent wants pulse gently: "tap me".
    const pulse = 1 + Math.sin(t * 5 + o) * 0.06;
    const by = top - Math.abs(Math.sin(t * 2.5 + o)) * 1.5;
    sprXf(c, A, A.S.bubble, x, by, 0, pulse, pulse, P.plain);
    sprXf(c, A, A.L.bubble[bubble]!, x, by - 12.6 * pulse, 0, pulse, pulse, P.plain);
  }
}
