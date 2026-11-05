import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { AIRCRAFT, paxGroupOf, planeArt, standFits } from '../src/data/aircraft';
import { AIRLINES } from '../src/data/airlines';
import { TIERS } from '../src/data/tiers';
import {
  aircraftHere,
  applyCommand,
  applyStructural,
  botCommands,
  createGame,
  findRoute,
  graphOf,
  hasNeed,
  isGround,
  layoutOf,
  makeOffer,
  PST,
  queueCommand,
  stepGame,
  switchTier,
  type Flight,
  type GameState,
} from '../src/sim';
import { freeStand, runwayOf, spawnFlight, WAKE_GAP, wakeClearAt } from '../src/sim/game/flights';
import { flowOf } from '../src/sim/game/graph';

const ac = (id: string) => AIRCRAFT.findIndex((a) => a.id === id);
const al = (id: string) => AIRLINES.findIndex((a) => a.id === id);

/** An airport at a tier with every stand of the layout built. */
function airport(tier: number, seed = 1): GameState {
  const s = createGame(seed);
  switchTier(s, tier);
  for (const st of layoutOf(tier).stands) if (st.line) s.upg[st.line] = Math.max(s.upg[st.line] ?? 0, st.level ?? 1);
  s.upg.lounge = 1;
  s.upg.ils = 3;
  s.upg.counters = 3;
  s.upg.lanes = 2;
  s.upg.scanner = 10;
  s.upg.conveyor = 10;
  s.upg.truck2 = 5;
  s.upg.cart2 = 5;
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.stats.served = 5000;
  return s;
}

function sign(s: GameState, id: string, perDay: number): void {
  const o = makeOffer(s, al(id));
  o.perDay = perDay;
  s.offers.push(o);
  applyCommand(s, { type: 'signOffer', offerId: o.id });
}

