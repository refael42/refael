import { RESTROOM } from '../../data/restroom';
import { followPath, setPose } from '../movement';
import { hash01 } from '../retention';
import { Emote, Expression, Facing, Pose, PropKind } from '../types';
import { changeRating, emote, route, sendHome } from './customers';
import { emit, Ev } from './events';
import { restroomReview } from './reviews';
import type { Customer, GameState, Staff } from './types';
import { CustomerState } from './types';
import { gainXp, headcount } from './workers';

// The restroom (owner M36: "add restrooms, and a cleaner who keeps the restaurant tidy and cleans
// the restrooms"). Some guests who have paid drop in on their way out: they wait at the door for
// a free stall, go in (the door shuts, they are not drawn), wash their hands at the sink and
// leave. Every visit dirties it a little. A cleaner comes to mop it once it is a bit dirty; with
// no cleaner on the team, a waiter does when it is really bad. Guests who find it dirty frown,
// cost some rating, and now and then write about it. Numbers in src/data/restroom.ts.

/** A guest who just paid: to the restroom first (now and then), else straight home. */
export function leaveAfterMeal(s: GameState, c: Customer): void {
  sendHome(s, c);
  if (s.construction || c.inspector || hash01(c.id * 2.371 + 0.13) >= RESTROOM.visitChance) return;
  // A line longer than the stalls and a couple waiting: not worth it, home it is.
  const visiting = s.customers.filter((m) => m.state === CustomerState.Restroom).length;
  if (visiting >= s.restroom.stalls.length + 2) return;
  const path = route(s, c, s.map.restroom.wait);
  if (path.length === 0) return;
  c.path = path;
  c.wc = { step: 'toDoor', stall: -1, until: 0 };
  c.state = CustomerState.Restroom;
  c.stateTime = 0;
}

/** Done (or given up): off home from wherever they are. */
function goHome(s: GameState, c: Customer): void {
  if (c.wc && c.wc.stall >= 0 && s.restroom.stalls[c.wc.stall] === c.id) s.restroom.stalls[c.wc.stall] = -1;
  c.wc = undefined;
  c.hidden = false;
  sendHome(s, c);
}

const freeStall = (s: GameState): number => s.restroom.stalls.indexOf(-1);

function enterStall(s: GameState, c: Customer, stall: number): void {
  s.restroom.stalls[stall] = c.id;
  c.wc = { step: 'toStall', stall, until: 0 };
  c.path = route(s, c, s.map.restroom.stalls[stall]!);
}

export function updateRestroomGuest(s: GameState, c: Customer, dt: number): void {
  const wc = c.wc;
  const room = s.map.restroom;
  if (!wc) return goHome(s, c);
  switch (wc.step) {
    case 'toDoor':
      if (!followPath(c, c.path, c.walkSpeed, dt)) return;
      setPose(c, Pose.Idle);
      c.facing = Facing.BackLeft;
      if (freeStall(s) >= 0) return enterStall(s, c, freeStall(s));
      c.wc = { step: 'wait', stall: -1, until: s.time + RESTROOM.waitSeconds };
      return;
    case 'wait':
      if (freeStall(s) >= 0) return enterStall(s, c, freeStall(s));
      // Waited too long: home, a little cross.
      if (s.time >= wc.until) {
        emote(c, Emote.Anger);
        goHome(s, c);
      }
      return;
    case 'toStall':
      if (!followPath(c, c.path, c.walkSpeed, dt)) return;
      c.hidden = true;
      setPose(c, Pose.Idle);
      c.wc = { ...wc, step: 'inside', until: s.time + RESTROOM.useSeconds[0] + hash01(c.id * 5.17) * (RESTROOM.useSeconds[1] - RESTROOM.useSeconds[0]) };
      return;
    case 'inside':
      if (s.time < wc.until) return;
      s.restroom.stalls[wc.stall] = -1;
      s.restroom.dirt = Math.min(1, s.restroom.dirt + RESTROOM.dirtPerUse);
      c.hidden = false;
      c.wc = { step: 'toSink', stall: -1, until: 0 };
      c.path = route(s, c, room.sink);
      return;
    case 'toSink':
      if (!followPath(c, c.path, c.walkSpeed, dt)) return;
      setPose(c, Pose.Wash);
      c.facing = Facing.BackRight;
      c.wc = { step: 'wash', stall: -1, until: s.time + RESTROOM.washSeconds };
      judge(s, c);
      return;
    case 'wash':
      if (s.time >= wc.until) goHome(s, c);
      return;
  }
}

