import { describe, expect, it } from 'vitest';
import { FRANCHISE } from '../src/data/franchise';
import { STAND_MAP, mapForTier } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { computeMods } from '../src/sim/economy/upgrades';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { canOpenBranch, openBranch, trophiesFor } from '../src/sim/franchise';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';

describe('branches in new cities', () => {
  it('trophies grow with what the branch earned, less and less for each power of ten', () => {
    expect(trophiesFor(big(1e6))).toBe(0);
    expect(trophiesFor(big(1e9))).toBe(3);
    expect(trophiesFor(big(1e11))).toBe(7);
    expect(trophiesFor(big(1e13))).toBe(11);
    expect(trophiesFor(big('1e30'))).toBeGreaterThan(trophiesFor(big(1e13)));
  });

  it('every trophy makes every dish sell for more', () => {
    const plain = computeMods({ fries: 10 });
    const three = computeMods({ fries: 10 }, {}, 3);
    expect(three.price[0]! / plain.price[0]!).toBeCloseTo(1 + 3 * FRANCHISE.pricePerTrophy, 6);
  });

  it('opens from the grand restaurant on', () => {
    expect(canOpenBranch(createGame(STAND_MAP, 1))).toBe(false);
    expect(canOpenBranch(createGame(mapForTier(2), 1, { levels: { building: 2 } }))).toBe(true);
  });

  it('starts over in the next city with an empty diner, keeping gems, perks and trophies', () => {
    const s = createGame(mapForTier(2), 2, { levels: { building: 2, fries: 80, tables: 10 }, coins: big(1e12), earned: big(1e9), gems: 345, perks: { goldenMenu: 1, crew3: 1 }, trophies: 2 });
    for (let i = 0; i < 100; i++) stepGame(s, STEP_SEC);
    const time = s.time;
    queueCommand(s, { type: 'branch' });
    stepGame(s, STEP_SEC);
    expect(s.city).toBe(1);
    expect(s.trophies).toBe(2 + 3);
    expect(s.map.tier).toBe(0);
    expect(s.levels).toEqual({});
    expect(s.coins.lt(1e6)).toBe(true);
    expect(s.stats.earned.lt(1e6)).toBe(true);
    expect(s.gems).toBe(345);
    expect(s.perks).toEqual({ goldenMenu: 1, crew3: 1 });
    expect(s.quests.level).toBe(1);
    expect(s.time).toBeGreaterThan(time);
    // The trophies are already in the prices.
    expect(s.mods.price[0]).toBeCloseTo(computeMods({}, s.perks, 5).price[0]!, 6);
    // ...and the restaurant runs on.
    for (let i = 0; i < 600; i++) stepGame(s, STEP_SEC);
    expect(s.customers.length + s.stats.served).toBeGreaterThan(0);
  });

  it('a diner cannot be handed over', () => {
    const s = createGame(STAND_MAP, 3, { coins: big(1e9) });
    expect(openBranch(s)).toBe(false);
    expect(s.city).toBe(0);
  });

  it('the city and the trophies are saved', () => {
    const s = createGame(STAND_MAP, 4, { city: 2, trophies: 9 });
    const loaded = parseSave(JSON.stringify(makeSave(s, 1000)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 1);
    expect(back.city).toBe(2);
    expect(back.trophies).toBe(9);
  });
});
