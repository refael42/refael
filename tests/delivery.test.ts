import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/data/buildings';
import { DELIVERY } from '../src/data/delivery';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { ROLES } from '../src/data/staff';
import { createGame } from '../src/sim/game/create';
import { bagSize } from '../src/sim/game/delivery';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import { OrderState, type GameState } from '../src/sim/game/types';
import { capacity } from '../src/sim/game/workers';
import { gameSnapshot } from '../src/sim/game/step';
import { buildGrid, findPath } from '../src/sim/grid';
import { PropKind } from '../src/sim/types';
import { F, P, STRIDE } from '../src/sim/snapshot';

const courier = (s: GameState) => s.staff.find((st) => st.role === 'courier')!;

function run(s: GameState, seconds: number, each?: () => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    stepGame(s, STEP_SEC);
    each?.();
  }
}

describe('deliveries (owner request)', () => {
  it('no courier, no delivery orders', () => {
    const s = createGame(STAND_MAP, 1, { roster: ['cook', 'waiter'] });
    run(s, 180);
    expect(s.orders.some((o) => o.delivery)).toBe(false);
    expect(s.stats.delivered).toBe(0);
  });

  it('with a courier: orders come in, the cook bags them, the courier rides out and comes back paid', () => {
    const s = createGame(STAND_MAP, 2, { roster: ['cook', 'courier'] });
    const plates = s.cleanPlates;
    let away = false;
    let rideOff = 0;
    const seen = s.nextEventId;
    run(s, 150, () => {
      if (courier(s).away) away = true;
    });
    for (const e of s.events) if (e.id >= seen && e.type === Ev.ScooterOff) rideOff++;
    expect(away).toBe(true);
    expect(s.stats.delivered).toBeGreaterThanOrEqual(2);
    expect(s.coins.gt(0)).toBe(true);
    // Takeaway bags: no plate left the stack for deliveries (nobody ate in).
    expect(s.stats.served).toBe(0);
    expect(s.cleanPlates).toBe(plates);
  });

  it('a courier out on a ride is off the map, and their scooter rides instead', () => {
    const s = createGame(STAND_MAP, 2, { roster: ['cook', 'courier'] });
    let checked = false;
    run(s, 150, () => {
      const c = courier(s);
      if (checked || !c.away) return;
      checked = true;
      const snap = gameSnapshot(s, 1);
      const ids: number[] = [];
      let scooterActive = false;
      for (let i = 0; i < snap.count; i++) {
        const o = i * STRIDE;
        ids.push(snap.data[o + F.id]!);
        if (snap.data[o + F.type] === 2 && snap.data[o + P.kind] === PropKind.Scooter && snap.data[o + P.active] === 1) scooterActive = true;
      }
      expect(ids).not.toContain(c.id);
      expect(scooterActive).toBe(true);
    });
    expect(checked).toBe(true);
  });

  it('waiters never take a delivery bag, and the player cannot toss one to a table', () => {
    const s = createGame(STAND_MAP, 3, { roster: ['cook', 'waiter', 'host', 'courier'], levels: { tables: 4 } });
    run(s, 200, () => {
      for (const o of s.orders) {
        if (!o.delivery || o.waiter < 0) continue;
        expect(s.staff.find((st) => st.id === o.waiter)!.role).toBe('courier');
      }
    });
    expect(s.stats.delivered).toBeGreaterThan(0);
    expect(s.stats.served).toBeGreaterThan(0);
  });

  it('pays more than eating in: the delivery fee', () => {
    expect(DELIVERY.priceMult).toBeGreaterThan(1);
  });

  it('a seasoned courier carries two bags', () => {
    const s = createGame(STAND_MAP, 2, { roster: ['courier'] });
    const c = courier(s);
    expect(bagSize(c)).toBe(1);
    c.level = DELIVERY.bigBagLevel;
    expect(bagSize(c)).toBe(2);
  });

  it('an order nobody takes out is cancelled after a while (the courier left)', () => {
    const s = createGame(STAND_MAP, 4, { roster: ['cook', 'courier'] });
    run(s, 40);
    expect(s.orders.some((o) => o.delivery)).toBe(true);
    s.staff = s.staff.filter((st) => st.role !== 'courier');
    const rating = s.rating;
    const seen = s.nextEventId;
    run(s, DELIVERY.cancelSeconds + 20);
    expect(s.orders.filter((o) => o.delivery && o.state !== OrderState.Carried)).toEqual([]);
    expect(s.events.some((e) => e.id >= seen && e.type === Ev.DeliveryCancel) || s.rating < rating).toBe(true);
  });

  it('one courier at the diner, more in every bigger building, each with a scooter spot on the sidewalk', () => {
    expect(capacity(createGame(STAND_MAP, 1), 'courier')).toBe(ROLES.courier.cap);
    let before = 0;
    TIERS.forEach((_, t) => {
      const map = mapForTier(t);
      const cap = capacity(createGame(map, 1, { levels: { building: t } }), 'courier');
      expect(cap).toBeGreaterThanOrEqual(before);
      expect(map.scooterSpots.length).toBeGreaterThanOrEqual(cap);
      before = cap;
      const sidewalk = map.areas.find((a) => a.floor === 'sidewalk')!;
      const grid = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length);
      for (let i = 0; i < cap; i++) {
        const p = map.courierSpots[i]!;
        const q = map.scooterSpots[i]!;
        for (const v of [p, q]) expect(v.y >= sidewalk.y0 && v.y < sidewalk.y1 && v.x > 0, `tier ${t}`).toBe(true);
        expect(findPath(grid, p, map.pickupSpots[0]!), `tier ${t}`).not.toBeNull();
      }
    });
  });
});
