import { TALENT, TALENT_IDS, talentBlockOf, talentCost, talentSpent, type TalentBlock, type TalentId, type TalentLevels } from '../../data/talents';
import type { Big } from '../big';
import { emit, Ev } from './events';
import type { GameState, Staff } from './types';

// Talents (owner M46): the points are the player's, the levels are each worker's. What each
// talent does is in src/data/talents.ts; the systems that use them read the multipliers below.

/** A worker's level in a talent (0: none). */
export const talentOf = (st: { talents?: TalentLevels }, id: TalentId): number => st.talents?.[id] ?? 0;

/** Why a worker cannot take the next level of a talent right now (null: they can). */
export const talentBlock = (s: GameState, st: Staff, id: TalentId): TalentBlock => talentBlockOf(st, id, s.talentPoints);

/** Is there a talent level anyone on the team can take now (the team button's star)? */
export const canLearn = (s: GameState): boolean => s.talentPoints > 0 && s.staff.some((st) => TALENT_IDS.some((id) => talentBlock(s, st, id) === null));

/** The next level of a talent for a worker, paid in points. */
export function buyTalent(s: GameState, staffId: number, id: TalentId): boolean {
  const st = s.staff.find((x) => x.id === staffId);
  if (!st || !TALENT_IDS.includes(id) || talentBlock(s, st, id)) return false;
  const cost = talentCost(talentOf(st, id));
  s.talentPoints -= cost;
  st.talents = { ...st.talents, [id]: talentOf(st, id) + 1 };
  emit(s, Ev.Talent, st.x, st.y, st.id, talentOf(st, id));
  return true;
}

/** Takes every talent back from a worker (for gems): all the points return. */
export function resetTalents(s: GameState, staffId: number): boolean {
  const st = s.staff.find((x) => x.id === staffId);
  const spent = st ? talentSpent(st.talents) : 0;
  if (!st || spent === 0 || s.gems < TALENT.resetGems) return false;
  s.gems -= TALENT.resetGems;
  s.talentPoints += spent;
  st.talents = undefined;
  return true;
}

/** Points earned (a chef level, a quest level, the wheel...). `shown`: the source's own card shows them (no toast then). */
export function grantTalentPoints(s: GameState, n: number, shown = false): void {
  if (n <= 0) return;
  s.talentPoints += n;
  emit(s, Ev.TalentPoints, 0, 0, n, shown ? 1 : 0);
}

/** A worker leaving: the share of their points that comes back (all when fired, half when they quit). */
export function refundTalents(s: GameState, st: Staff, share: number): void {
  const back = Math.floor(talentSpent(st.talents) * share);
  if (back > 0) s.talentPoints += back;
  st.talents = undefined;
}

// ---------- what the talents do ----------

/** Work speed. */
export const quickMult = (st: Staff): number => 1 + TALENT.quick * talentOf(st, 'quick');
/** What a cook, bartender or checker makes is worth this much more. */
export const craftMult = (st: Staff): number => 1 + TALENT.craft * talentOf(st, 'craft');
/** Tips, a guest's patience back, a passer-by walking in: charm's effects, this much stronger. */
export const charismaMult = (st: Staff): number => 1 + TALENT.charisma * talentOf(st, 'charisma');
/** A drop in morale is this big (a good mood shields part of it). */
export const moodShield = (st: Staff): number => 1 - TALENT.moodShield * talentOf(st, 'mood');
/** Energy drains at this rate, and comes back at that. */
export const fitDrain = (st: Staff): number => 1 - TALENT.fitDrain * talentOf(st, 'fit');
export const fitRecover = (st: Staff): number => 1 + TALENT.fitRecover * talentOf(st, 'fit');
/** Their wage, and how often they ask for a raise, against an ordinary worker's. */
export const loyalWage = (st: Staff): number => 1 - TALENT.loyalWage * talentOf(st, 'loyal');
export const loyalRaise = (st: Staff): number => Math.max(0, 1 - TALENT.loyalRaise * talentOf(st, 'loyal'));
/** At the top of loyalty they never quit over morale (they still do when nobody pays them). */
export const neverQuits = (st: Staff): boolean => talentOf(st, 'loyal') >= TALENT.max;

/** What payday really pays them: their wage less the loyalty cut. */
export const wageNow = (st: Staff): Big => (talentOf(st, 'loyal') > 0 ? st.wage.mul(loyalWage(st)).ceil() : st.wage);

/** Morale after a change: a fall is softened by a good mood, a rise is not. */
export function moraleChange(st: Staff, delta: number): number {
  return delta < 0 ? delta * moodShield(st) : delta;
}
