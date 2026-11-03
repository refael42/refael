/**
 * Staff: applicants who arrive on their own (rarity, traits, level, talents),
 * hiring / negotiating / trial shifts, wages and raises, experience, energy
 * and mood, firing and transfers, and the automatic work each role does.
 * All randomness here uses hash01(...) so the shared RNG stays untouched.
 */
import { CV_LINES, FIRST_NAMES, LAST_NAMES, RARITIES, STAFF_ROLES, TALENT_MAX, TALENTS, TRAITS, type TraitId } from '../../data/staff';
import { Big } from '../big';
import { hash01, hashU32 } from '../hash';
import { DAY_SECONDS, gameClock } from './clock';
import { pushEvent } from './events';
import { clearLanding, clearTakeoff, freeStand, startBoarding, wantsAction } from './flights';
import { REJECT, WANT, type Applicant, type Flight, type GameState, type StaffMember } from './types';
import { effects } from './upgrades';
import { requestService } from './vehicles';

/** Most workers of one role. */
export const MAX_PER_ROLE = 2;
export const MAX_APPLICANTS = 5;
export const APPLICANT_LIFETIME = 600;
export const TRIAL_SECONDS = 120;
export const MAX_LEVEL = 30;
const T = (id: TraitId) => TRAITS.findIndex((t) => t.id === id);
const TRAIT = {
  diligent: T('diligent'),
  clumsy: T('clumsy'),
  charming: T('charming'),
  nightOwl: T('nightOwl'),
  gossip: T('gossip'),
  workaholic: T('workaholic'),
};
const TAL = { speed: 0, stamina: 1, precision: 2, charm: 3, efficiency: 4, loyalty: 5 };

/** Per-game hash: the seed makes every game's people different. */
function gh(s: GameState, n: number): number {
  return hash01(hashU32(s.seed) + n);
}

function pick(weights: readonly number[], u: number): number {
  const total = weights.reduce((a, w) => a + w, 0);
  let r = u * total;
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return weights.length - 1;
}

/** Fair daily wage for a role at a rarity and level. */
export function marketWage(role: number, rarity: number, level: number): number {
  return STAFF_ROLES[role].wage * RARITIES[rarity].wageMul * (1 + 0.08 * (level - 1));
}

export function xpForLevel(level: number): number {
  return Math.round(8 * Math.pow(level, 1.5));
}

export function makeApplicant(s: GameState, role: number, maxRarity = RARITIES.length - 1): Applicant {
  const id = s.nextId++;
  const h = (k: number) => gh(s, id * 97 + k);
  const rarity = Math.min(maxRarity, pick(RARITIES.map((r) => r.weight), h(1)));
  const R = RARITIES[rarity];
  const level = R.levels[0] + Math.floor(h(2) * (R.levels[1] - R.levels[0] + 1));
  const base = 0.8 + h(3) * 0.5;
  const speed = Math.round(base * R.statMul * 100) / 100;
  // one trait, sometimes two (rarer people tend to have good ones)
  const traits: number[] = [];
  const nTraits = h(4) < 0.35 + rarity * 0.1 ? 2 : 1;
  for (let k = 0; k < nTraits; k++) {
    const w = TRAITS.map((t, i) => (traits.includes(i) ? 0 : t.weight * (t.good ? 1 + rarity * 0.4 : 1)));
    traits.push(pick(w, h(5 + k)));
  }
  const talents = TALENTS.map(() => 0);
  for (let p = 0; p < level - 1; p++) {
    const t = Math.floor(h(10 + p) * TALENTS.length);
    if (talents[t] < TALENT_MAX) talents[t]++;
  }
  const wage = Math.round(marketWage(role, rarity, level) * (0.75 + 0.25 * base));
  return {
    id,
    role,
    first: Math.floor(h(30) * FIRST_NAMES.length),
    last: Math.floor(h(31) * LAST_NAMES.length),
    speed,
    rarity,
    traits,
    level,
    talents,
    cv: Math.floor(h(32) * CV_LINES),
    wage,
    cost: Math.round(STAFF_ROLES[role].hireCost * R.wageMul * (0.8 + 0.2 * base) * (1 + 0.1 * (level - 1))),
    arrivedAt: s.time,
    expiresAt: s.time + APPLICANT_LIFETIME,
    negotiated: false,
  };
}

