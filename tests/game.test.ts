import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { queueCommand, tapTargets } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { gameSnapshot, stepGame } from '../src/sim/game/step';
import { CustomerState, OrderState, TableState, type GameState } from '../src/sim/game/types';

function runFor(s: GameState, seconds: number) {
  const steps = Math.round(seconds / STEP_SEC);
  for (let i = 0; i < steps; i++) stepGame(s, STEP_SEC);
}

/** Steps until a condition holds (or fails the test after `limit` seconds). */
function runUntil(s: GameState, done: () => boolean, limit = 120) {
  const steps = Math.round(limit / STEP_SEC);
  for (let i = 0; i < steps; i++) {
    if (done()) return;
    stepGame(s, STEP_SEC);
  }
  throw new Error(`Condition not reached within ${limit}s`);
}

function tapCustomer(s: GameState, id: number) {
  queueCommand(s, { type: 'seat', customer: id });
}

function tapReadyDish(s: GameState) {
  const o = s.orders.find((x) => x.state === OrderState.Ready)!;
  queueCommand(s, { type: 'serve', order: o.id });
}

function tapTable(s: GameState, index: number) {
  queueCommand(s, { type: 'clean', table: index });
}

describe('customer lifecycle (manager taps)', () => {
  it('arrive -> seat -> order -> cook -> serve -> eat -> pay -> leave -> clean', () => {
    const s = createGame(STAND_MAP, 7);
    runUntil(s, () => s.customers.some((c) => c.state === CustomerState.Queued), 20);
    const customer = s.customers.find((c) => c.state === CustomerState.Queued)!;
    const id = customer.id;

    expect(tapTargets(s).some((t) => t.command.type === 'seat' && t.command.customer === id)).toBe(true);
    tapCustomer(s, id);
    stepGame(s, STEP_SEC);
    expect(customer.state).toBe(CustomerState.ToTable);
    const table = s.tables[customer.table]!;
    expect(table.state).toBe(TableState.Reserved);

    runUntil(s, () => customer.state === CustomerState.Waiting);
    expect(customer.bubble).toBeGreaterThanOrEqual(10); // dish bubble

    runUntil(s, () => s.orders.some((o) => o.customer === id && o.state === OrderState.Ready));
    expect(s.events.some((e) => e.type === Ev.Ding)).toBe(true);

    tapReadyDish(s);
    stepGame(s, STEP_SEC);
    expect(s.events.some((e) => e.type === Ev.DishFly)).toBe(true);

    runUntil(s, () => customer.state === CustomerState.Eating, 5);
    expect(table.state).toBe(TableState.Occupied);
    expect(table.dish).toBe(customer.dish);

    const before = s.coins;
    runUntil(s, () => customer.state === CustomerState.Paying, 15);
    expect(s.coins.gt(before)).toBe(true);
    expect(s.events.some((e) => e.type === Ev.Coins)).toBe(true);

    runUntil(s, () => table.state === TableState.Dirty, 5);
    expect(tapTargets(s).some((t) => t.command.type === 'clean')).toBe(true);
    tapTable(s, table.index);
    runUntil(s, () => table.state === TableState.Free, 5);
    expect(s.events.some((e) => e.type === Ev.Burst)).toBe(true);
    expect(s.stats.served).toBe(1);

    runUntil(s, () => !s.customers.some((c) => c.id === id), 30);
  });

  it('extra taps speed up cleaning', () => {
    const slow = createGame(STAND_MAP, 1);
    const fast = createGame(STAND_MAP, 1);
    for (const s of [slow, fast]) {
      s.tables[0]!.state = TableState.Dirty;
      tapTable(s, 0);
      stepGame(s, STEP_SEC);
    }
    tapTable(fast, 0);
    tapTable(fast, 0);
    stepGame(slow, STEP_SEC);
    stepGame(fast, STEP_SEC);
    expect(fast.tables[0]!.progress).toBeGreaterThan(slow.tables[0]!.progress + 0.5);
  });
});

describe('impatience', () => {
  it('ignored customers walk out, costing rating and no money', () => {
    const s = createGame(STAND_MAP, 3);
    const startRating = s.rating;
    runFor(s, 90);
    expect(s.stats.walkouts).toBeGreaterThan(0);
    expect(s.rating).toBeLessThan(startRating);
    expect(s.coins.eq(0)).toBe(true);
  });

  it('never queues more people than there are spots', () => {
    const s = createGame(STAND_MAP, 11);
    for (let i = 0; i < 2400; i++) {
      stepGame(s, STEP_SEC);
      const inLine = s.customers.filter((c) => c.queueSlot >= 0).length;
      expect(inLine).toBeLessThanOrEqual(STAND_MAP.queue.length);
    }
  });
});

describe('kitchen', () => {
  it('a full pass stalls the cook until a dish is served', () => {
    const s = createGame(STAND_MAP, 5);
    // Seat everyone who shows up, never serve.
    for (let i = 0; i < 6000; i++) {
      for (const c of s.customers) if (c.state === CustomerState.Queued) tapCustomer(s, c.id);
      stepGame(s, STEP_SEC);
      const ready = s.orders.filter((o) => o.state === OrderState.Ready).length;
      expect(ready).toBeLessThanOrEqual(STAND_MAP.passSlots.length);
    }
  });
});

describe('determinism', () => {
  it('same seed and same taps give the same restaurant', () => {
    const play = () => {
      const s = createGame(STAND_MAP, 42);
      for (let i = 0; i < 3000; i++) {
        if (i % 40 === 0) {
          for (const c of s.customers) if (c.state === CustomerState.Queued) tapCustomer(s, c.id);
          for (const o of s.orders) if (o.state === OrderState.Ready) tapReadyDish(s);
          for (const t of s.tables) if (t.state === TableState.Dirty) tapTable(s, t.index);
        }
        stepGame(s, STEP_SEC);
      }
      return s;
    };
    const a = play();
    const b = play();
    expect(a.coins.eq(b.coins)).toBe(true);
    expect(gameSnapshot(a, 1).data).toEqual(gameSnapshot(b, 1).data);
    expect(a.stats.served).toBeGreaterThan(3);
  });
});

describe('combo', () => {
  it('quick consecutive payments build a combo', () => {
    const s = createGame(STAND_MAP, 42);
    let best = 0;
    for (let i = 0; i < 8000; i++) {
      if (i % 10 === 0) {
        for (const c of s.customers) if (c.state === CustomerState.Queued) tapCustomer(s, c.id);
        for (const o of s.orders) if (o.state === OrderState.Ready) tapReadyDish(s);
        for (const t of s.tables) if (t.state === TableState.Dirty) tapTable(s, t.index);
      }
      stepGame(s, STEP_SEC);
      best = Math.max(best, s.combo);
    }
    expect(best).toBeGreaterThanOrEqual(2);
  });
});
