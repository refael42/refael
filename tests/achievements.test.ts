import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT, ACHIEVEMENTS } from '../src/data/achievements';
import { STAND_MAP } from '../src/data/maps';
import { achievementsReady, claimAchievement, medals, updateAchievements } from '../src/sim/achievements';
import { openBranch } from '../src/sim/franchise';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';

// Owner, idea 11: achievements (bronze, silver, gold) with gems, counted across branches.

describe('achievements', () => {
  it('sixteen, each with rising goals and a store id per medal', () => {
    expect(ACHIEVEMENTS).toHaveLength(16);
    for (const a of ACHIEVEMENTS) {
      expect(a.goals[0]).toBeLessThan(a.goals[1]);
      expect(a.goals[1]).toBeLessThan(a.goals[2]);
    }
    expect(ACHIEVEMENT.storeId('served', 2)).toBe('ach_served_gold');
  });

  it('counts what the game adds, medal by medal, and pays each once', () => {
    const s = createGame(STAND_MAP, 2);
    updateAchievements(s);
    s.stats.served = 150;
    updateAchievements(s);
    expect(medals(s, 'served')).toBe(1);
    expect(s.events.some((e) => e.type === Ev.Achievement)).toBe(true);
    expect(achievementsReady(s)).toBeGreaterThanOrEqual(1);
    const gems = s.gems;
    expect(claimAchievement(s, 'served')).toBe(true);
    expect(s.gems).toBe(gems + ACHIEVEMENT.gems[0]!);
    expect(claimAchievement(s, 'served')).toBe(false);
    // Best-of ones keep the highest seen.
    s.stats.bestCombo = 6;
    updateAchievements(s);
    s.stats.bestCombo = 2;
    updateAchievements(s);
    expect(s.achievements.value.combo).toBe(6);
  });

  it('keeps counting in a new branch (whose own counters start over) and in the save', () => {
    const s = createGame(STAND_MAP, 2);
    updateAchievements(s);
    s.stats.served = 1500;
    updateAchievements(s);
    s.stats.earned = s.stats.earned.add(1e15);
    s.levels = { ...s.levels, building: 6 };
    expect(openBranch(s)).toBe(true);
    expect(s.stats.served).toBe(0);
    updateAchievements(s);
    s.stats.served = 600;
    updateAchievements(s);
    expect(s.achievements.value.served).toBe(2100);
    expect(medals(s, 'served')).toBe(2);
    expect(medals(s, 'branches')).toBe(1);
    const r = parseSave(JSON.stringify(makeSave(s, 1000)));
    if (!r.ok) throw new Error(r.reason);
    const back = restoreGame(r.save, 1, 2000);
    expect(back.achievements.value.served).toBe(2100);
  });
});
