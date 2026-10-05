import { PropKind as K, type PropKind } from '../sim/types';
import { Dish } from './dishes';

// The upgrade catalog. Adding an upgrade = adding a row here (plus its strings in i18n).
// Every row is an endless level track, except capacity rows (new tables) that floor space caps.

export type Category = 'menu' | 'kitchen' | 'cleaning' | 'front' | 'decor' | 'marketing';
export const CATEGORIES: readonly Category[] = ['menu', 'kitchen', 'cleaning', 'front', 'decor', 'marketing'];

/**
 * What an upgrade improves. Multiplier stats start at 1 (levels add, milestones multiply);
 * `plates` and `tables` are counts. `price` is per dish.
 */
export type Stat = 'cookSpeed' | 'washSpeed' | 'plates' | 'tables' | 'tips' | 'patience' | 'arrivals' | 'quality' | 'price';
export const COUNT_STATS: readonly Stat[] = ['plates', 'tables'];

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
  effect: Effect;
  milestone: MilestoneBonus | null;
  /** Capacity tracks stop here; endless tracks leave it out. */
  max?: number;
  /** Level 1 adds this dish to the menu. */
  unlocksDish?: Dish;
  requires?: { item: string; level: number };
}

/**
 * Milestone levels: the listed ones, then one every `every` levels forever. Each gives a big
 * multiplier and (up to `visualTiers`) a new look for the item.
 */
export const MILESTONES = { levels: [10, 25, 50, 75, 100], every: 50, visualTiers: 4 } as const;

export const UPGRADES: readonly UpgradeDef[] = [
  // Menu: the money makers. Linear price per level, doubled at every milestone.
  { id: 'fries', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 5, growth: 1.13,
    effect: { stat: 'price', per: 0.3, dish: Dish.Fries }, milestone: { stat: 'price', factor: 2, dish: Dish.Fries } },
  { id: 'burger', category: 'menu', anchor: K.Pass, restyle: 'dish', baseCost: 70, growth: 1.14, unlocksDish: Dish.Burger,
    requires: { item: 'fries', level: 5 },
    effect: { stat: 'price', per: 0.3, dish: Dish.Burger }, milestone: { stat: 'price', factor: 2, dish: Dish.Burger } },

  // Kitchen: speed, and quality (= every dish sells for more).
  // Global multipliers grow slowly on purpose: they stack with every recipe level.
  { id: 'stove', category: 'kitchen', anchor: K.Stove, restyle: 'anchor', baseCost: 12, growth: 1.15,
    effect: { stat: 'cookSpeed', per: 0.08 }, milestone: { stat: 'cookSpeed', factor: 1.5 } },
  { id: 'fridge', category: 'kitchen', anchor: K.Fridge, restyle: 'anchor', baseCost: 40, growth: 1.17,
    effect: { stat: 'quality', per: 0.04 }, milestone: { stat: 'quality', factor: 1.25 } },

  // Cleaning: the plate loop. More plates also get a better polish (tips) at milestones.
  { id: 'sink', category: 'cleaning', anchor: K.Sink, restyle: 'anchor', baseCost: 15, growth: 1.15,
    effect: { stat: 'washSpeed', per: 0.1 }, milestone: { stat: 'washSpeed', factor: 1.5 } },
  { id: 'plates', category: 'cleaning', anchor: K.PlatesClean, restyle: 'anchor', baseCost: 10, growth: 1.2,
    effect: { stat: 'plates', per: 1 }, milestone: { stat: 'tips', factor: 1.1 } },

  // Front of house.
  { id: 'tables', category: 'front', anchor: K.TableSlot, restyle: null, baseCost: 120, growth: 2.6, max: 4,
    effect: { stat: 'tables', per: 1 }, milestone: null },
  { id: 'cloth', category: 'front', anchor: K.Table, restyle: 'anchor', baseCost: 25, growth: 1.16,
    effect: { stat: 'tips', per: 0.08 }, milestone: { stat: 'tips', factor: 1.25 } },
  { id: 'chairs', category: 'front', anchor: K.Chair, restyle: 'anchor', baseCost: 20, growth: 1.15,
    effect: { stat: 'patience', per: 0.06 }, milestone: { stat: 'tips', factor: 1.1 } },

  // Decor & marketing: more people walk in (until the tables are the limit).
  { id: 'plants', category: 'decor', anchor: K.Plant, restyle: 'anchor', baseCost: 30, growth: 1.16,
    effect: { stat: 'arrivals', per: 0.03 }, milestone: { stat: 'arrivals', factor: 1.1 } },
  { id: 'neon', category: 'decor', anchor: K.Neon, restyle: 'anchor', baseCost: 60, growth: 1.17,
    effect: { stat: 'arrivals', per: 0.05 }, milestone: { stat: 'tips', factor: 1.1 } },
  { id: 'sign', category: 'marketing', anchor: K.StreetSign, restyle: 'anchor', baseCost: 8, growth: 1.15,
    effect: { stat: 'arrivals', per: 0.06 }, milestone: { stat: 'arrivals', factor: 1.1 } },
];

export const UPGRADE_BY_ID: Readonly<Record<string, UpgradeDef>> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
