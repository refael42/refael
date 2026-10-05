import type { Look } from './looks';
import { Accessory, Hair, Hat, Outfit, PANTS, SHIRT } from './looks';
import type { Area } from './maps';
import type { Facing, PropKind, RoutineStep } from '../sim/types';
import { Emote, Expression, Facing as F, Held, Pose, PropKind as K } from '../sim/types';

// The "Cast" view: every character type and key prop side by side, for art review.
// Positions are floor tiles (isometric), like the game map.

export interface CastMember {
  look: Look;
  x: number;
  y: number;
  facing: Facing;
  routine: RoutineStep[];
  /** i18n key shown under the character. */
  label?: string;
}

export interface PropPlacement {
  kind: PropKind;
  x: number;
  y: number;
  variant?: number;
  active?: boolean;
  /** Height above the floor (px), e.g. plates standing on a counter. */
  lift?: number;
  label?: string;
}

export interface SceneDef {
  id: 'lineup';
  width: number;
  height: number;
  seed: number;
  areas: Area[];
  props: PropPlacement[];
  cast: CastMember[];
}

export const LOOKS = {
  tourist: { outfit: Outfit.Hawaiian, hair: Hair.Short, hairColor: 3, skin: 0, shirt: SHIRT.teal, pants: PANTS.khaki, hat: Hat.SunHat, accessory: Accessory.Camera },
  rushed: { outfit: Outfit.Suit, hair: Hair.Bob, hairColor: 0, skin: 3, shirt: SHIRT.navy, pants: PANTS.black, hat: Hat.None, accessory: Accessory.Glasses },
  student: { outfit: Outfit.Hoodie, hair: Hair.Curly, hairColor: 1, skin: 4, shirt: SHIRT.lavender, pants: PANTS.denim, hat: Hat.Beanie, accessory: Accessory.Backpack },
  cook: { outfit: Outfit.Chef, hair: Hair.Short, hairColor: 1, skin: 2, shirt: SHIRT.white, pants: PANTS.black, hat: Hat.Toque, accessory: Accessory.None },
  waiter: { outfit: Outfit.Waiter, hair: Hair.Ponytail, hairColor: 4, skin: 1, shirt: SHIRT.white, pants: PANTS.black, hat: Hat.None, accessory: Accessory.None },
  washer: { outfit: Outfit.Washer, hair: Hair.Spiky, hairColor: 0, skin: 5, shirt: SHIRT.mint, pants: PANTS.olive, hat: Hat.Bandana, accessory: Accessory.None },
} satisfies Record<string, Look>;

const idle = (seconds: number, extra: Partial<Extract<RoutineStep, { do: 'act' }>> = {}): RoutineStep => ({
  do: 'act', pose: Pose.Idle, seconds, ...extra,
});

/** Lined up along the screen-horizontal diagonal (x + y constant = same screen height). */
const castAt = (i: number) => ({ x: 3 + i * 1.1, y: 7 - i * 1.1 });
const propAt = (i: number) => ({ x: 6.2 + i * 1.3, y: 9.8 - i * 1.3 });

export const LINEUP: SceneDef = {
  id: 'lineup',
  width: 14,
  height: 12,
  seed: 99,
  areas: [
    { x0: 0, y0: 0, x1: 14, y1: 12, floor: 'grass', walkable: false },
    { x0: 1, y0: 0, x1: 13, y1: 11, floor: 'dining', walkable: true },
  ],
  props: [
    { kind: K.Stove, ...propAt(0), active: true, label: 'art.stove' },
    { kind: K.Pass, ...propAt(1), label: 'art.pass' },
    { kind: K.Sink, ...propAt(2), active: true, label: 'art.sink' },
    { kind: K.PlatesDirty, x: propAt(2).x, y: propAt(2).y - 0.5, lift: 22, variant: 3 },
    { kind: K.PlatesClean, x: propAt(2).x, y: propAt(2).y + 0.5, lift: 22, variant: 6 },
    { kind: K.Chair, x: propAt(3).x - 0.62, y: propAt(3).y },
    { kind: K.Table, ...propAt(3), variant: 1, label: 'art.table' },
    { kind: K.Fridge, ...propAt(4), label: 'art.fridge' },
    { kind: K.Plant, ...propAt(5), label: 'art.plant' },
  ],
  cast: [
    { look: LOOKS.tourist, ...castAt(0), facing: F.FrontRight, label: 'art.tourist',
      routine: [idle(3), idle(2, { emote: Emote.Heart, expression: Expression.Happy })] },
    { look: LOOKS.rushed, ...castAt(1), facing: F.FrontLeft, label: 'art.rushed',
      routine: [{ do: 'act', pose: Pose.Impatient, seconds: 4, held: Held.Phone, expression: Expression.Angry, emote: Emote.Anger, patience: true }] },
    { look: LOOKS.student, ...castAt(2), facing: F.FrontRight, label: 'art.student',
      routine: [{ do: 'act', pose: Pose.Phone, seconds: 4, held: Held.Phone, emote: Emote.Music }] },
    { look: LOOKS.cook, ...castAt(3), facing: F.FrontLeft, label: 'art.cook',
      routine: [idle(3, { held: Held.Spatula }), idle(2, { held: Held.Spatula, emote: Emote.Star })] },
    { look: LOOKS.waiter, ...castAt(4), facing: F.FrontRight, label: 'art.waiter',
      routine: [idle(4, { held: Held.TrayFull }), idle(2, { held: Held.TrayFull, emote: Emote.Coin })] },
    { look: LOOKS.washer, ...castAt(5), facing: F.FrontLeft, label: 'art.washer',
      routine: [idle(3), idle(2, { emote: Emote.Zzz, expression: Expression.Sleepy })] },
  ],
};
