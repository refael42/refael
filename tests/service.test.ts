import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { HEAT, PREP, REQUEST } from '../src/data/service';
import { STEP_SEC } from '../src/data/sim';
import { computeMods } from '../src/sim/economy/upgrades';
import { createGame } from '../src/sim/game/create';
import { cookRequest, cookTimeMult, heatOf, mistakeChance, prepCap, requestChance, requestTip, rollRequest, sendBack, servedPlate, takeOffPass, usePrep } from '../src/sim/game/service';
import { queueCommand } from '../src/sim/game/commands';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, OrderState, type Customer, type GameState, type Order } from '../src/sim/game/types';

// Owner M49: "three big ideas, mostly logic for service and the kitchen": hot plates, mise en
// place, special requests.

const team = ['cook', 'waiter', 'washer'] as const;

function order(s: GameState, extra: Partial<Order> = {}): Order {
  const o: Order = { id: 900, customer: -1, dish: 0, state: OrderState.Ready, progress: 1, slot: 0, since: s.time, landsAt: 0, waiter: -1, quality: 1, delivery: false, readyAt: s.time, ...extra };
  s.orders.push(o);
  return o;
}

const guest = (): Customer => ({ moodSum: 0, moodCount: 0, emote: 0, emoteTime: 0 }) as unknown as Customer;

describe('hot plates', () => {
  it('stay hot for a while on the pass, then cool; heat lamps keep them hot longer', () => {
    const s = createGame(STAND_MAP, 1, { roster: [...team] });
    const o = order(s);
    expect(heatOf(s, o)).toBe(1);
    s.time += HEAT.hotSeconds;
    expect(heatOf(s, o)).toBe(1);
    s.time += HEAT.coolSeconds / 2;
    expect(heatOf(s, o)).toBeCloseTo(0.5, 5);
    s.time += HEAT.coolSeconds;
    expect(heatOf(s, o)).toBe(0);
    s.mods = computeMods({ stove: 10, heatLamps: 10 });
    expect(s.mods.heat).toBeGreaterThan(1.5);
    expect(heatOf(s, o)).toBeGreaterThan(0);
  });

  it('a hot plate sells for more; a cold one for less, and the guest minds', () => {
    const s = createGame(STAND_MAP, 1, { roster: [...team] });
    const hot = order(s);
    takeOffPass(s, hot);
    const a = guest();
    expect(servedPlate(s, a, hot)).toBeCloseTo(HEAT.hotBonus, 5);
    expect(a.hot).toBe(true);
    expect(a.moodCount).toBe(0);

    const cold = order(s, { id: 901 });
    s.time += HEAT.hotSeconds + HEAT.coolSeconds;
    takeOffPass(s, cold);
    const b = guest();
    expect(servedPlate(s, b, cold)).toBeCloseTo(HEAT.coldPrice, 5);
    expect(b.cold).toBe(true);
    expect(b.moodSum / b.moodCount).toBe(HEAT.coldMood);
  });
});

describe('mise en place', () => {
  it('idle cooks fill the prep stock up to its cap, and a dish with prep cooks faster', () => {
    const s = createGame(STAND_MAP, 3, { roster: [...team] });
    // No guests: the cook has nothing to do but prep.
    s.nextArrival = Infinity;
    for (let i = Math.round(PREP.seconds * (prepCap(s) + 2) * 1.6 / STEP_SEC); i > 0; i--) stepGame(s, STEP_SEC);
    expect(s.prep).toBe(prepCap(s));
    const o = order(s, { state: OrderState.Queued });
    usePrep(s, o);
    expect(o.prepped).toBe(true);
    expect(s.prep).toBe(prepCap(s) - 1);
    expect(cookTimeMult(o)).toBeCloseTo(1 - PREP.cut, 5);
  });

  it('the prep fridge holds more', () => {
    const s = createGame(STAND_MAP, 3, { roster: [...team] });
    const base = prepCap(s);
    s.mods = computeMods({ fridge: 5, prepFridge: 25 });
    expect(prepCap(s)).toBeGreaterThan(base);
    expect(prepCap(s)).toBeLessThanOrEqual(PREP.maxCap);
  });
});

