import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/data/buildings';
import { DISHES } from '../src/data/dishes';
import { DISH_STATION, Station, stationOf } from '../src/data/kitchen';
import { BACK_KINDS, mapForTier, PREP_KINDS, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { UNLOCK_TIER } from '../src/data/unlocks';
import { UPGRADES } from '../src/data/upgrades';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, OrderState, type GameState } from '../src/sim/game/types';
import { buildGrid, findPath } from '../src/sim/grid';
import { Facing, Held, Pose, PropKind } from '../src/sim/types';

/** Plays a while, seating whoever waits in line. */
function play(s: GameState, seconds: number, each?: (s: GameState) => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    each?.(s);
  }
}

/** The building a dish opens with (its recipe's requirement), 0 for the diner's. */
const dishTier = (dish: number): number => {
  const row = UPGRADES.find((u) => u.unlocksDish === dish);
  return row?.requires?.item === 'building' ? row.requires.level : 0;
};

describe('the kitchen (owner M29: "every dish on its own equipment, an open kitchen")', () => {
  it('every dish has its station: fries in the fryer, pad thai in the wok, sushi at the sushi counter, salad on the cold line...', () => {
    for (const d of DISHES) expect(DISH_STATION[d.id], d.nameKey).toBeDefined();
    expect(stationOf(0)).toBe(Station.Fryer);
    expect(DISH_STATION[14]).toBe(Station.Wok);
    expect(DISH_STATION[9]).toBe(Station.Sushi);
    expect(DISH_STATION[13]).toBe(Station.ColdLine);
    expect(DISH_STATION[8]).toBe(Station.Oven);
    expect(DISH_STATION[10]).toBe(Station.Plancha);
    expect(UNLOCK_TIER.padThai).toBe(1);
  });

  it('every building has a station for every dish it can serve, all reachable, every cook facing the room', () => {
    TIERS.forEach((_, t) => {
      const map = mapForTier(t);
      const kinds = new Set(map.stoves.map((s) => s.type));
      for (const d of DISHES) if (dishTier(d.id) <= t) expect(kinds.has(DISH_STATION[d.id]), `tier ${t} ${d.nameKey}`).toBe(true);
      expect(map.stoves.length, `tier ${t}`).toBeGreaterThanOrEqual(map.cookCap);
      const grid = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length);
      const door = map.doors[0]!.inside;
      for (const st of map.stoves) {
        expect(st.facing).toBe(Facing.FrontRight);
        // The cook behind the station, looking over it toward the dining room.
        expect(st.cook.x).toBeLessThan(st.stove.x);
        expect(findPath(grid, door, st.cook), `tier ${t} cook at ${st.cook.x},${st.cook.y}`).not.toBeNull();
      }
      for (const p of map.passDrops) expect(findPath(grid, door, p), `tier ${t} drop`).not.toBeNull();
      // The chef's line: one station behind every pass slot.
      for (const slot of map.passSlots) expect(map.stoves.some((s) => Math.abs(s.stove.y - slot.y) < 0.01 && Math.abs(s.stove.x - (slot.x - 1)) < 0.01), `tier ${t} slot ${slot.y}`).toBe(true);
      // The bigger kitchens are wider, with more stations.
      if (t > 0) expect(map.stoves.length).toBeGreaterThanOrEqual(mapForTier(t - 1).stoves.length);
    });
  });

  it('a cook takes the ticket to the right station, cooks it there, plates it, carries it to the pass and sets it down', () => {
    const s = createGame(STAND_MAP, 41, { roster: ['cook', 'cook', 'waiter', 'washer'], levels: { burger: 1, salad: 1, stove2: 1 } });
    const seen = new Set<number>();
    const carried = new Set<number>();
    let placed = false;
    let wrongStation = false;
    play(s, 360, (g) => {
      for (const st of g.staff) {
        if (st.role !== 'cook' || st.job?.kind !== 'cook') continue;
        const order = g.orders.find((o) => o.id === (st.job as { order: number }).order);
        const station = g.stoves[(st.job as { station: number }).station]!;
        if (order && station.type !== stationOf(order.dish)) wrongStation = true;
        if (st.job.phase === 'cooking') seen.add(st.pose);
        if (st.held >= Held.PlateBase) carried.add(st.held - Held.PlateBase);
        if (st.job.phase === 'placing') placed = true;
      }
    });
    expect(wrongStation).toBe(false);
    // The fryer's basket for the fries, a flip on the plancha for the burger, the cold line's toss for the salad.
    expect(seen.has(Pose.Fry)).toBe(true);
    expect(seen.has(Pose.Flip)).toBe(true);
    expect(seen.has(Pose.Mix)).toBe(true);
    expect(carried.size).toBeGreaterThanOrEqual(2);
    expect(placed).toBe(true);
    expect(s.stats.served).toBeGreaterThan(10);
  });

  it('stations show what cooks on them while it cooks, and the plate while it is dressed', () => {
    const s = createGame(STAND_MAP, 42, { roster: ['cook', 'waiter', 'washer'] });
    let cooking = false;
    let plating = false;
    play(s, 120, (g) => {
      for (const p of g.props) {
        if (p.kind !== PropKind.Stove) continue;
        if (p.active && (p.extra ?? 0) > 0) cooking = true;
        if (p.level === 1 && (p.extra ?? 0) > 0) plating = true;
      }
    });
    expect(cooking).toBe(true);
    expect(plating).toBe(true);
  });

  it('a guest who gives up leaves the station free and the plate count whole', () => {
    const s = createGame(STAND_MAP, 43, { roster: ['cook', 'waiter', 'washer'] });
    const total = s.cleanPlates;
    play(s, 600);
    const busy = s.stoves.filter((sv) => sv.user >= 0);
    for (const sv of busy) expect(s.staff.some((st) => st.id === sv.user && st.job?.kind === 'cook')).toBe(true);
    const onTables = s.tables.reduce((n, t) => n + (t.state === 3 || t.state === 4 ? t.plates : t.dishes.filter((d) => d >= 0).length), 0);
    const inOrders = s.orders.filter((o) => o.state >= OrderState.Plating && !o.delivery).length;
    const carried = s.staff.reduce((n, st) => n + (st.job?.kind === 'buss' && (st.job.phase === 'toSink' || st.job.phase === 'drop') ? (st.job.plates ?? 0) : 0), 0);
    expect(s.cleanPlates + s.dirtyPlates + onTables + inOrders + carried).toBe(total);
  });
  it('a big kitchen is more than rows of the same table: corners of stores, fridges, stock pots, butchery, pastry', () => {
    const map = mapForTier(TIERS.length - 1);
    const back = map.decor.filter((f) => f.kind === PropKind.Prep && (f.variant ?? 0) >= PREP_KINDS);
    for (const f of back) expect(f.variant!).toBeLessThan(PREP_KINDS + BACK_KINDS);
    expect(new Set(back.map((f) => f.variant)).size).toBe(BACK_KINDS);
  });
});
