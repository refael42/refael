import { describe, expect, it } from 'vitest';
import { CHEF, levelReward, xpNeed } from '../src/data/chef';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { gainXp } from '../src/sim/chef';
import { openBranch } from '../src/sim/franchise';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import { CustomerState } from '../src/sim/game/types';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';

// The chef's level (owner: "more levels, more things that open, like Hay Day").

describe('the chef level', () => {
  it('each level needs more experience than the last', () => {
    for (let l = 1; l < 80; l++) expect(xpNeed(l + 1)).toBeGreaterThan(xpNeed(l));
  });

  it('experience from serving fills the bar; a level pays gems and coins, a chest every few levels', () => {
    const s = createGame(STAND_MAP, 90, { roster: ['cook', 'waiter', 'washer'] });
    let levels = 0;
    for (let i = Math.round(400 / STEP_SEC); i > 0; i--) {
      for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
      stepGame(s, STEP_SEC);
      levels += s.events.filter((e) => e.type === Ev.ChefLevel && e.time === s.time).length;
    }
    expect(s.stats.served).toBeGreaterThan(10);
    expect(s.chef.level).toBeGreaterThan(1);
    expect(levels).toBe(s.chef.level - 1);
    // Its cards wait to be seen, and go once seen.
    expect(s.chef.pending.length).toBeGreaterThan(0);
    queueCommand(s, { type: 'chefSeen', level: s.chef.pending[0]! });
    const before = s.chef.pending.length;
    stepGame(s, STEP_SEC);
    expect(s.chef.pending.length).toBe(before - 1);

    const g = createGame(STAND_MAP, 91);
    const gems = g.gems;
    gainXp(g, 'stage', 1); // 15 experience: level 2
    expect(g.chef.level).toBe(2);
    expect(g.gems - gems).toBe(levelReward(2).gems);
    expect(levelReward(CHEF.chestEvery).chest).toBe(true);
    // A chest: double income for a while.
    g.chef.level = CHEF.chestEvery - 1;
    g.chef.xp = xpNeed(g.chef.level) - 1;
    gainXp(g, 'served');
    expect(g.boost.mult).toBe(CHEF.chestBoost.mult);
    expect(g.boost.until).toBeGreaterThan(g.time);
  });

  it('a bulk buy counts for a few levels, not a hundred', () => {
    const s = createGame(STAND_MAP, 92);
    s.chef.xp = -1e9;
    gainXp(s, 'upgrade', 100);
    expect(s.chef.xp).toBe(-1e9 + CHEF.xp.upgradeMax * CHEF.xp.upgrade);
  });

  it('is saved, and goes with every new branch', () => {
    const s = createGame(STAND_MAP, 93);
    s.chef.level = 17;
    s.chef.xp = 123;
    const loaded = parseSave(JSON.stringify(makeSave(s, Date.now())));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 93, Date.now());
    expect(back.chef.level).toBe(17);
    expect(back.chef.xp).toBe(123);
    back.levels = { ...back.levels, building: 2 };
    back.map = { ...back.map, tier: 2 };
    if (openBranch(back)) expect(back.chef.level).toBe(17);
  });
});
