import { describe, expect, it } from 'vitest';

import { eventsSince, FUEL, queueCommand, REJECT, runFor, stepGame, WANT, wantsAction, type GameState } from '../src/sim';
import { newGame, play } from './helpers';

const ORDER = [
  'inbound',
  'holding',
  'final',
  'landing',
  'rollout',
  'taxiIn',
  'deboarding',
  'turnaround',
  'boarding',
  'doorsClosed',
  'taxiOut',
  'holdShort',
  'lineUp',
  'takeoff',
];

function isInOrder(seq: string[]): boolean {
  let k = -1;
  for (const p of seq) {
    const i = ORDER.indexOf(p);
    if (i <= k) return false;
    k = i;
  }
  return true;
}

/** Reads the phase without TypeScript narrowing it across steps. */
const phase = (f: { phase: string }): string => f.phase;

function firstFlight(s: GameState) {
  while (s.flights.length === 0) stepGame(s);
  return s.flights[0];
}

describe('flight lifecycle (dirt strip)', () => {
  it('a bot-played airfield serves flights through every phase, in order', () => {
    const s = newGame(1);
    const r = play(s, 600, 1);
    expect(s.stats.served).toBeGreaterThanOrEqual(8);
    expect(s.money.toNumber()).toBeGreaterThan(150);
    const complete = [...r.phases.values()].filter((p) => p.includes('takeoff'));
    expect(complete.length).toBeGreaterThanOrEqual(8);
    for (const p of r.phases.values()) expect(isInOrder(p), p.join('>')).toBe(true);
    for (const p of complete) {
      for (const must of ['final', 'landing', 'rollout', 'taxiIn', 'deboarding', 'turnaround', 'boarding', 'taxiOut', 'lineUp', 'takeoff']) {
        expect(p).toContain(must);
      }
    }
    expect(s.stats.diverted).toBe(0);
  });

  it('never has two flights on the runway', () => {
    for (const seed of [1, 2, 3]) {
      const r = play(newGame(seed), 900, 0.5, 1);
      expect(r.maxOnRunway).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same seed and inputs', () => {
    const a = newGame(42);
    const b = newGame(42);
    play(a, 300, 1);
    play(b, 300, 1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = newGame(43);
    play(c, 300, 1);
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it('without a player, planes circle, lose patience and divert', () => {
    const s = newGame(5);
    const r = play(s, 240, null);
    const seqs = [...r.phases.values()];
    expect(seqs.some((p) => p.includes('holding'))).toBe(true);
    expect(s.stats.diverted).toBeGreaterThan(0);
    expect(s.stats.served).toBe(0);
    expect(s.money.toNumber()).toBe(0);
    expect(s.stands.every((st) => st.reserved === 0 && st.occupant === 0)).toBe(true);
    expect(s.rating).toBeLessThan(3);
    // passengers of diverted flights went home
    runFor(s, 30);
    const alive = new Set(s.flights.map((f) => f.id));
    for (const p of s.people) expect(alive.has(p.flight)).toBe(true);
  });

  it('a holding plane lands once cleared', () => {
    const s = newGame(9);
    const f = firstFlight(s);
    while (phase(f) !== 'holding') stepGame(s);
    const patienceBefore = f.patience;
    runFor(s, 5);
    expect(f.patience).toBeLessThan(patienceBefore);
    queueCommand(s, { type: 'clearLanding', flightId: f.id });
    stepGame(s);
    expect(f.landCleared).toBe(true);
    expect(s.stands[0].reserved).toBe(f.id);
    for (let i = 0; i < 30 * 60 && phase(f) !== 'deboarding'; i++) stepGame(s);
    expect(phase(f)).toBe('deboarding');
    expect(s.stands[0].occupant).toBe(f.id);
    expect(wantsAction(f, WANT.fuel)).toBe(true);
    expect(wantsAction(f, WANT.bags)).toBe(true);
  });

  it('rejects landing when no stand is free', () => {
    const s = newGame(3);
    const f = firstFlight(s);
    s.stands[0].occupant = 999;
    queueCommand(s, { type: 'clearLanding', flightId: f.id });
    stepGame(s);
    const rej = eventsSince(s, 0).filter((e) => e.kind === 'cmdRejected');
    expect(rej.length).toBe(1);
    expect(rej[0].a).toBe(REJECT.noStand);
    expect(f.landCleared).toBe(false);
  });

  it('turnaround dependencies: no boarding before fuel, fuel only once', () => {
    const s = newGame(4);
    const f = firstFlight(s);
    queueCommand(s, { type: 'clearLanding', flightId: f.id });
    while (phase(f) !== 'deboarding') stepGame(s);
    queueCommand(s, { type: 'startBoarding', flightId: f.id });
    stepGame(s);
    expect(eventsSince(s, 0).some((e) => e.kind === 'cmdRejected' && e.a === REJECT.notReady)).toBe(true);
    expect(f.boardingStarted).toBe(false);
    queueCommand(s, { type: 'sendFuel', flightId: f.id });
    stepGame(s);
    expect(f.fuelState).not.toBe(FUEL.none);
    const before = s.nextEventId;
    queueCommand(s, { type: 'sendFuel', flightId: f.id });
    stepGame(s);
    expect(s.events.some((e) => e.id >= before && e.kind === 'cmdRejected')).toBe(true);
    for (let i = 0; i < 30 * 60 && f.fuelState !== FUEL.done; i++) stepGame(s);
    expect(f.fuelState).toBe(FUEL.done);
    expect(f.fuel).toBeCloseTo(f.fuelNeed, 5);
    while (phase(f) !== 'turnaround') stepGame(s);
    stepGame(s);
    expect(wantsAction(f, WANT.board)).toBe(true);
    queueCommand(s, { type: 'startBoarding', flightId: f.id });
    for (let i = 0; i < 30 * 60 && phase(f) === 'turnaround'; i++) stepGame(s);
    expect(phase(f)).toBe('boarding');
    // doors stay open until the bags are loaded
    for (let i = 0; i < 30 * 20; i++) stepGame(s);
    expect(f.boarded).toBe(f.paxOut);
    expect(phase(f)).toBe('boarding');
    queueCommand(s, { type: 'sendBags', flightId: f.id });
    for (let i = 0; i < 30 * 60 && phase(f) === 'boarding'; i++) stepGame(s);
    expect(f.bagState).toBe(FUEL.done);
    expect(['doorsClosed', 'taxiOut']).toContain(phase(f));
  });

  it('fast service pays more than slow service', () => {
    const fast = newGame(12);
    const slow = newGame(12);
    play(fast, 900, 0.5);
    play(slow, 900, 9);
    expect(fast.stats.onTime).toBeGreaterThan(0);
    expect(slow.stats.late).toBeGreaterThan(0);
    expect(fast.money.toNumber() / Math.max(1, fast.stats.served)).toBeGreaterThan(slow.money.toNumber() / Math.max(1, slow.stats.served));
    expect(fast.rating).toBeGreaterThan(slow.rating);
  });

  it('pays at liftoff with a paid event', () => {
    const s = newGame(6);
    let paid = 0;
    let last = 0;
    for (let i = 0; i < 30 * 300 && paid === 0; i++) {
      if (i % 3 === 0) {
        for (const f of s.flights) {
          const map = {
            [WANT.clearLanding]: 'clearLanding',
            [WANT.fuel]: 'sendFuel',
            [WANT.board]: 'startBoarding',
            [WANT.clearTakeoff]: 'clearTakeoff',
            [WANT.bags]: 'sendBags',
          } as const;
          const t = map[f.want as 1 | 2 | 3 | 4 | 5];
          if (t) queueCommand(s, { type: t, flightId: f.id });
        }
      }
      stepGame(s);
      for (const e of eventsSince(s, last)) {
        last = e.id;
        if (e.kind === 'paid') paid = e.a * Math.pow(10, e.b);
      }
    }
    expect(paid).toBeGreaterThan(10);
    expect(s.money.toNumber()).toBeCloseTo(paid, 6);
  });
});

describe('soak', () => {
  it('runs two hours of play without stalling or leaking entities', () => {
    const s = newGame(2026);
    const r = play(s, 7200, 1.5, 5);
    // the starter airline flies 10 a day: 12 game days = 120 planned flights; crosswind may hold one back
    expect(s.stats.served).toBeGreaterThanOrEqual(114);
    expect(r.maxFlights).toBeLessThanOrEqual(6);
    expect(r.maxPeople).toBeLessThan(60);
    expect(s.events.length).toBeLessThan(200);
    expect(s.fuelQueue.length).toBeLessThanOrEqual(1);
    // the airfield keeps flowing until the end
    const servedBefore = s.stats.served;
    play(s, 300, 1.5, 5);
    expect(s.stats.served).toBeGreaterThan(servedBefore + 3);
  });
});
