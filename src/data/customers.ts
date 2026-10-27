import { Dish } from './dishes';
import { Accessory, Hair, Hat, Outfit, PANTS, SHIRT, type Look } from './looks';

// Customer personalities. Each type changes look, walk speed, patience, tips and what it orders.

export type CustomerTypeId =
  | 'regular' | 'rushed' | 'tourist' | 'student' | 'relaxed'
  | 'grandma' | 'athlete' | 'builder' | 'business' | 'foodie' | 'musician' | 'party' | 'influencer' | 'tycoon';

/** How long someone will wait, at a glance: shown as an icon next to their patience bar. */
export type PatienceKind = 'quick' | 'normal' | 'patient';
export const PATIENCE_ICON: Record<PatienceKind, number> = { normal: 0, quick: 1, patient: 2 };

export interface CustomerType {
  id: CustomerTypeId;
  /** Relative spawn weight. */
  weight: number;
  /** Tiles per second. */
  walkSpeed: number;
  /** Seconds they will wait in line to be seated. */
  queuePatience: number;
  /** Seconds they will wait for food once they ordered. */
  foodPatience: number;
  /** Tip as a share of the price, before mood and combo. */
  tipRate: number;
  /** Extra share of the price paid when served within `fastShare` of their food patience. */
  fastBonus: number;
  fastShare: number;
  order: 'any' | 'priciest' | 'cheapest';
  patience: PatienceKind;
  /** Comes with a friend now and then (once there are tables for two). */
  pairs: boolean;
  /** Only shows up once word has got around: after this many customers were served. */
  minServed?: number;
  /** ...and only from this building on (0 = the first stand). */
  minTier?: number;
  /** Only in the evening (from this share of the day on). */
  evening?: number;
  /** Orders one of these when one is on the menu (else anything). */
  favorites?: readonly Dish[];
  /** Eats this many times faster (1 = the usual). */
  eatSpeed?: number;
  /** Writes a review this often when they pay (instead of the usual chance). */
  reviewChance?: number;
  /** Added to the chance of a drink with the meal. */
  drinkBonus?: number;
  /** Plays while eating: everyone waiting loses patience this much slower (1 = no music). */
  music?: number;
  /** A five-star visit: posts about it, and more guests come for this many seconds. */
  buzzSeconds?: number;
  /** Fixed look parts; anything not set here is randomized. */
  look: Partial<Look>;
}

