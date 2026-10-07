import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { QUEST_LEVELS, QUESTS } from '../src/data/quests';
import { STEP_SEC } from '../src/data/sim';
import { ROLE_LIST } from '../src/data/staff';
import { UPGRADE_BY_ID } from '../src/data/upgrades';
import { big } from '../src/sim/big';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { claimable, goalDone, progressOf, questLevel } from '../src/sim/quests';
import { makeSave, MIGRATIONS, parseSave, restoreGame } from '../src/sim/save';

function play(s: GameState, seconds: number) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
  }
}

describe('quests', () => {
  it('every level, hand-made or endless, asks for real things and pays more as it goes', () => {
    let reward = 0;
    for (let level = 1; level <= 60; level++) {
      const def = questLevel(level);
      expect(def.goals.length, `level ${level}`).toBeGreaterThanOrEqual(3);
      expect(def.reward).toBeGreaterThan(reward);
      reward = def.reward;
      for (const g of def.goals) {
        if (g.kind === 'upgrade') expect(UPGRADE_BY_ID[g.item], `${level} ${g.item}`).toBeDefined();
        if (g.kind === 'hire') expect(ROLE_LIST).toContain(g.role);
        expect(progressOf(g, createGame(STAND_MAP, 1)).need).toBeGreaterThan(0);
      }
    }
    expect(QUEST_LEVELS.length).toBe(10);
  });

  it('a new player finishes level 1 by playing, claims each goal, and the restaurant levels up', () => {
    const s = createGame(STAND_MAP, 71, { roster: ['cook', 'waiter'] });
    expect(s.quests.level).toBe(1);
    s.coins = big(1000);
    for (let i = 0; i < 3; i++) buyUpgrade(s, 'fries');
    play(s, 240);
    expect(claimable(s)).toEqual([0, 1, 2]);
    const reward = questLevel(1).reward;
    const paid = () => s.events.filter((e) => e.type === Ev.Bonus).map((e) => e.a);
    queueCommand(s, { type: 'claim', quest: 0 });
    queueCommand(s, { type: 'claim', quest: 0 }); // twice: pays once
    stepGame(s, STEP_SEC);
    expect(paid()).toEqual([reward]);
    expect(s.quests.claimed).toEqual([0]);
    queueCommand(s, { type: 'claim', quest: 1 });
    queueCommand(s, { type: 'claim', quest: 2 });
    stepGame(s, STEP_SEC);
    expect(s.quests).toEqual({ level: 2, claimed: [] });
    expect(paid()).toEqual([reward, reward, reward * (1 + QUESTS.levelBonus)]); // the last one carries the level bonus
    expect(s.events.some((e) => e.type === Ev.LevelUpRestaurant && e.a === 2)).toBe(true);
  });

  it('an unfinished goal cannot be claimed', () => {
    const s = createGame(STAND_MAP, 72);
    const coins = s.coins;
    queueCommand(s, { type: 'claim', quest: 1 });
    stepGame(s, STEP_SEC);
    expect(s.quests.claimed).toEqual([]);
    expect(s.coins.eq(coins)).toBe(true);
  });

  it('counts rush hours, five-star reviews and the best combo for the goals that ask for them', () => {
    const s = createGame(STAND_MAP, 73, { roster: ['cook', 'waiter', 'washer'], levels: { tables: 2 } });
    queueCommand(s, { type: 'rush', on: true });
    play(s, 1);
    queueCommand(s, { type: 'rush', on: false });
    let longest = 0;
    for (let i = 0; i < 60; i++) {
      play(s, 10);
      longest = Math.max(longest, s.combo);
    }
    expect(s.stats.rushes).toBe(1);
    expect(s.stats.bestCombo).toBeGreaterThanOrEqual(longest);
    expect(s.stats.bestCombo).toBeGreaterThanOrEqual(1);
    expect(s.stats.fiveStars).toBe(s.reviews.filter((r) => r.stars === 5).length);
    expect(goalDone({ kind: 'rush', count: 1 }, s)).toBe(true);
  });

  it('progress survives saving, and older saves start at level 1', () => {
    const s = createGame(STAND_MAP, 74);
    s.quests = { level: 4, claimed: [2] };
    s.stats.fiveStars = 3;
    s.stats.rushes = 5;
    s.stats.bestCombo = 7;
    const loaded = parseSave(JSON.stringify(makeSave(s, 0)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 1);
    expect(back.quests).toEqual({ level: 4, claimed: [2] });
    expect([back.stats.fiveStars, back.stats.rushes, back.stats.bestCombo]).toEqual([3, 5, 7]);
    const v3 = { ...makeSave(s, 0), version: 3 } as Record<string, unknown>;
    delete v3.quests;
    const migrated = parseSave(JSON.stringify(v3), MIGRATIONS);
    expect(migrated.ok && migrated.save.quests).toEqual({ level: 1, claimed: [] });
  });
});
