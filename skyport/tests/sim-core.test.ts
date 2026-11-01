import { describe, expect, it } from 'vitest';

import { createGame, DT, eventsSince, queueCommand, runFor, stepGame, EVENT_TTL } from '../src/sim';

describe('simulation loop', () => {
  it('advances at a fixed 30 Hz step', () => {
    const s = createGame(1);
    runFor(s, 10);
    expect(s.tick).toBe(300);
    expect(s.time).toBeCloseTo(10, 9);
    expect(DT).toBeCloseTo(1 / 30, 12);
  });

  it('applies queued commands on the next step and emits events', () => {
    const s = createGame(1);
    queueCommand(s, { type: 'debugAddMoney', amount: 50 });
    expect(s.money.toNumber()).toBe(0);
    stepGame(s);
    expect(s.money.toNumber()).toBe(50);
    expect(eventsSince(s, 0).map((e) => e.kind)).toEqual(['moneyChanged']);
  });

  it('keeps events for two seconds', () => {
    const s = createGame(1);
    queueCommand(s, { type: 'debugAddMoney', amount: 1 });
    stepGame(s);
    const money = () => s.events.filter((e) => e.kind === 'moneyChanged').length;
    runFor(s, EVENT_TTL - 0.2);
    expect(money()).toBe(1);
    runFor(s, 0.5);
    expect(money()).toBe(0);
  });

  it('same seed and commands give the same game', () => {
    const play = () => {
      const s = createGame(77);
      for (let i = 0; i < 600; i++) {
        if (i % 97 === 0) queueCommand(s, { type: 'debugAddMoney', amount: i });
        stepGame(s);
      }
      return JSON.stringify(s);
    };
    expect(play()).toBe(play());
  });

  it('ignores invalid command values', () => {
    const s = createGame(1);
    queueCommand(s, { type: 'debugAddMoney', amount: NaN });
    stepGame(s);
    expect(s.money.toNumber()).toBe(0);
  });
});
