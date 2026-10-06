import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/data/buildings';
import { mapForTier, SEAT_OFFSETS, STAND_MAP, tierRect, WORLD_SHIFT, type MapDef, type Point } from '../src/data/maps';
import { PropKind as K } from '../src/sim/types';
import { buildGrid, findPath } from '../src/sim/grid';

// The first tier used to be drawn by hand; the generator must reproduce its room exactly (now
// further into the world, with land around it), so every tuned spot stays where it was.
const HAND_MADE: Omit<MapDef, 'kitchenX' | 'focus' | 'hostSpots' | 'busStop' | 'busDoor' | 'trophySpots'> = {
  id: 'diner',
  tier: 0,
  theme: { dining: 'dining', wall: '#4A1F4E' },
  width: 22,
  height: 18,
  areas: [
    { x0: 0, y0: 0, x1: 22, y1: 18, floor: 'grass', walkable: false },
    { x0: 14, y0: 3, x1: 21, y1: 11, floor: 'lot', walkable: false },
    { x0: 0, y0: 12, x1: 22, y1: 14, floor: 'sidewalk', walkable: true },
    { x0: 0, y0: 14, x1: 22, y1: 17, floor: 'road', walkable: false },
    { x0: 2, y0: 2, x1: 6, y1: 12, floor: 'kitchen', walkable: true },
    { x0: 6, y0: 2, x1: 14, y1: 12, floor: 'dining', walkable: true },
  ],
  building: { x0: 2, y0: 2, x1: 14, y1: 12 },
  wallHeight: 64,
  doors: [{ inside: { x: 12.5, y: 11.5 }, outside: { x: 12.5, y: 12.5 } }],
  firstSpawn: { x: 9.5, y: 12.6 },
  spawns: [
    { x: 0.5, y: 12.5 },
    { x: 21.5, y: 13.5 },
  ],
  streetEnds: [
    { x: 0.5, y: 12.5 },
    { x: 21.5, y: 13.5 },
  ],
  queue: [
    { x: 12.5, y: 10.5 },
    { x: 13.5, y: 10.5 },
    { x: 13.5, y: 9.5 },
    { x: 13.5, y: 8.5 },
  ],
  // Two columns of tables with a walking lane between rows; the door corner stays free for the line.
  tables: [
    { x: 8.5, y: 4.5 },
    { x: 11.5, y: 4.5 },
    { x: 8.5, y: 8.5 },
    { x: 11.5, y: 8.5 },
    { x: 8.5, y: 6.5 },
    { x: 11.5, y: 6.5 },
    { x: 8.5, y: 10.5 },
  ],
  startTables: 3,
  // The second stove slots in between the first one and the sink: one long cooking line.
  stoves: [
    { stove: { kind: K.Stove, x: 2.5, y: 4, w: 1, d: 2, blocks: true }, cook: { x: 3.55, y: 4 } },
    { stove: { kind: K.Stove, x: 2.5, y: 6, w: 1, d: 2, blocks: true }, cook: { x: 3.55, y: 6 } },
  ],
  startStoves: 1,
  // The pass sits one step from the stove: the cook turns around and sets the plate down.
  pass: { kind: K.Pass, x: 4.5, y: 4.5, w: 1, d: 3, blocks: true },
  passSlots: [
    { x: 4.5, y: 3.5 },
    { x: 4.5, y: 4.5 },
    { x: 4.5, y: 5.5 },
  ],
  passTop: 24,
  pickupSpots: [
    { x: 5.5, y: 3.5 },
    { x: 5.5, y: 4.5 },
    { x: 5.5, y: 5.5 },
  ],
  waiterIdle: [
    { x: 6.7, y: 6.3 },
    { x: 6.7, y: 7.4 },
    { x: 6.7, y: 5.2 },
  ],
  hostSpot: { x: 11.6, y: 10.4 },
  managerSpot: { x: 5.5, y: 6.6 },
  cleanerIdle: [
    { x: 7.3, y: 11.3 },
    { x: 10.3, y: 11.3 },
  ],
  // Right of the door, clear of the street sign and the customers' way in.
  applicantSpots: [
    { x: 14.1, y: 12.7 },
    { x: 15.0, y: 12.95 },
  ],
  promoterSpots: [
    { x: 8.5, y: 12.55 },
    { x: 3.5, y: 12.55 },
    { x: 2.5, y: 12.55 },
  ],
  sink: { kind: K.Sink, x: 2.5, y: 8, w: 1, d: 2, blocks: true },
  washerSpot: { x: 3.55, y: 8 },
  extraSinks: [],
  dirtyDrop: { x: 3.75, y: 7.25 },
  cleanStack: { x: 2.5, y: 8.5 },
  dirtyStack: { x: 2.5, y: 7.5 },
  sinkTop: 22,
  ticketRail: { x: 4.1, y0: 3.2, step: 0.42, lift: 52, max: 7 },
  decor: [
    { kind: K.Fridge, x: 2.5, y: 10.5, w: 1, d: 1, blocks: true },
    { kind: K.Plant, x: 6.5, y: 2.5, w: 1, d: 1, blocks: true },
    { kind: K.Plant, x: 13.5, y: 2.5, w: 1, d: 1, blocks: true, variant: 1 },
    { kind: K.Plant, x: 6.5, y: 11.5, w: 1, d: 1, blocks: true },
    { kind: K.Neon, x: 10, y: 2, w: 0, d: 0, blocks: false, lift: 44 },
    { kind: K.Tree, x: 16, y: 1.2, w: 1, d: 1, blocks: false, variant: 1 },
    { kind: K.Lamp, x: 7, y: 13.8, w: 0, d: 0, blocks: false },
    { kind: K.Lamp, x: 17, y: 13.8, w: 0, d: 0, blocks: false },
    { kind: K.SaleSign, x: 17.5, y: 10.6, w: 0, d: 0, blocks: false },
    { kind: K.StreetSign, x: 10.9, y: 12.25, w: 0, d: 0, blocks: false },
  ],
  backdrop: [
    { kind: K.Tree, x: 1, y: 1, w: 1, d: 1, blocks: false },
    { kind: K.Tree, x: 6, y: 0.9, w: 1, d: 1, blocks: false, variant: 1 },
    { kind: K.Tree, x: 11.5, y: 0.8, w: 1, d: 1, blocks: false },
    { kind: K.Tree, x: 0.8, y: 5.5, w: 1, d: 1, blocks: false },
    { kind: K.Tree, x: 0.8, y: 9, w: 1, d: 1, blocks: false, variant: 1 },
  ],
};

