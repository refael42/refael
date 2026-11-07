import { describe, expect, it } from 'vitest';

import { UPGRADES, upgradeDef } from '../src/data/upgrades';
import {
  affordableCount,
  applyOffline,
  Big,
  botBuys,
  botCommands,
  botHires,
  bulkCost,
  createGame,
  effects,
  eventsSince,
  incomeRate,
  level,
  parseSave,
  queueCommand,
  REJECT,
  runFor,
  SAVE_VERSION,
  serializeGame,
  stepGame,
  unitCost,
  type GameState,
} from '../src/sim';

function rich(seed = 1, coins = 1e6): GameState {
  const s = createGame(seed);
  s.money = Big.fromNumber(coins);
  return s;
}

function buy(s: GameState, id: string, count: number) {
  queueCommand(s, { type: 'buyUpgrade', id, count });
  stepGame(s);
}

function play(s: GameState, minutes: number) {
  for (let i = 0; i < minutes * 1800; i++) {
    if (i % 4 === 0) for (const c of botCommands(s, { reaction: 1 })) queueCommand(s, c);
    if (i % 150 === 0) for (const c of [...botHires(s), ...botBuys(s)]) queueCommand(s, c);
    stepGame(s);
  }
}

describe('upgrade costs', () => {
  it('bulk cost equals the sum of single levels', () => {
    const s = createGame(1);
    for (const def of UPGRADES) {
      let sum = Big.ZERO;
      for (let i = 0; i < 7 && i < def.maxLevel; i++) sum = sum.add(unitCost(s, def, 3 + i));
      const n = Math.min(7, def.maxLevel);
      const bulk = bulkCost(s, def, 3, n);
      expect(Math.abs(bulk.toNumber() - sum.toNumber()) / sum.toNumber()).toBeLessThan(1e-9);
    }
  });

  it('prices are whole coins', () => {
    const s = createGame(1);
    for (const def of UPGRADES) for (let l = 0; l < Math.min(30, def.maxLevel); l++) {
      const c = unitCost(s, def, l).toNumber();
      expect(Number.isInteger(c)).toBe(true);
    }
  });

  it('x1 / x10 / MAX buy the right number of levels and never overspend', () => {
    const s = rich(1, 5000);
    // (a manager level far from the next: no level-up coins in the sums below)
    s.career.level = 500;
    buy(s, 'ticket', 1);
    expect(level(s, 'ticket')).toBe(1);
    buy(s, 'ticket', 10);
    expect(level(s, 'ticket')).toBe(11);
    const def = upgradeDef('ticket')!;
    const n = affordableCount(s, def);
    const before = s.money;
    buy(s, 'ticket', -1);
    expect(level(s, 'ticket')).toBe(11 + n);
    expect(s.money.gte(0)).toBe(true);
    expect(before.sub(s.money).eq(bulkCost(s, def, 11, n))).toBe(true);
    // the next level is no longer affordable
    expect(s.money.lt(unitCost(s, def, 11 + n))).toBe(true);
  });

  it('caps at the max level and refuses without money', () => {
    const s = rich(1, 1e30);
    buy(s, 'benches', 1000);
    expect(level(s, 'benches')).toBe(upgradeDef('benches')!.maxLevel);
    buy(s, 'benches', 1);
    expect(eventsSince(s, 0).some((e) => e.kind === 'cmdRejected' && e.a === REJECT.limit)).toBe(true);
    const poor = createGame(2);
    buy(poor, 'ticket', 1);
    expect(level(poor, 'ticket')).toBe(0);
    expect(eventsSince(poor, 0).some((e) => e.kind === 'cmdRejected' && e.a === REJECT.noMoney)).toBe(true);
  });

  it('milestones double a line at level 10', () => {
    const s = rich();
    buy(s, 'ticket', 9);
    const at9 = effects(s).paxFee;
    buy(s, 'ticket', 1);
    const at10 = effects(s).paxFee;
    expect(at9).toBeCloseTo(1 + 0.25 * 9, 9);
    expect(at10).toBeCloseTo(1 + 0.25 * 10 * 2, 9);
    expect(eventsSince(s, 0).some((e) => e.kind === 'milestone' && e.a === 10)).toBe(true);
  });
});

describe('construction', () => {
  it('a new stand takes build time, one crew at a time, taps speed it up', () => {
    const s = rich();
    expect(s.standsBuilt).toBe(1);
    buy(s, 'stand', 1);
    expect(s.builds.length).toBe(1);
    expect(s.standsBuilt).toBe(1);
    buy(s, 'truck2', 1);
    expect(s.builds.length).toBe(1); // crew busy
    const left = s.builds[0].remaining;
    queueCommand(s, { type: 'rushBuild' });
    stepGame(s);
    expect(s.builds[0].remaining).toBeLessThan(left - 1);
    runFor(s, s.builds[0].remaining + 0.2);
    expect(s.builds.length).toBe(0);
    expect(s.standsBuilt).toBe(2);
    expect(eventsSince(s, 0).some((e) => e.kind === 'buildDone')).toBe(true);
  });

  it('second vehicles appear when built', () => {
    const s = rich();
    buy(s, 'truck2', 1);
    runFor(s, 31);
    expect(s.vehicles.filter((v) => v.kind === 'fuel').length).toBe(2);
  });
});

