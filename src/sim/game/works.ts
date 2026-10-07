import type { Point } from '../../data/maps';
import { WORKS } from '../../data/works';
import { upgradeDef } from '../economy/upgrades';
import { crewCount, gemsToFinish, workSeconds, type Crews } from '../economy/works';
import { emit, Ev } from './events';
import type { GameState, Work } from './types';

// Big upgrades in progress (src/data/works.ts): a crew works on the site for a while, then the
// level counts. Tapping the site speeds it up a little; gems finish it at once.

/** The crews and their jobs, for planning a purchase. */
export const crewsOf = (s: GameState): Crews => ({ works: s.works, crews: crewCount(s.perks) });

/** A crew starts on level `level + 1` of `item` (already paid for). */
export function startWork(s: GameState, item: string, level: number, at: Point | null, site: Point): Work {
  const total = workSeconds(upgradeDef(item), level);
  const w: Work = { id: s.nextWorkId++, item, level: level + 1, total, left: total, at, lastTap: -Infinity };
  s.works.push(w);
  emit(s, Ev.WorkStart, site.x, site.y, total);
  return w;
}

/** Counts the jobs down; `finish` applies the level of each one that is done. */
export function updateWorks(s: GameState, dt: number, finish: (w: Work) => void): void {
  if (s.works.length === 0) return;
  for (const w of s.works) w.left -= dt;
  const done = s.works.filter((w) => w.left <= 0);
  if (done.length === 0) return;
  s.works = s.works.filter((w) => w.left > 0);
  for (const w of done) finish(w);
}

/** A tap on the work site: a little less to wait (at most a few taps a second count). */
export function hurryWork(s: GameState, id: number, site: Point): boolean {
  const w = s.works.find((x) => x.id === id);
  if (!w || s.time - w.lastTap < WORKS.tapEvery) return false;
  w.lastTap = s.time;
  const cut = Math.min(w.left, Math.max(WORKS.tapMin, w.total * WORKS.tapShare));
  w.left -= cut;
  emit(s, Ev.WorkTap, site.x, site.y, cut);
  return true;
}

/** Gems: done now (it counts on the next step). */
export function finishWorkNow(s: GameState, id: number): boolean {
  const w = s.works.find((x) => x.id === id);
  if (!w) return false;
  const gems = gemsToFinish(w.left);
  if (s.gems < gems) return false;
  s.gems -= gems;
  w.left = 0;
  return true;
}

/** Time skipped (a time warp from the shop): every job moves on by that much. */
export function advanceWorks(s: GameState, seconds: number): void {
  for (const w of s.works) w.left = Math.max(0, w.left - seconds);
}

/** The tile a decor job keeps free, if it is this one. */
export const reservedBy = (s: GameState, x: number, y: number): boolean =>
  s.works.some((w) => w.at !== null && Math.floor(w.at.x) === Math.floor(x) && Math.floor(w.at.y) === Math.floor(y));
