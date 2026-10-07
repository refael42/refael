import { WEEK } from '../data/calendar';

/** The day of the week of game day `day` (1 = the first Sunday): 0 = Sunday .. 6 = Saturday. */
export const weekdayOf = (day: number): number => (((day - 1) % WEEK.days) + WEEK.days) % WEEK.days;

export const isWeekend = (day: number): boolean => WEEK.weekend.includes(weekdayOf(day));

/** How much busier the door is: the weekend (by the day), Thursday's evening, else 1. `phase` = 0..1 into the day. */
export function weekArrivals(day: number, phase: number): number {
  if (isWeekend(day)) {
    const h = Math.sin(day * 78.233 + 1.31) * 43758.5453;
    const r = h - Math.floor(h);
    const [lo, hi] = WEEK.weekendArrivals;
    return lo + (hi - lo) * r;
  }
  const th = WEEK.thursday;
  return weekdayOf(day) === th.weekday && phase >= th.from ? th.arrivals : 1;
}
