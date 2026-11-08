import { describe, expect, it } from 'vitest';

import { UPGRADES } from '../src/data/upgrades';
import { nextVersionAt, VERSIONS, versionOf } from '../src/data/versions';
import { DICTS } from '../src/i18n/strings';
import { Big, createGame, eventsSince, queueCommand, stepGame } from '../src/sim';

describe('upgrade versions', () => {
  it('every line is an upgrade, in order, within its levels, named in both languages', () => {
    for (const [id, at] of Object.entries(VERSIONS)) {
      const def = UPGRADES.find((u) => u.id === id);
      expect(def, id).toBeDefined();
      for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThan(at[i - 1]);
      expect(at[at.length - 1]).toBeLessThanOrEqual(def!.maxLevel);
      for (let v = 1; v <= at.length; v++)
        for (const lang of ['en', 'he'] as const) expect((DICTS[lang] as Record<string, string>)[`ver.${id}.${v}`], `${lang} ver.${id}.${v}`).toBeTruthy();
    }
  });

  it('the version and the next one by level', () => {
    expect(versionOf('kiosk', 0)).toBe(0);
    expect(versionOf('kiosk', 1)).toBe(1);
    expect(versionOf('kiosk', 9)).toBe(1);
    expect(versionOf('kiosk', 10)).toBe(2);
    expect(versionOf('kiosk', 100)).toBe(4);
    expect(nextVersionAt('kiosk', 3)).toBe(10);
    expect(nextVersionAt('kiosk', 50)).toBeNull();
    // the tower is there from the start
    expect(versionOf('tower', 0)).toBe(1);
    expect(versionOf('tower', 4)).toBe(3);
    expect(versionOf('ticket', 50)).toBe(0);
  });

  it('a bought upgrade says which one and the level it reached (for the pop on the map)', () => {
    const s = createGame(3);
    s.money = Big.fromNumber(1e9);
    queueCommand(s, { type: 'buyUpgrade', id: 'kiosk', count: 10 });
    stepGame(s);
    const e = eventsSince(s, 0).find((x) => x.kind === 'upgraded')!;
    expect(UPGRADES[e.b].id).toBe('kiosk');
    expect(e.a).toBe(10);
    expect(e.c).toBe(10);
    expect(versionOf('kiosk', e.c)).toBeGreaterThan(versionOf('kiosk', e.c - e.a));
  });
});
