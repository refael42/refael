import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/data/buildings';
import { Station } from '../src/data/kitchen';
import { bandsIn, ROOM_KINDS, RoomItem } from '../src/data/kitchenRooms';
import { mapForTier, type MapDef, type Point } from '../src/data/maps';
import { buildGrid, findPath } from '../src/sim/grid';
import { PropKind } from '../src/sim/types';

// The kitchen in rooms (owner M32): the line room with its hot and cold lines open to the pass,
// and below it the dish room, the walk-in cold room and freezer, the vegetable room, the
// manager's office, prep, stores, pastry and butchery, with walls and doors.

const maps = TIERS.map((_, t) => mapForTier(t));
const inRect = (p: Point, r: { x0: number; y0: number; x1: number; y1: number }) => p.x >= r.x0 && p.x < r.x1 && p.y >= r.y0 && p.y < r.y1;
const roomOf = (m: MapDef, p: Point) => m.rooms.find((r) => inRect(p, r));

/** Does the segment a-b cross a wall unit (anywhere but its ends)? */
function crosses(m: MapDef, a: Point, b: Point): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.05);
  for (let i = 1; i <= steps; i++) {
    const p = { x: a.x + ((b.x - a.x) * (i - 1)) / steps, y: a.y + ((b.y - a.y) * (i - 1)) / steps };
    const q = { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps };
    for (const w of m.walls) {
      if (w.along === 'x' && (p.y - w.y) * (q.y - w.y) < 0 && p.x > w.x && p.x < w.x + 1) return true;
      if (w.along === 'y' && (p.x - w.x) * (q.x - w.x) < 0 && p.y > w.y && p.y < w.y + 1) return true;
    }
  }
  return false;
}

describe('the kitchen in rooms (owner M32)', () => {
  it('the line room is open to the pass, its hot line nearest it and the cold line in a section of its own', () => {
    for (const m of maps) {
      const hot = m.areas.filter((a) => a.floor === 'lineHot');
      const cold = m.areas.filter((a) => a.floor === 'lineCold');
      expect(hot, m.id).toHaveLength(1);
      expect(cold.length, m.id).toBeGreaterThan(0);
      for (const st of m.stoves) {
        const isCold = st.type === Station.ColdLine || st.type === Station.Sushi;
        expect(cold.some((a) => inRect(st.stove, a)), `${m.id} station ${st.type}`).toBe(isCold);
        expect(inRect(st.stove, hot[0]!)).toBe(true);
        // Nothing of the line room is in a room.
        expect(roomOf(m, st.stove)).toBeUndefined();
        expect(roomOf(m, st.cook)).toBeUndefined();
      }
      // A sign over each line.
      expect(m.decor.filter((f) => f.kind === PropKind.RoomSign && f.variant! >= ROOM_KINDS.length)).toHaveLength(2);
    }
  });

  it('every building has a dish room by the lane, a walk-in cold room with the fridge; the office from the grand restaurant; the crown every room', () => {
    for (const m of maps) {
      const dish = m.rooms.find((r) => r.kind === 'dish')!;
      expect(dish, m.id).toBeDefined();
      for (const sink of [m.sink, ...m.extraSinks.map((e) => e.sink)]) expect(roomOf(m, sink)).toBe(dish);
      for (const w of [m.washerSpot, ...m.extraSinks.map((e) => e.washer), m.dirtyDrop]) expect(roomOf(m, w)).toBe(dish);
      // Its door opens onto the waiters' lane: they bring the dirty plates in from there.
      expect(m.roomDoors.some((d) => d.room === 'dish' && d.along === 'y' && d.x === m.kitchenX - 1)).toBe(true);
      const fridge = m.decor.find((f) => f.kind === PropKind.Fridge)!;
      expect(roomOf(m, fridge)?.kind, m.id).toBe('cold');
      expect(m.rooms.some((r) => r.kind === 'office'), m.id).toBe(m.tier >= 2);
      // A freezer behind its own door in some of them.
      if (m.tier === 0) expect(m.rooms.find((r) => r.kind === 'cold')!.freezerX).toBeDefined();
    }
    const crown = maps[maps.length - 1]!;
    // Every kitchen room (the restroom is the dining room's, owner M36).
    expect(new Set(crown.rooms.map((r) => r.kind))).toEqual(new Set(ROOM_KINDS.filter((k) => k !== 'restroom')));
    const office = crown.rooms.find((r) => r.kind === 'office')!;
    expect(crown.decor.some((f) => f.kind === PropKind.RoomPiece && f.variant === RoomItem.Desk && inRect(f, office))).toBe(true);
  });

  it('rooms sit in the kitchen side by side, never on each other, with a door each and a corridor between bands', () => {
    for (const m of maps) {
      const b = m.building;
      for (const r of m.rooms) {
        expect(r.x0 >= b.x0 && r.x1 <= m.kitchenX - 1 && r.y0 > b.y0 && r.y1 <= b.y1, `${m.id} ${r.kind}`).toBe(true);
        expect(r.x1 - r.x0).toBeGreaterThanOrEqual(2);
        expect(r.y1 - r.y0).toBeGreaterThanOrEqual(4);
        for (const o of m.rooms) if (o !== r) expect(r.x0 < o.x1 && o.x0 < r.x1 && r.y0 < o.y1 && o.y0 < r.y1, `${m.id} ${r.kind}/${o.kind}`).toBe(false);
        expect(m.roomDoors.some((d) => d.room === r.kind && d.along === 'x' && d.y === r.y0 && d.x >= r.x0 && d.x < r.x1)).toBe(true);
      }
    }
    expect(bandsIn(0, 3)).toEqual([]);
    expect(bandsIn(0, 4)).toEqual([[0, 4]]);
    expect(bandsIn(0, 9)).toEqual([[0, 4], [5, 9]]);
  });

  it('nobody walks through a wall: everyone gets where they work through the doors', () => {
    for (const m of maps) {
      const g = buildGrid(m, m.stoves.length);
      const door = m.doors[0]!.inside;
      const spots = [m.washerSpot, ...m.extraSinks.map((e) => e.washer), m.dirtyDrop, ...m.stoves.map((s) => s.cook), ...m.passDrops, ...m.rooms.map((r) => r.post), ...m.pickupSpots];
      for (const p of spots) {
        const path = findPath(g, door, p);
        expect(path, `${m.id} to ${p.x},${p.y}`).not.toBeNull();
        const pts = [door, ...path!];
        for (let i = 1; i < pts.length; i++) expect(crosses(m, pts[i - 1]!, pts[i]!), `${m.id} ${JSON.stringify(pts[i - 1])}-${JSON.stringify(pts[i])}`).toBe(false);
      }
      // Across a wall is a walk round to the door, never one step.
      for (const w of m.walls.filter((w) => w.along === 'x')) {
        const a = { x: w.x + 0.5, y: w.y - 0.5 };
        const c = { x: w.x + 0.5, y: w.y + 0.5 };
        if (!g.walk[Math.floor(a.y) * g.w + Math.floor(a.x)] || !g.walk[Math.floor(c.y) * g.w + Math.floor(c.x)]) continue;
        const path = findPath(g, a, c);
        if (path) for (let i = 1; i < path.length; i++) expect(crosses(m, path[i - 1]!, path[i]!)).toBe(false);
      }
    }
  });
});

