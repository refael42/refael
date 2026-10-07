import { describe, expect, it } from 'vitest';
import { DAILY, GIFT, VIP } from '../src/data/retention';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { claimDaily, dailyToday, maybeVip, vipBonus } from '../src/sim/retention';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';

const run = (s: GameState, seconds: number) => {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
  }
};

describe('daily gift', () => {
  it('counts the days in a row, starts over after a missed day, and after day 7', () => {
    expect(dailyToday({ last: null, streak: 0 }, '2026-10-06', '2026-10-05')).toEqual({ day: 1, ready: true });
    expect(dailyToday({ last: '2026-10-05', streak: 3 }, '2026-10-06', '2026-10-05')).toEqual({ day: 4, ready: true });
    expect(dailyToday({ last: '2026-10-01', streak: 3 }, '2026-10-06', '2026-10-05')).toEqual({ day: 1, ready: true });
    expect(dailyToday({ last: '2026-10-06', streak: 4 }, '2026-10-06', '2026-10-05')).toEqual({ day: 4, ready: false });
    expect(dailyToday({ last: '2026-10-05', streak: 7 }, '2026-10-06', '2026-10-05')).toEqual({ day: 1, ready: true });
  });

  it('gives coins, gems or a boost once a day, and the streak is saved', () => {
    const s = createGame(STAND_MAP, 1, { daily: { last: '2026-10-05', streak: 2 } });
    const gems = s.gems;
    queueCommand(s, { type: 'daily', today: '2026-10-06', yesterday: '2026-10-05' });
    stepGame(s, STEP_SEC);
    expect(s.gems).toBe(gems + DAILY.rewards[2]!.gems);
    expect(s.daily).toEqual({ last: '2026-10-06', streak: 3 });
    expect(claimDaily(s, '2026-10-06', '2026-10-05')).toBe(false);
    const loaded = parseSave(JSON.stringify(makeSave(s, 1000)));
    expect(loaded.ok && restoreGame(loaded.save, 1).daily).toEqual({ last: '2026-10-06', streak: 3 });
  });

  it('day 7 brings gems and an income boost', () => {
    const s = createGame(STAND_MAP, 2, { daily: { last: '2026-10-05', streak: 6 } });
    expect(claimDaily(s, '2026-10-06', '2026-10-05')).toBe(true);
    expect(s.boost.mult).toBe(DAILY.rewards[6]!.boostMult);
    expect(s.boost.until - s.time).toBeCloseTo(DAILY.rewards[6]!.boostMinutes! * 60, 3);
  });
});

describe('presents on the sidewalk', () => {
  it('one shows up by the door, waits for a tap, and pays out', () => {
    const s = createGame(STAND_MAP, 3, { roster: ['cook', 'waiter', 'washer'] });
    run(s, GIFT.firstSeconds + 0.5);
    expect(s.gift).not.toBeNull();
    const coins = s.coins;
    const gems = s.gems;
    queueCommand(s, { type: 'gift' });
    stepGame(s, STEP_SEC);
    expect(s.gift).toBeNull();
    expect(s.coins.gt(coins) || s.gems > gems).toBe(true);
    expect(s.events.some((e) => e.type === Ev.Gift)).toBe(true);
  });

  it('goes away if nobody takes it, and the next one comes later', () => {
    const s = createGame(STAND_MAP, 4, { roster: ['cook', 'waiter', 'washer'] });
    run(s, GIFT.firstSeconds + GIFT.staysSeconds + 1);
    expect(s.gift).toBeNull();
    expect(s.nextGift).toBeGreaterThan(s.time);
  });
});

describe('VIP guests', () => {
  it('come only once the place is known, one at a time, and pay a bonus by the grade', () => {
    const s = createGame(STAND_MAP, 5, { coins: big(0) });
    const c = { id: 1, vip: false, rank: 0, x: 1, y: 1 } as unknown as Parameters<typeof maybeVip>[1];
    maybeVip(s, c);
    expect(c.vip).toBe(false);
    s.time = VIP.afterSeconds + 1;
    // Some ids are VIPs (a fixed hash, not the dice): find one.
    let found = false;
    for (let id = 1; id < 400 && !found; id++) {
      const g = { id, vip: false, rank: 0, x: 1, y: 1 } as unknown as Parameters<typeof maybeVip>[1];
      maybeVip(s, g);
      if (g.vip) {
        found = true;
        expect(g.rank).toBe(3);
        const before = s.coins;
        vipBonus(s, g, 5);
        expect(s.coins.gt(before)).toBe(true);
      }
    }
    expect(found).toBe(true);
  });
});
