import type { Look } from './looks';
import { Accessory, Hair, Hat, Outfit, PANTS, SHIRT } from './looks';
import type { Facing, PropKind, RoutineStep } from '../sim/types';
import { Emote, Expression, Facing as F, Held, Pose, PropKind as K } from '../sim/types';

export interface CastMember {
  look: Look;
  x: number;
  y: number;
  speed: number;
  facing: Facing;
  routine: RoutineStep[];
  /** i18n key shown under the character in the lineup view. */
  label?: string;
}

export interface PropPlacement {
  kind: PropKind;
  x: number;
  y: number;
  variant?: number;
  level?: number;
  active?: boolean;
  /** Height above the floor, e.g. plates standing on a counter. */
  lift?: number;
  label?: string;
}

export interface SceneDef {
  id: 'styleTest' | 'lineup';
  /** World units; the camera fits this width to the screen. */
  width: number;
  height: number;
  seed: number;
  floorTop: number;
  props: PropPlacement[];
  cast: CastMember[];
  /** Where stress-test walkers may roam. */
  roam: { minX: number; maxX: number; minY: number; maxY: number };
}

export const WALK_SPEED = { normal: 46, rushed: 64, staff: 58, stroll: 34 } as const;

export const LOOKS = {
  tourist: { outfit: Outfit.Hawaiian, hair: Hair.Short, hairColor: 3, skin: 0, shirt: SHIRT.teal, pants: PANTS.khaki, hat: Hat.SunHat, accessory: Accessory.Camera },
  rushed: { outfit: Outfit.Suit, hair: Hair.Bob, hairColor: 0, skin: 3, shirt: SHIRT.navy, pants: PANTS.black, hat: Hat.None, accessory: Accessory.Glasses },
  student: { outfit: Outfit.Hoodie, hair: Hair.Curly, hairColor: 1, skin: 4, shirt: SHIRT.lavender, pants: PANTS.denim, hat: Hat.Beanie, accessory: Accessory.Backpack },
  cook: { outfit: Outfit.Chef, hair: Hair.Short, hairColor: 1, skin: 2, shirt: SHIRT.white, pants: PANTS.black, hat: Hat.Toque, accessory: Accessory.None },
  waiter: { outfit: Outfit.Waiter, hair: Hair.Ponytail, hairColor: 4, skin: 1, shirt: SHIRT.white, pants: PANTS.black, hat: Hat.None, accessory: Accessory.None },
  washer: { outfit: Outfit.Washer, hair: Hair.Spiky, hairColor: 0, skin: 5, shirt: SHIRT.mint, pants: PANTS.olive, hat: Hat.Bandana, accessory: Accessory.None },
} satisfies Record<string, Look>;

const STYLE_TEST: SceneDef = {
  id: 'styleTest',
  width: 360,
  height: 660,
  seed: 1234,
  floorTop: 150,
  props: [
    { kind: K.Neon, x: 292, y: 150, lift: 88 },
    { kind: K.Stove, x: 95, y: 232, active: true },
    { kind: K.Sink, x: 255, y: 232, active: true },
    { kind: K.PlatesDirty, x: 216, y: 233, lift: 19 },
    { kind: K.PlatesClean, x: 296, y: 233, lift: 19 },
    { kind: K.Chair, x: 120, y: 428 },
    { kind: K.Table, x: 120, y: 452, variant: 1 },
    { kind: K.Chair, x: 258, y: 527 },
    { kind: K.Table, x: 258, y: 552, variant: 2 },
    { kind: K.Chair, x: 258, y: 574, variant: 1 },
    { kind: K.Plant, x: 26, y: 300 },
    { kind: K.Plant, x: 338, y: 628, variant: 1 },
  ],
  cast: [
    {
      look: LOOKS.cook, x: 95, y: 207, speed: WALK_SPEED.staff, facing: F.FrontRight,
      routine: [{ do: 'act', pose: Pose.Cook, seconds: 6, held: Held.Spatula, expression: Expression.Happy },
        { do: 'act', pose: Pose.Cook, seconds: 3, held: Held.Spatula, emote: Emote.Star }],
    },
    {
      look: LOOKS.washer, x: 255, y: 207, speed: WALK_SPEED.staff, facing: F.FrontRight,
      routine: [{ do: 'act', pose: Pose.Wash, seconds: 7 }, { do: 'act', pose: Pose.Wash, seconds: 3, emote: Emote.Music }],
    },
    {
      look: LOOKS.waiter, x: 160, y: 258, speed: WALK_SPEED.staff, facing: F.FrontRight,
      routine: [
        { do: 'act', pose: Pose.Idle, seconds: 1.2, held: Held.TrayFull, facing: F.BackLeft },
        { do: 'walk', x: 168, y: 454, held: Held.TrayFull },
        { do: 'act', pose: Pose.Idle, seconds: 1.4, held: Held.TrayFull, facing: F.FrontLeft, emote: Emote.Exclaim },
        { do: 'walk', x: 160, y: 258, held: Held.TrayEmpty },
      ],
    },
    {
      look: LOOKS.tourist, x: 120, y: 435, speed: WALK_SPEED.normal, facing: F.FrontRight,
      routine: [
        { do: 'act', pose: Pose.SitEat, seconds: 4, expression: Expression.Eating },
        { do: 'act', pose: Pose.Sit, seconds: 2.5, expression: Expression.Happy, emote: Emote.Heart },
      ],
    },
    {
      look: LOOKS.rushed, x: 304, y: 372, speed: WALK_SPEED.rushed, facing: F.FrontLeft,
      routine: [
        { do: 'act', pose: Pose.Impatient, seconds: 5, held: Held.Phone, expression: Expression.Neutral, emote: Emote.Clock, patience: true },
        { do: 'act', pose: Pose.Impatient, seconds: 3, held: Held.Phone, expression: Expression.Angry, emote: Emote.Anger, patience: true },
      ],
    },
    {
      look: LOOKS.student, x: 200, y: 720, speed: WALK_SPEED.stroll, facing: F.BackRight,
      routine: [
        { do: 'walk', x: 200, y: 372 },
        { do: 'act', pose: Pose.Phone, seconds: 4, held: Held.Phone, emote: Emote.Music, facing: F.FrontRight },
        { do: 'walk', x: 64, y: 392 },
        { do: 'act', pose: Pose.Idle, seconds: 2.5, emote: Emote.Exclaim, facing: F.FrontRight },
        { do: 'walk', x: 200, y: 720 },
        { do: 'act', pose: Pose.Idle, seconds: 1.5 },
      ],
    },
  ],
  roam: { minX: 30, maxX: 330, minY: 290, maxY: 640 },
};

