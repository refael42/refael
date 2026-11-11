import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { UPGRADES, upgradeDef, levelCap } from '../src/data/upgrades';
import { VERSIONS, versionOf } from '../src/data/versions';
import { DICTS } from '../src/i18n/strings';
import { applyStructural, Big, createGame, queueCommand, startIncident, stepGame, switchTier, type GameState } from '../src/sim';
import { spawnFlight, wakeClearAt } from '../src/sim/game/flights';
import {
  abilityAt,
  AUTO_CLEAR_SECONDS,
  crosswindCut,
  forecast,
  goAroundCut,
  goAroundCutAt,
  hasAbility,
  spacingAt,
  TOWER_ABILITIES,
  ilsParts,
  towerSpot,
  warningMul,
} from '../src/sim/game/tower';
import { layoutOf } from '../src/sim/game/layout';
import { graphOf } from '../src/sim/game/graph';
import { WANT } from '../src/sim/game/types';
import { weatherAt } from '../src/sim/game/weather';
import { DAY_SECONDS } from '../src/sim/game/clock';

function airfield(seed: number, tier = 2): GameState {
  const s = createGame(seed);
  switchTier(s, tier);
  s.upg.stand = 4;
  if (tier >= 3) s.upg.standMed = 2;
  s.upg.ils = 3;
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.money = Big.fromNumber(1e12);
  s.nextIncidentAt = 1e12;
  s.career.level = 500;
  return s;
}

const step = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * 30; i++) stepGame(s);
};

