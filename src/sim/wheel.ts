import { WHEEL, WHEEL_SEGMENTS, type WheelPrize } from '../data/wheel';
import { big, type Big } from './big';
import { emit, Ev } from './game/events';
import type { GameState } from './game/types';
import { hash01 } from './retention';
import { boostNow, grantCoins, incomeRate } from './shop';

// The lucky wheel (src/data/wheel.ts). Pure, like the rest of the sim: the free spin's clock is
// the phone's (passed in with the command, in ms), and the landing spot comes from a hash, not
// from the game's dice. A spin only picks the segment; the prize is paid when the wheel on the
// screen has stopped and the player takes it, so the coin counter never gives the result away.

export type WheelState = GameState['wheel'];

export const FREE_MS = WHEEL.freeEveryHours * 3600 * 1000;

/** No spins yet, the free one ready. */
export const newWheel = (): WheelState => ({ nextFree: 0, tokens: 0, spins: 0, prize: -1 });

/**
 * Is the timed free spin ready? A clock moved backwards (a time zone, a fixed phone clock) would
 * otherwise push it further away than one wait: then it is simply ready.
 */
export const freeReady = (w: WheelState, now: number): boolean => now >= w.nextFree || w.nextFree - now > FREE_MS;

/** Milliseconds until the next timed free spin (0 = ready). */
export const freeIn = (w: WheelState, now: number): number => (freeReady(w, now) ? 0 : w.nextFree - now);

/** What a spin would cost now: free (the timer or a stored spin), gems, or not possible. */
export function spinCost(s: GameState, now: number): 'free' | 'token' | 'gems' | 'none' {
  if (s.wheel.prize >= 0) return 'none';
  if (freeReady(s.wheel, now)) return 'free';
  if (s.wheel.tokens > 0) return 'token';
  return s.gems >= WHEEL.gemCost ? 'gems' : 'none';
}

/** Which segment a spin lands on (weighted; the very first spin is fixed). */
export function landing(s: GameState): number {
  if (s.wheel.spins === 0) return WHEEL.firstSegment;
  const total = WHEEL_SEGMENTS.reduce((sum, seg) => sum + seg.weight, 0);
  let r = hash01(s.wheel.spins * 7.77 + s.tick * 0.0131 + s.city * 3.1) * total;
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    r -= WHEEL_SEGMENTS[i]!.weight;
    if (r < 0) return i;
  }
  return WHEEL_SEGMENTS.length - 1;
}

/**
 * Spins: `paid` spends gems, otherwise the free spin (or a stored one) is used. Returns the
 * segment it lands on, or -1 if it could not spin (a prize still waiting, nothing to pay with).
 */
export function spinWheel(s: GameState, now: number, paid: boolean): number {
  if (s.wheel.prize >= 0) return -1;
  if (paid) {
    if (s.gems < WHEEL.gemCost) return -1;
    s.gems -= WHEEL.gemCost;
  } else if (freeReady(s.wheel, now)) {
    s.wheel.nextFree = now + FREE_MS;
  } else if (s.wheel.tokens > 0) {
    s.wheel.tokens -= 1;
  } else {
    return -1;
  }
  const seg = landing(s);
  s.wheel.spins += 1;
  s.wheel.prize = seg;
  emit(s, Ev.WheelSpin, 0, 0, seg);
  return seg;
}

/** Coins a prize is worth right now (also shown on the wheel before the spin). */
export function prizeCoins(s: GameState, prize: WheelPrize): Big {
  if (prize.kind !== 'coins' && prize.kind !== 'jackpot') return big(0);
  return incomeRate(s).mul(prize.minutes * 60).floor().max(prize.minutes * WHEEL.minPerMinute);
}

/** Pays the prize the wheel stopped on. */
export function collectWheel(s: GameState): boolean {
  const seg = s.wheel.prize;
  const def = WHEEL_SEGMENTS[seg];
  if (!def) return false;
  s.wheel.prize = -1;
  const p = def.prize;
  const coins = prizeCoins(s, p);
  const gems = p.kind === 'gems' || p.kind === 'jackpot' ? p.gems : 0;
  grantCoins(s, coins);
  s.gems += gems;
  if (p.kind === 'boost') {
    // A boost already running at least this strong just runs longer; a weaker one is replaced.
    const running = boostNow(s);
    const left = running >= p.mult ? s.boost.until - s.time : 0;
    s.boost = { mult: Math.max(running, p.mult), until: s.time + left + p.minutes * 60 };
  }
  emit(s, Ev.Wheel, 0, 0, coins.toNumber(), gems, seg);
  return true;
}

/** A cleared quest stage stores one more spin. */
export function addWheelToken(s: GameState): void {
  s.wheel.tokens = Math.min(WHEEL.maxTokens, s.wheel.tokens + 1);
}
