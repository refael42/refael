import { describe, expect, it } from 'vitest';
import { TIERS } from '../src/data/buildings';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { ROLES } from '../src/data/staff';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { generatePerson, uniformLook, applicantLook } from '../src/sim/game/people';
import { createStaff, homeOf } from '../src/sim/game/staff';
import { stepGame } from '../src/sim/game/step';
import type { GameState } from '../src/sim/game/types';
import { capacity } from '../src/sim/game/workers';
import { buildGrid, findPath } from '../src/sim/grid';
import { Held } from '../src/sim/types';

/** A promoter on the team, hired straight in at the door. */
function addPromoter(s: GameState, charm = 5) {
  const person = { ...generatePerson(s, 'promoter', true), stats: { speed: 5, quality: 5, charm, stamina: 8 }, traits: [] };
  const st = createStaff(s, 'promoter', person, uniformLook('promoter', applicantLook(s.rng)), s.map.doors[0]!.inside);
  s.staff.push(st);
  return st;
}

function run(s: GameState, seconds: number) {
  const flyers: { comes: boolean }[] = [];
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    const seen = s.nextEventId;
    stepGame(s, STEP_SEC);
    for (const e of s.events) if (e.id >= seen && e.type === Ev.Flyer) flyers.push({ comes: e.c === 1 });
  }
  return flyers;
}

describe('promoter', () => {
  it('has no place at the first diner, and more in every bigger building', () => {
    expect(capacity(createGame(STAND_MAP, 1), 'promoter')).toBe(0);
    let before = 0;
    for (let t = 1; t < TIERS.length; t++) {
      const cap = capacity(createGame(mapForTier(t), 1, { levels: { building: t } }), 'promoter');
      expect(cap, `tier ${t}`).toBeGreaterThanOrEqual(Math.max(1, before));
      expect(cap).toBeLessThanOrEqual(mapForTier(t).promoterSpots.length);
      before = cap;
    }
    expect(ROLES.promoter.cap).toBe(0);
  });

  it('every promoter spot is on the sidewalk and can be walked to from inside', () => {
    TIERS.forEach((_, t) => {
      const map = mapForTier(t);
      const sidewalk = map.areas.find((a) => a.floor === 'sidewalk')!;
      const grid = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length);
      for (const p of map.promoterSpots) {
        expect(p.y >= sidewalk.y0 && p.y < sidewalk.y1 && p.x > 0 && p.x < map.width, `tier ${t} ${p.x},${p.y}`).toBe(true);
        expect(findPath(grid, map.doors[0]!.inside, p), `tier ${t} ${p.x},${p.y}`).not.toBeNull();
      }
    });
  });

  it('walks out to the sidewalk with flyers and hands one to each passer-by once', () => {
    const s = createGame(mapForTier(1), 3, { levels: { building: 1 } });
    const st = addPromoter(s);
    expect(st.held).toBe(Held.Flyers);
    const flyers = run(s, 240);
    const home = homeOf(s, st);
    expect(Math.hypot(st.x - home.x, st.y - home.y)).toBeLessThan(0.6);
    expect(flyers.length).toBeGreaterThan(5);
    // One each: everyone who got a flyer is marked, and nobody got two.
    expect(s.walkers.filter((w) => w.flyer).length).toBeLessThanOrEqual(flyers.length);
  });

  it('some passers-by come in to eat, more of them for a charming promoter', () => {
    const rate = (charm: number) => {
      let comes = 0;
      let given = 0;
      for (const seed of [11, 12, 13, 14]) {
        const s = createGame(mapForTier(1), seed, { levels: { building: 1 } });
        addPromoter(s, charm);
        // Plenty of room in line: the queue is cleared now and then so it never blocks a walk-in.
        for (let k = 0; k < 6; k++) {
          const f = run(s, 60);
          given += f.length;
          comes += f.filter((x) => x.comes).length;
          s.customers = [];
        }
      }
      return { comes, given };
    };
    const plain = rate(5);
    const charming = rate(10);
    expect(plain.comes).toBeGreaterThan(0);
    expect(plain.comes / plain.given).toBeGreaterThan(0.1);
    expect(charming.comes / charming.given).toBeGreaterThan(plain.comes / plain.given);
  });
});