describe('layouts of the bigger airports', () => {
  it('the hangar taxi loop keeps clear of every other taxi link', () => {
    const segDist = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) => {
      const pt = (px: number, py: number, x0: number, y0: number, x1: number, y1: number) => {
        const vx = x1 - x0;
        const vy = y1 - y0;
        const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy || 1)));
        return Math.hypot(px - x0 - vx * t, py - y0 - vy * t);
      };
      // (segments that cross have distance 0: checked through the endpoints and an orientation test)
      const o = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => Math.sign((x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0));
      if (o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0) return 0;
      return Math.min(pt(ax, ay, cx, cy, dx, dy), pt(bx, by, cx, cy, dx, dy), pt(cx, cy, ax, ay, bx, by), pt(dx, dy, ax, ay, bx, by));
    };
    for (const t of TIERS.filter((x) => x.layout && x.id >= 3)) {
      const g = graphOf(t.id);
      for (let i = 0; i < g.edges.length; i++) {
        for (let j = i + 1; j < g.edges.length; j++) {
          const a = g.edges[i];
          const b = g.edges[j];
          if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
          const hangar = (e: typeof a) => /^H[WG]/.test(g.ids[e.from]) || /^H[WG]/.test(g.ids[e.to]);
          if (!hangar(a) && !hangar(b)) continue;
          const [ax, ay] = g.pos[a.from];
          const [bx, by] = g.pos[a.to];
          const [cx, cy] = g.pos[b.from];
          const [dx, dy] = g.pos[b.to];
          const d = segDist(ax, ay, bx, by, cx, cy, dx, dy);
          // (the same clearance the traffic tests demand between any two planes on the ground)
          expect(d, `tier ${t.id}: ${g.ids[a.from]}>${g.ids[a.to]} vs ${g.ids[b.from]}>${g.ids[b.to]}`).toBeGreaterThan(0.95);
        }
      }
    }
  });

  it('a plane waiting at the hold short point has its whole tail off every arrival lane', () => {
    for (const t of TIERS) {
      const L = layoutOf(t.id);
      const g = graphOf(t.id);
      const tail = Math.max(...L.stands.map((st) => Math.max(0, ...AIRCRAFT.map((a, i) => (standFits(st.size, a.stand) ? planeArt(i).length * 0.5 + 0.35 : 0)))));
      for (const dir of L.rev ? [1, -1] : [1]) {
        const flow = flowOf(g, dir);
        for (const sn of g.standNode) {
          if (sn < 0) continue;
          const r = findRoute(g, sn, flow.holdShort)!;
          let len = 0;
          for (let i = r.length - 1; i >= 0 && flow.safe[r[i]]; i--) len += g.edges[r[i]].len;
          expect(len, `tier ${t.id} dir ${dir}`).toBeGreaterThan(tail + 0.3);
        }
      }
    }
  });

  for (const t of TIERS.filter((x) => x.layout)) {
    it(`tier ${t.id}: in each runway direction every stand is reachable, arrivals and departures each flow one way`, () => {
      const g = graphOf(t.id);
      const acyclic = (used: Set<number>): boolean => {
        const seen = new Set<number>();
        const visiting = new Set<number>();
        const dfs = (n: number): boolean => {
          if (visiting.has(n)) return false;
          if (seen.has(n)) return true;
          visiting.add(n);
          for (const e of g.out[n]) if (used.has(e) && !dfs(g.edges[e].to)) return false;
          visiting.delete(n);
          seen.add(n);
          return true;
        };
        for (let n = 0; n < g.ids.length; n++) if (!dfs(n)) return false;
        return true;
      };
      for (const [dir, flow] of g.flows) {
        const arrivals = new Set<number>();
        const departures = new Set<number>();
        g.standNode.forEach((sn, i) => {
          if (sn < 0) return;
          const inR = findRoute(g, flow.standExit[i], sn);
          const outR = findRoute(g, sn, flow.holdShort);
          expect(inR, `dir ${dir}: in to ${g.ids[sn]}`).not.toBeNull();
          expect(outR, `dir ${dir}: out of ${g.ids[sn]}`).not.toBeNull();
          for (const e of inR!) arrivals.add(e);
          for (const e of outR!) departures.add(e);
          // a departure's first waiting spot is somewhere on its way (it never sits on the shared lane)
          expect(outR!.some((e) => flow.safe[e]), `dir ${dir}: ${g.ids[sn]} has a waiting spot`).toBe(true);
        });
        expect(acyclic(arrivals), `dir ${dir}: arrivals`).toBe(true);
        expect(acyclic(departures), `dir ${dir}: departures`).toBe(true);
        // waiting spots are never on an arrival route
        for (const e of arrivals) expect(flow.safe[e]).toBe(false);
      }
      expect(g.flows.has(-1)).toBe(t.id >= 3);
    });

    it(`tier ${t.id}: parked planes do not overlap each other or the buildings`, () => {
      const L = t.layout!;
      // the biggest aircraft each stand takes at this tier, parked along x
      const boxes = L.stands.map((st) => {
        let len = 0;
        let span = 0;
        AIRCRAFT.forEach((a, k) => {
          if (a.unlockTier <= t.id && standFits(st.size, a.stand)) {
            const art = planeArt(k);
            if (art.length > len) {
              len = art.length;
              span = art.span;
            }
          }
        });
        return { id: st.id, x: st.pos[0], y: st.pos[1], len, span };
      });
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          if (a.len === 0 || b.len === 0) continue;
          // fuselages (length x a slim width) must not overlap; wingtips may pass over each other a little
          const overlapX = (a.len + b.len) / 2 - Math.abs(a.x - b.x);
          const overlapY = 0.5 - Math.abs(a.y - b.y);
          expect(overlapX > 0.15 && overlapY > 0, `${a.id} and ${b.id}`).toBe(false);
        }
        for (const bd of L.buildings ?? []) {
          const a = boxes[i];
          if (a.len === 0 || L.stands[i].size === 'heli') continue;
          const inX = a.x + a.len / 2 > bd.pos[0] && a.x - a.len / 2 < bd.pos[0] + bd.size[0];
          const inY = a.y + 0.3 > bd.pos[1] && a.y - 0.3 < bd.pos[1] + bd.size[1];
          expect(inX && inY, `${a.id} in a ${bd.kind}`).toBe(false);
        }
      }
    });
  }
});

