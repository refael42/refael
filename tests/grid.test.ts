import { describe, expect, it } from 'vitest';
import { CHAIR_OFFSET, mapForTier, STAND_MAP } from '../src/data/maps';
import { buildGrid, findPath, isWalkable } from '../src/sim/grid';

const grid = buildGrid(STAND_MAP);

function pathLength(from: { x: number; y: number }, path: { x: number; y: number }[]) {
  let len = 0;
  let prev = from;
  for (const p of path) {
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

describe('walkability grid', () => {
  it('blocks furniture and the outside lawn, opens floors and the sidewalk', () => {
    expect(isWalkable(grid, STAND_MAP.tables[0]!)).toBe(false);
    expect(isWalkable(grid, STAND_MAP.stoves[0]!.stove)).toBe(false);
    expect(isWalkable(grid, { x: 10.5, y: 10.5 })).toBe(true);
    expect(isWalkable(grid, { x: 8.5, y: 12.5 })).toBe(true);
    expect(isWalkable(grid, { x: 8.5, y: 15.5 })).toBe(false);
  });
});

describe('A* pathfinding', () => {
  it('enters the building only through the door', () => {
    const from = STAND_MAP.spawns[0]!;
    const to = STAND_MAP.queue[0]!;
    const path = findPath(grid, from, to)!;
    expect(path).not.toBeNull();
    expect(path.at(-1)).toEqual(to);
    // A wall-ignoring straight line would be ~13 tiles; going around via the door is longer.
    expect(pathLength(from, path)).toBeGreaterThan(Math.hypot(to.x - from.x, to.y - from.y) - 0.01);
  });

  it('can walk onto a chair (a blocked goal) to sit down', () => {
    const t = STAND_MAP.tables[2]!;
    const chair = { x: t.x + CHAIR_OFFSET.x, y: t.y + CHAIR_OFFSET.y };
    const path = findPath(grid, STAND_MAP.queue[0]!, chair)!;
    expect(path.at(-1)).toEqual(chair);
  });

  it('never routes through a table', () => {
    const path = findPath(grid, { x: 7.5, y: 6.5 }, { x: 10.5, y: 3.5 })!;
    let prev = { x: 7.5, y: 6.5 };
    for (const p of path) {
      for (let i = 0; i <= 20; i++) {
        const x = prev.x + ((p.x - prev.x) * i) / 20;
        const y = prev.y + ((p.y - prev.y) * i) / 20;
        const goal = Math.floor(x) === 10 && Math.floor(y) === 3;
        if (!goal) expect(isWalkable(grid, { x, y })).toBe(true);
      }
      prev = p;
    }
  });

  it('returns null when the goal is unreachable', () => {
    expect(findPath(grid, { x: 8.5, y: 12.5 }, { x: 8.5, y: 15.5 })).toBeNull();
  });
});

describe('path cache', () => {
  it('hands each caller its own copy (walking eats the path) and the same way every time', () => {
    const map = mapForTier(4);
    const grid = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length);
    const from = map.doors[0]!.inside;
    const to = map.stoves[0]!.cook;
    const a = findPath(grid, from, to)!;
    const copy = a.map((p) => ({ ...p }));
    a.length = 0;
    const b = findPath(grid, from, to)!;
    expect(b).toEqual(copy);
    b[0]!.x = -99;
    expect(findPath(grid, from, to)).toEqual(copy);
  });
});
