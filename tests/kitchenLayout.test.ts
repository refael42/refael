import { describe, expect, it } from 'vitest';
import { mapForTier } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { queueCommand } from '../src/sim/game/commands';
import { createGame, rebuildGrid } from '../src/sim/game/create';
import { rerouteWalkers } from '../src/sim/game/purchase';
import { canMoveKitchen, kitchenPieces, kitchenSave, kitchenTargets, moveKitchen, PREP_LOOKS, restylePrep, swapKitchen } from '../src/sim/game/kitchenLayout';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type GameState } from '../src/sim/game/types';
import { findPath } from '../src/sim/grid';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { PropKind } from '../src/sim/types';

function play(s: GameState, seconds: number) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
  }
}

const preps = (s: GameState) => s.props.filter((p) => p.kind === PropKind.Prep);

describe('laying out the kitchen (owner M30: "the kitchen much more open to design, as you like")', () => {
  it('two stations trade places, each with its cook behind it, and the kitchen keeps cooking', () => {
    const s = createGame(mapForTier(1), 91, { roster: ['cook', 'cook', 'waiter', 'washer'] });
    const [a, b] = [s.stoves[0]!, s.stoves[s.stoves.length - 1]!];
    const [pa, pb] = [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
    expect(swapKitchen(s, { kind: 'station', index: 0 }, { kind: 'station', index: s.stoves.length - 1 }, rebuildGrid, rerouteWalkers)).toBe(true);
    expect({ x: a.x, y: a.y }).toEqual(pb);
    expect({ x: b.x, y: b.y }).toEqual(pa);
    expect(a.cook).toEqual({ x: pb.x - 1.05, y: pb.y });
    const served = s.stats.served;
    play(s, 240);
    expect(s.stats.served).toBeGreaterThan(served + 5);
  });

  it('a station and a prep table trade places; every cook can still reach their station', () => {
    const s = createGame(mapForTier(2), 92);
    const p = preps(s)[0]!;
    const at = { x: p.x, y: p.y };
    const sv = s.stoves[2]!;
    expect(swapKitchen(s, { kind: 'station', index: 2 }, { kind: 'prep', id: p.id }, rebuildGrid, rerouteWalkers)).toBe(true);
    expect({ x: sv.x, y: sv.y }).toEqual(at);
    const door = s.map.doors[0]!.inside;
    for (const st of s.stoves) expect(findPath(s.grid, door, st.cook), `${st.cook.x},${st.cook.y}`).not.toBeNull();
  });

  it('a prep table takes any look, prep or back of the house', () => {
    const s = createGame(mapForTier(1), 93);
    const p = preps(s)[0]!;
    const seen = new Set<number>();
    for (let i = 0; i < PREP_LOOKS; i++) {
      restylePrep(s, p.id);
      seen.add(p.variant);
    }
    expect(seen.size).toBe(PREP_LOOKS);
  });

  it('the save keeps the layout; a busy station waits', () => {
    const s = createGame(mapForTier(1), 94, { levels: { building: 1 } });
    swapKitchen(s, { kind: 'station', index: 0 }, { kind: 'station', index: 3 }, rebuildGrid, rerouteWalkers);
    restylePrep(s, preps(s)[0]!.id, 9);
    const before = kitchenSave(s);
    const loaded = parseSave(JSON.stringify(makeSave(s, Date.now())));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 94, Date.now());
    expect(kitchenSave(back)).toEqual(before);
    back.stoves[1]!.user = 12345;
    expect(swapKitchen(back, { kind: 'station', index: 1 }, { kind: 'station', index: 2 }, rebuildGrid, rerouteWalkers)).toBe(false);
  });

  it('every piece of kitchen furniture can move to a free tile; the kitchen keeps working (owner M47)', () => {
    for (const tier of [0, 1, 3, 6]) {
      const s = createGame(mapForTier(tier), 95 + tier, { roster: ['cook', 'cook', 'waiter', 'washer'] });
      const pieces = kitchenPieces(s);
      expect(pieces.some((p) => p.piece.kind === 'item')).toBe(true);
      // Every kind has somewhere to go: a station, a prep table (when there are any), a room's furniture.
      for (const kind of ['station', 'item'] as const) {
        const piece = pieces.find((p) => p.piece.kind === kind && kitchenTargets(s, p.piece).length > 0);
        expect(piece, `tier ${tier}: a ${kind} with somewhere to go`).toBeDefined();
      }
      const station = pieces.find((p) => p.piece.kind === 'station')!.piece;
      const to = kitchenTargets(s, station)[0]!;
      expect(moveKitchen(s, station, to, rebuildGrid, rerouteWalkers)).toBe(true);
      const sv = s.stoves[0]!;
      expect({ x: sv.x, y: sv.y }).toEqual(to);
      expect(sv.cook).toEqual({ x: to.x - 1.05, y: to.y });
      // The tile it left is open again, the new one taken; every cook still gets to their station.
      const door = s.map.doors[0]!.inside;
      for (const st of s.stoves) expect(findPath(s.grid, door, st.cook), `tier ${tier}: ${st.cook.x},${st.cook.y}`).not.toBeNull();
      for (const c of s.crew) expect(findPath(s.grid, door, c), `tier ${tier}: crew of room ${c.room}`).not.toBeNull();
    }
  });

  it('a move that would wall someone in, or go off the kitchen floor, is refused', () => {
    const s = createGame(mapForTier(3), 96);
    const station = { kind: 'station' as const, index: 0 };
    // Onto another cook's spot, onto the pass, out into the dining room.
    expect(canMoveKitchen(s, station, s.stoves[1]!.cook)).toBe(false);
    expect(canMoveKitchen(s, station, s.map.pass)).toBe(false);
    expect(canMoveKitchen(s, station, { x: s.map.kitchenX + 2.5, y: s.map.building.y0 + 3.5 })).toBe(false);
    // Nothing in the targets breaks anything.
    const targets = kitchenTargets(s, station);
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets.slice(0, 12)) expect(canMoveKitchen(s, station, t)).toBe(true);
  });

  it('a room\'s worker follows their work piece; the layout is saved and comes back', () => {
    const s = createGame(mapForTier(3), 97, { levels: { building: 3 } });
    const crew = s.crew.find((c) => c.piece >= 0)!;
    const piece = { kind: 'item' as const, id: crew.piece };
    const to = kitchenTargets(s, piece)[0]!;
    const prop = s.props.find((p) => p.id === crew.piece)!;
    const [dx, dy] = [crew.x - prop.x, crew.y - prop.y];
    expect(moveKitchen(s, piece, to, rebuildGrid, rerouteWalkers)).toBe(true);
    for (let i = 0; i < 5; i++) stepGame(s, STEP_SEC);
    if (crew.phase === 'work') {
      expect(crew.x).toBeCloseTo(to.x + dx, 5);
      expect(crew.y).toBeCloseTo(to.y + dy, 5);
    }
    const before = kitchenSave(s);
    const loaded = parseSave(JSON.stringify(makeSave(s, Date.now())));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 97, Date.now());
    expect(kitchenSave(back)).toEqual(before);
    expect(back.props.find((p) => p.id === crew.piece)).toMatchObject({ x: to.x, y: to.y });
  });
});