/** Start of a game: one modest applicant for every unlocked role. */
export function refreshApplicants(s: GameState): void {
  let k = 0;
  STAFF_ROLES.forEach((r, i) => {
    if (r.unlockTier > s.tier) return;
    if (s.applicants.some((a) => a.role === i)) return;
    const a = makeApplicant(s, i, 1);
    // stagger departures so the list never empties all at once
    a.expiresAt += k++ * 150;
    s.applicants.push(a);
  });
}

/** New applicants arrive over time; old ones move on. */
export function updateApplicants(s: GameState): void {
  const before = s.applicants.length;
  s.applicants = s.applicants.filter((a) => a.expiresAt > s.time);
  if (s.applicants.length !== before) pushEvent(s, 'applicantLeft', 0, 0, 0);
  if (s.time < s.nextApplicantAt) return;
  const seq = s.nextId;
  s.nextApplicantAt = s.time + 75 + gh(s, seq * 13 + 1) * 60;
  if (s.applicants.length >= MAX_APPLICANTS) return;
  // prefer roles you have few of
  const roles = STAFF_ROLES.map((r, i) => (r.unlockTier > s.tier ? 0 : 1 / (1 + staffCount(s, i) + s.applicants.filter((a) => a.role === i).length)));
  const role = pick(roles, gh(s, seq * 13 + 2));
  const a = makeApplicant(s, role);
  s.applicants.push(a);
  pushEvent(s, 'applicantArrived', 0, 0, a.role, a.rarity, a.id);
}

export function staffCount(s: GameState, role: number): number {
  let n = 0;
  for (const m of s.staff) if (m.role === role) n++;
  return n;
}

function toMember(s: GameState, a: Applicant): StaffMember {
  return {
    id: a.id,
    role: a.role,
    first: a.first,
    last: a.last,
    speed: a.speed,
    rarity: a.rarity,
    traits: a.traits.slice(),
    level: a.level,
    talents: a.talents.slice(),
    cv: a.cv,
    wage: a.wage,
    hiredAt: s.time,
    busyUntil: s.time + 1,
    xp: 0,
    points: 0,
    mood: 0.75,
    energy: 1,
    breakUntil: 0,
    trialUntil: 0,
    trialCost: 0,
    raise: 0,
    raiseAt: 0,
  };
}

function takeApplicant(s: GameState, applicantId: number): Applicant | number {
  const i = s.applicants.findIndex((a) => a.id === applicantId);
  if (i < 0) return REJECT.unknownFlight;
  const a = s.applicants[i];
  if (staffCount(s, a.role) >= MAX_PER_ROLE) return REJECT.limit;
  return a;
}

export function hire(s: GameState, applicantId: number): number {
  const a = takeApplicant(s, applicantId);
  if (typeof a === 'number') return a;
  if (s.money.lt(a.cost)) return REJECT.noMoney;
  s.money = s.money.sub(a.cost);
  s.staff.push(toMember(s, a));
  s.applicants = s.applicants.filter((x) => x.id !== a.id);
  pushEvent(s, 'hired', 0, 0, a.role, a.id);
  return 0;
}

/** Try your luck for a lower wage and fee. One attempt; they may walk away. */
export function negotiate(s: GameState, applicantId: number): number {
  const a = s.applicants.find((x) => x.id === applicantId);
  if (!a) return REJECT.unknownFlight;
  if (a.negotiated) return REJECT.limit;
  a.negotiated = true;
  const chance = [0.7, 0.55, 0.4, 0.25, 0.15][a.rarity] ?? 0.5;
  if (gh(s, a.id * 131 + 17) < chance) {
    a.wage = Math.max(1, Math.round(a.wage * 0.85));
    a.cost = Math.max(1, Math.round(a.cost * 0.9));
    pushEvent(s, 'negotiated', 0, 0, 1, 0, a.id);
  } else {
    s.applicants = s.applicants.filter((x) => x.id !== a.id);
    pushEvent(s, 'negotiated', 0, 0, 0, 0, a.id);
  }
  return 0;
}

