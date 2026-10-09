import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';
import { Accessory, Outfit } from '../../data/looks';
import { EMOTE_SECONDS, STEP_SEC } from '../../data/sim';
import { C, F, type Packed } from '../../sim/snapshot';
import { Emote, Expression, Held, Pose } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { isoX, isoY } from '../iso';
import { clamp01, easeOutBack, fract, spr, sprFade, sprXf } from './primitives';

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
/** The `rank` a VIP customer carries (staff ranks are 1 and 2), and a child (src/data/customers.ts KID_RANK). */
const VIP_RANK = 3;
const KID_RANK = 4;
/** Children are drawn this size; sitting, they are lifted onto the seat. */
const KID_SCALE = 0.74;
const KID_SEAT_LIFT = 4;

/**
 * `detail` = false when zoomed far out (a late-game restaurant on screen at once): the pieces
 * too small to see there (shoes, hands, the far arm, the face, little accessories, the
 * legendary sparkle) are skipped, about 40% fewer draws per person (owner: "still laggy late").
 */
export function drawCharacter(c: SkCanvas, A: RenderAssets, d: Packed, o: number, alpha: number, t: number, selectedId: number, detail = true): void {
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

  const poseTime = d[o + C.poseTime]!;
  const emote = d[o + C.emote]!;
  const emoteAge = d[o + C.emoteTime]!;
  const sleepy = expression === Expression.Sleepy;

  // ----- pose -----
  const breathe = Math.sin(t * (sleepy ? 1.3 : 2.4) + phase);
  /** The whole body off the floor (px, legs too), a tilt about the feet (degrees, + = toward
   * where they face), squash (+ = wider and shorter), and where the head looks (px). */
  let hop = 0;
  let lean = 0;
  let squash = 0;
  let headX = 0;
  let headY = 0;
  /** Now and then a look to one side and back (idle, sitting, waiting). */
  const g = Math.sin(t * 0.53 + phase * 2.3);
  const glance = clamp01((Math.abs(g) - 0.72) / 0.18) * (g > 0 ? 1 : -1);
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
    // Leaning into the walk and rocking from foot to foot; carefully upright with a full tray.
    const careful = held === Held.TrayFull || held === Held.DirtyPlates || held === Held.FoodBox || held === Held.FoodDrink || held === Held.DrinkTray;
    lean = (careful ? 1 : 3) + s * (careful ? 0.5 : 1.4);
    // Setting off: a little push forward.
    if (poseTime < 0.2) lean += Math.sin((poseTime / 0.2) * Math.PI) * 3;
  } else if (pose === Pose.Shake) {
    // Shaking a cocktail: the shaker up by the shoulder, fast, the body rocking with it.
    armUp = true;
    armUpLift = 7 + Math.sin(t * 24 + phase) * 3.5;
    bob = Math.abs(Math.sin(t * 24 + phase)) * 0.8;
    lean = -1 + Math.sin(t * 12 + phase) * 1.2;
    headX = Math.sin(t * 12 + phase) * 0.6;
  } else if (pose === Pose.Pour) {
    // Pouring: the glass tipped out over the counter, a slow steady arm.
    armUp = true;
    armUpLift = 2 + Math.sin(t * 4 + phase) * 0.6;
    lean = 2.5;
    headY = 0.8;
  } else if (pose === Pose.Sip) {
    // At the bar: the glass up to the lips now and then.
    showLegs = false;
    const p = (t * 0.5 + phase) % 1;
    const raise = p < 0.25 ? Math.sin((p / 0.25) * Math.PI) : 0;
    armUp = true;
    armUpLift = 1 + raise * 7;
    bob = -1.5 + breathe * 0.3;
    headY = raise * -0.6;
    headX = raise > 0 ? 0 : glance * 1.1;
  } else if (pose === Pose.Sit || pose === Pose.SitEat) {
    showLegs = false;
    bob = -1.5 + breathe * 0.3;
    // Sitting down: a soft plop into the chair.
    if (poseTime < 0.35) squash = Math.sin((poseTime / 0.35) * Math.PI) * 0.11;
    if (pose === Pose.SitEat) {
      const p = (t * 0.9 + phase) % 1;
      const raise = 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
      armUp = true;
      armUpLift = raise * 7;
      biting = raise > 0.7;
      // Leaning in for each bite.
      lean = raise * 2.5;
      headY = raise * 0.8;
    } else if (held === Held.Phone) {
      // Head down over the phone, a thumb tapping away.
      headY = 1.3;
      armUpLift = Math.sin(t * 15 + phase) > 0.4 ? 0.9 : 0;
      lean = 1.5;
    } else {
      headX = glance * 1.1;
    }
  } else if (pose === Pose.Cook || pose === Pose.Wash) {
    armUp = true;
    const rate = pose === Pose.Cook ? 7 : 10;
    armUpLift = Math.max(0, Math.sin(t * rate + phase)) * (pose === Pose.Cook ? 5 : 2.5);
    farArm = Math.sin(t * rate + phase + 1.5) * 0.03;
    bob = Math.abs(Math.sin(t * rate + phase)) * 0.6;
    // Over the stove or the sink, swaying with the stirring or the scrubbing.
    lean = 2.5 + Math.sin(t * rate + phase) * 0.9;
    headY = 0.6;
  } else if (pose >= Pose.Fry && pose <= Pose.Place) {
    // At a kitchen station (owner M29): each its own rhythm. `beat` 0..1 repeats.
    armUp = true;
    lean = 3;
    headY = 0.7;
    if (pose === Pose.Fry) {
      // Shaking the basket, now and then lifting it to drain.
      const beat = fract(t * 0.45 + phase);
      armUpLift = (beat > 0.8 ? Math.sin(((beat - 0.8) / 0.2) * Math.PI) * 6 : 0) + Math.abs(Math.sin(t * 14 + phase)) * 1.4;
    } else if (pose === Pose.Flip) {
      // A press, a press, a flip.
      const beat = fract(t * 0.6 + phase);
      armUpLift = beat < 0.3 ? Math.sin((beat / 0.3) * Math.PI) * 7 : Math.abs(Math.sin(t * 9 + phase)) * 1.5;
      lean = 3.5;
    } else if (pose === Pose.Toss) {
      // The wok toss: a sharp flick up and back, the whole body in it.
      const beat = fract(t * 1.1 + phase);
      const flick = beat < 0.3 ? Math.sin((beat / 0.3) * Math.PI) : 0;
      armUpLift = 1 + flick * 8;
      lean = 2 - flick * 4;
      bob = flick * 1.2;
    } else if (pose === Pose.Slice) {
      // Quick, precise strokes of the knife.
      armUpLift = Math.abs(Math.sin(t * 15 + phase)) * 2.6;
      lean = 4;
      headY = 1.2;
    } else if (pose === Pose.Mix) {
      // Tossing the salad in the bowl.
      armUpLift = 2 + Math.max(0, Math.sin(t * 7 + phase)) * 3;
      lean = 2.5;
    } else if (pose === Pose.Stir) {
      armUpLift = 3 + Math.sin(t * 6 + phase) * 1.2;
      headX = Math.sin(t * 3 + phase) * 0.5;
    } else if (pose === Pose.Bake) {
      // Sliding the pizza in with the peel, turning it, drawing it out.
      armUpLift = 2 + Math.sin(t * 1.6 + phase) * 1.5;
      lean = 4 + Math.sin(t * 1.6 + phase) * 2;
    } else if (pose === Pose.Plate) {
      // Dressing the plate with tweezers: tiny, careful moves, head down.
      armUpLift = 0.5 + Math.sin(t * 9 + phase) * 0.6;
      lean = 5;
      headY = 1.6;
    } else {
      // Setting the plate down on the pass.
      armUpLift = Math.max(0, 3 - poseTime * 9);
      lean = 6;
      headY = 1;
    }
  } else if (pose === Pose.Impatient) {
    nearLift = Math.max(0, Math.sin(t * 13 + phase)) * 2;
    // Looking about: where is the table?
    headX = Math.sin(t * 2.6 + phase) * 1.3;
    lean = Math.sin(t * 1.7 + phase) * 1.2;
  } else if (pose === Pose.Phone) {
    armUp = true;
    headY = 1.3;
  } else if (pose === Pose.Cheer) {
    bob = Math.abs(Math.sin(t * 8 + phase)) * 4;
    // A wave with the free hand (the other may hold the menus or the flyers).
    armUp = true;
    armUpLift = 3 + Math.sin(t * 16 + phase) * 2.5;
    lean = Math.sin(t * 8 + phase) * 1.5;
  } else {
    // Standing: a settle after stopping, and a look around now and then.
    if (poseTime < 0.25) squash = Math.sin((poseTime / 0.25) * Math.PI) * 0.06;
    headX = glance * 1.3;
  }
  // Dozing off: the head nods, then jerks back up.
  if (sleepy) {
    const nod = (t * 0.35 + phase) % 1;
    headY += nod < 0.8 ? nod * 2 : (1 - nod) * 8;
  }
  // Feelings show in the whole body for a moment after the bubble pops up.
  if (emote !== Emote.None && emoteAge >= 0) {
    const a = emoteAge;
    if (emote === Emote.Heart || emote === Emote.Coin) {
      // A happy hop, a little squash on landing.
      if (a < 0.42) hop = Math.sin((a / 0.42) * Math.PI) * (emote === Emote.Heart ? 7 : 3.5);
      else if (a < 0.6) squash = Math.sin(((a - 0.42) / 0.18) * Math.PI) * 0.08;
    } else if (emote === Emote.Star) {
      // Two hops: a promotion, a star hire.
      if (a < 0.84) hop = Math.abs(Math.sin((a / 0.42) * Math.PI)) * 6;
    } else if (emote === Emote.Exclaim) {
      // A startle: up on the toes.
      if (a < 0.28) {
        hop = Math.sin((a / 0.28) * Math.PI) * 4;
        squash = -0.08;
      }
    } else if (emote === Emote.Anger) {
      // A stamp and a shake of the head.
      if (a < 0.7) {
        headX = Math.sin(a * 40) * 1.6 * (1 - a / 0.7);
        if (a < 0.15) squash = Math.sin((a / 0.15) * Math.PI) * 0.07;
      }
    } else if (emote === Emote.Music) {
      lean += Math.sin(t * 6 + phase) * 4;
    }
    if (!showLegs) hop *= 0.35;
  }
  const shake = expression === Expression.Angry && pose === Pose.Impatient ? Math.sin(t * 50) * 0.6 : 0;
  const up = -bob;

  // ----- sprite set for this view -----
  const v = viewB ? 1 : 0;
  const pick = (front: number, back: number) => (v === 1 ? back : front);

  // The rank field carries the badge (or VIP / child) in its ones and the rarity in its tens.
  const rankRaw = d[o + C.rank]!;
  const rank = rankRaw % 10;
  const rarity = Math.floor(rankRaw / 10);
  const kid = rank === KID_RANK;
  c.save();
  // Up on a bar stool: higher than a chair.
  c.translate(isoX(wx, wy) + shake, isoY(wx, wy) - d[o + C.lift]!);
  if (kid) {
    if (!showLegs) c.translate(0, -KID_SEAT_LIFT);
    c.scale(KID_SCALE, KID_SCALE);
  }
  if (d[o + F.id] === selectedId) {
    // Selected worker: a breathing ring at their feet.
    P.ring.setAlphaf(0.6 + Math.sin(t * 6) * 0.3);
    c.save();
    c.scale(1, 0.5);
    c.drawCircle(0, 0, 15 + Math.sin(t * 6) * 1.5, P.ring);
    c.restore();
    P.ring.setAlphaf(1);
  }
  if (rarity > 0) {
    // A rare, epic or legendary worker (or applicant): a colored ring at their feet; the
    // legendary ones also glow and glitter.
    const ring = P.rarity[rarity - 1]!;
    ring.setAlphaf(0.55 + Math.sin(t * 3 + phase) * 0.25);
    c.save();
    c.scale(1, 0.5);
    c.drawCircle(0, 0, 12 + rarity, ring);
    c.restore();
    if (rarity === 3 && detail) {
      sprFade(c, A, S.glowHalo, 0, -14, 0.9, 0.35 + Math.sin(t * 3.4 + phase) * 0.15);
      const sp = fract(t * 0.8 + phase);
      sprFade(c, A, S.sparkle, Math.sin(phase * 7 + Math.floor(t * 0.8 + phase)) * 12, -12 - sp * 34, 0.5 + sp * 0.3, 1 - sp);
    }
  }
  if (showLegs) {
    // The shadow shrinks as they leave the floor.
    const k = 1 - Math.min(0.35, hop * 0.035);
    sprXf(c, A, S.charShadow, 0, 0, 0, k, k, P.plain);
  }
  // A VIP guest: a golden glow at their feet (the crown comes with the overlays).
  if (rank === VIP_RANK) sprFade(c, A, S.glowHalo, 0, -16, 1.15, 0.55 + Math.sin(t * 4) * 0.2);
  if (hop > 0) c.translate(0, -hop);
  if (flip) c.scale(-1, 1);
  if (lean !== 0) c.rotate(lean, 0, 0);
  c.scale(1 - breathe * 0.008 + squash * 0.6, 1 + breathe * 0.012 - squash);

  const leg = (near: boolean, shift: number, lift: number) => {
    const dx = lx(viewB, shift, 0);
    const dy = ly(viewB, shift, 0, lift);
    spr(c, A, near ? pick(S.legNearF, S.legNearB) : pick(S.legFarF, S.legFarB), dx, dy, pants);
    if (detail) spr(c, A, near ? pick(S.shoeNearF, S.shoeNearB) : pick(S.shoeFarF, S.shoeFarB), dx, dy, P.plain);
  };

  if (showLegs) leg(false, farLeg, farLift);
  if (detail) {
    const fax = lx(viewB, farArm, 0);
    const fay = ly(viewB, farArm, 0, 0) + up;
    spr(c, A, pick(S.armFarF, S.armFarB), fax, fay, shirt);
    spr(c, A, pick(S.handFarF, S.handFarB), fax, fay, handPaint);
    if (!viewB && accessory === Accessory.Backpack) spr(c, A, S.backpackF, 0, up, P.plain);
  }
  if (showLegs) leg(true, nearLeg, nearLift);

  spr(c, A, pick(S.torsoF, S.torsoB), 0, up, shirt);
  if (outfit === Outfit.Hoodie && detail) spr(c, A, pick(S.hoodF, S.hoodB), 0, up, shirt);
  spr(c, A, viewB ? L.outfit.B[outfit]! : L.outfit.F[outfit]!, 0, up, P.plain);
  if (accessory === Accessory.Camera && detail) spr(c, A, pick(S.cameraF, S.cameraB), 0, up, P.plain);
  if (rank > 0 && rank < VIP_RANK && !viewB && detail) {
    // Senior staff wear a badge: silver, then gold.
    sprXf(c, A, S.rankStar, lx(false, 0.16, -0.12), ly(false, 0.16, -0.12, 19) + up, 0, 0.75, 0.75, rank >= 2 ? P.gold : P.white);
  }
  if (accessory === Accessory.Backpack && detail) spr(c, A, pick(S.backpackStrapsF, S.backpackB), 0, up, P.plain);

  let hx: number;
  let hy: number;
  if (armUp) {
    spr(c, A, pick(S.armUpF, S.armUpB), 0, up - armUpLift, shirt);
    if (detail) spr(c, A, pick(S.handUpF, S.handUpB), 0, up - armUpLift, handPaint);
    hx = lx(viewB, 0.15, -ARM_R);
    hy = ly(viewB, 0.15, -ARM_R, 24) + up - armUpLift;
  } else {
    const nax = lx(viewB, nearArm, 0);
    const nay = ly(viewB, nearArm, 0, 0) + up;
    spr(c, A, pick(S.armNearF, S.armNearB), nax, nay, shirt);
    if (detail) spr(c, A, pick(S.handNearF, S.handNearB), nax, nay, handPaint);
    hx = lx(viewB, nearArm, -ARM_R);
    hy = ly(viewB, nearArm, -ARM_R, 10) + up;
  }

  const headUp = up + headY;
  spr(c, A, pick(S.headF, S.headB), headX, headUp, skin);
  if (!viewB && detail) {
    let face = L.face[expression]!;
    if (expression === Expression.Eating) face = biting ? S.faceEating : S.faceChew;
    else if ((expression === Expression.Happy || expression === Expression.Neutral) && (t + phase) % 3.7 < 0.13) face = S.faceBlink;
    spr(c, A, face, headX, headUp, P.plain);
    spr(c, A, L.faceAccessory[accessory]!, headX, headUp, P.plain);
  }
  spr(c, A, viewB ? L.hair.B[hair]! : L.hair.F[hair]!, headX, headUp, hairPaint);
  spr(c, A, viewB ? L.hat.B[hat]! : L.hat.F[hat]!, headX, headUp, P.plain);

  if (held >= Held.PlateBase) {
    // A plated dish carried to the pass, held out level in front.
    const plate = L.plate[held - Held.PlateBase];
    const wobble = pose === Pose.Walk ? Math.sin(t * 18 + phase) * 0.5 : 0;
    if (plate) spr(c, A, plate[0]!, hx, hy + 3 + wobble, P.plain);
  } else if (held === Held.Wok || held === Held.Peel || held === Held.Basket || held === Held.Bowl) {
    // The cooking tools move with the job: the wok tips on the toss and the noodles fly, the
    // peel slides forward and back, the basket swings, the salad hops in the bowl.
    const tool = L.held[held]!;
    if (held === Held.Wok) {
      const beat = fract(t * 1.1 + phase);
      const flick = pose === Pose.Toss && beat < 0.3 ? Math.sin((beat / 0.3) * Math.PI) : 0;
      sprXf(c, A, tool, hx, hy + 4, -flick * 22, 1, 1, P.plain);
      if (pose === Pose.Toss) {
        for (let i = 0; i < 5; i++) {
          const k = fract(t * 1.1 + phase - 0.05 - i * 0.03);
          if (k > 0.55) continue;
          const air = Math.sin((k / 0.55) * Math.PI);
          sprXf(c, A, i % 2 === 0 ? S.tossNoodle : S.tossVeg, hx + 2 + (i - 2) * 3 + k * 6, hy + 1 - air * (12 + i * 2), k * 500 + i * 60, 1, 1, P.plain);
        }
      }
    } else if (held === Held.Peel) {
      const push = pose === Pose.Bake ? Math.sin(t * 1.6 + phase) * 5 : 0;
      spr(c, A, tool, hx + push, hy + 4 + push * 0.5, P.plain);
    } else if (held === Held.Basket) {
      sprXf(c, A, tool, hx, hy + 3, pose === Pose.Fry ? Math.sin(t * 14 + phase) * 6 : 0, 1, 1, P.plain);
    } else {
      spr(c, A, tool, hx, hy + 3, P.plain);
      if (pose === Pose.Mix) {
        for (let i = 0; i < 3; i++) {
          const k = fract(t * 1.4 + phase + i * 0.33);
          sprXf(c, A, S.tossLeaf, hx - 4 + i * 4, hy - 2 - Math.sin(k * Math.PI) * 6, k * 300, 0.9, 0.9, P.plain);
        }
      }
    }
  } else if (held !== Held.None) {
    if (held === Held.TrayFull || held === Held.TrayEmpty || held === Held.DirtyPlates || held === Held.DrinkTray) {
      // The tray wobbles a little with every step.
      const wobble = pose === Pose.Walk ? Math.sin(t * 18 + phase) * 0.7 : 0;
      spr(c, A, L.held[held]!, lx(viewB, 0.1, -0.3), ly(viewB, 0.1, -0.3, 23) + up + wobble, P.plain);
    } else if (held === Held.Spatula) {
      const sx = lx(viewB, 0.04, -ARM_R);
      const sy = ly(viewB, 0.04, -ARM_R, 10) + up - Math.max(0, Math.sin(t * 7 + phase)) * 4;
      spr(c, A, L.held[held]!, sx, sy, P.plain);
    } else if (held === Held.Clipboard || held === Held.Flyers || held === Held.Bag || held === Held.FoodBox || held === Held.FoodDrink) {
      // Held low against the chest, not in front of the face like a phone.
      spr(c, A, L.held[held]!, hx, hy + 9, P.plain);
    } else {
      spr(c, A, L.held[held]!, hx, hy, P.plain);
    }
  }
  c.restore();
}

