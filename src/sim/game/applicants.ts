import { APPLICANTS, ROLE_LIST, ROLES, STAFF, type Role } from '../../data/staff';
import { TRAITS } from '../../data/traits';
import { followPath, setPose } from '../movement';
import { chance, next, pick, range } from '../rng';
import { Bubble, Emote, Expression, Facing, Held, Pose } from '../types';
import { emote, route } from './customers';
import { emit, Ev } from './events';
import { applicantLook, generatePerson, statFactor, typicalStat, uniformLook } from './people';
import { createStaff } from './staff';
import type { Applicant, GameState } from './types';
import { hasRoom } from './workers';

// Job applicants: they walk up to the door with a CV, wait a while, and leave if ignored.

const team = (s: GameState) => s.staff.filter((st) => !st.leaving).length;
const count = (s: GameState, role: Role) => s.staff.filter((st) => st.role === role && !st.leaving).length;
/** The team is big enough for this job (and has the jobs it depends on). */
const ready = (s: GameState, r: Role) =>
  team(s) >= ROLES[r].minTeam && Object.entries(ROLES[r].needs ?? {}).every(([need, n]) => count(s, need as Role) >= (n ?? 0));

/** Which job the next applicant wants: only jobs with room, empty jobs first. */
function pickRole(s: GameState): Role | null {
  const open = ROLE_LIST.filter((r) => hasRoom(s, r) && ready(s, r));
  if (open.length === 0) return null;
  const missing = (r: Role) => !s.staff.some((st) => st.role === r && !st.leaving);
  if (missing('cook') && open.includes('cook')) return 'cook';
  const weight = (r: Role) => ROLES[r].weight * (missing(r) ? 3 : 1);
  let roll = next(s.rng) * open.reduce((sum, r) => sum + weight(r), 0);
  for (const r of open) {
    roll -= weight(r);
    if (roll < 0) return r;
  }
  return open[0]!;
}

function freeSpot(s: GameState): number {
  return s.map.applicantSpots.findIndex((_, i) => !s.applicants.some((a) => a.spot === i && a.state !== 'leaving'));
}

function spawnApplicant(s: GameState): void {
  const role = pickRole(s);
  const spot = freeSpot(s);
  if (!role || spot < 0) return;
  const start = pick(s.rng, s.map.spawns);
  const a: Applicant = {
    ...generatePerson(s, role),
    id: s.nextId++,
    role,
    look: applicantLook(s.rng),
    x: start.x,
    y: start.y,
    prevX: start.x,
    prevY: start.y,
    facing: Facing.FrontRight,
    pose: Pose.Walk,
    poseTime: 0,
    held: Held.None,
    expression: Expression.Happy,
    emote: 0,
    emoteTime: 0,
    patience: -1,
    bubble: 0,
    state: 'arriving',
    path: [],
    speed: 1.4,
    spot,
    patienceLeft: APPLICANTS.patienceSeconds,
    negotiated: 'no',
  };
  a.path = route(s, a, s.map.applicantSpots[spot]!);
  s.applicants.push(a);
}

function send(s: GameState, a: Applicant): void {
  a.state = 'leaving';
  a.bubble = 0;
  a.patience = -1;
  a.path = route(s, a, pick(s.rng, s.map.spawns));
}

export function updateApplicants(s: GameState, dt: number): void {
  const noCook = !s.staff.some((st) => st.role === 'cook' && !st.leaving) && !s.applicants.some((a) => a.role === 'cook' && a.state !== 'leaving');
  if (noCook) s.nextApplicant = Math.min(s.nextApplicant, s.time + APPLICANTS.noCookSeconds);
  if (s.time >= s.nextApplicant) {
    s.nextApplicant = s.time + range(s.rng, APPLICANTS.gap.min, APPLICANTS.gap.max);
    if (s.applicants.filter((a) => a.state !== 'leaving').length < APPLICANTS.maxWaiting) spawnApplicant(s);
  }
  for (const a of s.applicants) {
    if (a.state === 'arriving') {
      if (followPath(a, a.path, a.speed, dt)) {
        a.state = 'waiting';
        a.bubble = Bubble.Cv;
        a.facing = Facing.BackLeft;
        setPose(a, Pose.Idle);
      }
    } else if (a.state === 'waiting') {
      a.patienceLeft -= dt;
      a.patience = Math.max(0, a.patienceLeft / APPLICANTS.patienceSeconds);
      if (a.patienceLeft <= 0) {
        emote(a, Emote.Clock);
        send(s, a);
      }
    } else if (followPath(a, a.path, a.speed, dt)) a.state = 'leaving';
  }
  s.applicants = s.applicants.filter((a) => !(a.state === 'leaving' && a.path.length === 0));
}

