import { HERO, HEROES } from '../../data/offers';
import { BAR, BAR_STAGES } from '../../data/bar';
import { TIERS } from '../../data/buildings';
import { HUB } from '../../data/delivery';
import { DISHES } from '../../data/dishes';
import type { MapDef } from '../../data/maps';
import { SHOP } from '../../data/shop';
import { FRANCHISE } from '../../data/franchise';
import { COUNT_STATS, MILESTONES, RANK, UPGRADE_BY_ID, UPGRADES, type Stat, type UpgradeDef } from '../../data/upgrades';
import { big, type Big } from '../big';

// The upgrade engine: pure functions over a { id: level } map. Nothing here knows about the
// game state, the renderer or the UI (only the building's free spots cap a few rows), so the
// balance bot and offline progress use the exact same math.

export type Levels = Readonly<Record<string, number>>;

/** Everything upgrades change, as plain numbers the systems multiply by. */
export interface Mods {
  cookSpeed: number;
  washSpeed: number;
  tips: number;
  patience: number;
  arrivals: number;
  quality: number;
  /** Extra plates, tables and stoves on top of the starting ones; tables with a second chair; the building tier. */
  plates: number;
  tables: number;
  stoves: number;
  seats: number;
  /** Tables made into square family tables for four. */
  family: number;
  building: number;
  /** Deliveries: extra couriers' places, scooter speed, the delivery app's price, packing speed. */
  couriers: number;
  tripSpeed: number;
  deliveryPrice: number;
  packSpeed: number;
  /** The delivery hub (src/data/delivery.ts HUB): more packers' posts, and more delivery orders. */
  packers: number;
  deliveryDemand: number;
  /** The bar's pieces (src/data/bar.ts BAR_STAGES): added to the chance of a drink with a meal, and of a guest at the bar. */
  drinkChance: number;
  barGuests: number;
  /** Bar stools bought (on top of the building's own, src/data/bar.ts). */
  stools: number;
  /** The bar: how fast drinks are made, and what they sell for. */
  mixSpeed: number;
  drinkPrice: number;
  /** Per-dish price multiplier and whether the dish is on the menu. */
  price: number[];
  menu: boolean[];
}

export const levelOf = (levels: Levels, id: string): number => levels[id] ?? 0;

/** How many milestones a level has passed (endless: one more every `every` levels). */
export function milestonesReached(level: number): number {
  let n = 0;
  for (const m of MILESTONES.levels) if (level >= m) n++;
  const last = MILESTONES.levels[MILESTONES.levels.length - 1]!;
  if (level > last) n += Math.floor((level - last) / MILESTONES.every);
  return n;
}

/** The next milestone level strictly above `level`. */
export function nextMilestone(level: number): number {
  for (const m of MILESTONES.levels) if (m > level) return m;
  const last = MILESTONES.levels[MILESTONES.levels.length - 1]!;
  return last + (Math.floor((level - last) / MILESTONES.every) + 1) * MILESTONES.every;
}

/** The last milestone level at or below `level` (0 before the first one). */
export function prevMilestone(level: number): number {
  let prev = 0;
  for (const m of MILESTONES.levels) if (m <= level) prev = m;
  const last = MILESTONES.levels[MILESTONES.levels.length - 1]!;
  if (level > last) prev = last + Math.floor((level - last) / MILESTONES.every) * MILESTONES.every;
  return prev;
}

/** Visual tier 0..visualTiers: which look the item has. */
export const tierOf = (level: number): number => Math.min(MILESTONES.visualTiers, milestonesReached(level));

/** Price of the next level (from `level` to `level + 1`), whole coins. */
export function costOf(def: UpgradeDef, level: number): Big {
  const set = def.costs?.[level];
  return set !== undefined ? big(set) : big(def.growth).pow(level).mul(def.baseCost).ceil();
}

/** The restaurant level (1 = the start); it caps every endless track. */
export const restaurantLevel = (levels: Levels): number => levelOf(levels, RANK.id) + 1;

