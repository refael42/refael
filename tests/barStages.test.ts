import { describe, expect, it } from 'vitest';
import { BAR_STAGES, barStage, BarPiece } from '../src/data/bar';
import { mapForTier } from '../src/data/maps';
import { computeMods } from '../src/sim/economy/upgrades';
import { createGame } from '../src/sim/game/create';
import { barProps } from '../src/sim/game/step';
import { PropKind } from '../src/sim/types';

describe('the bar\'s design levels (owner M30: "more design levels for the bar, to unlock")', () => {
  it('the bar counter\'s levels open a piece at a time, each bringing something', () => {
    expect(barStage(9)).toBe(0);
    expect(barStage(10)).toBe(1);
    expect(barStage(150)).toBe(BAR_STAGES.length);
    const none = computeMods({ barCounter: 9 });
    const all = computeMods({ barCounter: 150 });
    expect(all.drinkChance).toBeGreaterThan(none.drinkChance);
    expect(all.barGuests).toBeGreaterThan(none.barGuests);
    // The champagne tower at level 100: every drink a quarter more.
    expect(computeMods({ barCounter: 100 }).drinkPrice / computeMods({ barCounter: 99 }).drinkPrice).toBeCloseTo(1.25);
  });

  it('every building has a place for every piece, the counter ones on the counter', () => {
    for (let t = 0; t < 8; t++) {
      const bar = mapForTier(t).bar;
      expect(bar.pieces).toHaveLength(BAR_STAGES.length);
      const tops = bar.counters.map((c) => `${c.x},${Math.round(c.y - 0.5)}`);
      BAR_STAGES.forEach((b, i) => {
        const p = bar.pieces[i]!;
        if (p.top) expect(tops, `tier ${t} piece ${b.piece}`).toContain(`${p.x},${Math.round(p.y - 0.5)}`);
      });
    }
  });

  it('shows only the pieces opened so far', () => {
    const s = createGame(mapForTier(2), 81, { levels: { barCounter: 30 } });
    const pieces = barProps(s).filter((p) => p.kind === PropKind.BarPiece).map((p) => p.variant);
    expect(pieces).toEqual([BarPiece.GlassRack, BarPiece.Taps]);
  });
});
