import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { roleIndex } from '../src/data/staff';
import { UPGRADES } from '../src/data/upgrades';
import { DICTS } from '../src/i18n/strings';
import { applyStructural, Big, botCommands, createGame, queueCommand, runwayBlocked, startIncident, stepGame, switchTier, type GameState } from '../src/sim';
import { spawnFlight } from '../src/sim/game/flights';
import { makeApplicant } from '../src/sim/game/staff';
import { breachChance, checkSeconds, droneSeconds, guardCount, guardsNeeded, noticeSeconds, securityLevel } from '../src/sim/game/security';
import { scanSeconds } from '../src/sim/game/terminal';
import { guideParts } from '../src/sim/game/guide';

function airfield(seed: number, tier = 2): GameState {
  const s = createGame(seed);
  switchTier(s, tier);
  s.upg.stand = 4;
  if (tier >= 3) s.upg.standMed = 2;
  s.upg.ils = 3;
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.money = Big.fromNumber(1e9);
  s.nextIncidentAt = 1e12;
  // (a manager far from a level-up)
  s.career.level = 500;
  return s;
}

const spawner = (s: GameState) => (p: Parameters<typeof spawnFlight>[1]) => spawnFlight(s, p);

function hireGuards(s: GameState, n: number): void {
  const role = roleIndex('guard');
  for (let i = 0; i < n; i++) {
    const a = makeApplicant(s, role);
    s.staff.push({ ...a, hiredAt: s.time, busyUntil: 0, xp: 0, points: 0, mood: 1, energy: 1, breakUntil: 0, trialUntil: 0, trialCost: 0, raise: 0, raiseAt: 0 });
  }
}

function play(s: GameState, seconds: number, until?: () => boolean): void {
  for (let i = 0; i < seconds * 30; i++) {
    if (until?.()) return;
    if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.4 })) queueCommand(s, c);
    stepGame(s);
  }
}

describe('airport security', () => {
  it('the security upgrades, the guard role and the incidents are named in both languages', () => {
    const sec = UPGRADES.filter((u) => u.category === 'security');
    expect(sec.map((u) => u.id).sort()).toEqual(['cctv', 'droneDefense', 'fence', 'k9', 'patrol']);
    for (const lang of ['en', 'he'] as const) {
      const d = DICTS[lang] as Record<string, string>;
      for (const u of sec) expect(d[`upg.${u.id}`] && d[`upgDesc.${u.id}`], `${lang} ${u.id}`).toBeTruthy();
      expect(d['role.guard']).toBeTruthy();
      for (const k of ['bag', 'drone', 'breach']) for (const part of ['title', 'body', 'start', 'good', 'bad']) expect(d[`inc.${k}.${part}`], `${lang} inc.${k}.${part}`).toBeTruthy();
    }
  });

  it('the security level grows with cameras, the fence, patrols, guards, the dog team and drone defence', () => {
    const s = airfield(1, 4);
    const base = securityLevel(s);
    expect(base).toBeGreaterThan(0);
    expect(base).toBeLessThan(0.3);
    s.upg.cctv = 10;
    s.upg.fence = 3;
    s.upg.patrol = 2;
    s.upg.k9 = 1;
    s.upg.droneDefense = 2;
    s.upgRev++;
    hireGuards(s, guardsNeeded(s));
    expect(guardCount(s)).toBe(guardsNeeded(s));
    expect(securityLevel(s)).toBeGreaterThan(0.95);
    // and it counts in the guide's safety
    const s2 = airfield(1, 4);
    expect(guideParts(s).safety).toBeGreaterThan(guideParts(s2).safety);
    // cameras spot sooner, the dog team checks faster, drone defence shortens, the fence makes breaches rarer
    expect(noticeSeconds(s)).toBeLessThan(noticeSeconds(s2));
    expect(checkSeconds(s)).toBeLessThan(checkSeconds(s2));
    expect(droneSeconds(s)).toBeLessThan(droneSeconds(s2));
    expect(breachChance(s)).toBeLessThan(breachChance(s2));
  });

  it('an unattended bag: lanes slow, a guard walks to it and checks it; quick is a bonus', () => {
    const s = airfield(2, 2);
    hireGuards(s, 2);
    s.upg.cctv = 10;
    s.upgRev++;
    stepGame(s);
    expect(s.guards.length).toBe(2);
    const slow = scanSeconds(s);
    const inc = startIncident(s, 'bag', spawner(s))!;
    expect(inc).not.toBeNull();
    stepGame(s);
    expect(scanSeconds(s)).toBeCloseTo(slow * 2, 6);
    const money = s.money.toNumber();
    play(s, 120, () => inc.state === 'done');
    expect(inc.state).toBe('done');
    expect(inc.result).toBe(1);
    expect(s.money.toNumber()).toBeGreaterThan(money);
    expect(scanSeconds(s)).toBeCloseTo(slow, 6);
  }, 120000);

  it('without guards the city comes, late (no bonus)', () => {
    const s = airfield(3, 2);
    stepGame(s);
    const inc = startIncident(s, 'bag', spawner(s))!;
    play(s, 120, () => inc.state === 'done');
    expect(inc.state).toBe('done');
    expect(inc.result).toBe(0);
  }, 120000);

  it('a drone closes every runway until it is gone (shorter with drone defence)', () => {
    const s = airfield(4, 4);
    stepGame(s);
    const inc = startIncident(s, 'drone', spawner(s))!;
    expect(inc).not.toBeNull();
    stepGame(s);
    expect(runwayBlocked(s, 1)).toBe('closed');
    expect(runwayBlocked(s, 2)).toBe('closed');
    const len = inc.ends - inc.at;
    play(s, 120, () => inc.state === 'done');
    expect(inc.state).toBe('done');
    expect(runwayBlocked(s, 1)).toBeNull();
    const s2 = airfield(4, 4);
    s2.upg.droneDefense = 2;
    s2.upg.patrol = 1;
    s2.upgRev++;
    stepGame(s2);
    const inc2 = startIncident(s2, 'drone', spawner(s2))!;
    expect(inc2.ends - inc2.at).toBeLessThan(len * 0.5);
    expect(inc2.units.length).toBe(1);
    expect(inc2.units[0].kind).toBe('patrol');
  }, 120000);

  it('a hole in the fence holds the runways until a car has checked it', () => {
    for (const patrol of [0, 1]) {
      const s = airfield(5, 3);
      s.upg.patrol = patrol;
      s.upgRev++;
      stepGame(s);
      const inc = startIncident(s, 'breach', spawner(s))!;
      expect(inc).not.toBeNull();
      expect(inc.units[0].kind).toBe(patrol ? 'patrol' : 'opsCar');
      stepGame(s);
      expect(runwayBlocked(s, 1)).toBe('closed');
      play(s, 200, () => inc.state === 'done');
      expect(inc.state).toBe('done');
      expect(inc.result).toBe(patrol ? 1 : 0);
      expect(runwayBlocked(s, 1)).toBeNull();
    }
  }, 120000);

  it('the bot hires guards; real games see security incidents happen and get handled', () => {
    const s = airfield(6, 4);
    s.nextIncidentAt = 0;
    let seen = 0;
    for (let i = 0; i < 30 * 1200; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.4 })) queueCommand(s, c);
      stepGame(s);
      for (const inc of s.incidents) if ((inc.kind === 'bag' || inc.kind === 'drone' || inc.kind === 'breach') && inc.state === 'done') seen |= 1 << ['bag', 'drone', 'breach'].indexOf(inc.kind);
    }
    expect(seen).toBeGreaterThan(0);
  }, 240000);
});
