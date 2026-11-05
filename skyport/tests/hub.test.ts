import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { AIRLINES } from '../src/data/airlines';
import { buildingWalls, crossesWall } from '../src/data/terminals';
import { applyStructural, Big, botCommands, createGame, layoutOf, makeOffer, PST, queueCommand, signOffer, stepGame, switchTier, type GameState } from '../src/sim';
import { AIRCRAFT } from '../src/data/aircraft';
import { APM_CAP, loungeSeat } from '../src/sim/game/apm';
import { freeStand } from '../src/sim/game/flights';
import { terminalFor } from '../src/sim/game/terminal';
import { layoutOf as layoutFor, satGate } from '../src/sim/game/layout';
import { railTrain, RAIL_PERIOD } from '../src/sim/game/rail';

/** The hub with everything built and big-jet airlines under contract, so Concourse D is busy. */
function hub(seed: number): GameState {
  const s = createGame(seed);
  switchTier(s, 6);
  for (const st of layoutOf(6).stands) if (st.line) s.upg[st.line] = Math.max(s.upg[st.line] ?? 0, st.level ?? 1);
  s.upg.lounge = 1;
  s.upg.ils = 3;
  s.upg.counters = 3;
  s.upg.lanes = 2;
  s.upg.kiosk = 3;
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.money = Big.fromNumber(1e12);
  s.nextIncidentAt = 1e12;
  s.stats.served = 5000;
  s.rep = s.rep.map(() => 100);
  s.contracts = [];
  for (const id of ['coralina', 'aurelia', 'meadowlark', 'sunhop']) {
    const o = makeOffer(s, AIRLINES.findIndex((a) => a.id === id));
    s.offers.push(o);
    signOffer(s, o.id);
  }
  return s;
}

describe('the hub', () => {
  it('has Concourse D with three jet-bridge gates, reached by the people mover', () => {
    const L = layoutFor(6);
    expect(L.sat).toBeDefined();
    const d = L.stands.map((st, i) => (satGate(L, i) ? st.id : '')).filter(Boolean);
    expect(d).toEqual(['D1', 'D2', 'D3']);
    // the gates by Terminal 3 are not in the satellite
    expect(satGate(L, L.stands.findIndex((st) => st.id === 'G1'))).toBe(false);
    // the cargo apron moved to the far end; the international airport keeps its own
    expect(L.stands.find((st) => st.id === 'C1')!.pos[0]).toBeGreaterThan(75);
    expect(layoutFor(5).stands.find((st) => st.id === 'C1')!.pos[0]).toBeLessThan(56);
  });

  it('the train calls on a timetable: in, doors open, out, gone', () => {
    const r = layoutFor(6).rail!;
    let dwell = 0;
    let shown = 0;
    let last = -Infinity;
    for (let t = 0; t < RAIL_PERIOD; t += 0.5) {
      const tr = railTrain(r, t);
      if (tr.dwell) {
        dwell++;
        expect(tr.x).toBe(r.stop);
      }
      if (tr.shown) {
        shown++;
        // always moving east
        expect(tr.x).toBeGreaterThanOrEqual(last - 1e-9);
        last = tr.x;
      }
    }
    expect(dwell).toBeGreaterThan(10);
    expect(shown).toBeLessThan(RAIL_PERIOD * 2);
    expect(railTrain(r, 5).x).toBe(railTrain(r, 5 + RAIL_PERIOD).x);
  });

  it('passengers for Concourse D ride the people mover out and back; nobody walks through a wall', () => {
    const s = hub(7);
    const L = layoutOf(6);
    const walls = [...buildingWalls(L.building!), ...buildingWalls(L.t3!.building), ...buildingWalls(L.sat!.building)];
    const seen = new Map<number, [number, number]>();
    let out = 0;
    let back = 0;
    let maxLoad = 0;
    let inD = 0;
    let byTrain = 0;
    let toTrain = 0;
    const servedD = new Set<number>();
    for (let i = 0; i < 30 * 1500; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.4 })) queueCommand(s, c);
      stepGame(s);
      maxLoad = Math.max(maxLoad, s.apm?.load.length ?? 0);
      for (const p of s.people) {
        if (p.state === PST.inApm) out++;
        if (p.state === PST.inApmA) back++;
        if (p.state === PST.toRail) toTrain++;
        const last = seen.get(p.id);
        if (!last && p.term === 1 && p.y < 3) byTrain++;
        // (riders move with the train, through the openings the track runs through)
        if (last && p.state !== PST.inApm && p.state !== PST.inApmA && crossesWall(walls, last, [p.x, p.y]))
          throw new Error(`person ${p.id} (state ${p.state}) went through a wall from ${last} to ${p.x.toFixed(2)},${p.y.toFixed(2)}`);
        seen.set(p.id, [p.x, p.y]);
        const b = L.sat!.building.box;
        if (p.x > b[0] && p.x < b[2] && p.y > b[1] && p.y < b[3]) inD++;
      }
      for (const f of s.flights) if (f.offBlockAt > 0 && f.stand >= 0 && satGate(L, f.stand)) servedD.add(f.id);
    }
    expect(out).toBeGreaterThan(200);
    expect(back).toBeGreaterThan(200);
    expect(maxLoad).toBeLessThanOrEqual(APM_CAP);
    expect(inD).toBeGreaterThan(2000);
    expect(servedD.size).toBeGreaterThan(3);
    expect(byTrain).toBeGreaterThan(5);
    expect(toTrain).toBeGreaterThan(5);
  }, 300000);
});

