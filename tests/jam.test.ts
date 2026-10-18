import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { JAM } from '../src/data/staff';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { kitchenAdvice, updateJam } from '../src/sim/game/jam';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, OrderState, type GameState } from '../src/sim/game/types';

function play(s: GameState, seconds: number) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
  }
}

describe('the kitchen hint (owner M40: waiters stood around while tickets waited)', () => {
  it('tickets waiting while waiters stand free, for a while: the game says what helps', () => {
    const s = createGame(STAND_MAP, 31, { roster: ['cook', 'waiter', 'waiter', 'waiter', 'washer'] });
    // Tickets on the rail nobody cooks yet (delivery tickets: no guest needed to make the point).
    for (let i = 0; i < JAM.queued; i++) s.orders.push({ id: s.nextId++, customer: -1, dish: 0, state: OrderState.Queued, progress: 0, slot: -1, since: s.time, landsAt: 0, waiter: -1, quality: 1, delivery: true });
    updateJam(s, JAM.showAfter / 2);
    expect(kitchenAdvice(s)).toBeNull();
    updateJam(s, JAM.showAfter / 2);
    // The stand's one cook's post is taken: another stove (or, all bought, faster ones).
    expect(['stove', 'speed']).toContain(kitchenAdvice(s));
    // The kitchen catches up: the hint goes, twice as fast as it came.
    s.orders = [];
    updateJam(s, JAM.showAfter / 4);
    expect(kitchenAdvice(s)).toBeNull();
  });

  it('busy waiters are no jam (they have plates to carry)', () => {
    const s = createGame(STAND_MAP, 35, { roster: ['cook', 'waiter', 'washer'] });
    for (let i = 0; i < JAM.queued; i++) s.orders.push({ id: s.nextId++, customer: -1, dish: 0, state: OrderState.Queued, progress: 0, slot: -1, since: s.time, landsAt: 0, waiter: -1, quality: 1, delivery: true });
    updateJam(s, JAM.max);
    expect(s.jam).toBe(0);
  });

  it('a kitchen that keeps up says nothing', () => {
    const s = createGame(STAND_MAP, 32, { roster: ['cook', 'waiter', 'washer'] });
    play(s, 300);
    expect(kitchenAdvice(s)).toBeNull();
  });

  it('a free cook post: hire', () => {
    const s = createGame(STAND_MAP, 33, { roster: ['waiter', 'waiter', 'waiter', 'washer'] });
    s.jam = JAM.max;
    expect(kitchenAdvice(s)).toBe('hire');
  });

  it('closed: the last tickets of the service are no jam', () => {
    const s = createGame(STAND_MAP, 34, { roster: ['cook', 'waiter', 'washer'] });
    s.jam = JAM.max;
    queueCommand(s, { type: 'close', closed: true });
    play(s, 60);
    expect(s.jam).toBe(0);
  });
});
