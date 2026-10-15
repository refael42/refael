import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/data/buildings';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { RESTROOM } from '../src/data/restroom';
import { STEP_SEC } from '../src/data/sim';
import { buildGrid, findPath } from '../src/sim/grid';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { PropKind } from '../src/sim/types';

function play(s: GameState, seconds: number, watch?: (s: GameState) => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    watch?.(s);
  }
}

describe('the restroom (owner M36)', () => {
  it('every building has one in the dining room, reachable through its door, more stalls as it grows', () => {
    let last = 0;
    TIERS.forEach((_, t) => {
      const m = mapForTier(t);
      const r = m.restroom;
      expect(r.x1, m.id).toBe(m.building.x1);
      expect(r.y0, m.id).toBe(m.building.y0);
      expect(r.stalls.length, m.id).toBeGreaterThanOrEqual(Math.max(2, last));
      last = r.stalls.length;
      expect(m.decor.filter((f) => f.kind === PropKind.WcStall)).toHaveLength(r.stalls.length);
      expect(m.decor.some((f) => f.kind === PropKind.WcSink)).toBe(true);
      // No table in it.
      for (const tb of m.tables) expect(tb.x >= r.x0 && tb.x < r.x1 && tb.y >= r.y0 && tb.y < r.y1, `${m.id} table`).toBe(false);
      const g = buildGrid(m);
      const door = m.doors[0]!.inside;
      for (const p of [r.wait, r.door, r.sink, r.mop, ...r.stalls]) expect(findPath(g, door, p)?.length ?? 0, `${m.id} to ${JSON.stringify(p)}`).toBeGreaterThan(0);
    });
  });

  it('guests drop in after paying: a stall each (the door shuts), the sink, home; it gets dirtier', () => {
    const s = createGame(STAND_MAP, 5, { roster: ['cook', 'waiter', 'washer'] });
    let visits = 0;
    let hidden = 0;
    let maxDirt = 0;
    play(s, 900, (g) => {
      visits = Math.max(visits, g.customers.filter((c) => c.state === CustomerState.Restroom).length);
      hidden += g.customers.filter((c) => c.hidden).length;
      maxDirt = Math.max(maxDirt, g.restroom.dirt);
      // A stall is never shared.
      const inStalls = g.restroom.stalls.filter((id) => id >= 0);
      expect(new Set(inStalls).size).toBe(inStalls.length);
    });
    expect(visits).toBeGreaterThan(0);
    expect(hidden).toBeGreaterThan(0);
    expect(maxDirt).toBeGreaterThanOrEqual(RESTROOM.dirtPerUse);
  });

  it('a cleaner mops it once it is dirty; then it shines', () => {
    const s = createGame(STAND_MAP, 6, { roster: ['cook', 'waiter', 'washer', 'cleaner'] });
    s.restroom.dirt = 0.7;
    let mopped = false;
    play(s, 60, (g) => {
      if (g.staff.some((st) => st.role === 'cleaner' && st.job?.kind === 'restroom')) mopped = true;
    });
    expect(mopped).toBe(true);
    expect(s.restroom.dirt).toBeLessThan(RESTROOM.cleanAt);
  });

  it('with no cleaner, a waiter goes only when it is really bad', () => {
    const s = createGame(STAND_MAP, 7, { roster: ['cook', 'waiter', 'washer'] });
    s.restroom.dirt = (RESTROOM.cleanAt + RESTROOM.waiterAt) / 2;
    play(s, 20);
    expect(s.staff.some((st) => st.job?.kind === 'restroom')).toBe(false);
    s.restroom.dirt = RESTROOM.waiterAt + 0.05;
    let went = false;
    play(s, 60, (g) => {
      if (g.staff.some((st) => st.role === 'waiter' && st.job?.kind === 'restroom')) went = true;
    });
    expect(went).toBe(true);
  });

  it('a dirty restroom costs rating and brings reviews about it', () => {
    const s = createGame(STAND_MAP, 8, { roster: ['cook', 'waiter', 'washer'] });
    // Nobody will mop it: it stays filthy.
    s.restroom.dirt = 1;
    s.restroom.cleaner = 999;
    const rating = s.rating;
    play(s, 1500, (g) => {
      g.restroom.dirt = 1;
      g.restroom.cleaner = 999;
    });
    expect(s.rating).toBeLessThan(rating + 1.5);
    expect(s.reviews.some((r) => r.kind === 'restroom')).toBe(true);
  });
});
