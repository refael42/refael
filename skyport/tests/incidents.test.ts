import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { AIRLINES } from '../src/data/airlines';
import { HOLIDAYS, holidayIndex } from '../src/data/holidays';
import { BUZZ_PAX, EXHIBIT_SECONDS, INCIDENTS, incidentDef, MEDICAL_DEADLINE } from '../src/data/incidents';
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
  epochDay,
  holidayOn,
  nextHoliday,
  paxBoost,
  boostPax,
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

  it('a medical case: the ambulance comes by road, nobody gets off before the patient, and you are thanked', () => {
    const s = airfield(11);
    spawnFlight(s);
    const inc = startIncident(s, 'medical', spawner(s))!;
    expect(inc).not.toBeNull();
    const f = s.flights.find((x) => x.id === inc.flight)!;
    expect(f.medical).toBe(true);
    const rating = s.rating;
    const money = s.money.toNumber();
    let offEarly = 0;
    let sawWait = false;
    play(s, 400, () => {
      if (f.medical && f.deboarded > 0) offEarly++;
      if (inc.units[0]?.state === 'wait' || inc.units[0]?.state === 'go') sawWait = true;
      return inc.state === 'done';
    });
    expect(inc.state).toBe('done');
    expect(inc.result).toBe(1);
    expect(offEarly).toBe(0);
    expect(sawWait).toBe(true);
    expect(inc.units[0].kind).toBe('ambulance');
    expect(inc.units[0].state).toBe('back');
    expect(f.medical).toBe(false);
    expect(s.rating).toBeGreaterThan(rating);
    expect(s.money.toNumber()).toBeGreaterThan(money);
    // and then everyone else gets off
    play(s, 60, () => f.deboarded >= f.paxIn);
    expect(f.deboarded).toBe(f.paxIn);
    // the ambulance drives off the map
    play(s, 60, () => inc.units[0].state === 'home');
    expect(inc.units[0].state).toBe('home');
  });

  it('a medical case left circling is flown elsewhere and counts against you', () => {
    const s = airfield(12);
    spawnFlight(s);
    const inc = startIncident(s, 'medical', spawner(s))!;
    const rating = s.rating;
    for (let i = 0; i < 30 * (MEDICAL_DEADLINE + 10) && inc.state !== 'done'; i++) stepGame(s);
    expect(inc.result).toBe(-1);
    expect(s.rating).toBeLessThan(rating);
  });

  it('a celebrity kept private tips as much again when the visit goes well', () => {
    const s = airfield(13);
    s.stats.served = 50;
    const inc = startIncident(s, 'celebrity', spawner(s))!;
    expect(inc).not.toBeNull();
    const f = s.flights.find((x) => x.id === inc.flight)!;
    expect(f.celeb).toBe(true);
    queueCommand(s, { type: 'celebPrivacy', incident: inc.id, private: true });
    play(s, 600, () => inc.state === 'done');
    expect(inc.choice).toBe(1);
    expect(inc.result).toBe(1);
    expect(inc.amount).toBe(f.paid);
    expect(s.events.some((e) => e.kind === 'celebTip')).toBe(true);
    expect(s.buzzUntil).toBe(0);
  });

  it('a celebrity with the press in makes the news: fuller planes for a day', () => {
    const s = airfield(14);
    s.stats.served = 50;
    const inc = startIncident(s, 'celebrity', spawner(s))!;
    play(s, 600, () => inc.state === 'done');
    expect(inc.result).toBe(1);
    expect(s.buzzUntil).toBeGreaterThan(s.time);
    expect(paxBoost(s)).toBeCloseTo(BUZZ_PAX * (isWeekend(s.time) ? 1.2 : 1));
    expect(boostPax(s, 100, 200)).toBeGreaterThan(100);
  });

  it('a historic plane stands on show (no boarding meanwhile) and sells tickets', () => {
    const s = airfield(15);
    const inc = startIncident(s, 'historic', spawner(s))!;
    expect(inc).not.toBeNull();
    const f = s.flights.find((x) => x.id === inc.flight)!;
    expect(f.historic).toBe(true);
    play(s, 300, () => f.dockedAt > 0);
    expect(f.holdUntil).toBeCloseTo(f.dockedAt + EXHIBIT_SECONDS, 5);
    const money = s.money.toNumber();
    play(s, EXHIBIT_SECONDS - 5);
    expect(f.boardingStarted).toBe(false);
    expect(inc.amount).toBeGreaterThan(0);
    play(s, 30, () => inc.state === 'done');
    expect(inc.state).toBe('done');
    expect(inc.result).toBe(1);
    expect(s.money.toNumber()).toBeGreaterThan(money);
    // then it flies on like any other
    play(s, 200, () => f.paid > 0);
    expect(f.paid).toBeGreaterThan(0);
  });

  it('holidays fall on their real dates (Hebrew calendar and general ones)', () => {
    const on = (y: number, m: number, d: number) => holidayOn(epochDay(y, m, d));
    const id = (y: number, m: number, d: number) => (on(y, m, d) ? HOLIDAYS[on(y, m, d)!.h].id : null);
    expect(id(2026, 9, 12)).toBe('roshHashana');
    expect(on(2026, 9, 12)!.day).toBe(1);
    expect(id(2025, 10, 7)).toBe('sukkot');
    expect(id(2025, 12, 15)).toBe('hanukkah');
    expect(on(2026, 12, 7)!.day).toBe(3);
    expect(id(2026, 2, 2)).toBe('tuBishvat');
    expect(id(2026, 3, 3)).toBe('purim');
    expect(id(2026, 4, 2)).toBe('passover');
    expect(id(2026, 5, 22)).toBe('shavuot');
    // Independence Day moves off the weekend: 2025 (5 Iyar on a Saturday) and 2024 (on a Monday)
    expect(id(2025, 5, 1)).toBe('independence');
    expect(id(2024, 5, 14)).toBe('independence');
    expect(id(2026, 4, 22)).toBe('independence');
    expect(id(2026, 12, 31)).toBe('newYear');
    expect(id(2027, 1, 1)).toBe('newYear');
    expect(id(2026, 10, 31)).toBe('halloween');
    // the travel days before are busy too (day 0), ordinary days are not
    expect(on(2026, 4, 1)!.day).toBe(0);
    expect(on(2026, 11, 3)).toBeNull();
    expect(nextHoliday('hanukkah', epochDay(2026, 11, 3))).toBe(epochDay(2026, 12, 5));
  });

  it('a holiday is announced once and fills the planes', () => {
    const s = airfield(16);
    queueCommand(s, { type: 'setToday', day: epochDay(2026, 4, 3) });
    stepGame(s);
    expect(s.holiday).toBe(holidayIndex('passover'));
    expect(s.events.filter((e) => e.kind === 'holiday').length).toBe(1);
    queueCommand(s, { type: 'setToday', day: epochDay(2026, 4, 4) });
    stepGame(s);
    expect(s.events.filter((e) => e.kind === 'holiday').length).toBe(1);
    expect(s.holidayDay).toBe(3);
    expect(paxBoost(s)).toBeGreaterThanOrEqual(HOLIDAYS[holidayIndex('passover')].pax);
    queueCommand(s, { type: 'setToday', day: epochDay(2026, 11, 3) });
    stepGame(s);
    expect(s.holiday).toBe(-1);
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
