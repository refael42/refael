import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { AIRLINES } from '../src/data/airlines';
import { buildingWalls, crossesWall } from '../src/data/terminals';
import { applyStructural, Big, botCommands, createGame, layoutOf, makeOffer, PST, queueCommand, signOffer, stepGame, switchTier, type GameState } from '../src/sim';
import { BUS_CAP, bussed } from '../src/sim/game/buses';
import { sendPaxHome } from '../src/sim/game/people';

function regional(seed: number): GameState {
  const s = createGame(seed);
  switchTier(s, 3);
  s.upg.stand = 4;
  s.upg.standMed = 2;
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.money = Big.fromNumber(1e9);
  s.nextIncidentAt = 1e12;
  // an airline with medium planes, so the medium stands out east get used
  s.contracts = [];
  s.rep = s.rep.map(() => 100);
  for (const id of ['cloudberry', 'meadowlark']) {
    const o = makeOffer(s, AIRLINES.findIndex((a) => a.id === id));
    s.offers.push(o);
    signOffer(s, o.id);
  }
  return s;
}

describe('apron buses', () => {
  it('the small stands in front of the terminal are walked to; the medium ones out east get the bus', () => {
    const s = regional(1);
    const L = layoutOf(3);
    const near = L.stands.findIndex((st) => st.id === 'S2');
    const far = L.stands.findIndex((st) => st.id === 'M1');
    const f = { stand: near, aircraft: 0 } as Parameters<typeof bussed>[1];
    expect(bussed(s, f)).toBe(false);
    expect(bussed(s, { ...f, stand: far })).toBe(true);
    // the dirt strip and the small airfield need no bus
    expect(layoutOf(1).terminal.busStop).toBeUndefined();
  });

  it('passengers of a plane at a remote stand ride the bus out and back, and the flights go on', () => {
    const s = regional(2);
    let rode = 0;
    let rodeIn = 0;
    let maxLoad = 0;
    const servedFar = new Set<number>();
    for (let i = 0; i < 30 * 1500; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.6 })) queueCommand(s, c);
      stepGame(s);
      for (const b of s.buses) maxLoad = Math.max(maxLoad, b.load.length);
      for (const p of s.people) {
        if (p.state === PST.inBus) rode++;
        if (p.state === PST.inBusA) rodeIn++;
      }
      for (const f of s.flights) if (f.offBlockAt > 0 && bussed(s, f)) servedFar.add(f.id);
    }
    expect(s.buses.length).toBe(2);
    expect(rode).toBeGreaterThan(100);
    expect(rodeIn).toBeGreaterThan(100);
    expect(maxLoad).toBeLessThanOrEqual(BUS_CAP);
    expect(servedFar.size).toBeGreaterThan(2);
    // nobody is left waiting at a plane that has gone, or on a bus forever
    const flights = new Set(s.flights.map((f) => f.id));
    for (const p of s.people) if (p.state === PST.waitBus || p.state === PST.atBusA) expect(flights.has(p.flight) || s.buses.some((b) => b.flight === p.flight)).toBe(true);
  }, 240000);

  it('passengers out on the apron whose plane left without them walk back in through the gate door', () => {
    const s = regional(3);
    const L = layoutOf(3);
    const walls = buildingWalls(L.building!);
    // run until someone is on a bus or at the stop, then make their flight leave
    let target = -1;
    for (let i = 0; i < 30 * 1500 && target < 0; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.6 })) queueCommand(s, c);
      stepGame(s);
      const p = s.people.find((q) => q.state === PST.inBus || q.state === PST.atBusStop);
      if (p) target = p.flight;
    }
    expect(target).toBeGreaterThan(0);
    const f = s.flights.find((x) => x.id === target)!;
    const sent = s.people.filter((p) => p.flight === target && (p.state === PST.inBus || p.state === PST.atBusStop || p.state === PST.toBus)).map((p) => p.id);
    expect(sent.length).toBeGreaterThan(0);
    sendPaxHome(s, f);
    const seen = new Map<number, [number, number]>();
    for (let i = 0; i < 30 * 120; i++) {
      stepGame(s);
      for (const p of s.people) {
        if (!sent.includes(p.id)) continue;
        expect(p.state).toBe(PST.leaving);
        const last = seen.get(p.id);
        if (last && crossesWall(walls, last, [p.x, p.y])) throw new Error(`person ${p.id} went through a wall from ${last} to ${p.x},${p.y}`);
        seen.set(p.id, [p.x, p.y]);
      }
    }
    // they all made it out
    expect(s.people.some((p) => sent.includes(p.id))).toBe(false);
  }, 240000);
});
