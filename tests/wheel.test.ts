import { describe, expect, it } from 'vitest';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { WHEEL, WHEEL_SEGMENTS } from '../src/data/wheel';
import { queueCommand } from '../src/sim/game/commands';
import { createGame, type GameSetup } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import { CustomerState } from '../src/sim/game/types';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { addWheelToken, collectWheel, FREE_MS, freeIn, freeReady, landing, prizeCoins, spinCost, spinWheel } from '../src/sim/wheel';

const NOW = 1_800_000_000_000;

/** The wheel opens with the bistro (src/data/unlocks.ts). */
const game = (seed: number, setup: GameSetup = {}) => createGame(mapForTier(1), seed, { ...setup, levels: { building: 1, ...setup.levels } });

describe('lucky wheel', () => {
  it('is locked in the first diner, open from the bistro and in every later branch', () => {
    const diner = createGame(STAND_MAP, 1);
    expect(spinCost(diner, 0)).toBe('none');
    expect(spinWheel(diner, 0, false)).toBe(-1);
    expect(spinCost(game(1), 0)).toBe('free');
    diner.city = 1;
    expect(spinCost(diner, 0)).toBe('free');
  });

  it('has a free spin at once, then one every few hours of real time', () => {
    const s = game(1);
    expect(spinCost(s, NOW)).toBe('free');
    expect(spinWheel(s, NOW, false)).toBe(WHEEL.firstSegment);
    collectWheel(s);
    expect(freeIn(s.wheel, NOW + 1000)).toBe(FREE_MS - 1000);
    expect(spinCost(s, NOW + 1000)).toBe('gems');
    expect(freeReady(s.wheel, NOW + FREE_MS)).toBe(true);
    // A phone clock set back by a day does not lock the free spin away for longer than one wait.
    expect(freeReady(s.wheel, NOW - 24 * 3600 * 1000)).toBe(true);
  });

  it('waits for the prize to be taken before the next spin, and pays it once', () => {
    const s = game(1, { gems: 0 });
    spinWheel(s, NOW, false);
    expect(s.gems).toBe(0);
    expect(spinCost(s, NOW + FREE_MS)).toBe('none');
    expect(spinWheel(s, NOW + FREE_MS, false)).toBe(-1);
    expect(collectWheel(s)).toBe(true);
    expect(s.gems).toBe(15);
    expect(collectWheel(s)).toBe(false);
    expect(s.gems).toBe(15);
  });

  it('uses stored spins from cleared stages, then gems', () => {
    const s = game(1, { gems: WHEEL.gemCost + 3 });
    spinWheel(s, NOW, false);
    collectWheel(s);
    for (let i = 0; i < WHEEL.maxTokens + 2; i++) addWheelToken(s);
    expect(s.wheel.tokens).toBe(WHEEL.maxTokens);
    const gems = s.gems;
    expect(spinCost(s, NOW + 1)).toBe('token');
    spinWheel(s, NOW + 1, false);
    expect(s.wheel.tokens).toBe(WHEEL.maxTokens - 1);
    expect(s.gems).toBe(gems);
    collectWheel(s);
    const before = s.gems;
    expect(spinWheel(s, NOW + 2, true)).toBeGreaterThanOrEqual(0);
    expect(s.gems).toBe(before - WHEEL.gemCost);
  });

  it('cannot be bought without enough gems', () => {
    const s = game(1);
    spinWheel(s, NOW, false);
    collectWheel(s);
    s.gems = WHEEL.gemCost - 1;
    expect(spinCost(s, NOW + 1)).toBe('none');
    expect(spinWheel(s, NOW + 1, true)).toBe(-1);
    expect(s.gems).toBe(WHEEL.gemCost - 1);
  });

  it('lands on every segment about as often as its weight says', () => {
    const s = game(3);
    s.wheel.spins = 1;
    const hits = WHEEL_SEGMENTS.map(() => 0);
    const n = 20000;
    for (let i = 0; i < n; i++) {
      s.tick = i * 37;
      s.wheel.spins = 1 + i;
      hits[landing(s)]! += 1;
    }
    const total = WHEEL_SEGMENTS.reduce((sum, seg) => sum + seg.weight, 0);
    WHEEL_SEGMENTS.forEach((seg, i) => expect(Math.abs(hits[i]! / n - seg.weight / total)).toBeLessThan(0.02));
  });

  it('pays coins as minutes of income, gems, a boost, or the jackpot', () => {
    for (const [i, seg] of WHEEL_SEGMENTS.entries()) {
      const s = game(1, { gems: 0 });
      s.wheel = { nextFree: 0, tokens: 0, spins: 5, prize: i };
      const coins = s.coins;
      const value = prizeCoins(s, seg.prize);
      collectWheel(s);
      const p = seg.prize;
      if (p.kind === 'coins' || p.kind === 'jackpot') {
        expect(value.toNumber()).toBeGreaterThanOrEqual(p.minutes * WHEEL.minPerMinute);
        expect(s.coins.sub(coins).toNumber()).toBe(value.toNumber());
      } else {
        expect(s.coins.toNumber()).toBe(coins.toNumber());
      }
      if (p.kind === 'gems' || p.kind === 'jackpot') expect(s.gems).toBe(p.gems);
      if (p.kind === 'boost') expect(s.boost).toEqual({ mult: p.mult, until: s.time + p.minutes * 60 });
      expect(s.events.at(-1)).toMatchObject({ type: Ev.Wheel, c: i });
    }
  });

  it('a prize does not count as income, so the next prize is not inflated by it', () => {
    const s = game(1);
    for (let i = Math.round(60 / STEP_SEC); i > 0; i--) {
      for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
      stepGame(s, STEP_SEC);
    }
    const jackpot = WHEEL_SEGMENTS.findIndex((seg) => seg.prize.kind === 'jackpot');
    const before = prizeCoins(s, WHEEL_SEGMENTS[jackpot]!.prize);
    s.wheel = { nextFree: 0, tokens: 0, spins: 5, prize: jackpot };
    collectWheel(s);
    stepGame(s, STEP_SEC);
    // Two hours of income just landed: the measured rate (and so the next prize) barely moves.
    expect(prizeCoins(s, WHEEL_SEGMENTS[jackpot]!.prize).toNumber()).toBeLessThan(before.toNumber() * 1.2);
  });

  it('goes through the command queue and is saved', () => {
    const s = game(1);
    queueCommand(s, { type: 'spin', now: NOW, paid: false });
    stepGame(s, STEP_SEC);
    expect(s.wheel.prize).toBe(WHEEL.firstSegment);
    expect(s.events.some((e) => e.type === Ev.WheelSpin && e.a === WHEEL.firstSegment)).toBe(true);
    addWheelToken(s);
    const loaded = parseSave(JSON.stringify(makeSave(s, 1000)));
    expect(loaded.ok && restoreGame(loaded.save, 1).wheel).toEqual({ nextFree: NOW + FREE_MS, tokens: 1, spins: 1, prize: WHEEL.firstSegment });
    queueCommand(s, { type: 'wheel' });
    stepGame(s, STEP_SEC);
    expect(s.wheel.prize).toBe(-1);
  });

  it('starts fresh from a save made before the wheel, and drops a broken one', () => {
    const s = game(1);
    const raw = makeSave(s, 1000) as unknown as Record<string, unknown>;
    delete raw.wheel;
    const old = parseSave(JSON.stringify(raw));
    expect(old.ok && old.save.wheel).toEqual({ nextFree: 0, tokens: 0, spins: 0, prize: -1 });
    raw.wheel = { nextFree: 5, tokens: 999, spins: -3, prize: 42 };
    const bad = parseSave(JSON.stringify(raw));
    expect(bad.ok && bad.save.wheel).toEqual({ nextFree: 5, tokens: WHEEL.maxStored, spins: 0, prize: -1 });
  });
});
