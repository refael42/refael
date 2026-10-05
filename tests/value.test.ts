import { describe, expect, it } from 'vitest';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { UPGRADES } from '../src/data/upgrades';
import { upgradeDef } from '../src/sim/economy/upgrades';
import { bestValue, gainOf, valuePerCoin } from '../src/sim/economy/value';

describe('best value', () => {
  it('every upgrade you can buy is worth something', () => {
    const levels = { fries: 10, burger: 3, place_flowers: 1, place_lamp: 1, building: 1 };
    const map = mapForTier(1);
    for (const def of UPGRADES) {
      if (def.build || valuePerCoin(def, levels, map) === 0) continue;
      expect(gainOf(def, levels, map), def.id).toBeGreaterThan(0);
    }
  });

  it('a level is worth less per coin the higher it gets (costs grow faster than gains)', () => {
    const fries = upgradeDef('fries');
    expect(valuePerCoin(fries, { fries: 40 }, STAND_MAP)).toBeLessThan(valuePerCoin(fries, { fries: 5 }, STAND_MAP));
  });

  it('ranks by gain per coin, skips what cannot be bought, and opens with the cheap money makers', () => {
    const list = bestValue({}, STAND_MAP);
    expect(list.length).toBeGreaterThan(3);
    expect(list.some((d) => d.build || d.id === 'burger')).toBe(false); // decor is placed in build mode; the burger needs fries Lv 5
    const values = list.map((d) => valuePerCoin(d, {}, STAND_MAP));
    for (let i = 1; i < values.length; i++) expect(values[i]!).toBeLessThanOrEqual(values[i - 1]!);
    expect(list.slice(0, 3).map((d) => d.id)).toContain('fries');
  });
});
