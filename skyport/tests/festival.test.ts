import { describe, expect, it } from 'vitest';

import { play, stockUp } from './helpers';

import { tierDef } from '../src/data/tiers';
import { applyStructural, Big, createGame, DT, parseSave, queueCommand, serializeGame, stepGame, switchTier, type GameState } from '../src/sim';
import { pushEvent } from '../src/sim/game/events';
import { DEAL_EVERY_MIN, DEAL_MINUTES, DEAL_OFF, FESTIVAL_DAYS, FESTIVAL_PRIZES, FESTIVALS, festivalKind, flashDeal } from '../src/sim/game/festival';
import { DAY_SECONDS } from '../src/sim/game/clock';
import { boughtLevel, unitCost } from '../src/sim/game/upgrades';
import { upgradeDef } from '../src/data/upgrades';

function field(seed: number, tier = 2): GameState {
  const s = createGame(seed);
  switchTier(s, tier);
  s.upg.stand = 3;
  s.upgRev++;
  applyStructural(s);
  stockUp(s);
  s.money = Big.fromNumber(1e9);
  s.nextIncidentAt = 1e12;
  // (a manager far from a level-up: no level coins in the sums)
  s.career.level = 500;
  return s;
}

const kindOf = (s: GameState) => FESTIVALS[s.fest.kind].kind;

describe('festivals', () => {
  it('one runs from the start, a new one every three days, never the same twice in a row', () => {
    const s = field(1, 5);
    stepGame(s);
    expect(s.fest.n).toBe(0);
    const kinds: number[] = [];
    for (let n = 0; n < 12; n++) {
      const k = festivalKind(s, n);
      expect(FESTIVALS[k].tier).toBeLessThanOrEqual(s.tier);
      if (n > 0) s.fest.kind = kinds[n - 1];
      kinds.push(festivalKind(s, n));
    }
    // a new one after three days
    s.tick = Math.round((FESTIVAL_DAYS * DAY_SECONDS) / DT);
    stepGame(s);
    expect(s.fest.n).toBe(1);
    expect(s.fest.points).toBe(0);
    // only those open at the tier come up
    const small = field(2, 1);
    for (let n = 0; n < 20; n++) expect(FESTIVALS[festivalKind(small, n)].tier).toBe(1);
  });

  it('points come from what the festival is about; prizes as they come in, the trophy at the top', () => {
    const s = field(3, 5);
    stepGame(s);
    // force the VIP gala (points from VIP and celebrity tips)
    s.fest.kind = FESTIVALS.findIndex((f) => f.kind === 'vip');
    const goals = FESTIVALS[s.fest.kind].goals;
    const money = s.money.toNumber();
    const gems = s.diamonds;
    for (let i = 0; i < goals[2]; i++) pushEvent(s, 'vipTip', 0, 0, 0, 10);
    // other things bring nothing to this one
    pushEvent(s, 'review', 0, 0, 5, 0, 0);
    stepGame(s);
    expect(s.fest.points).toBe(goals[2]);
    expect(s.fest.prizes).toBe(3);
    const pay = tierDef(s.tier).pay;
    const coins = FESTIVAL_PRIZES.reduce((a, p) => a + Math.round(p.coins * pay), 0);
    expect(s.money.toNumber() - money).toBe(coins);
    expect(s.diamonds - gems).toBe(FESTIVAL_PRIZES.reduce((a, p) => a + p.gems, 0));
    expect(s.fest.trophies.vip).toBe(1);
    // no more prizes after the top
    pushEvent(s, 'vipTip', 0, 0, 0, 10);
    stepGame(s);
    expect(s.fest.prizes).toBe(3);
    expect(s.fest.trophies.vip).toBe(1);
  });

  it('a real game earns festival points', () => {
    const s = field(4, 2);
    stepGame(s);
    s.fest.kind = FESTIVALS.findIndex((f) => f.kind === 'charter');
    play(s, 600, 0.5);
    expect(s.fest.points).toBeGreaterThan(3);
  }, 120000);
});

describe('flash deals', () => {
  const NOW = 30000000;
  it('every three hours for twenty minutes: the best upgrade at 40% off, once', () => {
    const s = field(5, 2);
    expect(flashDeal(s)).toBeNull();
    // the start of a window
    const start = Math.ceil(NOW / DEAL_EVERY_MIN) * DEAL_EVERY_MIN;
    queueCommand(s, { type: 'setNow', minutes: start + 1 });
    for (let i = 0; i < 31; i++) stepGame(s);
    const d = flashDeal(s);
    expect(d).not.toBeNull();
    const def = upgradeDef(d!.id)!;
    expect(def.buildSeconds).toBeUndefined();
    const full = unitCost(s, def, boughtLevel(s, def.id)).toNumber();
    expect(d!.price.toNumber()).toBeCloseTo(Math.ceil(full * (1 - DEAL_OFF)), -1);
    const lvl = boughtLevel(s, def.id);
    const money = s.money.toNumber();
    queueCommand(s, { type: 'buyDeal' });
    stepGame(s);
    expect(boughtLevel(s, def.id)).toBe(lvl + 1);
    expect(money - s.money.toNumber()).toBe(d!.price.toNumber());
    // once a window
    expect(flashDeal(s)).toBeNull();
    // the next window has a new one; after twenty minutes it is gone
    queueCommand(s, { type: 'setNow', minutes: start + DEAL_EVERY_MIN + 2 });
    for (let i = 0; i < 31; i++) stepGame(s);
    expect(flashDeal(s)).not.toBeNull();
    queueCommand(s, { type: 'setNow', minutes: start + DEAL_EVERY_MIN + DEAL_MINUTES });
    stepGame(s);
    expect(flashDeal(s)).toBeNull();
  });

  it('festivals and the deal survive a save', () => {
    const s = field(6, 3);
    stepGame(s);
    s.fest.points = 7;
    s.fest.prizes = 1;
    s.fest.trophies.onTime = 2;
    s.fest.dealTaken = 99;
    const r = parseSave(serializeGame(s, 1), 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.fest.points).toBe(7);
    expect(r.state.fest.prizes).toBe(1);
    expect(r.state.fest.trophies.onTime).toBe(2);
    expect(r.state.fest.dealTaken).toBe(99);
    expect(kindOf(r.state)).toBe(kindOf(s));
  });
});