describe('effects reach the game', () => {
  it('ticket counter levels raise what a flight pays', () => {
    const a = createGame(30);
    const b = createGame(30);
    b.upg.ticket = 20;
    b.upg.landing = 20;
    b.upgRev++;
    for (const s of [a, b]) {
      for (let i = 0; i < 30 * 600; i++) {
        if (i % 3 === 0) for (const c of botCommands(s, { reaction: 1 })) queueCommand(s, c);
        stepGame(s);
      }
    }
    const perA = a.stats.earned.toNumber() / a.stats.served;
    const perB = b.stats.earned.toNumber() / b.stats.served;
    expect(perB).toBeGreaterThan(perA * 4);
    expect(incomeRate(b)).toBeGreaterThan(incomeRate(a));
  });
});

describe('save and load', () => {
  it('round-trips the durable state', () => {
    const s = createGame(77);
    play(s, 12);
    const text = serializeGame(s, 1_000_000);
    const r = parseSave(text, 1_000_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.state;
    expect(t.money.eq(s.money)).toBe(true);
    expect(t.upg).toEqual(s.upg);
    expect(t.staff.map((m) => m.id)).toEqual(s.staff.map((m) => m.id));
    expect(t.stats.served).toBe(s.stats.served);
    expect(t.tick).toBe(s.tick);
    expect(t.standsBuilt).toBe(s.standsBuilt);
    expect(t.flights.length).toBe(0);
    // the loaded game keeps running
    play(t, 3);
    expect(t.stats.served).toBeGreaterThan(s.stats.served);
  });

  it('never trusts the file: garbage is clamped and the game still runs', () => {
    const evil = {
      v: SAVE_VERSION,
      savedAt: 'yesterday',
      game: {
        seed: -5,
        tick: 1e99,
        money: { m: -3, e: 5 },
        diamonds: 'lots',
        rating: 99,
        upg: { ticket: 9999, landing: -4, nope: 3, stand: 1.7 },
        builds: [{ id: 'stand', level: 9, remaining: -10 }, { id: 'ticket', level: 2 }],
        staff: [
          { id: 7, role: 0, first: 999, last: -1, speed: 50, wage: 1e9 },
          { id: 7, role: 0 },
          { id: 8, role: 42 },
        ],
        applicants: 'none',
        stats: { served: -1, earned: 'x' },
        income: { hist: [1, NaN, 3], histComp: [[1, 2]] },
        nextId: -100,
      },
    };
    const r = parseSave(JSON.stringify(evil), 5000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.state;
    expect(s.money.isZero()).toBe(true);
    expect(s.rating).toBe(5);
    expect(s.upg.ticket).toBe(100);
    expect(s.upg.landing).toBeUndefined();
    expect(s.upg.stand).toBe(2);
    expect(s.standsBuilt).toBe(3);
    expect(s.builds.length).toBe(0);
    expect(s.staff.length).toBe(1);
    expect(s.staff[0].speed).toBe(1.3);
    expect(s.applicants.length).toBeGreaterThan(0);
    expect(s.stats.served).toBe(0);
    expect(new Set([...s.staff.map((m) => m.id), ...s.applicants.map((a) => a.id)]).size).toBe(s.staff.length + s.applicants.length);
    runFor(s, 120);
    expect(Number.isFinite(s.money.toNumber())).toBe(true);
  });

  it('refuses saves from a newer version and broken files', () => {
    expect(parseSave(JSON.stringify({ v: SAVE_VERSION + 1, savedAt: 0, game: {} }), 0)).toEqual({ ok: false, reason: 'future' });
    expect(parseSave('{not json', 0)).toEqual({ ok: false, reason: 'corrupt' });
    expect(parseSave(null, 0)).toEqual({ ok: false, reason: 'empty' });
  });

  it('migrates a version-1 save', () => {
    const r = parseSave(JSON.stringify({ v: 1, savedAt: 0, game: { seed: 3, tick: 900, money: [5, 2] } }), 0);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.money.toNumber()).toBe(500);
  });
});

describe('offline earnings', () => {
  it('pays for time away, with a floor, scaled by staff, up to the cap', () => {
    const s = createGame(4);
    const fresh = applyOffline(s, 3600);
    expect(fresh.amount.toNumber()).toBeGreaterThan(0); // floor even with no history
    const t = createGame(5);
    play(t, 20);
    const before = t.money;
    const r = applyOffline(t, 3600);
    expect(r.amount.toNumber()).toBeGreaterThan(fresh.amount.toNumber());
    expect(t.money.sub(before).eq(r.amount)).toBe(true);
    const capped = applyOffline(createGame(6), 1e7);
    expect(capped.capped).toBe(true);
    expect(capped.seconds).toBe(effects(createGame(6)).offlineCapHours * 3600);
  });

  it('a clock that went backwards gives nothing', () => {
    const s = createGame(1);
    const r = parseSave(serializeGame(s, 10_000), 5_000);
    expect(r.ok && r.awaySeconds).toBe(0);
  });

  it('construction continues while away', () => {
    const s = rich();
    buy(s, 'stand', 1);
    applyOffline(s, 600);
    stepGame(s);
    expect(s.standsBuilt).toBe(2);
  });
});
