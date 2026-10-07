import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { REVIEW, SERVICE } from '../src/data/reviews';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { buzzing, claimReviews, maybeReview, serviceMult, serviceStars, unclaimedBonus } from '../src/sim/game/reviews';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
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
    // A few days (seeds), so one lucky run does not decide it.
    let quickPay = 0;
    let slowPay = 0;
    for (const seed of [21, 22, 23]) {
      const quick = createGame(STAND_MAP, seed, { roster: [...team] });
      const slow = createGame(STAND_MAP, seed, { roster: [...team] });
      play(quick, 240, 0);
      play(slow, 240, 12);
      const perMeal = (s: GameState) => s.stats.earned.toNumber() / Math.max(1, s.stats.served);
      expect(quick.stats.served).toBeGreaterThan(5);
      expect(slow.stats.served).toBeGreaterThan(5);
      quickPay += perMeal(quick);
      slowPay += perMeal(slow);
    }
    expect(quickPay).toBeGreaterThan(slowPay * 1.1);
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

  it('five stars bring a bonus to take on the reviews page and get people talking; never two too close together', () => {
    const { s, guest } = withGuest(31);
    const before = s.coins;
    const count = s.reviews.length;
    // Keep asking until one writes (each asks once; the chance is a dice roll).
    for (let i = 0; i < 200 && s.reviews.length === count; i++) maybeReview(s, guest, 5, big(100));
    expect(s.reviews.length).toBe(count + 1);
    const r = s.reviews.at(-1)!;
    expect(r.stars).toBe(5);
    expect(['great', 'dish', 'kids', 'tourist']).toContain(r.kind);
    expect(r.bonus.toNumber()).toBe(100 * REVIEW.bonusMeals[5]!);
    // Not paid until taken on the page.
    expect(r.claimed).toBe(false);
    expect(s.coins.eq(before)).toBe(true);
    expect(unclaimedBonus(s).toNumber()).toBe(r.bonus.toNumber());
    queueCommand(s, { type: 'review', id: r.id });
    stepGame(s, STEP_SEC);
    expect(r.claimed).toBe(true);
    expect(s.coins.gte(before.add(r.bonus))).toBe(true);
    // Taking it again does nothing.
    const after = s.coins;
    claimReviews(s, r.id);
    expect(s.coins.eq(after)).toBe(true);
    expect(buzzing(s)).toBe(true);
    for (let i = 0; i < 200; i++) maybeReview(s, guest, 5, big(100));
    expect(s.reviews.length).toBe(count + 1);
  });

  it('bad service gets bad reviews that say what went wrong; walking out gets an angry one', () => {
    const { s, guest } = withGuest(34);
    for (let i = 0; i < 200 && s.reviews.length === 0; i++) maybeReview(s, guest, 1, big(100));
    const bad = s.reviews.at(-1)!;
    expect(bad.stars).toBe(1);
    expect(['awful', 'slowFood', 'slowLine']).toContain(bad.kind);
    expect(bad.bonus.toNumber()).toBe(0);
    expect(bad.claimed).toBe(true);
    // Nobody seats anyone: people give up in line and some write about it.
    const t = createGame(STAND_MAP, 35, { roster: [...team] });
    t.stats.served = REVIEW.afterServed;
    for (let i = Math.round(600 / STEP_SEC); i > 0; i--) stepGame(t, STEP_SEC);
    expect(t.stats.walkouts).toBeGreaterThan(3);
    expect(t.reviews.some((r) => r.kind === 'walkout' && r.stars === 1)).toBe(true);
  });

  it('a full page drops the oldest review, paying its bonus if it was never taken', () => {
    const s = createGame(STAND_MAP, 36);
    for (let i = 0; i < REVIEW.keep; i++) s.reviews.push({ id: s.reviewSeq++, day: 1, stars: 5, kind: 'great', line: 0, name: 0, dish: 0, bonus: big(10), claimed: false });
    const before = s.coins;
    s.stats.served = REVIEW.afterServed;
    const guest = { ...s.customers[0], id: 999, party: 999, dish: 0, type: 'regular', foodWaited: 0, tourist: false } as unknown as GameState['customers'][number];
    const seq = s.reviewSeq;
    for (let i = 0; i < 200 && s.reviewSeq === seq; i++) {
      s.lastReviewTime = -Infinity;
      maybeReview(s, guest, 4, big(100));
    }
    expect(s.reviews.length).toBe(REVIEW.keep);
    expect(s.coins.sub(before).toNumber()).toBe(10);
    // Taking everything at once pays the rest in one go.
    const waiting = unclaimedBonus(s);
    claimReviews(s, -1);
    expect(s.coins.sub(before).toNumber()).toBe(10 + waiting.toNumber());
    expect(s.reviews.every((r) => r.claimed)).toBe(true);
  });

  it('the page is saved, bonuses not taken yet included', () => {
    const s = createGame(STAND_MAP, 37);
    s.reviews.push({ id: s.reviewSeq++, day: 3, stars: 5, kind: 'dish', line: 2, name: 4, dish: 1, bonus: big(50), claimed: false });
    s.reviews.push({ id: s.reviewSeq++, day: 3, stars: 1, kind: 'walkout', line: 1, name: 2, dish: 0, bonus: big(0), claimed: true });
    const load = parseSave(JSON.stringify(makeSave(s, 0)));
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    const back = restoreGame(load.save, 1, 0);
    expect(back.reviews.map((r) => [r.kind, r.stars, r.claimed, r.bonus.toNumber()])).toEqual([['dish', 5, false, 50], ['walkout', 1, true, 0]]);
    expect(back.reviewSeq).toBeGreaterThan(Math.max(...back.reviews.map((r) => r.id)));
    // A save from before the page: none, and broken entries dropped.
    const old = JSON.parse(JSON.stringify(makeSave(s, 0))) as Record<string, unknown>;
    old.reviews = [{ id: 1, stars: 9, kind: 'nonsense', line: 0, bonus: '5' }];
    const fixed = parseSave(JSON.stringify(old));
    expect(fixed.ok && fixed.save.reviews).toEqual([]);
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
    const ids = s.reviews.map((r) => r.id);
    for (let i = 1; i < ids.length; i++) expect(ids[i]!).toBeGreaterThan(ids[i - 1]!);
  });
});
