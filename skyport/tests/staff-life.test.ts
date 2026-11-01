import { describe, expect, it } from 'vitest';

import { RARITIES, STAFF_ROLES, TALENT_MAX, TRAITS } from '../src/data/staff';
import {
  Big,
  createGame,
  DAY_SECONDS,
  eventsSince,
  makeApplicant,
  marketWage,
  parseSave,
  queueCommand,
  REJECT,
  runFor,
  serializeGame,
  stepGame,
  TRIAL_SECONDS,
  workerSpeed,
  xpForLevel,
  type GameState,
} from '../src/sim';

function rich(seed = 1): GameState {
  const s = createGame(seed);
  s.money = Big.fromNumber(1e6);
  return s;
}

function send(s: GameState, cmd: Parameters<typeof queueCommand>[1]) {
  queueCommand(s, cmd);
  stepGame(s);
}

function hireNew(s: GameState, role: number, traits?: number[]) {
  const a = makeApplicant(s, role);
  if (traits) a.traits = traits;
  s.applicants.push(a);
  send(s, { type: 'hire', applicantId: a.id });
  return s.staff.find((m) => m.id === a.id)!;
}

describe('applicants', () => {
  it('arrive on their own, cap at five, and move on after a while', () => {
    const s = createGame(3);
    const start = s.applicants.length;
    runFor(s, 400);
    expect(s.applicants.length).toBeGreaterThan(start);
    expect(s.applicants.length).toBeLessThanOrEqual(5);
    runFor(s, 3000);
    for (const a of s.applicants) expect(a.expiresAt).toBeGreaterThan(s.time);
  });

  it('rarity follows the table weights and rarer people are better', () => {
    const s = createGame(1);
    const counts = new Array(RARITIES.length).fill(0);
    const speed = new Array(RARITIES.length).fill(0);
    for (let i = 0; i < 4000; i++) {
      const a = makeApplicant(s, i % STAFF_ROLES.length);
      counts[a.rarity]++;
      speed[a.rarity] += a.speed;
      expect(a.traits.length).toBeGreaterThanOrEqual(1);
      expect(new Set(a.traits).size).toBe(a.traits.length);
      for (const t of a.traits) expect(t).toBeLessThan(TRAITS.length);
      const R = RARITIES[a.rarity];
      expect(a.level).toBeGreaterThanOrEqual(R.levels[0]);
      expect(a.level).toBeLessThanOrEqual(R.levels[1]);
    }
    const total = RARITIES.reduce((x, r) => x + r.weight, 0);
    expect(counts[0] / 4000).toBeGreaterThan((RARITIES[0].weight / total) * 0.85);
    expect(counts[4]).toBeLessThan(counts[3]);
    expect(speed[2] / counts[2]).toBeGreaterThan(speed[0] / counts[0]);
  });

  it('different games meet different people', () => {
    const a = createGame(1).applicants.map((x) => `${x.first}-${x.last}-${x.speed}`).join();
    const b = createGame(2).applicants.map((x) => `${x.first}-${x.last}-${x.speed}`).join();
    expect(a).not.toBe(b);
  });

  it('the starting pool has one modest applicant per role', () => {
    const s = createGame(7);
    expect(s.applicants.map((a) => a.role).sort()).toEqual(STAFF_ROLES.map((_, i) => i));
    for (const a of s.applicants) expect(a.rarity).toBeLessThanOrEqual(1);
  });
});

describe('hiring options', () => {
  it('negotiating gives a cheaper deal or the applicant walks away (once)', () => {
    let wins = 0;
    let losses = 0;
    for (let seed = 1; seed < 40; seed++) {
      const s = rich(seed);
      const a = s.applicants[0];
      const wage = a.wage;
      send(s, { type: 'negotiate', applicantId: a.id });
      const still = s.applicants.find((x) => x.id === a.id);
      if (still) {
        wins++;
        expect(still.wage).toBeLessThan(wage);
        send(s, { type: 'negotiate', applicantId: a.id });
        expect(eventsSince(s, 0).some((e) => e.kind === 'cmdRejected' && e.a === REJECT.limit)).toBe(true);
      } else losses++;
    }
    expect(wins).toBeGreaterThan(5);
    expect(losses).toBeGreaterThan(2);
  });

  it('a trial shift costs nothing up front; then you keep (and pay) or let go', () => {
    const s = createGame(2);
    const a = s.applicants[0];
    send(s, { type: 'trial', applicantId: a.id });
    expect(s.money.toNumber()).toBe(0);
    const m = s.staff.find((x) => x.id === a.id)!;
    expect(m.trialUntil).toBeGreaterThan(0);
    runFor(s, TRIAL_SECONDS + 1);
    expect(eventsSince(s, 0).some((e) => e.kind === 'trialEnded')).toBe(true);
    send(s, { type: 'confirmTrial', staffId: m.id, keep: true });
    expect(s.staff.find((x) => x.id === m.id)?.trialUntil).toBe(1); // no money: still on trial
    s.money = Big.fromNumber(10000);
    send(s, { type: 'confirmTrial', staffId: m.id, keep: true });
    expect(s.staff.find((x) => x.id === m.id)?.trialUntil).toBe(0);
    expect(s.money.toNumber()).toBe(10000 - a.cost);
    const b = s.applicants[0];
    send(s, { type: 'trial', applicantId: b.id });
    send(s, { type: 'confirmTrial', staffId: b.id, keep: false });
    expect(s.staff.some((x) => x.id === b.id)).toBe(false);
  });

  it('fire and transfer', () => {
    const s = rich(4);
    const m = hireNew(s, 0);
    const other = hireNew(s, 1);
    const mood = other.mood;
    send(s, { type: 'transfer', staffId: m.id, role: 2 });
    expect(m.role).toBe(2);
    send(s, { type: 'fire', staffId: m.id });
    expect(s.staff.some((x) => x.id === m.id)).toBe(false);
    expect(other.mood).toBeLessThan(mood);
  });
});

