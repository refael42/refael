import type { Look } from '../data/looks';
import type { Rng } from './rng';

// Numeric enums (const objects) so states pack straight into the render snapshot's number array.

export const Pose = {
  Idle: 0,
  Walk: 1,
  Sit: 2,
  SitEat: 3,
  Cook: 4,
  Wash: 5,
  Impatient: 6,
  Phone: 7,
  Cheer: 8,
} as const;
export type Pose = (typeof Pose)[keyof typeof Pose];

/** 3/4 view facings. Left variants are the right ones mirrored by the renderer. */
export const Facing = { FrontRight: 0, FrontLeft: 1, BackRight: 2, BackLeft: 3 } as const;
export type Facing = (typeof Facing)[keyof typeof Facing];

export const Held = { None: 0, TrayFull: 1, TrayEmpty: 2, Phone: 3, Spatula: 4, Menu: 5, DirtyPlates: 6 } as const;
export type Held = (typeof Held)[keyof typeof Held];

export const Emote = {
  None: 0,
  Heart: 1,
  Anger: 2,
  Clock: 3,
  Coin: 4,
  Star: 5,
  Exclaim: 6,
  Zzz: 7,
  Music: 8,
} as const;
export type Emote = (typeof Emote)[keyof typeof Emote];

export const Expression = { Happy: 0, Neutral: 1, Angry: 2, Sleepy: 3, Eating: 4 } as const;
export type Expression = (typeof Expression)[keyof typeof Expression];

export const PropKind = {
  Stove: 0,
  Sink: 1,
  Table: 2,
  Chair: 3,
  PlatesClean: 4,
  PlatesDirty: 5,
  Plant: 6,
  Neon: 7,
  Pass: 8,
  PassDish: 9,
  Fridge: 10,
  Tree: 11,
  Lamp: 12,
  SaleSign: 13,
  Ticket: 14,
  /** Ghost of the next table you can buy (floor space for expansion). */
  TableSlot: 15,
  /** Sign on the sidewalk by the door (marketing). */
  StreetSign: 16,
  /** Ghost of the next stove you can buy (a second cook needs a second stove). */
  StoveSlot: 17,
  /** Building work on the lot next door (variant 0 runs along x, 1 along y). */
  Scaffold: 18,
} as const;
export type PropKind = (typeof PropKind)[keyof typeof PropKind];

export const EntityType = { Character: 1, Prop: 2 } as const;

/**
 * Persistent icon bubbles (not timed like emotes): what a customer wants, or what a prop needs.
 * Dish bubbles are `DishBase + dish id`.
 */
export const Bubble = { None: 0, Seat: 1, Clean: 2, NoPlates: 3, Cv: 4, Raise: 5, DishBase: 10 } as const;

/** What the renderer needs to draw a character, whatever system drives it. */
export interface CharacterView {
  id: number;
  look: Look;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  facing: Facing;
  pose: Pose;
  poseTime: number;
  held: Held;
  expression: Expression;
  emote: Emote;
  emoteTime: number;
  /** 0..1 shown as a bar over the head; -1 hides it. */
  patience: number;
  bubble: number;
  /** Staff uniform rank (0 none, 1 silver badge, 2 gold badge). */
  rank?: number;
}

/** What the renderer needs to draw a prop. */
export interface PropView {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  variant: number;
  level: number;
  active: boolean;
  /** Height above the floor (e.g. plates on a counter); drawing offset only, sorting uses y. */
  lift: number;
  /** Sim time of the last state change, for pop-in animations. */
  since: number;
  /** 0..1 progress ring (e.g. cleaning); 0 hides it. */
  progress: number;
  bubble: number;
  /** Added to the depth-sort key: things on counters draw after them, wall decor before all. */
  depthBias: number;
}

/** A scripted step; ambient characters loop through a list of these. */
export type RoutineStep =
  | { do: 'walk'; x: number; y: number; held?: Held }
  | {
      do: 'act';
      pose: Pose;
      seconds: number;
      held?: Held;
      emote?: Emote;
      expression?: Expression;
      facing?: Facing;
      /** 0..1 shown as a bar over the head, draining while this step runs. */
      patience?: boolean;
    };

export interface Character extends CharacterView {
  routine: RoutineStep[];
  step: number;
  stepTime: number;
}

export interface World {
  tick: number;
  time: number;
  rng: Rng;
  nextId: number;
  characters: Character[];
  props: PropView[];
}
