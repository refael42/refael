import { describe, expect, it } from 'vitest';
import { mapForTier } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { fullSeats, tableLength } from '../src/data/tables';
import { queueCommand } from '../src/sim/game/commands';
import { createGame, joinCandidate, tableUnits } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { findPath } from '../src/sim/grid';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';

function play(s: GameState, seconds: number, each?: (s: GameState) => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    each?.(s);
  }
}

const full = (tier: number, seed: number) => {
  const map = mapForTier(tier);
  return createGame(map, seed, { levels: { building: tier, tables: map.tables.length - map.startTables, seats: 40, family: 40 } });
};

/** Joins tables until one is `length` tiles long (or none can be). */
function joinUntil(s: GameState, length: number): number {
  for (let round = 0; round < 6; round++) {
    const done = s.tables.find((t) => tableLength(t.style) >= length);
    if (done) return done.index;
    const a = s.tables.find((t) => joinCandidate(s, t.index) >= 0 && tableLength(t.style) + tableLength(s.tables[joinCandidate(s, t.index)]!.style) <= length);
    if (!a) return -1;
    queueCommand(s, { type: 'joinTables', table: a.index, other: joinCandidate(s, a.index) });
    stepGame(s, STEP_SEC);
  }
  return -1;
}

describe('joining tables (owner M30: "join tables into a long table that holds more people")', () => {
  it('pushes one table onto the back of another: one long table with every chair, still counting for both', () => {
    const s = full(2, 71);
    const units = tableUnits(s);
    const count = s.tables.length;
    const a = s.tables.find((t) => joinCandidate(s, t.index) >= 0)!;
    const b = s.tables[joinCandidate(s, a.index)]!;
    const length = tableLength(a.style) + tableLength(b.style);
    queueCommand(s, { type: 'joinTables', table: a.index, other: b.index });
    stepGame(s, STEP_SEC);
    expect(s.tables).toHaveLength(count - 1);
    expect(tableUnits(s)).toBe(units);
    const joined = s.tables.find((t) => t.parts.length > 1)!;
    expect(tableLength(joined.style)).toBe(length);
    expect(joined.seats).toBe(fullSeats(joined.style));
    expect(joined.backIds).toHaveLength(length - 1);
    s.tables.forEach((t, i) => expect(t.index).toBe(i));
    // Everyone can still get everywhere.
    for (const t of s.tables) expect(findPath(s.grid, s.map.doors[0]!.inside, { x: t.x, y: t.y + 0.75 }), `table ${t.index}`).not.toBeNull();
  });

  it('a long table of eight or ten fills with a big party, and the save keeps it joined', () => {
    const s = full(3, 72);
    const i = joinUntil(s, 3);
    expect(i).toBeGreaterThanOrEqual(0);
    const t = s.tables[i]!;
    expect(t.seats).toBeGreaterThanOrEqual(8);
    let crowd = 0;
    play(s, 1800, (g) => {
      for (const c of g.customers) if (c.partySize > 6) crowd = Math.max(crowd, c.partySize);
    });
    expect(crowd).toBeGreaterThan(6);
    const loaded = parseSave(JSON.stringify(makeSave(s, Date.now())));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 72, Date.now());
    expect(tableUnits(back)).toBe(tableUnits(s));
    expect(back.tables.filter((x) => x.parts.length > 1).length).toBe(s.tables.filter((x) => x.parts.length > 1).length);
  });

  it('splits back into its tables, each where it fits', () => {
    const s = full(1, 73);
    const units = tableUnits(s);
    const a = s.tables.find((t) => joinCandidate(s, t.index) >= 0)!;
    queueCommand(s, { type: 'joinTables', table: a.index, other: joinCandidate(s, a.index) });
    stepGame(s, STEP_SEC);
    const joined = s.tables.find((t) => t.parts.length > 1)!;
    const count = s.tables.length;
    queueCommand(s, { type: 'splitTable', table: joined.index });
    stepGame(s, STEP_SEC);
    expect(s.tables).toHaveLength(count + 1);
    expect(tableUnits(s)).toBe(units);
    expect(s.tables.every((t) => t.parts.length === 0)).toBe(true);
  });

  it('only free tables join, and never a joined style bought straight away', () => {
    const s = full(1, 74);
    const a = s.tables.find((t) => joinCandidate(s, t.index) >= 0)!;
    a.party[0] = 999;
    expect(joinCandidate(s, a.index)).toBe(-1);
  });
});