describe('stands and the fleet', () => {
  it('bigger stands take smaller planes, special stands only their own kind', () => {
    expect(standFits('large', 'medium')).toBe(true);
    expect(standFits('medium', 'large')).toBe(false);
    expect(standFits('huge', 'large')).toBe(true);
    expect(standFits('fbo', 'small')).toBe(false);
    expect(standFits('cargo', 'cargo')).toBe(true);
    expect(standFits('large', 'cargo')).toBe(false);
    expect(standFits('heli', 'heli')).toBe(true);
  });

  it('a plane gets the smallest free stand it fits', () => {
    const s = airport(4);
    const L = layoutOf(4);
    const st = freeStand(s, ac('heron'));
    expect(L.stands[st].size).toBe('medium');
    const big = freeStand(s, ac('albatross'));
    expect(L.stands[big].size).toBe('huge');
    expect(L.stands[freeStand(s, ac('pelican'))].size).toBe('cargo');
    expect(L.stands[freeStand(s, ac('sparrow'))].size).toBe('small');
  });

  it('aircraft come only when a stand fits them and their tier is reached', () => {
    const s = createGame(3);
    switchTier(s, 3);
    s.stats.served = 999;
    expect(aircraftHere(s, ac('heron'))).toBe(false); // no medium stand built yet
    s.upg.standMed = 1;
    s.upgRev++;
    applyStructural(s);
    expect(aircraftHere(s, ac('heron'))).toBe(true);
    expect(aircraftHere(s, ac('kestrel'))).toBe(false);
    expect(aircraftHere(s, ac('falcon'))).toBe(false); // tier 4
    s.upg.fbo = 1;
    s.upgRev++;
    applyStructural(s);
    expect(aircraftHere(s, ac('kestrel'))).toBe(true);
  });

  it('airline needs follow what is built', () => {
    const s = createGame(4);
    switchTier(s, 4);
    for (const n of ['fbo', 'cargoApron', 'jetBridge', 'lounge'] as const) expect(hasNeed(s, n), n).toBe(false);
    s.upg.fbo = 1;
    s.upg.cargoApron = 1;
    s.upg.gates = 1;
    s.upg.lounge = 1;
    s.upgRev++;
    applyStructural(s);
    for (const n of ['fbo', 'cargoApron', 'jetBridge', 'lounge'] as const) expect(hasNeed(s, n), n).toBe(true);
  });

  it('passengers walk in groups on big planes (every passenger still counts)', () => {
    expect(paxGroupOf(AIRCRAFT[ac('sparrow')])).toBe(1);
    expect(paxGroupOf(AIRCRAFT[ac('albatross')])).toBeGreaterThan(20);
  });
});

describe('runways and wake turbulence', () => {
  it('a light plane waits behind a heavy one; equal light planes do not', () => {
    const s = createGame(5);
    const f = spawnFlight(s)!;
    s.time = 100;
    s.wake[0] = { cat: 2, at: 100 };
    expect(wakeClearAt(s, 1, f)).toBe(100 + WAKE_GAP[2][0]);
    s.wake[0] = { cat: 0, at: 100 };
    expect(wakeClearAt(s, 1, f)).toBe(100);
  });

  it('with a departures runway, takeoffs and landings use different runways at the same time', () => {
    const s = airport(5, 9);
    sign(s, 'bluefin', 18);
    let both = 0;
    let conflict = 0;
    const L = layoutOf(5);
    for (let i = 0; i < 30 * 1500; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.3 })) queueCommand(s, c);
      stepGame(s);
      const r1 = s.flights.filter((f) => runwayOf(f, L) === 1).length;
      const r2 = s.flights.filter((f) => runwayOf(f, L) === 2).length;
      if (r1 > 1 || r2 > 1) conflict++;
      if (r1 === 1 && r2 === 1) both++;
    }
    expect(conflict).toBe(0);
    expect(both).toBeGreaterThan(0);
    expect(s.stats.served).toBeGreaterThan(20);
  });
});

