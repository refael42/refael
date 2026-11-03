import { describe, expect, it } from 'vitest';
import * as SIM from '../src/sim';

import { openStands } from './helpers';

import { AIRLINE_KINDS, AIRLINES } from '../src/data/airlines';
import { TIERS } from '../src/data/tiers';
import {
  airlineFlightDone,
  airportCapacity,
  applyCommand,
  arrivalsBoard,
  departuresBoard,
  askChance,
  availableAirlines,
  botAirlines,
  botCommands,
  canExpand,
  contractOf,
  contractSlots,
  createGame,
  DAY_SECONDS,
  fleetForRep,
  flightRevenue,
  flightsPerDay,
  makeOffer,
  MIN_PER_DAY,
  parseSave,
  queueCommand,
  refillSchedule,
  REP_EXPAND,
  REP_START,
  repDelta,
  serializeGame,
  stepGame,
  STRIKES_TO_LEAVE,
  type GameState,
} from '../src/sim';
import { AIRCRAFT } from '../src/data/aircraft';
import { spawnFlight } from '../src/sim/game/flights';

const idx = (id: string) => AIRLINES.findIndex((a) => a.id === id);

function run(s: GameState, seconds: number, manage = true): void {
  const steps = Math.round(seconds * 30);
  for (let i = 0; i < steps; i++) {
    if (i % 3 === 0) for (const c of botCommands(s, { reaction: 1 })) queueCommand(s, c);
    if (manage && i % 150 === 0) for (const c of botAirlines(s)) queueCommand(s, c);
    stepGame(s);
  }
}

function addContract(s: GameState, id: string, perDay = 6): void {
  const o = makeOffer(s, idx(id));
  o.perDay = perDay;
  s.offers.push(o);
  applyCommand(s, { type: 'signOffer', offerId: o.id });
}

describe('airline data', () => {
  it('every airline is fictional-looking, unique and flies something', () => {
    const codes = new Set(AIRLINES.map((a) => a.code));
    expect(codes.size).toBe(AIRLINES.length);
    expect(new Set(AIRLINES.map((a) => a.id)).size).toBe(AIRLINES.length);
    for (const a of AIRLINES) {
      expect(a.code).toMatch(/^[A-Z]{3}$/);
      expect(a.fleet.length).toBeGreaterThan(0);
      for (const f of a.fleet) expect(AIRCRAFT.some((x) => x.id === f), `${a.id} flies ${f}`).toBe(true);
      expect(AIRLINE_KINDS[a.kind]).toBeDefined();
    }
  });

  it('there is something to sign at every playable tier', () => {
    for (const t of TIERS.filter((x) => x.layout)) {
      const s = createGame(1);
      s.tier = t.id;
      s.stats.served = 1000;
      expect(availableAirlines(s).length, `tier ${t.id}`).toBeGreaterThan(0);
      expect(contractSlots(s)).toBe(t.contracts);
    }
  });
});

