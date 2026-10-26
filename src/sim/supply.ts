import { DISHES } from '../data/dishes';
import { TIERS } from '../data/buildings';
import { DISH_INGREDIENT, INGREDIENTS, SUPPLIERS, SUPPLY } from '../data/supply';
import { big, ZERO, type Big } from './big';
import { dishPrice } from './game/customers';
import { emit, Ev } from './game/events';
import type { GameState, Order } from './game/types';

// Suppliers and the storeroom (src/data/supply.ts). The van is sim time, like the tourist bus:
// it never comes while the game is away (a game coming back finds the storeroom full, the time
// away paid for it). A cook takes a unit of the dish's ingredient when starting it.

export interface SupplyState {
  /** Units in the storeroom, by ingredient; each one's supplier (index into SUPPLIERS). */
  stock: number[];
  suppliers: number[];
  /** When the next van sets off (sim time). */
  nextVan: number;
  /** The van on the road: when it set off, when it leaves the curb (the storeroom filled then), an urgent one, unloaded. */
  van: { arrive: number; leave: number; urgent: boolean; done: boolean } | null;
  /** Ran out of it (said once, until the van brings more). */
  out: boolean[];
  /**
   * The supplier's account: what is still owed (paid from the till as coins come in, never
   * below zero), what the units used since the last van cost, and the last van's total.
   */
  owed: Big;
  spent: Big;
  lastBill: Big;
  /** What a guest pays lately (a running average, tip included): the ingredients cost a share of it. */
  avgBill: Big;
}

const n = INGREDIENTS.length;

/** Units of each ingredient the storeroom holds in this building, with the storeroom upgrade. */
export const capacityOf = (s: Pick<GameState, 'mods'>): number => {
  const tier = Math.min(s.mods.building, SUPPLY.capacity.length - 1, TIERS.length - 1);
  return Math.round(SUPPLY.capacity[tier]! * s.mods.storage);
};

export const newSupply = (s: Pick<GameState, 'mods' | 'time'>, suppliers?: readonly number[]): SupplyState => ({
  stock: Array.from({ length: n }, () => capacityOf(s)),
  suppliers: Array.from({ length: n }, (_, i) => suppliers?.[i] ?? SUPPLY.start),
  nextVan: s.time + SUPPLY.everySeconds / s.mods.supply,
  van: null,
  out: Array.from({ length: n }, () => false),
  owed: ZERO,
  spent: ZERO,
  lastBill: ZERO,
  avgBill: ZERO,
});

export const ingredientOf = (dish: number): number => DISH_INGREDIENT[dish as keyof typeof DISH_INGREDIENT] ?? 0;

/** Is there a unit for this dish in the storeroom? */
export const hasStock = (s: GameState, dish: number): boolean => s.supply.stock[ingredientOf(dish)]! >= 1;

/**
 * A cook starts this order: one unit of its ingredient out of the storeroom, and its supplier's
 * quality on the plate. The unit goes on the supplier's account, paid from the till as the coins
 * come in (a small steady cost rather than one big bill a van; spending everything at once does
 * not get the ingredients for free).
 */
export function takeStock(s: GameState, o: Order): void {
  const i = ingredientOf(o.dish);
  const sup = s.supply;
  sup.stock[i] = Math.max(0, sup.stock[i]! - 1);
  const cost = unitCost(s, i);
  sup.owed = sup.owed.add(cost);
  sup.spent = sup.spent.add(cost);
  o.quality *= SUPPLIERS[sup.suppliers[i]!]!.quality;
  if (sup.stock[i]! < 1 && !sup.out[i]) {
    sup.out[i] = true;
    emit(s, Ev.StockOut, 0, 0, i);
  }
}

/** The guide's inspectors judge the ingredients too: the farm's are better, the market's worse. */
export const supplierInspector = (s: GameState, dish: number): number => SUPPLIERS[s.supply.suppliers[ingredientOf(dish)]!]!.inspector;

/** A guest paid this (the bill and the tip: late in the game the tips are most of it): the running average the ingredients are priced by. */
export function noteBill(s: GameState, bill: Big): void {
  const sup = s.supply;
  sup.avgBill = sup.avgBill.lte(0) ? bill : sup.avgBill.mul(1 - BILL_WEIGHT).add(bill.mul(BILL_WEIGHT));
}
const BILL_WEIGHT = 0.05;

const avgPrice = (s: GameState, dishes: readonly { id: number }[]): Big =>
  dishes.length ? dishes.reduce((sum, d) => sum.add(dishPrice(s, d.id)), big(0)).div(dishes.length) : ZERO;

/**
 * What one unit of an ingredient costs now from its supplier: a share of what a guest's bill comes
 * to lately (it grows with everything that lifts the bills, so the share holds all game), more for
 * an ingredient whose dishes are the pricier ones on the menu.
 */
