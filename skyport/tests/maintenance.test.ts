import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { AIRLINES } from '../src/data/airlines';
import { applyStructural, Big, botCommands, createGame, layoutOf, makeOffer, queueCommand, signOffer, stepGame, switchTier, WANT, type Flight, type GameState } from '../src/sim';
import { hangarBays } from '../src/sim/game/maintenance';
import { AOG_CHANCE, faultFactor, groundPlane, spawnFlight, wantsAction } from '../src/sim/game/flights';

function regional(seed: number): GameState {
  const s = createGame(seed);
  switchTier(s, 3);
  stockUp(s);
  s.money = Big.fromNumber(1e9);
  return s;
}

/** A plane parked at stand 0 with its passengers off. */
function parked(s: GameState): Flight {
  const f = spawnFlight(s)!;
  f.phase = 'turnaround';
  f.stand = 0;
  s.stands[0].occupant = f.id;
  f.x = 22;
  f.y = 21.9;
  f.fuelState = 4;
  f.fuel = f.fuelNeed;
  return f;
}

function runUntil(s: GameState, ok: () => boolean, seconds: number): boolean {
  for (let i = 0; i < seconds * 30; i++) {
    if (ok()) return true;
    stepGame(s);
  }
  return ok();
}

describe('technical faults (AOG)', () => {
  it('a grounded plane cannot board until a mechanic has fixed it, with spare parts from the store', () => {
    const s = regional(1);
    const f = parked(s);
    groundPlane(s, f);
    stepGame(s);
    expect(f.aog).toBe(1);
    expect(wantsAction(f, WANT.repair)).toBe(true);
    expect(wantsAction(f, WANT.board)).toBe(false);
    queueCommand(s, { type: 'startBoarding', flightId: f.id });
    stepGame(s);
    expect(f.phase).toBe('turnaround');
    const parts = s.stores.parts.stock;
    const need = f.repParts;
    queueCommand(s, { type: 'repair', flightId: f.id });
    expect(runUntil(s, () => f.repState === 3, 120)).toBe(true);
    const van = s.vehicles.find((v) => v.kind === 'mech' && v.flight === f.id)!;
    expect(Math.hypot(van.x - f.x, van.y - f.y)).toBeLessThan(3);
    expect(runUntil(s, () => f.aog === 2, f.repNeed + 10)).toBe(true);
    expect(parts - s.stores.parts.stock).toBe(need);
    stepGame(s);
    expect(wantsAction(f, WANT.board)).toBe(true);
  });

  it('with the parts store empty the mechanic waits for the delivery', () => {
    const s = regional(2);
    const f = parked(s);
    groundPlane(s, f);
    s.stores.parts.stock = 0;
    s.stores.parts.supplier = 0;
    queueCommand(s, { type: 'repair', flightId: f.id });
    runUntil(s, () => f.partWait, 120);
    expect(f.partWait).toBe(true);
    for (let i = 0; i < 30 * 10; i++) stepGame(s);
    expect(f.aog).toBe(1);
    expect(f.repWork).toBe(0);
    // the delivery comes in
    s.stores.parts.stock = 4;
    expect(runUntil(s, () => f.aog === 2, 120)).toBe(true);
  });

  it('a hired mechanic sends the van by himself', () => {
    const s = regional(3);
    const a = s.applicants.find((x) => x.role === 4) ?? null;
    expect(a).not.toBeNull();
    queueCommand(s, { type: 'hire', applicantId: a!.id });
    stepGame(s);
    expect(s.staff.some((m) => m.role === 4)).toBe(true);
    const f = parked(s);
    groundPlane(s, f);
    expect(runUntil(s, () => f.aog === 2, 200)).toBe(true);
  });

  it('only from the regional airport on: smaller fields have no van and no faults', () => {
    const s = createGame(4);
    switchTier(s, 2);
    expect(s.vehicles.some((v) => v.kind === 'mech')).toBe(false);
    let faults = 0;
    for (let i = 0; i < 30 * 1800; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.5 })) queueCommand(s, c);
      stepGame(s);
      for (const f of s.flights) if (f.aog) faults++;
    }
    expect(faults).toBe(0);
  });

  it('about one arrival in twenty has a fault, and every one gets fixed and flies on', () => {
    // (three games, so the share is measured over a few hundred arrivals, not a lucky hundred)
    let seenAll = 0;
    let fixedAll = 0;
    let openAll = 0;
    let dockedAll = 0;
    for (const seed of [5, 6, 7]) {
      const s = regional(seed);
      s.upg.stand = 4;
      s.upg.standMed = 2;
      s.upgRev++;
      const seen = new Set<number>();
      const fixed = new Set<number>();
      let last = 0;
      for (let i = 0; i < 30 * 3600 * 2; i++) {
        if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.5 })) queueCommand(s, c);
        stepGame(s);
        for (const e of s.events) {
          if (e.id <= last) continue;
          last = e.id;
          if (e.kind === 'docked') dockedAll++;
          // (walk-around faults only: a bird strike grounds the plane too, but that is the birds)
          if (e.kind === 'aog' && !s.flights.find((f) => f.id === e.a)?.birdHit) seen.add(e.a);
          if (e.kind === 'repairDone') fixed.add(e.a);
        }
      }
      seenAll += seen.size;
      fixedAll += fixed.size;
      // all but the ones still being repaired right now
      openAll += s.flights.filter((f) => f.aog === 1).length;
    }
    const rate = seenAll / Math.max(1, dockedAll);
    expect(rate).toBeGreaterThan(AOG_CHANCE * 0.4);
    expect(rate).toBeLessThan(AOG_CHANCE * 2);
    expect(fixedAll).toBeGreaterThanOrEqual(seenAll - openAll);
  }, 240000);
});

