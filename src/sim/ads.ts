import { AD_REWARDS, ADS, type AdReward } from '../data/ads';
import { WHEEL } from '../data/wheel';
import { emit, Ev } from './game/events';
import type { GameState } from './game/types';
import { boostNow } from './shop';
import { isOpen } from './unlocks';

// Rewarded ads (src/data/ads.ts): what each ad pays, and how many are left today. The day is
// the phone's (passed in with the command, like the season's), so the limits reset at midnight.

export interface AdsState {
  /** The phone's day the counts are for (src/sim/season.ts localDay), and the ads watched on it. */
  day: number;
  used: Partial<Record<AdReward, number>>;
}

export const newAds = (): AdsState => ({ day: -1, used: {} });

const usedToday = (s: GameState, reward: AdReward, day: number): number => (s.ads.day === day ? (s.ads.used[reward] ?? 0) : 0);

/** Can this reward be had now? (Its limit, the tutorial, and what it needs: the wheel open, no bigger boost running.) */
export function adOpen(s: GameState, reward: AdReward, day: number): boolean {
  if (s.stats.served < ADS.minServed && reward !== 'offline') return false;
  if (usedToday(s, reward, day) >= ADS.perDay[reward]) return false;
  if (reward === 'spin') return isOpen(s, 'wheel') && s.wheel.tokens < WHEEL.maxTokens;
  if (reward === 'boost') return boostNow(s) <= ADS.boostMult && adBoostLeft(s) < ADS.boostCapMinutes * 60 - 1;
  return true;
}

export const adsLeft = (s: GameState, reward: AdReward, day: number): number => Math.max(0, ADS.perDay[reward] - usedToday(s, reward, day));

/** Seconds of the x2 boost left (0 when another boost or none runs). */
export const adBoostLeft = (s: GameState): number => (boostNow(s) === ADS.boostMult ? Math.max(0, s.boost.until - s.time) : 0);

/**
 * An ad was watched to the end: pay its reward. The offline one only counts (the welcome-back
 * card doubles what it pays out). False when it was not open (then nothing is counted).
 */
export function grantAd(s: GameState, reward: AdReward, day: number): boolean {
  if (!adOpen(s, reward, day)) return false;
  if (s.ads.day !== day) s.ads = { day, used: {} };
  s.ads.used[reward] = (s.ads.used[reward] ?? 0) + 1;
  switch (reward) {
    case 'boost': {
      const until = Math.min(s.time + ADS.boostCapMinutes * 60, s.time + adBoostLeft(s) + ADS.boostMinutes * 60);
      s.boost = { mult: ADS.boostMult, until };
      break;
    }
    case 'gems':
      s.gems += ADS.gems;
      break;
    case 'spin':
      s.wheel.tokens = Math.min(WHEEL.maxTokens, s.wheel.tokens + 1);
      break;
    case 'offline':
      break;
  }
  emit(s, Ev.AdReward, 0, 0, AD_REWARDS.indexOf(reward), reward === 'gems' ? ADS.gems : 0);
  return true;
}

const nat = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** As saved (unknown rewards dropped). */
export function cleanAds(raw: unknown): AdsState {
  if (!raw || typeof raw !== 'object') return newAds();
  const o = raw as Record<string, unknown>;
  const used: AdsState['used'] = {};
  if (o.used && typeof o.used === 'object') for (const r of AD_REWARDS) if (r in (o.used as object)) used[r] = nat((o.used as Record<string, unknown>)[r]);
  return { day: typeof o.day === 'number' && Number.isFinite(o.day) ? Math.floor(o.day) : -1, used };
}