export const CUSTOMER_TYPES: Record<CustomerTypeId, CustomerType> = {
  regular: {
    id: 'regular', weight: 50, walkSpeed: 1.3, queuePatience: 26, foodPatience: 32,
    tipRate: 0.15, fastBonus: 0, fastShare: 0, order: 'any', patience: 'normal', pairs: true, look: {},
  },
  rushed: {
    id: 'rushed', weight: 18, walkSpeed: 1.8, queuePatience: 14, foodPatience: 18,
    tipRate: 0.1, fastBonus: 0.35, fastShare: 0.4, order: 'any', patience: 'quick', pairs: false,
    look: { outfit: Outfit.Suit, hat: Hat.None, accessory: Accessory.Glasses },
  },
  tourist: {
    id: 'tourist', weight: 14, walkSpeed: 1.05, queuePatience: 30, foodPatience: 36,
    tipRate: 0.22, fastBonus: 0, fastShare: 0, order: 'priciest', patience: 'normal', pairs: true,
    look: { outfit: Outfit.Hawaiian, hat: Hat.SunHat, accessory: Accessory.Camera },
  },
  student: {
    id: 'student', weight: 18, walkSpeed: 1.45, queuePatience: 24, foodPatience: 30,
    tipRate: 0.05, fastBonus: 0, fastShare: 0, order: 'cheapest', patience: 'normal', pairs: true,
    look: { outfit: Outfit.Hoodie, accessory: Accessory.Backpack },
  },
  // Takes their time and does not mind waiting; walks slowly, tips fairly.
  relaxed: {
    id: 'relaxed', weight: 12, walkSpeed: 0.95, queuePatience: 46, foodPatience: 54,
    tipRate: 0.12, fastBonus: 0, fastShare: 0, order: 'any', patience: 'patient', pairs: true, minServed: 40,
    look: { outfit: Outfit.Tee, hat: Hat.Beanie, accessory: Accessory.Glasses },
  },
  // Owner M52: "add more customers". Each has a look of their own and something that changes
  // the game a little; they turn up as the place gets known (and the grander ones later).
  // Grandma: all the time in the world, tips well, likes simple food; the grandchildren come along.
  grandma: {
    id: 'grandma', weight: 8, walkSpeed: 0.8, queuePatience: 55, foodPatience: 62,
    tipRate: 0.2, fastBonus: 0, fastShare: 0, order: 'cheapest', patience: 'patient', pairs: true, minServed: 20,
    look: { outfit: Outfit.Cardigan, hair: Hair.Bun, hairColor: 5, accessory: Accessory.Cane, hat: Hat.None, shirt: SHIRT.lavender },
  },
  // The athlete: in a hurry, eats light (salad, sushi, eggs), tips for a quick plate.
  athlete: {
    id: 'athlete', weight: 9, walkSpeed: 2, queuePatience: 16, foodPatience: 22,
    tipRate: 0.08, fastBonus: 0.3, fastShare: 0.45, order: 'any', patience: 'quick', pairs: false, minServed: 10,
    favorites: [Dish.Salad, Dish.Sushi, Dish.Shakshuka],
    look: { outfit: Outfit.Tracksuit, hat: Hat.Headband, accessory: Accessory.Headphones, shirt: SHIRT.blue, hair: Hair.Ponytail },
  },
  // The builder from the site down the road: hungry for meat, eats fast, comes with a mate.
  builder: {
    id: 'builder', weight: 8, walkSpeed: 1.35, queuePatience: 22, foodPatience: 26,
    tipRate: 0.07, fastBonus: 0, fastShare: 0, order: 'any', patience: 'normal', pairs: true, minServed: 30, eatSpeed: 1.6,
    favorites: [Dish.Burger, Dish.Shawarma, Dish.Schnitzel, Dish.Steak],
    look: { outfit: Outfit.HiVis, hat: Hat.HardHat, accessory: Accessory.None, shirt: SHIRT.white, pants: PANTS.denim },
  },
  // A business lunch: the priciest dish, quickly please, a big tip for a fast plate.
  business: {
    id: 'business', weight: 8, walkSpeed: 1.7, queuePatience: 15, foodPatience: 20,
    tipRate: 0.18, fastBonus: 0.4, fastShare: 0.4, order: 'priciest', patience: 'quick', pairs: true, minServed: 50,
    look: { outfit: Outfit.Suit, hair: Hair.Bun, accessory: Accessory.Briefcase, hat: Hat.None, shirt: SHIRT.charcoal, pants: PANTS.black },
  },
  // The food blogger: the priciest dish, and nearly always writes about it.
  foodie: {
    id: 'foodie', weight: 5, walkSpeed: 1.2, queuePatience: 28, foodPatience: 34,
    tipRate: 0.16, fastBonus: 0, fastShare: 0, order: 'priciest', patience: 'normal', pairs: false, minServed: 60, reviewChance: 0.9,
    look: { outfit: Outfit.Tee, hat: Hat.Beret, accessory: Accessory.Camera, shirt: SHIRT.mustard },
  },
  // The street musician: patient, and plays while eating: the whole room waits more calmly.
  musician: {
    id: 'musician', weight: 5, walkSpeed: 1, queuePatience: 40, foodPatience: 46,
    tipRate: 0.1, fastBonus: 0, fastShare: 0, order: 'any', patience: 'patient', pairs: false, minServed: 80, music: 0.85,
    look: { outfit: Outfit.Hoodie, hat: Hat.Beanie, accessory: Accessory.Guitar, shirt: SHIRT.teal, hair: Hair.Curly },
  },
  // Out for the night: evenings only, in groups, and there is always a drink.
  party: {
    id: 'party', weight: 9, walkSpeed: 1.4, queuePatience: 24, foodPatience: 30,
    tipRate: 0.16, fastBonus: 0, fastShare: 0, order: 'any', patience: 'normal', pairs: true, minServed: 100, evening: 0.55, drinkBonus: 0.45,
    look: { outfit: Outfit.Hawaiian, hat: Hat.PartyHat, accessory: Accessory.Sunglasses, shirt: SHIRT.pink },
  },
  // The influencer: impatient, tips little, but a five-star visit goes out to every follower.
  influencer: {
    id: 'influencer', weight: 3, walkSpeed: 1.5, queuePatience: 14, foodPatience: 20,
    tipRate: 0.05, fastBonus: 0, fastShare: 0, order: 'priciest', patience: 'quick', pairs: false, minServed: 120, buzzSeconds: 25,
    look: { outfit: Outfit.Sequin, hair: Hair.Ponytail, hairColor: 7, accessory: Accessory.Sunglasses, hat: Hat.None, shirt: SHIRT.pink },
  },
  // The tycoon: rare, only in the grand restaurants, the priciest dish and a huge tip.
  tycoon: {
    id: 'tycoon', weight: 2, walkSpeed: 1.1, queuePatience: 30, foodPatience: 36,
    tipRate: 0.6, fastBonus: 0, fastShare: 0, order: 'priciest', patience: 'normal', pairs: false, minServed: 150, minTier: 2,
    look: { outfit: Outfit.Suit, hat: Hat.TopHat, accessory: Accessory.Monocle, shirt: SHIRT.navy, pants: PANTS.black, hair: Hair.Short },
  },
};