describe('contracts and the schedule', () => {
  it('a new game has the starter airline and every arrival comes from a contract', () => {
    const s = createGame(3);
    expect(s.contracts.map((c) => AIRLINES[c.al].id)).toEqual(['meadowlark']);
    const seen = new Set<number>();
    for (let i = 0; i < 30 * 600; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 1 })) queueCommand(s, c);
      stepGame(s);
      for (const f of s.flights) seen.add(f.airline);
    }
    expect([...seen]).toEqual([idx('meadowlark')]);
  });

  it('the schedule is sorted, spaced and keeps the planned flight number', () => {
    const s = createGame(4);
    addContract(s, 'puddle', 4);
    refillSchedule(s);
    expect(s.schedule.length).toBeGreaterThan(3);
    for (let i = 1; i < s.schedule.length; i++) expect(s.schedule[i].at - s.schedule[i - 1].at).toBeGreaterThanOrEqual(10 - 1e-9);
    const first = s.schedule[0];
    let f = undefined as ReturnType<typeof spawnFlight> | undefined;
    for (let i = 0; i < 30 * 120 && !f; i++) {
      stepGame(s);
      f = s.flights.find((x) => x.sched === first.at);
    }
    expect(f).toBeDefined();
    expect(f!.num).toBe(first.num);
    expect(f!.airline).toBe(first.al);
    expect(f!.origin).toBe(first.origin);
    expect(f!.dest).toBe(first.dest);
    expect(f!.dest).not.toBe(f!.origin);
  });

  it('more flights a day means more arrivals', () => {
    const count = (perDay: number) => {
      const s = createGame(5);
      s.contracts[0].perDay = perDay;
      openStands(s, 3);
      let n = 0;
      let last = 0;
      for (let i = 0; i < 30 * DAY_SECONDS; i++) {
        if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.5 })) queueCommand(s, c);
        stepGame(s);
        for (const f of s.flights) if (f.id > last) {
          last = f.id;
          n++;
        }
      }
      return n;
    };
    const few = count(5);
    const many = count(12);
    expect(few).toBeGreaterThanOrEqual(4);
    expect(few).toBeLessThanOrEqual(7);
    expect(many).toBeGreaterThan(few * 1.8);
  });

  it('pay multiplier of the contract reaches the bill', () => {
    const s = createGame(6);
    const f = spawnFlight(s)!;
    const ac = AIRCRAFT[f.aircraft];
    f.boarded = 4;
    const base = flightRevenue(f, ac).total.toNumber();
    f.payMul = 2;
    expect(flightRevenue(f, ac).total.toNumber()).toBeGreaterThanOrEqual(base * 2 - 1);
  });

  it('slots are limited by the tier', () => {
    const s = createGame(7);
    addContract(s, 'puddle');
    expect(s.contracts.length).toBe(2);
    const o = makeOffer(s, idx('bluefin'));
    s.offers.push(o);
    applyCommand(s, { type: 'signOffer', offerId: o.id });
    expect(s.contracts.length).toBe(2);
    expect(s.events.some((e) => e.kind === 'cmdRejected')).toBe(true);
  });
});

describe('reputation', () => {
  it('on time helps, late hurts, diverted hurts most; loyal airlines forgive more', () => {
    expect(repDelta('onTime', 0.6, 0, 1)).toBeGreaterThan(0);
    expect(repDelta('late', 0.6, 0, 1)).toBeLessThan(0);
    expect(repDelta('diverted', 0, 0, 1)).toBeLessThan(repDelta('late', 0.6, 0, 1));
    expect(repDelta('late', 0.6, 0, 1.3)).toBeGreaterThan(repDelta('late', 0.6, 0, 0.8));
    expect(repDelta('onTime', 0.6, 3, 1)).toBeLessThan(repDelta('onTime', 0.6, 0, 1));
  });

  it('good service raises reputation and unlocks the bigger plane', () => {
    const s = createGame(8);
    const al = idx('meadowlark');
    s.stats.served = 50;
    expect(fleetForRep(s, al).map((k) => AIRCRAFT[k].id)).toEqual(['sparrow']);
    run(s, 900);
    expect(s.rep[al]).toBeGreaterThan(REP_START + 10);
    expect(fleetForRep(s, al).map((k) => AIRCRAFT[k].id)).toEqual(['sparrow', 'finch']);
  });

  it('an unhappy airline warns, then leaves (and its flights are taken off the schedule)', () => {
    const s = createGame(9);
    addContract(s, 'puddle', 4);
    refillSchedule(s);
    const al = idx('puddle');
    const f = spawnFlight(s)!;
    f.airline = al;
    s.rep[al] = 32;
    airlineFlightDone(s, f, 'late');
    expect(contractOf(s, al)!.warned).toBe(true);
    expect(s.events.some((e) => e.kind === 'airlineWarning' && e.a === al)).toBe(true);
    for (let i = 0; i < STRIKES_TO_LEAVE; i++) airlineFlightDone(s, f, 'late');
    expect(contractOf(s, al)).toBeUndefined();
    expect(s.schedule.some((p) => p.al === al)).toBe(false);
    expect(s.events.some((e) => e.kind === 'airlineLeft' && e.a === al)).toBe(true);
  });

  it('the last airline never leaves: it cuts flights instead', () => {
    const s = createGame(10);
    const c = s.contracts[0];
    const f = spawnFlight(s)!;
    s.rep[c.al] = 5;
    for (let i = 0; i < 40; i++) airlineFlightDone(s, f, 'late');
    expect(s.contracts.length).toBe(1);
    expect(c.perDay).toBe(MIN_PER_DAY);
  });

  it('a warned airline calms down when service improves', () => {
    const s = createGame(11);
    const c = s.contracts[0];
    const f = spawnFlight(s)!;
    f.mood = 1;
    s.rep[c.al] = 29;
    airlineFlightDone(s, f, 'late');
    expect(c.warned).toBe(true);
    for (let i = 0; i < 12; i++) airlineFlightDone(s, f, 'onTime');
    expect(c.warned).toBe(false);
    expect(s.events.some((e) => e.kind === 'airlineHappy')).toBe(true);
  });

  it('happy airlines can be asked for more flights (once per cooldown, up to their maximum)', () => {
    const s = createGame(12);
    const c = s.contracts[0];
    s.time = 1000;
    s.rep[c.al] = REP_EXPAND - 1;
    expect(canExpand(s, c)).toBe(false);
    s.rep[c.al] = REP_EXPAND;
    expect(canExpand(s, c)).toBe(true);
    const before = c.perDay;
    applyCommand(s, { type: 'expandContract', airline: c.al });
    expect(c.perDay).toBe(before + AIRLINE_KINDS.regional.step);
    expect(canExpand(s, c)).toBe(false);
  });
});

