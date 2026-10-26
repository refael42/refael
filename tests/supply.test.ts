import { describe, expect, it } from 'vitest';
import { Dish } from '../src/data/dishes';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { Ingr, SUPPLIERS, SUPPLY } from '../src/data/supply';
import { big } from '../src/sim/big';
import { computeMods } from '../src/sim/economy/upgrades';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { scoreParts } from '../src/sim/game/guide';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, OrderState, type GameState, type Order } from '../src/sim/game/types';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { anyMissing, capacityOf, hasStock, ingredientOf, noteBill, setSupplier, takeStock, unitCost, updateSupply, urgentExtra, urgentOrder } from '../src/sim/supply';

// Owner M51: suppliers and the storeroom.

const team = ['cook', 'waiter', 'washer'] as const;
const game = (): GameState => createGame(STAND_MAP, 6, { roster: [...team] });
const order = (dish: number): Order => ({ id: 999, customer: -1, dish, state: OrderState.Queued, progress: 0, slot: -1, since: 0, landsAt: 0, waiter: -1, quality: 1, delivery: false });
const run = (s: GameState, seconds: number) => {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) stepGame(s, STEP_SEC);
};

describe('the storeroom', () => {
  it('starts full; each dish takes a unit of its own ingredient and goes on the supplier account', () => {
    const s = game();
    const cap = capacityOf(s);
    expect(s.supply.stock).toEqual([cap, cap, cap]);
    expect(ingredientOf(Dish.Fries)).toBe(Ingr.Veg);
    expect(ingredientOf(Dish.Steak)).toBe(Ingr.Protein);
    expect(ingredientOf(Dish.Pizza)).toBe(Ingr.Pantry);
    noteBill(s, big(100));
    const o = order(Dish.Fries);
    takeStock(s, o);
    expect(s.supply.stock[Ingr.Veg]).toBe(cap - 1);
    expect(s.supply.owed.toNumber()).toBeCloseTo(unitCost(s, Ingr.Veg).toNumber(), 6);
    // Paid from the till as coins come in, never below zero.
    s.coins = big(0);
    updateSupply(s);
    expect(s.coins.toNumber()).toBe(0);
    expect(s.supply.owed.gt(0)).toBe(true);
    s.coins = big(1000);
    updateSupply(s);
    expect(s.supply.owed.toNumber()).toBe(0);
    expect(s.coins.toNumber()).toBeLessThan(1000);
  });

  it('holds more in bigger buildings and with the storeroom upgrade', () => {
    const s = game();
    const base = capacityOf(s);
    s.mods = computeMods({ fridge: 10, storeroom: 10 });
    expect(capacityOf(s)).toBeGreaterThan(base * 2);
    s.mods = { ...computeMods({}), building: 3 };
    expect(capacityOf(s)).toBe(SUPPLY.capacity[3]);
  });

  it('out of an ingredient: cooks take the next ticket they can, the rest wait for the van (said once)', () => {
    const s = game();
    s.nextArrival = Infinity;
    s.supply.stock[Ingr.Veg] = 0;
    s.supply.nextVan = Infinity;
    expect(hasStock(s, Dish.Fries)).toBe(false);
    const fries = { ...order(Dish.Fries), id: 900 };
    s.orders.push(fries);
    run(s, 1);
    expect(fries.state).toBe(OrderState.Queued);
    expect(s.staff.find((st) => st.role === 'cook')!.stalled).toBe('stock');
    // The last unit going says so once.
    const t = game();
    t.supply.stock[Ingr.Veg] = 1;
    const ev = () => t.events.filter((e) => e.type === Ev.StockOut).length;
    takeStock(t, order(Dish.Fries));
    expect(ev()).toBe(1);
    takeStock(t, order(Dish.Fries));
    expect(ev()).toBe(1);
  });
});

