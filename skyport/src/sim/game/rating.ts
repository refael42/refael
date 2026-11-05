/**
 * What the rating is made of, each 0 (bad) .. 1 (great): punctuality, queue
 * times, cleanliness, lost bags and how happy the passengers are. Shown in the
 * rating panel; the weakest part is what to work on.
 */
import { cleanliness } from './cleaning';
import type { GameState } from './types';

export interface RatingParts {
  punctuality: number;
  queues: number;
  cleanliness: number;
  bags: number;
  satisfaction: number;
}

export const RATING_PARTS: readonly (keyof RatingParts)[] = ['punctuality', 'queues', 'cleanliness', 'bags', 'satisfaction'];

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function ratingParts(s: GameState): RatingParts {
  const st = s.stats;
  const flown = st.onTime + st.late;
  const wait = st.queued > 0 ? st.queueSecs / st.queued : 0;
  return {
    punctuality: flown > 0 ? st.onTime / flown : 1,
    // (up to 8 s in a line is fine; 48 s is as bad as it gets)
    queues: clamp(1 - (wait - 8) / 40),
    cleanliness: cleanliness(s),
    // (one bag in fifty lost is as bad as it gets)
    bags: st.pax > 0 ? clamp(1 - (st.lostBags / st.pax) * 50) : 1,
    satisfaction: clamp((s.rating - 1) / 4),
  };
}

/** The part to work on first (null when everything is fine). */
export function weakestPart(p: RatingParts): keyof RatingParts | null {
  let worst: keyof RatingParts | null = null;
  for (const k of RATING_PARTS) if (p[k] < 0.8 && (worst === null || p[k] < p[worst])) worst = k;
  return worst;
}
