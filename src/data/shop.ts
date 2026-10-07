import type { Role } from './staff';
import type { TraitId } from './traits';

// The item shop (owner request: pay-to-win). Gems are the premium currency: a few come from
// quests (every restaurant level-up), the rest from gem packs. Packs are a DEMO here: the
// "purchase" just adds the gems, no money changes hands (a real store needs store accounts and
// a native payment library, which the owner has not set up). Prices are shown for the look.

export const GEMS = {
  /** What a new restaurant (or an older save) starts with. */
  start: 20,
  /** Every restaurant level-up. */
  perLevelUp: 10,
} as const;

export type ShopItem =
  /** Gems for (pretend) money; `price` is only displayed. */
  | { id: string; kind: 'gems'; gems: number; price: string; tag?: 'popular' | 'best' }
  /** All income x`mult` for a while. */
  | { id: string; kind: 'boost'; cost: number; mult: number; minutes: number }
  /** That much time of income, right now. */
  | { id: string; kind: 'warp'; cost: number; hours: number }
  /** A top worker who joins at once. */
  | { id: string; kind: 'star'; cost: number; role: Role }
  /** A permanent multiplier on one stat (one of each). */
  | { id: string; kind: 'perk'; cost: number; stat: PerkStat; mult: number }
  /** One more crew for big upgrades, for good (src/data/works.ts). */
  | { id: string; kind: 'crew'; cost: number };

export type PerkStat = 'price' | 'arrivals' | 'cookSpeed' | 'tips';

export const SHOP: readonly ShopItem[] = [
  { id: 'gems80', kind: 'gems', gems: 80, price: '₪4.90' },
  { id: 'gems500', kind: 'gems', gems: 500, price: '₪19.90', tag: 'popular' },
  { id: 'gems1200', kind: 'gems', gems: 1200, price: '₪39.90' },
  { id: 'gems3000', kind: 'gems', gems: 3000, price: '₪79.90', tag: 'best' },

  { id: 'boost2', kind: 'boost', cost: 60, mult: 2, minutes: 30 },
  { id: 'boost5', kind: 'boost', cost: 150, mult: 5, minutes: 10 },
  { id: 'warp1', kind: 'warp', cost: 80, hours: 1 },
  { id: 'warp4', kind: 'warp', cost: 250, hours: 4 },

  { id: 'starCook', kind: 'star', cost: 200, role: 'cook' },
  { id: 'starWaiter', kind: 'star', cost: 150, role: 'waiter' },
  { id: 'starWasher', kind: 'star', cost: 120, role: 'washer' },
  { id: 'starHost', kind: 'star', cost: 150, role: 'host' },
  { id: 'starCleaner', kind: 'star', cost: 120, role: 'cleaner' },
  { id: 'starManager', kind: 'star', cost: 300, role: 'manager' },
  { id: 'starCourier', kind: 'star', cost: 150, role: 'courier' },

  { id: 'goldenMenu', kind: 'perk', cost: 600, stat: 'price', mult: 1.5 },
  { id: 'vipSign', kind: 'perk', cost: 400, stat: 'arrivals', mult: 1.25 },
  { id: 'turboKitchen', kind: 'perk', cost: 400, stat: 'cookSpeed', mult: 1.5 },
  { id: 'charmSchool', kind: 'perk', cost: 300, stat: 'tips', mult: 2 },
  { id: 'crew3', kind: 'crew', cost: 250 },
  { id: 'crew4', kind: 'crew', cost: 600 },
];

export const SHOP_BY_ID: Readonly<Record<string, ShopItem>> = Object.fromEntries(SHOP.map((i) => [i.id, i]));

/** Star workers: a high level, top skills in the job's main stats, two good traits. */
export const STAR = {
  /** Star workers are legendary (src/data/rarity.ts). */
  rarity: 'legendary' as const,
  level: 6,
  mainStat: 10,
  otherStat: 8,
  traits: ['charmer', 'workaholic'] as readonly TraitId[],
} as const;

/** Time warps pay at least this per second (a brand-new stand earns almost nothing yet). */
export const WARP_MIN_PER_SECOND = 1;
