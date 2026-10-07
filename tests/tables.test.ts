import { describe, expect, it } from 'vitest';
import { buyNow } from './helpers';
import { CONSTRUCTION, TIERS } from '../src/data/buildings';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { footprint, fullSeats, serveSpot, sideTiles, TABLE_STYLES, type TableStyle } from '../src/data/tables';
import { big, fromSave } from '../src/sim/big';
import { costOf, upgradeDef } from '../src/sim/economy/upgrades';
import { canPlaceTable, nextTableSpot, tableAnchors } from '../src/sim/game/build';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import { TableState, type GameState } from '../src/sim/game/types';
import { canReach, gridWith, isWalkable, reachableFrom } from '../src/sim/grid';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { PropKind } from '../src/sim/types';

const rich = (s: GameState) => {
  s.coins = big('1e30');
  return s;
};

/** Every table's chairs and serving spot, and every staff spot, can be reached from the door. */
function allReachable(s: GameState): boolean {
  const map = s.map;
  const g = gridWith(map, map.stoves.length, s.tables.flatMap((t) => footprint(t.style, t.x, t.y)), s.placed);
  const reach = reachableFrom(g, map.doors[0]!.inside);
  const points = [...map.waiterIdle, ...map.cleanerIdle, map.hostSpot, map.managerSpot, ...map.pickupSpots, map.washerSpot, map.dirtyDrop];
  for (const t of s.tables) points.push(serveSpot(t.x, t.y), ...sideTiles(t.style, t.x, t.y, -1), ...sideTiles(t.style, t.x, t.y, 1));
  return points.every((p) => canReach(g, reach, p)) && s.tables.every((t) => isWalkable(g, serveSpot(t.x, t.y)));
}

const step = (s: GameState, seconds: number) => {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) stepGame(s, STEP_SEC);
};

