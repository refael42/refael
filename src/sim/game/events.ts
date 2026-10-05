import { EVENT_STRIDE } from '../snapshot';
import type { GameState } from './types';

/** Things that happened this tick that the renderer should celebrate (or mourn). */
export const Ev = {
  /** a = amount */
  Coins: 1,
  /** a = amount */
  Tip: 2,
  /** a = combo count */
  Combo: 3,
  /** (x,y) pass slot -> (a,b) table, c = dish */
  DishFly: 4,
  Burst: 5,
  Poof: 6,
  Ding: 7,
  /** a = rating delta */
  Rating: 8,
  NoTable: 9,
} as const;
export type Ev = (typeof Ev)[keyof typeof Ev];

/** Events stay in snapshots this long so the UI never misses one even if it skips frames. */
export const EVENT_KEEP_SECONDS = 2;

export function emit(s: GameState, type: Ev, x: number, y: number, a = 0, b = 0, c = 0): void {
  s.events.push({ id: s.nextEventId++, time: s.time, type, x, y, a, b, c });
}

export function pruneEvents(s: GameState): void {
  const cutoff = s.time - EVENT_KEEP_SECONDS;
  let drop = 0;
  while (drop < s.events.length && s.events[drop]!.time < cutoff) drop++;
  if (drop > 0) s.events.splice(0, drop);
}

export function packEvents(s: GameState): number[] {
  const out = new Array<number>(s.events.length * EVENT_STRIDE);
  s.events.forEach((e, i) => {
    const o = i * EVENT_STRIDE;
    out[o] = e.id;
    out[o + 1] = e.time;
    out[o + 2] = e.type;
    out[o + 3] = e.x;
    out[o + 4] = e.y;
    out[o + 5] = e.a;
    out[o + 6] = e.b;
    out[o + 7] = e.c;
  });
  return out;
}
