import { describe, expect, it } from 'vitest';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { COMMON_FIRST_HIRES, RARITIES, RARITY, type Rarity } from '../src/data/rarity';
import { STAT_IDS } from '../src/data/staff';
import { createGame } from '../src/sim/game/create';
import { generatePerson, rollRarity } from '../src/sim/game/people';
import type { GameState, Person } from '../src/sim/game/types';
import { gainXp } from '../src/sim/game/workers';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { buyShopItem } from '../src/sim/shop';

/** Many applicants for one job, as they would come over a long game. */
function applicants(s: GameState, n: number): Person[] {
  const out: Person[] = [];
  s.stats.hires = COMMON_FIRST_HIRES + 10;
  for (let i = 0; i < n; i++) {
    s.nextId += 7;
    s.day = 1 + (i % 50);
    out.push(generatePerson(s, 'waiter'));
  }
  return out;
}

const share = (people: Person[], r: Rarity) => people.filter((p) => p.rarity === r).length / people.length;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

describe('worker rarity (owner: common, rare, epic, legendary)', () => {
  it('every applicant has one: mostly common, now and then legendary', () => {
    const people = applicants(createGame(STAND_MAP, 1), 3000);
    for (const r of RARITIES) expect(share(people, r), r).toBeGreaterThan(0);
    expect(share(people, 'common')).toBeGreaterThan(0.5);
    expect(share(people, 'legendary')).toBeLessThan(0.05);
  });

  it('the bigger the building, the more of the rare kinds', () => {
    const diner = applicants(createGame(STAND_MAP, 1), 3000);
    const crown = applicants(createGame(mapForTier(7), 1, { levels: { building: 7 } }), 3000);
    expect(share(crown, 'common')).toBeLessThan(share(diner, 'common'));
    expect(share(crown, 'legendary')).toBeGreaterThan(share(diner, 'legendary'));
  });

  it('rarer people have better stats, a higher level, a higher wage, and learn faster', () => {
    const people = applicants(createGame(STAND_MAP, 1), 3000);
    const of = (r: Rarity) => people.filter((p) => p.rarity === r);
    const stats = (r: Rarity) => avg(of(r).map((p) => avg(STAT_IDS.map((k) => p.stats[k]))));
    const level = (r: Rarity) => avg(of(r).map((p) => p.level));
    const wage = (r: Rarity) => avg(of(r).map((p) => p.wage.toNumber()));
    for (let i = 1; i < RARITIES.length; i++) {
      const [a, b] = [RARITIES[i - 1]!, RARITIES[i]!];
      expect(stats(b), `${b} stats`).toBeGreaterThan(stats(a));
      expect(level(b), `${b} level`).toBeGreaterThan(level(a));
      expect(wage(b), `${b} wage`).toBeGreaterThan(wage(a));
      expect(RARITY[b].xp).toBeGreaterThan(RARITY[a].xp);
    }
    // Learning faster: the same jobs give a legendary worker more XP.
    const s = createGame(STAND_MAP, 2, { roster: ['waiter', 'waiter'] });
    const [x, y] = s.staff;
    x!.rarity = 'common';
    y!.rarity = 'legendary';
    for (let i = 0; i < 5; i++) {
      gainXp(s, x!);
      gainXp(s, y!);
    }
    expect(y!.xp + y!.level * 100).toBeGreaterThan(x!.xp + x!.level * 100);
  });

  it('the first hires are always common (cheap to sign at the start)', () => {
    const s = createGame(STAND_MAP, 1);
    for (let i = 0; i < 50; i++) {
      s.nextId += 3;
      expect(rollRarity(s)).toBe('common');
    }
    expect(createGame(STAND_MAP, 1).staff.every((st) => st.rarity === 'common')).toBe(true);
  });

  it('star workers from the shop are legendary; rarity is kept in the save (older saves: common)', () => {
    const s = createGame(STAND_MAP, 1, { gems: 1000 });
    expect(buyShopItem(s, 'starWaiter')).toBe(true);
    expect(s.staff.at(-1)!.rarity).toBe('legendary');
    const loaded = parseSave(JSON.stringify(makeSave(s, 1000)));
    expect(loaded.ok && restoreGame(loaded.save, 1).staff.at(-1)!.rarity).toBe('legendary');
    const raw = makeSave(s, 1000) as unknown as { team: Record<string, unknown>[] };
    for (const w of raw.team) delete w.rarity;
    const old = parseSave(JSON.stringify(raw));
    expect(old.ok && old.save.team.every((w) => w.rarity === 'common')).toBe(true);
  });
});