export const PARTY = {
  /** Chance that a newcomer brings a friend, times the share of tables with two chairs. */
  pairChance: 0.4,
  /** Where the others stand around them in line (tiles): the friend first. */
  queueOffsets: [
    { x: 0.3, y: 0.42 }, { x: -0.32, y: 0.38 }, { x: 0.02, y: 0.66 }, { x: 0.36, y: 0.86 }, { x: -0.3, y: 0.9 },
    // A party for a joined table (up to ten).
    { x: 0.04, y: 1.12 }, { x: 0.4, y: 1.3 }, { x: -0.34, y: 1.34 }, { x: 0.06, y: 1.56 },
  ] as readonly { x: number; y: number }[],
  /** Where they show up next to the leader. */
  spawnOffsets: [
    { x: -0.4, y: 0.3 }, { x: 0.35, y: 0.32 }, { x: -0.1, y: 0.62 }, { x: 0.3, y: 0.8 }, { x: -0.42, y: 0.86 },
    { x: 0.02, y: 1.1 }, { x: 0.42, y: 1.24 }, { x: -0.36, y: 1.3 }, { x: 0.08, y: 1.5 },
  ] as readonly { x: number; y: number }[],
  /** Of the pairs, the share that are families of 3-4, times the family tables per table for two. */
  familyChance: 0.7,
  /** A family's third and fourth: this often a child. */
  familyKidChance: 0.75,
  /** Of the families, the share that are big groups of 5-6, times the tables for six per family table. */
  bigChance: 0.45,
  /** Of the pairs, the share that are parties of 7-10, per table joined for eight or ten (at most `banquetMax`). */
  banquetChance: 0.05,
  banquetMax: 0.3,
  /** Chance that the friend is a child (families: not with students), drawn smaller. Just the look. */
  kidChance: 0.3,
  kidTypes: ['regular', 'tourist', 'relaxed', 'grandma'] as readonly CustomerTypeId[],
};

/** The `rank` a child carries in the render snapshot (staff use 1-2, a VIP 3). */
export const KID_RANK = 4;

export const CUSTOMER_TYPE_LIST: readonly CustomerType[] = Object.values(CUSTOMER_TYPES);

/** Body language only (no effect on the game): when waiting guests look impatient or reach for a phone. */
export const ANIM = {
  /** Below this share of patience, someone in line taps a foot. */
  impatientBelow: 0.4,
  /** Seconds into the wait for food before a phone comes out. */
  phoneAfter: 2.5,
};
