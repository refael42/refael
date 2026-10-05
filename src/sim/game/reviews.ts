import { NAMES } from '../../data/names';
import { REVIEW, SERVICE } from '../../data/reviews';
import type { Big } from '../big';
import { next } from '../rng';
import { emit, Ev } from './events';
import type { Customer, GameState } from './types';

// Service grades and reviews: the better the visit went, the more a customer pays, and now and
// then they tell the world about it. Numbers in data/reviews.ts.

/** 1..5 stars for a visit's mood (the share of patience left, averaged over the visit). */
export function serviceStars(mood: number): number {
  let stars = 1;
  for (const at of SERVICE.starsAt) if (mood >= at) stars++;
  return stars;
}

/** What the grade does to the bill. */
export const serviceMult = (stars: number): number => SERVICE.payMult[stars - 1]!;

/** People are talking about the place (a recent five-star review): more of them come. */
export const buzzing = (s: GameState): boolean => s.time < s.buzzUntil;

/**
 * Maybe the customer who just paid `paid` writes a review: one per group, not too often.
 * Four or five stars bring bonus coins; five stars also bring a crowd for a while.
 */
export function maybeReview(s: GameState, c: Customer, stars: number, paid: Big): void {
  if (c.party !== c.id || s.stats.served < REVIEW.afterServed || s.time - s.lastReviewTime < REVIEW.minGapSeconds) return;
  if (next(s.rng) >= REVIEW.chance) return;
  s.lastReviewTime = s.time;
  const bonus = paid.mul(REVIEW.bonusMeals[stars] ?? 0).floor();
  if (bonus.gt(0)) {
    s.coins = s.coins.add(bonus);
    s.stats.earned = s.stats.earned.add(bonus);
    emit(s, Ev.Bonus, c.x, c.y, bonus.toNumber());
  }
  if (stars === 5) s.buzzUntil = s.time + REVIEW.buzzSeconds;
  const line = Math.floor(next(s.rng) * REVIEW.lines);
  const name = Math.floor(next(s.rng) * NAMES.length);
  s.reviews.push({ id: s.nextId++, time: s.time, stars, line, name, dish: c.dish, bonus });
  if (s.reviews.length > REVIEW.keep) s.reviews.shift();
  emit(s, Ev.Review, c.x, c.y, stars);
}