/** Works for free (only wage) for a while; then you decide. */
export function startTrial(s: GameState, applicantId: number): number {
  const a = takeApplicant(s, applicantId);
  if (typeof a === 'number') return a;
  if (s.staff.some((m) => m.trialUntil > 0)) return REJECT.limit; // one trial at a time
  const m = toMember(s, a);
  m.trialUntil = s.time + TRIAL_SECONDS;
  m.trialCost = a.cost;
  s.staff.push(m);
  s.applicants = s.applicants.filter((x) => x.id !== a.id);
  return 0;
}

export function confirmTrial(s: GameState, staffId: number, keep: boolean): number {
  const m = s.staff.find((x) => x.id === staffId);
  if (!m || m.trialUntil <= 0) return REJECT.unknownFlight;
  if (keep) {
    if (s.money.lt(m.trialCost)) return REJECT.noMoney;
    s.money = s.money.sub(m.trialCost);
    m.trialUntil = 0;
    m.trialCost = 0;
    pushEvent(s, 'hired', 0, 0, m.role, m.id);
  } else {
    s.staff = s.staff.filter((x) => x !== m);
  }
  return 0;
}

export function fire(s: GameState, staffId: number): number {
  const m = s.staff.find((x) => x.id === staffId);
  if (!m) return REJECT.unknownFlight;
  s.staff = s.staff.filter((x) => x !== m);
  for (const o of s.staff) o.mood = Math.max(0, o.mood - 0.05);
  pushEvent(s, 'fired', 0, 0, m.role, m.id);
  return 0;
}

export function transfer(s: GameState, staffId: number, role: number): number {
  const m = s.staff.find((x) => x.id === staffId);
  if (!m || role < 0 || role >= STAFF_ROLES.length || STAFF_ROLES[role].unlockTier > s.tier) return REJECT.unknownFlight;
  if (m.role === role) return 0;
  if (staffCount(s, role) >= MAX_PER_ROLE) return REJECT.limit;
  m.role = role;
  m.mood = Math.max(0, m.mood - 0.05);
  m.busyUntil = s.time + 5;
  return 0;
}

export function spendTalent(s: GameState, staffId: number, talent: number): number {
  const m = s.staff.find((x) => x.id === staffId);
  if (!m || talent < 0 || talent >= TALENTS.length) return REJECT.unknownFlight;
  if (m.points <= 0 || m.talents[talent] >= TALENT_MAX) return REJECT.limit;
  m.points--;
  m.talents[talent]++;
  return 0;
}

/** 0 decline, 1 accept, 2 counter-offer half the raise. */
export function answerRaise(s: GameState, staffId: number, answer: number): number {
  const m = s.staff.find((x) => x.id === staffId);
  if (!m || m.raise <= 0) return REJECT.unknownFlight;
  const ask = m.raise;
  m.raise = 0;
  if (answer === 1) {
    m.wage += ask;
    m.mood = Math.min(1, m.mood + 0.15);
  } else if (answer === 2) {
    const ok = gh(s, m.id * 211 + m.wage) < 0.35 + 0.5 * m.mood + 0.04 * m.talents[TAL.loyalty];
    if (ok) {
      m.wage += Math.max(1, Math.round(ask / 2));
      m.mood = Math.min(1, m.mood + 0.05);
    } else m.mood = Math.max(0, m.mood - 0.15);
    pushEvent(s, 'raiseAnswered', 0, 0, ok ? 1 : 0, 0, m.id);
    return 0;
  } else {
    m.mood = Math.max(0, m.mood - 0.25 + 0.03 * m.talents[TAL.loyalty]);
  }
  pushEvent(s, 'raiseAnswered', 0, 0, answer === 1 ? 1 : 0, 0, m.id);
  return 0;
}

