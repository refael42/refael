import { CONSTRUCTION } from '../../data/buildings';
import { mapForTier } from '../../data/maps';
import { levelOf } from '../economy/upgrades';
import { range } from '../rng';
import { Emote } from '../types';
import { createGame, workerOf } from './create';
import { sendHome } from './customers';
import { emit, Ev } from './events';
import { CustomerState, type GameState } from './types';

// Growing the building. Buying the next tier closes the restaurant for a short construction
// show on the lot next door (scaffolding, dust, a shaking camera), then the game is rebuilt on
// the bigger map: same coins, levels, rating, team and day, a fresh and empty dining room.

/** The lot being built on: from the old building's edge to the new one's (tiles). */
function siteOf(s: GameState, tier: number) {
  const now = s.map.building;
  const next = mapForTier(tier).building;
  return { x0: now.x1, y0: now.y0, x1: next.x1, y1: now.y1 };
}

export function startConstruction(s: GameState): void {
  const tier = levelOf(s.levels, 'building');
  const site = siteOf(s, tier);
  s.construction = { tier, start: s.time, end: s.time + CONSTRUCTION.seconds, nextDust: s.time, site };
  // Closed for building work: the line goes home (no hard feelings, no rating hit).
  for (const c of s.customers) {
    if (c.state === CustomerState.Arriving || c.state === CustomerState.Queued) {
      c.emote = Emote.Music;
      c.emoteTime = 0;
      sendHome(s, c);
    }
  }
  emit(s, Ev.Build, (site.x0 + site.x1) / 2, (site.y0 + site.y1) / 2, tier);
}

export function updateConstruction(s: GameState): void {
  const k = s.construction;
  if (!k) return;
  while (s.time >= k.nextDust && s.time < k.end) {
    emit(s, Ev.Dust, range(s.rng, k.site.x0, k.site.x1), range(s.rng, k.site.y0, k.site.y1));
    k.nextDust += CONSTRUCTION.dustEvery;
  }
  if (s.time >= k.end) finishConstruction(s);
}

/**
 * Reopens on the new map. The state object is refilled in place, so everyone holding it (the
 * game loop, the UI) keeps working; only the clock, the dice and the effects carry on as they were.
 */
function finishConstruction(s: GameState): void {
  const map = mapForTier(levelOf(s.levels, 'building'));
  const fresh = createGame(map, 0, {
    levels: s.levels,
    coins: s.coins,
    rating: s.rating,
    earned: s.stats.earned,
    served: s.stats.served,
    hires: s.stats.hires,
    day: s.day,
    team: s.staff.filter((st) => !st.leaving).map(workerOf),
    placed: s.placed,
    perks: s.perks,
  });
  const keep = {
    rng: s.rng,
    tick: s.tick,
    time: s.time,
    dayTime: s.dayTime,
    stats: s.stats,
    events: s.events,
    nextEventId: s.nextEventId,
    nextApplicant: s.nextApplicant,
    bumpAt: s.bumpAt,
    reviews: s.reviews,
    lastReviewTime: s.lastReviewTime,
    buzzUntil: s.buzzUntil,
    rush: s.rush,
    quests: s.quests,
    gems: s.gems,
    boost: s.boost,
    earnLog: s.earnLog,
    // Ids keep counting up, so nothing new is mistaken for something that was there before.
    nextId: Math.max(s.nextId, fresh.nextId),
  };
  Object.assign(s, fresh, keep, { nextArrival: s.time + 1, construction: null });
  const b = map.building;
  emit(s, Ev.Built, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, map.tier);
}