describe('special flights', () => {
  function runUntilServed(s: GameState, pick: (f: Flight) => boolean, seconds: number): { seen: Set<string>; served: boolean; f?: Flight } {
    const seen = new Set<string>();
    let target: Flight | undefined;
    let served = false;
    for (let i = 0; i < 30 * seconds && !served; i++) {
      if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.4 })) queueCommand(s, c);
      stepGame(s);
      if (!target) target = s.flights.find(pick);
      if (target) {
        seen.add(target.phase);
        if (target.paid > 0) served = true;
      }
    }
    return { seen, served, f: target };
  }

  it('a helicopter lands on the pad and leaves without the runway or taxiways', () => {
    const s = airport(5, 11);
    s.contracts = [];
    s.rep[al('velvet')] = 100;
    sign(s, 'velvet', 10);
    const r = runUntilServed(s, (f) => AIRCRAFT[f.aircraft].id === 'dragonfly', 900);
    expect(r.f).toBeDefined();
    expect(r.served).toBe(true);
    for (const ph of ['landing', 'rollout', 'taxiIn', 'taxiOut', 'lineUp']) expect(r.seen.has(ph as never), ph).toBe(false);
    expect(layoutOf(5).stands[r.f!.stand].size).toBe('heli');
  });

  it('a freighter carries pallets, no passengers, and gets paid', () => {
    const s = airport(4, 12);
    s.contracts = [];
    sign(s, 'ironbird', 10);
    const r = runUntilServed(s, (f) => AIRCRAFT[f.aircraft].id === 'pelican', 900);
    expect(r.served).toBe(true);
    expect(r.f!.paxIn + r.f!.paxOut).toBe(0);
    expect(r.f!.bagsIn).toBeGreaterThan(0);
    expect(layoutOf(4).stands[r.f!.stand].size).toBe('cargo');
  });

  it('a jet-bridge gate boards from the pier, and groups add up to the full load', () => {
    const s = airport(4, 13);
    s.contracts = [];
    s.rep[al('aurelia')] = 30;
    sign(s, 'aurelia', 10);
    let atPier = 0;
    const r = (() => {
      const seen = new Set<string>();
      let target: Flight | undefined;
      for (let i = 0; i < 30 * 900; i++) {
        if (i % 3 === 0) for (const c of botCommands(s, { reaction: 0.4 })) queueCommand(s, c);
        stepGame(s);
        if (!target) target = s.flights.find((f) => layoutOf(4).stands[f.stand]?.bridge === true);
        if (target) {
          seen.add(target.phase);
          for (const p of s.people) if (p.flight === target.id && p.state === PST.waiting && p.y < 19) atPier++;
          if (target.paid > 0) return { target, seen };
        }
      }
      return { target, seen };
    })();
    expect(r.target).toBeDefined();
    expect(r.target!.paid).toBeGreaterThan(0);
    expect(r.target!.boarded).toBe(r.target!.paxOut);
    expect(atPier).toBeGreaterThan(0);
  });
});

describe('the international airport under load', () => {
  it('2000 flights of every kind: one plane per runway, no ground collisions, no jams', () => {
    const s = airport(5, 21);
    s.contracts = [];
    // a mix the stands can take (gates, the cargo apron and the pad are single stands)
    const mix: Record<string, number> = { meadowlark: 10, sunhop: 4, aurelia: 3, coralina: 2, ironbird: 2, velvet: 3 };
    for (const id of Object.keys(mix)) {
      s.rep[al(id)] = 100;
      sign(s, id, mix[id]);
    }
    const L = layoutOf(5);
    const kinds = new Set<string>();
    let minDist = Infinity;
    let steps = 0;
    const start = s.stats.served;
    while (s.stats.served - start + s.stats.diverted < 2000) {
      if (steps % 3 === 0) for (const c of botCommands(s, { reaction: 0.3 })) queueCommand(s, c);
      stepGame(s);
      steps++;
      if (steps > 30 * 3600 * 40) throw new Error('stalled');
      for (const f of s.flights) kinds.add(AIRCRAFT[f.aircraft].id);
      if (steps % 2) continue;
      expect(s.flights.filter((f) => runwayOf(f, L) === 1).length).toBeLessThanOrEqual(1);
      expect(s.flights.filter((f) => runwayOf(f, L) === 2).length).toBeLessThanOrEqual(1);
      const ground = s.flights.filter((f) => isGround(f) && runwayOf(f, L) === 0 && f.phase !== 'takeoff' && AIRCRAFT[f.aircraft].stand !== 'heli');
      for (let i = 0; i < ground.length; i++)
        for (let j = i + 1; j < ground.length; j++) minDist = Math.min(minDist, Math.hypot(ground[i].x - ground[j].x, ground[i].y - ground[j].y));
    }
    expect(s.stats.served - start).toBeGreaterThan(1900);
    expect(minDist).toBeGreaterThan(0.95);
    for (const id of ['sparrow', 'heron', 'falcon', 'albatross', 'pelican', 'kestrel', 'dragonfly']) expect(kinds.has(id), id).toBe(true);
  }, 300000);
});

