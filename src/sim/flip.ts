import { FLIP } from '../data/flip';
import { big } from './big';
import { emit, Ev } from './game/events';
import type { GameState } from './game/types';
import { hash01 } from './retention';
import { grantCoins, incomeRate } from './shop';

// The golden pan (src/data/flip.ts): when it shows up on a stove, the tap that starts the game,
// and the result the game sends back (0-3 perfect flips). The dice are left alone (hash01).

export interface FlipState {
  /** The stove (index in s.stoves) with the golden pan, -1 none; until when it waits. */
  stove: number;
  until: number;
  /** The next one (sim seconds), and how many came. */
  next: number;
  count: number;
  /** The game is open on the screen. */
  playing: boolean;
  /** The cooks' speed bonus from the last game, and until when. */
  mult: number;
  hotUntil: number;
}

export const newFlip = (): FlipState => ({ stove: -1, until: 0, next: FLIP.every[0], count: 0, playing: false, mult: 1, hotUntil: 0 });

const gap = (s: GameState) => FLIP.every[0] + hash01(s.flip.count * 3.71 + 0.2) * (FLIP.every[1] - FLIP.every[0]);

/** Where the pan shows: over the middle of the pass, in front of the kitchen (the stoves at the back hide behind their hoods). */
export function panSpot(s: GameState): { x: number; y: number } {
  const slots = s.map.passSlots;
  return slots[Math.floor(slots.length / 2)] ?? s.stoves[0] ?? { x: 0, y: 0 };
}

/** The cooks' speed now (1 when no perfect flips are running). */
export const flipSpeed = (s: GameState): number => (s.time < s.flip.hotUntil ? s.flip.mult : 1);

export function updateFlip(s: GameState): void {
  const f = s.flip;
  if (f.stove >= 0 && !f.playing && s.time >= f.until) f.stove = -1;
  if (f.stove >= 0 || f.playing || s.time < f.next || s.construction || s.stats.served < FLIP.firstServed) return;
  const waiting = s.orders.filter((o) => !o.delivery && o.state <= 1).length;
  if (waiting < FLIP.minOrders || s.stoves.length === 0) return;
  f.count += 1;
  f.stove = Math.floor(hash01(f.count * 5.13 + s.day) * s.stoves.length);
  f.until = s.time + FLIP.staysSeconds;
  f.next = s.time + gap(s);
  const at = panSpot(s);
  emit(s, Ev.FlipPan, at.x, at.y);
}

/** The pan was tapped: the game opens (the pan stays put meanwhile). */
export function startFlip(s: GameState): boolean {
  if (s.flip.stove < 0 || s.flip.playing) return false;
  s.flip.playing = true;
  return true;
}

/** The game is over: `hits` perfect flips (0-3) pay out. */
export function finishFlip(s: GameState, hits: number): void {
  const f = s.flip;
  if (!f.playing) return;
  const n = Math.max(0, Math.min(FLIP.rounds.length, Math.floor(hits)));
  const st = panSpot(s);
  f.playing = false;
  f.stove = -1;
  let coins = big(0);
  let gems = 0;
  if (n > 0) {
    f.mult = 1 + FLIP.speedPerHit * n;
    f.hotUntil = s.time + FLIP.speedSeconds;
    coins = incomeRate(s).mul(FLIP.coinSecondsPerHit * n).floor().max(10 * n);
    grantCoins(s, coins);
    if (n === FLIP.rounds.length) {
      gems = FLIP.perfectGems;
      s.gems += gems;
    }
  }
  emit(s, Ev.FlipDone, st.x, st.y, n, coins.toNumber(), gems);
}
