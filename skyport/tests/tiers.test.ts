import { describe, expect, it } from 'vitest';

import { STAFF_ROLES } from '../src/data/staff';
import { layoutFor, TIERS } from '../src/data/tiers';
import {
  applyStructural,
  Big,
  botCommands,
  checkTier,
  createGame,
  decorPos,
  decorSpotOk,
  eventsSince,
  flightRevenueFor,
  graphOf,
  isGround,
  layoutOf,
  makeApplicant,
  onRunway,
  parseSave,
  queueCommand,
  REJECT,
  runFor,
  serializeGame,
  stepGame,
  switchTier,
  type GameState,
} from '../src/sim';

function ready(seed = 1): GameState {
  const s = createGame(seed);
  s.stats.served = 20;
  s.rating = 4;
  s.money = Big.fromNumber(10000);
  return s;
}

function send(s: GameState, cmd: Parameters<typeof queueCommand>[1]) {
  queueCommand(s, cmd);
  stepGame(s);
}

describe('airport tiers', () => {
  it('needs flights, rating and money before building', () => {
    const s = createGame(1);
    send(s, { type: 'upgradeTier' });
    expect(eventsSince(s, 0).some((e) => e.kind === 'cmdRejected' && e.a === REJECT.needs)).toBe(true);
    expect(s.tierBuild).toBeNull();
    const t = ready();
    expect(checkTier(t).ok).toBe(true);
    send(t, { type: 'upgradeTier' });
    expect(t.tierBuild?.to).toBe(2);
    expect(t.money.toNumber()).toBe(10000 - TIERS[1].needs.cost);
  });

  it('switches only when no plane is on the ground, and landings wait meanwhile', () => {
    const s = ready(3);
    for (let r = 0; r < STAFF_ROLES.length; r++) {
      const a = makeApplicant(s, r);
      s.applicants.push(a);
      send(s, { type: 'hire', applicantId: a.id });
    }
    runFor(s, 60);
    send(s, { type: 'upgradeTier' });
    let sawSwitching = false;
    for (let i = 0; i < 30 * 600 && s.tier === 1; i++) {
      stepGame(s);
      if (s.tierSwitch) {
        sawSwitching = true;
        // nobody new is cleared while we wait
        for (const f of s.flights) if (f.phase === 'final' && f.phaseT < 0.05) throw new Error('a landing started while switching');
      }
    }
    expect(s.tier).toBe(2);
    expect(sawSwitching).toBe(true);
    expect(eventsSince(s, 0).some((e) => e.kind === 'tierUp')).toBe(true);
    // the game keeps running on the new map
    const served = s.stats.served;
    runFor(s, 600);
    expect(s.stats.served).toBeGreaterThan(served);
  });

  it('tier 2 keeps tier 1 in place and adds stands; stand upgrades go further', () => {
    const a = layoutFor(1);
    const b = layoutFor(2);
    for (const st of a.stands) expect(b.stands.find((x) => x.id === st.id)?.pos).toEqual(st.pos);
    expect(b.stands.length).toBeGreaterThan(a.stands.length);
    expect(b.approach).toEqual(a.approach);
    const s = ready(4);
    s.upg.stand = 2;
    s.upgRev++;
    send(s, { type: 'buyUpgrade', id: 'stand', count: 1 });
    expect(eventsSince(s, 0).some((e) => e.kind === 'cmdRejected' && e.a === REJECT.limit)).toBe(true);
    switchTier(s, 2);
    s.money = Big.fromNumber(1e6);
    send(s, { type: 'buyUpgrade', id: 'stand', count: 1 });
    expect(s.builds.length).toBe(1);
  });

  it('pays more at tier 2', () => {
    expect(flightRevenueFor(2)).toBeGreaterThan(flightRevenueFor(1) * 1.9);
  });

  it('the tier 2 graph is a DAG and 2000 flights on 5 stands never collide or jam', () => {
    const g = graphOf(2);
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
    const s = createGame(91);
    switchTier(s, 2);
    s.upg.stand = 4;
    s.upgRev++;
    applyStructural(s);
    s.traffic = 1.3;
    stepGame(s);
    expect(s.standsBuilt).toBe(5);
    const L = layoutOf(2);
    let minDist = Infinity;
    let steps = 0;
    while (s.stats.served + s.stats.diverted < 2000) {
      if (steps % 3 === 0) for (const c of botCommands(s, { reaction: 0.3 })) queueCommand(s, c);
      stepGame(s);
      steps++;
      if (steps > 30 * 3600 * 30) throw new Error('stalled');
      if (steps % 2) continue;
      const ground = s.flights.filter((f) => isGround(f) && !onRunway(f, L) && f.phase !== 'takeoff');
      for (let i = 0; i < ground.length; i++)
        for (let j = i + 1; j < ground.length; j++) minDist = Math.min(minDist, Math.hypot(ground[i].x - ground[j].x, ground[i].y - ground[j].y));
    }
    expect(s.stats.served).toBeGreaterThan(1900);
    expect(minDist).toBeGreaterThan(0.95);
  });
});

describe('build mode and names', () => {
  it('decorations move only to good spots, snapped to half tiles', () => {
    const s = createGame(1);
    s.upg.kiosk = 1;
    const L = layoutOf(1);
    // onto the runway: refused
    send(s, { type: 'moveDecor', id: 'kiosk', x: 20, y: L.runway.y });
    expect(eventsSince(s, 0).some((e) => e.kind === 'cmdRejected' && e.a === REJECT.badSpot)).toBe(true);
    // a grassy spot inside the fence
    send(s, { type: 'moveDecor', id: 'kiosk', x: 30.2, y: 19.1 });
    expect(decorPos(s, 'kiosk')).toEqual([30, 19]);
    expect(decorSpotOk(s, 'kiosk', 30, 19)).toBe(true);
    const r = parseSave(serializeGame(s, 0), 0);
    expect(r.ok && decorPos(r.state, 'kiosk')).toEqual([30, 19]);
  });

  it('names are cleaned and saved', () => {
    const s = createGame(1);
    send(s, { type: 'setProfile', manager: '  Noa\\u0000 Levi  ', airport: 'x'.repeat(80) });
    expect(s.profile.manager.length).toBeLessThanOrEqual(24);
    expect(s.profile.airport.length).toBe(24);
    const r = parseSave(serializeGame(s, 0), 0);
    expect(r.ok && r.state.profile).toEqual(s.profile);
  });
});
