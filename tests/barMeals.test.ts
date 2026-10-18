import { describe, expect, it } from 'vitest';
import { BAR } from '../src/data/bar';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { openStools } from '../src/sim/game/bar';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { PropKind } from '../src/sim/types';

// Owner: "guests can sit at the bar too": stools from the first diner (bought one by one until
// the grand restaurant), guests alone or in pairs, most for a meal a waiter brings to the counter.

function play(s: GameState, seconds: number, each?: (s: GameState) => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    each?.(s);
  }
}

describe('meals at the bar', () => {
  it('the diner has stools to buy one by one; the grand restaurant comes with all of them', () => {
    const s = createGame(STAND_MAP, 70);
    expect(s.map.bar.stools.length).toBeGreaterThanOrEqual(3);
    expect(openStools(s)).toBe(0);
    // Not bought yet: faint.
    expect(s.props.filter((p) => p.kind === PropKind.BarStool).every((p) => p.active)).toBe(true);
    s.coins = big('1e9');
    expect(buyUpgrade(s, 'barStools')).toBe(true);
    expect(openStools(s)).toBe(1);
    expect(s.props.filter((p) => p.kind === PropKind.BarStool && !p.active)).toHaveLength(1);
    const grand = createGame(mapForTier(BAR.stoolsFreeTier), 71, { levels: { building: BAR.stoolsFreeTier } });
    expect(openStools(grand)).toBe(grand.map.bar.stools.length);
  });

  it('a guest eats a meal at the bar: menu, order, a waiter brings the plate to the counter, they pay', () => {
    const s = createGame(STAND_MAP, 72, { roster: ['cook', 'waiter', 'washer'], levels: { barStools: 3 } });
    let ate = false;
    let paid = false;
    let read = false;
    const earned = s.stats.served;
    play(s, 400, (g) => {
      for (const c of g.customers) {
        if (c.stool < 0 || !c.barMeal) continue;
        if (c.state === CustomerState.Reading) read = true;
        if (c.state === CustomerState.Eating && (c.barDish ?? -1) >= 0) ate = true;
        if (c.state === CustomerState.Paying) paid = true;
      }
    });
    expect(read).toBe(true);
    expect(ate).toBe(true);
    expect(paid).toBe(true);
    expect(s.stats.served).toBeGreaterThan(earned);
  });

  it('a pair sits side by side and leaves together', () => {
    let pairSeen = false;
    for (let seed = 73; seed < 90 && !pairSeen; seed++) {
      const s = createGame(STAND_MAP, seed, { roster: ['cook', 'cook', 'waiter', 'washer'], levels: { barStools: 3, seats: 3 } });
      play(s, 300, (g) => {
        for (const c of g.customers) {
          if (c.stool < 0 || c.partySize !== 2 || c.party !== c.id) continue;
          const friend = g.customers.find((m) => m.party === c.party && m.id !== c.id);
          if (!friend || friend.stool < 0) continue;
          pairSeen = true;
          const a = g.map.bar.stools[c.stool]!.at;
          const b = g.map.bar.stools[friend.stool]!.at;
          expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThanOrEqual(1.01);
          // Nobody leaves the bar while the other is still eating.
          if (c.state === CustomerState.Leaving) expect(friend.state === CustomerState.Eating || friend.state === CustomerState.Waiting).toBe(false);
        }
      });
    }
    expect(pairSeen).toBe(true);
  });
});