describe('the rooms\' crew (owner M32: the office "very detailed", the rooms alive)', () => {
  it('someone works in every room but the dish room and the walk-in; the manager at the office desk; the game rolls the same dice as without them', async () => {
    const { createGame } = await import('../src/sim/game/create');
    const { stepGame } = await import('../src/sim/game/step');
    const { STEP_SEC } = await import('../src/data/sim');
    const map = mapForTier(TIERS.length - 1);
    const s = createGame(map, 3, { levels: { building: map.tier } });
    expect(s.crew.length).toBe(map.rooms.filter((r) => r.kind !== 'dish' && r.kind !== 'cold').length);
    expect(new Set(s.crew.map((c) => c.id)).size).toBe(s.crew.length);
    const office = s.crew.find((c) => map.rooms[c.room]!.kind === 'office')!;
    expect(office.look.outfit).toBe(1); // the suit
    // Each at a piece of their room's work.
    for (const c of s.crew) expect(s.props.find((p) => p.id === c.piece)?.kind).toBe(PropKind.RoomPiece);
    // Two minutes in: errands run, doors swing, and the game's own dice are where they would be without them.
    const bare = createGame(map, 3, { levels: { building: map.tier } });
    bare.crew = [];
    let opened = 0;
    let errands = 0;
    for (let i = 0; i < 120 / STEP_SEC; i++) {
      stepGame(s, STEP_SEC);
      stepGame(bare, STEP_SEC);
      opened = Math.max(opened, s.props.filter((p) => p.kind === PropKind.RoomDoor && p.active).length);
      errands = Math.max(errands, s.crew.filter((c) => c.phase !== 'work').length);
    }
    expect(opened).toBeGreaterThan(0);
    expect(errands).toBeGreaterThan(0);
    expect(s.rng).toEqual(bare.rng);
    expect(s.stats.served).toBe(bare.stats.served);
    // Nobody walks through a wall on the way.
    for (const c of s.crew) for (let i = 1; i < c.path.length; i++) expect(crosses(map, c.path[i - 1]!, c.path[i]!)).toBe(false);
  });
});
