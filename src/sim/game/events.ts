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
  /** A dirty plate flies from a table (x,y) to the dish pile (a,b). */
  PlateFly: 10,
  /** A plate came out of the sink sparkling clean. */
  Washed: 11,
  /** An upgrade level was bought here. a = new level, b = 1 if it hit a milestone (+2: no level text), c = anchor kind. */
  Upgrade: 12,
  /** Coins granted from outside (offline earnings...): a shower of coins into the HUD. a = amount */
  Bonus: 13,
  /** A clumsy waiter dropped a dish. */
  Crash: 14,
  /** A worker leveled up. a = new level */
  LevelUp: 15,
  /** Wages paid at the end of a day. a = total paid, b = people left unpaid */
  Payday: 16,
  /** Someone got hired. */
  Hired: 17,
  /** Construction of the next building tier started; (x,y) = the site. a = tier */
  Build: 18,
  /** A dust cloud on the building site. */
  Dust: 19,
  /** The bigger restaurant opened; (x,y) = its middle. a = tier */
  Built: 20,
  /** A customer graded the service as they paid. a = stars (1..5) */
  Service: 21,
  /** A customer wrote a review. a = stars */
  Review: 22,
  /** Rush hour started; (x,y) = the worker it lands on. One per worker. */
  Rush: 23,
  /** The restaurant reached a new level (all its quests claimed). a = the new level */
  LevelUpRestaurant: 24,
  /** A crew started on a big upgrade here. a = seconds it takes */
  WorkStart: 25,
  /** A tap sped a job up. a = seconds taken off */
  WorkTap: 26,
  /** A big upgrade is done. a = the level it brought */
  WorkDone: 27,
  /** A branch opened in a new city; (x,y) = its door. a = trophies won, b = the city's number */
  Branch: 28,
  /** A VIP guest walked in. */
  VipArrives: 29,
  /** A VIP paid their bonus. a = coins, b = gems */
  Vip: 30,
  /** A present appeared on the sidewalk / was opened. a = coins, b = gems (opened) */
  GiftAppears: 31,
  Gift: 32,
  /** The daily gift was taken. a = coins, b = gems, c = the streak day */
  Daily: 33,
  /** The lucky wheel was spun. a = the segment it will stop on */
  WheelSpin: 34,
  /** The wheel's prize was taken. a = coins, b = gems, c = the segment */
  Wheel: 35,
  /** A promoter at (x,y) handed a flyer to the passer-by at (a,b); c = 1 if they come in. */
  Flyer: 36,
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