describe('the control tower', () => {
  it('has ten levels, five abilities and the weather station, named in both languages', () => {
    const def = upgradeDef('tower')!;
    expect(def.maxLevel).toBe(10);
    expect(def.buildSeconds).toHaveLength(10);
    expect(def.levelTier).toHaveLength(10);
    expect(TOWER_ABILITIES.map((a) => a.level)).toEqual([2, 4, 6, 8, 10]);
    expect(upgradeDef('meteo')?.maxLevel).toBe(3);
    for (const lang of ['en', 'he'] as const) {
      const d = DICTS[lang] as Record<string, string>;
      for (const a of TOWER_ABILITIES) expect(d[`ab.${a.id}`] && d[`ab.${a.id}.d`], `${lang} ${a.id}`).toBeTruthy();
      expect(d['upg.meteo'] && d['upgDesc.meteo'] && d['upgDesc.tower'] && d['eff.meteo']).toBeTruthy();
      for (let v = 1; v <= VERSIONS.tower.length; v++) expect(d[`ver.tower.${v}`], `${lang} ver.tower.${v}`).toBeTruthy();
    }
    // the mega tower comes at level 9
    expect(versionOf('tower', 8)).toBe(3);
    expect(versionOf('tower', 9)).toBe(4);
    // the levels open with the airport: two at the small airfield, all ten at the Skyport
    expect(levelCap(def, 2)).toBe(2);
    expect(levelCap(def, 8)).toBe(10);
    expect(UPGRADES.filter((u) => u.id === 'tower')).toHaveLength(1);
  });

  it('every level helps: tighter gaps to the fifth, fewer go-arounds all the way', () => {
    for (let l = 1; l <= 10; l++) {
      expect(spacingAt(l)).toBeGreaterThanOrEqual(spacingAt(l - 1));
      expect(goAroundCutAt(l)).toBeGreaterThan(goAroundCutAt(l - 1));
    }
    expect(spacingAt(5)).toBeCloseTo(0.5);
    expect(spacingAt(10)).toBeCloseTo(0.5);
    // the surface radar takes 30% off what is left
    expect(1 - goAroundCutAt(8)).toBeCloseTo((1 - (0.6 + 0.09)) * 0.7);
    expect(goAroundCutAt(10)).toBeLessThan(1);
    expect(abilityAt(6)).toBe('auto');
    expect(abilityAt(7)).toBeNull();
  });

  it('a better tower lets the next plane in sooner behind a heavy one', () => {
    const s = airfield(11, 5);
    const f = spawnFlight(s)!;
    s.wake[0] = { at: 100, cat: 2 };
    s.upg.tower = 0;
    const slow = wakeClearAt(s, 1, f);
    s.upg.tower = 5;
    const fast = wakeClearAt(s, 1, f);
    expect(fast - 100).toBeCloseTo((slow - 100) * 0.5);
    s.upg.tower = 10;
    expect(goAroundCut(s)).toBeGreaterThan(0.8);
    expect(hasAbility(s, 'ops')).toBe(true);
  });

  it('automatic clearances: from level 6 the tower clears a waiting plane by itself', () => {
    for (const lvl of [5, 6]) {
      const s = airfield(21, 5);
      s.upg.tower = lvl;
      s.upgRev++;
      const f = spawnFlight(s)!;
      // (nobody else in the tower: no controllers)
      s.staff = s.staff.filter((m) => m.role !== 0);
      step(s, 1);
      expect(f.wants & (1 << WANT.clearLanding)).toBeTruthy();
      step(s, AUTO_CLEAR_SECONDS + 1);
      expect(f.landCleared, `level ${lvl}`).toBe(lvl >= 6);
    }
  });

  it('the weather station: earlier storm warnings, fewer crosswind go-arounds and a forecast', () => {
    const s = airfield(31, 3);
    expect(forecast(s)).toBeNull();
    expect(warningMul(s)).toBe(1);
    startIncident(s, 'storm', (p) => spawnFlight(s, p));
    const lead0 = s.incidents[s.incidents.length - 1].at - s.time;
    s.incidents.length = 0;
    s.upg.meteo = 2;
    startIncident(s, 'storm', (p) => spawnFlight(s, p));
    const lead2 = s.incidents[s.incidents.length - 1].at - s.time;
    expect(lead2).toBeCloseTo(lead0 * 2);
    expect(crosswindCut(s)).toBeCloseTo(0.3);
    // the forecast is the weather an hour on (two with the weather radar)
    const fc = forecast(s)!;
    const hour = DAY_SECONDS / 24;
    expect(fc).toEqual(weatherAt(s.seed, s.time + hour, s.tier));
    s.upg.meteo = 3;
    expect(forecast(s)).toEqual(weatherAt(s.seed, s.time + 2 * hour, s.tier));
  });

  it('the tower stands from the small airfield on; buying a level builds it', () => {
    expect(towerSpot(1)).toBeNull();
    for (let t = 2; t <= 8; t++) expect(towerSpot(t), `tier ${t}`).not.toBeNull();
    const s = airfield(41, 4);
    s.upg.tower = 2;
    queueCommand(s, { type: 'buyUpgrade', id: 'tower', count: 1 });
    stepGame(s);
    expect(s.builds.some((b) => b.id === 'tower' && b.level === 3)).toBe(true);
    step(s, upgradeDef('tower')!.buildSeconds![2] + 2);
    expect(s.upg.tower).toBe(3);
  });

  it('the ILS stands on the map: one way at CAT I and II, both ways at CAT III', () => {
    expect(ilsParts(1, 3)).toEqual([]);
    expect(ilsParts(2, 0)).toEqual([]);
    const one = ilsParts(4, 1);
    expect(one.map((q) => q.kind)).toEqual(['loc', 'gs']);
    const R = layoutOf(4).runway;
    // the localizer past the far end on the centerline, the glideslope by the touchdown zone
    expect(one[0].x).toBeGreaterThan(R.x1);
    expect(one[0].y).toBe(R.y);
    expect(one[1].x).toBeLessThan(R.x0 + 2);
    expect(one[1].y).toBeGreaterThan(R.y + R.width / 2);
    const both = ilsParts(4, 3);
    expect(both).toHaveLength(4);
    expect(both.filter((q) => q.dir < 0).map((q) => q.kind)).toEqual(['loc', 'gs']);
    // inside the fence and off the runways, at every airport
    for (let t = 2; t <= 8; t++) {
      const L = layoutOf(t);
      for (const q of ilsParts(t, 3)) {
        expect(q.x, `tier ${t}`).toBeGreaterThan(L.field.x0);
        expect(q.x, `tier ${t}`).toBeLessThan(L.field.x1);
        expect(q.y, `tier ${t}`).toBeLessThan(L.field.y1);
        for (const W of [L.runway, L.depRunway]) if (W && q.kind === 'gs') expect(Math.abs(q.y - W.y), `tier ${t}`).toBeGreaterThan(W.width / 2 + 0.5);
        // clear of the taxiways
        const g = graphOf(t);
        const R = L.runway;
        const onRunway = (p: readonly number[]) => Math.abs(p[1] - R.y) < 0.05 && p[0] >= R.x0 - 0.05 && p[0] <= R.x1 + 0.05;
        for (const e of g.edges) {
          const a = g.pos[e.from];
          const b = g.pos[e.to];
          if (onRunway(a) && onRunway(b)) continue;
          for (let k = -3; k <= 3; k++) {
            const y = q.y + (q.kind === 'loc' ? k * 0.33 : 0);
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const u = Math.max(0, Math.min(1, ((q.x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
            expect(Math.hypot(q.x - a[0] - u * dx, y - a[1] - u * dy), `tier ${t} ${q.kind} ${q.dir}`).toBeGreaterThan(0.6);
          }
        }
      }
    }
  });
});
