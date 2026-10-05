import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { WORKS } from '../src/data/works';
import { big } from '../src/sim/big';
import { costOf, isUnlocked, levelCap, restaurantLevel, tracksAtCap, upgradeDef } from '../src/sim/economy/upgrades';
import { RANK } from '../src/data/upgrades';
import { gemsToFinish, planBuy, workSeconds } from '../src/sim/economy/works';
import { buildableTiles, canPlaceAt } from '../src/sim/game/build';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import type { GameState } from '../src/sim/game/types';
import { trainingCost, trainingPlan } from '../src/sim/game/workers';
import { crewsOf } from '../src/sim/game/works';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { buyShopItem } from '../src/sim/shop';

const rich = (s: GameState) => {
  s.coins = big('1e30');
  return s;
};
const run = (s: GameState, seconds: number) => {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) stepGame(s, STEP_SEC);
};

describe('big upgrades take time', () => {
  it('only big levels need a crew: milestones, new recipes, the stove, showpieces, the building', () => {
    expect(workSeconds(upgradeDef('fries'), 5)).toBe(0);
    expect(workSeconds(upgradeDef('fries'), 9)).toBe(WORKS.milestone[0]);
    expect(workSeconds(upgradeDef('fries'), 24)).toBe(WORKS.milestone[1]);
    expect(workSeconds(upgradeDef('fries'), 149)).toBe(WORKS.laterMilestone);
    expect(workSeconds(upgradeDef('burger'), 0)).toBe(WORKS.recipe[1]);
    expect(workSeconds(upgradeDef('burger'), 3)).toBe(0);
    expect(workSeconds(upgradeDef('building'), 0)).toBe(WORKS.building[1]);
    expect(workSeconds(upgradeDef('stove2'), 0)).toBe(WORKS.stove);
    expect(workSeconds(upgradeDef('place_flowers'), 0)).toBe(0);
    expect(workSeconds(upgradeDef('place_aquarium'), 0)).toBe(WORKS.place.aquarium);
    expect(workSeconds(upgradeDef('tables'), 3)).toBe(0);
  });

  it('a big level is paid now and counts when the crew is done; the item waits meanwhile', () => {
    const s = createGame(STAND_MAP, 1, { levels: { fries: 9 } });
    // Small enough that coin sums stay exact.
    s.coins = big(1e9);
    const coins = s.coins;
    expect(buyUpgrade(s, 'fries')).toBe(true);
    expect(coins.sub(s.coins).eq(costOf(upgradeDef('fries'), 9))).toBe(true);
    expect(s.levels.fries).toBe(9);
    expect(s.works).toHaveLength(1);
    expect(planBuy(upgradeDef('fries'), s.levels, s.coins, s.map, crewsOf(s), 1).status).toBe('working');
    expect(buyUpgrade(s, 'fries')).toBe(false);
    run(s, WORKS.milestone[0] + 0.2);
    expect(s.levels.fries).toBe(10);
    expect(s.works).toHaveLength(0);
  });

  it('crews are limited: with all of them busy the next big level waits, small ones do not', () => {
    const s = rich(createGame(STAND_MAP, 2, { levels: { fries: 9, sign: 9, cloth: 9, chairs: 5 } }));
    expect(buyUpgrade(s, 'fries')).toBe(true);
    expect(buyUpgrade(s, 'sign')).toBe(true);
    expect(s.works).toHaveLength(WORKS.crews);
    expect(planBuy(upgradeDef('cloth'), s.levels, s.coins, s.map, crewsOf(s), 1).status).toBe('noCrew');
    expect(buyUpgrade(s, 'cloth')).toBe(false);
    expect(buyUpgrade(s, 'chairs')).toBe(true);
    expect(s.levels.chairs).toBe(6);
    // The shop's extra crew takes one more job.
    s.gems = 1000;
    expect(buyShopItem(s, 'crew3')).toBe(true);
    expect(buyUpgrade(s, 'cloth')).toBe(true);
  });

  it('tapping the site speeds it up (a few taps a second count); gems finish it now', () => {
    const s = rich(createGame(STAND_MAP, 3));
    buyUpgrade(s, 'building');
    const w = s.works[0]!;
    const left = w.left;
    queueCommand(s, { type: 'hurry', work: w.id });
    queueCommand(s, { type: 'hurry', work: w.id });
    stepGame(s, STEP_SEC);
    const cut = Math.max(WORKS.tapMin, w.total * WORKS.tapShare);
    expect(w.left).toBeCloseTo(left - cut - STEP_SEC, 5);
    const gems = gemsToFinish(w.left);
    s.gems = gems;
    queueCommand(s, { type: 'finish', work: w.id });
    stepGame(s, STEP_SEC);
    stepGame(s, STEP_SEC);
    expect(s.gems).toBe(0);
    expect(s.levels.building).toBe(1);
    expect(s.construction).not.toBeNull();
  });

  it('not enough gems: nothing happens', () => {
    const s = rich(createGame(STAND_MAP, 4));
    buyUpgrade(s, 'building');
    s.gems = 0;
    queueCommand(s, { type: 'finish', work: s.works[0]!.id });
    stepGame(s, STEP_SEC);
    expect(s.works).toHaveLength(1);
    expect(s.levels.building ?? 0).toBe(0);
  });

  it('a time warp moves the crews on too', () => {
    const s = rich(createGame(STAND_MAP, 5));
    buyUpgrade(s, 'building');
    s.gems = 1000;
    expect(buyShopItem(s, 'warp1')).toBe(true);
    stepGame(s, STEP_SEC);
    expect(s.levels.building).toBe(1);
  });

  it('a showpiece keeps its tile while it is being built, then stands there', () => {
    const s = rich(createGame(STAND_MAP, 6, { levels: { building: 1 } }));
    const tile = buildableTiles(s)[0]!;
    expect(buyUpgrade(s, 'place_aquarium', tile)).toBe(true);
    expect(s.placed).toHaveLength(0);
    expect(canPlaceAt(s, tile.x, tile.y)).toBe(false);
    run(s, WORKS.place.aquarium! + 0.2);
    expect(s.levels.place_aquarium).toBe(1);
    expect(s.placed).toEqual([{ item: 'aquarium', x: tile.x, y: tile.y }]);
  });

  it('jobs are saved, and the time away counts', () => {
    const s = rich(createGame(STAND_MAP, 7, { levels: { burger: 0, fries: 5 } }));
    buyUpgrade(s, 'burger');
    const save = makeSave(s, 1_000_000);
    const loaded = parseSave(JSON.stringify(save));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.save.works).toHaveLength(1);
    const later = restoreGame(loaded.save, 1, 1_000_000 + 5000);
    expect(later.works[0]!.left).toBeCloseTo(WORKS.recipe[1]! - 5, 5);
    const done = restoreGame(loaded.save, 1, 1_000_000 + 3_600_000);
    stepGame(done, STEP_SEC);
    expect(done.levels.burger).toBe(1);
  });
});

