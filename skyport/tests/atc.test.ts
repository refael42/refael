import { describe, expect, it } from 'vitest';

import { AIRCRAFT } from '../src/data/aircraft';
import {
  applyStructural,
  createGame,
  CROSSWIND_LIMIT,
  crosswind,
  foggedIn,
  stepGame,
  switchTier,
  weatherAt,
  WX_KEY,
  type GameState,
} from '../src/sim';
import { approachBlocker, mustGoAround, spawnFlight, WAKE_GAP, wakeClearAt } from '../src/sim/game/flights';
import { GUEST_BONUS, layoutOf, queueCommand, botCommands, eventsSince } from '../src/sim';

const ac = (id: string) => AIRCRAFT.findIndex((a) => a.id === id);

/** First time (scanning keyframes) where the weather matches. */
function findTime(seed: number, tier: number, ok: (w: ReturnType<typeof weatherAt>) => boolean, from = 0): number {
  for (let t = from; t < 3600 * 40; t += WX_KEY / 4) if (ok(weatherAt(seed, t, tier))) return t;
  throw new Error('no such weather');
}

function at(s: GameState, time: number): void {
  s.tick = Math.round(time * 30);
  s.time = s.tick / 30;
}

describe('weather', () => {
  it('is the same for the same seed and moves smoothly', () => {
    for (let t = 0; t < 3000; t += 7) {
      const a = weatherAt(5, t);
      expect(weatherAt(5, t)).toEqual(a);
      const b = weatherAt(5, t + 1 / 30);
      expect(Math.abs(b.speed - a.speed)).toBeLessThan(0.2);
      expect(Math.abs(b.vis - a.vis)).toBeLessThan(0.02);
    }
    expect(weatherAt(5, 900)).not.toEqual(weatherAt(6, 900));
  });

  it('fog is never thicker than the best ILS the tier can buy', () => {
    const floor = [0, 0, 0.3, 0.15, 0, 0];
    for (let tier = 2; tier <= 5; tier++) for (let t = 0; t < 3600 * 10; t += 30) expect(weatherAt(3, t, tier).vis).toBeGreaterThanOrEqual(floor[tier]);
  });

  it('the dirt strip never gets fog; bigger airports sometimes do', () => {
    let fog1 = 0;
    let fog2 = 0;
    for (let t = 0; t < 3600 * 10; t += 30) {
      if (weatherAt(3, t, 1).vis < 0.5) fog1++;
      if (weatherAt(3, t, 2).vis < 0.5) fog2++;
    }
    expect(fog1).toBe(0);
    expect(fog2).toBeGreaterThan(0);
  });

  it('the wind is mostly from the east', () => {
    let east = 0;
    let n = 0;
    for (let t = 0; t < 3600 * 20; t += 60, n++) if (Math.cos(weatherAt(9, t).windTo) < 0) east++;
    expect(east / n).toBeGreaterThan(0.55);
    expect(east / n).toBeLessThan(0.95);
  });
});

