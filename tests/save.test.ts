import { describe, expect, it } from 'vitest';
import { OFFLINE } from '../src/data/economy';
import { STAND_MAP } from '../src/data/maps';
import { big } from '../src/sim/big';
import { createGame } from '../src/sim/game/create';
import { buyUpgrade } from '../src/sim/game/purchase';
import { offlineEarnings } from '../src/sim/offline';
import { makeSave, parseSave, restoreGame, SAVE_VERSION, type SaveData } from '../src/sim/save';

const NOW = 1_800_000_000_000;

const FULL = ['cook', 'waiter', 'washer'] as const;

function savedGame(): SaveData {
  const s = createGame(STAND_MAP, 1, { roster: FULL });
  s.coins = big(5000);
  for (const id of ['fries', 'fries', 'tables', 'plates', 'stove']) buyUpgrade(s, id);
  s.levels = { ...s.levels, fries: 12 };
  s.rating = 4.2;
  return makeSave(s, NOW);
}

describe('save format', () => {
  it('round-trips through JSON and rebuilds the restaurant', () => {
    const save = savedGame();
    const loaded = parseSave(JSON.stringify(save));
    expect(loaded).toEqual({ ok: true, save });
    const s = restoreGame(STAND_MAP, save, 2);
    expect(s.levels).toEqual({ fries: 12, tables: 1, plates: 1, stove: 1 });
    expect(s.tables).toHaveLength(STAND_MAP.startTables + 1);
    expect(s.rating).toBe(4.2);
    expect(s.coins.toString()).toBe(big(save.coins).toString());
  });

  it('keeps giant numbers exact', () => {
    const save = { ...savedGame(), coins: '1.2345e500' };
    const loaded = parseSave(JSON.stringify(save));
    expect(loaded.ok && restoreGame(STAND_MAP, loaded.save, 1).coins.exponent).toBe(500);
  });

  it('tells empty, corrupt and newer-version saves apart', () => {
    expect(parseSave(null)).toEqual({ ok: false, reason: 'empty' });
    expect(parseSave('{"version":1,')).toEqual({ ok: false, reason: 'corrupt' });
    expect(parseSave(JSON.stringify({ ...savedGame(), coins: 42 }))).toEqual({ ok: false, reason: 'corrupt' });
    expect(parseSave(JSON.stringify({ ...savedGame(), version: SAVE_VERSION + 1 }))).toEqual({ ok: false, reason: 'future' });
  });

  it('drops removed upgrades and clamps capped ones', () => {
    const save = { ...savedGame(), levels: { fries: 3.7, gone: 9, tables: 99, sink: -2 } };
    const loaded = parseSave(JSON.stringify(save));
    expect(loaded.ok && loaded.save.levels).toEqual({ fries: 3, tables: 4 });
  });

  it('migrates old versions step by step', () => {
    // An M3 (v1) save: no team stored, because every restaurant had the same three workers.
    const v1 = { version: 1, savedAt: NOW, coins: '7e0', earned: '7e0', rating: 3, served: 1, levels: { stove: 3 } };
    const loaded = parseSave(JSON.stringify(v1));
    expect(loaded.ok && loaded.save.version).toBe(SAVE_VERSION);
    expect(loaded.ok && loaded.save.team.map((w) => w.role)).toEqual(['cook', 'waiter', 'washer']);
    const s = loaded.ok ? restoreGame(STAND_MAP, loaded.save, 1) : null;
    expect(s?.staff).toHaveLength(3);
    expect(s?.levels).toEqual({ stove: 3 });
    // A missing step in the chain is never guessed at.
    expect(parseSave(JSON.stringify(v1), {})).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('keeps the team: names, stats, levels, wages', () => {
    const save = savedGame();
    const s = restoreGame(STAND_MAP, save, 3);
    expect(s.staff.map((st) => st.role)).toEqual(['cook', 'waiter', 'washer']);
    const again = makeSave(s, NOW);
    expect(again.team).toEqual(save.team);
  });
});

describe('offline progress', () => {
  it('pays nothing for short breaks', () => {
    expect(offlineEarnings(STAND_MAP, savedGame(), NOW + 30_000)).toBeNull();
  });

  it('pays for time away, up to the cap', () => {
    const save = savedGame();
    const hour = offlineEarnings(STAND_MAP, save, NOW + 3600_000)!;
    expect(hour.coins.gt(0)).toBe(true);
    const long = offlineEarnings(STAND_MAP, save, NOW + 24 * 3600_000)!;
    expect(long.paidSeconds).toBe(OFFLINE.capHours * 3600);
    expect(long.coins.toNumber()).toBeCloseTo(hour.coins.toNumber() * OFFLINE.capHours, -2);
  });

  it('a better restaurant earns more while you are away', () => {
    const basic = savedGame();
    const better = { ...basic, levels: { ...basic.levels, fries: 30, fridge: 10 } };
    const away = NOW + 3600_000;
    expect(offlineEarnings(STAND_MAP, better, away)!.coins.gt(offlineEarnings(STAND_MAP, basic, away)!.coins)).toBe(true);
  });

  it('nobody earns while you are away if nobody serves', () => {
    const lonelyCook = { ...savedGame(), team: savedGame().team.filter((w) => w.role === 'cook') };
    expect(offlineEarnings(STAND_MAP, lonelyCook, NOW + 3600_000)).toBeNull();
  });
});
