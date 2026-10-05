import { describe, expect, it } from 'vitest';
import { CUSTOMER_TYPES, PATIENCE_ICON } from '../src/data/customers';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { canBuy, upgradeDef } from '../src/sim/economy/upgrades';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, TableState, type Customer, type GameState } from '../src/sim/game/types';
import { PropKind } from '../src/sim/types';

function run(s: GameState, seconds: number, each?: () => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    each?.();
    stepGame(s, STEP_SEC);
  }
}

const seatEveryone = (s: GameState) => () => {
  for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
};

/** A diner where every table has its second chair, so couples come. */
function coupleFriendly(seed: number): GameState {
  return createGame(STAND_MAP, seed, { roster: ['cook', 'waiter', 'washer', 'waiter'], levels: { seats: 3, fries: 10 } });
}

describe('more chairs and couples', () => {
  it('buying chairs adds one opposite chair at the next table, up to one per table', () => {
    const s = createGame(STAND_MAP, 1);
    s.coins = big('1e9');
    const chairs = () => s.props.filter((p) => p.kind === PropKind.Chair && p.variant !== 2).length;
    expect(chairs()).toBe(3);
    for (let i = 0; i < 3; i++) expect(buyUpgrade(s, 'seats')).toBe(true);
    expect(chairs()).toBe(6);
    expect(s.tables.map((t) => t.seats)).toEqual([2, 2, 2]);
    // No single table left: the next chair needs a new table first.
    expect(canBuy(upgradeDef('seats'), s.levels, s.coins, s.map)).toBe(false);
    buyUpgrade(s, 'tables');
    expect(s.tables[3]!.seats).toBe(1);
    expect(buyUpgrade(s, 'seats')).toBe(true);
    expect(s.tables[3]!.seats).toBe(2);
  });

  it('no couples come while every table has one chair', () => {
    const s = createGame(STAND_MAP, 2);
    run(s, 240, seatEveryone(s));
    expect(s.customers.every((c) => c.partySize === 1)).toBe(true);
  });

  it('couples wait in line together, sit facing each other, both pay and leave together', () => {
    let pair: Customer[] = [];
    let s: GameState | null = null;
    for (let seed = 1; seed < 20 && pair.length === 0; seed++) {
      s = coupleFriendly(seed);
      for (let i = 0; i < 4000 && pair.length === 0; i++) {
        stepGame(s, STEP_SEC);
        const leader = s.customers.find((c) => c.partySize === 2 && c.party === c.id && c.state === CustomerState.Queued);
        const both = leader ? s.customers.filter((c) => c.party === leader.party) : [];
        if (both.length === 2 && both.every((c) => c.state === CustomerState.Queued && c.path.length === 0)) pair = both;
      }
    }
    expect(pair).toHaveLength(2);
    const g = s!;
    const earned = g.stats.served;
    queueCommand(g, { type: 'seat', customer: pair[1]!.id }); // tapping either one seats both
    run(g, 2);
    const table = g.tables[pair[0]!.table]!;
    expect(table.seats).toBe(2);
    expect(pair[0]!.table).toBe(pair[1]!.table);
    expect(new Set(pair.map((c) => c.seat))).toEqual(new Set([0, 1]));
    for (let i = 0; i < 3000 && !pair.every((c) => c.state === CustomerState.Leaving); i++) {
      for (const c of g.customers) if (c.state === CustomerState.Queued && c.partySize === 1) queueCommand(g, { type: 'seat', customer: c.id });
      stepGame(g, STEP_SEC);
      // Nobody leaves early: the first to pay waits for the other.
      if (pair.some((c) => c.state === CustomerState.Leaving)) expect(pair.every((c) => c.state === CustomerState.Leaving)).toBe(true);
    }
    expect(pair.every((c) => c.state === CustomerState.Leaving)).toBe(true);
    expect(g.stats.served - earned).toBeGreaterThanOrEqual(2);
    expect([TableState.Dirty, TableState.Cleaning, TableState.Free]).toContain(table.state);
  });

  it('a couple leaves two plates to clear, and the plate count never changes', () => {
    const s = coupleFriendly(5);
    const total = s.cleanPlates;
    let sawTwo = false;
    run(s, 400, () => {
      seatEveryone(s)();
      if (s.tables.some((t) => t.state === TableState.Dirty && t.plates === 2)) sawTwo = true;
    });
    expect(sawTwo).toBe(true);
    const onTables = s.tables.reduce((n, t) => n + (t.state === TableState.Dirty || t.state === TableState.Cleaning ? t.plates : t.dishes.filter((d) => d >= 0).length), 0);
    const inOrders = s.orders.filter((o) => o.state >= 2).length;
    const carried = s.staff.reduce((n, st) => n + (st.job?.kind === 'buss' && (st.job.phase === 'toSink' || st.job.phase === 'drop') ? (st.job.plates ?? 0) : 0), 0);
    expect(s.cleanPlates + s.dirtyPlates + onTables + inOrders + carried).toBe(total);
  });
});

describe('patience types', () => {
  it('everyone shows how patient they are: quick, normal or patient', () => {
    expect(PATIENCE_ICON[CUSTOMER_TYPES.rushed.patience]).toBe(PATIENCE_ICON.quick);
    expect(PATIENCE_ICON[CUSTOMER_TYPES.relaxed.patience]).toBe(PATIENCE_ICON.patient);
    expect(CUSTOMER_TYPES.relaxed.queuePatience).toBeGreaterThan(CUSTOMER_TYPES.regular.queuePatience);
    expect(CUSTOMER_TYPES.rushed.queuePatience).toBeLessThan(CUSTOMER_TYPES.regular.queuePatience);
  });

  it('relaxed customers only come once the place is known', () => {
    const s = createGame(STAND_MAP, 3, { roster: ['cook', 'waiter', 'washer'] });
    run(s, 120, seatEveryone(s));
    const early = new Set(s.customers.map((c) => c.type));
    expect(early.has('relaxed')).toBe(false);
    s.stats.served = 100;
    const seen = new Set<string>();
    run(s, 600, () => {
      seatEveryone(s)();
      for (const c of s.customers) seen.add(c.type);
    });
    expect(seen.has('relaxed')).toBe(true);
    const relaxed = s.customers.find((c) => c.type === 'relaxed');
    if (relaxed) expect(relaxed.patienceKind).toBe(PATIENCE_ICON.patient);
  });
});