const waiting = (s: GameState, id: number) => s.applicants.find((a) => a.id === id && a.state !== 'leaving');

export const signingFee = (a: Applicant) => a.wage.mul(STAFF.signingDays).ceil();

/** How good a hire someone is for their wage: the job's main skills, level, traits. */
export function applicantScore(a: Applicant): number {
  const main = ROLES[a.role].primary;
  const skill = main.reduce((sum, k) => sum + statFactor(a.stats[k]), 0) / main.length;
  const traits = a.traits.reduce((m, t) => m * (TRAITS[t].good ? 1.1 : 0.7), 1);
  return (skill * traits * (1 + 0.15 * (a.level - 1))) / Math.sqrt(Math.max(1, a.wage.toNumber()));
}

/**
 * Worth a look (the "auto-hire shortlist"): waiting for a job with room, no bad habits, and at
 * least as skilled in the job's main stats as a typical applicant of their level.
 */
export function shortlisted(s: GameState, a: Applicant): boolean {
  if (a.state !== 'waiting' || !hasRoom(s, a.role) || a.traits.some((t) => !TRAITS[t].good)) return false;
  const main = ROLES[a.role].primary;
  return main.reduce((sum, k) => sum + a.stats[k], 0) / main.length >= typicalStat(a.level);
}

/** The shortlisted applicant who is the best hire for the money, if any. */
export function recommended(s: GameState): number | null {
  const fine = s.applicants.filter((a) => shortlisted(s, a));
  fine.sort((x, y) => applicantScore(y) - applicantScore(x));
  return fine[0]?.id ?? null;
}

/** Hire (pay the signing fee) or start a trial shift (no fee until the end of the day). */
export function hire(s: GameState, id: number, trial: boolean): void {
  const a = waiting(s, id);
  if (!a || !hasRoom(s, a.role)) return;
  const fee = signingFee(a);
  if (!trial) {
    if (s.coins.lt(fee)) return;
    s.coins = s.coins.sub(fee);
  }
  const st = createStaff(s, a.role, { name: a.name, stats: a.stats, traits: a.traits, level: a.level, wage: a.wage }, uniformLook(a.role, a.look), a);
  st.trial = trial;
  st.rank = 0;
  emote(st, Emote.Heart);
  emit(s, Ev.Hired, a.x, a.y);
  s.staff.push(st);
  s.stats.hires += 1;
  s.applicants.splice(s.applicants.indexOf(a), 1);
}

/** Offer less: they may accept, refuse, or walk away offended. One try per applicant. */
export function negotiate(s: GameState, id: number): void {
  const a = waiting(s, id);
  if (!a || a.negotiated !== 'no') return;
  const n = STAFF.negotiate;
  const odds = n.accept + n.perLevel * (a.level - 1) + (a.traits.includes('cheerful') ? 0.15 : 0);
  if (chance(s.rng, odds)) {
    a.negotiated = 'accepted';
    a.wage = a.wage.mul(1 - n.cut).ceil();
    emote(a, Emote.Heart);
  } else {
    a.negotiated = 'refused';
    emote(a, Emote.Anger);
    if (chance(s.rng, 0.5)) send(s, a);
  }
}

export function reject(s: GameState, id: number): void {
  const a = waiting(s, id);
  if (!a) return;
  emote(a, Emote.Exclaim);
  send(s, a);
}