describe('offers and negotiation', () => {
  it('offers arrive over time, at most two, and expire', () => {
    const s = createGame(13);
    let arrived = 0;
    let expired = 0;
    let most = 0;
    for (let i = 0; i < 30 * 1500; i++) {
      stepGame(s);
      most = Math.max(most, s.offers.length);
      for (const e of s.events) if (e.t === s.time && e.kind === 'offerArrived') arrived++;
      for (const e of s.events) if (e.t === s.time && e.kind === 'offerExpired') expired++;
    }
    expect(arrived).toBeGreaterThan(1);
    expect(expired).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(2);
  });

  it('asking for more either raises the pay or loses the offer; a discount always works', () => {
    let won = 0;
    let lost = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = createGame(seed);
      const o = makeOffer(s, idx('puddle'));
      s.offers.push(o);
      const pay = o.pay;
      applyCommand(s, { type: 'negotiateOffer', offerId: o.id, mode: 0 });
      if (s.offers.includes(o)) {
        expect(o.pay).toBeGreaterThan(pay);
        won++;
      } else {
        expect(s.rep[o.al]).toBeLessThan(REP_START);
        lost++;
      }
      // one try per offer
      applyCommand(s, { type: 'negotiateOffer', offerId: o.id, mode: 1 });
      if (s.offers.includes(o)) expect(o.negotiated).toBe(true);
    }
    expect(won).toBeGreaterThan(3);
    expect(lost).toBeGreaterThan(3);
    const s = createGame(2);
    const o = makeOffer(s, idx('puddle'));
    s.offers.push(o);
    const before = { pay: o.pay, perDay: o.perDay };
    applyCommand(s, { type: 'negotiateOffer', offerId: o.id, mode: 1 });
    expect(o.pay).toBeLessThan(before.pay);
    expect(o.perDay).toBeGreaterThan(before.perDay);
    // reputation makes asking safer
    s.rep[o.al] = 90;
    const hi = askChance(s, o);
    s.rep[o.al] = 20;
    expect(askChance(s, o)).toBeLessThan(hi);
  });

  it('a seasonal charter ends and pays a bonus when it met its goal', () => {
    const s = createGame(14);
    s.tier = 2;
    addContract(s, 'paperkite', 5);
    const c = contractOf(s, idx('paperkite'))!;
    expect(c.endsAt).toBe(s.time + AIRLINE_KINDS.charter.days * DAY_SECONDS);
    c.earned = 1000;
    c.last = [1, 1, 1, 1];
    const money = s.money.toNumber();
    s.tick = Math.ceil(c.endsAt * 30);
    stepGame(s);
    expect(contractOf(s, c.al)).toBeUndefined();
    expect(s.money.toNumber()).toBeGreaterThanOrEqual(money + 200);
    expect(s.events.some((e) => e.kind === 'contractEnded' && e.b === 200)).toBe(true);
  });

  it('you cannot walk away from your only airline; leaving another one costs reputation', () => {
    const s = createGame(15);
    applyCommand(s, { type: 'endContract', airline: s.contracts[0].al });
    expect(s.contracts.length).toBe(1);
    addContract(s, 'puddle');
    applyCommand(s, { type: 'endContract', airline: idx('puddle') });
    expect(contractOf(s, idx('puddle'))).toBeUndefined();
    expect(s.rep[idx('puddle')]).toBe(REP_START - 15);
  });
});