describe('the hangar', () => {
  function withHangar(seed: number, bays = 1): GameState {
    const s = regional(seed);
    if (bays > 1) switchTier(s, 4);
    stockUp(s);
    s.upg.hangar = bays;
    s.upgRev++;
    applyStructural(s);
    s.money = Big.fromNumber(1e9);
    // an airline whose small planes fit the bay
    const o = makeOffer(s, AIRLINES.findIndex((a) => a.id === 'meadowlark'));
    s.offers.push(o);
    signOffer(s, o.id);
    return s;
  }

  it('no checks without a hangar; with one, airlines send planes in and pay for the work', () => {
    const none = regional(10);
    none.nextCheckAt = 0;
    for (let i = 0; i < 30 * 600; i++) stepGame(none);
    expect(none.flights.some((f) => f.check > 0)).toBe(false);

    const s = withHangar(11);
    s.nextCheckAt = 0;
    stepGame(s);
    const f = s.flights.find((x) => x.check > 0)!;
    expect(f).toBeDefined();
    const bay = layoutOf(s.tier).stands[f.stand];
    expect(bay.hangar).toBe(true);
    expect(f.paxIn + f.paxOut).toBe(0);
    const money = s.money.toNumber();
    let fee = 0;
    let last = 0;
    let steps = 0;
    while (f.aog !== 2 && steps < 30 * 900) {
      if (steps % 3 === 0) for (const c of botCommands(s, { reaction: 0.5 })) queueCommand(s, c);
      stepGame(s);
      steps++;
      for (const e of s.events) {
        if (e.id <= last) continue;
        last = e.id;
        if (e.kind === 'checkDone' && e.a === f.id) fee = e.b;
      }
    }
    expect(f.aog).toBe(2);
    expect(fee).toBeGreaterThan(0);
    expect(s.money.toNumber()).toBeGreaterThan(money);
    expect(s.stats.checks).toBe(1);
    // and it flies off again
    let gone = false;
    for (let i = 0; i < 30 * 600 && !gone; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.5 })) queueCommand(s, c);
      stepGame(s);
      gone = !s.flights.includes(f) || f.phase === 'takeoff';
    }
    expect(gone).toBe(true);
  }, 60000);

  it('regular flights never park in a hangar bay', () => {
    const s = withHangar(12);
    s.nextCheckAt = 1e9;
    const bays = layoutOf(s.tier)
      .stands.map((st, i) => (st.hangar ? i : -1))
      .filter((i) => i >= 0);
    for (let i = 0; i < 30 * 1800; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.5 })) queueCommand(s, c);
      stepGame(s);
      for (const b of bays) expect(s.stands[b].occupant || s.stands[b].reserved).toBe(0);
    }
  }, 60000);

  it('a hangar makes faults at the stands rarer', () => {
    const s = regional(13);
    const before = faultFactor(s);
    s.upg.hangar = 1;
    s.upgRev++;
    expect(faultFactor(s)).toBeLessThan(before);
  });

  it('two bays at the city airport: two checks at once', () => {
    const s = withHangar(14, 2);
    expect(hangarBays(s).length).toBe(2);
    // one ferry flight on its way at a time: the second asks once the first is in its bay
    s.nextCheckAt = 0;
    stepGame(s);
    const first = s.flights.find((f) => f.check > 0)!;
    s.nextCheckAt = 0;
    stepGame(s);
    expect(s.flights.filter((f) => f.check > 0).length).toBe(1);
    for (let i = 0; i < 30 * 600 && first.dockedAt === 0; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.5 })) queueCommand(s, c);
      stepGame(s);
    }
    expect(first.dockedAt).toBeGreaterThan(0);
    for (let i = 0; i < 30 * 120 && s.flights.filter((f) => f.check > 0).length < 2; i++) {
      s.nextCheckAt = Math.min(s.nextCheckAt, s.time);
      stepGame(s);
    }
    expect(s.flights.filter((f) => f.check > 0).length).toBe(2);
    let most = 0;
    for (let i = 0; i < 30 * 900; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.5 })) queueCommand(s, c);
      stepGame(s);
      most = Math.max(most, s.flights.filter((f) => f.check > 0 && f.aog === 1 && f.dockedAt > 0).length);
    }
    expect(most).toBe(2);
  }, 120000);
});
