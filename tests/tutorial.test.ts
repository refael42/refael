import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { TUTORIAL, TUTORIAL_STEPS } from '../src/data/tutorial';
import { UPGRADES } from '../src/data/upgrades';
import { canBuy } from '../src/sim/economy/upgrades';
import { queueCommand, tapTargets } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import type { GameState } from '../src/sim/game/types';
import { nextStep, readTutorial, stepDone, tutorialTarget } from '../src/sim/tutorial';

/** A new player following the hand: taps what it points at, buys and hires when told to. */
function follow(s: GameState, seconds: number) {
  let index = 0;
  let start = readTutorial(s);
  const reached: string[] = [];
  for (let i = Math.round(seconds / STEP_SEC); i > 0 && index < TUTORIAL_STEPS.length; i--) {
    const step = TUTORIAL_STEPS[index]!;
    const target = tutorialTarget(step, s);
    if (target && 'world' in target) {
      const tap = tapTargets(s).find((t) => t.x === target.world.x && t.y === target.world.y && t.command.type === step);
      if (tap) queueCommand(s, tap.command);
    } else if (step === 'upgrade') {
      const def = UPGRADES.find((u) => !u.build && canBuy(u, s.levels, s.coins, s.map));
      if (def) buyUpgrade(s, def.id);
    } else if (step === 'hire') {
      const a = s.applicants.find((x) => x.state === 'waiting');
      if (a) queueCommand(s, { type: 'hire', applicant: a.id, trial: false });
    }
    stepGame(s, STEP_SEC);
    const now = readTutorial(s);
    const next = nextStep(index, now, start);
    if (next !== index) {
      for (let k = index; k < next; k++) reached.push(TUTORIAL_STEPS[k]!);
      index = next;
      start = now;
    }
  }
  return { index, reached, time: s.time };
}

describe('first-run tutorial', () => {
  it('a new player who follows the hand finishes every step, in order, in a few minutes', () => {
    const s = createGame(STAND_MAP, 11);
    const run = follow(s, 600);
    expect(run.reached).toEqual([...TUTORIAL_STEPS]);
    expect(run.index).toBe(TUTORIAL_STEPS.length);
    expect(run.time).toBeLessThan(300);
  });

  it('points at a waiting customer, or nowhere while the line is empty', () => {
    const s = createGame(STAND_MAP, 12);
    expect(tutorialTarget('seat', s)).toBeNull();
    for (let i = 0; i < 400 && !tutorialTarget('seat', s); i++) stepGame(s, STEP_SEC);
    expect(tutorialTarget('seat', s)).toHaveProperty('world');
    expect(tutorialTarget('upgrade', s)).toEqual({ ui: 'upgrades' });
  });

  it('"buy an upgrade" needs a new purchase, not one from before the step', () => {
    const s = createGame(STAND_MAP, 13, { levels: { fries: 5 } });
    const start = readTutorial(s);
    expect(stepDone('upgrade', readTutorial(s), start)).toBe(false);
    s.coins = s.coins.add(1e6);
    buyUpgrade(s, 'fries');
    expect(stepDone('upgrade', readTutorial(s), start)).toBe(true);
  });

  it('the coins message stays up a moment after the payment', () => {
    const base = { seated: 1, delivered: 1, served: 0, lastPay: -Infinity, upgrades: 0, hires: 0, time: 10 };
    expect(stepDone('coins', { ...base, time: 30 }, base)).toBe(false);
    const paid = { ...base, served: 1, lastPay: 20 };
    expect(stepDone('coins', { ...paid, time: 21 }, base)).toBe(false);
    expect(stepDone('coins', { ...paid, time: 20 + TUTORIAL.coinsSeconds }, base)).toBe(true);
  });

  it('steps already done while reading are skipped right away', () => {
    const base = { seated: 0, delivered: 0, served: 0, lastPay: -Infinity, upgrades: 0, hires: 0, time: 0 };
    const now = { ...base, seated: 2, delivered: 1, time: 1 };
    expect(TUTORIAL_STEPS[nextStep(0, now, base)]).toBe('coins');
  });
});
