import { CUSTOMER_TYPES, KID_RANK } from '../../data/customers';
import { NAMES } from '../../data/names';
import { REVIEW, REVIEW_LINES, SERVICE, type ReviewKind } from '../../data/reviews';
import { big, type Big } from '../big';
import { hash01 } from '../retention';
import { next } from '../rng';
import { emit, Ev } from './events';
import type { Customer, GameState, Review } from './types';

// Service grades and reviews: the better the visit went, the more a customer pays, and now and
// then they tell the world about it. Reviews land on their own page (owner: "not on the screen
// any more; a page where you claim the money and read the feedback"), good and bad alike; a
// good one's bonus waits there to be taken. Numbers in data/reviews.ts.

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

/** What went wrong for a guest who was not happy: the wait for the food, or the line. */
function complaint(s: GameState, c: Customer): ReviewKind {
  const type = CUSTOMER_TYPES[c.type];
  return c.foodWaited > type.foodPatience * s.mods.patience * 0.5 ? 'slowFood' : 'slowLine';
}

/** What a paying guest writes about, by their grade (and who they came with). */
function kindFor(s: GameState, c: Customer, stars: number, roll: number): ReviewKind {
  const kids = s.customers.some((m) => m.party === c.party && m.rank === KID_RANK);
  if (stars >= 4) {
    if (c.tourist && roll < 0.35) return 'tourist';
    if (kids && roll < 0.35) return 'kids';
    if (roll < 0.65) return 'dish';
    return stars === 5 ? 'great' : 'good';
  }
  if (stars === 3) return roll < 0.5 ? 'ok' : complaint(s, c);
  if (stars === 2) return complaint(s, c);
  return roll < 0.6 ? 'awful' : complaint(s, c);
}

/** Adds a review to the page; the oldest goes when it is full (its bonus paid if never taken). */
function addReview(s: GameState, r: Omit<Review, 'id' | 'day' | 'claimed'>): Review {
  const review: Review = { ...r, id: s.reviewSeq++, day: s.day, claimed: r.bonus.lte(0) };
  s.reviews.push(review);
  while (s.reviews.length > REVIEW.keep) {
    const old = s.reviews.shift()!;
    if (!old.claimed) pay(s, old.bonus);
  }
  emit(s, Ev.Review, 0, 0, r.stars);
  return review;
}

function pay(s: GameState, coins: Big): void {
  s.coins = s.coins.add(coins);
  s.stats.earned = s.stats.earned.add(coins);
}

/**
 * Maybe the customer who just paid `paid` writes a review: one per group, not too often.
 * Four or five stars bring bonus coins (taken on the reviews page); five stars also bring a
 * crowd for a while.
 */
export function maybeReview(s: GameState, c: Customer, stars: number, paid: Big): void {
  if (c.party !== c.id || s.stats.served < REVIEW.afterServed || s.time - s.lastReviewTime < REVIEW.minGapSeconds) return;
  if (next(s.rng) >= REVIEW.chance) return;
  s.lastReviewTime = s.time;
  if (stars === 5) {
    s.buzzUntil = s.time + REVIEW.buzzSeconds;
    s.stats.fiveStars += 1;
  }
  const kind = kindFor(s, c, stars, hash01(c.id * 1.731 + s.tick * 0.017));
  const line = Math.floor(next(s.rng) * REVIEW_LINES[kind]);
  const name = Math.floor(next(s.rng) * NAMES.length);
  addReview(s, { stars, kind, line, name, dish: c.dish, bonus: paid.mul(REVIEW.bonusMeals[stars] ?? 0).floor() });
}

/** Someone who walked out may write an angry one-star review (by their id: the dice are left alone). */
export function walkoutReview(s: GameState, c: Customer): void {
  if (c.party !== c.id || s.stats.served < REVIEW.afterServed || s.time - s.lastWalkoutReview < REVIEW.walkoutGapSeconds) return;
  if (hash01(c.id * 3.917 + 0.29) >= REVIEW.walkoutChance) return;
  s.lastWalkoutReview = s.time;
  const line = Math.floor(hash01(c.id * 7.13 + 0.5) * REVIEW_LINES.walkout);
  const name = Math.floor(hash01(c.id * 1.39 + 0.81) * NAMES.length);
  addReview(s, { stars: 1, kind: 'walkout', line, name, dish: c.dish, bonus: big(0) });
}

/** Coins waiting on the reviews page. */
export function unclaimedBonus(s: GameState): Big {
  let sum = big(0);
  for (const r of s.reviews) if (!r.claimed) sum = sum.add(r.bonus);
  return sum;
}

/** Takes one review's bonus (or every waiting one, `id` = -1); the coins fly to the counter. */
export function claimReviews(s: GameState, id: number): void {
  let sum = big(0);
  for (const r of s.reviews) {
    if (r.claimed || (id >= 0 && r.id !== id)) continue;
    r.claimed = true;
    sum = sum.add(r.bonus);
  }
  if (sum.lte(0)) return;
  pay(s, sum);
  emit(s, Ev.Bonus, 0, 0, sum.toNumber());
}
