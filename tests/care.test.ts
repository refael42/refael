import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { CARE } from '../src/data/staff';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, OrderState, type GameState } from '../src/sim/game/types';

function play(s: GameState, seconds: number, watch?: (s: GameState) => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    watch?.(s);
  }
}

describe('table care (owner: waiters stood around doing nothing)', () => {
  it('with a slow kitchen, free waiters go round with water: guests get a little patience back, at most twice each', () => {
    // One cook, three waiters: the kitchen is the bottleneck, so the waiters have time on their hands.
    const s = createGame(STAND_MAP, 11, { roster: ['cook', 'waiter', 'waiter', 'waiter', 'washer'] });
    let rounds = 0;
    let gained = false;
    const before = new Map<number, number>();
    play(s, 400, (g) => {
      for (const st of g.staff) if (st.job?.kind === 'care' && st.job.phase === 'pour' && st.jobTime === 0) rounds++;
      for (const c of g.customers) {
        expect(c.cared ?? 0).toBeLessThanOrEqual(CARE.visits);
        const was = before.get(c.id);
        if (c.state === CustomerState.Waiting && was !== undefined && c.patienceLeft > was + 0.01) gained = true;
        before.set(c.id, c.patienceLeft);
      }
    });
    expect(rounds).toBeGreaterThan(0);
    expect(gained).toBe(true);
  });

  it('a plate on the pass always comes before a glass of water: one free waiter waits by the pass', () => {
    const s = createGame(STAND_MAP, 12, { roster: ['cook', 'waiter', 'waiter', 'waiter', 'washer'] });
    let worst = 0;
    const readyAt = new Map<number, number>();
    play(s, 400, (g) => {
      // Never everyone off pouring water.
      const waiters = g.staff.filter((st) => st.role === 'waiter');
      expect(waiters.every((st) => st.job?.kind === 'care')).toBe(false);
      for (const o of g.orders) {
        if (o.state === OrderState.Ready && !readyAt.has(o.id)) readyAt.set(o.id, g.time);
        if (o.state === OrderState.Ready && o.waiter < 0) worst = Math.max(worst, g.time - readyAt.get(o.id)!);
      }
    });
    // Picked up within a moment, never left waiting while waiters pour water.
    expect(worst).toBeLessThan(2);
  });
});
