import type { Point } from '../../data/maps';
import { CARE } from '../../data/staff';
import { setPose } from '../movement';
import { Emote, Expression, Facing, Held, Pose } from '../types';
import { emote } from './customers';
import { charmOf, workRate } from './people';
import { CustomerState, type Customer, type GameState, type Staff, type Table } from './types';

// Table care (owner: "waiters stand around doing nothing while there is lots of work"). A waiter
// only carries what the kitchen and the bar have ready, so with a slow kitchen most of them used
// to wait at their spot. Now a free one goes round the tables where guests wait for their food:
// a glass of water, "is everything all right?" - a little patience back. Numbers in CARE.

/** Does this guest want a visit now? */
function wants(s: GameState, c: Customer): boolean {
  if (c.state !== CustomerState.Waiting || c.table < 0 || c.patienceMax <= 0) return false;
  const done = c.cared ?? 0;
  if (done >= CARE.visits) return false;
  return done === 0 ? c.stateTime >= CARE.firstAfter : c.patienceLeft / c.patienceMax < CARE.againBelow;
}

/** The table that needs it most (its guest closest to losing patience), not already being seen to. */
export function careTable(s: GameState): Table | undefined {
  const taken = new Set<number>();
  for (const st of s.staff) if (st.job?.kind === 'care') taken.add(st.job.table);
  let best: Table | undefined;
  let bestLeft = 2;
  for (const c of s.customers) {
    if (taken.has(c.table) || !wants(s, c)) continue;
    const left = c.patienceLeft / c.patienceMax;
    if (left < bestLeft) {
      bestLeft = left;
      best = s.tables[c.table];
    }
  }
  return best;
}

/** Walk over with the water, pour it for everyone at the table who wants it. Returns false once done. */
export function updateCare(s: GameState, st: Staff, dt: number, walkTo: (to: Point) => boolean, beside: (t: Table) => Point): boolean {
  const job = st.job as Extract<Staff['job'], { kind: 'care' }>;
  const t = s.tables[job.table];
  const guests = t ? s.customers.filter((c) => c.table === t.index && wants(s, c)) : [];
  // They were fed (or left) on the way: nothing to do here.
  if (!t || guests.length === 0) return false;
  if (job.phase === 'walk') {
    st.held = Held.Glass;
    if (!walkTo(beside(t))) return true;
    setPose(st, Pose.Idle);
    st.facing = Facing.BackRight;
    st.job = { kind: 'care', table: t.index, phase: 'pour' };
    st.jobTime = 0;
    return true;
  }
  st.jobTime += dt * workRate(s, st);
  if (st.jobTime < CARE.pourSeconds) return true;
  const back = CARE.patience * charmOf(st);
  for (const c of guests) {
    c.cared = (c.cared ?? 0) + 1;
    c.patienceLeft = Math.min(c.patienceMax, c.patienceLeft + c.patienceMax * back);
    c.expression = Expression.Happy;
  }
  // No XP for it: a pour is a moment's work, and XP brings raises (the wage bill stays as it was).
  emote(guests[0]!, Emote.Heart);
  return false;
}