describe('map generator', () => {
  it('tier 0 is the hand-made diner, moved into the world', () => {
    const at = (p: Point) => ({ ...p, x: p.x + WORLD_SHIFT.x, y: p.y + WORLD_SHIFT.y });
    const m = STAND_MAP;
    expect(mapForTier(0)).toBe(m);
    expect(m.building).toEqual({ x0: HAND_MADE.building.x0 + WORLD_SHIFT.x, y0: HAND_MADE.building.y0 + WORLD_SHIFT.y, x1: HAND_MADE.building.x1 + WORLD_SHIFT.x, y1: HAND_MADE.building.y1 + WORLD_SHIFT.y });
    expect(m.tables).toEqual(HAND_MADE.tables.map(at));
    expect(m.stoves).toEqual(HAND_MADE.stoves.map((st) => ({ stove: at(st.stove), cook: at(st.cook) })));
    for (const key of ['pass', 'hostSpot', 'managerSpot', 'sink', 'washerSpot', 'dirtyDrop', 'cleanStack', 'dirtyStack'] as const) expect(m[key], key).toEqual(at(HAND_MADE[key]));
    for (const key of ['passSlots', 'pickupSpots', 'waiterIdle', 'cleanerIdle', 'queue'] as const) expect(m[key], key).toEqual(HAND_MADE[key].map(at));
    expect(m.doors.map((d) => d.inside)).toEqual(HAND_MADE.doors.map((d) => at(d.inside)));
    expect(m.ticketRail).toEqual({ ...HAND_MADE.ticketRail, x: HAND_MADE.ticketRail.x + WORLD_SHIFT.x, y0: HAND_MADE.ticketRail.y0 + WORLD_SHIFT.y });
    // The furniture inside the room (fridge, plants, neon) too.
    const inside = (f: { x: number; y: number }, b: MapDef['building']) => f.x >= b.x0 && f.x <= b.x1 && f.y >= b.y0 && f.y <= b.y1 - 0.4;
    const kinds: number[] = [K.Fridge, K.Plant, K.Neon];
    expect(m.decor.filter((f) => kinds.includes(f.kind) && inside(f, m.building))).toEqual(HAND_MADE.decor.filter((f) => kinds.includes(f.kind) && inside(f, HAND_MADE.building)).map(at));
    for (const key of ['startTables', 'startStoves', 'passTop', 'sinkTop', 'wallHeight', 'theme', 'extraSinks'] as const) expect(m[key], key).toEqual(HAND_MADE[key]);
  });

  it('one world for every building: the same size, each building inside the next', () => {
    TIERS.forEach((_, t) => {
      expect([mapForTier(t).width, mapForTier(t).height]).toEqual([STAND_MAP.width, STAND_MAP.height]);
      if (t === 0) return;
      const a = tierRect(t - 1);
      const b = tierRect(t);
      const g = TIERS[t]!.grow;
      expect([a.x0 - b.x0, a.y0 - b.y0, b.x1 - a.x1, b.y1 - a.y1]).toEqual([g.left, g.back, g.right, g.front]);
    });
    // Owner request: not only to the right. Some building grows each way.
    expect(['left', 'back', 'right', 'front'].every((side) => TIERS.some((t) => t.grow[side as keyof typeof t.grow] > 0))).toBe(true);
  });

  it('all the land to come is on the map from the start: the next lot for sale, the rest locked', () => {
    TIERS.forEach((_, t) => {
      const map = mapForTier(t);
      const last = tierRect(TIERS.length - 1);
      // Every tile of the last building is the building now, or land for one to come.
      for (let y = last.y0; y < last.y1; y++) {
        for (let x = last.x0; x < last.x1; x++) {
          const a = [...map.areas].reverse().find((r) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1)!;
          const inside = x >= map.building.x0 && x < map.building.x1 && y >= map.building.y0 && y < map.building.y1;
          expect(inside || a.floor === 'lot' || a.floor === 'locked' || a.floor === 'path', `tier ${t} tile ${x},${y}: ${a.floor}`).toBe(true);
        }
      }
      const locks = map.decor.filter((f) => f.kind === K.LockSign).map((f) => f.variant);
      expect(new Set(locks).size).toBe(Math.max(0, TIERS.length - 2 - t));
    });
  });

  it('every tier keeps the old room and adds table spots', () => {
    for (let t = 1; t < TIERS.length; t++) {
      const prev = mapForTier(t - 1);
      const map = mapForTier(t);
      expect(map.building.x1).toBe(tierRect(t).x1);
      expect(map.tables.slice(0, prev.tables.length)).toEqual(prev.tables);
      expect(map.tables.length).toBeGreaterThan(prev.tables.length);
      expect(map.waiterIdle.length).toBeGreaterThanOrEqual(3 + (TIERS[t]!.staff.waiter ?? 0));
      expect(map.cleanerIdle.length).toBeGreaterThanOrEqual(2 + (TIERS[t]!.staff.cleaner ?? 0));
    }
  });

  it('only the last tier has no lot for sale', () => {
    TIERS.forEach((_, t) => {
      const map = mapForTier(t);
      const lot = map.areas.some((a) => a.floor === 'lot');
      const sign = map.decor.some((f) => f.kind === K.SaleSign);
      expect(lot).toBe(t < TIERS.length - 1);
      expect(sign).toBe(lot);
    });
  });

  it('with every table bought, every chair and the kitchen can be reached from the door', () => {
    TIERS.forEach((_, t) => {
      const map = mapForTier(t);
      // Every table with both chairs: the tightest the room can get.
      const grid = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length);
      const door = map.doors[0]!.inside;
      for (const spot of map.tables) {
        for (const seat of SEAT_OFFSETS) {
          expect(findPath(grid, door, { x: spot.x + seat.x, y: spot.y + seat.y }), `tier ${t} table ${spot.x},${spot.y}`).not.toBeNull();
        }
        // ...and the spot where staff serve and clear it.
        expect(findPath(grid, door, { x: spot.x, y: spot.y + 0.75 }), `tier ${t} serve ${spot.x},${spot.y}`).not.toBeNull();
      }
      for (const p of [...map.pickupSpots, map.washerSpot, ...map.waiterIdle, ...map.cleanerIdle, map.hostSpot, map.managerSpot, ...map.queue]) {
        expect(findPath(grid, door, p), `tier ${t} spot ${p.x},${p.y}`).not.toBeNull();
      }
    });
  });

  it('the bigger buildings get a bigger kitchen, and a path leads from the street to every door', () => {
    for (let t = 1; t < TIERS.length; t++) {
      const prev = mapForTier(t - 1);
      const map = mapForTier(t);
      expect(map.building.y1 - map.building.y0).toBeGreaterThanOrEqual(prev.building.y1 - prev.building.y0);
      expect(map.stoves.length).toBeGreaterThanOrEqual(prev.stoves.length);
      expect(map.kitchenX - map.building.x0).toBeGreaterThanOrEqual(prev.kitchenX - prev.building.x0);
    }
    TIERS.forEach((_, t) => {
      const map = mapForTier(t);
      const sidewalk = map.areas.find((a) => a.floor === 'sidewalk')!;
      expect(sidewalk.y0).toBe(STAND_MAP.areas.find((a) => a.floor === 'sidewalk')!.y0);
      const grid = buildGrid(map);
      expect(findPath(grid, map.spawns[0]!, map.queue[0]!), `tier ${t}`).not.toBeNull();
    });
    // The last kitchen is twice as wide, with lines of stoves.
    expect(mapForTier(TIERS.length - 1).kitchenX - mapForTier(TIERS.length - 1).building.x0).toBe(2 * (STAND_MAP.kitchenX - STAND_MAP.building.x0));
    expect(new Set(mapForTier(TIERS.length - 1).stoves.map((s) => s.stove.x)).size).toBeGreaterThan(2);
    const empire = mapForTier(TIERS.length - 1);
    expect(empire.building.y1).toBeGreaterThan(STAND_MAP.building.y1);
    expect(empire.stoves.length).toBeGreaterThan(STAND_MAP.stoves.length + 2);
    expect(empire.passSlots.length).toBeGreaterThan(STAND_MAP.passSlots.length);
    expect(empire.extraSinks.length).toBeGreaterThan(0);
    // Every cook can get to their stove.
    TIERS.forEach((_, t) => {
      const map = mapForTier(t);
      const grid = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length);
      for (const st of map.stoves) expect(findPath(grid, map.doors[0]!.inside, st.cook), `tier ${t} cook ${st.cook.y}`).not.toBeNull();
      for (const e of map.extraSinks) expect(findPath(grid, map.doors[0]!.inside, e.washer), `tier ${t} washer ${e.washer.y}`).not.toBeNull();
    });
  });
});
