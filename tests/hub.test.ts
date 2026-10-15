import { describe, expect, it } from 'vitest';
import { HUB, HubPiece, hubStage } from '../src/data/delivery';
import { mapForTier } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { UNLOCK_TIER } from '../src/data/unlocks';
import { computeMods } from '../src/sim/economy/upgrades';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { hubProps, stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { capacity } from '../src/sim/game/workers';
import { MAIN_POSTS, postOf } from '../src/sim/game/packing';
import { buildGrid, findPath } from '../src/sim/grid';
import { PropKind } from '../src/sim/types';

function play(s: GameState, seconds: number, each?: (s: GameState) => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    each?.(s);
  }
}

const TIER = UNLOCK_TIER.packer;

describe('the delivery hub (owner M30: "a grander delivery station that really grows")', () => {
  it('opens a piece at a time with the packing station, each bringing something', () => {
    expect(hubStage(0)).toBe(0);
    expect(hubStage(9)).toBe(0);
    expect(hubStage(10)).toBe(1);
    expect(hubStage(200)).toBe(HUB.length);
    const before = computeMods({ packStation: 9 });
    const mid = computeMods({ packStation: 50 });
    const all = computeMods({ packStation: 200 });
    expect(mid.packers).toBe(1);
    expect(all.packers).toBe(2);
    expect(mid.deliveryDemand).toBeGreaterThan(before.deliveryDemand);
    expect(all.deliveryDemand).toBeGreaterThan(mid.deliveryDemand);
    expect(all.couriers).toBe(before.couriers + 1);
    expect(all.tripSpeed).toBeGreaterThan(before.tripSpeed);
  });

  it('keeps its room in the kitchen front row from the start, and everyone still gets everywhere', () => {
    for (const t of [TIER, 7]) {
      const map = mapForTier(t);
      const hub = map.packing!.hub;
      expect(hub).toHaveLength(HUB.length);
      const grid = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length);
      const door = map.doors[0]!.inside;
      for (const p of [...map.packing!.spots, map.packing!.fridgeSpot]) expect(findPath(grid, door, p), `tier ${t} ${p.x},${p.y}`).not.toBeNull();
      for (const st of map.stoves) expect(findPath(grid, door, st.cook)).not.toBeNull();
      // The inside pieces stand on their own tiles.
      const inside = hub.filter((h) => h.blocks);
      expect(new Set(inside.map((h) => `${h.x},${h.y}`)).size).toBe(inside.length);
    }
  });

  it('its counters make room for more packers, who pack at their own counter', () => {
    const s = createGame(mapForTier(TIER), 61, { roster: ['cook', 'cook', 'waiter', 'washer', 'courier', 'courier', 'packer', 'packer'], levels: { packStation: 10 } });
    expect(capacity(s, 'packer')).toBe(capacity(createGame(mapForTier(TIER), 61), 'packer') + 1);
    // The building has room for one packer at its counter: the second works the hub's.
    const second = s.staff.filter((st) => st.role === 'packer')[1]!;
    expect(postOf(s, second)).toBe(MAIN_POSTS);
    const counter = s.map.packing!.counters[MAIN_POSTS]!;
    let atCounter = false;
    play(s, 600, (g) => {
      if (g.events.some((e) => e.type === Ev.Packed && Math.abs(e.x - counter.x) < 0.01 && Math.abs(e.y - counter.y) < 0.01)) atCounter = true;
    });
    expect(atCounter).toBe(true);
  });

  it('shows the pieces still to come inside as outlines, the open ones at work, nothing outside before its level', () => {
    const s = createGame(mapForTier(TIER), 62, { levels: { packStation: 25 } });
    const props = hubProps(s);
    const of = (piece: number) => props.filter((p) => p.variant === piece && p.kind === PropKind.HubPiece);
    expect(of(HubPiece.Counter)[0]!.level).toBe(1);
    expect(of(HubPiece.BagWall)[0]!.level).toBe(1);
    expect(of(HubPiece.OrderScreen)[0]!.level).toBe(0);
    expect(of(HubPiece.Sign)).toHaveLength(0);
    expect(of(HubPiece.Chargers)).toHaveLength(0);
    const full = createGame(mapForTier(TIER), 63, { levels: { packStation: 200, rank: 3 } });
    const all = hubProps(full);
    expect(all.every((p) => p.level === 1)).toBe(true);
    expect(all.filter((p) => p.variant === HubPiece.Chargers).length).toBeGreaterThan(1);
  });
});