describe('bulk buying', () => {
  it('x10 buys ten levels at once, all paid together', () => {
    const s = createGame(STAND_MAP, 10, { levels: { fries: 11 } });
    s.coins = big(1e9);
    const plan = planBuy(upgradeDef('fries'), s.levels, s.coins, s.map, crewsOf(s), 10);
    let sum = big(0);
    for (let l = 11; l < 21; l++) sum = sum.add(costOf(upgradeDef('fries'), l));
    expect(plan).toMatchObject({ status: 'ok', count: 10, seconds: 0 });
    expect(plan.cost.eq(sum)).toBe(true);
    const coins = s.coins;
    expect(buyUpgrade(s, 'fries', undefined, 10)).toBe(true);
    expect(s.levels.fries).toBe(21);
    expect(coins.sub(s.coins).eq(sum)).toBe(true);
  });

  it('a batch stops at a big level: that one starts the crew', () => {
    const s = rich(createGame(STAND_MAP, 11, { levels: { fries: 3 } }));
    expect(planBuy(upgradeDef('fries'), s.levels, s.coins, s.map, crewsOf(s), 100)).toMatchObject({ count: 7, seconds: WORKS.milestone[0] });
    buyUpgrade(s, 'fries', undefined, 100);
    expect(s.levels.fries).toBe(9);
    expect(s.works.map((w) => w.level)).toEqual([10]);
  });

  it('not enough coins for the whole batch: the button shows it greyed ("poor")', () => {
    const s = createGame(STAND_MAP, 12, { levels: { fries: 11 } });
    s.coins = costOf(upgradeDef('fries'), 11).mul(3);
    expect(planBuy(upgradeDef('fries'), s.levels, s.coins, s.map, crewsOf(s), 10).status).toBe('poor');
    expect(buyUpgrade(s, 'fries', undefined, 10)).toBe(false);
    // "Max" buys what the coins cover.
    const max = planBuy(upgradeDef('fries'), s.levels, s.coins, s.map, crewsOf(s), 'max');
    expect(max.status).toBe('ok');
    expect(max.count).toBeGreaterThanOrEqual(2);
    expect(max.cost.lte(s.coins)).toBe(true);
  });

  it('staff training in tens: each level a little dearer', () => {
    const st = { wage: big(10), level: 2 };
    const plan = trainingPlan(st, big('1e9'), 10);
    let sum = big(0);
    for (let l = 2; l < 12; l++) sum = sum.add(trainingCost(st, l));
    expect(plan.count).toBe(10);
    expect(plan.cost.eq(sum)).toBe(true);
    const s = rich(createGame(STAND_MAP, 13));
    const cook = s.staff[0]!;
    const level = cook.level;
    queueCommand(s, { type: 'train', staff: cook.id, count: 10 });
    stepGame(s, STEP_SEC);
    expect(cook.level).toBe(level + 10);
  });
});

