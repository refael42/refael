import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { AIRLINES } from '../src/data/airlines';
import { INCIDENTS, incidentDef } from '../src/data/incidents';
import {
  applyStructural,
  Big,
  botAirlines,
  botBuys,
  botCommands,
  botHires,
  createGame,
  EMERGENCY_DEADLINE,
  isWeekend,
  makeOffer,
  queueCommand,
  runwayBlocked,
  signOffer,
  startIncident,
  stepGame,
  switchTier,
  weekendPax,
  DAY_SECONDS,
  type GameState,
} from '../src/sim';
import { spawnFlight } from '../src/sim/game/flights';

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
  // no surprise incidents while a test drives one
  s.nextIncidentAt = 1e12;
  return s;
}

const spawner = (s: GameState) => (p: Parameters<typeof spawnFlight>[1]) => spawnFlight(s, p);

function play(s: GameState, seconds: number, until?: () => boolean): void {
  for (let i = 0; i < seconds * 30; i++) {
    if (until?.()) return;
    if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.4 })) queueCommand(s, c);
    stepGame(s);
  }
}

describe('incidents', () => {
  it('nothing happens at the dirt strip', () => {
    const s = createGame(1);
    expect(startIncident(s, 'storm', spawner(s))).toBeNull();
    for (const d of INCIDENTS) expect(d.minTier).toBeGreaterThanOrEqual(2);
  });

  it('a storm is announced, then nobody lands, takes off or fuels until it passes', () => {
    const s = airfield(2);
    const inc = startIncident(s, 'storm', spawner(s))!;
    expect(inc.state).toBe('announced');
    play(s, incidentDef('storm').lead + 1);
    expect(inc.state).toBe('active');
    expect(runwayBlocked(s)).toBe('storm');
    const fuel = new Map(s.flights.map((f) => [f.id, f.fuel]));
    play(s, 30);
    expect(s.events.filter((e) => e.kind === 'touchdown' && e.t > inc.at + 1).length).toBe(0);
    expect(s.events.filter((e) => e.kind === 'liftoff' && e.t > inc.at + 1).length).toBe(0);
    // no plane got a drop of fuel during the storm
    for (const f of s.flights) if (fuel.has(f.id)) expect(f.fuel).toBe(fuel.get(f.id));
    play(s, incidentDef('storm').duration);
    expect(inc.state).toBe('done');
    expect(runwayBlocked(s)).toBeNull();
  });

  it('debris closes the runway until the inspection car has picked it up', () => {
    const s = airfield(3);
    const inc = startIncident(s, 'fod', spawner(s))!;
    expect(inc.state).toBe('active');
    expect(runwayBlocked(s)).toBe('closed');
    play(s, 120, () => inc.state === 'done');
    expect(inc.state).toBe('done');
    expect(inc.result).toBe(1);
    expect(runwayBlocked(s)).toBeNull();
    // the car went out to the debris and is on its way back
    expect(inc.units.length).toBe(1);
    expect(inc.units[0].kind).toBe('opsCar');
    expect(inc.units[0].state).toBe('back');
  });

  it('an emergency lands before everyone else, the fire trucks stand by, and you are praised', () => {
    const s = airfield(4);
    const a = spawnFlight(s)!;
    const b = spawnFlight(s)!;
    const inc = startIncident(s, 'emergency', spawner(s))!;
    expect(inc).not.toBeNull();
    const em = s.flights.find((f) => f.id === inc.flight)!;
    expect(em.emergency).toBe(true);
    const other = em === a ? b : a;
    // both cleared: the emergency goes first
    queueCommand(s, { type: 'clearLanding', flightId: other.id });
    queueCommand(s, { type: 'clearLanding', flightId: em.id });
    const rating = s.rating;
    let firstFinal = 0;
    for (let i = 0; i < 30 * 120 && inc.state !== 'done'; i++) {
      stepGame(s);
      if (!firstFinal && (em.phase === 'final' || other.phase === 'final')) firstFinal = em.phase === 'final' ? em.id : other.id;
    }
    expect(firstFinal).toBe(em.id);
    expect(inc.result).toBe(1);
    expect(inc.amount).toBeGreaterThan(0);
    expect(s.rating).toBeGreaterThan(rating);
    expect(inc.units.length).toBe(2);
    expect(inc.units.every((u) => u.kind === 'fire')).toBe(true);
    expect(inc.units.every((u) => u.state === 'home')).toBe(true);
  });

  it('an emergency left circling past its deadline counts against you', () => {
    const s = airfield(5);
    spawnFlight(s);
    const inc = startIncident(s, 'emergency', spawner(s))!;
    const rating = s.rating;
    for (let i = 0; i < 30 * (EMERGENCY_DEADLINE + 10) && inc.state !== 'done'; i++) stepGame(s);
    expect(inc.result).toBe(-1);
    expect(s.rating).toBeLessThan(rating);
  });

  it('a VIP flight that leaves happy and on time tips as much again', () => {
    const s = airfield(6);
    s.contracts = [];
    const o = makeOffer(s, AIRLINES.findIndex((a) => a.id === 'meadowlark'));
    s.offers.push(o);
    signOffer(s, o.id);
    const inc = startIncident(s, 'vip', spawner(s))!;
    const f = s.flights.find((x) => x.id === inc.flight)!;
    expect(f.vip).toBe(true);
    play(s, 600, () => inc.state === 'done');
    expect(inc.state).toBe('done');
    expect(inc.result).toBe(1);
    expect(inc.amount).toBeGreaterThan(0);
    expect(s.events.some((e) => e.kind === 'vipTip')).toBe(true);
  });

  it('birds: the next plane to land takes one and is inspected before it flies again', () => {
    const s = airfield(7, 3);
    const inc = startIncident(s, 'birds', spawner(s))!;
    spawnFlight(s);
    play(s, 200, () => inc.flight !== 0);
    const f = s.flights.find((x) => x.id === inc.flight)!;
    expect(f.birdHit).toBe(true);
    play(s, 120, () => f.dockedAt > 0);
    expect(f.aog).toBe(1);
    expect(f.repParts).toBe(0);
    play(s, 300, () => inc.state === 'done');
    expect(inc.state).toBe('done');
    expect(f.aog).toBe(2);
  });

  it('an air show is announced, closes the runway while it flies, and sells tickets', () => {
    const s = airfield(8);
    const inc = startIncident(s, 'airshow', spawner(s))!;
    expect(inc.state).toBe('announced');
    expect(runwayBlocked(s)).toBeNull();
    play(s, incidentDef('airshow').lead + 1);
    expect(runwayBlocked(s)).toBe('closed');
    const money = s.money.toNumber();
    play(s, incidentDef('airshow').duration + 1);
    expect(inc.state).toBe('done');
    expect(inc.amount).toBeGreaterThan(0);
    expect(s.money.toNumber()).toBeGreaterThan(money);
  });

  it('weekends (days 6 and 7) fill the planes up', () => {
    expect(isWeekend(0)).toBe(false);
    expect(isWeekend(DAY_SECONDS * 5.5)).toBe(true);
    expect(isWeekend(DAY_SECONDS * 6.5)).toBe(true);
    expect(isWeekend(DAY_SECONDS * 7.5)).toBe(false);
    expect(weekendPax(DAY_SECONDS * 5.5, 10, 20)).toBe(12);
    expect(weekendPax(DAY_SECONDS * 5.5, 19, 20)).toBe(20);
    expect(weekendPax(0, 10, 20)).toBe(10);
  });

  it('over a long game several kinds happen, none gets stuck, and it is deterministic', () => {
    const run = () => {
      const s = createGame(9);
      const seen = new Set<string>();
      let longest = 0;
      for (let i = 0; i < 30 * 3600 * 3; i++) {
        if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.5 })) queueCommand(s, c);
        if (i % 150 === 0) for (const c of [...botHires(s), ...botAirlines(s), ...botBuys(s)]) queueCommand(s, c);
        stepGame(s);
        for (const inc of s.incidents) {
          seen.add(inc.kind);
          if (inc.state === 'active') longest = Math.max(longest, s.time - inc.at);
        }
      }
      return { seen: [...seen].sort().join(','), longest, served: s.stats.served, money: s.money.toNumber() };
    };
    const a = run();
    expect(a.seen.split(',').length).toBeGreaterThanOrEqual(3);
    expect(a.longest).toBeLessThan(EMERGENCY_DEADLINE + 120);
    expect(run()).toEqual(a);
  }, 240000);
});
