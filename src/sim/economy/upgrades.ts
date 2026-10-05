import { DISHES } from '../../data/dishes';
import { COUNT_STATS, MILESTONES, UPGRADE_BY_ID, UPGRADES, type Stat, type UpgradeDef } from '../../data/upgrades';
import { big, type Big } from '../big';

// The upgrade engine: pure functions over a { id: level } map. Nothing here knows about the
// map, the renderer or the UI, so the balance bot and offline progress use the exact same math.

export type Levels = Readonly<Record<string, number>>;

/** Everything upgrades change, as plain numbers the systems multiply by. */
export interface Mods {
  cookSpeed: number;
  washSpeed: number;
  tips: number;
  patience: number;
  arrivals: number;
  quality: number;
  /** Extra plates, tables and stoves on top of the starting ones. */
  plates: number;
  tables: number;
  stoves: number;
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
  return big(def.growth).pow(level).mul(def.baseCost).ceil();
}

export const isMaxed = (def: UpgradeDef, level: number): boolean => def.max !== undefined && level >= def.max;

export function isUnlocked(def: UpgradeDef, levels: Levels): boolean {
  return !def.requires || levelOf(levels, def.requires.item) >= def.requires.level;
}

/** Can this level be bought right now with these coins? */
export function canBuy(def: UpgradeDef, levels: Levels, coins: Big): boolean {
  const level = levelOf(levels, def.id);
  return isUnlocked(def, levels) && !isMaxed(def, level) && coins.gte(costOf(def, level));
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
    price: DISHES.map(() => 1),
    menu: DISHES.map((d) => d.startsUnlocked),
  };
}

type ScalarStat = Exclude<Stat, 'price'>;

/** Levels add up within a stat; milestones multiply on top. */
export function computeMods(levels: Levels): Mods {
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
  return m;
}

export function upgradeDef(id: string): UpgradeDef {
  const def = UPGRADE_BY_ID[id];
  if (!def) throw new Error(`Unknown upgrade ${id}`);
  return def;
}
