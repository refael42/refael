import { Dish } from '../../data/dishes';
import type { Look } from '../../data/looks';
import { NAMES } from '../../data/names';
import { APPLICANTS, DAY, ROLES, RUSH, SHIFT, STAFF, STAT_IDS, type Role, type StatId } from '../../data/staff';
import { TRAIT_FX, TRAIT_LIST, TRAITS, type TraitId } from '../../data/traits';
import type { Big } from '../big';
import { randomLook } from '../looks';
import { chance, int, next, pick, type Rng } from '../rng';
import { dishPrice } from './customers';
import type { GameState, Person, Staff } from './types';

// People: generating applicants, what they ask for, and how stats, morale and energy turn into
// working speed. Pure functions over the game state.

export const clampStat = (v: number) => Math.max(STAFF.stat.min, Math.min(STAFF.stat.max, Math.round(v)));

/** A stat's effect: 5 is neutral, each point away from 5 is `perPoint`. */
export const statFactor = (value: number) => 1 + STAFF.stat.perPoint * (value - STAFF.stat.average);

export const has = (p: Person, trait: TraitId) => p.traits.includes(trait);

function pickTrait(rng: Rng, taken: readonly TraitId[]): TraitId {
  const pool = TRAIT_LIST.filter((t) => !taken.includes(t.id));
  let roll = next(rng) * pool.reduce((sum, t) => sum + t.weight, 0);
  for (const t of pool) {
    roll -= t.weight;
    if (roll < 0) return t.id;
  }
  return pool[0]!.id;
}

/** What a person asks per day: job x level x how good they are, in today's fries prices. */
export function wageFor(s: GameState, role: Role, level: number, stats: Person['stats'], traits: readonly TraitId[]): Big {
  const avg = STAT_IDS.reduce((sum, k) => sum + stats[k], 0) / STAT_IDS.length;
  const traitMult = traits.reduce((m, t) => m * (TRAITS[t].wage ?? 1), 1);
  const dishes = ROLES[role].wageDishes * (1 + STAFF.wagePerLevel * (level - 1)) * statFactor(avg) * traitMult;
  return dishPrice(s, Dish.Fries).mul(Math.max(0.5, dishes)).ceil();
}

/**
 * A new person for a job. Levels grow with the team: better people apply to a bigger place.
 * `average` gives a plain level-1 worker with no traits (the opening cook, old saves).
 */
export function generatePerson(s: GameState, role: Role, average = false): Person {
  const rng = s.rng;
  let level = 1;
  const maxLevel = 1 + Math.floor(Math.log2(1 + s.stats.hires));
  while (!average && level < maxLevel && chance(rng, APPLICANTS.levelUpChance)) level++;
  const traits: TraitId[] = [];
  if (!average) {
    traits.push(pickTrait(rng, traits));
    if (chance(rng, 0.4)) traits.push(pickTrait(rng, traits));
  }
  const stats = {} as Record<StatId, number>;
  for (const k of STAT_IDS) {
    const base = average ? STAFF.stat.average : typicalStat(level) + int(rng, -2, 3);
    stats[k] = clampStat(base + traits.reduce((sum, t) => sum + (TRAITS[t].stats?.[k] ?? 0), 0));
  }
  return { name: int(rng, 0, NAMES.length), stats, traits, level, wage: wageFor(s, role, level, stats, traits) };
}

/** An applicant's stats are spread around this for their level. */
export function typicalStat(level: number): number {
  return 3 + level * 0.6;
}

/** Casual clothes for an applicant; the uniform comes with the job. */
export const applicantLook = (rng: Rng): Look => randomLook(rng);

/** The job's uniform on this person's face and hair. */
export function uniformLook(role: Role, person: Look): Look {
  return { ...ROLES[role].look, skin: person.skin, hair: person.hair, hairColor: person.hairColor };
}

export function rankOf(level: number): number {
  return STAFF.rankLevels.filter((l) => level >= l).length;
}

/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number) => Math.round(STAFF.xp.first * STAFF.xp.growth ** (level - 1));

/** The shift manager on duty, if there is one. */
export const managerOnShift = (s: GameState): Staff | undefined => s.staff.find((st) => st.role === 'manager' && !st.leaving && !st.pendingRole);

/** Jobs the shift manager runs. */
export const FLOOR_TEAM: readonly Role[] = ['waiter', 'host', 'cleaner'];

/** How much quicker the waiters are with a manager on shift (1 = no manager). */
export function waiterLead(s: GameState): number {
  const m = managerOnShift(s);
  return m ? 1 + SHIFT.waiterSpeed * statFactor(m.stats.charm) : 1;
}

/** How fast someone works right now: speed stat, morale, energy, scolding, night owls, the manager. */
export function workRate(s: GameState, st: Staff): number {
  const e = STAFF.energy;
  const m = STAFF.morale;
  const tired = e.slowestAt0 + (1 - e.slowestAt0) * Math.min(1, st.energy / e.tired);
  const mood = m.slowest + (m.fastest - m.slowest) * st.morale;
  const scold = s.time < st.scoldUntil ? 1 + STAFF.scold.speedBonus : 1;
  const night = has(st, 'nightOwl') && s.dayTime / DAY.seconds >= TRAIT_FX.nightFrom ? 1 + TRAIT_FX.nightOwlBonus : 1;
  const lead = st.role === 'waiter' ? waiterLead(s) : 1;
  const rush = s.rush.on ? 1 + RUSH.speed : 1;
  return statFactor(st.stats.speed) * tired * mood * scold * night * lead * rush;
}

/** Picks the stat a level-up improves: mostly the job's main stats. */
export function levelUpStat(rng: Rng, role: Role): StatId {
  return chance(rng, 0.75) ? pick(rng, ROLES[role].primary) : pick(rng, STAT_IDS);
}
