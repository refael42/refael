import { Accessory, Hat, Outfit, type Look } from './looks';

// Customer personalities. Each type changes look, walk speed, patience, tips and what it orders.

export type CustomerTypeId = 'regular' | 'rushed' | 'tourist' | 'student' | 'relaxed';

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
};

export const PARTY = {
  /** Chance that a newcomer brings a friend, times the share of tables with two chairs. */
  pairChance: 0.4,
  /** Where the friend stands next to them in line (tiles). */
  queueOffset: { x: 0.3, y: 0.42 },
  /** Chance that the friend is a child (families: not with students), drawn smaller. Just the look. */
  kidChance: 0.3,
  kidTypes: ['regular', 'tourist', 'relaxed'] as readonly CustomerTypeId[],
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
