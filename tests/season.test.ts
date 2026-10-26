import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { MISSIONS, SEASON, SEASON_TIERS } from '../src/data/season';
import { STEP_SEC } from '../src/data/sim';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import {
  buyGoldWithGems, claimMission, claimSeason, missionDone, missionHave, missionOpen, missionsReady, seasonAt, seasonBonus, seasonCount, seasonEnds,
  seasonPrizes, seasonStarts, syncSeason, tiersReached,
} from '../src/sim/season';
import { grantPurchase } from '../src/sim/shop';
import { openBranch } from '../src/sim/franchise';

// Owner M50: the season pass. Four-week seasons by the phone's clock, daily and weekly missions
// from the game's own systems, XP up 30 tiers, a free and a gold track, medals for good.

const team = ['cook', 'waiter', 'washer'] as const;
const DAY = 24 * 3600 * 1000;
/** Noon on day 3 of season 5 (UTC, no time zone shift). */
const NOW = seasonStarts(5) + 2 * DAY + 12 * 3600 * 1000;

const game = (): GameState => createGame(STAND_MAP, 4, { roster: [...team] });

describe('season clock', () => {
  it('is the same season on every phone and runs four weeks', () => {
    expect(seasonAt(SEASON.epoch)).toBe(0);
    expect(seasonAt(seasonEnds(0) - 1)).toBe(0);
    expect(seasonAt(seasonEnds(0))).toBe(1);
    expect(seasonEnds(3) - seasonStarts(3)).toBe(SEASON.days * DAY);
  });

  it('the first clock reading starts the season with three daily and five weekly missions', () => {
    const s = game();
    syncSeason(s, NOW, 0);
    expect(s.season.id).toBe(5);
    expect(s.season.daily).toHaveLength(SEASON.dailyCount);
    expect(s.season.weekly).toHaveLength(SEASON.weeklyCount);
    // Different kinds in each list, all of them open in this restaurant.
    expect(new Set(s.season.daily.map((m) => m.kind)).size).toBe(SEASON.dailyCount);
    expect(new Set(s.season.weekly.map((m) => m.kind)).size).toBe(SEASON.weeklyCount);
    for (const m of [...s.season.daily, ...s.season.weekly]) expect(missionOpen(s, MISSIONS.find((d) => d.kind === m.kind)!)).toBe(true);
    // A first stand has no bartender, courier or checker: none of their missions.
    expect([...s.season.daily, ...s.season.weekly].some((m) => ['drink', 'delivery', 'caught'].includes(m.kind))).toBe(false);
  });

  it('a new local day brings new daily missions (done ones pay first); a new week adds weekly ones', () => {
    const s = game();
    syncSeason(s, NOW, 0);
    const first = s.season.daily[0]!;
    seasonCount(s, first.kind, first.need);
    const xp = s.season.xp;
    syncSeason(s, NOW + 3600e3, 0);
    expect(s.season.daily[0]).toBe(first);
    syncSeason(s, NOW + DAY, 0);
    expect(s.season.xp).toBe(xp + SEASON.dailyXp);
    expect(s.season.daily.every((m) => !m.claimed)).toBe(true);
    syncSeason(s, NOW + 7 * DAY, 0);
    expect(s.season.weekly).toHaveLength(2 * SEASON.weeklyCount);
    expect(s.season.weekly.slice(SEASON.weeklyCount).every((m) => m.week === 1)).toBe(true);
    // Jumping to the last week brings the missing weeks too, and never more than four.
    syncSeason(s, seasonEnds(5) - 3600e3, 0);
    expect(s.season.weekly).toHaveLength(4 * SEASON.weeklyCount);
  });

  it('the day turns at local midnight (the time zone counts)', () => {
    const s = game();
    // 23:30 UTC = 01:30 in Israel (UTC+2: offset -120).
    const late = seasonStarts(5) + 2 * DAY + 23.5 * 3600e3;
    syncSeason(s, late, 0);
    const utcDay = s.season.day;
    const t = game();
    syncSeason(t, late, -120);
    expect(t.season.day).toBe(utcDay + 1);
  });

  it('a clock that went back changes nothing', () => {
    const s = game();
    syncSeason(s, NOW, 0);
    const daily = s.season.daily;
    syncSeason(s, NOW - 40 * DAY, 0);
    expect(s.season.id).toBe(5);
    expect(s.season.daily).toBe(daily);
  });
});