describe('working life', () => {
  it('jobs give experience, level-ups give talent points that make them faster', () => {
    const s = rich(5);
    const m = hireNew(s, 0);
    for (let r = 1; r < STAFF_ROLES.length; r++) hireNew(s, r);
    const lvl = m.level;
    // a controller with plenty of traffic (the rest of the crew keeps planes moving)
    s.standsBuilt = 3;
    runFor(s, 1800);
    expect(m.level).toBeGreaterThan(lvl);
    expect(m.points).toBeGreaterThan(0);
    const before = workerSpeed(s, m);
    send(s, { type: 'talent', staffId: m.id, talent: 0 });
    expect(m.talents[0]).toBeGreaterThan(0);
    expect(workerSpeed(s, m)).toBeGreaterThan(before);
    m.points = 99;
    for (let i = 0; i < 10; i++) send(s, { type: 'talent', staffId: m.id, talent: 0 });
    expect(m.talents[0]).toBe(TALENT_MAX);
    expect(xpForLevel(5)).toBeGreaterThan(xpForLevel(4));
  });

  it('work drains energy, tired people take a break and come back rested', () => {
    const s = rich(6);
    const m = hireNew(s, 0);
    m.energy = 0.05;
    stepGame(s);
    expect(m.breakUntil).toBeGreaterThan(s.time);
    runFor(s, 26);
    expect(m.energy).toBeGreaterThan(0.6);
  });

  it('mood follows pay and rest, and changes speed', () => {
    const s = rich(7);
    const m = hireNew(s, 1);
    const fair = marketWage(m.role, m.rarity, m.level);
    m.wage = Math.round(fair * 0.5);
    runFor(s, 600);
    const unhappy = m.mood;
    m.wage = Math.round(fair * 1.5);
    runFor(s, 600);
    expect(m.mood).toBeGreaterThan(unhappy);
    const slow = { ...m, mood: 0.1 };
    expect(workerSpeed(s, m)).toBeGreaterThan(workerSpeed(s, slow));
  });

  it('raise requests: one at a time; yes raises the wage, no lowers the mood, silence counts as no', () => {
    const s = rich(8);
    for (let r = 0; r < STAFF_ROLES.length; r++) hireNew(s, r);
    for (const m of s.staff) m.level = 20;
    let asked = 0;
    for (let d = 0; d < 30 && asked === 0; d++) {
      runFor(s, DAY_SECONDS);
      asked = s.staff.filter((m) => m.raise > 0).length;
    }
    expect(asked).toBe(1);
    const m = s.staff.find((x) => x.raise > 0)!;
    const wage = m.wage;
    send(s, { type: 'answerRaise', staffId: m.id, answer: 1 });
    expect(m.wage).toBeGreaterThan(wage);
    m.raise = 5;
    m.raiseAt = s.time;
    const mood = m.mood;
    send(s, { type: 'answerRaise', staffId: m.id, answer: 0 });
    expect(m.mood).toBeLessThan(mood);
    m.raise = 5;
    m.raiseAt = s.time;
    runFor(s, DAY_SECONDS + 1);
    expect(m.raise).toBe(0);
  });

  it('people with nothing left quit', () => {
    const s = rich(9);
    const m = hireNew(s, 2);
    m.mood = 0.01;
    stepGame(s);
    expect(s.staff.some((x) => x.id === m.id)).toBe(false);
    expect(eventsSince(s, 0).some((e) => e.kind === 'quit')).toBe(true);
  });

  it('a clumsy baggage handler sometimes drops bags', () => {
    const s = rich(10);
    s.standsBuilt = 3;
    const clumsy = TRAITS.findIndex((t) => t.id === 'clumsy');
    for (let r = 0; r < STAFF_ROLES.length; r++) hireNew(s, r, STAFF_ROLES[r].id === 'porter' ? [clumsy] : [0]);
    let oops = 0;
    let last = 0;
    for (let i = 0; i < 30 * 1800; i++) {
      stepGame(s);
      for (const e of eventsSince(s, last)) {
        last = e.id;
        if (e.kind === 'oops') oops++;
      }
    }
    expect(oops).toBeGreaterThan(0);
  });

  it('new staff fields survive save and load', () => {
    const s = rich(11);
    const m = hireNew(s, 0);
    m.level = 7;
    m.talents = [2, 1, 0, 0, 3, 0];
    m.points = 2;
    m.mood = 0.61;
    const r = parseSave(serializeGame(s, 0), 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.state.staff.find((x) => x.id === m.id)!;
    expect(t.level).toBe(7);
    expect(t.talents).toEqual([2, 1, 0, 0, 3, 0]);
    expect(t.points).toBe(2);
    expect(t.mood).toBeCloseTo(0.61, 6);
    expect(t.rarity).toBe(m.rarity);
  });
});
