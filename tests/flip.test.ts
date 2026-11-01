import { describe, expect, it } from 'vitest';
import { FLIP } from '../src/data/flip';
import { STAND_MAP } from '../src/data/maps';
import { finishFlip, flipSpeed, startFlip, updateFlip } from '../src/sim/flip';
import { queueCommand, tapTargets } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import { OrderState, type GameState } from '../src/sim/game/types';
import { STEP_SEC } from '../src/data/sim';

// Owner, idea 7: "a rhythm mini-game at rush hour; tap in time, a bonus if you do".

const busy = (): GameState => {
  const s = createGame(STAND_MAP, 6);
  s.stats.served = FLIP.firstServed;
  s.time = FLIP.every[1] + 1;
  for (let i = 0; i < FLIP.minOrders; i++) s.orders.push({ id: 900 + i, customer: -1, dish: 0, state: OrderState.Queued, progress: 0, slot: -1, since: 0, landsAt: 0, waiter: -1, quality: 1, delivery: false });
  return s;
};

describe('the golden pan', () => {
  it('comes only at a rush, and goes if nobody taps it', () => {
    const quiet = createGame(STAND_MAP, 6);
    quiet.stats.served = FLIP.firstServed;
    quiet.time = 9999;
    updateFlip(quiet);
    expect(quiet.flip.stove).toBe(-1);
    const s = busy();
    updateFlip(s);
    expect(s.flip.stove).toBeGreaterThanOrEqual(0);
    expect(s.events.some((e) => e.type === Ev.FlipPan)).toBe(true);
    expect(tapTargets(s).some((t) => t.command.type === 'flip')).toBe(true);
    s.time += FLIP.staysSeconds + 1;
    updateFlip(s);
    expect(s.flip.stove).toBe(-1);
  });

  it('tapped: the game opens; perfect flips speed the cooks and pay coins, all three gems', () => {
    const s = busy();
    updateFlip(s);
    queueCommand(s, { type: 'flip' });
    stepGame(s, STEP_SEC);
    expect(s.flip.playing).toBe(true);
    // While the game is open, the pan stays and no new one comes.
    s.time += FLIP.staysSeconds + 5;
    updateFlip(s);
    expect(s.flip.playing).toBe(true);
    const gems = s.gems;
    const coins = s.coins;
    finishFlip(s, 3);
    expect(s.flip.playing).toBe(false);
    expect(flipSpeed(s)).toBeCloseTo(1 + FLIP.speedPerHit * 3, 6);
    expect(s.gems).toBe(gems + FLIP.perfectGems);
    expect(s.coins.gt(coins)).toBe(true);
    s.time += FLIP.speedSeconds + 1;
    expect(flipSpeed(s)).toBe(1);
  });

  it('a miss pays nothing; a result with no game open is ignored', () => {
    const s = busy();
    updateFlip(s);
    expect(startFlip(s)).toBe(true);
    const coins = s.coins;
    finishFlip(s, 0);
    expect(s.coins.eq(coins)).toBe(true);
    expect(flipSpeed(s)).toBe(1);
    finishFlip(s, 3);
    expect(s.coins.eq(coins)).toBe(true);
  });
});
