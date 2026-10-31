import { describe, expect, it } from 'vitest';
import { ADS } from '../src/data/ads';
import { STAND_MAP } from '../src/data/maps';
import { WHEEL } from '../src/data/wheel';
import { adBoostLeft, adOpen, adsLeft, cleanAds, grantAd } from '../src/sim/ads';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { boostNow } from '../src/sim/shop';
import type { GameState } from '../src/sim/game/types';

// Owner, idea 12: "watch an ad and get x2 for a while" (rewarded ads, the player's choice).

const game = (): GameState => {
  const s = createGame(STAND_MAP, 3);
  s.stats.served = ADS.minServed;
  return s;
};

describe('rewarded ads', () => {
  it('not in the tutorial (except doubling what was earned away)', () => {
    const s = createGame(STAND_MAP, 3);
    expect(adOpen(s, 'gems', 100)).toBe(false);
    expect(adOpen(s, 'offline', 100)).toBe(true);
  });

  it('x2 income, 15 minutes an ad, stored up to an hour', () => {
    const s = game();
    expect(grantAd(s, 'boost', 100)).toBe(true);
    expect(boostNow(s)).toBe(ADS.boostMult);
    expect(adBoostLeft(s)).toBeCloseTo(ADS.boostMinutes * 60, 3);
    for (let i = 0; i < 5; i++) grantAd(s, 'boost', 100);
    expect(adBoostLeft(s)).toBeLessThanOrEqual(ADS.boostCapMinutes * 60 + 1e-6);
    // Full: no more today until it runs down.
    expect(adOpen(s, 'boost', 100)).toBe(false);
    expect(s.events.some((e) => e.type === Ev.AdReward)).toBe(true);
  });

  it('a bigger paid boost is never cut short by an ad', () => {
    const s = game();
    s.boost = { mult: 5, until: s.time + 600 };
    expect(grantAd(s, 'boost', 100)).toBe(false);
    expect(s.boost.mult).toBe(5);
  });

  it('gems and wheel spins, each with its limit a day; a new day starts over', () => {
    const s = game();
    const gems = s.gems;
    while (grantAd(s, 'gems', 100));
    expect(s.gems).toBe(gems + ADS.gems * ADS.perDay.gems);
    expect(adsLeft(s, 'gems', 100)).toBe(0);
    expect(adsLeft(s, 'gems', 101)).toBe(ADS.perDay.gems);
    expect(grantAd(s, 'gems', 101)).toBe(true);
    // The wheel opens with the bistro.
    expect(adOpen(s, 'spin', 101)).toBe(false);
    s.mods = { ...s.mods, building: 1 };
    s.levels = { ...s.levels, building: 1 };
    if (adOpen(s, 'spin', 101)) {
      expect(grantAd(s, 'spin', 101)).toBe(true);
      expect(s.wheel.tokens).toBe(1);
      s.wheel.tokens = WHEEL.maxTokens;
      expect(adOpen(s, 'spin', 101)).toBe(false);
    }
  });

  it('kept in the save; odd values cleaned', () => {
    const s = game();
    grantAd(s, 'gems', 100);
    const r = parseSave(JSON.stringify(makeSave(s, 1000)));
    if (!r.ok) throw new Error(r.reason);
    const back = restoreGame(r.save, 1, 2000);
    expect(adsLeft(back, 'gems', 100)).toBe(ADS.perDay.gems - 1);
    expect(cleanAds({ day: 'x', used: { gems: -3, nope: 4 } })).toEqual({ day: -1, used: { gems: 0 } });
  });
});
