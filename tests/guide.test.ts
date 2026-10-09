import { describe, expect, it } from 'vitest';
import { GUIDE } from '../src/data/guide';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { guideArrivals, guidePrice, publish, scoreOf } from '../src/sim/game/guide';
import { startConstruction, updateConstruction } from '../src/sim/game/construction';
import { grantPurchase } from '../src/sim/shop';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, OrderState, type GameState, type Order } from '../src/sim/game/types';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';

function play(s: GameState, seconds: number, each?: (s: GameState) => void) {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    each?.(s);
  }
}

const order = (o: Partial<Order>): Order => ({ id: 1, customer: -1, dish: 0, state: OrderState.Ready, progress: 1, slot: 0, since: 0, landsAt: 0, waiter: -1, quality: 1, delivery: false, ...o });

describe('the guide (owner M29: "Michelin logic, stars you get like in real life")', () => {
  it('an inspector comes unannounced, eats alone, pays, then says who they were', () => {
    const s = createGame(STAND_MAP, 51, { roster: ['cook', 'waiter', 'washer'] });
    // Today, now: the next guest who comes alone is the inspector.
    s.guide.due = s.time;
    let seen = false;
    let revealed = false;
    play(s, 400, (g) => {
      if (g.customers.some((c) => c.inspector)) seen = true;
      if (g.events.some((e) => e.type === Ev.Inspector) && g.notices.some((n) => n.kind === 'inspector')) revealed = true;
    });
    expect(seen).toBe(true);
    expect(s.guide.visits.length).toBeGreaterThanOrEqual(1);
    expect(s.guide.visits[0]!.score).toBeGreaterThanOrEqual(0);
    expect(s.guide.visits[0]!.score).toBeLessThanOrEqual(100);
    expect(revealed).toBe(true);
  });

  it('only the plate counts: a better cook, mastered recipes and a hot plate score higher; a cold one lower', () => {
    const s = createGame(STAND_MAP, 52);
    const plain = scoreOf(s, order({ chef: 0.3, readyAt: 0 }), 5);
    const better = scoreOf(s, order({ chef: 0.9, readyAt: 0 }), 5);
    const cold = scoreOf(s, order({ chef: 0.9, readyAt: 0 }), 60);
    const checked = scoreOf(s, order({ chef: 0.9, readyAt: 0, checked: true }), 5);
    expect(better).toBeGreaterThan(plain);
    expect(cold).toBeLessThan(better);
    expect(checked).toBe(better + GUIDE.checkedBonus);
    s.levels = { ...s.levels, fries: 300, stove: 300, fridge: 300 };
    expect(scoreOf(s, order({ chef: 0.9, readyAt: 0 }), 5)).toBeGreaterThan(better + 20);
  });

  it('the guide comes out every seventh day: one star at a time, with enough visits and no bad night', () => {
    const s = createGame(STAND_MAP, 53);
    // Two excellent visits: one star (not two at once).
    s.guide.visits = [{ day: 3, score: 95 }, { day: 5, score: 93 }];
    publish(s);
    expect(s.guide.stars).toBe(1);
    expect(s.guide.plate).toBe(true);
    expect(s.guide.last?.change).toBe(1);
    expect(s.guide.visits).toHaveLength(0);
    // The second star needs three visits.
    s.guide.visits = [{ day: 8, score: 90 }, { day: 10, score: 92 }];
    publish(s);
    expect(s.guide.stars).toBe(1);
    // ...and no bad night among them.
    s.guide.visits = [{ day: 15, score: 95 }, { day: 16, score: 95 }, { day: 18, score: 60 }];
    publish(s);
    expect(s.guide.stars).toBe(1);
    s.guide.visits = [{ day: 22, score: 84 }, { day: 24, score: 86 }, { day: 26, score: 83 }];
    publish(s);
    expect(s.guide.stars).toBe(2);
    // No visits this time: nothing changes.
    publish(s);
    expect(s.guide.stars).toBe(2);
  });

  it('a kitchen that slips loses a star', () => {
    const s = createGame(STAND_MAP, 54);
    s.guide.stars = 2;
    s.guide.visits = [{ day: 3, score: 70 }, { day: 5, score: 66 }];
    publish(s);
    expect(s.guide.stars).toBe(1);
    expect(s.guide.last?.change).toBe(-1);
  });

  it('stars bring people and raise every bill', () => {
    const s = createGame(STAND_MAP, 55);
    expect(guidePrice(s)).toBe(1);
    expect(guideArrivals(s)).toBe(1);
    s.guide.stars = 3;
    expect(guidePrice(s)).toBeGreaterThan(1.3);
    expect(guideArrivals(s)).toBeGreaterThan(1.2);
  });

  it('the guide is saved: stars, the plate, the visits so far', () => {
    const s = createGame(STAND_MAP, 56);
    s.guide.stars = 2;
    s.guide.plate = true;
    s.guide.edition = 4;
    s.guide.visits = [{ day: 30, score: 81 }];
    const loaded = parseSave(JSON.stringify(makeSave(s, Date.now())));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const back = restoreGame(loaded.save, 56, Date.now());
    expect(back.guide.stars).toBe(2);
    expect(back.guide.plate).toBe(true);
    expect(back.guide.edition).toBe(4);
    expect(back.guide.visits).toEqual([{ day: 30, score: 81 }]);
  });

  it('inspectors start coming after the first days, more often to starred places', () => {
    expect(GUIDE.visitChance[3]!).toBeGreaterThan(GUIDE.visitChance[0]!);
    const s = createGame(STAND_MAP, 57, { roster: ['cook', 'waiter', 'washer'] });
    let visits = 0;
    play(s, 120 * 16, (g) => {
      visits = Math.max(visits, g.guide.visits.length + (g.guide.last?.visits ?? 0));
    });
    expect(s.guide.edition).toBeGreaterThanOrEqual(2);
    expect(visits).toBeGreaterThan(0);
  });

  it('a bigger building keeps the stars and the purchases already paid out', () => {
    const s = createGame(STAND_MAP, 58);
    s.guide.stars = 1;
    s.guide.visits = [{ day: 3, score: 77 }];
    grantPurchase(s, 'gems80', 'tx-keep');
    s.levels = { ...s.levels, building: 1 };
    startConstruction(s);
    s.time = s.construction!.end;
    updateConstruction(s);
    expect(s.map.tier).toBe(1);
    expect(s.guide.stars).toBe(1);
    expect(s.guide.visits).toHaveLength(1);
    expect(grantPurchase(s, 'gems80', 'tx-keep')).toBe(false);
  });
});
