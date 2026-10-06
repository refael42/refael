import { FESTIVAL, FESTIVAL_THEMES, type FestivalReward, type FestivalTheme } from '../data/events';
import { big, type Big } from './big';
import { emit, Ev } from './game/events';
import type { Customer, GameState } from './game/types';
import { boostNow, grantCoins, incomeRate } from './shop';

// The food festival (src/data/events.ts). The sim has no clock of its own: the phone's time
// comes in with a command now and then, and that picks which festival is on. Points come from
// guests while you play (not while away), so the festival is a reason to come back and play.

export type FestivalState = GameState['festival'];

const PERIOD_MS = FESTIVAL.days * 24 * 3600 * 1000;

/** No festival seen yet (the first clock reading starts one), no trophies. */
export const newFestival = (): FestivalState => ({ id: -1, points: 0, claimed: 0, trophies: [] });

/** Which festival is on at this moment (the same number on every phone). */
export const festivalAt = (now: number): number => Math.floor((now - FESTIVAL.epoch) / PERIOD_MS);

export const themeIndex = (id: number): number => ((id % FESTIVAL_THEMES.length) + FESTIVAL_THEMES.length) % FESTIVAL_THEMES.length;
export const themeOf = (id: number): FestivalTheme => FESTIVAL_THEMES[themeIndex(id)]!;

/** When festival `id` ends (phone clock, ms). */
export const festivalEnds = (id: number): number => FESTIVAL.epoch + (id + 1) * PERIOD_MS;

/** Steps of the track the points reach. */
export const stepsReached = (f: FestivalState): number => FESTIVAL.track.filter((step) => f.points >= step.points).length;

/** All bills are this much higher for the trophies won (1 = none). */
export const festivalBonus = (s: GameState): number => 1 + FESTIVAL.trophyBonus * s.festival.trophies.length;

/**
 * The phone's clock says which festival is on. When a new one starts, rewards reached but not
 * taken in the old one are paid at once (nothing earned is lost), and points start from zero.
 * A clock that went back keeps the festival that is on.
 */
export function syncFestival(s: GameState, now: number): void {
  const id = festivalAt(now);
  if (id <= s.festival.id) return;
  const first = s.festival.id < 0;
  let paid = 0;
  if (!first) while (claimFestival(s)) paid += 1;
  s.festival = { id, points: 0, claimed: 0, trophies: s.festival.trophies };
  // The very first clock reading is a new game (or an old save): no news, the chip is enough.
  if (!first) emit(s, Ev.FestivalStart, 0, 0, themeIndex(id), paid);
}

/** A guest paid: festival points (`tourist`s bring double). Says when a new step is reached. */
export function festivalPoints(s: GameState, c: Customer, stars: number): void {
  if (s.festival.id < 0) return;
  const p = FESTIVAL.points;
  let points = p.guest + (c.dish === themeOf(s.festival.id).dish ? p.dish : 0) + (stars >= 5 ? p.fiveStars : 0) + (c.vip ? p.vip : 0);
  if (c.tourist) points *= 2;
  const before = stepsReached(s.festival);
  s.festival.points += points;
  const after = stepsReached(s.festival);
  if (after > before) emit(s, Ev.FestivalStep, c.x, c.y, after);
}

/** Coins a coin reward is worth right now (also shown on the track before it is taken). */
export function rewardCoins(s: GameState, r: FestivalReward): Big {
  if (r.kind !== 'coins') return big(0);
  return incomeRate(s).mul(r.minutes * 60).floor().max(r.minutes * FESTIVAL.minPerMinute);
}

/** Takes the next reward the points have reached. Returns whether there was one. */
export function claimFestival(s: GameState): boolean {
  const f = s.festival;
  if (f.id < 0 || f.claimed >= stepsReached(f)) return false;
  const step = f.claimed;
  const r = FESTIVAL.track[step]!.reward;
  f.claimed += 1;
  const coins = rewardCoins(s, r);
  grantCoins(s, coins);
  let gems = 0;
  if (r.kind === 'gems' || r.kind === 'trophy') gems = r.gems;
  s.gems += gems;
  if (r.kind === 'spins') s.wheel.tokens += r.spins;
  if (r.kind === 'boost') {
    // Like the wheel's boost: a stronger one running just goes on, a weaker one is replaced.
    const running = boostNow(s);
    const left = running >= r.mult ? s.boost.until - s.time : 0;
    s.boost = { mult: Math.max(running, r.mult), until: s.time + left + r.minutes * 60 };
  }
  if (r.kind === 'trophy') {
    const theme = themeIndex(f.id);
    if (!f.trophies.includes(theme)) f.trophies = [...f.trophies, theme];
  }
  emit(s, Ev.FestivalClaim, 0, 0, coins.toNumber(), gems, step);
  return true;
}
