import { describe, expect, it } from 'vitest';
import { CONSTRUCTION, TIERS } from '../src/data/buildings';
import { DECOR } from '../src/data/decor';
import { mapForTier, SEAT_OFFSETS, SERVE_OFFSET, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { canBuy, upgradeDef } from '../src/sim/economy/upgrades';
import { autoTile, buildableTiles, canPlaceAt } from '../src/sim/game/build';
import { createGame } from '../src/sim/game/create';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import type { GameState } from '../src/sim/game/types';
import { buildGrid, canReach, reachableFrom } from '../src/sim/grid';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { PropKind } from '../src/sim/types';

const rich = (s: GameState) => {
  s.coins = big('1e30');
  return s;
};

/** Everything that must stay reachable, with every table and second chair in place. */
function allReachable(s: GameState): boolean {
  const map = s.map;
  const g = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length, s.placed);
  const reach = reachableFrom(g, map.doors[0]!.inside);
  const points = [...map.queue, ...map.waiterIdle, ...map.cleanerIdle, map.hostSpot, ...map.pickupSpots, map.washerSpot, map.dirtyDrop];
  for (const t of map.tables) points.push({ x: t.x + SERVE_OFFSET.x, y: t.y + SERVE_OFFSET.y }, ...SEAT_OFFSETS.map((o) => ({ x: t.x + o.x, y: t.y + o.y })));
  return points.every((p) => canReach(g, reach, p));
}

describe('build mode', () => {
  it('offers free dining-room tiles only, never a table spot, the line or the door', () => {
    TIERS.forEach((_, tier) => {
      const s = createGame(mapForTier(tier), 1, { levels: { building: tier } });
      const tiles = buildableTiles(s);
      expect(tiles.length, `tier ${tier}`).toBeGreaterThan(4);
      const key = (p: { x: number; y: number }) => `${Math.floor(p.x)},${Math.floor(p.y)}`;
      const banned = new Set([...s.map.tables, ...s.map.queue, s.map.doors[0]!.inside].map(key));
      for (const t of tiles) {
        expect(banned.has(key(t))).toBe(false);
        expect(t.x).toBeGreaterThanOrEqual(6);
      }
    });
  });

  it('places decor on the chosen tile, and that tile is taken afterwards', () => {
    const s = rich(createGame(STAND_MAP, 2));
    const tile = buildableTiles(s)[0]!;
    expect(buyUpgrade(s, 'place_flowers', tile)).toBe(true);
    expect(s.levels.place_flowers).toBe(1);
    expect(s.placed).toEqual([{ item: 'flowers', x: tile.x, y: tile.y }]);
    expect(s.props.some((p) => p.kind === PropKind.Flowers && p.x === tile.x && p.y === tile.y)).toBe(true);
    expect(canPlaceAt(s, tile.x, tile.y)).toBe(false);
    expect(buyUpgrade(s, 'place_lamp', tile)).toBe(false);
    // A table spot is never offered.
    const spot = s.map.tables[0]!;
    expect(buyUpgrade(s, 'place_lamp', spot)).toBe(false);
  });

  it('even a room packed with decor never blocks a chair, a table or a work spot', () => {
    TIERS.forEach((_, tier) => {
      const s = rich(createGame(mapForTier(tier), 3, { levels: { building: tier } }));
      for (let i = 0; i < 200; i++) {
        const at = autoTile(s);
        if (!at) break;
        // Placed straight in: the per-kind limits do not matter for this check.
        s.levels = { ...s.levels, place_flowers: 0 };
        expect(buyUpgrade(s, 'place_flowers', at)).toBe(true);
      }
      expect(autoTile(s)).toBeNull();
      expect(allReachable(s), `tier ${tier}`).toBe(true);
    });
  });

  it('each decor track needs one placed first, and placing one helps right away', () => {
    const s = rich(createGame(STAND_MAP, 4));
    expect(canBuy(upgradeDef('flowers'), s.levels, s.coins, s.map)).toBe(false);
    const before = s.mods.arrivals;
    buyUpgrade(s, 'place_flowers');
    expect(s.mods.arrivals).toBeGreaterThan(before);
    expect(canBuy(upgradeDef('flowers'), s.levels, s.coins, s.map)).toBe(true);
    // Aquariums and statues wait for bigger buildings.
    expect(canBuy(upgradeDef('place_aquarium'), s.levels, s.coins, s.map)).toBe(false);
    expect(DECOR.every((d) => upgradeDef(`place_${d.id}`).build)).toBe(true);
  });

  it('decor is saved where it stands and comes back there', () => {
    const s = rich(createGame(STAND_MAP, 5));
    const tiles = buildableTiles(s);
    buyUpgrade(s, 'place_flowers', tiles[2]);
    buyUpgrade(s, 'place_lamp', tiles[5]);
    const loaded = parseSave(JSON.stringify(makeSave(s, 0)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 1);
    expect(back.placed).toEqual(s.placed);
    expect(back.props.filter((p) => p.kind === PropKind.Flowers || p.kind === PropKind.FloorLamp)).toHaveLength(2);
  });

  it('a spot that is no longer free moves the piece to the nearest free tile', () => {
    const s = rich(createGame(STAND_MAP, 6, { levels: { place_flowers: 1 }, placed: [{ item: 'flowers', x: STAND_MAP.tables[0]!.x, y: STAND_MAP.tables[0]!.y }] }));
    expect(s.placed).toHaveLength(1);
    expect(s.placed[0]!.x === STAND_MAP.tables[0]!.x && s.placed[0]!.y === STAND_MAP.tables[0]!.y).toBe(false);
  });

  it('decor stays put when the building grows', () => {
    const s = rich(createGame(STAND_MAP, 7));
    buyUpgrade(s, 'place_flowers', buildableTiles(s)[0]);
    const where = { ...s.placed[0]! };
    buyUpgrade(s, 'building');
    for (let i = Math.round((CONSTRUCTION.seconds + 0.2) / STEP_SEC); i > 0; i--) stepGame(s, STEP_SEC);
    expect(s.map.tier).toBe(1);
    expect(s.placed).toEqual([where]);
  });
});
