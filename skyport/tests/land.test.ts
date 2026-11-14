import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { FACILITIES, FACILITY_MAX, facilityIndex, plotsFor } from '../src/data/land';
import { DICTS } from '../src/i18n/strings';
import { applyStructural, Big, createGame, effects, queueCommand, stepGame, switchTier, type GameState } from '../src/sim';
import { canBuyPlot, clearSeconds, facilityCap, facilityCost, facilityRate, gardenMood, landPlots, obstaclesOf, ownedCount, plotCost, rushCost } from '../src/sim/game/land';
import { layoutOf } from '../src/sim/game/layout';
import { cleanGame, serializeGame } from '../src/sim/save';

function airport(seed: number, tier = 3): GameState {
  const s = createGame(seed);
  switchTier(s, tier);
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.money = Big.fromNumber(1e12);
  s.diamonds = 0;
  s.nextIncidentAt = 1e12;
  s.career.level = 500;
  return s;
}

const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * 30; i++) stepGame(s);
};
const send = (s: GameState, c: Parameters<typeof queueCommand>[1]) => {
  queueCommand(s, c);
  stepGame(s);
};

describe('land expansions', () => {
  it('plots lie south of the widest fence, inside the world, more of them at the bigger airports', () => {
    let last = 0;
    for (let t = 1; t <= 8; t++) {
      const L = layoutOf(t);
      const ps = plotsFor(L.world.w, L.world.h);
      expect(ps.length, `tier ${t}`).toBeGreaterThanOrEqual(last);
      last = ps.length;
      for (const p of ps) {
        expect(p.box[1]).toBeGreaterThan(L.field.y1 + 1);
        expect(p.box[2]).toBeLessThan(L.world.w);
        expect(p.box[3]).toBeLessThan(L.world.h);
      }
    }
    expect(plotsFor(64, 52)).toHaveLength(18);
    expect(plotsFor(112, 52).length).toBeGreaterThan(20);
  });

  it('a plot is bought, cleared over time, and gives diamonds and experience', () => {
    const s = airport(1);
    const p0 = landPlots(s)[2];
    const below = landPlots(s).find((p) => p.id === p0.id + 100)!;
    // (the second row waits for the plot north of it)
    expect(canBuyPlot(s, below.id)).toBe(false);
    expect(canBuyPlot(s, p0.id)).toBe(true);
    const money = s.money;
    const cost = plotCost(s);
    send(s, { type: 'buyPlot', plot: p0.id });
    expect(s.land.plots[p0.id].state).toBe(1);
    expect(money.sub(s.money).toNumber()).toBeCloseTo(cost, -1);
    // (one clearing at a time)
    expect(canBuyPlot(s, landPlots(s)[0].id)).toBe(false);
    const xp = s.career.xp + s.career.level * 1e6;
    run(s, clearSeconds(s) + 1);
    expect(s.land.plots[p0.id].state).toBe(2);
    expect(ownedCount(s)).toBe(1);
    expect(s.diamonds).toBeGreaterThanOrEqual(1);
    expect(s.career.xp + s.career.level * 1e6).toBeGreaterThan(xp);
    expect(canBuyPlot(s, below.id)).toBe(true);
    // the next plot costs more and takes longer
    expect(plotCost(s)).toBeGreaterThan(cost);
  });

  it('diamonds rush a clearing', () => {
    const s = airport(2);
    const id = landPlots(s)[0].id;
    send(s, { type: 'buyPlot', plot: id });
    const gems = rushCost(s, id);
    expect(gems).toBeGreaterThan(0);
    send(s, { type: 'rushPlot', plot: id });
    expect(s.land.plots[id].state).toBe(1);
    s.diamonds = gems;
    send(s, { type: 'rushPlot', plot: id });
    run(s, 1);
    expect(s.land.plots[id].state).toBe(2);
  });

  it('a facility is built and upgraded, fills with coins up to its cap, and is collected', () => {
    const s = airport(3);
    const id = landPlots(s)[1].id;
    send(s, { type: 'buyPlot', plot: id });
    run(s, clearSeconds(s) + 1);
    const f = facilityIndex('rental');
    const c1 = facilityCost(s, f, 0);
    send(s, { type: 'buildFacility', plot: id, facility: f });
    expect(s.land.plots[id].left).toBeGreaterThan(0);
    run(s, 31);
    const p = s.land.plots[id];
    expect(p.lv).toBe(1);
    expect(facilityRate(s, p)).toBeGreaterThan(0);
    run(s, 20);
    expect(p.store).toBeGreaterThan(0);
    // (it stops when full)
    run(s, FACILITIES[f].capMin * 60 + 30);
    expect(p.store).toBeCloseTo(facilityCap(s, p), 0);
    const money = s.money.toNumber();
    const held = Math.floor(p.store);
    send(s, { type: 'collectFacility', plot: id });
    expect(s.money.toNumber() - money).toBeGreaterThanOrEqual(held * 0.999);
    expect(p.store).toBeLessThan(1);
    // the next level costs more; a different facility cannot go on the same plot
    expect(facilityCost(s, f, 1)).toBeGreaterThan(c1);
    send(s, { type: 'buildFacility', plot: id, facility: facilityIndex('solar') });
    expect(p.left).toBe(0);
    for (let lv = 1; lv < FACILITY_MAX; lv++) {
      send(s, { type: 'buildFacility', plot: id, facility: f });
      run(s, 30 * (lv + 1) + 1);
    }
    expect(p.lv).toBe(FACILITY_MAX);
    send(s, { type: 'buildFacility', plot: id, facility: f });
    expect(p.left).toBe(0);
  });

  it('the solar farm pays in by itself; the garden cheers passengers up', () => {
    const s = airport(4);
    const [a, b] = landPlots(s);
    for (const id of [a.id, b.id]) {
      send(s, { type: 'buyPlot', plot: id });
      run(s, clearSeconds(s) + 1);
    }
    send(s, { type: 'buildFacility', plot: a.id, facility: facilityIndex('solar') });
    send(s, { type: 'buildFacility', plot: b.id, facility: facilityIndex('garden') });
    run(s, 31);
    const before = s.money.toNumber();
    run(s, 10);
    expect(s.money.toNumber()).toBeGreaterThan(before);
    expect(s.land.plots[a.id].store).toBe(0);
    expect(gardenMood(s)).toBeGreaterThan(0);
    const comfort = effects(s).comfort;
    expect(comfort).toBeGreaterThanOrEqual(gardenMood(s) - 1e-9);
  });

  it('obstacles stay the same and inside their plot; the land is kept in a save', () => {
    const s = airport(5);
    for (const p of landPlots(s)) {
      const obs = obstaclesOf(p);
      expect(obs.length).toBeGreaterThanOrEqual(6);
      expect(obstaclesOf(p)).toEqual(obs);
      for (const o of obs) {
        expect(o.x).toBeGreaterThan(p.box[0]);
        expect(o.x).toBeLessThan(p.box[2]);
        expect(o.y).toBeGreaterThan(p.box[1]);
        expect(o.y).toBeLessThan(p.box[3]);
      }
    }
    const id = landPlots(s)[0].id;
    send(s, { type: 'buyPlot', plot: id });
    run(s, clearSeconds(s) + 1);
    send(s, { type: 'buildFacility', plot: id, facility: facilityIndex('parking') });
    const back = cleanGame(JSON.parse(serializeGame(s, 0)).game)!;
    expect(back.land.plots[id]).toEqual(s.land.plots[id]);
  });

  it('is named in both languages', () => {
    for (const lang of ['en', 'he'] as const) {
      const d = DICTS[lang] as Record<string, string>;
      for (const f of FACILITIES) expect(d[`fac.${f.id}`] && d[`facDesc.${f.id}`], `${lang} ${f.id}`).toBeTruthy();
      for (const k of ['land.title', 'land.wild', 'land.buy', 'land.clearing', 'land.owned', 'land.pick', 'land.collect', 'land.upgrade', 'land.max']) expect(d[k], `${lang} ${k}`).toBeTruthy();
    }
  });
});

describe('the land on the ground', () => {
  it('an empty land signature means no plot is the airport\'s (it used to read as plot 0 owned)', async () => {
    const { parseLandSig, landSignature } = await import('../src/render/landSig');
    expect(parseLandSig('')).toEqual([]);
    expect(parseLandSig(landSignature(airport(9)))).toEqual([]);
    expect(parseLandSig('0:2:1;3:1:-1')).toEqual([
      [0, 2, 1],
      [3, 1, -1],
    ]);
  });
});
