import { describe, expect, it } from 'vitest';
import { WEEK } from '../src/data/calendar';
import { STAND_MAP } from '../src/data/maps';
import { STEP_SEC } from '../src/data/sim';
import { DAY } from '../src/data/staff';
import { isWeekend, weekArrivals, weekdayOf } from '../src/sim/calendar';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';

describe('the week (owner: regular days normal, the weekend busier)', () => {
  it('starts on a Sunday; Friday and Saturday are the weekend, every week', () => {
    expect(weekdayOf(1)).toBe(0);
    expect(weekdayOf(6)).toBe(5);
    expect(weekdayOf(8)).toBe(0);
    const weekend = Array.from({ length: 14 }, (_, i) => i + 1).filter(isWeekend);
    expect(weekend).toEqual([6, 7, 13, 14]);
  });

  it('a weekday is a normal day (Thursday evening a little busier), a weekend day always busier', () => {
    for (const day of [1, 2, 3, 9, 10]) expect(weekArrivals(day, 0.5)).toBe(1);
    expect(weekArrivals(5, 0.2)).toBe(1);
    expect(weekArrivals(5, 0.9)).toBe(WEEK.thursday.arrivals);
    for (let day = 1; day < 200; day++) {
      if (!isWeekend(day)) continue;
      const m = weekArrivals(day, 0.3);
      expect(m).toBeGreaterThanOrEqual(WEEK.weekendArrivals[0]);
      expect(m).toBeLessThanOrEqual(WEEK.weekendArrivals[1]);
      // The same all day long.
      expect(weekArrivals(day, 0.9)).toBe(m);
    }
  });

  it('more guests walk in on a weekend day, and the screen is told when it starts', () => {
    // Everyone who comes to the door (also those who walk on when the line is full).
    const atTheDoor = (day: number) => {
      let total = 0;
      for (const seed of [4, 5, 6, 7]) {
        const s = createGame(STAND_MAP, seed, { day, rating: 4 });
        let last = s.nextArrival;
        for (let i = 0; i < (DAY.seconds - 5) / STEP_SEC; i++) {
          stepGame(s, STEP_SEC);
          if (s.nextArrival !== last) total += 1;
          last = s.nextArrival;
        }
      }
      return total;
    };
    expect(atTheDoor(13)).toBeGreaterThan(atTheDoor(10) * 1.15);
    const s = createGame(STAND_MAP, 1, { day: 5 });
    s.dayTime = DAY.seconds - STEP_SEC / 2;
    const seen = s.nextEventId;
    stepGame(s, STEP_SEC);
    const e = s.events.find((x) => x.id >= seen && x.type === Ev.Weekend);
    expect(e?.a).toBeGreaterThanOrEqual(30);
  });
});
