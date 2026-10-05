import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { APPLICANTS, DAY, ROLES, STAFF } from '../src/data/staff';
import { big } from '../src/sim/big';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { generatePerson, workRate } from '../src/sim/game/people';
import { buyUpgrade } from '../src/sim/game/purchase';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type Applicant, type GameState } from '../src/sim/game/types';
import { capacity, gainXp } from '../src/sim/game/workers';
import { Bubble } from '../src/sim/types';

function run(s: GameState, seconds: number, each?: () => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    each?.();
    stepGame(s, STEP_SEC);
  }
}

/** Steps until an applicant stands at the door (optionally for a given job). */
function waitForApplicant(s: GameState, role?: string): Applicant {
  for (let i = 0; i < 20000; i++) {
    const a = s.applicants.find((x) => x.state === 'waiting' && (!role || x.role === role));
    if (a) return a;
    stepGame(s, STEP_SEC);
  }
  throw new Error('no applicant came');
}

const rich = (s: GameState) => {
  s.coins = big('1e9');
};

describe('applicants', () => {
  it('come to the door with a CV soon after opening, and leave if ignored', () => {
    const s = createGame(STAND_MAP, 1);
    const a = waitForApplicant(s);
    expect(s.time).toBeLessThan(APPLICANTS.firstSeconds + 20);
    expect(a.bubble).toBe(Bubble.Cv);
    run(s, APPLICANTS.patienceSeconds + 1);
    expect(s.applicants.find((x) => x.id === a.id)?.state ?? 'gone').not.toBe('waiting');
  });

  it('are hired for a signing fee, change into the uniform and walk in', () => {
    const s = createGame(STAND_MAP, 2);
    rich(s);
    const a = waitForApplicant(s);
    const before = s.coins;
    queueCommand(s, { type: 'hire', applicant: a.id, trial: false });
    run(s, STEP_SEC);
    const st = s.staff.find((x) => x.name === a.name && x.role === a.role)!;
    expect(st).toBeDefined();
    expect(before.sub(s.coins).eq(a.wage.mul(STAFF.signingDays).ceil())).toBe(true);
    expect(st.look.outfit).toBe(ROLES[a.role].look.outfit);
    expect(st.look.skin).toBe(a.look.skin);
    expect(s.applicants.some((x) => x.id === a.id)).toBe(false);
  });

  it("cannot be hired past a job's capacity", () => {
    const s = createGame(STAND_MAP, 3, { roster: ['cook', 'washer'] });
    rich(s);
    expect(capacity(s, 'washer')).toBe(1);
    // Fake a second washer applicant at the door.
    const a = waitForApplicant(s);
    a.role = 'washer';
    queueCommand(s, { type: 'hire', applicant: a.id, trial: false });
    run(s, STEP_SEC);
    expect(s.staff.filter((x) => x.role === 'washer')).toHaveLength(1);
  });

  it('negotiation either lowers the wage or is refused, once', () => {
    let accepted = 0;
    let refused = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = createGame(STAND_MAP, seed);
      const a = waitForApplicant(s);
      const wage = a.wage;
      queueCommand(s, { type: 'negotiate', applicant: a.id });
      run(s, STEP_SEC);
      if (a.negotiated === 'accepted') {
        accepted++;
        expect(a.wage.lt(wage)).toBe(true);
      } else {
        refused++;
        expect(a.negotiated).toBe('refused');
      }
    }
    expect(accepted).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  });

  it('a trial shift costs nothing now and asks for a decision at the end of the day', () => {
    const s = createGame(STAND_MAP, 4);
    const a = waitForApplicant(s);
    s.coins = big(a.wage.mul(3).toString());
    const before = s.coins;
    queueCommand(s, { type: 'hire', applicant: a.id, trial: true });
    run(s, STEP_SEC);
    expect(s.coins.eq(before)).toBe(true);
    const st = s.staff.find((x) => x.trial)!;
    run(s, DAY.seconds - s.dayTime + STEP_SEC);
    const notice = s.notices.find((n) => n.kind === 'trial' && n.staff === st.id)!;
    expect(notice).toBeDefined();
    s.coins = big('1e9');
    queueCommand(s, { type: 'answer', notice: notice.id, yes: true });
    run(s, STEP_SEC);
    expect(st.trial).toBe(false);
  });
});

describe('payday', () => {
  it('pays wages at the end of each day', () => {
    const s = createGame(STAND_MAP, 5, { roster: ['cook', 'waiter'] });
    s.coins = big(1000);
    const wages = s.staff.reduce((sum, st) => sum.add(st.wage), big(0));
    run(s, DAY.seconds - STEP_SEC / 2);
    const before = s.coins;
    run(s, STEP_SEC * 2);
    expect(s.day).toBe(2);
    // Customers may have paid in that last step; wages leave for sure.
    expect(before.sub(s.coins).add(s.stats.earned).gte(wages)).toBe(true);
    expect(s.notices.some((n) => n.kind === 'payday')).toBe(true);
  });

  it('unpaid staff lose heart and walk out after two days', () => {
    const s = createGame(STAND_MAP, 6, { roster: ['cook', 'waiter'] });
    const waiter = s.staff.find((x) => x.role === 'waiter')!;
    const broke = () => {
      s.coins = big(0);
    };
    run(s, DAY.seconds + STEP_SEC, broke);
    expect(waiter.morale).toBeLessThan(STAFF.morale.start);
    run(s, DAY.seconds, broke);
    expect(waiter.leaving || !s.staff.includes(waiter)).toBe(true);
    expect(s.notices.some((n) => n.kind === 'quit')).toBe(true);
  });

  it('a kitchen that loses its cook gets a cook applicant right away', () => {
    const s = createGame(STAND_MAP, 7);
    const cook = s.staff[0]!;
    queueCommand(s, { type: 'fire', staff: cook.id });
    run(s, 15);
    expect(s.applicants.some((a) => a.role === 'cook')).toBe(true);
  });
});