describe('runway direction', () => {
  function busy(tier: number, seed: number): GameState {
    const s = airport(tier, seed);
    s.contracts = [];
    const mix: Record<string, number> = tier >= 4 ? { meadowlark: 10, sunhop: 4, aurelia: 3, ironbird: 2, velvet: 3 } : { meadowlark: 10, sunhop: 4, velvet: 3 };
    for (const id of Object.keys(mix)) {
      s.rep[al(id)] = 100;
      sign(s, id, mix[id]);
    }
    return s;
  }

  function run(s: GameState, flights: number, flipEvery: number): { served: number; minDist: number; conflicts: number } {
    const L = layoutOf(s.tier);
    const start = s.stats.served;
    let minDist = Infinity;
    let conflicts = 0;
    let steps = 0;
    while (s.stats.served - start + s.stats.diverted < flights) {
      if (flipEvery > 0 && steps % (30 * flipEvery) === 0) s.forceDir = s.forceDir === -1 ? 1 : -1;
      if (steps % 3 === 0) for (const c of botCommands(s, { reaction: 0.3 })) queueCommand(s, c);
      stepGame(s);
      steps++;
      if (steps > 30 * 3600 * 30) throw new Error('stalled');
      if (steps % 2) continue;
      if (s.flights.filter((f) => runwayOf(f, L) === 1).length > 1 || s.flights.filter((f) => runwayOf(f, L) === 2).length > 1) conflicts++;
      const ground = s.flights.filter((f) => isGround(f) && runwayOf(f, L) === 0 && f.phase !== 'takeoff' && AIRCRAFT[f.aircraft].stand !== 'heli');
      for (let i = 0; i < ground.length; i++)
        for (let j = i + 1; j < ground.length; j++) minDist = Math.min(minDist, Math.hypot(ground[i].x - ground[j].x, ground[i].y - ground[j].y));
    }
    return { served: s.stats.served - start, minDist, conflicts };
  }

  for (const tier of [3, 4, 5, 6, 7]) {
    it(`tier ${tier}: 600 flights landing and taking off the other way`, () => {
      const s = busy(tier, 30 + tier);
      s.forceDir = -1;
      const r = run(s, 600, 0);
      expect(r.conflicts).toBe(0);
      expect(r.minDist).toBeGreaterThan(0.95);
      expect(r.served).toBeGreaterThan(570);
    }, 300000);
  }

  it('tier 4: 600 flights with the wind turning every 3 minutes', () => {
    const s = busy(4, 52);
    const r = run(s, 600, 180);
    expect(r.conflicts).toBe(0);
    expect(r.minDist).toBeGreaterThan(0.95);
    expect(r.served).toBeGreaterThan(570);
  }, 300000);

  it('tier 5: 600 flights with the wind turning every 4 minutes', () => {
    const s = busy(5, 41);
    const r = run(s, 600, 240);
    expect(r.conflicts).toBe(0);
    expect(r.minDist).toBeGreaterThan(0.95);
    expect(r.served).toBeGreaterThan(570);
  }, 300000);

  it('tier 6: 600 flights with the wind turning every 4 minutes', () => {
    const s = busy(6, 43);
    const r = run(s, 600, 240);
    expect(r.conflicts).toBe(0);
    expect(r.minDist).toBeGreaterThan(0.95);
    expect(r.served).toBeGreaterThan(570);
  }, 300000);

  it('tier 7: 600 flights with the wind turning every 4 minutes, jumbos at Terminal 4', () => {
    // (as many flights a day as the tier 6 test: the mega hub has more traffic and the jumbos'
    // wake keeps the landing runway busier, so a fuller mix is a runway test, not a taxi one)
    const s = busy(7, 44);
    s.contracts = s.contracts.filter((c) => c.al !== al('sunhop'));
    for (const [id, n] of [['sunhop', 2], ['globetrail', 2]] as const) {
      s.rep[al(id)] = 100;
      sign(s, id, n);
    }
    const r = run(s, 600, 240);
    expect(r.conflicts).toBe(0);
    expect(r.minDist).toBeGreaterThan(0.95);
    expect(r.served).toBeGreaterThan(570);
  }, 300000);
});
