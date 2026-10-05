import { describe, expect, it } from 'vitest';
import { Dish } from '../src/data/dishes';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { KITCHEN } from '../src/data/staff';
import { UPGRADES } from '../src/data/upgrades';
import { big } from '../src/sim/big';
import {
  canBuy,
  computeMods,
  costOf,
  itemValue,
  milestonesReached,
  nextMilestone,
  prevMilestone,
  tierOf,
  upgradeDef,
} from '../src/sim/economy/upgrades';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, OrderState, type GameState } from '../src/sim/game/types';
import { isWalkable } from '../src/sim/grid';

const rich = (s: GameState) => {
  s.coins = big('1e30');
};

describe('upgrade catalog', () => {
  it('has unique ids and sane numbers', () => {
    const ids = new Set(UPGRADES.map((u) => u.id));
    expect(ids.size).toBe(UPGRADES.length);
    for (const u of UPGRADES) {
      expect(u.baseCost).toBeGreaterThan(0);
      expect(u.growth).toBeGreaterThan(1);
      if (u.requires) expect(ids.has(u.requires.item)).toBe(true);
    }
  });
});

describe('costs', () => {
  it('grow by the item growth rate and never overflow', () => {
    const stove = upgradeDef('stove');
    expect(costOf(stove, 0).toNumber()).toBe(12);
    expect(costOf(stove, 1).toNumber()).toBe(Math.ceil(12 * 1.15));
    const huge = costOf(stove, 20000);
    expect(huge.exponent).toBeGreaterThan(1000);
    expect(Number.isFinite(huge.mantissa)).toBe(true);
  });
});

describe('milestones', () => {
  it('follow the listed levels, then every 50 forever', () => {
    expect([0, 9, 10, 24, 25, 100, 149, 150, 1000].map(milestonesReached)).toEqual([0, 0, 1, 1, 2, 5, 5, 6, 23]);
    expect([0, 10, 99, 100, 149, 150].map(nextMilestone)).toEqual([10, 25, 100, 150, 150, 200]);
    expect([0, 9, 10, 99, 100, 149, 150].map(prevMilestone)).toEqual([0, 0, 10, 75, 100, 100, 150]);
    expect(tierOf(9)).toBe(0);
    expect(tierOf(50)).toBe(3);
    expect(tierOf(75)).toBe(4);
    expect(tierOf(5000)).toBe(5);
  });

  it('multiply the item value', () => {
    const fries = upgradeDef('fries');
    expect(itemValue(fries, 9)).toBeCloseTo(1 + 0.3 * 9);
    expect(itemValue(fries, 10)).toBeCloseTo((1 + 0.3 * 10) * 2);
    expect(itemValue(upgradeDef('plates'), 7)).toBe(7);
  });
});

describe('mods', () => {
  it('start neutral with only the starting dishes', () => {
    const m = computeMods({});
    expect(m.cookSpeed).toBe(1);
    expect(m.tables).toBe(0);
    expect(m.menu).toEqual([true, false]);
  });

  it('add within a stat and multiply milestones on top', () => {
    const m = computeMods({ fries: 10, stove: 1, sign: 2, plants: 1, burger: 1 });
    expect(m.price[Dish.Fries]).toBeCloseTo(8);
    expect(m.cookSpeed).toBeCloseTo(1.08);
    expect(m.arrivals).toBeCloseTo(1 + 0.06 * 2 + 0.03);
    expect(m.menu[Dish.Burger]).toBe(true);
  });

  it('respect requirements and caps', () => {
    const burger = upgradeDef('burger');
    expect(canBuy(burger, { fries: 4 }, big(1e9), STAND_MAP)).toBe(false);
    expect(canBuy(burger, { fries: 5 }, big(1e9), STAND_MAP)).toBe(true);
    // Tables are capped by the free spots of the building: a bigger one has room for more.
    expect(canBuy(upgradeDef('tables'), { tables: 4 }, big(1e30), STAND_MAP)).toBe(false);
    expect(canBuy(upgradeDef('tables'), { tables: 4 }, big(1e30), mapForTier(1))).toBe(true);
  });
});

describe('buying in the sim', () => {
  it('costs coins, raises the level and celebrates at the station', () => {
    const s = createGame(STAND_MAP, 1);
    s.coins = big(100);
    expect(buyUpgrade(s, 'stove')).toBe(true);
    expect(s.coins.toNumber()).toBe(88);
    expect(s.levels.stove).toBe(1);
    expect(s.mods.cookSpeed).toBeCloseTo(1.08);
    expect(s.events.some((e) => e.type === Ev.Upgrade && e.a === 1)).toBe(true);
    s.coins = big(0);
    expect(buyUpgrade(s, 'stove')).toBe(false);
    expect(s.levels.stove).toBe(1);
  });

  it('goes through the command queue like any tap', () => {
    const s = createGame(STAND_MAP, 1);
    s.coins = big(5);
    queueCommand(s, { type: 'buy', item: 'fries' });
    stepGame(s, STEP_SEC);
    expect(s.levels.fries).toBe(1);
  });

  it('a new table appears in the next spot and blocks its tiles', () => {
    const s = createGame(STAND_MAP, 1);
    rich(s);
    const spot = STAND_MAP.tables[STAND_MAP.startTables]!;
    expect(isWalkable(s.grid, spot)).toBe(true);
    expect(buyUpgrade(s, 'tables')).toBe(true);
    expect(s.tables).toHaveLength(STAND_MAP.startTables + 1);
    expect(isWalkable(s.grid, spot)).toBe(false);
    for (let i = 0; i < 10; i++) buyUpgrade(s, 'tables');
    expect(s.tables).toHaveLength(STAND_MAP.tables.length);
  });

  it('bought plates land on the clean stack', () => {
    const s = createGame(STAND_MAP, 1);
    rich(s);
    buyUpgrade(s, 'plates');
    buyUpgrade(s, 'plates');
    expect(s.cleanPlates).toBe(KITCHEN.plates + 2);
  });

  it('saved levels rebuild the same restaurant', () => {
    const s = createGame(STAND_MAP, 1, { levels: { tables: 2, plates: 3, burger: 1 } });
    expect(s.tables).toHaveLength(STAND_MAP.startTables + 2);
    expect(s.cleanPlates).toBe(KITCHEN.plates + 3);
    expect(s.mods.menu[Dish.Burger]).toBe(true);
  });

  it('a better stove really cooks faster', () => {
    const cookTime = (levels: Record<string, number>) => {
      const s = createGame(STAND_MAP, 3, { levels, roster: ['cook'] });
      let started = -1;
      for (let i = 0; i < 4000; i++) {
        for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
        stepGame(s, STEP_SEC);
        const o = s.orders[0];
        if (o?.state === OrderState.Cooking && started < 0) started = s.time;
        if (o && o.state >= OrderState.Plating && started >= 0) return s.time - started;
      }
      throw new Error('no dish cooked');
    };
    expect(cookTime({ stove: 25 })).toBeLessThan(cookTime({}) / 2);
  });

  it('only unlocked dishes get ordered', () => {
    const s = createGame(STAND_MAP, 4);
    for (let i = 0; i < 6000; i++) {
      for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
      stepGame(s, STEP_SEC);
      for (const o of s.orders) expect(o.dish).toBe(Dish.Fries);
    }
  });
});
