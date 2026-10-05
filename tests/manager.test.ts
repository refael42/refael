import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { SHIFT, type Role } from '../src/data/staff';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { generatePerson, managerOnShift, statFactor, uniformLook, workRate } from '../src/sim/game/people';
import { stepGame } from '../src/sim/game/step';
import { createStaff } from '../src/sim/game/staff';
import { CustomerState, OrderState, type GameState } from '../src/sim/game/types';
import { Emote, Held } from '../src/sim/types';

function run(s: GameState, seconds: number, each?: () => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    each?.();
    stepGame(s, STEP_SEC);
  }
}

const seatAll = (s: GameState) => () => {
  for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
};

const FLOOR: Role[] = ['cook', 'waiter', 'waiter', 'washer', 'host'];

describe('shift manager', () => {
  it('only applies once there are two waiters and a team of five', () => {
    const small = createGame(STAND_MAP, 41, { roster: ['cook', 'waiter', 'washer', 'host', 'cleaner'] });
    const seen = new Set<string>();
    run(small, 1200, () => small.applicants.forEach((a) => seen.add(a.role)));
    expect(seen.has('manager')).toBe(false);

    const big = createGame(STAND_MAP, 41, { roster: FLOOR });
    let applied = false;
    run(big, 1200, () => {
      applied ||= big.applicants.some((a) => a.role === 'manager');
    });
    expect(applied).toBe(true);
  });

  it('stands at the end of the pass with a clipboard and speeds the waiters up', () => {
    const s = createGame(STAND_MAP, 42, { roster: [...FLOOR, 'manager'] });
    const m = managerOnShift(s)!;
    expect(m.held).toBe(Held.Clipboard);
    run(s, 5);
    expect(Math.hypot(m.x - s.map.managerSpot.x, m.y - s.map.managerSpot.y)).toBeLessThan(0.1);
    const waiter = s.staff.find((st) => st.role === 'waiter')!;
    const withLead = workRate(s, waiter);
    m.leaving = true;
    expect(withLead / workRate(s, waiter)).toBeCloseTo(1 + SHIFT.waiterSpeed * statFactor(m.stats.charm), 6);
  });

  it('walks over to the most impatient seated guest and calms them down', () => {
    const s = createGame(STAND_MAP, 43, { roster: [...FLOOR, 'manager'] });
    run(s, 200, () => {
      seatAll(s)();
    });
    const m = managerOnShift(s)!;
    // Find someone waiting at a table and make them nearly fed up.
    let guest = s.customers.find((c) => c.table >= 0 && (c.state === CustomerState.Waiting || c.state === CustomerState.Reading));
    for (let i = 0; i < 2000 && !guest; i++) {
      seatAll(s)();
      stepGame(s, STEP_SEC);
      guest = s.customers.find((c) => c.table >= 0 && (c.state === CustomerState.Waiting || c.state === CustomerState.Reading));
    }
    expect(guest).toBeDefined();
    const g = guest!;
    g.patienceMax = 60;
    g.patienceLeft = 12;
    let calmed = false;
    let visited = false;
    run(s, SHIFT.calmEverySeconds + 6, () => {
      visited ||= m.job?.kind === 'calm' && m.job.customer === g.id;
      calmed ||= g.emote === Emote.Heart && g.patienceLeft > 12;
    });
    expect(visited).toBe(true);
    expect(calmed).toBe(true);
  });

  it('sends the dish of the guest closest to losing patience first', () => {
    // No waiters yet: ready dishes pile up on the pass. Then one starts work.
    const s = createGame(STAND_MAP, 44, { roster: ['cook', 'cook', 'washer', 'host', 'manager'], levels: { stove2: 1, tables: 3 } });
    const ready = () => s.orders.filter((o) => o.state === OrderState.Ready);
    for (let i = 0; i < 6000 && ready().length < 2; i++) {
      seatAll(s)();
      stepGame(s, STEP_SEC);
    }
    expect(ready().length).toBeGreaterThanOrEqual(2);
    const left = (id: number) => {
      const c = s.customers.find((x) => x.id === id)!;
      return c.patienceLeft / c.patienceMax;
    };
    const urgent = [...ready()].sort((a, b) => left(a.customer) - left(b.customer))[0]!;
    const oldest = [...ready()].sort((a, b) => a.since - b.since)[0]!;
    const waiter = createStaff(s, 'waiter', generatePerson(s, 'waiter', true), uniformLook('waiter', s.staff[0]!.look));
    s.staff.push(waiter);
    stepGame(s, STEP_SEC);
    expect(waiter.job).toMatchObject({ kind: 'pickup', order: urgent.id });
    // (Without a manager the oldest would have gone first.)
    expect(urgent.id === oldest.id || left(urgent.customer) < left(oldest.customer)).toBe(true);
  });

  it('a busy restaurant with a manager loses fewer guests and earns more', () => {
    const play = (roster: Role[]) => {
      const s = createGame(STAND_MAP, 45, { roster, levels: { tables: 3, fries: 20 } });
      run(s, 900, seatAll(s));
      return s;
    };
    const without = play(FLOOR);
    const managed = play([...FLOOR, 'manager']);
    expect(managed.stats.earned.gt(without.stats.earned)).toBe(true);
    expect(managed.stats.walkouts).toBeLessThanOrEqual(without.stats.walkouts);
  });
});