describe('restaurant level', () => {
  const capped = { fries: 100, sign: 100, stove: 100, sink: 100, cloth: 100 };

  it('every track stops at level 100 until the restaurant levels up', () => {
    const s = rich(createGame(STAND_MAP, 20, { levels: { fries: 100 } }));
    expect(planBuy(upgradeDef('fries'), s.levels, s.coins, s.map, crewsOf(s), 1).status).toBe('max');
    expect(buyUpgrade(s, 'fries')).toBe(false);
    expect(planBuy(upgradeDef('fries'), { fries: 95 }, s.coins, s.map, crewsOf(s), 100).count).toBe(5);
  });

  it('the next level shows up once enough tracks are at the cap, takes a crew, then opens the next hundred', () => {
    expect(isUnlocked(upgradeDef(RANK.id), { ...capped, cloth: 99 })).toBe(false);
    const s = rich(createGame(STAND_MAP, 21, { levels: capped }));
    expect(tracksAtCap(s.levels)).toBe(RANK.ready);
    expect(isUnlocked(upgradeDef(RANK.id), s.levels)).toBe(true);
    expect(buyUpgrade(s, RANK.id)).toBe(true);
    expect(restaurantLevel(s.levels)).toBe(1);
    run(s, workSeconds(upgradeDef(RANK.id), 0) + 0.2);
    expect(restaurantLevel(s.levels)).toBe(2);
    expect(levelCap(s.levels)).toBe(200);
    expect(buyUpgrade(s, 'fries')).toBe(true);
    // ...and every dish sells for more.
    expect(s.mods.quality).toBeGreaterThan(createGame(STAND_MAP, 21, { levels: capped }).mods.quality);
  });

  it('an older save keeps its high levels: it starts at the restaurant level they need', () => {
    const s = createGame(STAND_MAP, 22, { levels: { fries: 194, sign: 120 } });
    const v5 = { ...makeSave(s, 1000), version: 5, levels: { fries: 194, sign: 120 } } as Record<string, unknown>;
    delete v5.works;
    const loaded = parseSave(JSON.stringify(v5));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.save.levels.fries).toBe(194);
    expect(loaded.save.levels.sign).toBe(120);
    expect(restaurantLevel(loaded.save.levels)).toBe(2);
  });
});
