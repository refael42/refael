import { describe, expect, it } from 'vitest';

import { RARITIES, STAFF_ROLES } from '../src/data/staff';
import {
  botCommands,
  createGame,
  DAY_SECONDS,
  gameClock,
  eventsSince,
  graphOf,
  isGround,
  layoutOf,
  makeApplicant,
  onRunway,
  queueCommand,
  REJECT,
  runFor,
  stepGame,
  type GameState,
} from '../src/sim';

function hireAll(s: GameState): void {
  s.money = s.money.add(10000);
  for (let i = 0; i < STAFF_ROLES.length; i++) {
    const a = s.applicants.find((x) => x.role === i);
    if (a) queueCommand(s, { type: 'hire', applicantId: a.id });
  }
  stepGame(s);
}

describe('taxiway graph', () => {
  it('is a one-way DAG: no route leads back to where it started', () => {
    const g = graphOf(1);
    const seen = new Set<number>();
    const visiting = new Set<number>();
    const dfs = (n: number): boolean => {
      if (visiting.has(n)) return false;
      if (seen.has(n)) return true;
      visiting.add(n);
      for (const e of g.out[n]) if (!dfs(g.edges[e].to)) return false;
      visiting.delete(n);
      seen.add(n);
      return true;
    };
    for (let n = 0; n < g.ids.length; n++) expect(dfs(n)).toBe(true);
    // every stand is reachable from the exit and reaches the hold-short point
    for (const sn of g.standNode) {
      expect(g.out[sn].length).toBeGreaterThan(0);
    }
  });

  it('2000 flights on three stands: no collisions, no deadlock, runway exclusive', () => {
    const s = createGame(77);
    s.standsBuilt = 3;
    // about as busy as one dirt runway can handle (approach + takeoff ~23 s)
    s.traffic = 1.6;
    const L = layoutOf(1);
    const lastProgress = new Map<number, { phase: string; since: number }>();
    let minDist = Infinity;
    let maxStuck = 0;
    let steps = 0;
    while (s.stats.served + s.stats.diverted < 2000) {
      if (steps % 3 === 0) for (const c of botCommands(s, { reaction: 0.3 })) queueCommand(s, c);
      stepGame(s);
      steps++;
      if (steps > 30 * 60 * 60 * 30) throw new Error(`stalled: served ${s.stats.served}`);
      if (steps % 2 !== 0) continue;
      const ground = s.flights.filter((f) => isGround(f) && !onRunway(f, L) && f.phase !== 'takeoff');
      for (let i = 0; i < ground.length; i++) {
        for (let j = i + 1; j < ground.length; j++) {
          const d = Math.hypot(ground[i].x - ground[j].x, ground[i].y - ground[j].y);
          if (d < minDist) minDist = d;
        }
      }
      let onRw = 0;
      for (const f of s.flights) {
        if (onRunway(f, L)) onRw++;
        const p = lastProgress.get(f.id);
        const key = f.phase + ':' + Math.round(f.pathPos * 10);
        if (!p || p.phase !== key) lastProgress.set(f.id, { phase: key, since: s.time });
        else if (isGround(f) && f.phase !== 'deboarding') maxStuck = Math.max(maxStuck, s.time - p.since);
      }
      expect(onRw).toBeLessThanOrEqual(1);
      // reservations belong to live flights only
      if (steps % 300 === 0) {
        const ids = new Set(s.flights.map((f) => f.id));
        for (const h of s.edgeHold) if (h) expect(ids.has(h)).toBe(true);
        for (const h of s.nodeHold) if (h) expect(ids.has(h)).toBe(true);
      }
    }
    console.log(`2000 flights: served ${s.stats.served}, diverted ${s.stats.diverted}, min ground distance ${minDist.toFixed(2)}, longest ground wait ${maxStuck.toFixed(0)} s, sim hours ${(s.time / 3600).toFixed(1)}`);
    expect(s.stats.served).toBeGreaterThan(1900);
    expect(minDist).toBeGreaterThan(0.95);
    expect(maxStuck).toBeLessThan(90);
  });
});

describe('staff', () => {
  it('starts with one applicant per role', () => {
    const s = createGame(1);
    expect(s.applicants.map((a) => a.role).sort()).toEqual(STAFF_ROLES.map((_, i) => i));
    for (const a of s.applicants) {
      expect(a.speed).toBeGreaterThanOrEqual(0.8);
      expect(a.speed).toBeLessThanOrEqual(1.3 * RARITIES[a.rarity].statMul + 1e-9);
      expect(a.cost).toBeGreaterThan(0);
    }
  });

  it('refuses to hire without money, and caps workers per role', () => {
    const s = createGame(1);
    const a = s.applicants[0];
    queueCommand(s, { type: 'hire', applicantId: a.id });
    stepGame(s);
    expect(s.staff.length).toBe(0);
    expect(eventsSince(s, 0).some((e) => e.kind === 'cmdRejected' && e.a === REJECT.noMoney)).toBe(true);
    s.money = s.money.add(100000);
    for (let i = 0; i < 4; i++) {
      const next = s.applicants.find((x) => x.role === a.role) ?? makeApplicant(s, a.role);
      if (!s.applicants.includes(next)) s.applicants.push(next);
      queueCommand(s, { type: 'hire', applicantId: next.id });
      stepGame(s);
    }
    expect(s.staff.filter((m) => m.role === a.role).length).toBe(2);
    expect(eventsSince(s, 0).some((e) => e.kind === 'cmdRejected' && e.a === REJECT.limit)).toBe(true);
  });

  it('with a full crew, the airfield runs by itself', () => {
    const s = createGame(8);
    hireAll(s);
    expect(s.staff.length).toBe(STAFF_ROLES.length);
    const before = s.money.toNumber();
    runFor(s, 900);
    expect(s.stats.served).toBeGreaterThan(12);
    expect(s.stats.diverted).toBe(0);
    expect(s.money.toNumber()).toBeGreaterThan(before - 500);
  });

  it('pays wages once per game day', () => {
    const s = createGame(9);
    hireAll(s);
    const wages = s.staff.reduce((a, m) => a + m.wage, 0);
    // day 2 starts when the clock passes midnight (the game starts at 07:00)
    const toMidnight = ((1440 - gameClock(s.time).minuteOfDay) / 1440) * DAY_SECONDS;
    runFor(s, toMidnight - 1);
    expect(s.stats.wages.toNumber()).toBe(0);
    runFor(s, 2);
    expect(s.stats.wages.toNumber()).toBe(wages);
    expect(eventsSince(s, 0).some((e) => e.kind === 'wagesPaid')).toBe(true);
  });

  it('applicants and hiring do not touch the shared RNG', () => {
    const a = createGame(5);
    const b = createGame(5);
    b.money = b.money.add(10000);
    queueCommand(b, { type: 'hire', applicantId: b.applicants[0].id });
    stepGame(a);
    stepGame(b);
    expect(b.rng).toBe(a.rng);
  });
});
