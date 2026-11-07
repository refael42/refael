/**
 * The daily gift and the lucky wheel (M13). They run on the phone's clock,
 * which the UI sends in (`setNow`, real minutes since 1970), so the game stays
 * deterministic: a gift for each new real day you play (a bigger one each day
 * of a streak, back to day one after a missed day) and a free spin of the
 * wheel every four real hours. Extra spins cost diamonds. The wheel's odds are
 * shown in its panel. Which segment a spin lands on is a hash of the seed and
 * the spin's number.
 */
import { tierDef } from '../../data/tiers';
import { Big } from '../big';
import { hash01 } from '../hash';
import { pushEvent } from './events';
import type { DailyState, GameState } from './types';

/** Real minutes in a day; between free spins. */
export const DAY_MINUTES = 1440;
export const SPIN_EVERY_MIN = 240;
/** Diamonds for a spin when the free one is used. */
export const SPIN_GEMS = 10;

export type GiftKind = 'coins' | 'gems' | 'boost' | 'chest';
export interface Gift {
  kind: GiftKind;
  /** Coins: times the tier's pay; gems: diamonds; boost: minutes of double income; chest: chests. */
  n: number;
}

/** The streak's gifts, day 1 to 7 (then day 7's again while the streak lasts). */
export const DAILY_GIFTS: readonly Gift[] = [
  { kind: 'coins', n: 200 },
  { kind: 'gems', n: 5 },
  { kind: 'coins', n: 500 },
  { kind: 'boost', n: 5 },
  { kind: 'gems', n: 10 },
  { kind: 'coins', n: 1500 },
  { kind: 'chest', n: 1 },
];

/** The wheel's segments and their weights (the odds shown are weight / total). */
export const WHEEL: readonly (Gift & { weight: number })[] = [
  { kind: 'coins', n: 100, weight: 30 },
  { kind: 'coins', n: 300, weight: 20 },
  { kind: 'gems', n: 3, weight: 18 },
  { kind: 'boost', n: 3, weight: 12 },
  { kind: 'coins', n: 1000, weight: 9 },
  { kind: 'gems', n: 10, weight: 6 },
  { kind: 'chest', n: 1, weight: 4 },
  { kind: 'gems', n: 50, weight: 1 },
];
export const WHEEL_TOTAL = WHEEL.reduce((a, w) => a + w.weight, 0);

export function newDaily(): DailyState {
  return { now: -1, giftDay: -1, streak: 0, spinAt: -1e9, spins: 0 };
}

/** The phone's clock (real minutes since 1970). A clock that went back does not give anything again. */
export function setNow(s: GameState, minutes: number): void {
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  s.daily.now = Math.floor(minutes);
}

const realDay = (min: number) => Math.floor(min / DAY_MINUTES);

/** Today's gift can be claimed (and which day of the streak it is, 1..7). */
export function giftReady(s: GameState): { ready: boolean; day: number } {
  const d = s.daily;
  if (d.now < 0) return { ready: false, day: 1 };
  const today = realDay(d.now);
  if (today <= d.giftDay) return { ready: false, day: Math.min(7, Math.max(1, d.streak)) };
  // yesterday's gift keeps the streak; a missed day starts it over
  const day = today === d.giftDay + 1 ? Math.min(7, d.streak + 1) : 1;
  return { ready: true, day };
}

/** Minutes until the free spin (0 when it is ready; -1 while the clock is unknown). */
export function spinIn(s: GameState): number {
  const d = s.daily;
  if (d.now < 0) return -1;
  return Math.max(0, d.spinAt + SPIN_EVERY_MIN - d.now);
}

/** Gives a gift: coins scale with the tier's pay. Returns the coins (0 for other kinds). */
function give(s: GameState, g: Gift): number {
  switch (g.kind) {
    case 'coins': {
      const coins = Math.round(g.n * tierDef(s.tier).pay);
      s.money = s.money.add(Big.fromNumber(coins));
      s.stats.earned = s.stats.earned.add(Big.fromNumber(coins));
      return coins;
    }
    case 'gems':
      s.diamonds += g.n;
      return 0;
    case 'boost':
      s.career.boostUntil = Math.max(s.time, s.career.boostUntil) + g.n * 60;
      return 0;
    case 'chest':
      s.career.chests += g.n;
      return 0;
  }
}

export function claimGift(s: GameState): boolean {
  const r = giftReady(s);
  if (!r.ready) return false;
  const d = s.daily;
  d.giftDay = realDay(d.now);
  d.streak = r.day;
  const g = DAILY_GIFTS[r.day - 1];
  const coins = give(s, g);
  pushEvent(s, 'dailyGift', coins, 0, r.day, DAILY_GIFTS.indexOf(g), g.n);
  return true;
}

/** Where spin number k of this game lands (by the odds). */
export function wheelSegment(seed: number, k: number): number {
  let u = hash01(seed * 131 + k * 7) * WHEEL_TOTAL;
  for (let i = 0; i < WHEEL.length; i++) {
    u -= WHEEL[i].weight;
    if (u < 0) return i;
  }
  return WHEEL.length - 1;
}

/** Spins the wheel: free when the four hours are up, else for diamonds. Returns the segment or -1. */
export function spinWheel(s: GameState, paid: boolean): number {
  const d = s.daily;
  if (d.now < 0) return -1;
  if (paid) {
    if (s.diamonds < SPIN_GEMS) return -1;
    s.diamonds -= SPIN_GEMS;
  } else {
    if (spinIn(s) > 0) return -1;
    d.spinAt = d.now;
  }
  d.spins++;
  const seg = wheelSegment(s.seed, d.spins);
  const coins = give(s, WHEEL[seg]);
  pushEvent(s, 'wheelSpun', coins, 0, seg, paid ? 1 : 0, WHEEL[seg].n);
  return seg;
}
