import { describe, expect, it } from 'vitest';

import { AMENITY_KINDS, AMENITY_LEVEL, T1_AMENITIES, T3_AMENITIES } from '../src/data/amenities';
import { T1, T3, T3_HUB } from '../src/data/terminals';
import { upgradeDef } from '../src/data/upgrades';
import { VERSIONS } from '../src/data/versions';
import { DICTS } from '../src/i18n/strings';
import { layoutOf } from '../src/sim/game/layout';

describe('passenger services in the terminals', () => {
  it('six levels, each with its services, named in both languages', () => {
    const def = upgradeDef('amenities')!;
    expect(def.maxLevel).toBe(6);
    expect(def.category).toBe('comfort');
    expect(VERSIONS.amenities).toHaveLength(6);
    for (const k of AMENITY_KINDS) expect(AMENITY_LEVEL[k]).toBeGreaterThanOrEqual(1);
    for (const lang of ['en', 'he'] as const) {
      const d = DICTS[lang] as Record<string, string>;
      expect(d['upg.amenities'] && d['upgDesc.amenities']).toBeTruthy();
      for (let v = 1; v <= 6; v++) expect(d[`ver.amenities.${v}`], `${lang} ${v}`).toBeTruthy();
    }
  });

  it('every service stands inside its terminal, clear of the furniture and of where people queue and work', () => {
    const check = (spots: typeof T3_AMENITIES, b: typeof T3, stations: ReturnType<typeof layoutOf>['terminal']) => {
      for (const a of spots) {
        const [x, y] = a.at;
        expect(x, a.kind).toBeGreaterThan(b.box[0]);
        expect(x, a.kind).toBeLessThan(b.box[2] - 0.3);
        expect(y, a.kind).toBeGreaterThan(b.box[1]);
        expect(y, a.kind).toBeLessThan(b.box[3] - 0.2);
        // (a footprint's middle, about half a tile in)
        const cx = x + (a.faceY ? 0.2 : 0.3);
        const cy = y + (a.faceY ? 0.3 : 0.2);
        for (const f of b.furniture) {
          if (f.kind.startsWith('sign') || f.kind === 'board' || f.kind === 'baggageRoom') continue;
          expect(Math.hypot(cx - f.at[0], cy - f.at[1]), `${a.kind} near ${f.kind}`).toBeGreaterThan(0.3);
        }
        const points = [...stations.counters, ...stations.lanes, ...stations.checkinQueue, ...stations.securityQueue, ...(stations.carousels ?? [stations.claim]), ...(stations.passport?.booths ?? []), ...(stations.passport?.queue ?? [])];
        for (const q of points) expect(Math.hypot(cx - q[0], cy - q[1]), `${a.kind} near a station`).toBeGreaterThan(0.45);
      }
    };
    check(T1_AMENITIES, T1, layoutOf(3).terminal);
    check(T3_AMENITIES, T3, layoutOf(4).t3!.st);
    check(T3_AMENITIES, T3, layoutOf(5).t3!.st);
    // (the hub's wider Terminal 3 keeps the same west part and the same spots)
    expect(T3_HUB.box[0]).toBe(T3.box[0]);
  });
});
