import { describe, expect, it } from 'vitest';

import { stockUp } from './helpers';

import { ACHIEVEMENTS } from '../src/data/achievements';
import { facilityIndex } from '../src/data/land';
import { applyStructural, Big, botLand, createGame, queueCommand, stepGame, switchTier, type GameState } from '../src/sim';
import { metric } from '../src/sim/game/career';
import { clearSeconds, landPlots, ownedCount } from '../src/sim/game/land';

function airport(seed: number, tier = 3): GameState {
  const s = createGame(seed);
  switchTier(s, tier);
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.money = Big.fromNumber(1e12);
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

describe('land II', () => {
  it('the land has its achievements: plots cleared and coins collected', () => {
    expect(ACHIEVEMENTS.some((a) => a.id === 'landlord' && a.metric === 'plots')).toBe(true);
    expect(ACHIEVEMENTS.some((a) => a.id === 'harvest' && a.metric === 'harvest')).toBe(true);
    const s = airport(1);
    const id = landPlots(s)[0].id;
    send(s, { type: 'buyPlot', plot: id });
    run(s, clearSeconds(s) + 1);
    expect(metric(s, 'plots')).toBe(1);
    send(s, { type: 'buildFacility', plot: id, facility: facilityIndex('rental') });
    run(s, 31 + 60);
    const held = Math.floor(s.land.plots[id].store);
    expect(held).toBeGreaterThan(0);
    send(s, { type: 'collectFacility', plot: id });
    expect(metric(s, 'harvest')).toBe(held);
  });

  it('the hotel opens at the international airport, the mall at the hub', () => {
    for (const [tier, f, ok] of [
      [4, 'hotel', false],
      [5, 'hotel', true],
      [5, 'mall', false],
      [6, 'mall', true],
    ] as const) {
      const s = airport(2, tier);
      const id = landPlots(s)[0].id;
      send(s, { type: 'buyPlot', plot: id });
      run(s, clearSeconds(s) + 1);
      send(s, { type: 'buildFacility', plot: id, facility: facilityIndex(f) });
      expect(s.land.plots[id].f >= 0, `${f} at tier ${tier}`).toBe(ok);
    }
  });

  it('the bot plays the land: buys a plot when rich, builds on it, collects', () => {
    const s = airport(3, 4);
    // (rich, nothing to save for)
    const first = botLand(s);
    expect(first.some((c) => c.type === 'buyPlot')).toBe(true);
    for (const c of first) queueCommand(s, c);
    stepGame(s);
    run(s, clearSeconds(s) + 1);
    expect(ownedCount(s)).toBe(1);
    const build = botLand(s);
    expect(build.some((c) => c.type === 'buildFacility')).toBe(true);
    for (const c of build) queueCommand(s, c);
    stepGame(s);
    run(s, 31 + 8 * 60);
    expect(botLand(s).some((c) => c.type === 'collectFacility')).toBe(true);
  });
});