/** Endless tracks stop here until the restaurant levels up. */
export const levelCap = (levels: Levels): number => RANK.levels * restaurantLevel(levels);

/** A track the restaurant level caps (not a count of things, not the restaurant level itself). */
/** Stools a building comes with: all of them from the grand restaurant, none before (bought one by one). */
export const freeStools = (map: MapDef): number => (map.tier >= BAR.stoolsFreeTier ? map.bar.stools.length : 0);

export const isCappedTrack = (def: UpgradeDef): boolean => def.max === undefined && def.spots === undefined && def.id !== RANK.id;

/** How many tracks have reached the cap (the next restaurant level wants RANK.ready of them). */
export function tracksAtCap(levels: Levels): number {
  const cap = levelCap(levels);
  return UPGRADES.filter((d) => isCappedTrack(d) && levelOf(levels, d.id) >= cap).length;
}

/**
 * How many levels a track can have here: capacity rows are limited by this building's free
 * spots, and second chairs by the tables there are to put them at; the rest by the restaurant level.
 */
export function capOf(def: UpgradeDef, map: MapDef, levels: Levels): number | undefined {
  if (def.spots === 'tables') return map.tables.length - map.startTables;
  if (def.spots === 'stoves') return map.cookCap - map.startStoves;
  if (def.spots === 'seats') return Math.min(map.tables.length, map.startTables + levelOf(levels, 'tables'));
  // A family table is a table for two made bigger.
  if (def.spots === 'family') return Math.min(map.tables.length, map.startTables + levelOf(levels, 'tables'), levelOf(levels, 'seats'));
  if (def.spots === 'stools') return map.bar.stools.length - freeStools(map);
  if (def.max !== undefined || def.id === RANK.id) return def.max;
  return levelCap(levels);
}

export function isMaxed(def: UpgradeDef, levels: Levels, map: MapDef): boolean {
  const cap = capOf(def, map, levels);
  return cap !== undefined && levelOf(levels, def.id) >= cap;
}

export function isUnlocked(def: UpgradeDef, levels: Levels): boolean {
  if (def.id === RANK.id) return tracksAtCap(levels) >= RANK.ready;
  return !def.requires || levelOf(levels, def.requires.item) >= def.requires.level;
}

/** Can this level be bought right now with these coins, in this building? */
export function canBuy(def: UpgradeDef, levels: Levels, coins: Big, map: MapDef): boolean {
  const level = levelOf(levels, def.id);
  return isUnlocked(def, levels) && !isMaxed(def, levels, map) && coins.gte(costOf(def, level));
}

/**
 * One item's own contribution to its main stat at a level: a multiplier (1 = nothing yet) or,
 * for counts, the amount added. The UI shows this as "x1.48 -> x1.56".
 */
export function itemValue(def: UpgradeDef, level: number): number {
  if (COUNT_STATS.includes(def.effect.stat)) return def.effect.per * level;
  const own = def.milestone && def.milestone.stat === def.effect.stat && def.milestone.dish === def.effect.dish;
  return (1 + def.effect.per * level) * (own ? def.milestone!.factor ** milestonesReached(level) : 1);
}

function emptyMods(): Mods {
  return {
    cookSpeed: 1,
    washSpeed: 1,
    tips: 1,
    patience: 1,
    arrivals: 1,
    quality: 1,
    plates: 0,
    tables: 0,
    stoves: 0,
    seats: 0,
    family: 0,
    building: 0,
    couriers: 0,
    tripSpeed: 1,
    deliveryPrice: 1,
    packSpeed: 1,
    packers: 0,
    deliveryDemand: 1,
    drinkChance: 0,
    barGuests: 0,
    stools: 0,
    mixSpeed: 1,
    drinkPrice: 1,
    price: DISHES.map(() => 1),
    menu: DISHES.map((d) => d.startsUnlocked),
  };
}

type ScalarStat = Exclude<Stat, 'price'>;