const idle = (seconds: number, extra: Partial<Extract<RoutineStep, { do: 'act' }>> = {}): RoutineStep => ({
  do: 'act', pose: Pose.Idle, seconds, ...extra,
});

const LINEUP: SceneDef = {
  id: 'lineup',
  width: 260,
  height: 470,
  seed: 99,
  floorTop: 0,
  props: [
    { kind: K.Stove, x: 72, y: 336, active: true, label: 'art.stove' },
    { kind: K.Chair, x: 192, y: 312 },
    { kind: K.Table, x: 192, y: 336, variant: 1, label: 'art.table' },
    { kind: K.Sink, x: 92, y: 440, active: true, label: 'art.sink' },
    { kind: K.PlatesDirty, x: 54, y: 441, lift: 19 },
    { kind: K.PlatesClean, x: 132, y: 441, lift: 19, label: 'art.plates' },
    { kind: K.Plant, x: 220, y: 440 },
  ],
  cast: [
    { look: LOOKS.tourist, x: 45, y: 118, speed: 0, facing: F.FrontRight, label: 'art.tourist',
      routine: [idle(3), idle(2, { emote: Emote.Heart, expression: Expression.Happy })] },
    { look: LOOKS.rushed, x: 130, y: 118, speed: 0, facing: F.FrontRight, label: 'art.rushed',
      routine: [{ do: 'act', pose: Pose.Impatient, seconds: 4, held: Held.Phone, expression: Expression.Angry, emote: Emote.Anger, patience: true }] },
    { look: LOOKS.student, x: 215, y: 118, speed: 0, facing: F.FrontLeft, label: 'art.student',
      routine: [{ do: 'act', pose: Pose.Phone, seconds: 4, held: Held.Phone, emote: Emote.Music }] },
    { look: LOOKS.cook, x: 45, y: 222, speed: 0, facing: F.FrontRight, label: 'art.cook',
      routine: [idle(3, { held: Held.Spatula }), idle(2, { held: Held.Spatula, emote: Emote.Star })] },
    { look: LOOKS.waiter, x: 130, y: 222, speed: 0, facing: F.FrontRight, label: 'art.waiter',
      routine: [idle(4, { held: Held.TrayFull }), idle(2, { held: Held.TrayFull, emote: Emote.Coin })] },
    { look: LOOKS.washer, x: 215, y: 222, speed: 0, facing: F.FrontLeft, label: 'art.washer',
      routine: [idle(3), idle(2, { emote: Emote.Zzz, expression: Expression.Sleepy })] },
  ],
  roam: { minX: 20, maxX: 240, minY: 60, maxY: 460 },
};

export const SCENES = { styleTest: STYLE_TEST, lineup: LINEUP } as const;
export type SceneId = keyof typeof SCENES;