describe('air traffic control', () => {
  it('fixed weather (for screenshots) is used everywhere the weather is read', () => {
    const s = createGame(2);
    switchTier(s, 3);
    s.wxForce = { windTo: 0, speed: 14, vis: 0.05 };
    expect(foggedIn(s)).toBe(true);
    stepGame(s);
    expect(s.rwyDir).toBe(-1);
    expect(s.wxFog).toBe(true);
  });

  it('fog keeps planes out unless the ILS can bring them in', () => {
    const s = createGame(4);
    switchTier(s, 2);
    const t = findTime(s.seed, 2, (w) => w.vis < 0.4);
    at(s, t);
    const f = spawnFlight(s)!;
    expect(foggedIn(s)).toBe(true);
    expect(approachBlocker(s, f)).toBe('fog');
    s.upg.ils = 3;
    s.upgRev++;
    applyStructural(s);
    expect(foggedIn(s)).toBe(false);
    expect(approachBlocker(s, f)).not.toBe('fog');
  });

  it('a strong crosswind keeps light planes waiting but not bigger ones', () => {
    const s = createGame(8);
    switchTier(s, 3);
    s.upg.ils = 3;
    s.upgRev++;
    applyStructural(s);
    const t = findTime(s.seed, 3, (w) => crosswind(w) > CROSSWIND_LIMIT[0] + 0.5 && crosswind(w) < CROSSWIND_LIMIT[1] - 0.5);
    at(s, t);
    const light = spawnFlight(s)!;
    light.aircraft = ac('sparrow');
    const medium = spawnFlight(s)!;
    medium.aircraft = ac('heron');
    expect(approachBlocker(s, light)).toBe('crosswind');
    expect(approachBlocker(s, medium)).not.toBe('crosswind');
  });

  it('a better tower spaces planes closer behind a heavy', () => {
    const s = createGame(5);
    const f = spawnFlight(s)!;
    s.wake[0] = { cat: 2, at: 100 };
    const before = wakeClearAt(s, 1, f) - 100;
    expect(before).toBeCloseTo(WAKE_GAP[2][0], 6);
    s.upg.tower = 3;
    s.upgRev++;
    expect(wakeClearAt(s, 1, f) - 100).toBeCloseTo(WAKE_GAP[2][0] * 0.7, 6);
  });

  it('radar lets planes circle longer before they divert', () => {
    const run = (radar: number) => {
      const s = createGame(6);
      s.upg.radar = radar;
      s.upgRev++;
      const f = spawnFlight(s)!;
      // nowhere to park: it circles until it gives up
      for (const st of s.stands) st.reserved = 999999;
      let t = 0;
      while (f.phase !== 'diverted' && t < 30 * 600) {
        stepGame(s);
        t++;
      }
      return t;
    };
    expect(run(2)).toBeGreaterThan(run(0) * 1.3);
  });

  it('departures do not wait for landings the fog keeps out', () => {
    const s = createGame(12);
    switchTier(s, 2);
    s.upg.stand = 1;
    s.upgRev++;
    applyStructural(s);
    const t = findTime(s.seed, 2, (w) => w.vis < 0.4, 600);
    at(s, t);
    const dep = spawnFlight(s)!;
    const arr = spawnFlight(s)!;
    dep.phase = 'holdShort';
    dep.takeoffCleared = true;
    arr.phase = 'holding';
    arr.landCleared = true;
    arr.stand = 1;
    let lined = false;
    for (let i = 0; i < 30 * 10 && !lined; i++) {
      stepGame(s);
      const ph: string = dep.phase;
      lined = ph === 'lineUp' || ph === 'takeoff';
    }
    expect(foggedIn(s)).toBe(true);
    expect(lined).toBe(true);
  });
});

describe('runway change', () => {
  it('waits until nobody on the ground is still headed the old way', () => {
    const s = createGame(2);
    switchTier(s, 3);
    s.upg.ils = 3;
    s.upgRev++;
    applyStructural(s);
    s.wxForce = { windTo: Math.PI, speed: 14, vis: 1 };
    stepGame(s);
    expect(s.rwyDir).toBe(1);
    const f = spawnFlight(s)!;
    f.phase = 'taxiOut';
    s.wxForce = { windTo: 0, speed: 14, vis: 1 };
    stepGame(s);
    expect(s.rwyDir).toBe(1);
    expect(s.turning).toBe(-1);
    f.phase = 'turnaround';
    stepGame(s);
    expect(s.rwyDir).toBe(-1);
    expect(s.turning).toBe(0);
  });
});

