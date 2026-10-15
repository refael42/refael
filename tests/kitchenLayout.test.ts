import { describe, expect, it } from 'vitest';
import { mapForTier } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { kitchenSave, PREP_LOOKS, restylePrep, swapKitchen } from '../src/sim/game/kitchenLayout';
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
    expect(swapKitchen(s, { kind: 'station', index: 0 }, { kind: 'station', index: s.stoves.length - 1 })).toBe(true);
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
    expect(swapKitchen(s, { kind: 'station', index: 2 }, { kind: 'prep', id: p.id })).toBe(true);
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
    swapKitchen(s, { kind: 'station', index: 0 }, { kind: 'station', index: 3 });
    restylePrep(s, preps(s)[0]!.id, 9);
    const before = kitchenSave(s);
    const loaded = parseSave(JSON.stringify(makeSave(s, Date.now())));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 94, Date.now());
    expect(kitchenSave(back)).toEqual(before);
    back.stoves[1]!.user = 12345;
    expect(swapKitchen(back, { kind: 'station', index: 1 }, { kind: 'station', index: 2 })).toBe(false);
  });
});