export function unitCost(s: GameState, i: number): Big {
  const menu = DISHES.filter((d) => s.mods.menu[d.id]);
  const own = menu.filter((d) => ingredientOf(d.id) === i);
  const all = avgPrice(s, menu);
  if (all.lte(0)) return ZERO;
  // Before the first bill: the menu's own prices.
  const bill = s.supply.avgBill.gt(0) ? s.supply.avgBill : all;
  const avg = bill.mul(own.length ? avgPrice(s, own).div(all) : big(1));
  // The supply contract brings the van sooner and makes the bill smaller (by its square root: it never goes free).
  return avg.mul((SUPPLY.costShare * SUPPLIERS[s.supply.suppliers[i]!]!.cost) / Math.sqrt(s.mods.supply));
}

/** What an urgent van costs on top now: the units it brings, `urgentCost - 1` times again. */
export function urgentExtra(s: GameState): Big {
  const cap = capacityOf(s);
  let sum = big(0);
  for (let i = 0; i < n; i++) sum = sum.add(unitCost(s, i).mul(Math.max(0, cap - s.supply.stock[i]!)));
  return sum.mul(SUPPLY.urgentCost - 1).ceil();
}

/** Is any ingredient short of a full storeroom (something for a van to bring)? */
export const anyMissing = (s: GameState): boolean => s.supply.stock.some((v) => v < capacityOf(s));

/** Where the van stops: in the road, a few steps left of the door (the bus stops right of it). */
export const vanStop = (s: GameState): { x: number; y: number } => ({ x: Math.max(3, s.map.busStop.x - 12), y: s.map.busStop.y });

function startVan(s: GameState, urgent: boolean): void {
  const unload = urgent ? SUPPLY.urgentUnload : SUPPLY.unloadSeconds;
  s.supply.van = { arrive: s.time, leave: s.time + SUPPLY.driveSeconds + unload, urgent, done: false };
  const p = vanStop(s);
  emit(s, Ev.SupplyVan, p.x, p.y, urgent ? 1 : 0);
}

/**
 * The van unloaded: the storeroom is full again. Its units went on the supplier's account as the
 * cooks used them; an urgent van adds its extra there too.
 */
function deliver(s: GameState, urgent: boolean): void {
  const sup = s.supply;
  const cap = capacityOf(s);
  let extra = big(0);
  for (let i = 0; i < n; i++) {
    const want = Math.max(0, cap - sup.stock[i]!);
    if (urgent && want > 0) extra = extra.add(unitCost(s, i).mul(want * (SUPPLY.urgentCost - 1)));
    sup.stock[i] = cap;
    sup.out[i] = false;
  }
  extra = extra.ceil();
  sup.owed = sup.owed.add(extra);
  sup.lastBill = sup.spent.add(extra);
  sup.spent = ZERO;
  const p = vanStop(s);
  emit(s, Ev.SupplyPaid, p.x - 1, p.y - 1.2, sup.lastBill.toNumber());
}

/** One tick: the van sets off when it is due, unloads, pays, drives on. Not while the place is being rebuilt. */
export function updateSupply(s: GameState): void {
  const sup = s.supply;
  // The account is settled from the till as far as it goes (after this step's guests paid).
  if (sup.owed.gt(0) && s.coins.gt(0)) {
    const pay = sup.owed.min(s.coins);
    s.coins = s.coins.sub(pay);
    sup.owed = sup.owed.sub(pay);
  }
  // A bigger storeroom (an upgrade, a new building) never leaves more than it holds.
  const cap = capacityOf(s);
  for (let i = 0; i < n; i++) if (sup.stock[i]! > cap) sup.stock[i] = cap;
  const van = sup.van;
  if (van) {
    if (!van.done && s.time >= van.leave) {
      deliver(s, van.urgent);
      van.done = true;
      // The next one comes a full round after this one (an urgent van does not move the usual one).
      if (!van.urgent) sup.nextVan = s.time + SUPPLY.everySeconds / s.mods.supply;
    }
    // It drives off and is gone after the drive.
    if (van.done && s.time >= van.leave + SUPPLY.driveSeconds) sup.van = null;
    return;
  }
  if (s.construction) return;
  if (s.time >= sup.nextVan) startVan(s, false);
}

/** An urgent order: the van sets off now (only when none is on the way; the bill is higher). */
export function urgentOrder(s: GameState): boolean {
  if (s.supply.van || s.construction || !anyMissing(s)) return false;
  startVan(s, true);
  return true;
}

/** Picks an ingredient's supplier (one this building has opened). */
export function setSupplier(s: GameState, ingredient: number, supplier: number): boolean {
  const def = SUPPLIERS[supplier];
  if (!def || ingredient < 0 || ingredient >= n || s.mods.building < def.tier) return false;
  s.supply.suppliers[ingredient] = supplier;
  return true;
}

/** Ingredients running low (below `lowAt` of the storeroom), and out. */
export const lowStock = (s: GameState): number[] => {
  const cap = capacityOf(s);
  return s.supply.stock.flatMap((v, i) => (v < Math.max(1, cap * SUPPLY.lowAt) ? [i] : []));
};
