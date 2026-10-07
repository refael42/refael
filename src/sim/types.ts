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
  /** A bartender shaking a cocktail (the shaker up by the shoulder), or pouring a plain drink. */
  Shake: 9,
  Pour: 10,
  /** A bar guest sipping their drink. */
  Sip: 11,
} as const;
export type Pose = (typeof Pose)[keyof typeof Pose];

/** 3/4 view facings. Left variants are the right ones mirrored by the renderer. */
export const Facing = { FrontRight: 0, FrontLeft: 1, BackRight: 2, BackLeft: 3 } as const;
export type Facing = (typeof Facing)[keyof typeof Facing];

export const Held = { None: 0, TrayFull: 1, TrayEmpty: 2, Phone: 3, Spatula: 4, Menu: 5, DirtyPlates: 6, Clipboard: 7, Flyers: 8, Bag: 9, FoodBox: 10, FoodDrink: 11, Shaker: 12, DrinkTray: 13, Glass: 14 } as const;
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
  /** Decor placed in build mode. */
  Flowers: 19,
  FloorLamp: 20,
  Aquarium: 21,
  Statue: 22,
  Fountain: 23,
  Piano: 24,
  /** A big upgrade in progress: a barrier by the station (variant 1: a crate where a showpiece goes). */
  WorkSite: 25,
  /** A present on the sidewalk (tap it). */
  Gift: 26,
  /** Land of a later building, fenced off: a padlock sign (variant = that building's tier). */
  LockSign: 27,
  /** The tourist bus on the road (src/data/events.ts). */
  Bus: 28,
  /** A festival trophy; variant = its theme. */
  Trophy: 29,
  /** Weekend flags along the front of the building; variant = the color order. */
  Bunting: 30,
  /** A courier's scooter by the curb; variant = its slot (color), active = out on a ride. */
  Scooter: 31,
  /** Across the street (the park): a bench (variant: facing), a flower planter, a parked car
   * (variant: color), a market stall (variant: awning), the plaza fountain, a slide. */
  Bench: 32,
  Planter: 33,
  Car: 34,
  Stall: 35,
  ParkFountain: 36,
  Slide: 37,
  /** The packing counter with the takeaway window; level = bags on the shelf, active = someone packing. */
  PackTable: 38,
  /** The deliveries' own pass (along x, two tiles) and their drinks fridge (active = door open). */
  DeliveryPass: 39,
  DrinksFridge: 40,
  /** A booth's sofa (owner: "a variety of tables"): 0 = the first side's (its back toward -x), 1 = the seat opposite, 2 = that one's back (drawn in front of who sits there). */
  Booth: 41,
  /** The back half of a long table (two tiles deep): a piece of its own so the chairs along it sort right. */
  TableBack: 42,
  /** A piece of the bar counter (variant: 0 along y, 1 the back side, 2 the back corner, 3 the front corner, 4 the front side; +10 where ready drinks wait). */
  BarCounter: 43,
  /** A bar stool (variant: the way its sitter faces). */
  BarStool: 44,
  /** A drink: on the bar's pass (active), or on the counter in front of a bar guest. variant = which drink. */
  Drink: 45,
} as const;
export type PropKind = (typeof PropKind)[keyof typeof PropKind];

export const EntityType = { Character: 1, Prop: 2 } as const;

/**
 * Persistent icon bubbles (not timed like emotes): what a customer wants, or what a prop needs.
 * Dish bubbles are `DishBase + dish id`.
 */
export const Bubble = { None: 0, Seat: 1, Clean: 2, NoPlates: 3, Cv: 4, Raise: 5, DishBase: 10, DrinkBase: 40 } as const;

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
  /** Icon next to the patience bar: 0 clock, 1 in a hurry, 2 takes their time. */
  patienceKind?: number;
  /** Sitting up on a bar stool: drawn this many px higher. */
  lift?: number;
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
  /** A table's design (src/data/tables.ts, by index). */
  style?: number;
  /** A table: each chair's drink (+1, 0 = none) in base 8. */
  extra?: number;
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
