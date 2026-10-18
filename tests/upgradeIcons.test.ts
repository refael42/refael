import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UPGRADES } from '../src/data/upgrades';

// The icon table lives in render code (Skia), so it is read as text, like tests/worklets.test.ts.
const icons = readFileSync('src/render/upgradeIcons.ts', 'utf8');

describe('upgrade icons (owner: the pad thai recipe showed a table)', () => {
  it('every upgrade has its own picture, not the fallback', () => {
    const missing = UPGRADES.map((u) => u.id).filter((id) => !new RegExp(`^\\s+${id}: \\{ base: '`, 'm').test(icons));
    expect(missing).toEqual([]);
  });

  it('every recipe shows its own plate', () => {
    for (const u of UPGRADES.filter((x) => x.unlocksDish !== undefined || x.category === 'menu')) {
      const line = new RegExp(`^\\s+${u.id}: \\{ base: '([^']+)'`, 'm').exec(icons);
      if (!line || u.id === 'rank') continue;
      expect(line[1], u.id).toMatch(/^plate/);
    }
  });
});
