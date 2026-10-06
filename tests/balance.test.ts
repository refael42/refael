import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { STAND_MAP } from '../src/data/maps';
import { runBalance } from '../src/sim/balance';

// Pacing guard: if a data change makes the early game boring or explosive, this fails. Several
// seeds, judged by what holds for all of them (or their median): a single seed made the test
// about one lucky run (the first applicant's timing alone moves the early gaps by 20 s).
describe('early-game pacing (greedy bot, 15 minutes, five seeds)', () => {
  const reports = [1, 2, 3, 4, 5].map((seed) => runBalance({ map: STAND_MAP, seconds: 15 * 60, seed }));

  it('hits the design targets', () => {
    for (const report of reports) {
      expect(report.firsts.hire!).toBeLessThanOrEqual(BALANCE.targets.firstHire);
      expect(report.firsts.upgrade).not.toBeNull();
      expect(report.firsts.upgrade!).toBeLessThanOrEqual(BALANCE.targets.firstUpgrade);
      expect(report.firsts.milestone!).toBeLessThanOrEqual(BALANCE.targets.firstMilestone);
    }
  });

  it('keeps the team: nobody quits when the manager pays on time', () => {
    for (const report of reports) expect(report.quits).toBe(0);
  });

  it('always has something to buy and nothing explodes', () => {
    for (const report of reports) {
      expect(report.deadZones).toEqual([]);
      // The first minutes start from almost nothing: a jump there is just the start.
      expect(report.incomeJumps.filter((j) => j.time > 150)).toEqual([]);
      expect(report.bulkMinutes.length).toBeLessThanOrEqual(2);
    }
  });

  it('keeps buying early: the first ten purchases or hires come close together', () => {
    const longest = reports.map((report) => {
      const times = [...report.purchases.map((p) => p.time), ...report.hires.map((h) => h.time)].sort((a, b) => a - b).slice(0, 10);
      let gap = 0;
      for (let i = 1; i < times.length; i++) gap = Math.max(gap, times[i]! - times[i - 1]!);
      return gap;
    });
    const sorted = [...longest].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]!).toBeLessThan(40);
    expect(Math.max(...longest)).toBeLessThan(60);
  });
});
