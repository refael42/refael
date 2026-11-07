import { describe, expect, it } from 'vitest';

import { tierDef } from '../src/data/tiers';
import { createGame, parseSave, queueCommand, serializeGame, stepGame, type GameState } from '../src/sim';
import { DAILY_GIFTS, DAY_MINUTES, giftReady, SPIN_EVERY_MIN, SPIN_GEMS, spinIn, WHEEL, WHEEL_TOTAL, wheelSegment } from '../src/sim/game/daily';

const DAY0 = 20000 * DAY_MINUTES + 600;

function at(s: GameState, minutes: number): void {
  queueCommand(s, { type: 'setNow', minutes });
  stepGame(s);
}

function claim(s: GameState): void {
  queueCommand(s, { type: 'claimGift' });
  stepGame(s);
}

describe('the daily gift', () => {
  it('nothing until the clock is known; then a gift a day, bigger each day of a streak', () => {
    const s = createGame(1);
    expect(giftReady(s).ready).toBe(false);
    at(s, DAY0);
    expect(giftReady(s)).toEqual({ ready: true, day: 1 });
    const coins = s.money.toNumber();
    claim(s);
    expect(s.money.toNumber() - coins).toBe(Math.round(DAILY_GIFTS[0].n * tierDef(s.tier).pay));
    // not twice the same day
    expect(giftReady(s).ready).toBe(false);
    claim(s);
    expect(s.daily.streak).toBe(1);
    // the next days: the streak grows, each with its gift
    const gems = s.diamonds;
    at(s, DAY0 + DAY_MINUTES);
    expect(giftReady(s)).toEqual({ ready: true, day: 2 });
    claim(s);
    expect(s.diamonds - gems).toBe(DAILY_GIFTS[1].n);
    for (let d = 3; d <= 9; d++) {
      at(s, DAY0 + (d - 1) * DAY_MINUTES);
      expect(giftReady(s).day).toBe(Math.min(7, d));
      claim(s);
    }
    expect(s.daily.streak).toBe(7);
  });

  it('a missed day starts the streak over; a clock that goes back gives nothing', () => {
    const s = createGame(2);
    at(s, DAY0);
    claim(s);
    at(s, DAY0 + DAY_MINUTES);
    claim(s);
    expect(s.daily.streak).toBe(2);
    at(s, DAY0 + 3 * DAY_MINUTES);
    expect(giftReady(s)).toEqual({ ready: true, day: 1 });
    claim(s);
    at(s, DAY0);
    expect(giftReady(s).ready).toBe(false);
  });
});

describe('the lucky wheel', () => {
  it('the odds add up, and spins land as often as the odds say', () => {
    expect(WHEEL_TOTAL).toBe(100);
    const s = createGame(3);
    at(s, DAY0);
    s.diamonds = 1e6;
    for (let i = 0; i < 50; i++) {
      queueCommand(s, { type: 'spinWheel', paid: true });
      stepGame(s);
    }
    expect(s.daily.spins).toBe(50);
    const hits = WHEEL.map(() => 0);
    const N = 20000;
    for (let k = 1; k <= N; k++) hits[wheelSegment(s.seed, k)]++;
    for (let i = 0; i < WHEEL.length; i++) expect(Math.abs(hits[i] / N - WHEEL[i].weight / WHEEL_TOTAL), `segment ${i}`).toBeLessThan(0.015);
  });

  it('a free spin every four hours; extra spins cost diamonds', () => {
    const s = createGame(4);
    queueCommand(s, { type: 'spinWheel', paid: false });
    stepGame(s);
    expect(s.daily.spins).toBe(0);
    at(s, DAY0);
    expect(spinIn(s)).toBe(0);
    queueCommand(s, { type: 'spinWheel', paid: false });
    stepGame(s);
    expect(s.daily.spins).toBe(1);
    expect(spinIn(s)).toBe(SPIN_EVERY_MIN);
    queueCommand(s, { type: 'spinWheel', paid: false });
    stepGame(s);
    expect(s.daily.spins).toBe(1);
    // a paid one
    s.diamonds = SPIN_GEMS;
    queueCommand(s, { type: 'spinWheel', paid: true });
    stepGame(s);
    expect(s.daily.spins).toBe(2);
    expect(s.diamonds).toBeLessThanOrEqual(50);
    // no diamonds: refused
    s.diamonds = 0;
    queueCommand(s, { type: 'spinWheel', paid: true });
    stepGame(s);
    expect(s.daily.spins).toBe(2);
    at(s, DAY0 + SPIN_EVERY_MIN);
    expect(spinIn(s)).toBe(0);
  });

  it('the gift and the wheel survive a save', () => {
    const s = createGame(5);
    at(s, DAY0);
    claim(s);
    queueCommand(s, { type: 'spinWheel', paid: false });
    stepGame(s);
    const r = parseSave(serializeGame(s, 1), 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.daily.giftDay).toBe(s.daily.giftDay);
    expect(r.state.daily.streak).toBe(1);
    expect(r.state.daily.spinAt).toBe(s.daily.spinAt);
    expect(r.state.daily.spins).toBe(1);
  });
});