describe('go-arounds', () => {
  it('a plane at the threshold goes around while the runway is still taken', () => {
    const s = createGame(3);
    const L = layoutOf(1);
    const f = spawnFlight(s)!;
    const o = spawnFlight(s)!;
    o.phase = 'rollout';
    expect(mustGoAround(s, f, L)).toBe(true);
    o.phase = 'taxiIn';
    // calm day, no fog: only the small base risk of an unstable approach is left
    let n = 0;
    for (let id = 1; id <= 4000; id++) {
      f.id = id;
      if (mustGoAround(s, f, L)) n++;
    }
    expect(n / 4000).toBeLessThan(0.08);
  });

  it('a gusty crosswind makes missed approaches likelier, a better tower less so', () => {
    const s = createGame(8);
    switchTier(s, 3);
    s.upg.ils = 3;
    s.upgRev++;
    applyStructural(s);
    const L = layoutOf(3);
    const t = findTime(s.seed, 3, (w) => crosswind(w) > CROSSWIND_LIMIT[0] * 0.9 && crosswind(w) < CROSSWIND_LIMIT[0]);
    at(s, t);
    const f = spawnFlight(s)!;
    f.aircraft = ac('sparrow');
    const rate = () => {
      let n = 0;
      for (let id = 1; id <= 4000; id++) {
        f.id = id;
        if (mustGoAround(s, f, L)) n++;
      }
      return n / 4000;
    };
    const before = rate();
    expect(before).toBeGreaterThan(0.03);
    s.upg.tower = 3;
    s.upgRev++;
    expect(rate()).toBeLessThan(before * 0.75);
  });

  it('planes that go around come back and land', () => {
    const s = createGame(21);
    let steps = 0;
    while (s.stats.goArounds < 4 && steps < 30 * 3600 * 12) {
      if (steps % 3 === 0) for (const c of botCommands(s, { reaction: 0.3 })) queueCommand(s, c);
      stepGame(s);
      steps++;
    }
    expect(s.stats.goArounds).toBeGreaterThanOrEqual(4);
    const ids = eventsSince(s, 0).filter((e) => e.kind === 'goAround').map((e) => e.a);
    // let the last ones finish
    for (let i = 0; i < 30 * 400; i++) stepGame(s);
    for (const id of ids) {
      const f = s.flights.find((x) => x.id === id);
      // gone (served and pruned) or on the ground by now
      if (f) expect(['holding', 'final', 'goAround', 'inbound']).not.toContain(f.phase);
    }
  }, 120000);
});

describe('diversions from other airports', () => {
  it('now and then a plane low on fuel asks to come in, paying double', () => {
    const s = createGame(31);
    switchTier(s, 2);
    s.upg.stand = 3;
    s.upgRev++;
    applyStructural(s);
    s.nextGuestAt = s.time;
    stepGame(s);
    const ev = eventsSince(s, 0).find((e) => e.kind === 'diversionRequest');
    expect(ev).toBeDefined();
    const g = s.flights.find((f) => f.guest)!;
    expect(g.payMul).toBe(GUEST_BONUS);
    expect(g.patience).toBeLessThan(1);
    expect(s.nextGuestAt).toBeGreaterThan(s.time + 400);
  });

  it('a guest you cannot take goes on elsewhere without counting against you', () => {
    const s = createGame(32);
    switchTier(s, 2);
    s.upg.stand = 3;
    s.upgRev++;
    applyStructural(s);
    s.nextGuestAt = s.time;
    stepGame(s);
    const g = s.flights.find((f) => f.guest)!;
    for (const st of s.stands) st.reserved = 999999;
    const rating = s.rating;
    for (let i = 0; i < 30 * 900 && g.phase !== 'diverted'; i++) stepGame(s);
    expect(g.phase).toBe('diverted');
    expect(s.stats.diverted).toBe(0);
    expect(s.rating).toBe(rating);
  });

  it('none come in while the airport is full', () => {
    const s = createGame(34);
    switchTier(s, 2);
    for (const st of s.stands) st.reserved = 999999;
    s.nextGuestAt = s.time;
    stepGame(s);
    expect(s.flights.some((f) => f.guest)).toBe(false);
  });

  it('the dirt strip gets none', () => {
    const s = createGame(33);
    for (let i = 0; i < 30 * 3600; i++) {
      stepGame(s);
      if (s.tier > 1) break;
    }
    expect(eventsSince(s, 0).some((e) => e.kind === 'diversionRequest' && s.tier === 1)).toBe(false);
  });
});

