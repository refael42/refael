import { describe, expect, it } from 'vitest';
import { FAMILY_SEATS, mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { canBuy, upgradeDef } from '../src/sim/economy/upgrades';
import { queueCommand } from '../src/sim/game/commands';
import { chairOf, dishSpot } from '../src/sim/game/customers';
import { createGame } from '../src/sim/game/create';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, TableState, type GameState } from '../src/sim/game/types';
import { PropKind } from '../src/sim/types';
import { KID_RANK } from '../src/data/customers';

// Owner request: "new tables that hold more people, in a different design, say square".

const GRAND = 2;
const grand = (seed: number, family: number) =>
  createGame(mapForTier(GRAND), seed, { roster: ['cook', 'cook', 'waiter', 'waiter', 'washer', 'washer'], levels: { building: GRAND, tables: 6, seats: 8, family, fries: 20 } });

const chairsAt = (s: GameState, t: { x: number; y: number }) => s.props.filter((p) => p.kind === PropKind.Chair && Math.abs(p.x - t.x) < 1 && Math.abs(p.y - t.y) < 0.5);

function run(s: GameState, seconds: number) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
  }
}

describe('square family tables', () => {
  it('open with the grand restaurant, one per table for two', () => {
    const def = upgradeDef('family');
    const diner = createGame(STAND_MAP, 1, { levels: { seats: 3 } });
    expect(canBuy(def, diner.levels, big('1e30'), diner.map)).toBe(false);
    const s = grand(1, 0);
    expect(canBuy(def, s.levels, big('1e30'), s.map)).toBe(true);
    // No more family tables than tables for two.
    expect(canBuy(def, { ...s.levels, family: 8 }, big('1e30'), s.map)).toBe(false);
  });

  it('a table for two becomes a square table for four: four chairs on the same tiles', () => {
    const s = grand(2, 0);
    s.coins = big('1e30');
    const t = s.tables[0]!;
    const walkable = Array.from(s.grid.walk);
    expect(buyUpgrade(s, 'family')).toBe(true);
    expect(t.seats).toBe(FAMILY_SEATS.length);
    expect(t.party).toEqual([-1, -1, -1, -1]);
    // Two whole chairs on the -x side, two seats and their backrests on the +x side.
    const chairs = chairsAt(s, t);
    expect(chairs.filter((p) => p.variant === 0)).toHaveLength(2);
    expect(chairs.filter((p) => p.variant === 1)).toHaveLength(2);
    expect(chairs.filter((p) => p.variant === 2)).toHaveLength(2);
    // The room is unchanged: nothing new blocks a path.
    expect(Array.from(s.grid.walk)).toEqual(walkable);
    // Every chair and plate in its own spot, all in the table's two chair tiles.
    const spots = [0, 1, 2, 3].map((i) => chairOf(t, i));
    expect(new Set(spots.map((p) => `${p.x},${p.y}`)).size).toBe(4);
    for (const p of spots) expect(Math.floor(p.y)).toBe(Math.floor(t.y));
    expect(new Set([0, 1, 2, 3].map((i) => JSON.stringify(dishSpot(t, i)))).size).toBe(4);
  });

  it('a busy table waits for its guests to leave before it grows', () => {
    const s = grand(3, 0);
    s.coins = big('1e30');
    const t = s.tables[0]!;
    t.state = TableState.Occupied;
    t.party[0] = 999;
    buyUpgrade(s, 'family');
    expect(t.seats).toBe(2);
    t.state = TableState.Free;
    t.party[0] = -1;
    stepGame(s, STEP_SEC);
    expect(t.seats).toBe(4);
  });

  it('a saved game rebuilds its family tables', () => {
    const s = grand(4, 2);
    expect(s.tables.map((t) => t.seats).slice(0, 3)).toEqual([4, 4, 2]);
    expect(chairsAt(s, s.tables[0]!)).toHaveLength(6);
  });

  it('families of 3-4 come only with family tables, and sit all together', () => {
    const none = grand(5, 0);
    run(none, 300);
    expect(none.customers.every((c) => c.partySize <= 2)).toBe(true);

    const s = grand(5, 4);
    let seen = 0;
    let kids = 0;
    for (let i = 0; i < 12; i++) {
      run(s, 30);
      for (const t of s.tables) {
        const party = t.party.filter((id) => id >= 0).map((id) => s.customers.find((c) => c.id === id)!);
        if (party.length < 3) continue;
        seen++;
        expect(t.seats).toBe(4);
        expect(new Set(party.map((c) => c.party)).size).toBe(1);
        expect(new Set(party.map((c) => c.seat)).size).toBe(party.length);
        kids += party.filter((c) => c.rank === KID_RANK).length;
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(kids).toBeGreaterThan(0);
  });
});
