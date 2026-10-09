import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/data/buildings';
import { mapForTier, SAVE_SHIFT, STAND_MAP, WORLD_SHIFT } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { createGame } from '../src/sim/game/create';
import { stepGame } from '../src/sim/game/step';
import { makeSave, parseSave } from '../src/sim/save';
import { PropKind as K } from '../src/sim/types';

const floorAt = (x: number, y: number) => [...STAND_MAP.areas].reverse().find((a) => x >= a.x0 && x < a.x1 && y >= a.y0 && y < a.y1)?.floor;

describe('the world round the restaurant (owner: bigger, prettier past the road)', () => {
  it('across the road: a far sidewalk, then a park with a plaza, a fountain, benches, trees, stalls and parked cars', () => {
    const road = STAND_MAP.areas.find((a) => a.floor === 'road')!;
    expect(floorAt(5, road.y1 + 0.5)).toBe('sidewalk');
    expect(floorAt(5, road.y1 + 3)).not.toBe('road');
    const kinds = new Set(STAND_MAP.decor.map((f) => f.kind));
    for (const k of [K.ParkFountain, K.Bench, K.Planter, K.Stall, K.Car, K.Slide]) expect(kinds.has(k)).toBe(true);
    // Parked cars stand on the road, the rest of the park beyond it, all on the map.
    for (const f of STAND_MAP.decor) {
      expect(f.x > 0 && f.x < STAND_MAP.width && f.y > 0 && f.y < STAND_MAP.height, `${f.kind} ${f.x},${f.y}`).toBe(true);
      if (f.kind === K.Car) expect(floorAt(f.x, f.y)).toBe('road');
      if (f.kind === K.Bench || f.kind === K.ParkFountain) expect(f.y).toBeGreaterThan(road.y1);
    }
    // The same park for every building.
    const park = (t: number) => mapForTier(t).decor.filter((f) => f.y > road.y1 && f.kind !== K.Lamp);
    for (let t = 1; t < TIERS.length; t++) expect(park(t)).toEqual(park(0));
  });

  it('more land round the site: trees behind it and down both sides', () => {
    const last = mapForTier(TIERS.length - 1).building;
    expect(last.x0).toBeGreaterThanOrEqual(6);
    expect(STAND_MAP.width - last.x1).toBeGreaterThanOrEqual(6);
    const trees = STAND_MAP.backdrop.filter((f) => f.kind === K.Tree);
    expect(trees.some((f) => f.x < last.x0 && f.y > last.y0)).toBe(true);
    expect(trees.some((f) => f.x > last.x1 && f.y > last.y0)).toBe(true);
    expect(trees.filter((f) => f.y < last.y0).length).toBeGreaterThan(20);
  });

  it('people stroll the far sidewalk too, and stay on it', () => {
    const s = createGame(STAND_MAP, 1);
    const road = STAND_MAP.areas.find((a) => a.floor === 'road')!;
    for (let i = 0; i < 90 / STEP_SEC; i++) {
      stepGame(s, STEP_SEC);
      for (const w of s.walkers) if (w.mode === 'far') expect(w.y).toBeGreaterThan(road.y1 - 0.05);
    }
    expect(s.walkers.filter((w) => w.mode === 'far').length).toBeGreaterThan(2);
  });

  it('an older save keeps its decor where it was in the room: v9 moves by the new land, v7 by everything since', () => {
    expect(SAVE_SHIFT.v8.x + SAVE_SHIFT.v10.x + SAVE_SHIFT.v11.x + SAVE_SHIFT.v14.x).toBe(WORLD_SHIFT.x);
    expect(SAVE_SHIFT.v8.y + SAVE_SHIFT.v10.y + SAVE_SHIFT.v11.y + SAVE_SHIFT.v14.y).toBe(WORLD_SHIFT.y);
    // v14: the big kitchen (M29) pushed the dining room right.
    expect(SAVE_SHIFT.v14.x).toBeGreaterThan(0);
    // v11: the buildings grow north too, so the site moved back (owner request).
    expect(SAVE_SHIFT.v11.y).toBeGreaterThan(0);
    const s = createGame(mapForTier(1), 1, { levels: { building: 1, place_flowers: 1 } });
    const raw = makeSave(s, 1000) as unknown as Record<string, unknown>;
    const now = (raw.placed as { x: number; y: number }[])[0]!;
    const v13 = { ...raw, version: 13, placed: [{ item: 'flowers', x: now.x - SAVE_SHIFT.v14.x, y: now.y - SAVE_SHIFT.v14.y }] };
    const d = parseSave(JSON.stringify(v13));
    expect(d.ok && d.save.placed[0]).toMatchObject({ x: now.x, y: now.y });
    const v10 = { ...raw, version: 10, placed: [{ item: 'flowers', x: now.x - SAVE_SHIFT.v11.x - SAVE_SHIFT.v14.x, y: now.y - SAVE_SHIFT.v11.y - SAVE_SHIFT.v14.y }] };
    const c = parseSave(JSON.stringify(v10));
    expect(c.ok && c.save.placed[0]).toMatchObject({ x: now.x, y: now.y });
    const v9 = { ...raw, version: 9, placed: [{ item: 'flowers', x: now.x - SAVE_SHIFT.v10.x - SAVE_SHIFT.v11.x - SAVE_SHIFT.v14.x, y: now.y - SAVE_SHIFT.v10.y - SAVE_SHIFT.v11.y - SAVE_SHIFT.v14.y }] };
    const a = parseSave(JSON.stringify(v9));
    expect(a.ok && a.save.placed[0]).toMatchObject({ x: now.x, y: now.y });
    const v7 = { ...raw, version: 7, placed: [{ item: 'flowers', x: now.x - WORLD_SHIFT.x, y: now.y - WORLD_SHIFT.y }] };
    delete (v7 as Record<string, unknown>).festival;
    const b = parseSave(JSON.stringify(v7));
    expect(b.ok && b.save.placed[0]).toMatchObject({ x: now.x, y: now.y });
  });
});
