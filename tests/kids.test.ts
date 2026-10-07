import { describe, expect, it } from 'vitest';
import { KID_RANK } from '../src/data/customers';
import { mapForTier } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import type { Customer } from '../src/sim/game/types';

describe('families (polish)', () => {
  it('some friends are children; nobody comes in alone as a child, and no student brings one', () => {
    const s = createGame(mapForTier(1), 9, { levels: { building: 1, tables: 12, seats: 12 }, rating: 4.5, roster: ['cook', 'waiter', 'host'] });
    const seen = new Map<number, Customer>();
    for (let i = 0; i < 600 / STEP_SEC; i++) {
      stepGame(s, STEP_SEC);
      for (const c of s.customers) seen.set(c.id, c);
    }
    const all = [...seen.values()];
    const kids = all.filter((c) => c.rank === KID_RANK);
    const friends = all.filter((c) => c.party !== c.id);
    expect(kids.length).toBeGreaterThan(0);
    expect(kids.length).toBeLessThan(friends.length);
    for (const k of kids) {
      expect(k.party).not.toBe(k.id);
      expect(k.type).not.toBe('student');
    }
  });
});
