import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/data/buildings';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { UNLOCK_TIER } from '../src/data/unlocks';
import { big } from '../src/sim/big';
import { canBuy, computeMods, upgradeDef } from '../src/sim/economy/upgrades';
import { createGame } from '../src/sim/game/create';
import { deliveryPay } from '../src/sim/game/delivery';
import { stepGame } from '../src/sim/game/step';
import { OrderState, type GameState } from '../src/sim/game/types';
import { capacity } from '../src/sim/game/workers';
import { findPath } from '../src/sim/grid';
import { Held, PropKind } from '../src/sim/types';

// Owner request: "the delivery station can be upgraded, and the couriers; more couriers;
// deliveries have their own fridge and their own pass the packers take the food from and pack
// it (all animated)".

const palace = (seed: number, levels: Record<string, number> = {}) =>
  createGame(mapForTier(UNLOCK_TIER.packer), seed, {
    roster: ['cook', 'cook', 'waiter', 'washer', 'host', 'courier', 'packer'],
    levels: { building: UNLOCK_TIER.packer, tables: 8, seats: 4, fries: 25, burger: 10, stove2: 1, ...levels },
  });

describe('the delivery station', () => {
  it('has its own pass and drinks fridge beside the packing counter, all reachable', () => {
    for (let tier = UNLOCK_TIER.packer; tier < TIERS.length; tier++) {
      const s = createGame(mapForTier(tier), 1, { levels: { building: tier } });
      const p = s.map.packing!;
      expect(s.props.some((x) => x.kind === PropKind.DeliveryPass)).toBe(true);
      expect(s.props.some((x) => x.kind === PropKind.DrinksFridge)).toBe(true);
      expect(p.slots).toHaveLength(p.pickups.length);
      const from = s.map.pickupSpots[0]!;
      for (const spot of [...p.pickups, p.fridgeSpot, ...p.spots]) expect(findPath(s.grid, from, spot), `tier ${tier}`).not.toBeNull();
    }
  });

  it('packers take the food off the deliveries pass, a drink from their fridge, and pack both', () => {
    const s = palace(3);
    let lane = false;
    let drink = false;
    let fridgeOpen = false;
    for (let i = Math.round(400 / STEP_SEC); i > 0; i--) {
      stepGame(s, STEP_SEC);
      if (s.orders.some((o) => o.lane && o.state === OrderState.Ready)) lane = true;
      if (s.staff.some((st) => st.held === Held.FoodDrink)) drink = true;
      if (s.props.some((p) => p.kind === PropKind.DrinksFridge && p.active)) fridgeOpen = true;
    }
    expect(lane).toBe(true);
    expect(fridgeOpen).toBe(true);
    expect(drink).toBe(true);
    expect(s.stats.delivered).toBeGreaterThan(1);
    // The dining room's pass never holds a delivery while packers work.
    expect(s.orders.filter((o) => o.delivery && o.state === OrderState.Ready).every((o) => o.lane === 1)).toBe(true);
  });
});

describe('delivery upgrades', () => {
  it('more couriers: each level is room for one more, from the bistro, up to six', () => {
    const def = upgradeDef('fleet');
    expect(canBuy(def, {}, big('1e30'), STAND_MAP)).toBe(false);
    const bistro = mapForTier(1);
    expect(canBuy(def, { building: 1 }, big('1e30'), bistro)).toBe(true);
    expect(canBuy(def, { building: 1, fleet: 6 }, big('1e30'), bistro)).toBe(false);
    const before = createGame(bistro, 1, { levels: { building: 1 } });
    const after = createGame(bistro, 1, { levels: { building: 1, fleet: 3 } });
    expect(capacity(after, 'courier')).toBe(capacity(before, 'courier') + 3);
  });

  it('faster scooters shorten the ride; the delivery app raises the price; the packing station packs faster', () => {
    expect(computeMods({ building: 1, scooters: 10 }).tripSpeed).toBeGreaterThan(1.4);
    expect(computeMods({ building: 1, deliveryApp: 10 }).deliveryPrice).toBeGreaterThan(1.9);
    expect(computeMods({ building: 3, packStation: 10 }).packSpeed).toBeGreaterThan(1.5);
    const rides = (levels: Record<string, number>) => {
      const s = palace(5, levels);
      const out: number[] = [];
      for (let i = Math.round(300 / STEP_SEC); i > 0 && out.length === 0; i--) {
        stepGame(s, STEP_SEC);
        for (const st of s.staff) if (st.job?.kind === 'deliver' && st.job.phase === 'away') out.push(st.job.back - st.job.left);
      }
      return out[0]!;
    };
    expect(rides({ scooters: 25 })).toBeLessThan(rides({}) * 0.6);
    const s = palace(6);
    const courier = s.staff.find((st) => st.role === 'courier')!;
    const order = { id: 1, customer: -1, dish: 0, state: OrderState.Carried, progress: 1, slot: -1, since: 0, landsAt: 0, waiter: -1, quality: 1, delivery: true } as GameState['orders'][number];
    const plain = deliveryPay(s, courier, order);
    s.mods = computeMods({ ...s.levels, deliveryApp: 10 });
    expect(deliveryPay(s, courier, order).gt(plain)).toBe(true);
  });
});
