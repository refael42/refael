import { APPLICANTS } from '../data/staff';
import { FRANCHISE } from '../data/franchise';
import { GIFT } from '../data/retention';
import { mapForTier } from '../data/maps';
import { big, type Big } from './big';
import { levelOf } from './economy/upgrades';
import { createGame } from './game/create';
import { emit, Ev } from './game/events';
import type { GameState } from './game/types';

// Opening a branch in a new city (src/data/franchise.ts): the rules, pure like the rest.

/** Chef trophies a branch that earned this much brings (0 below the threshold). */
export function trophiesFor(earned: Big): number {
  if (earned.lte(0)) return 0;
  return Math.max(0, Math.floor(FRANCHISE.perDecade * (earned.log10() - FRANCHISE.fromLog)));
}

/** Coins this branch must have earned for its next trophy. */
export function nextTrophyAt(earned: Big): Big {
  const next = trophiesFor(earned) + 1;
  return big(10).pow(next / FRANCHISE.perDecade + FRANCHISE.fromLog).ceil();
}

export const canOpenBranch = (s: GameState): boolean => levelOf(s.levels, 'building') >= FRANCHISE.minBuilding && !s.construction;

/**
 * Hands this restaurant over and starts again in the next city: an empty diner and a fresh
 * team, with the gems, the shop's forever perks, the trophies (old and new) and the clock. The
 * state object is refilled in place, like a finished construction, so the game loop and the
 * screens keep working.
 */
export function openBranch(s: GameState): boolean {
  if (!canOpenBranch(s)) return false;
  const gained = trophiesFor(s.stats.earned);
  const city = s.city + 1;
  const fresh = createGame(mapForTier(0), s.tick + 7919 * city, { gems: s.gems, perks: s.perks, trophies: s.trophies + gained, city, daily: s.daily, wheel: s.wheel, festival: s.festival, flash: s.flash });
  const keep = {
    tick: s.tick,
    time: s.time,
    events: s.events,
    nextEventId: s.nextEventId,
    boost: s.boost,
    // Ids keep counting up, so nothing new is mistaken for something from the old branch.
    nextId: Math.max(s.nextId, fresh.nextId),
  };
  Object.assign(s, fresh, keep, { nextArrival: s.time + 1.5, nextApplicant: s.time + APPLICANTS.firstSeconds, nextGift: s.time + GIFT.firstSeconds });
  // The new staff and walkers were made at time zero: nothing about them depends on it but
  // their animation clocks, which run on their own.
  const door = s.map.doors[0]!.inside;
  emit(s, Ev.Branch, door.x, door.y, gained, city);
  return true;
}
