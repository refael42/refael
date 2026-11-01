import { CELEB, CELEBS } from '../data/celebs';
import { celebArrives, seatAt, tableFor } from './game/customers';
import { emit, Ev } from './game/events';
import { CustomerState, type GameState } from './game/types';
import { hash01 } from './retention';

// Celebrities (src/data/celebs.ts): the limo, the star at the door, their table, and the limo
// leaving with them. What they pay and what five stars bring is in pay() (customers.ts). Not
// saved (a visit in progress is simply over when the game closes); the dice are left alone.

export interface CelebState {
  next: number;
  /** The visit on now: who, where it is (the limo driving up, the star at the door or at a table), and the star (customer id). */
  visit: { celeb: number; phase: 'limo' | 'door' | 'seated'; at: number; customer: number; arrived: number } | null;
  count: number;
  /** When the last limo pulled away (sim time; it drives off for a few seconds). */
  leftAt: number;
}

export const newCelebs = (): CelebState => ({ next: CELEB.firstAfter, visit: null, count: 0, leftAt: -Infinity });

/** Where the limo stops: in the lane by the curb, just left of the door (the bus stops right of it). */
export const limoStop = (s: GameState): { x: number; y: number } => {
  const door = s.map.doors[0]?.outside ?? s.map.queue[0]!;
  return { x: door.x - 2.2, y: s.map.busStop.y };
};

const gap = (s: GameState) => CELEB.every[0] + hash01(s.celebs.count * 2.77 + 0.5) * (CELEB.every[1] - CELEB.every[0]);

/** The next star: one not met yet first (the album shows who is missing). */
function whoNext(s: GameState): number {
  const unmet = CELEBS.map((c, i) => ((s.album.counts[c.id] ?? 0) === 0 ? i : -1)).filter((i) => i >= 0);
  const pool = unmet.length > 0 ? unmet : CELEBS.map((_, i) => i);
  return pool[Math.floor(hash01(s.celebs.count * 5.9 + 0.3) * pool.length)]!;
}

function end(s: GameState): void {
  if (s.celebs.visit) s.celebs.leftAt = s.time;
  s.celebs.visit = null;
  s.celebs.next = s.time + gap(s);
}

export function updateCelebs(s: GameState): void {
  const c = s.celebs;
  const v = c.visit;
  if (!v) {
    if (s.time < c.next || s.stats.served < CELEB.minServed || s.construction || s.closed) return;
    c.count += 1;
    c.visit = { celeb: whoNext(s), phase: 'limo', at: s.time + CELEB.driveSeconds, customer: -1, arrived: s.time };
    const at = limoStop(s);
    emit(s, Ev.CelebComing, at.x, at.y, c.visit.celeb);
    return;
  }
  if (s.construction) {
    end(s);
    return;
  }
  if (v.phase === 'limo') {
    if (s.time < v.at) return;
    const at = limoStop(s);
    const star = celebArrives(s, CELEBS[v.celeb]!.look, { x: at.x + 0.4, y: at.y - 0.9 }, v.celeb);
    v.customer = star.id;
    v.phase = 'door';
    emit(s, Ev.CelebArrive, star.x, star.y, v.celeb);
    return;
  }
  const star = s.customers.find((m) => m.id === v.customer);
  if (!star || star.state === CustomerState.Leaving) {
    end(s);
    return;
  }
  if (v.phase === 'door' && star.state === CustomerState.Queued) {
    const table = tableFor(s, 1, star);
    if (table) {
      seatAt(s, star, table);
      v.phase = 'seated';
    }
  }
}