describe('missions', () => {
  it('count only what happens after they come up, and pay their XP once', () => {
    const s = game();
    seasonCount(s, 'serve', 50);
    expect(s.season.counts.serve).toBeUndefined();
    syncSeason(s, NOW, 0);
    const i = s.season.daily.findIndex((m) => m.kind === 'serve');
    const m = i >= 0 ? s.season.daily[i]! : s.season.daily[0]!;
    const idx = i >= 0 ? i : 0;
    expect(missionHave(s.season, m)).toBe(0);
    expect(claimMission(s, false, idx)).toBe(false);
    seasonCount(s, m.kind, m.need - 1);
    expect(missionDone(s.season, m)).toBe(false);
    seasonCount(s, m.kind, 5);
    expect(missionHave(s.season, m)).toBe(m.need);
    expect(missionsReady(s.season)).toBeGreaterThanOrEqual(1);
    expect(claimMission(s, false, idx)).toBe(true);
    expect(s.season.xp).toBe(SEASON.dailyXp);
    expect(claimMission(s, false, idx)).toBe(false);
  });

  it('grow with the building', () => {
    const small = game();
    syncSeason(small, NOW, 0);
    const big = game();
    big.mods = { ...big.mods, building: 4 };
    syncSeason(big, NOW, 0);
    const need = (s: GameState) => s.season.weekly.find((m) => m.kind === 'serve')?.need ?? s.season.daily.find((m) => m.kind === 'serve')?.need;
    const a = need(small);
    const b = need(big);
    if (a !== undefined && b !== undefined) expect(b).toBeGreaterThan(a);
    const total = (s: GameState) => s.season.weekly.reduce((n, m) => n + m.need, 0);
    expect(total(big)).toBeGreaterThan(total(small));
  });

  it('in play: serving guests moves the serve and five-star counts, buying upgrades the upgrade count', () => {
    const s = game();
    s.chef.xp = -1e12;
    syncSeason(s, NOW, 0);
    for (let i = Math.round(240 / STEP_SEC); i > 0; i--) {
      for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
      stepGame(s, STEP_SEC);
    }
    expect(s.season.counts.serve).toBe(s.stats.served);
    expect(s.season.counts.fiveStar ?? 0).toBeGreaterThan(0);
    expect(s.season.counts.hot ?? 0).toBeGreaterThan(0);
    const before = s.season.counts.upgrades ?? 0;
    s.coins = s.coins.add(1e6);
    queueCommand(s, { type: 'buy', item: 'fries', step: 10 } as never);
    stepGame(s, STEP_SEC);
    expect((s.season.counts.upgrades ?? 0) - before).toBe(10);
  });
});

