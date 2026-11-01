import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { TRUCK, TRUCK_SPOTS } from '../src/data/truck';
import { openBranch } from '../src/sim/franchise';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { planReminders } from '../src/sim/reminders';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { collectTruck, rushCost, rushTruck, sendTruck, spotOpen, tripPay, truckOpen, upgradeCost, upgradeTruck } from '../src/sim/truck';
import type { GameState } from '../src/sim/game/types';

// Owner, idea 8: "a food truck that drives between neighborhoods and earns even while the restaurant is closed".

const T0 = Date.UTC(2026, 10, 1, 12);
const game = (): GameState => {
  const s = createGame(STAND_MAP, 8);
  s.stats.served = TRUCK.minServed;
  return s;
};

describe('the food truck', () => {
  it('opens after the first guests; the far trips with the bigger buildings', () => {
    const s = createGame(STAND_MAP, 8);
    expect(truckOpen(s)).toBe(false);
    expect(sendTruck(s, 0, T0)).toBe(false);
    s.stats.served = TRUCK.minServed;
    expect(truckOpen(s)).toBe(true);
    expect(spotOpen(s, 1)).toBe(true);
    expect(spotOpen(s, TRUCK_SPOTS.length - 1)).toBe(false);
  });

  it('a trip runs on the phone clock: nothing before it is back, then its takings (fixed when it left)', () => {
    const s = game();
    const pay = tripPay(s, 1);
    expect(sendTruck(s, 1, T0)).toBe(true);
    expect(sendTruck(s, 0, T0)).toBe(false);
    expect(collectTruck(s, T0 + 60000)).toBe(false);
    const coins = s.coins;
    const back = T0 + TRUCK_SPOTS[1]!.minutes * 60000;
    expect(collectTruck(s, back)).toBe(true);
    expect(s.coins.sub(coins).eq(pay.coins)).toBe(true);
    expect(s.truck.trip).toBeNull();
    expect(s.events.some((e) => e.type === Ev.TruckBack)).toBe(true);
  });

  it('can be called back for gems by the hours left', () => {
    const s = game();
    s.mods = { ...s.mods, building: 2 };
    sendTruck(s, 2, T0);
    const cost = rushCost(s, T0);
    expect(cost).toBe(Math.ceil((TRUCK_SPOTS[2]!.minutes / 60) * TRUCK.gemsPerHour));
    s.gems = cost - 1;
    expect(rushTruck(s, T0)).toBe(false);
    s.gems = cost + TRUCK_SPOTS[2]!.gems;
    expect(rushTruck(s, T0)).toBe(true);
    expect(s.gems).toBe(TRUCK_SPOTS[2]!.gems + 1);
  });

  it('upgrades sell more, and cost more each level', () => {
    const s = game();
    const before = tripPay(s, 1).coins;
    const c0 = upgradeCost(s);
    s.coins = c0.mul(100);
    expect(upgradeTruck(s)).toBe(true);
    expect(tripPay(s, 1).coins.gt(before)).toBe(true);
    expect(upgradeCost(s).gt(c0)).toBe(true);
  });

  it('is kept in the save and the branch, and reminds the phone when it is back', () => {
    const s = game();
    sendTruck(s, 1, T0);
    const r = parseSave(JSON.stringify(makeSave(s, 1000)));
    if (!r.ok) throw new Error(r.reason);
    const back = restoreGame(r.save, 1, 2000);
    expect(back.truck.trip?.spot).toBe(1);
    expect(planReminders(back, T0, 0).some((x) => x.kind === 'truck')).toBe(true);
    back.stats.earned = back.stats.earned.add(1e15);
    back.levels = { ...back.levels, building: 6 };
    expect(openBranch(back)).toBe(true);
    expect(back.truck.trip?.spot).toBe(1);
  });
});
