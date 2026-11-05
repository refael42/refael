import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { STAFF_ROLES } from '../src/data/staff';
import { buildingWalls, crossesWall } from '../src/data/terminals';
import { TIERS } from '../src/data/tiers';
import { applyStructural, Big, botCommands, createGame, layoutOf, makeApplicant, queueCommand, stepGame, switchTier, type GameState } from '../src/sim';
import { AREA_CAP, cleanAreas, cleanliness } from '../src/sim/game/cleaning';

const CLEANER = STAFF_ROLES.findIndex((r) => r.id === 'cleaner');

/** A busy small airfield with a full crew but no cleaners (the bot never hires them here). */
function airfield(seed: number): GameState {
  const s = createGame(seed);
  switchTier(s, 2);
  s.upg.stand = 4;
  s.upg.counters = 3;
  s.upg.lanes = 2;
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.money = Big.fromNumber(1e9);
  s.nextIncidentAt = 1e12;
  s.traffic = 2;
  return s;
}

function run(s: GameState, seconds: number, hireCleaners: boolean): void {
  for (let i = 0; i < 30 * seconds; i++) {
    if (i % 3 === 0)
      for (const c of botCommands(s, { reaction: 0.4 })) {
        if (c.type === 'hire' && !hireCleaners && s.applicants.find((a) => a.id === c.applicantId)?.role === CLEANER) continue;
        queueCommand(s, c);
      }
    stepGame(s);
  }
}

function hireCleaner(s: GameState): void {
  const a = makeApplicant(s, CLEANER);
  s.applicants.push(a);
  queueCommand(s, { type: 'hire', applicantId: a.id });
  stepGame(s);
}

describe('cleanliness', () => {
  it('every clean area sits inside one building and no wall runs through it', () => {
    for (const t of TIERS.filter((x) => x.layout)) {
      const L = t.layout!;
      const buildings = [L.building, L.t3?.building, L.sat?.building, L.t4?.building].filter((b) => !!b);
      const walls = buildings.flatMap((b) => buildingWalls(b!));
      for (const a of cleanAreas(L)) {
        expect(buildings.some((b) => a[0] >= b!.box[0] && a[2] <= b!.box[2] && a[1] >= b!.box[1] && a[3] <= b!.box[3]), `tier ${t.id} ${a}`).toBe(true);
        const corners: [number, number][] = [
          [a[0], a[1]],
          [a[2], a[1]],
          [a[2], a[3]],
          [a[0], a[3]],
        ];
        for (let k = 0; k < 4; k++) expect(crossesWall(walls, corners[k], corners[(k + 1) % 4]), `tier ${t.id} ${a} edge ${k}`).toBe(false);
        // (and the diagonals: a cleaner walks straight across the area)
        expect(crossesWall(walls, corners[0], corners[2]) || crossesWall(walls, corners[1], corners[3]), `tier ${t.id} ${a} across`).toBe(false);
      }
    }
    expect(cleanAreas(layoutOf(1)).length).toBe(0);
  });

  it('litter piles up without cleaners, and the passengers notice', () => {
    const s = airfield(5);
    run(s, 900, false);
    expect(s.staff.some((m) => m.role === CLEANER)).toBe(false);
    expect(s.litter.length).toBeGreaterThan(6);
    expect(cleanliness(s)).toBeLessThan(0.8);
    // never more than an area holds
    const n = cleanAreas(layoutOf(2)).length;
    expect(s.litter.length).toBeLessThanOrEqual(n * AREA_CAP);
  }, 120000);

  it('cleaners walk over and pick it up, and keep the floors clean', () => {
    const s = airfield(5);
    run(s, 900, false);
    const dirty = s.litter.length;
    for (let k = 0; k < 3; k++) hireCleaner(s);
    expect(s.staff.filter((m) => m.role === CLEANER).length).toBe(3);
    run(s, 300, false);
    expect(s.sweepers.length).toBe(3);
    expect(s.litter.length).toBeLessThan(dirty / 2);
    expect(cleanliness(s)).toBeGreaterThan(0.85);
    // each cleaner stays inside the area they look after
    const areas = cleanAreas(layoutOf(2));
    for (const w of s.sweepers) {
      const b = areas[w.area];
      expect(w.x >= b[0] && w.x <= b[2] && w.y >= b[1] && w.y <= b[3]).toBe(true);
    }
  }, 120000);

  it('more cleaners than the usual two can be hired', () => {
    const s = airfield(6);
    for (let k = 0; k < 5; k++) hireCleaner(s);
    expect(s.staff.filter((m) => m.role === CLEANER).length).toBe(5);
  });

  it('a dirty terminal costs mood (and so rating) at the gate', () => {
    const run2 = (clean: boolean) => {
      const s = airfield(9);
      if (clean) for (let k = 0; k < 3; k++) hireCleaner(s);
      let mood = 0;
      let n = 0;
      for (let i = 0; i < 30 * 1500; i++) {
        if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.4 })) if (!(c.type === 'hire' && s.applicants.find((a) => a.id === c.applicantId)?.role === CLEANER)) queueCommand(s, c);
        stepGame(s);
        for (const f of s.flights) if (f.phase === 'doorsClosed' && f.phaseT === 0) {
          mood += f.mood;
          n++;
        }
      }
      return { mood: n ? mood / n : 0, n, rating: s.rating };
    };
    const dirty = run2(false);
    const clean = run2(true);
    expect(dirty.n).toBeGreaterThan(10);
    expect(clean.rating).toBeGreaterThan(dirty.rating);
  }, 240000);
});