describe('tiers and prizes', () => {
  it('XP climbs the tiers; prizes are taken in order, the gold track only with the gold pass', () => {
    const s = game();
    syncSeason(s, NOW, 0);
    s.season.xp = SEASON.tierXp * 3 + 10;
    expect(tiersReached(s.season)).toBe(3);
    expect(seasonPrizes(s.season)).toBe(3);
    const gems = s.gems;
    expect(claimSeason(s, 'gold')).toBe(false);
    while (claimSeason(s, 'free'));
    expect(s.season.free).toBe(3);
    expect(claimSeason(s, 'free')).toBe(false);
    // Gold bought mid-season: every gold prize already reached waits.
    s.gems = SEASON.goldGems;
    expect(buyGoldWithGems(s)).toBe(true);
    expect(s.gems).toBe(0);
    expect(buyGoldWithGems(s)).toBe(false);
    expect(seasonPrizes(s.season)).toBe(3);
    while (claimSeason(s, 'gold'));
    expect(s.season.goldTaken).toBe(3);
    expect(s.gems).toBeGreaterThan(0);
    expect(gems).toBeGreaterThanOrEqual(0);
  });

  it('the last free tier gives the medal (every bill higher for good); past it, extra prizes', () => {
    const s = game();
    syncSeason(s, NOW, 0);
    s.season.xp = SEASON.tierXp * (SEASON_TIERS + 2);
    expect(seasonBonus(s)).toBe(1);
    while (claimSeason(s, 'free'));
    expect(s.season.medals.free).toBe(1);
    expect(seasonBonus(s)).toBeCloseTo(1 + SEASON.medal.free, 5);
    expect(s.season.extra).toBe(2);
    expect(seasonPrizes(s.season)).toBe(0);
  });

  it('a new season pays what was reached and not taken, keeps the medals, starts from zero', () => {
    const s = game();
    syncSeason(s, NOW, 0);
    s.season.gold = true;
    s.season.xp = SEASON.tierXp * SEASON_TIERS;
    const gems = s.gems;
    syncSeason(s, seasonEnds(5) + 1000, 0);
    expect(s.season.id).toBe(6);
    expect(s.season.xp).toBe(0);
    expect(s.season.gold).toBe(false);
    expect(s.season.medals).toEqual({ free: 1, gold: 1 });
    expect(s.gems).toBeGreaterThan(gems);
    expect(seasonBonus(s)).toBeCloseTo(1 + SEASON.medal.free + SEASON.medal.gold, 5);
  });
});

describe('the gold pass in the store', () => {
  it('pays once per transaction; one approved after its season ended comes as gems', () => {
    const s = game();
    syncSeason(s, NOW, 0);
    expect(grantPurchase(s, SEASON.goldProduct, 't1', NOW)).toBe(true);
    expect(s.season.gold).toBe(true);
    expect(grantPurchase(s, SEASON.goldProduct, 't1', NOW)).toBe(false);
    const gems = s.gems;
    // Bought again in the same season (it was on already): its gems instead.
    expect(grantPurchase(s, SEASON.goldProduct, 't2', NOW)).toBe(true);
    expect(s.gems).toBe(gems + SEASON.goldGems);
    // Bought in the last season, approved now.
    syncSeason(s, seasonEnds(5) + 1000, 0);
    const g2 = s.gems;
    expect(grantPurchase(s, SEASON.goldProduct, 't3', NOW)).toBe(true);
    expect(s.season.gold).toBe(false);
    expect(s.gems).toBe(g2 + SEASON.goldGems);
  });
});

describe('kept', () => {
  it('in the save, with odd values cleaned', () => {
    const s = game();
    syncSeason(s, NOW, 0);
    seasonCount(s, 'serve', 7);
    s.season.xp = 999;
    s.season.gold = true;
    s.season.medals = { free: 2, gold: 1 };
    const load = (text: string) => {
      const r = parseSave(text);
      if (!r.ok) throw new Error(r.reason);
      return restoreGame(r.save, 1, NOW);
    };
    const back = load(JSON.stringify(makeSave(s, NOW)));
    expect(back.season.id).toBe(5);
    expect(back.season.xp).toBe(999);
    expect(back.season.gold).toBe(true);
    expect(back.season.counts.serve).toBe(7);
    expect(back.season.daily).toEqual(s.season.daily);
    expect(back.season.medals).toEqual({ free: 2, gold: 1 });
    const raw = JSON.parse(JSON.stringify(makeSave(s, NOW)));
    raw.season = { id: 'x', medals: { free: 3, gold: -4 } };
    const odd = load(JSON.stringify(raw));
    expect(odd.season.id).toBe(-1);
    expect(odd.season.medals).toEqual({ free: 3, gold: 0 });
  });

  it('in a new branch (the season is the player\'s)', () => {
    const s = game();
    syncSeason(s, NOW, 0);
    s.season.xp = 500;
    s.season.medals = { free: 1, gold: 0 };
    s.stats.earned = s.stats.earned.add(1e15);
    s.levels = { ...s.levels, building: 6 };
    expect(openBranch(s)).toBe(true);
    expect(s.city).toBe(1);
    expect(s.season.xp).toBe(500);
    expect(s.season.medals.free).toBe(1);
  });
});
