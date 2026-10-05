import { TIERS } from '../../data/buildings';
import { DAY, ROLES, STAFF, type Role } from '../../data/staff';
import { TRAIT_FX } from '../../data/traits';
import { followPath, setPose } from '../movement';
import { chance, pick } from '../rng';
import { Emote, Expression } from '../types';
import { emote, route } from './customers';
import { emit, Ev } from './events';
import { clampStat, has, levelUpStat, rankOf, wageFor, xpToNext } from './people';
import type { GameState, Notice, Staff } from './types';

// The team over time: experience, energy, the daily payroll, raises, quitting, and everything
// the manager can do to a worker. Pure sim code; the UI only sends commands.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Omit applied to each variant of a union separately (plain Omit would merge them). */
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewNotice = DistOmit<Notice, 'id' | 'time'>;

export function notify(s: GameState, notice: NewNotice): void {
  s.notices.push({ ...notice, id: s.nextNoticeId++, time: s.time } as Notice);
}

/** How many people this job can take right now (cooks need a stove each). */
export function capacity(s: GameState, role: Role): number {
  return role === 'cook' ? s.stoves.length : ROLES[role].cap + (TIERS[s.map.tier]?.staff[role] ?? 0);
}

export function headcount(s: GameState, role: Role): number {
  return s.staff.filter((st) => st.role === role && !st.leaving).length + s.staff.filter((st) => st.pendingRole === role).length;
}

export const hasRoom = (s: GameState, role: Role) => headcount(s, role) < capacity(s, role);

export function gainXp(s: GameState, st: Staff): void {
  st.xp += STAFF.xp.perJob;
  while (st.xp >= xpToNext(st.level)) {
    st.xp -= xpToNext(st.level);
    levelUp(s, st);
  }
}

function levelUp(s: GameState, st: Staff): void {
  st.level += 1;
  const stat = levelUpStat(s.rng, st.role);
  st.stats[stat] = clampStat(st.stats[stat] + 1);
  st.rank = rankOf(st.level);
  emote(st, Emote.Star);
  emit(s, Ev.LevelUp, st.x, st.y, st.level);
}

/** Energy drains while working (stamina and workaholics resist) and refills while idle. */
function updateEnergy(s: GameState, st: Staff, dt: number): void {
  const e = STAFF.energy;
  if (st.busy) {
    if (!has(st, 'workaholic')) st.energy -= dt * e.drainPerSecond * Math.max(0.3, 1 - e.staminaPerPoint * (st.stats.stamina - 5));
  } else st.energy += dt * e.recoverPerSecond;
  st.energy = clamp01(st.energy);
  if (st.energy < e.tired) {
    st.expression = Expression.Sleepy;
    if (st.emote === 0 && chance(s.rng, dt / 6)) emote(st, Emote.Zzz);
  } else if (st.expression === Expression.Sleepy) st.expression = Expression.Happy;
}

/** Quitters and fired staff walk out of the door and down the street. */
export function walkOut(s: GameState, st: Staff, dt: number): void {
  if (st.path.length === 0) st.path = route(s, st, pick(s.rng, s.map.spawns));
  if (followPath(st, st.path, st.speed, dt)) s.staff.splice(s.staff.indexOf(st), 1);
}

/** Takes no new work and heads out once the hands are free. */
export function leave(s: GameState, st: Staff, angry: boolean): void {
  if (st.leaving) return;
  st.leaving = true;
  st.trial = false;
  st.expression = angry ? Expression.Angry : Expression.Neutral;
  emote(st, angry ? Emote.Anger : Emote.Exclaim);
  // Whatever they already started (a dish on its way, a table half wiped) they still finish.
  if (st.job?.kind === 'home') st.job = null;
  st.path = [];
  s.notices = s.notices.filter((n) => !('staff' in n) || n.staff !== st.id);
}

function quit(s: GameState, st: Staff, unpaid: boolean): void {
  notify(s, { kind: 'quit', name: st.name, role: st.role, unpaid });
  leave(s, st, true);
}

/** Pays everyone at the end of the day, in hiring order, while the money lasts. */
function payday(s: GameState): void {
  const m = STAFF.morale;
  let paid = s.coins.mul(0);
  let unpaid = 0;
  const team = s.staff.filter((st) => !st.leaving);
  for (const st of team) {
    if (s.coins.gte(st.wage)) {
      s.coins = s.coins.sub(st.wage);
      paid = paid.add(st.wage);
      st.unpaidDays = 0;
      st.morale += m.paid;
    } else {
      unpaid += 1;
      st.unpaidDays += 1;
      st.morale += m.unpaid;
      emote(st, Emote.Anger);
    }
  }
  for (const gossip of team.filter((st) => has(st, 'gossip'))) {
    for (const st of team) if (st !== gossip) st.morale += m.gossip;
  }
  for (const st of team) {
    st.morale = clamp01(st.morale);
    if (st.morale < m.quit || st.unpaidDays >= m.unpaidDaysToQuit) {
      quit(s, st, st.unpaidDays > 0);
      continue;
    }
    if (st.trial) notify(s, { kind: 'trial', staff: st.id });
    maybeAskRaise(s, st);
  }
  emit(s, Ev.Payday, 0, 0, paid.toNumber(), unpaid);
  if (team.length > 0) notify(s, { kind: 'payday', paid, unpaid });
}

