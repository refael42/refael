import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/data/buildings';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { UNLOCK_TIER, UNLOCKS, unlocksAt } from '../src/data/unlocks';
import { he } from '../src/i18n/he';
import { en } from '../src/i18n/en';
import { big } from '../src/sim/big';
import { canBuy, upgradeDef } from '../src/sim/economy/upgrades';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { OrderState, type GameState } from '../src/sim/game/types';
import { capacity } from '../src/sim/game/workers';
import { findPath } from '../src/sim/grid';
import { Held, PropKind } from '../src/sim/types';
import { Ev } from '../src/sim/game/events';

// Owner request: "as the restaurant grows, things open up", "a checker for the dishes", and "a
// place that packs the takeaway, connected to the deliveries, handing the bags to the courier
// through a window".

const game = (tier: number, seed: number, roster: Parameters<typeof createGame>[2] extends infer S ? S extends { roster?: infer R } ? R : never : never, extra: Record<string, number> = {}) =>
  createGame(mapForTier(tier), seed, { roster, levels: { building: tier, tables: 8, seats: 4, fries: 25, burger: 10, stove2: 1, ...extra } });

function run(s: GameState, seconds: number, each?: () => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    stepGame(s, STEP_SEC);
    each?.();
  }
}

describe('what each building opens', () => {
  it('every unlock comes with a real building and has a name in both languages', () => {
    for (const u of UNLOCKS) {
      expect(u.tier).toBeGreaterThan(0);
      expect(u.tier).toBeLessThan(TIERS.length);
      expect((en as Record<string, string>)[u.name], u.name).toBeTruthy();
      expect((he as Record<string, string>)[u.name], u.name).toBeTruthy();
    }
    expect(unlocksAt(1).map((u) => u.id)).toEqual(expect.arrayContaining(['wheel', 'courier']));
  });

  it('jobs open with their building', () => {
    for (const [role, id] of [['courier', 'courier'], ['checker', 'checker'], ['packer', 'packer']] as const) {
      const before = createGame(mapForTier(UNLOCK_TIER[id] - 1), 1, { levels: { building: UNLOCK_TIER[id] - 1 } });
      const after = createGame(mapForTier(UNLOCK_TIER[id]), 1, { levels: { building: UNLOCK_TIER[id] } });
      expect(capacity(before, role), role).toBe(0);
      expect(capacity(after, role), role).toBeGreaterThan(0);
    }
  });

  it('the new dishes open with their building', () => {
    for (const id of ['pizza', 'sushi', 'steak', 'cake', 'lobster'] as const) {
      const def = upgradeDef(id);
      expect(canBuy(def, { building: UNLOCK_TIER[id] - 1 }, big('1e40'), mapForTier(UNLOCK_TIER[id] - 1)), id).toBe(false);
      expect(canBuy(def, { building: UNLOCK_TIER[id] }, big('1e40'), mapForTier(UNLOCK_TIER[id])), id).toBe(true);
    }
  });
});

describe('the checker', () => {
  it('looks over the dishes on the pass, and a checked dish is worth more', () => {
    const s = game(2, 7, ['cook', 'cook', 'waiter', 'waiter', 'washer', 'host', 'checker']);
    const before = new Map<number, number>();
    let raised = 0;
    run(s, 240, () => {
      for (const o of s.orders) {
        if (o.state === OrderState.Ready && !o.checked) before.set(o.id, o.quality);
        if (o.checked && before.has(o.id)) {
          expect(o.quality).toBeGreaterThan(before.get(o.id)!);
          before.delete(o.id);
          raised++;
        }
      }
    });
    expect(raised).toBeGreaterThan(5);
    // Standing at the head of the pass (in the kitchen, by the back wall).
    const checker = s.staff.find((st) => st.role === 'checker')!;
    expect(Math.hypot(checker.x - s.map.checkerSpot.x, checker.y - s.map.checkerSpot.y)).toBeLessThan(0.05);
  });
});

describe('the packing corner', () => {
  it('opens with its building: a counter by the front wall, a window reachable from the sidewalk', () => {
    expect(mapForTier(UNLOCK_TIER.packer - 1).packing).toBeNull();
    expect(STAND_MAP.packing).toBeNull();
    for (let tier = UNLOCK_TIER.packer; tier < TIERS.length; tier++) {
      const s = createGame(mapForTier(tier), 1, { levels: { building: tier } });
      const p = s.map.packing!;
      expect(s.props.some((x) => x.kind === PropKind.PackTable)).toBe(true);
      // Inside the kitchen's front row, the window just outside the front wall.
      expect(p.table.x).toBeLessThan(s.map.kitchenX);
      expect(Math.floor(p.table.y)).toBe(s.map.building.y1 - 1);
      expect(Math.floor(p.window.y)).toBe(s.map.building.y1);
      expect(findPath(s.grid, s.map.courierSpots[0]!, p.window), `tier ${tier}`).not.toBeNull();
      for (const spot of p.spots) expect(findPath(s.grid, s.map.pickupSpots[0]!, spot), `tier ${tier}`).not.toBeNull();
    }
  });

  it('packers pack the deliveries; couriers take them at the window, never through the kitchen', () => {
    const tier = UNLOCK_TIER.packer;
    const s = game(tier, 11, ['cook', 'cook', 'waiter', 'washer', 'host', 'courier', 'packer']);
    const b = s.map.building;
    let shelved = 0;
    let inside = 0;
    let carriedBox = false;
    let packing = 0;
    const handoffs = new Set<number>();
    const table = () => s.props.find((p) => p.kind === PropKind.PackTable)!;
    run(s, 400, () => {
      shelved = Math.max(shelved, s.orders.filter((o) => o.packed).length);
      for (const c of s.staff) if (c.role === 'courier' && !c.away && c.x > b.x0 && c.x < b.x1 && c.y > b.y0 && c.y < b.y1) inside++;
      // The open food box goes from the pass to the counter in the packer's hands...
      if (s.staff.some((st) => st.role === 'packer' && st.held === Held.FoodBox)) carriedBox = true;
      // ...the counter shows it being packed...
      packing = Math.max(packing, table().progress);
      // ...and the bag is handed out through the window to the courier standing there.
      for (const e of s.events) if (e.type === Ev.BagHandoff) handoffs.add(e.id);
    });
    expect(carriedBox).toBe(true);
    expect(packing).toBeGreaterThan(0.5);
    expect(handoffs.size).toBeGreaterThan(0);
    expect(shelved).toBeGreaterThan(0);
    expect(s.stats.delivered).toBeGreaterThan(3);
    expect(inside).toBe(0);
  });

  it('without a packer the couriers still fetch the bags from the pass', () => {
    const s = game(UNLOCK_TIER.packer, 11, ['cook', 'cook', 'waiter', 'washer', 'host', 'courier']);
    run(s, 300);
    expect(s.stats.delivered).toBeGreaterThan(1);
    expect(s.orders.some((o) => o.packed)).toBe(false);
  });
});
