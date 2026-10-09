import { describe, expect, it } from 'vitest';
import { buyNow } from './helpers';
import { CONSTRUCTION, TIERS } from '../src/data/buildings';
import { DECOR } from '../src/data/decor';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { footprint, serveSpot, sideTiles } from '../src/data/tables';
import { STEP_SEC } from '../src/data/sim';
import { big } from '../src/sim/big';
import { canBuy, upgradeDef } from '../src/sim/economy/upgrades';
import { autoTile, buildableTiles, canPlaceAt, keepsRoomOpenSlowly } from '../src/sim/game/build';
import { createGame } from '../src/sim/game/create';
import { queueCommand } from '../src/sim/game/commands';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import type { GameState } from '../src/sim/game/types';
import { canReach, gridWith, isWalkable, reachableFrom } from '../src/sim/grid';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { PropKind } from '../src/sim/types';

const rich = (s: GameState) => {
  s.coins = big('1e30');
  return s;
};

/** Everything that must stay reachable, with every table's chairs all in place. */
function allReachable(s: GameState): boolean {
  const map = s.map;
  const g = gridWith(map, map.stoves.length, s.tables.flatMap((t) => footprint(t.style, t.x, t.y)), s.placed);
  const reach = reachableFrom(g, map.doors[0]!.inside);
  const points = [...map.queue, ...map.waiterIdle, ...map.cleanerIdle, map.hostSpot, map.managerSpot, ...map.pickupSpots, map.washerSpot, map.dirtyDrop];
  for (const t of s.tables) points.push(serveSpot(t.x, t.y), ...sideTiles(t.style, t.x, t.y, -1), ...sideTiles(t.style, t.x, t.y, 1));
  // Staff stand on the serving spots: those stay open floor.
  return points.every((p) => canReach(g, reach, p)) && s.tables.every((t) => isWalkable(g, serveSpot(t.x, t.y)));
}

describe('build mode', () => {
  it('offers free dining-room tiles only, never a table, its chairs or serving spot, the line or the door', () => {
    TIERS.forEach((_, tier) => {
      const s = createGame(mapForTier(tier), 1, { levels: { building: tier, tables: 4, seats: 2 } });
      const tiles = buildableTiles(s);
      expect(tiles.length, `tier ${tier}`).toBeGreaterThan(4);
      const key = (p: { x: number; y: number }) => `${Math.floor(p.x)},${Math.floor(p.y)}`;
      const tables = s.tables.flatMap((t) => [...footprint(t.style, t.x, t.y), serveSpot(t.x, t.y)]);
      const banned = new Set([...tables, ...s.map.queue, s.map.doors[0]!.inside].map(key));
      for (const t of tiles) {
        expect(banned.has(key(t))).toBe(false);
        expect(t.x).toBeGreaterThanOrEqual(6);
      }
    });
  });

  it('the quick cut-tree answer agrees with a full search on every tile of every building', () => {
    TIERS.forEach((_, tier) => {
      const s = rich(createGame(mapForTier(tier), 7, { levels: { building: tier } }));
      // An empty room, then one half full of decor (a room of narrow ways is where they could differ).
      for (const round of [0, 1]) {
        const b = s.map.building;
        for (let y = b.y0; y < b.y1; y++) {
          for (let x = b.x0; x < b.x1; x++) expect(canPlaceAt(s, x + 0.5, y + 0.5), `tier ${tier} round ${round} tile ${x},${y}`).toBe(keepsRoomOpenSlowly(s, x + 0.5, y + 0.5));
        }
        for (let i = 0; i < 40 && round === 0; i++) {
          const at = autoTile(s);
          if (!at) break;
          s.levels = { ...s.levels, place_flowers: 0 };
          buyUpgrade(s, 'place_flowers', at);
        }
      }
    });
    // The full search is the slow one, and it runs on every tile of every building.
  }, 60000);

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
      for (let i = 0; i < 2000; i++) {
        const at = autoTile(s);
        if (!at) break;
        // Placed straight in: the per-kind limits do not matter for this check.
        s.levels = { ...s.levels, place_flowers: 0 };
        expect(buyUpgrade(s, 'place_flowers', at)).toBe(true);
      }
      expect(autoTile(s)).toBeNull();
      expect(allReachable(s), `tier ${tier}`).toBe(true);
    });
  }, 20000);

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
    buyNow(s, 'building');
    for (let i = Math.round((CONSTRUCTION.seconds + 0.2) / STEP_SEC); i > 0; i--) stepGame(s, STEP_SEC);
    expect(s.map.tier).toBe(1);
    expect(s.placed).toEqual([where]);
  });
});

describe('moving decor', () => {
  it('carries a placed piece to another free tile; the old one is free again', () => {
    const s = rich(createGame(STAND_MAP, 30));
    const [a, b] = buildableTiles(s);
    buyUpgrade(s, 'place_flowers', a);
    queueCommand(s, { type: 'move', from: a!, to: b! });
    stepGame(s, STEP_SEC);
    expect(s.placed).toEqual([{ item: 'flowers', x: b!.x, y: b!.y }]);
    expect(canPlaceAt(s, a!.x, a!.y)).toBe(true);
    expect(canPlaceAt(s, b!.x, b!.y)).toBe(false);
    expect(s.props.filter((p) => p.kind === PropKind.Flowers).map((p) => [p.x, p.y])).toEqual([[b!.x, b!.y]]);
  });

  it('a tile that does not work leaves the piece where it was', () => {
    const s = rich(createGame(STAND_MAP, 31));
    const a = buildableTiles(s)[0]!;
    buyUpgrade(s, 'place_flowers', a);
    const table = STAND_MAP.tables[0]!;
    queueCommand(s, { type: 'move', from: a, to: table });
    stepGame(s, STEP_SEC);
    expect(s.placed).toEqual([{ item: 'flowers', x: a.x, y: a.y }]);
  });
});
