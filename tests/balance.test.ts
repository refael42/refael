import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { STAND_MAP } from '../src/data/maps';
import { runBalance } from '../src/sim/balance';

// Pacing guard: if a data change makes the early game boring or explosive, this fails.
describe('early-game pacing (greedy bot, 15 minutes)', () => {
  const report = runBalance({ map: STAND_MAP, seconds: 15 * 60, seed: 1 });

  it('hits the design targets', () => {
    expect(report.firsts.hire!).toBeLessThanOrEqual(BALANCE.targets.firstHire);
    expect(report.firsts.upgrade).not.toBeNull();
    expect(report.firsts.upgrade!).toBeLessThanOrEqual(BALANCE.targets.firstUpgrade);
    expect(report.firsts.milestone!).toBeLessThanOrEqual(BALANCE.targets.firstMilestone);
  });

  it('keeps the team: nobody quits when the manager pays on time', () => {
    expect(report.quits).toBe(0);
  });

  it('always has something to buy and nothing explodes', () => {
    expect(report.deadZones).toEqual([]);
    expect(report.incomeJumps).toEqual([]);
    expect(report.bulkMinutes).toEqual([]);
  });

  it('keeps buying early: never more than 25 s between the first ten purchases or hires', () => {
    const times = [...report.purchases.map((p) => p.time), ...report.hires.map((h) => h.time)].sort((a, b) => a - b).slice(0, 10);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeLessThan(25);
  });
});
