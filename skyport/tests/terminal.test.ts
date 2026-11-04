import { describe, expect, it } from 'vitest';

import { buildingWalls, crossesWall } from '../src/data/terminals';
import { AIRLINES } from '../src/data/airlines';
import { TIERS } from '../src/data/tiers';
import { zoneAt } from '../src/sim/game/routes';
import { stockUp } from './helpers';
import {
  applyStructural,
  Big,
  botCommands,
  counterCount,
  createGame,
  FUEL,
  laneCount,
  layoutOf,
  makeOffer,
  signOffer,
  parseSave,
  PST,
  QUEUE_GAP,
  queueCommand,
  serializeGame,
  stepGame,
  switchTier,
  type GameState,
} from '../src/sim';

function setup(seed: number, upg: Record<string, number>, traffic = 1): GameState {
  const s = createGame(seed);
  Object.assign(s.upg, upg);
  s.upgRev++;
  s.traffic = traffic;
  applyStructural(s);
  return s;
}

function run(s: GameState, seconds: number, check?: (s: GameState) => void): void {
  const steps = Math.round(seconds * 30);
  for (let i = 0; i < steps; i++) {
    if (i % 3 === 0) for (const c of botCommands(s, { reaction: 1 })) queueCommand(s, c);
    stepGame(s);
    if (check && i % 15 === 0) check(s);
  }
}

function lineLength(line: readonly (readonly [number, number])[]): number {
  let d = 0;
  for (let i = 1; i < line.length; i++) d += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return d;
}

/** Queues, counters and scanners agree with the people's states. */
function checkTerminal(s: GameState): void {
  const byId = new Map(s.people.map((p) => [p.id, p]));
  for (const [q, state] of [
    [s.checkinQ, PST.inCheckin],
    [s.securityQ, PST.inSecurity],
  ] as const) {
    expect(new Set(q).size).toBe(q.length);
    for (const id of q) {
      const p = byId.get(id);
      if (!p) continue; // removed this tick, dropped on the next one
      expect(p.state).toBe(state);
    }
  }
  for (const p of s.people) {
    if (p.state === PST.inCheckin) expect(s.checkinQ).toContain(p.id);
    if (p.state === PST.inSecurity) expect(s.securityQ).toContain(p.id);
  }
  expect(s.counterBusy.length).toBeLessThanOrEqual(layoutOf(s.tier).terminal.counters.length);
  s.counterBusy.forEach((id, c) => {
    if (!id || !byId.has(id)) return;
    expect(byId.get(id)!.state).toBe(PST.atCounter);
    expect(byId.get(id)!.slot).toBe(c);
  });
  s.laneBusy.forEach((id, c) => {
    if (!id || !byId.has(id)) return;
    expect(byId.get(id)!.state).toBe(PST.atScanner);
    expect(byId.get(id)!.slot).toBe(c);
  });
  for (const f of s.flights) expect(f.bagsChecked).toBeLessThanOrEqual(f.paxOut);
}

describe('terminal layout', () => {
  for (const t of TIERS.filter((x) => x.layout)) {
    it(`tier ${t.id}: queue lines hold a crowd and stations are distinct`, () => {
      const T = t.layout!.terminal;
      expect(lineLength(T.checkinQueue) / QUEUE_GAP).toBeGreaterThanOrEqual(12);
      expect(lineLength(T.securityQueue) / QUEUE_GAP).toBeGreaterThanOrEqual(10);
      for (const list of [T.counters, T.lanes]) {
        for (let i = 0; i < list.length; i++)
          for (let j = i + 1; j < list.length; j++) expect(Math.hypot(list[i][0] - list[j][0], list[i][1] - list[j][1])).toBeGreaterThan(0.5);
      }
    });
  }

  it('counters and lanes are capped by the layout', () => {
    const s = setup(1, { counters: 99, lanes: 99 });
    expect(counterCount(s)).toBe(layoutOf(1).terminal.counters.length);
    expect(laneCount(s)).toBe(layoutOf(1).terminal.lanes.length);
    expect(counterCount(createGame(1))).toBe(1);
    expect(laneCount(createGame(1))).toBe(1);
  });
});