describe('capacity and the bot', () => {
  it('capacity grows with stands and stops at the taxiways', () => {
    const s = createGame(16);
    expect(airportCapacity(s)).toBe(14);
    openStands(s, 3);
    expect(airportCapacity(s)).toBe(30);
  });

  it('a good player keeps its airlines for an hour and signs new ones', () => {
    const s = createGame(17);
    let left = 0;
    for (let i = 0; i < 30 * 1800; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.8 })) queueCommand(s, c);
      if (i % 150 === 0) for (const c of botAirlines(s)) queueCommand(s, c);
      stepGame(s);
      for (const e of s.events) if (e.t === s.time && e.kind === 'airlineLeft') left++;
    }
    expect(left).toBe(0);
    expect(s.contracts.length).toBe(2);
    expect(flightsPerDay(s)).toBeLessThanOrEqual(airportCapacity(s) + 4);
  });
});

describe('airline save', () => {
  it('contracts, offers and reputation survive a save; the schedule is rebuilt', () => {
    const s = createGame(18);
    addContract(s, 'puddle', 4);
    s.offers.push(makeOffer(s, idx('meadowlark') === 0 ? 1 : 0));
    s.rep[idx('puddle')] = 77;
    run(s, 200);
    const r = parseSave(serializeGame(s, 5), 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const g = r.state;
    expect(g.contracts.map((c) => AIRLINES[c.al].id)).toEqual(s.contracts.map((c) => AIRLINES[c.al].id));
    expect(g.contracts.map((c) => c.perDay)).toEqual(s.contracts.map((c) => c.perDay));
    expect(g.rep[idx('puddle')]).toBeCloseTo(s.rep[idx('puddle')], 6);
    expect(g.schedule).toEqual([]);
    run(g, 120);
    expect(g.schedule.length).toBeGreaterThan(0);
    expect(g.stats.served).toBeGreaterThan(s.stats.served);
  });

  it('hostile airline data is cleaned', () => {
    const s = createGame(19);
    const file = JSON.parse(serializeGame(s, 1));
    file.game.contracts = [
      { al: 'meadowlark', perDay: 1e9, pay: -5, goal: 7, last: [1, 'x', 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
      { al: 'meadowlark', perDay: 3 },
      { al: 'nosuchair', perDay: 3 },
      { al: 'aurelia', perDay: 3 },
      'junk',
    ];
    file.game.offers = [{ al: 'puddle', id: 'x', pay: Infinity, expiresAt: -1 }, { al: 'meadowlark' }];
    file.game.rep = { meadowlark: 'high', puddle: 1e9 };
    const r = parseSave(JSON.stringify(file), 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const g = r.state;
    expect(g.contracts.length).toBe(1);
    const c = g.contracts[0];
    expect(c.perDay).toBe(AIRLINE_KINDS.regional.maxPerDay);
    expect(c.pay).toBeGreaterThan(0);
    expect(c.goal).toBeLessThanOrEqual(1);
    expect(c.last.length).toBeLessThanOrEqual(10);
    expect(g.offers.length).toBe(1);
    expect(AIRLINES[g.offers[0].al].id).toBe('puddle');
    expect(Number.isFinite(g.offers[0].pay)).toBe(true);
    expect(g.offers[0].expiresAt).toBeGreaterThan(g.time);
    expect(g.rep[idx('meadowlark')]).toBe(REP_START);
    expect(g.rep[idx('puddle')]).toBe(100);
  });

  it('a v4 save keeps its traffic: starter airline, plus a second one at tier 2', () => {
    const s = createGame(20);
    const file = JSON.parse(serializeGame(s, 1));
    file.v = 4;
    delete file.game.contracts;
    delete file.game.offers;
    delete file.game.rep;
    file.game.tier = 2;
    const r = parseSave(JSON.stringify(file), 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.contracts.map((c) => AIRLINES[c.al].id)).toEqual(['meadowlark', 'bluefin']);
    // each contract keeps its own record
    r.state.contracts[0].last.push(1);
    expect(r.state.contracts[1].last).toEqual([]);
  });
});

describe('flight board', () => {
  it('shows planned arrivals, planes in the air and the departures with sensible statuses', () => {
    const s = createGame(21);
    addContract(s, 'puddle', 4);
    const seen = { arr: new Set<string>(), dep: new Set<string>() };
    for (let i = 0; i < 30 * 900; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 1 })) queueCommand(s, c);
      stepGame(s);
      if (i % 30 !== 0) continue;
      const arr = arrivalsBoard(s);
      const dep = departuresBoard(s);
      expect(arr.length).toBeLessThanOrEqual(9);
      expect(dep.length).toBeLessThanOrEqual(9);
      expect(new Set(arr.map((r) => r.key)).size).toBe(arr.length);
      expect(new Set(dep.map((r) => r.key)).size).toBe(dep.length);
      for (let k = 1; k < arr.length; k++) expect(arr[k].time).toBeGreaterThanOrEqual(arr[k - 1].time);
      for (const r of arr) seen.arr.add(r.status);
      for (const r of dep) seen.dep.add(r.status);
      // every plane on the map is on one of the boards
      for (const f of s.flights) {
        if (f.phase === 'diverted') continue;
        const onBoard = arr.some((r) => r.flightId === f.id) || dep.some((r) => r.flightId === f.id) || f.paid > 0;
        if (arr.length < 9 && dep.length < 9) expect(onBoard, `flight ${f.id} ${f.phase}`).toBe(true);
      }
    }
    for (const st of ['scheduled', 'approach', 'landed']) expect(seen.arr.has(st as never), st).toBe(true);
    for (const st of ['onTime', 'boarding', 'departed']) expect(seen.dep.has(st as never), st).toBe(true);
  });

  it('a held-up arrival shows as delayed', () => {
    const s = createGame(22);
    refillSchedule(s);
    // every stand taken: nothing can be cleared and the sky fills up
    for (const st of s.stands) st.reserved = 999999;
    s.contracts[0].perDay = 30;
    for (let i = 0; i < 30 * 400; i++) stepGame(s);
    expect(arrivalsBoard(s).some((r) => r.status === 'delayed' || r.status === 'holding')).toBe(true);
  });
});

describe('stand room shared between airlines', () => {
  it('two airlines flying the same size of plane share its stands: the second is offered only what is left', () => {
    const { airlineStandCap, airlineStandRoom, applyStructural, createGame, makeOffer, signOffer, switchTier, layoutOf } = SIM;
    const s = createGame(77);
    switchTier(s, 4);
    for (const st of layoutOf(4).stands) if (st.line) s.upg[st.line] = Math.max(s.upg[st.line] ?? 0, st.level ?? 1);
    s.upg.lounge = 1;
    s.upgRev++;
    applyStructural(s);
    s.contracts = [];
    // large-jet airlines that could sign here
    const big = AIRLINES.map((_, i) => i).filter((i) => {
      s.rep[i] = 100;
      return !SIM.airlineBlocker(s, i) && airlineStandCap(s, i) > 0 && AIRCRAFT[SIM.fleetHere(s, i)[0]]?.stand === 'large';
    });
    expect(big.length).toBeGreaterThanOrEqual(2);
    const [a, b] = big;
    const cap = airlineStandCap(s, b);
    expect(airlineStandRoom(s, b)).toBe(cap);
    const o = makeOffer(s, a);
    s.offers.push(o);
    expect(signOffer(s, o.id)).toBe(0);
    expect(airlineStandRoom(s, b)).toBe(Math.max(0, cap - o.perDay));
    // and an offer from the second never asks for more than that
    if (airlineStandRoom(s, b) > 0) expect(makeOffer(s, b).perDay).toBeLessThanOrEqual(airlineStandRoom(s, b));
  });
});