/** Shop perks owned: id -> 1 (permanent multipliers bought with gems). */
export type Perks = Readonly<Record<string, number>>;

/** All prices are multiplied by this for the chef trophies won in earlier branches. */
export const trophyBonus = (trophies: number): number => 1 + FRANCHISE.pricePerTrophy * Math.max(0, trophies);

/** Levels add up within a stat; milestones multiply on top; shop perks and trophies multiply last. */
export function computeMods(levels: Levels, perks: Perks = {}, trophies = 0): Mods {
  const m = emptyMods();
  const add: Partial<Record<ScalarStat, number>> = {};
  const priceAdd = DISHES.map(() => 0);
  for (const def of UPGRADES) {
    const level = levelOf(levels, def.id);
    if (level <= 0) continue;
    const e = def.effect;
    if (e.stat === 'price') priceAdd[e.dish!]! += e.per * level;
    else add[e.stat] = (add[e.stat] ?? 0) + e.per * level;
    if (def.unlocksDish !== undefined) m.menu[def.unlocksDish] = true;
    const ms = def.milestone;
    const reached = milestonesReached(level);
    if (ms && reached > 0) {
      if (ms.stat === 'price') m.price[ms.dish!]! *= ms.factor ** reached;
      else if (!COUNT_STATS.includes(ms.stat)) m[ms.stat] *= ms.factor ** reached;
    }
  }
  for (const [stat, value] of Object.entries(add) as [ScalarStat, number][]) {
    if (COUNT_STATS.includes(stat)) m[stat] += value;
    else m[stat] *= 1 + value;
  }
  priceAdd.forEach((value, dish) => (m.price[dish]! *= 1 + value));
  // The bar's pieces open with the bar counter's levels.
  const barLevel = levelOf(levels, 'barCounter');
  for (const b of BAR_STAGES) {
    if (barLevel < b.level) break;
    m.drinkPrice *= b.perk.drinkPrice ?? 1;
    m.mixSpeed *= b.perk.mixSpeed ?? 1;
    m.drinkChance += b.perk.drinkChance ?? 0;
    m.barGuests += b.perk.barGuests ?? 0;
    m.arrivals *= b.perk.arrivals ?? 1;
  }
  // The delivery hub's pieces, each with what it brings, open with the packing station's levels.
  const hubLevel = levelOf(levels, 'packStation');
  for (const h of HUB) {
    if (hubLevel < h.level) break;
    m.packers += h.perk.packers ?? 0;
    m.couriers += h.perk.couriers ?? 0;
    m.deliveryPrice *= h.perk.deliveryPrice ?? 1;
    m.deliveryDemand *= h.perk.deliveryDemand ?? 1;
    m.tripSpeed *= h.perk.tripSpeed ?? 1;
  }
  // A bigger, fancier place draws more people and charges more for everything.
  const tier = TIERS[Math.min(m.building, TIERS.length - 1)]!;
  m.arrivals *= tier.arrivals;
  m.price = m.price.map((p) => p * tier.price);
  for (const item of SHOP) {
    if (item.kind !== 'perk' || !perks[item.id]) continue;
    if (item.stat === 'price') m.price = m.price.map((p) => p * item.mult);
    else m[item.stat] *= item.mult;
  }
  // Heroes from the paid offers (src/data/offers.ts): each lifts one thing, everywhere, for good.
  for (const h of HEROES) {
    if (!perks[HERO.perkPrefix + h.id]) continue;
    if (h.bonus.stat === 'price') m.price = m.price.map((p) => p * h.bonus.mult);
    else m[h.bonus.stat] *= h.bonus.mult;
  }
  if (trophies > 0) m.price = m.price.map((p) => p * trophyBonus(trophies));
  return m;
}

export function upgradeDef(id: string): UpgradeDef {
  const def = UPGRADE_BY_ID[id];
  if (!def) throw new Error(`Unknown upgrade ${id}`);
  return def;
}