describe('terminal flow', () => {
  it('queues, counters and scanners stay consistent through a busy 20 minutes', () => {
    const s = setup(3, { kiosk: 5, stand: 2, counters: 2, lanes: 1 }, 1.6);
    run(s, 1200, checkTerminal);
    expect(s.stats.queued).toBeGreaterThan(50);
    expect(s.stats.served).toBeGreaterThan(20);
    // nobody waits forever: average time in line stays short with two counters
    expect(s.stats.queueSecs / s.stats.queued).toBeLessThan(30);
  });

  it('more counters and scanner lanes mean shorter lines and fewer lost bags', () => {
    const few = setup(5, { kiosk: 5, stand: 2 }, 1.6);
    const many = setup(5, { kiosk: 5, stand: 2, counters: 3, lanes: 2 }, 1.6);
    run(few, 900);
    run(many, 900);
    const avg = (s: GameState) => s.stats.queueSecs / Math.max(1, s.stats.queued);
    expect(avg(many)).toBeLessThan(avg(few));
    expect(many.stats.lostBags).toBeLessThanOrEqual(few.stats.lostBags);
    expect(few.stats.lostBags).toBeGreaterThan(0);
  });

  it('kiosk sales are real money, and there are none without a kiosk', () => {
    const shop = setup(7, { kiosk: 5 });
    const none = setup(7, {});
    let shopped = 0;
    run(shop, 900, (s) => {
      for (const p of s.people) if (p.state === PST.shopping) shopped++;
    });
    run(none, 900, (s) => {
      for (const p of s.people) expect(p.state === PST.toShop || p.state === PST.shopping).toBe(false);
    });
    expect(shopped).toBeGreaterThan(0);
    expect(shop.stats.sales.toNumber()).toBeGreaterThan(0);
    expect(shop.stats.earned.cmp(shop.stats.sales)).toBeGreaterThan(0);
    expect(none.stats.sales.toNumber()).toBe(0);
    const kioskIncome = shop.income.curComp[3] + shop.income.histComp.reduce((a, c) => a + (c[3] ?? 0), 0);
    expect(kioskIncome).toBeGreaterThan(0);
  });

  it('a bag checked in after the cart loaded the plane is lost', () => {
    const s = setup(2, {});
    let found = false;
    for (let i = 0; i < 30 * 600 && !found; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 1 })) queueCommand(s, c);
      stepGame(s);
      const p = s.people.find((q) => q.state === PST.atCounter && !q.moving && q.until > s.time);
      const f = p && s.flights.find((x) => x.id === p.flight);
      if (!p || !f) continue;
      found = true;
      f.bagState = FUEL.done;
      const before = s.stats.lostBags;
      const lostBefore = f.lostBags;
      let saw = false;
      for (let k = 0; k < 30 * 10 && p.state === PST.atCounter; k++) {
        stepGame(s);
        if (s.events.some((e) => e.kind === 'lostBag')) saw = true;
      }
      expect(p.state).toBe(PST.inSecurity);
      expect(s.stats.lostBags).toBe(before + 1);
      expect(f.lostBags).toBe(lostBefore + 1);
      expect(saw).toBe(true);
    }
    expect(found).toBe(true);
  });

  it('arriving passengers wait at the carousel for their bags, then leave', () => {
    const s = setup(4, {});
    const since = new Map<number, number>();
    let longest = 0;
    let claimed = 0;
    run(s, 900, (g) => {
      for (const p of g.people) {
        if (p.state === PST.atClaim) {
          if (!since.has(p.id)) {
            since.set(p.id, g.time);
            claimed++;
          }
          longest = Math.max(longest, g.time - since.get(p.id)!);
        }
      }
    });
    expect(claimed).toBeGreaterThan(10);
    // the walk to the carousel is included; the wait itself is capped at 45 s
    expect(longest).toBeLessThan(75);
  });

  it('the same seed gives the same terminal results', () => {
    const a = setup(9, { kiosk: 3, counters: 1 }, 1.3);
    const b = setup(9, { kiosk: 3, counters: 1 }, 1.3);
    run(a, 600);
    run(b, 600);
    expect(a.stats.queued).toBe(b.stats.queued);
    expect(a.stats.queueSecs).toBe(b.stats.queueSecs);
    expect(a.stats.lostBags).toBe(b.stats.lostBags);
    expect(a.stats.sales.toString()).toBe(b.stats.sales.toString());
  });
});

