/**
 * The railway (the hub): a commuter train calls at the station by Terminal 3
 * on a fixed timetable (a pure function of the game clock). Some departing
 * passengers get off it and walk to the terminal; some arriving ones walk to
 * the platform and leave on the next train.
 */
import type { Rail } from '../../data/tiers';
import { hash01 } from '../hash';
import { PST, type GameState } from './types';

/** Seconds between trains, and the parts of a call. */
export const RAIL_PERIOD = 80;
const IN = 14;
const DWELL = 16;
const OUT = 14;
/** How far off the train is when it starts braking (and after it pulls out). */
const RUN = 60;
/** Cars and their length (tiles). */
export const RAIL_CARS = 5;
export const RAIL_CAR = 1.6;

export interface RailTrain {
  /** Middle of the train along the track. */
  x: number;
  /** In the station with the doors open, and for how long. */
  dwell: boolean;
  dwellT: number;
  /** On the map at all. */
  shown: boolean;
}

/** Where the train is at this time. */
export function railTrain(r: Rail, time: number): RailTrain {
  const t = ((time % RAIL_PERIOD) + RAIL_PERIOD) % RAIL_PERIOD;
  if (t < IN) {
    const k = 1 - t / IN;
    return { x: r.stop - RUN * k * k, dwell: false, dwellT: 0, shown: true };
  }
  if (t < IN + DWELL) return { x: r.stop, dwell: true, dwellT: t - IN, shown: true };
  if (t < IN + DWELL + OUT) {
    const k = (t - IN - DWELL) / OUT;
    return { x: r.stop + RUN * k * k, dwell: false, dwellT: 0, shown: true };
  }
  return { x: r.stop, dwell: false, dwellT: 0, shown: false };
}

/** Does this departing passenger come by train (only while one is in)? */
export function comesByTrain(r: Rail, time: number, id: number): boolean {
  return railTrain(r, time).dwell && hash01(id * 29 + 11) < 0.7;
}

/** Does this arriving passenger leave by train? */
export function leavesByTrain(id: number): boolean {
  return hash01(id * 31 + 13) < 0.3;
}

/** A spot by the train doors on the platform. */
export function railSpot(r: Rail, id: number): [number, number] {
  const half = (RAIL_CARS * RAIL_CAR) / 2 - 0.4;
  const x = Math.max(r.platform[0] + 0.2, Math.min(r.platform[2] - 0.2, r.stop + (hash01(id * 43 + 1) * 2 - 1) * half));
  return [x, r.platform[1] + 0.15 + hash01(id * 47 + 2) * (r.platform[3] - r.platform[1] - 0.3)];
}

/** People waiting on the platform board the train while it is in (after those getting off, one by one). */
export function updateRail(s: GameState, r: Rail | undefined): void {
  if (!r) return;
  const t = railTrain(r, s.time);
  if (!t.dwell || t.dwellT < 4) return;
  let w = 0;
  let boarded = false;
  for (let i = 0; i < s.people.length; i++) {
    const p = s.people[i];
    // (a few a second)
    if (p.state === PST.atRail && !boarded && s.tick % 6 === 0) {
      boarded = true;
      continue;
    }
    s.people[w++] = p;
  }
  s.people.length = w;
}