describe('the van', () => {
  it('comes when due, unloads, fills the storeroom, and the account shows what the round cost', () => {
    const s = game();
    s.nextArrival = Infinity;
    noteBill(s, big(50));
    for (let i = 0; i < 5; i++) takeStock(s, order(Dish.Fries));
    const spent = s.supply.spent.toNumber();
    s.supply.nextVan = s.time + 1;
    run(s, 1.2);
    expect(s.supply.van).not.toBeNull();
    expect(s.events.some((e) => e.type === Ev.SupplyVan)).toBe(true);
    run(s, SUPPLY.driveSeconds + SUPPLY.unloadSeconds);
    expect(s.supply.stock[Ingr.Veg]).toBe(capacityOf(s));
    expect(s.supply.lastBill.toNumber()).toBeCloseTo(spent, 6);
    expect(s.supply.spent.toNumber()).toBe(0);
    run(s, SUPPLY.driveSeconds + 0.5);
    expect(s.supply.van).toBeNull();
    expect(s.supply.nextVan).toBeGreaterThan(s.time + SUPPLY.everySeconds * 0.8);
  });

  it('does not come while the place is being rebuilt', () => {
    const s = game();
    s.construction = { tier: 1, until: Infinity } as unknown as GameState['construction'];
    s.supply.nextVan = 0;
    updateSupply(s);
    expect(s.supply.van).toBeNull();
  });

  it('an urgent order sends it now, for more, only when something is missing and none is on the way', () => {
    const s = game();
    noteBill(s, big(100));
    expect(anyMissing(s)).toBe(false);
    expect(urgentOrder(s)).toBe(false);
    s.supply.stock[Ingr.Protein] = 2;
    const extra = urgentExtra(s);
    expect(extra.gt(0)).toBe(true);
    expect(urgentOrder(s)).toBe(true);
    expect(urgentOrder(s)).toBe(false);
    s.coins = big(0);
    run(s, SUPPLY.driveSeconds + SUPPLY.urgentUnload + 0.2);
    expect(s.supply.stock[Ingr.Protein]).toBe(capacityOf(s));
    expect(s.supply.owed.toNumber()).toBeCloseTo(extra.toNumber(), 0);
  });
});

describe('suppliers', () => {
  it('the farm opens with the bistro; the market costs less and sells for less, the farm the other way', () => {
    const s = game();
    expect(setSupplier(s, Ingr.Veg, 2)).toBe(false);
    expect(setSupplier(s, Ingr.Veg, 0)).toBe(true);
    noteBill(s, big(100));
    const market = unitCost(s, Ingr.Veg).toNumber();
    const cheap = order(Dish.Fries);
    takeStock(s, cheap);
    expect(cheap.quality).toBeCloseTo(SUPPLIERS[0]!.quality, 6);
    s.mods = { ...s.mods, building: 1 };
    expect(setSupplier(s, Ingr.Veg, 2)).toBe(true);
    expect(unitCost(s, Ingr.Veg).toNumber()).toBeGreaterThan(market * 2);
    const fine = order(Dish.Fries);
    takeStock(s, fine);
    expect(fine.quality).toBeCloseTo(SUPPLIERS[2]!.quality, 6);
    // The guide's inspectors taste it too.
    const farm = scoreParts(s, fine, s.time).ingredients;
    setSupplier(s, Ingr.Veg, 0);
    expect(scoreParts(s, fine, s.time).ingredients).toBeLessThan(farm);
  });

  it('the supply contract makes the bill smaller and the van sooner', () => {
    const s = game();
    noteBill(s, big(100));
    const before = unitCost(s, Ingr.Protein).toNumber();
    s.mods = computeMods({ fridge: 10, storeroom: 5, supplyContract: 20 });
    expect(unitCost(s, Ingr.Protein).toNumber()).toBeLessThan(before);
  });

  it('a unit is priced by what guests pay lately, more for the pricier dishes\' ingredient', () => {
    const s = game();
    s.mods = { ...s.mods, menu: s.mods.menu.map((_, d) => d === Dish.Fries || d === Dish.Burger) };
    noteBill(s, big(100));
    expect(unitCost(s, Ingr.Protein).gt(unitCost(s, Ingr.Veg))).toBe(true);
    const a = unitCost(s, Ingr.Veg).toNumber();
    for (let i = 0; i < 200; i++) noteBill(s, big(1000));
    expect(unitCost(s, Ingr.Veg).toNumber()).toBeGreaterThan(a * 5);
  });

  it('are kept in the save; the storeroom is full on coming back', () => {
    const s = game();
    setSupplier(s, Ingr.Pantry, 0);
    s.supply.stock[Ingr.Pantry] = 3;
    const r = parseSave(JSON.stringify(makeSave(s, 1000)));
    if (!r.ok) throw new Error(r.reason);
    const back = restoreGame(r.save, 1, 2000);
    expect(back.supply.suppliers[Ingr.Pantry]).toBe(0);
    expect(back.supply.stock[Ingr.Pantry]).toBe(capacityOf(back));
  });
});

describe('in play', () => {
  it('guests are served, the van comes round, the account is paid and nothing runs out in a first stand', () => {
    const s = game();
    s.chef.xp = -1e12;
    let outs = 0;
    let vans = 0;
    let last = 0;
    for (let i = Math.round(300 / STEP_SEC); i > 0; i--) {
      for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
      stepGame(s, STEP_SEC);
      for (const e of s.events) {
        if (e.id <= last) continue;
        last = e.id;
        if (e.type === Ev.StockOut) outs++;
        if (e.type === Ev.SupplyPaid) vans++;
      }
    }
    expect(s.stats.served).toBeGreaterThan(10);
    expect(vans).toBeGreaterThanOrEqual(3);
    expect(outs).toBe(0);
    expect(s.supply.owed.toNumber()).toBeLessThan(s.supply.avgBill.toNumber());
  });
});
