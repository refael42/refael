import { VALUE } from '../../data/balance';
import type { MapDef } from '../../data/maps';
import { KITCHEN } from '../../data/staff';
import { UPGRADES, type UpgradeDef } from '../../data/upgrades';
import { computeMods, costOf, isMaxed, isUnlocked, levelOf, type Levels, type Mods } from './upgrades';

// "Best value": roughly how much more the restaurant earns from one more level, per coin. Each
// stat counts by how strongly it moves income (VALUE), as a ratio: +10 % of anything is worth
// the same early or late. Pure, so the screen and the tests agree.

type Weighted = Exclude<keyof typeof VALUE, 'newDish' | 'listSize'>;

/** The size of each stat that matters for income, counts included (with what the building starts with). */
function amounts(m: Mods, map: MapDef): Record<Weighted, number> {
  const onMenu = m.price.filter((_, d) => m.menu[d]);
  const tables = map.startTables + m.tables;
  return {
    price: onMenu.reduce((sum, p) => sum + p, 0) / Math.max(1, onMenu.length),
    quality: m.quality,
    arrivals: m.arrivals,
    cookSpeed: m.cookSpeed,
    washSpeed: m.washSpeed,
    plates: KITCHEN.plates + m.plates,
    patience: m.patience,
    tips: m.tips,
    tables,
    stoves: map.startStoves + m.stoves,
    seats: tables + m.seats,
  };
}

/** Income gain (as a log ratio) from buying the next level of `def`. */
export function gainOf(def: UpgradeDef, levels: Levels, map: MapDef): number {
  const before = computeMods(levels);
  const after = computeMods({ ...levels, [def.id]: levelOf(levels, def.id) + 1 });
  const a = amounts(before, map);
  const b = amounts(after, map);
  let gain = 0;
  for (const k of Object.keys(a) as Weighted[]) if (b[k] > 0 && a[k] > 0) gain += VALUE[k] * Math.log(b[k] / a[k]);
  if (after.menu.filter(Boolean).length > before.menu.filter(Boolean).length) gain += VALUE.newDish;
  return gain;
}

/** Gain per coin for the next level (0 when it cannot be bought here at all). */
export function valuePerCoin(def: UpgradeDef, levels: Levels, map: MapDef): number {
  if (def.build || !isUnlocked(def, levels) || isMaxed(def, levels, map)) return 0;
  const cost = costOf(def, levelOf(levels, def.id)).toNumber();
  return Number.isFinite(cost) && cost > 0 ? gainOf(def, levels, map) / cost : 0;
}

/** The upgrades worth the most per coin right now, best first. */
export function bestValue(levels: Levels, map: MapDef, size: number = VALUE.listSize): UpgradeDef[] {
  return UPGRADES.map((def) => ({ def, v: valuePerCoin(def, levels, map) }))
    .filter((x) => x.v > 0)
    .sort((x, y) => y.v - x.v)
    .slice(0, size)
    .map((x) => x.def);
}
