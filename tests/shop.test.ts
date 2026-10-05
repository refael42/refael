import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { GEMS, SHOP_BY_ID, STAR } from '../src/data/shop';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { computeMods } from '../src/sim/economy/upgrades';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { buyShopItem, incomeRate } from '../src/sim/shop';
import { makeSave, MIGRATIONS, parseSave, restoreGame } from '../src/sim/save';

function play(s: GameState, seconds: number) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
  }
}

const team = ['cook', 'waiter', 'washer'] as const;

describe('item shop', () => {
  it('starts with a few gems; a demo gem pack adds its gems; nothing is bought without enough gems', () => {
    const s = createGame(STAND_MAP, 81);
    expect(s.gems).toBe(GEMS.start);
    expect(buyShopItem(s, 'goldenMenu')).toBe(false);
    expect(s.gems).toBe(GEMS.start);
    queueCommand(s, { type: 'gems', amount: 500 });
    stepGame(s, STEP_SEC);
    expect(s.gems).toBe(GEMS.start + 500);
  });

  it('a boost multiplies every bill while it runs', () => {
    const plain = createGame(STAND_MAP, 82, { roster: [...team] });
    const boosted = createGame(STAND_MAP, 82, { roster: [...team], gems: 1000 });
    expect(buyShopItem(boosted, 'boost2')).toBe(true);
    play(plain, 300);
    play(boosted, 300);
    const perMeal = (s: GameState) => s.stats.earned.toNumber() / Math.max(1, s.stats.served);
    expect(perMeal(boosted)).toBeGreaterThan(perMeal(plain) * 1.6);
  });

  it('a perk changes the restaurant for good, and only one of each can be had', () => {
    const s = createGame(STAND_MAP, 83, { gems: 2000 });
    const before = s.mods.price[0]!;
    expect(buyShopItem(s, 'goldenMenu')).toBe(true);
    expect(s.mods.price[0]).toBeCloseTo(before * 1.5);
    expect(buyShopItem(s, 'goldenMenu')).toBe(false);
    expect(computeMods(s.levels, s.perks).price[0]).toBeCloseTo(before * 1.5);
  });

  it('a star worker joins at once, top of their trade, if there is room', () => {
    const s = createGame(STAND_MAP, 84, { gems: 1000 });
    expect(buyShopItem(s, 'starWaiter')).toBe(true);
    const star = s.staff.find((st) => st.role === 'waiter')!;
    expect(star.level).toBe(STAR.level);
    expect(star.stats.speed).toBe(STAR.mainStat);
    expect(star.traits).toEqual([...STAR.traits]);
    expect(s.gems).toBe(1000 - (SHOP_BY_ID.starWaiter as { cost: number }).cost);
    // The stand has room for one cook only: a star cook cannot join.
    expect(buyShopItem(s, 'starCook')).toBe(false);
  });

  it('a time warp pays the recent income rate for its hours', () => {
    const s = createGame(STAND_MAP, 85, { roster: [...team], gems: 500 });
    play(s, 180);
    const rate = incomeRate(s);
    const coins = s.coins;
    expect(buyShopItem(s, 'warp1')).toBe(true);
    expect(s.coins.sub(coins).toNumber()).toBeCloseTo(rate.mul(3600).floor().toNumber(), -1);
  });

  it('a restaurant level-up gives gems', () => {
    const s = createGame(STAND_MAP, 86, { roster: ['cook', 'waiter'], coins: big(1000) });
    queueCommand(s, { type: 'buy', item: 'fries' });
    for (let i = 0; i < 3; i++) queueCommand(s, { type: 'buy', item: 'fries' });
    play(s, 240);
    for (const q of [0, 1, 2]) queueCommand(s, { type: 'claim', quest: q });
    stepGame(s, STEP_SEC);
    expect(s.quests.level).toBe(2);
    expect(s.gems).toBe(GEMS.start + GEMS.perLevelUp);
  });

  it('gems, perks and a running boost are saved; older saves get the starting gems', () => {
    const s = createGame(STAND_MAP, 87, { gems: 2000 });
    buyShopItem(s, 'vipSign');
    buyShopItem(s, 'boost5');
    const loaded = parseSave(JSON.stringify(makeSave(s, 0)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 1);
    expect(back.gems).toBe(s.gems);
    expect(back.perks).toEqual({ vipSign: 1 });
    expect(back.boost.mult).toBe(5);
    expect(back.boost.until).toBeGreaterThan(500);
    const v4 = { ...makeSave(s, 0), version: 4 } as Record<string, unknown>;
    delete v4.gems;
    const migrated = parseSave(JSON.stringify(v4), MIGRATIONS);
    expect(migrated.ok && migrated.save.gems).toBe(GEMS.start);
  });
});
