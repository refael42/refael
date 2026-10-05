import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { KITCHEN } from '../src/data/staff';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { gameSnapshot, stepGame } from '../src/sim/game/step';
import { CustomerState, OrderState, TableState, type GameState } from '../src/sim/game/types';
import { Bubble, PropKind } from '../src/sim/types';
import { P, STRIDE, F } from '../src/sim/snapshot';

function step(s: GameState, seconds: number, each?: () => void) {
  for (let i = 0; i < Math.round(seconds / STEP_SEC); i++) {
    each?.();
    stepGame(s, STEP_SEC);
  }
}

/** Seat everyone in line: the only job this test leaves to the player. */
const seatAll = (s: GameState) => () => {
  for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
};

/** Every plate is somewhere: clean, dirty, on the pass, in a hand, or on a table. */
function platesAccounted(s: GameState): number {
  const inOrders = s.orders.filter((o) => o.state === OrderState.Plating || o.state === OrderState.Ready || o.state === OrderState.Flying || o.state === OrderState.Carried).length;
  const onTables = s.tables.filter((t) => (t.state === TableState.Occupied && t.dish >= 0) || t.state === TableState.Dirty || (t.state === TableState.Cleaning && t.waiter < 0)).length;
  const inHands = s.staff.filter((st) => st.job?.kind === 'buss' && (st.job.phase === 'toSink' || st.job.phase === 'drop' || st.job.phase === 'wipe')).length;
  return s.cleanPlates + s.dirtyPlates + inOrders + onTables + inHands;
}

describe('staff automate the restaurant', () => {
  it('waiter delivers and buses, dishwasher washes: customers pay with only seating taps', () => {
    const s = createGame(STAND_MAP, 11);
    step(s, 240, seatAll(s));
    expect(s.stats.served).toBeGreaterThan(8);
    expect(s.coins.gt(0)).toBe(true);
  });

  it('never creates or loses plates', () => {
    const s = createGame(STAND_MAP, 5);
    for (let i = 0; i < 6000; i++) {
      seatAll(s)();
      stepGame(s, STEP_SEC);
      expect(platesAccounted(s)).toBe(KITCHEN.plates);
    }
  });
});

describe('the clean-dishes bottleneck', () => {
  it('without a dishwasher the cook runs out of plates and says so', () => {
    const s = createGame(STAND_MAP, 9, ['cook', 'waiter']);
    for (let i = 0; i < Math.round(400 / STEP_SEC) && !s.staff.some((st) => st.stalled === 'plates'); i++) {
      seatAll(s)();
      stepGame(s, STEP_SEC);
    }
    expect(s.staff.some((st) => st.stalled === 'plates')).toBe(true);
    expect(s.cleanPlates).toBe(0);
    const snap = gameSnapshot(s, 1);
    let warned = false;
    for (let i = 0; i < snap.count; i++) {
      const o = i * STRIDE;
      if (snap.data[o + P.kind] === PropKind.PlatesClean && snap.data[o + P.bubble] === Bubble.NoPlates) warned = true;
    }
    expect(warned).toBe(true);
  });

  it('the manager can wash by hand by tapping the sink', () => {
    const s = createGame(STAND_MAP, 9, ['cook']);
    s.cleanPlates = 0;
    s.dirtyPlates = 2;
    for (let i = 0; i < 3; i++) queueCommand(s, { type: 'wash' });
    stepGame(s, STEP_SEC);
    expect(s.cleanPlates).toBe(1);
    expect(s.dirtyPlates).toBe(1);
  });
});

describe('order tickets', () => {
  it('queued orders hang on the rail', () => {
    const s = createGame(STAND_MAP, 13, ['waiter']);
    step(s, 60, seatAll(s));
    const snap = gameSnapshot(s, 1);
    let tickets = 0;
    for (let i = 0; i < snap.count; i++) if (snap.data[i * STRIDE + P.kind] === PropKind.Ticket && snap.data[i * STRIDE + F.type] === 2) tickets++;
    const waiting = s.orders.filter((o) => o.state === OrderState.Queued || o.state === OrderState.Cooking).length;
    expect(tickets).toBe(Math.min(waiting, STAND_MAP.ticketRail.max));
    expect(waiting).toBeGreaterThan(0);
  });
});
