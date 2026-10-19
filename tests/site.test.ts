import { describe, expect, it } from 'vitest';
import { mapForTier } from '../src/data/maps';
import { siteOf } from '../src/sim/game/construction';
import { createGame } from '../src/sim/game/create';
import { scaffolding } from '../src/sim/game/step';
import { PropKind, SiteItem } from '../src/sim/types';

// Owner: "make the building areas look better and more professional". Every new building gets a
// real site: several grow only backward, and their site used to be an empty line.

describe('the building site', () => {
  for (let tier = 0; tier < 8; tier++) {
    it(`building ${tier} -> ${tier + 1}: a site with scaffolding and the crane (or a makeover)`, () => {
      const s = createGame(mapForTier(tier), 1);
      const { site, side } = siteOf(s, tier + 1);
      expect(site.x1 - site.x0).toBeGreaterThan(0);
      expect(site.y1 - site.y0).toBeGreaterThan(0);
      const props = scaffolding({ tier: tier + 1, start: 0, end: 6, nextDust: 0, site, side }, s.map.width);
      expect(props.filter((p) => p.kind === PropKind.Scaffold).length).toBeGreaterThan(3);
      if (side !== 'inside') expect(props.some((p) => p.kind === PropKind.SiteItem && p.variant === SiteItem.Crane)).toBe(true);
      // Everything stands on the map, and ids never clash.
      for (const p of props) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(s.map.width);
      }
      expect(new Set(props.map((p) => p.id)).size).toBe(props.length);
    });
  }
});
