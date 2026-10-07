import { describe, expect, it } from 'vitest';
import { BAR, DRINKS } from '../src/data/bar';
import { TIERS } from '../src/data/buildings';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { drinkPrice } from '../src/sim/game/bar';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, OrderState, type GameState } from '../src/sim/game/types';
import { buildGrid, findPath } from '../src/sim/grid';
import { Held, Pose, PropKind } from '../src/sim/types';
import { buyNow } from './helpers';

/** Plays a while, seating whoever waits in line (as the player would). */
function play(s: GameState, seconds: number, each?: (s: GameState) => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    each?.(s);
  }
}

describe('the bar (owner: "from the first moment, growing with the stages, three sides at the end, open toward the kitchen")', () => {
  it('every building has one: straight, then an L, then three sides, the side toward the kitchen open', () => {
    TIERS.forEach((_, t) => {
      const bar = mapForTier(t).bar;
      expect(bar.stage, `tier ${t}`).toBe(t >= 4 ? 3 : t >= BAR.seatsTier ? 2 : 1);
      // Nothing between the bartenders and the waiters' lane by the kitchen.
      const inside = Math.min(...bar.stations.map((p) => p.x));
      expect(bar.counters.every((c) => c.x >= inside)).toBe(true);
      expect(bar.counters.some((c) => (c.variant ?? 0) >= 10)).toBe(true);
      // Stools from the grand restaurant on.
      expect(bar.stools.length > 0, `tier ${t}`).toBe(t >= BAR.seatsTier);
      if (t > 0) expect(bar.stations.length).toBeGreaterThanOrEqual(mapForTier(t - 1).bar.stations.length);
      // Everyone gets there: the bartenders' places, the waiters' spot, every stool.
      const map = mapForTier(t);
      const grid = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length);
      const door = map.doors[0]!.inside;
      for (const p of [...bar.stations, bar.pickup, ...bar.stools.map((st) => st.at)]) expect(findPath(grid, door, p), `tier ${t} ${p.x},${p.y}`).not.toBeNull();
    });
  });

  it('no bartender, no drinks', () => {
    const s = createGame(STAND_MAP, 3, { roster: ['cook', 'waiter'] });
    play(s, 120);
    expect(s.stats.served).toBeGreaterThan(3);
    expect(s.drinks).toHaveLength(0);
  });

  it('a bartender shakes cocktails and pours drinks, puts them on the pass, a waiter takes them to the table', () => {
    const s = createGame(STAND_MAP, 4, { roster: ['cook', 'cook', 'waiter', 'washer', 'bartender'], levels: { tables: 2, seats: 4, stove2: 1 } });
    let shaken = false;
    let poured = false;
    let onPass = false;
    let carried = false;
    let onTable = false;
    play(s, 300, (g) => {
      for (const st of g.staff) {
        if (st.pose === Pose.Shake && st.held === Held.Shaker) shaken = true;
        if (st.pose === Pose.Pour) poured = true;
        if (st.role === 'waiter' && st.held === Held.DrinkTray) carried = true;
      }
      if (g.drinks.some((d) => d.state === OrderState.Ready)) onPass = true;
      if (g.tables.some((t) => t.drinks.some((d) => d >= 0))) onTable = true;
    });
    expect(shaken).toBe(true);
    expect(poured).toBe(true);
    expect(onPass).toBe(true);
    expect(carried).toBe(true);
    expect(onTable).toBe(true);
  });

  it('a drink on the pass can be tapped over to its table', () => {
    const s = createGame(STAND_MAP, 5, { roster: ['cook', 'bartender'], levels: { tables: 2 } });
    let tossed = false;
    play(s, 240, (g) => {
      const d = g.drinks.find((x) => x.state === OrderState.Ready && !x.bar);
      if (d && !tossed) {
        queueCommand(g, { type: 'serveDrink', drink: d.id });
        tossed = true;
      }
    });
    expect(tossed).toBe(true);
    expect(s.drinks.every((d) => d.state !== OrderState.Flying)).toBe(true);
  });

  it('from the grand restaurant guests sit at the bar: the bartender serves them across the counter, they pay and go', () => {
    const s = createGame(mapForTier(2), 6, { roster: ['cook', 'cook', 'waiter', 'waiter', 'washer', 'bartender', 'bartender'], levels: { building: 2, tables: 4, stove2: 1 } });
    let seated = false;
    let sipping = false;
    let drinkOnCounter = false;
    play(s, 400, (g) => {
      for (const c of g.customers) {
        if (c.stool >= 0 && c.lift! > 0) seated = true;
        if (c.stool >= 0 && c.state === CustomerState.Eating && c.sipping >= 0) sipping = true;
      }
      if (g.customers.some((c) => c.stool >= 0 && c.sipping >= 0)) drinkOnCounter = true;
    });
    expect(seated).toBe(true);
    expect(sipping).toBe(true);
    expect(drinkOnCounter).toBe(true);
    // Every stool is either free or held by someone still there.
    for (const id of s.barSeats) if (id >= 0) expect(s.customers.some((c) => c.id === id && c.stool >= 0)).toBe(true);
  });

  it('the bar upgrades: drinks are made faster and sell for more', () => {
    const s = createGame(STAND_MAP, 7);
    s.coins = big(1e12);
    const d = { id: 1, customer: -1, drink: DRINKS.findIndex((x) => x.id === 'mojito'), state: OrderState.Ready, progress: 1, slot: 0, since: 0, landsAt: 0, waiter: -1, bartender: -1, bar: true, quality: 1 };
    const speed = s.mods.mixSpeed;
    const price = s.mods.drinkPrice;
    buyNow(s, 'cocktails');
    buyNow(s, 'barCounter');
    expect(s.mods.mixSpeed).toBeGreaterThan(speed);
    expect(s.mods.drinkPrice).toBeGreaterThan(price);
    // A drink's price follows the menu and the cocktail menu.
    s.mods = { ...s.mods, price: s.mods.price.map(() => 1000) };
    const base = drinkPrice(s, d, undefined);
    s.mods = { ...s.mods, drinkPrice: s.mods.drinkPrice * 2 };
    expect(drinkPrice(s, d, undefined).gt(base)).toBe(true);
    expect(base.gt(100)).toBe(true);
    // Tapping the counter opens them.
    expect(s.props.some((p) => p.kind === PropKind.BarCounter)).toBe(true);
  });
});