describe('table styles (owner: "a variety of tables, placed wherever you want")', () => {
  it('a room the game lays out mixes the open styles instead of rows of one table', () => {
    const s = createGame(mapForTier(2), 1, { levels: { building: 2, tables: 12 } });
    const styles = new Set(s.tables.map((t) => t.style));
    expect(styles.size).toBeGreaterThanOrEqual(3);
    // The first table of a new game is the classic round one.
    expect(createGame(STAND_MAP, 1).tables[0]!.style).toBe('round');
    // Booths wait for the bistro.
    const diner = createGame(STAND_MAP, 1, { levels: { tables: 6 } });
    expect(diner.tables.some((t) => t.style === 'booth')).toBe(false);
  });

  it('every style fits somewhere in the first diner, and placing one takes the coins and the spot', () => {
    for (const style of TABLE_STYLES.filter((st) => st !== 'booth')) {
      const s = createGame(STAND_MAP, 2);
      s.coins = big(1e9);
      const spots = tableAnchors(s, style);
      expect(spots.length, style).toBeGreaterThan(0);
      const at = spots[spots.length - 1]!;
      const coins = s.coins;
      expect(buyUpgrade(s, 'tables', at, 1, style)).toBe(true);
      const t = s.tables[s.tables.length - 1]!;
      expect([t.x, t.y, t.style]).toEqual([at.x, at.y, style]);
      expect(s.coins.lt(coins)).toBe(true);
      expect(canPlaceTable(s, style, at.x, at.y)).toBe(false);
      expect(allReachable(s)).toBe(true);
    }
  });

  it('a long table is two tiles deep and seats six once it is a family table; big groups come for it', () => {
    const s = rich(createGame(mapForTier(2), 3, { levels: { building: 2 } }));
    const at = tableAnchors(s, 'long')[0]!;
    expect(buyUpgrade(s, 'tables', at, 1, 'long')).toBe(true);
    const t = s.tables[s.tables.length - 1]!;
    expect(t.style).toBe('long');
    // Family tables go to the first tables for two: only this one has its chairs for two.
    for (const o of s.tables) if (o !== t) o.state = TableState.Occupied;
    expect(t.backId).toBeGreaterThan(0);
    while (t.seats < 2) buyNow(s, 'seats');
    while (t.seats === 2 && buyNow(s, 'family')) stepGame(s, STEP_SEC);
    expect(t.seats).toBe(fullSeats('long'));
    expect(t.seats).toBe(6);
    expect(s.props.filter((p) => t.chairs.includes(p.id) && p.kind === PropKind.Chair)).toHaveLength(9);
    // The other tables are taken: whoever comes in groups of five or six can only sit here.
    let biggest = 0;
    for (let i = 0; i < 4000 && biggest < 5; i++) {
      stepGame(s, STEP_SEC);
      for (const c of s.customers) biggest = Math.max(biggest, c.partySize);
    }
    expect(biggest).toBeGreaterThanOrEqual(5);
  });

  it('a booth has a sofa on each side instead of chairs', () => {
    const s = rich(createGame(mapForTier(1), 4, { levels: { building: 1, seats: 1 } }));
    const at = tableAnchors(s, 'booth')[0]!;
    expect(buyUpgrade(s, 'tables', at, 1, 'booth')).toBe(true);
    const t = s.tables[s.tables.length - 1]!;
    while (t.seats < 2) buyNow(s, 'seats');
    expect(t.seats).toBe(2);
    expect(s.props.filter((p) => t.chairs.includes(p.id)).every((p) => p.kind === PropKind.Booth)).toBe(true);
    expect(t.chairs).toHaveLength(3);
  });

  it('a free table moves and changes style in build mode; one with guests stays', () => {
    const s = rich(createGame(STAND_MAP, 5, { levels: { tables: 2 } }));
    const t = s.tables[1]!;
    const to = tableAnchors(s, 'square', 1).find((p) => p.x !== t.x || p.y !== t.y)!;
    // Nobody comes in meanwhile.
    s.nextArrival = Infinity;
    queueCommand(s, { type: 'moveTable', table: 1, to, style: 'square' });
    stepGame(s, STEP_SEC);
    expect([t.x, t.y, t.style]).toEqual([to.x, to.y, 'square']);
    // Just a new look, on the same spot.
    queueCommand(s, { type: 'moveTable', table: 1, to, style: 'long' });
    stepGame(s, STEP_SEC);
    const longOk = t.style === 'long';
    expect(longOk || !canPlaceTable(s, 'long', to.x, to.y, 1)).toBe(true);
    t.state = TableState.Occupied;
    const before = [t.x, t.y, t.style];
    const away = tableAnchors(s, 'round', 1).find((p) => p.x !== t.x || p.y !== t.y)!;
    queueCommand(s, { type: 'moveTable', table: 1, to: away, style: 'round' });
    stepGame(s, STEP_SEC);
    expect([t.x, t.y, t.style]).toEqual(before);
  });

  it('no room left: the table is not sold and the coins stay', () => {
    const s = rich(createGame(STAND_MAP, 6));
    // Fill the floor with long tables wherever they fit.
    for (let i = 0; i < 40; i++) {
      const spots = tableAnchors(s, 'long');
      if (spots.length === 0 || s.tables.length >= s.map.tables.length) break;
      s.levels = { ...s.levels, tables: 0 };
      buyUpgrade(s, 'tables', spots[0], 1, 'long');
    }
    expect(allReachable(s)).toBe(true);
    if (nextTableSpot(s) === null) {
      const coins = s.coins;
      s.levels = { ...s.levels, tables: 0 };
      expect(buyUpgrade(s, 'tables')).toBe(false);
      expect(s.coins.eq(coins)).toBe(true);
    }
  });

  it('random layouts never block a chair, a serving spot or a work spot', () => {
    TIERS.forEach((_, tier) => {
      const s = rich(createGame(mapForTier(tier), 7 + tier, { levels: { building: tier } }));
      let k = 0;
      for (let i = 0; i < 12 && s.tables.length < s.map.tables.length; i++) {
        const style: TableStyle = (['long', 'round', 'square', 'booth'] as const)[i % 4]!;
        const spots = tableAnchors(s, style);
        if (spots.length === 0) continue;
        k = (k * 7 + 13) % spots.length;
        s.levels = { ...s.levels, tables: 0 };
        expect(buyUpgrade(s, 'tables', spots[k], 1, style)).toBe(true);
      }
      expect(allReachable(s), `tier ${tier}`).toBe(true);
      // ...and the tables bought without a spot still find one (or are refused, never forced in).
      const spot = nextTableSpot(s);
      if (spot) expect(canPlaceTable(s, spot.style, spot.x, spot.y)).toBe(true);
    });
  });

  it('the quick check for many spots at once agrees with a full search', () => {
    for (const tier of [0, 3, TIERS.length - 1]) {
      const s = createGame(mapForTier(tier), 2, { levels: { building: tier, tables: tier * 3 } });
      s.coins = big(1e12);
      for (let round = 0; round < 2; round++) {
        for (const style of TABLE_STYLES) {
          const fast = new Set(tableAnchors(s, style).map((p) => `${p.x},${p.y}`));
          const b = s.map.building;
          for (let y = b.y0; y < b.y1; y++) {
            for (let x = b.x0; x < b.x1; x++) expect(fast.has(`${x + 0.5},${y + 0.5}`), `tier ${tier} ${style} ${x},${y}`).toBe(canPlaceTable(s, style, x + 0.5, y + 0.5));
          }
        }
        for (let k = 0; k < 6; k++) {
          const style = TABLE_STYLES[(k + round) % 3]!;
          const a = tableAnchors(s, style);
          s.levels = { ...s.levels, tables: 0 };
          if (a.length) buyUpgrade(s, 'tables', a[(k * 7 + round * 5) % a.length], 1, style);
        }
      }
    }
  }, 60000);

  it('tables are saved where they stand, in their styles, and stay there when the building grows', () => {
    const s = rich(createGame(STAND_MAP, 8));
    const at = tableAnchors(s, 'long')[0]!;
    buyUpgrade(s, 'tables', at, 1, 'long');
    const layout = s.tables.map((t) => [t.x, t.y, t.style]);
    const loaded = parseSave(JSON.stringify(makeSave(s, 0)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 1);
    expect(back.tables.map((t) => [t.x, t.y, t.style])).toEqual(layout);
    buyNow(s, 'building');
    step(s, CONSTRUCTION.seconds + 0.2);
    expect(s.map.tier).toBe(1);
    expect(s.tables.map((t) => [t.x, t.y, t.style])).toEqual(layout);
  });

  it('an old save with more tables than the new layout holds gets the extra ones paid back', () => {
    const s = createGame(mapForTier(2), 10, { levels: { building: 2 } });
    const old = JSON.parse(JSON.stringify(makeSave(s, 0)));
    const cap = s.map.tables.length - s.map.startTables;
    old.levels.tables = cap + 3;
    delete old.tables;
    old.version = 11;
    const loaded = parseSave(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.save.levels.tables).toBe(cap);
    const def = upgradeDef('tables');
    const refund = [0, 1, 2].reduce((sum, k) => sum.add(costOf(def, cap + k)), s.coins);
    expect(fromSave(loaded.save.coins).eq(refund)).toBe(true);
  });

  it('a save from before table styles gets the map layout, in mixed styles', () => {
    const s = createGame(mapForTier(1), 9, { levels: { building: 1, tables: 5 } });
    const old = JSON.parse(JSON.stringify(makeSave(s, 0)));
    delete old.tables;
    old.version = 11;
    const loaded = parseSave(JSON.stringify(old));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 1);
    expect(back.tables.map((t) => [t.x, t.y])).toEqual(s.map.tables.slice(0, s.tables.length).map((p) => [p.x, p.y]));
    expect(new Set(back.tables.map((t) => t.style)).size).toBeGreaterThan(1);
  });
});
