import { QUEST_LEVELS, QUESTS, type QuestGoal, type QuestLevel } from '../data/quests';
import { GEMS } from '../data/shop';
import { big } from './big';
import { levelOf } from './economy/upgrades';
import { emit, Ev } from './game/events';
import type { GameState } from './game/types';

// Quests: pure rules over the game state. A goal's progress is read straight from the state
// (all-time counters, levels, the team), so a goal already met when its level opens is simply
// done. Claiming pays the reward; claiming the last one levels the restaurant up.

/** The goals of restaurant level `level` (1-based): hand-made, then made up forever. */
export function questLevel(level: number): QuestLevel {
  const made = QUEST_LEVELS[level - 1];
  if (made) return made;
  const e = QUESTS.endless;
  const k = level - QUEST_LEVELS.length;
  const item = e.items[(k - 1) % e.items.length]!;
  const round = Math.floor((k - 1) / e.items.length);
  const goals: QuestGoal[] = [
    { kind: 'upgrade', item, level: e.upgradeLevel.base + e.upgradeLevel.perLevel * (k + round * e.items.length) },
    e.buildingAt[k] !== undefined ? { kind: 'building', tier: e.buildingAt[k]! } : { kind: 'serve', count: e.serve.base + e.serve.perLevel * k },
    k % 2 === 0 ? { kind: 'reviews', count: e.reviews.base + e.reviews.perLevel * k } : { kind: 'earn', amount: e.earn.base * e.earn.growth ** k },
  ];
  return { goals, reward: e.reward.base * e.reward.growth ** k };
}

/** How far along a goal is: what you have and what it needs. */
export function progressOf(goal: QuestGoal, s: GameState): { have: number; need: number } {
  const team = s.staff.filter((st) => !st.leaving);
  switch (goal.kind) {
    case 'upgrade':
      return { have: levelOf(s.levels, goal.item), need: goal.level };
    case 'serve':
      return { have: s.stats.served, need: goal.count };
    case 'earn':
      return { have: s.stats.earned.toNumber(), need: goal.amount };
    case 'hire':
      return { have: team.filter((st) => st.role === goal.role).length, need: 1 };
    case 'team':
      return { have: team.length, need: goal.count };
    case 'rating':
      return { have: s.rating, need: goal.stars };
    case 'tables':
      return { have: s.tables.length, need: goal.count };
    case 'reviews':
      return { have: s.stats.fiveStars, need: goal.count };
    case 'decor':
      return { have: s.placed.length, need: goal.count };
    case 'rush':
      return { have: s.stats.rushes, need: goal.count };
    case 'combo':
      return { have: s.stats.bestCombo, need: goal.count };
    case 'building':
      return { have: levelOf(s.levels, 'building'), need: goal.tier };
  }
}

export function goalDone(goal: QuestGoal, s: GameState): boolean {
  const p = progressOf(goal, s);
  return p.have >= p.need;
}

/** Goals of the current level that are done but not claimed yet. */
export function claimable(s: GameState): number[] {
  return questLevel(s.quests.level)
    .goals.map((g, i) => i)
    .filter((i) => !s.quests.claimed.includes(i) && goalDone(questLevel(s.quests.level).goals[i]!, s));
}

/** Pays a finished goal's reward; the last one of the level also levels the restaurant up. */
export function claimQuest(s: GameState, index: number): void {
  const def = questLevel(s.quests.level);
  const goal = def.goals[index];
  if (!goal || s.quests.claimed.includes(index) || !goalDone(goal, s)) return;
  s.quests.claimed.push(index);
  let reward = big(def.reward);
  const levelUp = s.quests.claimed.length >= def.goals.length;
  if (levelUp) {
    reward = reward.mul(1 + QUESTS.levelBonus);
    s.quests = { level: s.quests.level + 1, claimed: [] };
    s.gems += GEMS.perLevelUp;
  }
  s.coins = s.coins.add(reward);
  emit(s, Ev.Bonus, 0, 0, reward.toNumber());
  if (levelUp) {
    const b = s.map.building;
    emit(s, Ev.LevelUpRestaurant, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, s.quests.level);
  }
}
