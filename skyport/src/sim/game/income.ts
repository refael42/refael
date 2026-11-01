/**
 * Income history in one-minute buckets (sim time), with a breakdown by
 * source. Used for "best value", the balance bot and offline earnings.
 */
import type { GameState } from './types';

export const BUCKET_SECONDS = 60;
export const BUCKETS = 10;

export interface IncomeState {
  /** Finished buckets, newest last. */
  hist: number[];
  /** Same, per source: [landing, parking, pax, kiosk] and departing pax. */
  histComp: number[][];
  cur: number;
  curComp: number[];
  curStart: number;
}

export function makeIncome(): IncomeState {
  return { hist: [], histComp: [], cur: 0, curComp: [0, 0, 0, 0, 0], curStart: 0 };
}

export function rollIncome(s: GameState): void {
  const inc = s.income;
  while (s.time - inc.curStart >= BUCKET_SECONDS) {
    inc.hist.push(inc.cur);
    inc.histComp.push(inc.curComp);
    if (inc.hist.length > BUCKETS) {
      inc.hist.shift();
      inc.histComp.shift();
    }
    inc.cur = 0;
    inc.curComp = [0, 0, 0, 0, 0];
    inc.curStart += BUCKET_SECONDS;
  }
}

/** landing, parking, pax, kiosk coins and departing passengers of one flight. */
export function recordIncome(s: GameState, total: number, parts: [number, number, number, number], pax: number): void {
  const inc = s.income;
  inc.cur += total;
  for (let i = 0; i < 4; i++) inc.curComp[i] += parts[i];
  inc.curComp[4] += pax;
}

/** Coins per second over the recent past (current partial bucket included). */
export function incomeRate(s: GameState): number {
  const inc = s.income;
  const n = Math.min(5, inc.hist.length);
  let sum = inc.cur;
  for (let i = inc.hist.length - n; i < inc.hist.length; i++) sum += inc.hist[i];
  const secs = n * BUCKET_SECONDS + Math.max(1, s.time - inc.curStart);
  return sum / secs;
}

export function componentRates(s: GameState): { landing: number; parking: number; pax: number; kiosk: number; paxPerSec: number } {
  const inc = s.income;
  const n = Math.min(5, inc.histComp.length);
  const sum = inc.curComp.slice();
  for (let i = inc.histComp.length - n; i < inc.histComp.length; i++) for (let k = 0; k < 5; k++) sum[k] += inc.histComp[i][k] ?? 0;
  const secs = n * BUCKET_SECONDS + Math.max(1, s.time - inc.curStart);
  return { landing: sum[0] / secs, parking: sum[1] / secs, pax: sum[2] / secs, kiosk: sum[3] / secs, paxPerSec: sum[4] / secs };
}