/** Bubbles and bars go in a second pass so nothing in front ever hides them. */
export function drawCharacterOverlay(c: SkCanvas, A: RenderAssets, d: Packed, o: number, alpha: number, t: number): void {
  'worklet';
  const emote = d[o + C.emote]!;
  const patience = d[o + C.patience]!;
  const bubble = d[o + C.bubble]!;
  const rank = d[o + C.rank]! % 10;
  if (emote === 0 && patience < 0 && bubble === 0 && rank !== VIP_RANK) return;
  const wx = d[o + F.px]! + (d[o + F.x]! - d[o + F.px]!) * alpha;
  const wy = d[o + F.py]! + (d[o + F.y]! - d[o + F.py]!) * alpha;
  const x = isoX(wx, wy);
  let top = isoY(wx, wy) - (rank === KID_RANK ? 42 : 54);
  const P = A.paints;
  if (rank === VIP_RANK) {
    // The VIP's crown, bobbing over everything else above their head.
    sprXf(c, A, A.S.crown, x, top - 26 - Math.abs(Math.sin(t * 3)) * 3, Math.sin(t * 2) * 8, 1.3, 1.3, P.plain);
  }
  if (patience >= 0) {
    const w = 22;
    c.drawRRect({ rect: { x: x - w / 2 - 1.5, y: top - 1.5, width: w + 3, height: 6 }, rx: 3, ry: 3 }, P.barBack);
    const fillPaint = patience > 0.5 ? P.barGood : patience > 0.25 ? P.barMid : P.barLow;
    c.drawRRect({ rect: { x: x - w / 2, y: top, width: Math.max(2, w * patience), height: 3 }, rx: 1.5, ry: 1.5 }, fillPaint);
    // The icon means the bar never relies on color alone, and tells how long they will wait.
    const kind = d[o + C.patienceKind]!;
    sprXf(c, A, kind === 1 ? A.S.bolt : kind === 2 ? A.S.snail : A.S.clock, x - w / 2 - 5, top + 1.5, 0, 0.55, 0.55, P.plain);
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
