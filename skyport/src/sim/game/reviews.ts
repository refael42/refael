/**
 * Passenger reviews (M12). When a flight leaves, one of its passengers may
 * write a review: the topic comes from what happened (a lost bag, a late
 * departure, long lines, dirty halls, a jet bridge, the bus, the people mover,
 * the train, the hotel, an air taxi...) and the line by hash. Good reviews
 * (four and five stars) earn a bonus to collect in the reviews panel.
 */
import { AIRCRAFT } from '../../data/aircraft';
import { PAX_TYPES } from '../../data/paxTypes';
import { REVIEWS, REVIEWS_BY_TOPIC, type ReviewTopic } from '../../data/reviews';
import { FIRST_NAMES } from '../../data/staff';
import { tierDef } from '../../data/tiers';
import { hash01 } from '../hash';
import { bussed } from './buses';
import { cleanliness } from './cleaning';
import { pushEvent } from './events';
import { gatePoint, layoutOf, satGate } from './layout';
import { terminalFor } from './terminal';
import type { Flight, GameState, Review } from './types';

/** Reviews kept (newest first). */
export const MAX_REVIEWS = 40;
/** Chance a flight gets a review. */
const REVIEW_CHANCE = 0.45;
/** Bonus per good review (coins, times the tier's pay). */
export const REVIEW_BONUS: Readonly<Record<number, number>> = { 4: 12, 5: 25 };


/** What this flight's passengers lived through, as review topics with weights (worst things first). */
export function reviewTopics(s: GameState, f: Flight): [ReviewTopic, number][] {
  const L = layoutOf(s.tier);
  const out: [ReviewTopic, number][] = [];
  const add = (t: ReviewTopic, w: number) => out.push([t, w]);
  if (f.lostBags > 0) add('lostBag', 6);
  if (f.onTime < 0) add('late', 5);
  const clean = cleanliness(s);
  if (clean < 0.55) add('dirty', 4);
  const st = s.stats;
  const wait = st.queued > 0 ? st.queueSecs / st.queued : 0;
  if (wait > 22) add('queue', 3 + Math.min(3, (wait - 22) / 10));
  if (L.t3?.st.arrPassport && s.t3q.arrPassQ.length > 14) add('passport', 2);
  if (f.mood > 0.8 && f.onTime > 0) add('smooth', 3);
  if (f.onTime > 0) add('onTime', 2);
  if (clean > 0.92 && L.building) add('clean', 1.5);
  if (f.stand >= 0) {
    if (gatePoint(L, f.stand) && !bussed(s, f)) add('jetBridge', 2);
    if (bussed(s, f)) add('bus', 2.5);
    if (satGate(L, f.stand)) add('apm', 3);
  }
  const ac = AIRCRAFT[f.aircraft];
  if (ac?.category === 'evtol') add('airTaxi', 6);
  if (ac?.stand === 'hugeX' && terminalFor(s, f) === 2) add('jumbo', 4);
  if (L.rail && terminalFor(s, f) === 1) add('train', 1.2);
  if (L.hotel && terminalFor(s, f) === 1) add('hotel', 1);
  if (s.holiday >= 0) add('holiday', 2);
  if (s.tier === 1) add('dirtStrip', 3);
  if (s.tier >= 6) add('bigAirport', 1.2);
  if (st.sales.toNumber() > 0) add(s.tier >= 4 ? 'dutyFree' : 'food', 1.2);
  if (f.paxIn > 0 && f.lostBags === 0 && f.mood > 0.7) add('carousel', 0.8);
  return out;
}

/** The passenger type of the writer turns into a topic sometimes (families, business people, students...). */
const TYPE_TOPIC: Partial<Record<string, ReviewTopic>> = { family: 'family', kid: 'family', business: 'business', businessW: 'business', student: 'student', elder: 'elder', vip: 'vip' };

/** Maybe writes a review for a flight that just left (deterministic by the flight's id). */
export function maybeReview(s: GameState, f: Flight, code: string): void {
  if (f.paxOut + f.paxIn <= 0 || hash01(f.id * 71 + 5) >= REVIEW_CHANCE) return;
  const pax = Math.floor(hash01(f.id * 73 + 1) * PAX_TYPES.length);
  const topics = reviewTopics(s, f);
  const own = TYPE_TOPIC[PAX_TYPES[pax].id];
  if (own) topics.push([own, 1.5]);
  if (topics.length === 0) topics.push(['smooth', 1]);
  const total = topics.reduce((a, t) => a + t[1], 0);
  let u = hash01(f.id * 79 + 3) * total;
  let topic = topics[0][0];
  for (const [t, w] of topics) {
    u -= w;
    if (u <= 0) {
      topic = t;
      break;
    }
  }
  const lines = REVIEWS_BY_TOPIC[topic];
  const line = lines[Math.floor(hash01(f.id * 83 + 7) * lines.length)];
  const stars = REVIEWS[line].stars;
  const r: Review = { id: s.nextId++, line, stars, name: Math.floor(hash01(f.id * 89 + 2) * FIRST_NAMES.length), pax, flight: code, at: s.time };
  s.reviews.unshift(r);
  if (s.reviews.length > MAX_REVIEWS) s.reviews.length = MAX_REVIEWS;
  const bonus = REVIEW_BONUS[stars] ?? 0;
  if (bonus > 0) s.reviewBonus += bonus * tierDef(s.tier).pay;
  pushEvent(s, 'review', f.x, f.y, stars, line, r.id);
}

/** Average stars of the reviews kept (0 when there are none). */
export function reviewAverage(s: GameState): number {
  if (s.reviews.length === 0) return 0;
  return s.reviews.reduce((a, r) => a + r.stars, 0) / s.reviews.length;
}
