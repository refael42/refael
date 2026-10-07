import { TUTORIAL, TUTORIAL_STEPS, type TutorialStep } from '../data/tutorial';
import { tapTargets } from './game/commands';
import { CustomerState, type GameState } from './game/types';

// Tutorial progress, read from the game: a step is done when the player has done the thing.
// Pure and headless like the rest of the sim; the UI only draws the hand and the message.

/** The counters the steps look at. */
export interface TutorialView {
  /** Customers seated so far, or past the line right now (served ones included). */
  seated: number;
  /** Dishes delivered so far (eating, paying, or paid). */
  delivered: number;
  served: number;
  /** Sim time of the latest payment. */
  lastPay: number;
  upgrades: number;
  hires: number;
  time: number;
}

const PAST_LINE: readonly CustomerState[] = [CustomerState.ToTable, CustomerState.Reading, CustomerState.Waiting, CustomerState.Eating, CustomerState.Paying];
const FED: readonly CustomerState[] = [CustomerState.Eating, CustomerState.Paying];

export function readTutorial(s: GameState): TutorialView {
  let inside = 0;
  let fed = 0;
  for (const c of s.customers) {
    if (PAST_LINE.includes(c.state)) inside++;
    if (FED.includes(c.state)) fed++;
  }
  return {
    seated: s.stats.served + inside,
    delivered: s.stats.served + fed,
    served: s.stats.served,
    lastPay: s.lastPayTime,
    upgrades: Object.values(s.levels).reduce((sum, n) => sum + n, 0),
    hires: s.stats.hires,
    time: s.time,
  };
}

/**
 * Has `step` been done? `start` is the view when the step began: "buy an upgrade" means one
 * more than when the step showed up, not "has ever bought one".
 */
export function stepDone(step: TutorialStep, now: TutorialView, start: TutorialView): boolean {
  switch (step) {
    case 'seat':
      return now.seated > 0;
    case 'serve':
      return now.delivered > 0;
    case 'coins':
      // Stays up a moment after the coins land, so the message can be read.
      return now.served > 0 && now.time - Math.max(start.time, now.lastPay) >= TUTORIAL.coinsSeconds;
    case 'upgrade':
      return now.upgrades > start.upgrades;
    case 'hire':
      return now.hires > start.hires;
    case 'done':
      return now.time - start.time >= TUTORIAL.doneSeconds;
  }
}

/** Index of the next step, skipping any that are already done (e.g. served while reading). */
export function nextStep(index: number, now: TutorialView, start: TutorialView): number {
  let i = index;
  while (i < TUTORIAL_STEPS.length && stepDone(TUTORIAL_STEPS[i]!, now, start)) i++;
  return i;
}

/** Where the hand points: a spot in the world, a button, the coin counter, or nowhere yet. */
export type TutorialTarget = { world: { x: number; y: number; height: number } } | { ui: 'coins' | 'upgrades' | 'staff' } | null;

export function tutorialTarget(step: TutorialStep, s: GameState): TutorialTarget {
  const tap = (type: 'seat' | 'serve') => tapTargets(s).find((t) => t.command.type === type);
  switch (step) {
    case 'seat':
    case 'serve': {
      const t = tap(step);
      return t ? { world: { x: t.x, y: t.y, height: t.height } } : null;
    }
    case 'coins':
      return { ui: 'coins' };
    case 'upgrade':
      return { ui: 'upgrades' };
    case 'hire':
      return { ui: 'staff' };
    case 'done':
      return null;
  }
}
