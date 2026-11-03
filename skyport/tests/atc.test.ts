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
import { approachBlocker, spawnFlight, WAKE_GAP, wakeClearAt } from '../src/sim/game/flights';

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
  it('fog keeps planes out unless the ILS can bring them in', () => {
    const s = createGame(4);
    switchTier(s, 2);
    const t = findTime(s.seed, 2, (w) => w.vis < 0.12);
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
    const t = findTime(s.seed, 2, (w) => w.vis < 0.12, 600);
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
