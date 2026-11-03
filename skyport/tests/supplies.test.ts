import { describe, expect, it } from 'vitest';

import { FUEL_SUPPLIERS, REORDER_AT, STORES, URGENT_LEAD, URGENT_PRICE } from '../src/data/supplies';
import { Big, createGame, layoutOf, parseSave, serializeGame, stepGame, switchTier, type GameState } from '../src/sim';
import { spawnFlight } from '../src/sim/game/flights';
import { capacity, draw, incoming, placeOrder, storeActive, unitPrice } from '../src/sim/game/supplies';

function rich(s: GameState): void {
  s.money = Big.fromNumber(1e9);
}

function runUntil(s: GameState, ok: () => boolean, seconds: number): boolean {
  for (let i = 0; i < seconds * 30; i++) {
    if (ok()) return true;
    stepGame(s);
  }
  return ok();
}

describe('fuel farm', () => {
  it('the dirt strip pump never runs dry; the small airfield keeps a stock', () => {
    const s = createGame(1);
    expect(storeActive(s, 'fuel')).toBe(false);
    expect(draw(s, 'fuel', 1e9)).toBe(1e9);
    switchTier(s, 2);
    expect(storeActive(s, 'fuel')).toBe(true);
    expect(s.stores.fuel.stock).toBe(capacity(s, 'fuel'));
    expect(draw(s, 'fuel', 1000)).toBe(1000);
    expect(s.stores.fuel.stock).toBe(capacity(s, 'fuel') - 1000);
  });

  it('orders by itself when low, pays for it, and a tanker drives in and fills the tanks', () => {
    const s = createGame(2);
    switchTier(s, 2);
    rich(s);
    const cap = capacity(s, 'fuel');
    draw(s, 'fuel', cap * 0.7);
    const before = s.money.toNumber();
    stepGame(s);
    expect(s.deliveries.length).toBe(1);
    const d = s.deliveries[0];
    const want = Math.floor((cap - s.stores.fuel.stock) / 500) * 500;
    expect(d.amount).toBe(want);
    expect(before - s.money.toNumber()).toBeCloseTo(Math.ceil(want * unitPrice(s, 'fuel', s.stores.fuel.supplier)), 0);
    // no double orders while one is on its way
    stepGame(s);
    expect(s.deliveries.length).toBe(1);
    expect(runUntil(s, () => d.state === 'driving', 600)).toBe(true);
    expect(runUntil(s, () => d.state === 'unloading', 120)).toBe(true);
    // it unloads at the fuel bay, inside the gate
    const bay = layoutOf(2).depot!.fuelBay;
    expect(Math.hypot(d.x - bay[0], d.y - bay[1])).toBeLessThan(0.05);
    expect(runUntil(s, () => d.state === 'leaving', 60)).toBe(true);
    expect(s.stores.fuel.stock).toBeCloseTo(cap * 0.3 + want, 3);
    expect(runUntil(s, () => s.deliveries.length === 0, 120)).toBe(true);
  });

  it('an empty farm leaves the truck waiting at the plane until the tanker comes', () => {
    const s = createGame(3);
    switchTier(s, 2);
    rich(s);
    const f = spawnFlight(s)!;
    f.phase = 'turnaround';
    f.fuel = 0;
    f.fuelNeed = 300;
    s.stores.fuel.stock = 0;
    // a 'delivery' far away so the farm stays empty for a while
    s.stores.fuel.supplier = 0;
    s.queue.push({ type: 'sendFuel', flightId: f.id });
    runUntil(s, () => f.fuelState === 3, 120);
    const at = f.fuel;
    for (let i = 0; i < 30 * 20; i++) stepGame(s);
    expect(f.fuel).toBe(at);
    expect(s.stores.fuel.out).toBe(true);
    // the tanker arrives: the truck goes on pumping
    s.stores.fuel.stock = 2000;
    expect(runUntil(s, () => f.fuel >= f.fuelNeed, 60)).toBe(true);
  });

  it('an urgent order is dearer and comes quickly', () => {
    const s = createGame(4);
    switchTier(s, 2);
    rich(s);
    draw(s, 'fuel', capacity(s, 'fuel') * 0.3);
    const before = s.money.toNumber();
    expect(placeOrder(s, 'fuel', true)).toBe(true);
    const d = s.deliveries[0];
    expect(d.eta - s.time).toBe(URGENT_LEAD);
    expect(before - s.money.toNumber()).toBeCloseTo(Math.ceil(d.amount * unitPrice(s, 'fuel', s.stores.fuel.supplier) * URGENT_PRICE), 0);
  });

  it('the budget supplier is cheaper but often late; the regular one hardly ever', () => {
    const lateShare = (supplier: number) => {
      const s = createGame(5);
      switchTier(s, 2);
      rich(s);
      s.stores.fuel.supplier = supplier;
      let late = 0;
      const n = 400;
      for (let i = 0; i < n; i++) {
        s.deliveries = [];
        s.stores.fuel.stock = 0;
        placeOrder(s, 'fuel', false);
        if (s.deliveries[0].eta - s.time > FUEL_SUPPLIERS[supplier].lead + 1) late++;
      }
      return late / n;
    };
    expect(FUEL_SUPPLIERS[0].price).toBeLessThan(FUEL_SUPPLIERS[1].price);
    expect(lateShare(0)).toBeGreaterThan(0.2);
    expect(lateShare(1)).toBeLessThan(0.15);
  });

  it('green fuel lifts the mood of the flights it goes into', () => {
    const run = (supplier: number) => {
      const s = createGame(6);
      switchTier(s, 2);
      rich(s);
      s.stores.fuel.supplier = supplier;
      const f = spawnFlight(s)!;
      f.phase = 'turnaround';
      f.fuel = 0;
      f.fuelNeed = 100;
      f.mood = 0.5;
      s.queue.push({ type: 'sendFuel', flightId: f.id });
      runUntil(s, () => f.fuelState === 4, 200);
      return f.mood;
    };
    const green = FUEL_SUPPLIERS.findIndex((x) => x.green);
    expect(run(green)).toBeGreaterThan(run(1) + 0.03);
  });

  it('without money there is no order, and a warning instead', () => {
    const s = createGame(7);
    switchTier(s, 2);
    s.money = Big.ZERO;
    draw(s, 'fuel', capacity(s, 'fuel') * 0.8);
    stepGame(s);
    expect(s.deliveries.length).toBe(0);
    expect(s.events.some((e) => e.kind === 'supplyLow')).toBe(true);
    rich(s);
    for (let i = 0; i < 160; i++) stepGame(s);
    expect(s.deliveries.length).toBe(1);
  });

  it('a bigger fuel farm holds more', () => {
    const s = createGame(8);
    switchTier(s, 3);
    const a = capacity(s, 'fuel');
    s.upg.fuelFarm = 2;
    s.upgRev++;
    expect(capacity(s, 'fuel')).toBe(STORES.fuel.cap[2]);
    expect(capacity(s, 'fuel')).toBeGreaterThan(a);
  });

  it('airlines pay for the fuel that goes into their planes', async () => {
    const { flightRevenue } = await import('../src/sim/game/economy');
    const { AIRCRAFT } = await import('../src/data/aircraft');
    const s = createGame(9);
    const f = spawnFlight(s)!;
    f.fuel = 0;
    const dry = flightRevenue(f, AIRCRAFT[f.aircraft]).total.toNumber();
    f.fuel = 5000;
    expect(flightRevenue(f, AIRCRAFT[f.aircraft]).total.toNumber()).toBeGreaterThan(dry + 15);
  });

  it('a save keeps the stock (what was on its way counts as delivered) and the supplier', () => {
    const s = createGame(10);
    switchTier(s, 2);
    rich(s);
    s.stores.fuel.supplier = 2;
    draw(s, 'fuel', capacity(s, 'fuel') * (1 - REORDER_AT + 0.1));
    stepGame(s);
    const total = s.stores.fuel.stock + incoming(s, 'fuel');
    const r = parseSave(serializeGame(s, 1000), 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.stores.fuel.supplier).toBe(2);
    expect(r.state.stores.fuel.stock).toBeCloseTo(Math.min(capacity(r.state, 'fuel'), total), 3);
  });

  it('is deterministic', () => {
    const run = () => {
      const s = createGame(11);
      switchTier(s, 2);
      rich(s);
      s.stores.fuel.supplier = 0;
      for (let k = 0; k < 6; k++) {
        draw(s, 'fuel', capacity(s, 'fuel'));
        for (let i = 0; i < 30 * 200; i++) stepGame(s);
      }
      return JSON.stringify([s.stores.fuel, s.deliveries.map((d) => [d.eta, d.amount, d.state])]);
    };
    expect(run()).toBe(run());
  });
});