describe('growth and management', () => {
  it('work earns XP; levels improve stats and the uniform', () => {
    const s = createGame(STAND_MAP, 8);
    const st = s.staff[0]!;
    const sum = () => Object.values(st.stats).reduce((a, b) => a + b, 0);
    const before = sum();
    for (let i = 0; i < 200; i++) gainXp(s, st);
    expect(st.level).toBeGreaterThanOrEqual(STAFF.rankLevels[0]);
    expect(sum()).toBeGreaterThan(before);
    expect(st.rank).toBeGreaterThanOrEqual(1);
  });

  it('training buys a level; a bonus lifts morale; scolding trades morale for speed', () => {
    const s = createGame(STAND_MAP, 9);
    rich(s);
    const st = s.staff[0]!;
    queueCommand(s, { type: 'train', staff: st.id });
    run(s, STEP_SEC);
    expect(st.level).toBe(2);
    st.morale = 0.4;
    queueCommand(s, { type: 'bonus', staff: st.id });
    run(s, STEP_SEC);
    expect(st.morale).toBeCloseTo(0.4 + STAFF.morale.bonus, 5);
    const calm = workRate(s, st);
    queueCommand(s, { type: 'scold', staff: st.id });
    run(s, STEP_SEC);
    expect(st.morale).toBeLessThan(0.4 + STAFF.morale.bonus);
    expect(workRate(s, st)).toBeGreaterThan(calm);
  });

  it('good workers ask for raises; saying yes raises the wage', () => {
    const s = createGame(STAND_MAP, 10, { roster: ['cook', 'waiter'] });
    rich(s);
    for (const st of s.staff) for (let i = 0; i < 40; i++) gainXp(s, st);
    let notice;
    for (let day = 0; day < 30 && !notice; day++) {
      run(s, DAY.seconds);
      notice = s.notices.find((n) => n.kind === 'raise');
    }
    expect(notice).toBeDefined();
    if (notice?.kind !== 'raise') return;
    const st = s.staff.find((x) => x.id === notice.staff)!;
    queueCommand(s, { type: 'answer', notice: notice.id, yes: true });
    run(s, STEP_SEC);
    expect(st.wage.eq(notice.wage)).toBe(true);
  });

  it('changing jobs swaps the uniform and the duties', () => {
    const s = createGame(STAND_MAP, 11, { roster: ['cook', 'waiter'] });
    const st = s.staff.find((x) => x.role === 'waiter')!;
    queueCommand(s, { type: 'reassign', staff: st.id, role: 'washer' });
    run(s, 1);
    expect(st.role).toBe('washer');
    expect(st.look.outfit).toBe(ROLES.washer.look.outfit);
  });

  it('fired staff walk out and are gone', () => {
    const s = createGame(STAND_MAP, 12, { roster: ['cook', 'waiter'] });
    const st = s.staff.find((x) => x.role === 'waiter')!;
    queueCommand(s, { type: 'fire', staff: st.id });
    run(s, 40);
    expect(s.staff.includes(st)).toBe(false);
  });

  it('a host seats people without any taps', () => {
    const s = createGame(STAND_MAP, 13, { roster: ['cook', 'waiter', 'washer', 'host'] });
    run(s, 120);
    expect(s.customers.some((c) => c.state === CustomerState.Eating || c.state === CustomerState.Paying) || s.stats.served > 0).toBe(true);
  });

  it('a second stove makes room for a second cook', () => {
    const s = createGame(STAND_MAP, 14);
    rich(s);
    expect(capacity(s, 'cook')).toBe(1);
    expect(buyUpgrade(s, 'stove2')).toBe(true);
    expect(capacity(s, 'cook')).toBe(2);
    expect(s.stoves).toHaveLength(2);
    const a = waitForApplicant(s, 'cook');
    queueCommand(s, { type: 'hire', applicant: a.id, trial: false });
    run(s, 10);
    const cooks = s.staff.filter((x) => x.role === 'cook');
    expect(cooks).toHaveLength(2);
    expect(new Set(cooks.map((c) => c.slot)).size).toBe(2);
  });

  it('applicants get better as the team grows', () => {
    const s = createGame(STAND_MAP, 15);
    s.stats.hires = 15;
    const levels = Array.from({ length: 40 }, () => generatePerson(s, 'waiter').level);
    expect(Math.max(...levels)).toBeGreaterThan(1);
  });
});