function isNight(time: number): boolean {
  const h = gameClock(time).hour;
  return h >= 20 || h < 6;
}

/** How fast a worker reacts and works right now (1 = average). */
export function workerSpeed(s: GameState, m: StaffMember): number {
  let v = m.speed * (1 + 0.03 * (m.level - 1)) * (1 + 0.05 * m.talents[TAL.speed]) * effects(s).staffSpeed;
  if (m.traits.includes(TRAIT.diligent)) v *= 1.1;
  if (m.traits.includes(TRAIT.nightOwl)) v *= isNight(s.time) ? 1.2 : 0.94;
  return v * (0.8 + 0.4 * m.mood);
}

/** Pays wages once per game day and handles raise requests. */
export function payWages(s: GameState): void {
  const day = gameClock(s.time).day;
  if (day <= s.wageDay) return;
  s.wageDay = day;
  let total = 0;
  for (const m of s.staff) total += m.wage;
  if (total > 0) {
    const amount = Big.fromNumber(total);
    s.money = s.money.gte(amount) ? s.money.sub(amount) : Big.ZERO;
    s.stats.wages = s.stats.wages.add(amount);
    pushEvent(s, 'wagesPaid', 0, 0, total);
  }
  // at most one raise request open at a time
  if (s.staff.some((m) => m.raise > 0)) return;
  for (const m of s.staff) {
    if (m.trialUntil > 0) continue;
    const fair = marketWage(m.role, m.rarity, m.level);
    let chance = 0.04 + 0.015 * m.level - 0.012 * m.talents[TAL.loyalty];
    if (m.traits.includes(TRAIT.workaholic)) chance += 0.05;
    if (m.wage > fair * 1.15) chance *= 0.3;
    if (gh(s, m.id * 977 + day * 13) < chance) {
      m.raise = Math.max(2, Math.round(m.wage * 0.2));
      m.raiseAt = s.time;
      pushEvent(s, 'raiseRequest', 0, 0, m.raise, 0, m.id);
      return;
    }
  }
}

export function wagesPerDay(s: GameState): number {
  let total = 0;
  for (const m of s.staff) total += m.wage;
  return total;
}

/** Experience, energy, mood, trials, unanswered raises and quitting. */
export function updateStaffLife(s: GameState, dt: number): void {
  const gossipers = s.staff.filter((m) => m.traits.includes(TRAIT.gossip)).length;
  for (const m of s.staff.slice()) {
    // energy comes back when not working
    if (m.busyUntil <= s.time) m.energy = Math.min(1, m.energy + (m.breakUntil > s.time ? 0.035 : 0.006) * dt);
    if (m.energy < 0.12 && m.breakUntil <= s.time) {
      m.breakUntil = s.time + 25;
      pushEvent(s, 'onBreak', 0, 0, 0, 0, m.id);
    }
    // mood drifts toward a target set by rest, fair pay and the team
    const fair = marketWage(m.role, m.rarity, m.level);
    const pay = Math.max(-0.15, Math.min(0.15, (m.wage / fair - 1) * 0.6));
    const others = gossipers - (m.traits.includes(TRAIT.gossip) ? 1 : 0);
    const target = Math.max(0, Math.min(1, 0.55 + 0.25 * m.energy + pay - 0.06 * others + 0.02 * m.talents[TAL.loyalty]));
    m.mood += (target - m.mood) * Math.min(1, 0.004 * dt);
    // a raise nobody answered for a whole day counts as a no
    if (m.raise > 0 && s.time - m.raiseAt > DAY_SECONDS) answerRaise(s, m.id, 0);
    if (m.trialUntil > 0 && s.time >= m.trialUntil && m.trialUntil > 1) {
      pushEvent(s, 'trialEnded', 0, 0, m.role, 0, m.id);
      m.trialUntil = 1; // waiting for your decision, keeps working
    }
    if (m.mood <= 0.02) {
      s.staff = s.staff.filter((x) => x !== m);
      pushEvent(s, 'quit', 0, 0, m.role, 0, m.id);
    }
  }
}

