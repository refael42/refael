import { Accessory, Hat, Outfit, type Look } from './looks';

// Customer personalities. Each type changes look, walk speed, patience, tips and what it orders.

export type CustomerTypeId = 'regular' | 'rushed' | 'tourist' | 'student';

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
  /** Fixed look parts; anything not set here is randomized. */
  look: Partial<Look>;
}

export const CUSTOMER_TYPES: Record<CustomerTypeId, CustomerType> = {
  regular: {
    id: 'regular', weight: 50, walkSpeed: 1.3, queuePatience: 26, foodPatience: 32,
    tipRate: 0.15, fastBonus: 0, fastShare: 0, order: 'any', look: {},
  },
  rushed: {
    id: 'rushed', weight: 18, walkSpeed: 1.8, queuePatience: 14, foodPatience: 18,
    tipRate: 0.1, fastBonus: 0.35, fastShare: 0.4, order: 'any',
    look: { outfit: Outfit.Suit, hat: Hat.None, accessory: Accessory.Glasses },
  },
  tourist: {
    id: 'tourist', weight: 14, walkSpeed: 1.05, queuePatience: 30, foodPatience: 36,
    tipRate: 0.22, fastBonus: 0, fastShare: 0, order: 'priciest',
    look: { outfit: Outfit.Hawaiian, hat: Hat.SunHat, accessory: Accessory.Camera },
  },
  student: {
    id: 'student', weight: 18, walkSpeed: 1.45, queuePatience: 24, foodPatience: 30,
    tipRate: 0.05, fastBonus: 0, fastShare: 0, order: 'cheapest',
    look: { outfit: Outfit.Hoodie, accessory: Accessory.Backpack },
  },
};

export const CUSTOMER_TYPE_LIST: readonly CustomerType[] = Object.values(CUSTOMER_TYPES);
