import { describe, expect, it } from 'vitest';

import { play, stockUp } from './helpers';

import { ACHIEVEMENTS, MEDAL_GEMS } from '../src/data/achievements';
import { tierDef } from '../src/data/tiers';
import { DICTS } from '../src/i18n/strings';
import { applyStructural, Big, createGame, parseSave, queueCommand, serializeGame, stepGame, switchTier, type GameState } from '../src/sim';
import { pushEvent } from '../src/sim/game/events';
import { BOOST_SECONDS, CHEST_EVERY, CHEST_GEMS, gainXp, incomeBoost, LEVEL_COINS, medalsOf, medalsToClaim, xpToNext } from '../src/sim/game/career';

function airfield(seed: number): GameState {
  const s = createGame(seed);
  switchTier(s, 2);
  s.upg.stand = 3;
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.money = Big.fromNumber(1e9);
  s.nextIncidentAt = 1e12;
  return s;
}

describe('the manager career', () => {
  it('levels need more experience each time', () => {
    for (let l = 1; l < 60; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    expect(xpToNext(1)).toBeGreaterThan(10);
  });

  it('flights, upgrades and hires give experience; levels pay coins, every fifth a chest', () => {
    const s = airfield(3);
    play(s, 900, 0.5);
    const c = s.career;
    expect(c.level).toBeGreaterThan(1);
    // the levels' coins were paid
    const before = s.money.toNumber();
    const lvl = c.level;
    gainXp(s, xpToNext(lvl) - c.xp);
    expect(c.level).toBe(lvl + 1);
    expect(s.money.toNumber() - before).toBe(Math.round(LEVEL_COINS * (lvl + 1) * tierDef(s.tier).pay));
    // up to the next fifth level: a chest
    while (c.level % CHEST_EVERY !== 0) gainXp(s, xpToNext(c.level) - c.xp);
    expect(c.chests).toBeGreaterThan(0);
  }, 120000);

  it('a chest: diamonds and double income for a while', () => {
    const s = airfield(4);
    s.career.chests = 1;
    const gems = s.diamonds;
    queueCommand(s, { type: 'openChest' });
    stepGame(s);
    expect(s.diamonds).toBe(gems + CHEST_GEMS);
    expect(s.career.chests).toBe(0);
    expect(incomeBoost(s)).toBe(2);
    expect(s.career.boostUntil - s.time).toBeGreaterThan(BOOST_SECONDS - 1);
    // no chest: refused
    queueCommand(s, { type: 'openChest' });
    stepGame(s);
    expect(s.diamonds).toBe(gems + CHEST_GEMS);
    // the boost doubles what a flight pays
    s.career.boostUntil = 0;
    expect(incomeBoost(s)).toBe(1);
  });

  it('achievements: medals reached are collected for diamonds, once', () => {
    const s = airfield(5);
    const i = ACHIEVEMENTS.findIndex((a) => a.id === 'flights');
    s.stats.served = ACHIEVEMENTS[i].medals[1];
    const m = medalsOf(s, i);
    expect(m.reached).toBe(2);
    expect(m.claimed).toBe(0);
    expect(medalsToClaim(s)).toBeGreaterThanOrEqual(2);
    const gems = s.diamonds;
    queueCommand(s, { type: 'claimMedals', index: i });
    stepGame(s);
    expect(s.diamonds - gems).toBe(MEDAL_GEMS[0] + MEDAL_GEMS[1]);
    expect(medalsOf(s, i).claimed).toBe(2);
    queueCommand(s, { type: 'claimMedals', index: i });
    stepGame(s);
    expect(s.diamonds - gems).toBe(MEDAL_GEMS[0] + MEDAL_GEMS[1]);
  });

  it('events count for the career: five-star reviews, inspectors, emergencies, holidays', () => {
    const s = airfield(6);
    pushEvent(s, 'review', 0, 0, 5, 0, 0);
    pushEvent(s, 'review', 0, 0, 3, 0, 0);
    pushEvent(s, 'inspectorLeft', 0, 0, 1, 0, 0);
    pushEvent(s, 'inspectorLeft', 0, 0, 2, 0, 0);
    pushEvent(s, 'emergencyLanded', 0, 0, 1, 100);
    pushEvent(s, 'holiday', 0, 0, 0, 1);
    pushEvent(s, 'holiday', 0, 0, 0, 2);
    pushEvent(s, 'guideEdition', 0, 0, 2, 0, 1);
    stepGame(s);
    stepGame(s);
    const c = s.career.counts;
    expect(c.fiveStars).toBe(1);
    expect(c.inspectors).toBe(1);
    expect(c.emergencies).toBe(1);
    expect(c.holidays).toBe(1);
    expect(c.guideStars).toBe(2);
  });

  it('every achievement has names in both languages; the career survives a save', () => {
    for (const a of ACHIEVEMENTS) {
      for (const lang of ['en', 'he'] as const) {
        const d = DICTS[lang] as Record<string, string>;
        expect(d[`ach.${a.id}`], `${lang} ach.${a.id}`).toBeTruthy();
        expect(d[`ach.${a.id}.how`], `${lang} ach.${a.id}.how`).toContain('{n}');
      }
      for (let k = 1; k < 4; k++) expect(a.medals[k]).toBeGreaterThan(a.medals[k - 1]);
    }
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(16);
    const s = airfield(8);
    s.career.level = 7;
    s.career.xp = 12;
    s.career.chests = 2;
    s.career.counts.fiveStars = 9;
    s.career.medals[0] = 1;
    s.career.boostUntil = s.time + 50;
    const r = parseSave(serializeGame(s, 10), 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.state.career;
    expect(c.level).toBe(7);
    expect(c.xp).toBe(12);
    expect(c.chests).toBe(2);
    expect(c.counts.fiveStars).toBe(9);
    expect(c.medals[0]).toBe(1);
    expect(c.boostUntil).toBeCloseTo(s.time + 50, 3);
  });
});
