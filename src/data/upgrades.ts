import { PropKind as K, type PropKind } from '../sim/types';
import { UNLOCK_TIER } from './unlocks';
import { TIERS } from './buildings';
import { Dish } from './dishes';

// The upgrade catalog. Adding an upgrade = adding a row here (plus its strings in i18n).
// Every row is an endless level track, except capacity rows (new tables) that floor space caps.

export type Category = 'menu' | 'kitchen' | 'cleaning' | 'front' | 'decor' | 'marketing' | 'building';
export const CATEGORIES: readonly Category[] = ['menu', 'kitchen', 'cleaning', 'front', 'decor', 'marketing', 'building'];

/**
 * What an upgrade improves. Multiplier stats start at 1 (levels add, milestones multiply);
 * `plates` and `tables` are counts. `price` is per dish.
 */
export type Stat = 'cookSpeed' | 'washSpeed' | 'plates' | 'tables' | 'stoves' | 'seats' | 'family' | 'building' | 'tips' | 'patience' | 'arrivals' | 'quality' | 'price';
export const COUNT_STATS: readonly Stat[] = ['plates', 'tables', 'stoves', 'seats', 'family', 'building'];

export interface Effect {
  stat: Stat;
  /** Per level: +share for multiplier stats (0.08 = +8 %), +amount for counts. */
  per: number;
  /** Only for `price`. */
  dish?: Dish;
}

export interface MilestoneBonus {
  stat: Stat;
  /** Multiplies the stat once per milestone reached. */
  factor: number;
  dish?: Dish;
}

export interface UpgradeDef {
  id: string;
  category: Category;
  /** The thing on the map it belongs to: tapping it opens this upgrade, FX play there. */
  anchor: PropKind;
  /** What changes look at milestones: the anchor itself, the dish on the plates, or nothing. */
  restyle: 'anchor' | 'dish' | null;
  /** Coins for the first level; each level costs `growth` times the previous one. */
  baseCost: number;
  growth: number;
  /** Set prices for the first levels instead of the curve (the curve goes on after the list). */
  costs?: readonly number[];
  effect: Effect;
  milestone: MilestoneBonus | null;
  /** Capacity tracks stop here; endless tracks leave it out. */
  max?: number;
  /** Capacity tracks limited by the free spots of the current building instead (or, for chairs, by the tables). */
  spots?: 'tables' | 'stoves' | 'seats' | 'family';
  /** Level 1 adds this dish to the menu. */
  unlocksDish?: Dish;
  /** Bought by placing it on a free tile in build mode (one level = one more on the floor). */
  build?: boolean;
  /** Gets a bigger model at level 100 (EXPAND). */
  expands?: boolean;
  requires?: { item: string; level: number };
}

/**
 * Milestone levels: the listed ones, then one every `every` levels forever. Each gives a big
 * multiplier and (up to `visualTiers`) a new look for the item.
 */
export const MILESTONES = { levels: [10, 25, 50, 75, 100], every: 50, visualTiers: 5 } as const;

/**
 * Looks by milestone tier: 1-3 new looks, 4 a golden aura, and at 5 (level 100) the stations
 * that `expand` are rebuilt bigger: a chef's range, an industrial dishwasher, a walk-in fridge...
 */
export const EXPAND = { tier: 5, level: MILESTONES.levels[4] } as const;

