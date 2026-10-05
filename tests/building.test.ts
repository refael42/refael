import { describe, expect, it } from 'vitest';
import { CONSTRUCTION, TIERS } from '../src/data/buildings';
import { Dish } from '../src/data/dishes';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { ROLES } from '../src/data/staff';
import { big } from '../src/sim/big';
import { canBuy, costOf, upgradeDef } from '../src/sim/economy/upgrades';
import { createGame } from '../src/sim/game/create';
import { dishPrice } from '../src/sim/game/customers';
import { Ev } from '../src/sim/game/events';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { capacity } from '../src/sim/game/workers';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';

function run(s: GameState, seconds: number) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) stepGame(s, STEP_SEC);
}

/** A busy diner with a full team and a few tables bought, rich enough to expand. */
function busyDiner(): GameState {
  const s = createGame(STAND_MAP, 3, { roster: ['cook', 'waiter', 'washer', 'waiter'], levels: { tables: 2, fries: 12 } });
  run(s, 60);
  s.coins = big('1e12');
  return s;
}

describe('building tiers', () => {
  it('buying the lot closes the restaurant for a construction show', () => {
    const s = busyDiner();
    const coins = s.coins;
    expect(buyUpgrade(s, 'building')).toBe(true);
    expect(coins.sub(s.coins).eq(costOf(upgradeDef('building'), 0))).toBe(true);
    expect(s.construction).not.toBeNull();
    expect(s.events.some((e) => e.type === Ev.Build)).toBe(true);
    // Nobody waits in line during building work, and nobody new comes in.
    expect(s.customers.some((c) => c.state === CustomerState.Queued || c.state === CustomerState.Arriving)).toBe(false);
    const before = s.customers.length;
    run(s, CONSTRUCTION.seconds / 2);
    expect(s.customers.length).toBeLessThanOrEqual(before);
    expect(s.events.filter((e) => e.type === Ev.Dust).length).toBeGreaterThan(3);
    expect(s.map.tier).toBe(0);
  });

  it('reopens on the bigger map with all the progress and the whole team', () => {
    const s = busyDiner();
    const team = s.staff.map((st) => `${st.role}:${st.name}:${st.level}`).sort();
    const rating = s.rating;
    buyUpgrade(s, 'building');
    const coins = s.coins;
    run(s, CONSTRUCTION.seconds + STEP_SEC * 2);
    expect(s.construction).toBeNull();
    expect(s.map.tier).toBe(1);
    expect(s.map.building.x1).toBe(TIERS[1]!.width);
    expect(s.staff.map((st) => `${st.role}:${st.name}:${st.level}`).sort()).toEqual(team);
    expect(s.coins.gte(coins)).toBe(true);
    expect(s.rating).toBeCloseTo(rating, 5);
    expect(s.levels.tables).toBe(2);
    expect(s.tables).toHaveLength(3 + 2);
    expect(s.events.some((e) => e.type === Ev.Built)).toBe(true);
    // The bigger place keeps working: customers come in again.
    run(s, 30);
    expect(s.customers.length).toBeGreaterThan(0);
  });

  it('a bigger building fits more tables and staff, and everything sells for more', () => {
    const small = createGame(STAND_MAP, 1);
    const big1 = createGame(mapForTier(1), 1, { levels: { building: 1 } });
    expect(canBuy(upgradeDef('tables'), { tables: 4 }, big('1e30'), small.map)).toBe(false);
    expect(canBuy(upgradeDef('tables'), { tables: 4, building: 1 }, big('1e30'), big1.map)).toBe(true);
    expect(capacity(big1, 'waiter')).toBe(ROLES.waiter.cap + (TIERS[1]!.staff.waiter ?? 0));
    expect(dishPrice(big1, Dish.Fries).gt(dishPrice(small, Dish.Fries))).toBe(true);
    expect(big1.mods.arrivals).toBeGreaterThan(small.mods.arrivals);
  });

  it('the last building has no lot left to buy', () => {
    const last = TIERS.length - 1;
    const s = createGame(mapForTier(last), 1, { levels: { building: last } });
    expect(canBuy(upgradeDef('building'), s.levels, big('1e300'), s.map)).toBe(false);
  });

  it('a save remembers the building, and the caps that come with it', () => {
    const s = createGame(mapForTier(1), 1, { levels: { building: 1, tables: 9 } });
    const loaded = parseSave(JSON.stringify(makeSave(s, 0)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 1);
    expect(back.map.tier).toBe(1);
    expect(back.tables).toHaveLength(3 + 9);
    // The same table count in the small diner is cut down to what fits there.
    const tooMany = parseSave(JSON.stringify({ ...makeSave(s, 0), levels: { tables: 9 } }));
    expect(tooMany.ok && tooMany.save.levels.tables).toBe(STAND_MAP.tables.length - STAND_MAP.startTables);
  });
});