describe('the mega hub', () => {
  it('Terminal 4 takes the jumbos: only they park at its gates, and their passengers use it', () => {
    const L = layoutFor(7);
    expect(L.t4).toBeDefined();
    const condor = AIRCRAFT.findIndex((a) => a.id === 'condor');
    const albatross = AIRCRAFT.findIndex((a) => a.id === 'albatross');
    const s = createGame(3);
    switchTier(s, 7);
    for (const st of L.stands) if (st.line) s.upg[st.line] = Math.max(s.upg[st.line] ?? 0, st.level ?? 1);
    s.upgRev++;
    applyStructural(s);
    const e = L.stands.map((st, i) => (st.id.startsWith('E') ? i : -1)).filter((i) => i >= 0);
    expect(e.length).toBe(3);
    // a jumbo gets an E gate; a wide-body never does (even with every other stand taken)
    expect(e).toContain(freeStand(s, condor));
    for (let i = 0; i < L.stands.length; i++) if (!e.includes(i)) s.stands[i].occupant = 999;
    expect(freeStand(s, albatross)).toBe(-1);
    expect(terminalFor(s, { aircraft: condor } as Parameters<typeof terminalFor>[1])).toBe(2);
    expect(terminalFor(s, { aircraft: albatross } as Parameters<typeof terminalFor>[1])).toBe(1);
    // every lounge seat by a jumbo gate is inside the terminal
    const b = L.t4!.building.box;
    for (const i of e)
      for (let k = 0; k < 12; k++) {
        const [x, y] = loungeSeat(L, i, k);
        expect(x > b[0] && x < b[2] && y > b[1] && y < b[3], `${L.stands[i].id} seat ${k}`).toBe(true);
      }
  });
});

describe('the skyport', () => {
  it('air taxis land on the vertiport pads and passengers come from the hotel', () => {
    const L = layoutFor(8);
    expect(L.hotel).toBeDefined();
    const pads = L.stands.map((st, i) => (st.id.startsWith('V') ? i : -1)).filter((i) => i >= 0);
    expect(pads.length).toBe(3);
    const s = createGame(8);
    switchTier(s, 8);
    for (const st of L.stands) if (st.line) s.upg[st.line] = Math.max(s.upg[st.line] ?? 0, st.level ?? 1);
    s.upg.lounge = 1;
    s.upg.ils = 3;
    s.upgRev++;
    applyStructural(s);
    stockUp(s);
    s.money = Big.fromNumber(1e14);
    s.nextIncidentAt = 1e12;
    s.stats.served = 30000;
    s.rep = s.rep.map(() => 100);
    s.contracts = [];
    for (const id of ['hoverly', 'aurelia', 'meadowlark']) {
      const o = makeOffer(s, AIRLINES.findIndex((a) => a.id === id));
      s.offers.push(o);
      signOffer(s, o.id);
    }
    const taxi = AIRCRAFT.findIndex((a) => a.id === 'skytaxi');
    const parkedOn = new Set<number>();
    let hotelGuests = 0;
    const seen = new Set<number>();
    const H = L.hotel!.door;
    for (let i = 0; i < 30 * 1200; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.4 })) queueCommand(s, c);
      stepGame(s);
      for (const f of s.flights) if (f.aircraft === taxi && f.stand >= 0 && f.phase === 'turnaround') parkedOn.add(f.stand);
      for (const p of s.people) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        if (Math.hypot(p.x - H[0], p.y - H[1]) < 0.5) hotelGuests++;
      }
    }
    // the taxis use the new pads (the old helipad is for the helicopters too)
    expect([...parkedOn].some((i) => pads.includes(i))).toBe(true);
    expect(hotelGuests).toBeGreaterThan(5);
  }, 300000);
});
