import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/data/buildings';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { KITCHEN, ROLES } from '../src/data/staff';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { frontOfLine } from '../src/sim/game/staff';
import { capacity } from '../src/sim/game/workers';
import { buildGrid, findPath } from '../src/sim/grid';
import { Held } from '../src/sim/types';

const host = (s: GameState) => s.staff.find((st) => st.role === 'host')!;
const front = (s: GameState) => frontOfLine(s);

function until(s: GameState, done: () => boolean, seconds = 120) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0 && !done(); i--) stepGame(s, STEP_SEC);
  return done();
}

describe('the host walks guests to their table (owner request)', () => {
  it('greets the first in line, leads them to the table and hands over the menu', () => {
    const s = createGame(STAND_MAP, 51, { roster: ['cook', 'waiter', 'host'] });
    expect(host(s).held).toBe(Held.Menu);
    expect(until(s, () => host(s).job?.kind === 'escort' && (host(s).job as { phase: string }).phase === 'lead')).toBe(true);
    const job = host(s).job as { customer: number; table: number };
    const guest = s.customers.find((c) => c.id === job.customer)!;
    expect(guest.state).toBe(CustomerState.ToTable);
    expect(guest.menuFrom).toBe(host(s).id);
    // Seated, they wait for the menu from the host...
    expect(until(s, () => guest.state === CustomerState.Reading, 30)).toBe(true);
    expect(guest.held).toBe(Held.None);
    // ...which flies over, and only then do they read and order.
    const seen = s.nextEventId;
    expect(until(s, () => guest.held === Held.Menu, 15)).toBe(true);
    expect(s.events.some((e) => e.id >= seen && e.type === Ev.Menu)).toBe(true);
    expect(guest.menuFrom).toBe(-1);
    expect(until(s, () => guest.state === CustomerState.Waiting, 10)).toBe(true);
    // And the host goes back to the stand.
    expect(until(s, () => host(s).job === null, 30)).toBe(true);
  });

  it("a tap on someone in line: a free host walks them in", () => {
    const s = createGame(STAND_MAP, 52, { roster: ['cook', 'waiter', 'host'] });
    // Even mid-welcome: the tap skips the greeting.
    expect(until(s, () => front(s) !== undefined)).toBe(true);
    const c = front(s)!;
    queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    expect(c.state).toBe(CustomerState.ToTable);
    expect(host(s).job).toMatchObject({ kind: 'escort', customer: c.id, phase: 'lead' });
  });

  it('while every host is busy, the line keeps moving: the first walks in alone after a moment', () => {
    const s = createGame(STAND_MAP, 53, { roster: ['cook', 'waiter', 'host'], levels: { tables: 3 } });
    let alone = false;
    for (let i = 0; i < 400 / STEP_SEC && !alone; i++) {
      const h = host(s);
      const busy = h.job?.kind === 'escort' && h.job.phase !== 'greet';
      const before = front(s);
      stepGame(s, STEP_SEC);
      if (busy && before && before.state === CustomerState.ToTable && before.menuFrom === -1) {
        alone = true;
        expect(before.stateTime).toBeLessThan(1);
      }
    }
    expect(alone).toBe(true);
  });

  it('without a host, seating stays the manager tap; no one walks in alone', () => {
    const s = createGame(STAND_MAP, 54, { roster: ['cook', 'waiter'] });
    until(s, () => front(s) !== undefined, 60);
    const c = front(s)!;
    for (let i = 0; i < (KITCHEN.selfSeatSeconds * 3) / STEP_SEC; i++) stepGame(s, STEP_SEC);
    expect(c.state).toBe(CustomerState.Queued);
  });

  it('bigger buildings employ more hosts, each with a post that can be reached', () => {
    expect(capacity(createGame(STAND_MAP, 1), 'host')).toBe(ROLES.host.cap);
    TIERS.forEach((_, t) => {
      const map = mapForTier(t);
      const cap = capacity(createGame(map, 1, { levels: { building: t } }), 'host');
      expect(map.hostSpots.length).toBeGreaterThanOrEqual(cap);
      const grid = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length);
      for (const p of map.hostSpots) expect(findPath(grid, map.doors[0]!.inside, p), `tier ${t}`).not.toBeNull();
    });
    expect(capacity(createGame(mapForTier(6), 1, { levels: { building: 6 } }), 'host')).toBeGreaterThan(ROLES.host.cap);
  });
});
