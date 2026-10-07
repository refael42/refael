import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { RUSH } from '../src/data/staff';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { workRate } from '../src/sim/game/people';
import { stepGame } from '../src/sim/game/step';
import type { GameState } from '../src/sim/game/types';

function run(s: GameState, seconds: number) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) stepGame(s, STEP_SEC);
}

describe('rush hour', () => {
  it('speeds the whole team up while held, at a cost in morale', () => {
    const s = createGame(STAND_MAP, 51, { roster: ['cook', 'waiter', 'washer'] });
    const cook = s.staff[0]!;
    const before = workRate(s, cook);
    const morale = s.staff.map((st) => st.morale);
    queueCommand(s, { type: 'rush', on: true });
    run(s, 2);
    expect(s.rush.on).toBe(true);
    expect(workRate(s, cook) / before).toBeGreaterThan(1 + RUSH.speed * 0.9);
    s.staff.forEach((st, i) => expect(st.morale).toBeLessThan(morale[i]!));
    expect(s.rush.charge).toBeCloseTo(1 - 2 / RUSH.seconds, 1);
  });

  it('runs out when the meter is empty, refills when released, and needs some charge to start', () => {
    const s = createGame(STAND_MAP, 52);
    queueCommand(s, { type: 'rush', on: true });
    run(s, RUSH.seconds + 1);
    expect(s.rush.on).toBe(false);
    expect(s.rush.charge).toBeLessThan(RUSH.minCharge);
    // Holding on an empty meter does nothing.
    queueCommand(s, { type: 'rush', on: true });
    run(s, 0.5);
    expect(s.rush.on).toBe(false);
    run(s, RUSH.rechargeSeconds);
    expect(s.rush.charge).toBe(1);
    queueCommand(s, { type: 'rush', on: true });
    run(s, 1);
    queueCommand(s, { type: 'rush', on: false });
    run(s, STEP_SEC);
    expect(s.rush.on).toBe(false);
  });
});