/** What the guest makes of the place: a frown and a word to others when it is dirty, now and then a smile when it shines. */
function judge(s: GameState, c: Customer): void {
  const dirt = s.restroom.dirt;
  if (dirt >= RESTROOM.dirtyAt) {
    emote(c, Emote.Anger);
    c.expression = Expression.Angry;
    changeRating(s, RESTROOM.rating, c);
    restroomReview(s, c);
  } else if (dirt < RESTROOM.cleanAt / 2 && hash01(c.id * 0.913 + 0.4) < RESTROOM.sparkleChance) emote(c, Emote.Heart);
}

// ---------- the cleaner ----------

/** Should this worker go and mop the restroom now? (Cleaners from a little dirty; waiters only if nobody else will, when it is bad.) */
export function restroomJob(s: GameState, st: Staff): boolean {
  if (s.restroom.cleaner >= 0 || s.construction) return false;
  const dirt = s.restroom.dirt;
  if (st.role === 'cleaner') return dirt >= RESTROOM.cleanAt;
  return st.role === 'waiter' && headcount(s, 'cleaner') === 0 && dirt >= RESTROOM.waiterAt;
}

/** A worker takes the restroom job. */
export function takeRestroom(s: GameState, st: Staff): void {
  s.restroom.cleaner = st.id;
  st.path = [];
  st.job = { kind: 'restroom', phase: 'toRoom' };
  st.jobTime = 0;
}

/**
 * The mopping: to the room, then a while at it (longer the dirtier it was, quicker for a fast
 * worker); then it shines. Returns false once done (the worker is free again).
 */
export function updateRestroomJob(s: GameState, st: Staff, dt: number, walkTo: (to: { x: number; y: number }) => boolean, rate: number): boolean {
  const job = st.job as Extract<Staff['job'], { kind: 'restroom' }>;
  if (job.phase === 'toRoom') {
    if (!walkTo(s.map.restroom.mop)) return true;
    setPose(st, Pose.Wash);
    st.facing = Facing.BackLeft;
    st.job = { kind: 'restroom', phase: 'mop' };
    st.jobTime = 0;
    return true;
  }
  st.jobTime += dt * rate;
  if (st.jobTime < RESTROOM.cleanSeconds * Math.max(0.3, s.restroom.dirt)) return true;
  s.restroom.dirt = 0;
  s.restroom.cleaner = -1;
  emit(s, Ev.Burst, s.map.restroom.mop.x, s.map.restroom.mop.y);
  gainXp(s, st);
  return false;
}

/** The worker mopping it left (fired, quit, moved): someone else can take it. */
export function releaseRestroom(s: GameState): void {
  // A stall whose guest left another way (sent home when the place closed) is free again.
  const stalls = s.restroom.stalls;
  for (let i = 0; i < stalls.length; i++) {
    const id = stalls[i]!;
    if (id >= 0 && !s.customers.some((c) => c.id === id && c.state === CustomerState.Restroom)) stalls[i] = -1;
  }
  if (s.restroom.cleaner >= 0 && !s.staff.some((st) => st.id === s.restroom.cleaner && st.job?.kind === 'restroom' && !st.leaving)) s.restroom.cleaner = -1;
}

/** The room's pieces show who is in, and how dirty it is (static props, updated in place). */
export function updateRestroomProps(s: GameState): void {
  const level = Math.round(s.restroom.dirt * 100);
  let stall = 0;
  const washing = s.customers.some((c) => c.state === CustomerState.Restroom && c.wc?.step === 'wash');
  for (const p of s.props) {
    if (p.kind === PropKind.WcStall) {
      p.active = (s.restroom.stalls[stall] ?? -1) >= 0;
      p.level = level;
      stall++;
    } else if (p.kind === PropKind.WcSink) {
      p.active = washing;
      p.level = level;
    }
  }
}