describe('terminal save', () => {
  it('queues are transient: a save made mid-rush loads with empty lines', () => {
    const s = setup(6, { kiosk: 2, counters: 1 }, 1.6);
    let tries = 0;
    while (s.checkinQ.length < 2 && tries++ < 30 * 900) {
      if (tries % 3 === 0) for (const c of botCommands(s, { reaction: 1 })) queueCommand(s, c);
      stepGame(s);
    }
    expect(s.checkinQ.length).toBeGreaterThanOrEqual(2);
    const lost = s.stats.lostBags;
    const r = parseSave(serializeGame(s, 1000), 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.checkinQ).toEqual([]);
    expect(r.state.securityQ).toEqual([]);
    expect(r.state.counterBusy.every((x) => x === 0)).toBe(true);
    expect(r.state.people).toEqual([]);
    expect(r.state.stats.lostBags).toBe(lost);
    expect(r.state.stats.sales.toString()).toBe(s.stats.sales.toString());
    // and the game keeps running from there
    run(r.state, 120, checkTerminal);
  });
});

describe('the terminal building', () => {
  for (const tier of [2, 3, 4, 5]) {
    it(`tier ${tier}: nobody walks through a wall (in and out only by the doors)`, () => {
      const s = createGame(40 + tier);
      switchTier(s, tier);
      s.upg.stand = 4;
      s.upg.counters = 3;
      s.upg.lanes = 2;
      s.upg.kiosk = 3;
      if (tier >= 3) s.upg.standMed = 2;
      if (tier >= 4) s.upg.gates = 2;
      s.upgRev++;
      applyStructural(s);
      stockUp(s);
      s.money = Big.fromNumber(1e9);
      // (big-jet airlines under contract that trust you, so Terminal 3 gets flights)
      if (tier >= 4) {
        s.upg.lounge = 1;
        s.upgRev++;
        applyStructural(s);
        s.rep = s.rep.map(() => 100);
        s.contracts = [];
        for (const id of ['coralina', 'aurelia', 'meadowlark']) {
          const o = makeOffer(s, AIRLINES.findIndex((a) => a.id === id));
          s.offers.push(o);
          signOffer(s, o.id);
        }
      }
      const L = layoutOf(tier);
      expect(L.building).toBeDefined();
      const walls = [...buildingWalls(L.building!), ...(L.t3 ? buildingWalls(L.t3.building) : [])];
      let inT3 = 0;
      const seen = new Map<number, [number, number]>();
      let moves = 0;
      let inside = 0;
      for (let i = 0; i < 30 * 600; i++) {
        if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.6 })) queueCommand(s, c);
        stepGame(s);
        for (const p of s.people) {
          const last = seen.get(p.id);
          if (last) {
            const crossed = crossesWall(walls, last, [p.x, p.y]);
            if (crossed) throw new Error(`person ${p.id} (state ${p.state}) went through a wall from ${last} to ${p.x.toFixed(2)},${p.y.toFixed(2)}`);
            moves++;
          }
          if (zoneAt(L.building!, p.x, p.y)) inside++;
          if (L.t3 && zoneAt(L.t3.building, p.x, p.y)) inT3++;
          seen.set(p.id, [p.x, p.y]);
        }
      }
      expect(moves).toBeGreaterThan(1000);
      // and the buildings are really used (Terminal 3 from the city airport on)
      expect(inside).toBeGreaterThan(1000);
      if (L.t3) expect(inT3).toBeGreaterThan(1000);
      expect(s.stats.served).toBeGreaterThan(5);
    }, 120000);
  }

  it('the dirt strip has no building yet', () => {
    expect(layoutOf(1).building).toBeUndefined();
  });
});