/** Good, experienced people ask for more now and then (workaholics more often). */
function maybeAskRaise(s: GameState, st: Staff): void {
  const r = STAFF.raise;
  if (st.trial || st.level < r.minLevel || s.day - st.lastRaiseDay < r.minDaysBetween) return;
  if (s.notices.some((n) => n.kind === 'raise' && n.staff === st.id)) return;
  const odds = r.chance * (has(st, 'workaholic') ? TRAIT_FX.workaholicRaises : 1);
  if (!chance(s.rng, odds)) return;
  // At least the usual step, up to what the market pays now, but never more than +50 % at once.
  const market = wageFor(s, st.role, st.level, st.stats, st.traits);
  const step = st.wage.mul(1 + r.amount).ceil();
  const most = st.wage.mul(1 + r.maxAmount).ceil();
  const asked = market.gt(step) ? (market.lt(most) ? market : most) : step;
  notify(s, { kind: 'raise', staff: st.id, wage: asked });
  emote(st, Emote.Coin);
}

/** The day clock: energy every step, payday when a day ends. */
export function updateWorkers(s: GameState, dt: number): void {
  for (const st of s.staff) if (!st.leaving) updateEnergy(s, st, dt);
  s.dayTime += dt;
  if (s.dayTime >= DAY.seconds) {
    s.dayTime -= DAY.seconds;
    s.day += 1;
    payday(s);
  }
  // Information cards fade on their own; decisions wait for the manager.
  s.notices = s.notices.filter((n) => n.kind === 'raise' || n.kind === 'trial' || s.time - n.time < 12);
}

// ---------- manager actions ----------

const worker = (s: GameState, id: number) => s.staff.find((st) => st.id === id && !st.leaving);

export function fire(s: GameState, id: number): void {
  const st = worker(s, id);
  if (st) leave(s, st, false);
}

/** A day's wage as a bonus: a big morale boost. */
export function giveBonus(s: GameState, id: number): void {
  const st = worker(s, id);
  if (!st || s.coins.lt(st.wage)) return;
  s.coins = s.coins.sub(st.wage);
  st.morale = clamp01(st.morale + STAFF.morale.bonus);
  emote(st, Emote.Heart);
  emit(s, Ev.Burst, st.x, st.y);
}

export const trainingCost = (st: Staff) => st.wage.mul(STAFF.trainDays * st.level).ceil();

/** Paid training: one level up on the spot. */
export function train(s: GameState, id: number): void {
  const st = worker(s, id);
  if (!st) return;
  const cost = trainingCost(st);
  if (s.coins.lt(cost)) return;
  s.coins = s.coins.sub(cost);
  st.xp = 0;
  levelUp(s, st);
}

/** Works faster for a while, likes you less. */
export function scold(s: GameState, id: number): void {
  const st = worker(s, id);
  if (!st) return;
  st.morale = clamp01(st.morale + STAFF.morale.scold);
  st.scoldUntil = s.time + STAFF.scold.seconds;
  st.expression = Expression.Angry;
  emote(st, Emote.Exclaim);
}

/** Moves someone to another job (as soon as they finish what they hold), if there is room. */
export function reassign(s: GameState, id: number, role: Role): void {
  const st = worker(s, id);
  if (st && st.role !== role && hasRoom(s, role)) st.pendingRole = role;
}

/** Yes/no on a raise request or the end of a trial shift. */
export function answer(s: GameState, noticeId: number, yes: boolean): void {
  const n = s.notices.find((x) => x.id === noticeId);
  if (!n || (n.kind !== 'raise' && n.kind !== 'trial')) return;
  s.notices.splice(s.notices.indexOf(n), 1);
  const st = worker(s, n.staff);
  if (!st) return;
  if (n.kind === 'raise') {
    st.lastRaiseDay = s.day;
    if (yes) {
      st.wage = n.wage;
      st.morale = clamp01(st.morale + STAFF.morale.raiseYes);
      emote(st, Emote.Heart);
    } else {
      st.morale = clamp01(st.morale + STAFF.morale.raiseNo);
      emote(st, Emote.Anger);
    }
    return;
  }
  // Trial over: keeping them costs the signing fee now.
  const fee = st.wage.mul(STAFF.signingDays).ceil();
  if (yes && s.coins.gte(fee)) {
    s.coins = s.coins.sub(fee);
    st.trial = false;
    emote(st, Emote.Heart);
  } else leave(s, st, false);
}
