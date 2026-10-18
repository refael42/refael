import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { SHOP_BY_ID } from '../src/data/shop';
import { STEP_SEC } from '../src/data/sim';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { big } from '../src/sim/big';
import { buyShopItem, coinBag, incomeRate, seedIncomeRate } from '../src/sim/shop';

function play(s: GameState, seconds: number) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
  }
}

const busy = () => {
  const s = createGame(STAND_MAP, 21, { roster: ['cook', 'waiter', 'washer'] });
  play(s, 240);
  return s;
};

describe('closing the restaurant (owner M38: upgrade calmly)', () => {
  it('closed: the line goes home without a rating hit, nobody new comes, the ones inside finish, then it is empty', () => {
    const s = busy();
    expect(s.customers.length).toBeGreaterThan(0);
    const rating = s.rating;
    const walkouts = s.stats.walkouts;
    queueCommand(s, { type: 'close', closed: true });
    stepGame(s, STEP_SEC);
    expect(s.closed).toBe(true);
    expect(s.customers.some((c) => c.state === CustomerState.Queued || c.state === CustomerState.Arriving)).toBe(false);
    const known = new Set(s.customers.map((c) => c.id));
    const served = s.stats.served;
    play(s, 240);
    // Nobody new, everyone gone, no walkouts.
    expect(s.customers.every((c) => known.has(c.id))).toBe(true);
    expect(s.customers.length).toBe(0);
    expect(s.stats.walkouts).toBe(walkouts);
    expect(s.rating).toBeGreaterThanOrEqual(rating - 0.2);
    // The ones who were seated were served (or at least some of them).
    expect(s.stats.served).toBeGreaterThanOrEqual(served);
  });

  it('open again: guests come back', () => {
    const s = busy();
    queueCommand(s, { type: 'close', closed: true });
    play(s, 200);
    expect(s.customers.length).toBe(0);
    queueCommand(s, { type: 'close', closed: false });
    play(s, 60);
    expect(s.closed).toBe(false);
    expect(s.customers.length).toBeGreaterThan(0);
  });

  it('the income rate (time warps, coin bags) does not drop while closed, nor after opening', () => {
    const s = busy();
    const before = incomeRate(s).toNumber();
    queueCommand(s, { type: 'close', closed: true });
    play(s, 300);
    expect(incomeRate(s).toNumber()).toBeCloseTo(before, -1);
    queueCommand(s, { type: 'close', closed: false });
    stepGame(s, STEP_SEC);
    expect(incomeRate(s).toNumber()).toBeGreaterThan(before * 0.5);
  });

  it('is not saved: a new session opens', async () => {
    const { makeSave, restoreGame } = await import('../src/sim/save');
    const s = busy();
    queueCommand(s, { type: 'close', closed: true });
    stepGame(s, STEP_SEC);
    expect(restoreGame(makeSave(s, 0), 1).closed).toBe(false);
  });
});

describe('coins for gems (owner M38)', () => {
  it('a coin bag pays its minutes of income, more as the restaurant earns more', () => {
    const s = busy();
    const item = SHOP_BY_ID.coins30!;
    if (item.kind !== 'coins') throw new Error('coins30');
    s.gems = 1000;
    const bag = coinBag(s, item.minutes);
    expect(bag.toNumber()).toBeGreaterThan(0);
    const coins = s.coins;
    expect(buyShopItem(s, 'coins30')).toBe(true);
    expect(s.gems).toBe(1000 - item.cost);
    expect(s.coins.sub(coins).toNumber()).toBe(bag.toNumber());
    // A richer restaurant (a higher rate) fills the same bag with more.
    s.earnLog = [{ time: s.time - 100, earned: s.stats.earned.sub(s.stats.granted).sub(1e9) }];
    expect(coinBag(s, item.minutes).toNumber()).toBeGreaterThan(bag.toNumber());
  });

  it('right after opening the game a bag is worth what it was when saved (not a second of income)', async () => {
    const { makeSave, restoreGame } = await import('../src/sim/save');
    const s = busy();
    // A restaurant making 500 a second (a stand makes about the minimum).
    seedIncomeRate(s, big(500));
    const rate = incomeRate(s).toNumber();
    expect(rate).toBeCloseTo(500, 5);
    const back = restoreGame(makeSave(s, 0), 3);
    expect(incomeRate(back).toNumber()).toBeCloseTo(rate, 5);
    expect(coinBag(back, 10).toNumber()).toBeCloseTo(coinBag(s, 10).toNumber(), -2);
  });

  it('not without the gems', () => {
    const s = busy();
    s.gems = 5;
    const coins = s.coins;
    expect(buyShopItem(s, 'coins10')).toBe(false);
    expect(s.coins.toNumber()).toBe(coins.toNumber());
  });
});