export const UPGRADES: readonly UpgradeDef[] = [
  // Menu: the money makers. Linear price per level, doubled at every milestone.
  { id: 'fries', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 5, growth: 1.15,
    effect: { stat: 'price', per: 0.3, dish: Dish.Fries }, milestone: { stat: 'price', factor: 2, dish: Dish.Fries } },
  { id: 'burger', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 70, growth: 1.165, unlocksDish: Dish.Burger,
    requires: { item: 'fries', level: 5 },
    effect: { stat: 'price', per: 0.3, dish: Dish.Burger }, milestone: { stat: 'price', factor: 2, dish: Dish.Burger } },
  { id: 'falafel', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 900, growth: 1.17, unlocksDish: Dish.Falafel,
    requires: { item: 'burger', level: 10 },
    effect: { stat: 'price', per: 0.3, dish: Dish.Falafel }, milestone: { stat: 'price', factor: 2, dish: Dish.Falafel } },
  { id: 'shawarma', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 9000, growth: 1.17, unlocksDish: Dish.Shawarma,
    requires: { item: 'falafel', level: 10 },
    effect: { stat: 'price', per: 0.3, dish: Dish.Shawarma }, milestone: { stat: 'price', factor: 2, dish: Dish.Shawarma } },
  { id: 'hummus', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 90000, growth: 1.175, unlocksDish: Dish.Hummus,
    requires: { item: 'building', level: 1 },
    effect: { stat: 'price', per: 0.3, dish: Dish.Hummus }, milestone: { stat: 'price', factor: 2, dish: Dish.Hummus } },
  { id: 'schnitzel', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 900000, growth: 1.175, unlocksDish: Dish.Schnitzel,
    requires: { item: 'hummus', level: 10 },
    effect: { stat: 'price', per: 0.3, dish: Dish.Schnitzel }, milestone: { stat: 'price', factor: 2, dish: Dish.Schnitzel } },
  { id: 'shakshuka', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 9e6, growth: 1.18, unlocksDish: Dish.Shakshuka,
    requires: { item: 'building', level: 2 },
    effect: { stat: 'price', per: 0.3, dish: Dish.Shakshuka }, milestone: { stat: 'price', factor: 2, dish: Dish.Shakshuka } },
  { id: 'iceCream', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 9e7, growth: 1.18, unlocksDish: Dish.IceCream,
    requires: { item: 'shakshuka', level: 10 },
    effect: { stat: 'price', per: 0.3, dish: Dish.IceCream }, milestone: { stat: 'price', factor: 2, dish: Dish.IceCream } },
  // Each opens with its building (src/data/unlocks.ts), at about that building's own price.
  { id: 'pizza', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 9e8, growth: 1.18, unlocksDish: Dish.Pizza,
    requires: { item: 'building', level: UNLOCK_TIER.pizza },
    effect: { stat: 'price', per: 0.3, dish: Dish.Pizza }, milestone: { stat: 'price', factor: 2, dish: Dish.Pizza } },
  { id: 'sushi', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 9e9, growth: 1.185, unlocksDish: Dish.Sushi,
    requires: { item: 'building', level: UNLOCK_TIER.sushi },
    effect: { stat: 'price', per: 0.3, dish: Dish.Sushi }, milestone: { stat: 'price', factor: 2, dish: Dish.Sushi } },
  { id: 'steak', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 2.4e11, growth: 1.185, unlocksDish: Dish.Steak,
    requires: { item: 'building', level: UNLOCK_TIER.steak },
    effect: { stat: 'price', per: 0.3, dish: Dish.Steak }, milestone: { stat: 'price', factor: 2, dish: Dish.Steak } },
  { id: 'cake', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 2e12, growth: 1.19, unlocksDish: Dish.Cake,
    requires: { item: 'building', level: UNLOCK_TIER.cake },
    effect: { stat: 'price', per: 0.3, dish: Dish.Cake }, milestone: { stat: 'price', factor: 2, dish: Dish.Cake } },
  { id: 'lobster', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 2.4e13, growth: 1.19, unlocksDish: Dish.Lobster,
    requires: { item: 'building', level: UNLOCK_TIER.lobster },
    effect: { stat: 'price', per: 0.3, dish: Dish.Lobster }, milestone: { stat: 'price', factor: 2, dish: Dish.Lobster } },

  // Kitchen: speed, and quality (= every dish sells for more).
  // Global multipliers grow slowly on purpose: they stack with every recipe level.
  { id: 'stove', category: 'kitchen', anchor: K.Stove, restyle: 'anchor', baseCost: 12, growth: 1.15, expands: true,
    effect: { stat: 'cookSpeed', per: 0.08 }, milestone: { stat: 'cookSpeed', factor: 1.5 } },
  // Another stove makes room for another cook.
  { id: 'stove2', category: 'kitchen', anchor: K.StoveSlot, restyle: null, baseCost: 350, growth: 20, spots: 'stoves',
    effect: { stat: 'stoves', per: 1 }, milestone: null },
  { id: 'fridge', category: 'kitchen', anchor: K.Fridge, restyle: 'anchor', baseCost: 40, growth: 1.17, expands: true,
    effect: { stat: 'quality', per: 0.04 }, milestone: { stat: 'quality', factor: 1.25 } },

  // Cleaning: the plate loop. More plates also get a better polish (tips) at milestones.
  { id: 'sink', category: 'cleaning', anchor: K.Sink, restyle: 'anchor', baseCost: 15, growth: 1.15, expands: true,
    effect: { stat: 'washSpeed', per: 0.1 }, milestone: { stat: 'washSpeed', factor: 1.5 } },
  { id: 'plates', category: 'cleaning', anchor: K.PlatesClean, restyle: 'anchor', baseCost: 10, growth: 1.2,
    effect: { stat: 'plates', per: 1 }, milestone: { stat: 'tips', factor: 1.1 } },

  // Front of house.
  { id: 'tables', category: 'front', anchor: K.TableSlot, restyle: null, baseCost: 120, growth: 2.6, spots: 'tables',
    effect: { stat: 'tables', per: 1 }, milestone: null },
  // A second chair at the next table: room for a couple (who only come once there is room).
  { id: 'seats', category: 'front', anchor: K.Table, restyle: null, baseCost: 200, growth: 2.3, spots: 'seats',
    effect: { stat: 'seats', per: 1 }, milestone: null },
  // Owner request: "new tables for more people, a different design, say square". From the
  // grand restaurant on, a table for two becomes a square family table for four.
  { id: 'family', category: 'front', anchor: K.Table, restyle: null, baseCost: 2e6, growth: 1.6, spots: 'family',
    requires: { item: 'building', level: UNLOCK_TIER.family }, effect: { stat: 'family', per: 1 }, milestone: null },
  { id: 'cloth', category: 'front', anchor: K.Table, restyle: 'anchor', baseCost: 25, growth: 1.16,
    effect: { stat: 'tips', per: 0.08 }, milestone: { stat: 'tips', factor: 1.25 } },
  { id: 'chairs', category: 'front', anchor: K.Chair, restyle: 'anchor', baseCost: 20, growth: 1.15,
    effect: { stat: 'patience', per: 0.06 }, milestone: { stat: 'tips', factor: 1.1 } },

  // Decor & marketing: more people walk in (until the tables are the limit).
  { id: 'plants', category: 'decor', anchor: K.Plant, restyle: 'anchor', baseCost: 30, growth: 1.16,
    effect: { stat: 'arrivals', per: 0.03 }, milestone: { stat: 'arrivals', factor: 1.1 } },
  { id: 'neon', category: 'decor', anchor: K.Neon, restyle: 'anchor', baseCost: 60, growth: 1.17,
    effect: { stat: 'arrivals', per: 0.05 }, milestone: { stat: 'tips', factor: 1.1 } },
  { id: 'sign', category: 'marketing', anchor: K.StreetSign, restyle: 'anchor', baseCost: 8, growth: 1.15, expands: true,
    effect: { stat: 'arrivals', per: 0.06 }, milestone: { stat: 'arrivals', factor: 1.1 } },

  // Decor placed in build mode: each one placed adds a little, the track lifts them all.
  { id: 'place_flowers', category: 'decor', anchor: K.Flowers, restyle: null, baseCost: 800, growth: 1.9, max: 6, build: true,
    effect: { stat: 'arrivals', per: 0.025 }, milestone: null },
  { id: 'flowers', category: 'decor', anchor: K.Flowers, restyle: 'anchor', baseCost: 400, growth: 1.16, requires: { item: 'place_flowers', level: 1 },
    effect: { stat: 'arrivals', per: 0.02 }, milestone: { stat: 'arrivals', factor: 1.1 } },
  { id: 'place_lamp', category: 'decor', anchor: K.FloorLamp, restyle: null, baseCost: 3000, growth: 2, max: 6, build: true,
    effect: { stat: 'tips', per: 0.04 }, milestone: null },
  { id: 'lamp', category: 'decor', anchor: K.FloorLamp, restyle: 'anchor', baseCost: 1500, growth: 1.17, requires: { item: 'place_lamp', level: 1 },
    effect: { stat: 'tips', per: 0.03 }, milestone: { stat: 'tips', factor: 1.15 } },
  { id: 'place_aquarium', category: 'decor', anchor: K.Aquarium, restyle: null, baseCost: 25000, growth: 2.1, max: 3, build: true,
    requires: { item: 'building', level: 1 }, effect: { stat: 'patience', per: 0.06 }, milestone: null },
  { id: 'aquarium', category: 'decor', anchor: K.Aquarium, restyle: 'anchor', baseCost: 12000, growth: 1.18, requires: { item: 'place_aquarium', level: 1 },
    effect: { stat: 'patience', per: 0.03 }, milestone: { stat: 'tips', factor: 1.1 } },
  { id: 'place_statue', category: 'decor', anchor: K.Statue, restyle: null, baseCost: 250000, growth: 2.2, max: 3, build: true,
    requires: { item: 'building', level: 2 }, effect: { stat: 'quality', per: 0.03 }, milestone: null },
  { id: 'statue', category: 'decor', anchor: K.Statue, restyle: 'anchor', baseCost: 120000, growth: 1.19, requires: { item: 'place_statue', level: 1 },
    effect: { stat: 'quality', per: 0.02 }, milestone: { stat: 'quality', factor: 1.15 } },
  // The palace and the empire bring their own showpieces.
  { id: 'place_fountain', category: 'decor', anchor: K.Fountain, restyle: null, baseCost: 3e9, growth: 2.4, max: 2, build: true,
    requires: { item: 'building', level: 3 }, effect: { stat: 'arrivals', per: 0.08 }, milestone: null },
  { id: 'fountain', category: 'decor', anchor: K.Fountain, restyle: 'anchor', baseCost: 1.5e9, growth: 1.2, requires: { item: 'place_fountain', level: 1 },
    effect: { stat: 'arrivals', per: 0.03 }, milestone: { stat: 'arrivals', factor: 1.1 } },
  { id: 'place_piano', category: 'decor', anchor: K.Piano, restyle: null, baseCost: 1.5e11, growth: 2.4, max: 2, build: true,
    requires: { item: 'building', level: 4 }, effect: { stat: 'tips', per: 0.2 }, milestone: null },
  { id: 'piano', category: 'decor', anchor: K.Piano, restyle: 'anchor', baseCost: 7e10, growth: 1.2, requires: { item: 'place_piano', level: 1 },
    effect: { stat: 'tips', per: 0.05 }, milestone: { stat: 'tips', factor: 1.15 } },

  // The building itself: buy the lot next door (the "for sale" sign) and grow into it.
  // The first four follow the curve; the resort and the galaxy are priced by hand: late in the
  // game income grows more slowly, and at 30x each they came hours apart (balance bot: the
  // resort at 295 min, the galaxy not within 5 hours).
  { id: 'building', category: 'building', anchor: K.SaleSign, restyle: null, baseCost: 3.6e6, growth: 30, max: TIERS.length - 1,
    costs: [3.6e6, 1.08e8, 3.24e9, 9.72e10, 8e11, 9e12, 1.2e14], effect: { stat: 'building', per: 1 }, milestone: null },
  // The restaurant level (owner request): opens the next hundred levels of everything, and every
  // dish sells for a bit more. A crew builds it; it shows up once enough tracks hit the cap.
  { id: 'rank', category: 'building', anchor: K.Neon, restyle: null, baseCost: 2e6, growth: 50,
    effect: { stat: 'quality', per: 0.25 }, milestone: null },
];

/**
 * Restaurant levels: every endless track stops at `levels` x the restaurant level, and the next
 * restaurant level can be built once `ready` tracks have reached that cap.
 */
export const RANK = { id: 'rank', levels: 100, ready: 5 } as const;

export const UPGRADE_BY_ID: Readonly<Record<string, UpgradeDef>> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
