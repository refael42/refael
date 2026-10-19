import { describe, expect, it } from 'vitest';
import { mapForTier } from '../src/data/maps';
import { createGame } from '../src/sim/game/create';
import { gameSnapshot } from '../src/sim/game/step';
import { F, P, STRIDE } from '../src/sim/snapshot';
import { EntityType, PropKind } from '../src/sim/types';

// Owner (M46 note): "it looks like the kitchen climbs onto the pass". The pass was one long piece
// sorted by its middle, so the stations behind its far end were drawn over it. Now it is one
// piece per tile, each sorted by its own tile.

describe('the pass in the painter order', () => {
  for (const tier of [0, 1, 3]) {
    it(`tier ${tier}: everything right behind the pass is drawn before the slab in front of it`, () => {
      const s = createGame(mapForTier(tier), 3);
      const snap = gameSnapshot(s, 1);
      const d = snap.data;
      const pass = s.map.pass;
      const n = Math.round(pass.d);
      const slabAt: number[] = [];
      for (let i = 0; i < snap.count; i++) {
        const o = i * STRIDE;
        if (d[o + F.type] === EntityType.Prop && d[o + P.kind] === PropKind.Pass) slabAt[d[o + P.style]!] = i;
      }
      expect(slabAt.filter((x) => x !== undefined)).toHaveLength(n);
      const y0 = pass.y - pass.d / 2;
      let checked = 0;
      for (let i = 0; i < snap.count; i++) {
        const o = i * STRIDE;
        if (d[o + F.type] !== EntityType.Prop || d[o + P.kind] === PropKind.Pass) continue;
        const x = d[o + F.x]!;
        const y = d[o + F.y]!;
        // On the tile column just behind the pass, along its length.
        if (x < pass.x - 0.5 && x > pass.x - 1.5 && y > y0 && y < y0 + pass.d) {
          const slab = Math.floor(y - y0);
          expect(i, `prop ${d[o + P.kind]} at ${x},${y}`).toBeLessThan(slabAt[slab]!);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(0);
    });
  }
});
