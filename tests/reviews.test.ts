import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { REVIEW, SERVICE } from '../src/data/reviews';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { buzzing, maybeReview, serviceMult, serviceStars } from '../src/sim/game/reviews';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';

const team = ['cook', 'waiter', 'washer'] as const;

/** Plays a while; seats each customer once they have waited `delay` seconds in line. */
function play(s: GameState, seconds: number, delay: number) {
  const queuedAt = new Map<number, number>();
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) {
      if (c.state !== CustomerState.Queued) continue;
      if (!queuedAt.has(c.id)) queuedAt.set(c.id, s.time);
      if (s.time - queuedAt.get(c.id)! >= delay) queueCommand(s, { type: 'seat', customer: c.id });
    }
    stepGame(s, STEP_SEC);
  }
}

describe('service grade', () => {
  it('turns more patience left into more stars, and more stars into a bigger bill', () => {
    expect([0, 0.3, 0.5, 0.7, 0.9, 1].map(serviceStars)).toEqual([1, 2, 3, 4, 5, 5]);
    for (let k = 1; k < 5; k++) expect(serviceMult(k + 1)).toBeGreaterThan(serviceMult(k));
    expect(SERVICE.payMult).toHaveLength(5);
  });

  it('a customer seated right away pays more than one left waiting in line', () => {
    const quick = createGame(STAND_MAP, 21, { roster: [...team] });
    const slow = createGame(STAND_MAP, 21, { roster: [...team] });
    play(quick, 240, 0);
    play(slow, 240, 12);
    const perMeal = (s: GameState) => s.stats.earned.toNumber() / Math.max(1, s.stats.served);
    expect(quick.stats.served).toBeGreaterThan(5);
    expect(slow.stats.served).toBeGreaterThan(5);
    expect(perMeal(quick)).toBeGreaterThan(perMeal(slow) * 1.1);
  });
});

describe('reviews', () => {
  /** A game with someone at a table, past the first few guests. */
  function withGuest(seed: number) {
    const s = createGame(STAND_MAP, seed, { roster: [...team] });
    play(s, 60, 0);
    s.stats.served = Math.max(s.stats.served, REVIEW.afterServed);
    const guest = s.customers.find((c) => c.party === c.id)!;
    return { s, guest };
  }

  it('five stars pay a bonus and get people talking; never two reviews too close together', () => {
    const { s, guest } = withGuest(31);
    const before = s.coins;
    const count = s.reviews.length;
    // Keep asking until one writes (each asks once; the chance is a dice roll).
    for (let i = 0; i < 200 && s.reviews.length === count; i++) maybeReview(s, guest, 5, big(100));
    expect(s.reviews.length).toBe(count + 1);
    const r = s.reviews.at(-1)!;
    expect(r.stars).toBe(5);
    expect(r.bonus.toNumber()).toBe(100 * REVIEW.bonusMeals[5]!);
    expect(s.coins.sub(before).toNumber()).toBe(r.bonus.toNumber());
    expect(buzzing(s)).toBe(true);
    for (let i = 0; i < 200; i++) maybeReview(s, guest, 5, big(100));
    expect(s.reviews.length).toBe(count + 1);
  });

  it('a poor review brings no bonus and no crowd', () => {
    const { s, guest } = withGuest(32);
    s.lastReviewTime = -Infinity;
    const before = s.coins;
    for (let i = 0; i < 200 && s.reviews.length === 0; i++) maybeReview(s, guest, 2, big(100));
    expect(s.reviews.at(-1)?.stars).toBe(2);
    expect(s.coins.eq(before)).toBe(true);
    expect(buzzing(s)).toBe(false);
  });

  it('customers write reviews by themselves as the restaurant runs, and only a few are kept', () => {
    const s = createGame(STAND_MAP, 33, { roster: [...team, 'waiter'], levels: { tables: 3 } });
    play(s, 600, 0);
    expect(s.reviews.length).toBeGreaterThan(2);
    expect(s.reviews.length).toBeLessThanOrEqual(REVIEW.keep);
    const times = s.reviews.map((r) => r.time);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(REVIEW.minGapSeconds);
  });
});