/** Experience for a finished job; level-ups give talent points. */
function gainXp(s: GameState, m: StaffMember): void {
  m.xp++;
  m.energy = Math.max(0, m.energy - 0.05 * (m.traits.includes(TRAIT.workaholic) ? 0.6 : 1) * (1 - 0.08 * m.talents[TAL.stamina]));
  while (m.level < MAX_LEVEL && m.xp >= xpForLevel(m.level)) {
    m.xp -= xpForLevel(m.level);
    m.level++;
    m.points++;
    m.mood = Math.min(1, m.mood + 0.1);
    pushEvent(s, 'levelUp', 0, 0, m.level, 0, m.id);
  }
}

/** Charming people (and the charm talent) cheer the passengers up. */
function serveBonus(m: StaffMember, f: Flight): void {
  const charm = (m.traits.includes(TRAIT.charming) ? 0.03 : 0) + 0.01 * m.talents[TAL.charm];
  if (charm > 0) f.mood = Math.min(1, f.mood + charm);
}

/** Each worker picks one job when free, rested and past their reaction time. */
export function updateStaff(s: GameState): void {
  for (const m of s.staff) {
    if (m.busyUntil > s.time || m.breakUntil > s.time) continue;
    const role = STAFF_ROLES[m.role];
    const reaction = role.reaction / workerSpeed(s, m);
    const ripe = (readyAt: number) => s.time - readyAt >= reaction;
    const rest = (1 - 0.06 * m.talents[TAL.efficiency]) * reaction;
    let served: Flight | null = null;
    switch (role.id) {
      case 'atc': {
        if (freeStand(s) >= 0) {
          for (const f of s.flights) {
            if (wantsAction(f, WANT.clearLanding) && ripe(f.readyAt) && clearLanding(s, f)) {
              served = f;
              break;
            }
          }
        }
        if (!served) {
          for (const f of s.flights) {
            if (wantsAction(f, WANT.clearTakeoff) && ripe(f.readyAt) && clearTakeoff(s, f)) {
              served = f;
              break;
            }
          }
        }
        if (served) m.busyUntil = s.time + rest * 0.5;
        break;
      }
      case 'agent': {
        for (const f of s.flights) {
          if (wantsAction(f, WANT.board) && ripe(f.readyAt) && startBoarding(s, f)) {
            served = f;
            m.busyUntil = s.time + Math.max(0.5, rest * 0.5);
            break;
          }
        }
        break;
      }
      case 'fueler':
      case 'porter':
      case 'mechanic': {
        const kind = role.id === 'fueler' ? 'fuel' : role.id === 'porter' ? 'bags' : 'mech';
        const want = kind === 'fuel' ? WANT.fuel : kind === 'bags' ? WANT.bags : WANT.repair;
        if (!s.vehicles.some((v) => v.kind === kind && v.state === 'idle')) break;
        for (const f of s.flights) {
          if (wantsAction(f, want) && ripe(f.readyAt) && requestService(s, f, kind) !== 'rejected') {
            served = f;
            m.busyUntil = s.time + 0.8;
            // a clumsy handler sometimes drops a bag: the job takes longer
            if (kind === 'bags' && m.traits.includes(TRAIT.clumsy) && gh(s, m.id * 31 + m.xp * 7) < 0.25 - 0.04 * m.talents[TAL.precision]) {
              f.bagWork = -0.3;
              pushEvent(s, 'oops', f.x, f.y, 0, 0, m.id);
            }
            break;
          }
        }
        break;
      }
    }
    if (served) {
      serveBonus(m, served);
      gainXp(s, m);
    }
  }
}
