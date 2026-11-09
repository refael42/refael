import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { REVIEWS, REVIEWS_BY_TOPIC, type ReviewTopic } from '../src/data/reviews';
import { applyStructural, Big, botCommands, createGame, parseSave, queueCommand, serializeGame, stepGame, switchTier, type GameState } from '../src/sim';
import { MAX_REVIEWS, reviewTopics } from '../src/sim/game/reviews';

function airfield(seed: number): GameState {
  const s = createGame(seed);
  switchTier(s, 2);
  s.upg.stand = 4;
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.money = Big.fromNumber(1e9);
  s.nextIncidentAt = 1e12;
  return s;
}

function play(s: GameState, seconds: number): void {
  for (let i = 0; i < 30 * seconds; i++) {
    if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.4 })) queueCommand(s, c);
    stepGame(s);
  }
}

describe('passenger reviews', () => {
  it('there are more than 200 lines, every topic has some, in both languages', () => {
    expect(REVIEWS.length).toBeGreaterThan(200);
    for (const r of REVIEWS) {
      expect(r.en.length).toBeGreaterThan(5);
      expect(r.he.length).toBeGreaterThan(5);
      expect(r.stars >= 1 && r.stars <= 5).toBe(true);
      // the Hebrew line is Hebrew
      expect(/[\u0590-\u05FF]/.test(r.he), r.en).toBe(true);
    }
    expect(new Set(REVIEWS.map((r) => r.en)).size).toBe(REVIEWS.length);
    for (const [topic, lines] of Object.entries(REVIEWS_BY_TOPIC)) expect(lines.length, topic).toBeGreaterThanOrEqual(6);
    // bad things get bad reviews, good things good ones
    const avg = (t: ReviewTopic) => REVIEWS_BY_TOPIC[t].reduce((a, i) => a + REVIEWS[i].stars, 0) / REVIEWS_BY_TOPIC[t].length;
    for (const t of ['lostBag', 'late', 'queue', 'dirty'] as const) expect(avg(t), t).toBeLessThan(2.5);
    for (const t of ['smooth', 'onTime', 'clean', 'jetBridge'] as const) expect(avg(t), t).toBeGreaterThan(4);
  });

  it('flights leave reviews; a lost bag or a late plane is what people write about', () => {
    const s = airfield(3);
    // (long enough for a dozen flights to leave, whatever the seed's draw of applicants)
    play(s, 2000);
    expect(s.reviews.length).toBeGreaterThan(5);
    expect(s.reviews.length).toBeLessThanOrEqual(MAX_REVIEWS);
    // newest first
    for (let i = 1; i < s.reviews.length; i++) expect(s.reviews[i - 1].at).toBeGreaterThanOrEqual(s.reviews[i].at);
    // what a flight lived through comes first
    const f = { lostBags: 2, onTime: -1, mood: 0.2, stand: -1, aircraft: 0, paxIn: 3, paxOut: 3 } as unknown as Parameters<typeof reviewTopics>[1];
    const topics = reviewTopics(s, f).map((t) => t[0]);
    expect(topics[0]).toBe('lostBag');
    expect(topics).toContain('late');
    expect(topics).not.toContain('smooth');
  }, 120000);

  it('good reviews earn a bonus to collect; it survives a save', () => {
    const s = airfield(4);
    play(s, 1500);
    expect(s.reviewBonus).toBeGreaterThan(0);
    const saved = parseSave(serializeGame(s, 0), 0);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.state.reviews.map((r) => r.line)).toEqual(s.reviews.map((r) => r.line));
    expect(Math.round(saved.state.reviewBonus)).toBe(Math.round(s.reviewBonus));
    const money = s.money.toNumber();
    const bonus = Math.floor(s.reviewBonus);
    queueCommand(s, { type: 'claimReviews' });
    stepGame(s);
    expect(s.reviewBonus).toBe(0);
    expect(s.money.toNumber()).toBeGreaterThanOrEqual(money + bonus);
  }, 120000);
});