describe('special requests', () => {
  it('take longer to cook and better cooks get them wrong less often', () => {
    const s = createGame(STAND_MAP, 5, { roster: [...team] });
    const cook = s.staff.find((st) => st.role === 'cook')!;
    expect(cookTimeMult(order(s, { request: 0 }))).toBeCloseTo(1 + REQUEST.extraCook, 5);
    const before = mistakeChance(s, cook);
    cook.stats.quality = 10;
    expect(mistakeChance(s, cook)).toBeLessThan(before);
    s.mods = computeMods({ burger: 1, requestBoard: 25 });
    expect(mistakeChance(s, cook)).toBeLessThan(mistakeChance(createGame(STAND_MAP, 5, { roster: [...team] }), cook));
  });

  it('the checker sends a wrong dish back to be made again, and the remake comes out right', () => {
    const s = createGame(STAND_MAP, 5, { roster: [...team] });
    const cook = s.staff.find((st) => st.role === 'cook')!;
    const o = order(s, { request: 1, wrong: true, checked: false });
    const dirty = s.dirtyPlates;
    expect(sendBack(s, cook, o, { x: 0, y: 0 })).toBe(true);
    expect(o.state).toBe(OrderState.Queued);
    expect(o.progress).toBe(0);
    expect(o.remade).toBe(true);
    expect(s.dirtyPlates).toBe(dirty + 1);
    for (let i = 0; i < 50; i++) {
      cookRequest(s, cook, o);
      expect(o.wrong).toBe(false);
    }
    // A dish made right is not sent back.
    expect(sendBack(s, cook, o, { x: 0, y: 0 })).toBe(false);
  });

  it('made right, the guest tips extra; made wrong, they are upset', () => {
    const s = createGame(STAND_MAP, 5, { roster: [...team] });
    const right = guest();
    servedPlate(s, right, order(s, { request: 2, heat: 0.5 }));
    expect(right.requestMet).toBe(true);
    expect(requestTip(s, right)).toBeCloseTo(REQUEST.tip, 5);
    const wrong = guest();
    servedPlate(s, wrong, order(s, { id: 902, request: 2, wrong: true, heat: 0.5 }));
    expect(wrong.wrong).toBe(true);
    expect(requestTip(s, wrong)).toBe(0);
    expect(wrong.moodSum / wrong.moodCount).toBe(REQUEST.wrongMood);
  });

  it('some guests ask for one once the place is going, never in the first meals', () => {
    const s = createGame(STAND_MAP, 8, { roster: [...team] });
    const c = guest();
    for (let i = 0; i < 200; i++) expect(rollRequest(s, c)).toBeUndefined();
    s.stats.served = REQUEST.afterServed;
    let asked = 0;
    for (let i = 0; i < 2000; i++) if (rollRequest(s, c) !== undefined) asked++;
    expect(asked / 2000).toBeGreaterThan(requestChance(s) * 0.7);
    expect(asked / 2000).toBeLessThan(requestChance(s) * 1.3);
    expect(c.request).toBeGreaterThanOrEqual(0);
  });

  it('in play, requests reach the kitchen and the guests pay for them', () => {
    const s = createGame(STAND_MAP, 8, { roster: [...team] });
    s.chef.xp = -1e12;
    s.stats.served = REQUEST.afterServed;
    let requested = 0;
    const seen = new Set<number>();
    for (let i = Math.round(300 / STEP_SEC); i > 0; i--) {
      for (const c of s.customers) if (c.state === CustomerState.Queued) queueCommand(s, { type: 'seat', customer: c.id });
      stepGame(s, STEP_SEC);
      for (const o of s.orders) if (o.request !== undefined && !seen.has(o.id)) {
        seen.add(o.id);
        requested++;
      }
    }
    expect(requested).toBeGreaterThan(0);
    expect(s.stats.served).toBeGreaterThan(REQUEST.afterServed + 5);
  });
});
