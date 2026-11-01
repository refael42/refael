import { HOLIDAY, HOLIDAYS, type HolidayDef } from '../data/holidays';
import { emit, Ev } from './game/events';
import type { GameState } from './game/types';
import { fixedFromHebrew, hebrewYearOf, isLeap, localFixed, weekdayOfFixed, HebrewMonth } from './hebrew';

// Real holidays (src/data/holidays.ts) by the phone's date. The UI passes the clock in with the
// 'season' command every few seconds (as the season pass); the sim keeps which holiday is on
// and whether its gift was given (saved: one gift per holiday, per year).

export interface HolidayState {
  /** The holiday on now (index in HOLIDAYS, -1 none) and its day (0 = the eve). Not saved. */
  on: number;
  day: number;
  /** Gifts given: holiday id + its year, so each comes once. */
  gifted: string[];
}

export const newHolidays = (gifted: string[] = []): HolidayState => ({ on: -1, day: 0, gifted: [...gifted] });

/** Independence Day moves off Friday and Saturday (to Thursday) and off Monday (to Tuesday), as in Israel. */
function independenceShift(fixed: number): number {
  const wd = weekdayOfFixed(fixed);
  if (wd === 5) return fixed - 1;
  if (wd === 6) return fixed - 2;
  if (wd === 1) return fixed + 1;
  return fixed;
}

/** The first day (R.D.) of holiday `h` in the Hebrew year `y` (a civil one: the year it starts in, by the Hebrew year's autumn). */
export function holidayStart(h: HolidayDef, y: number): number {
  if ('civil' in h.start) {
    const [month, day] = h.start.civil;
    // The civil year in which this Hebrew year's winter falls (Tishri starts in the autumn of y - 3761).
    const civil = y - 3761;
    return Math.floor(Date.UTC(civil, month - 1, day) / 86400000) + 719163;
  }
  const [m, d] = h.start.hebrew;
  const month = m === HebrewMonth.Adar && isLeap(y) ? HebrewMonth.AdarII : m;
  const fixed = fixedFromHebrew(y, month, d);
  return h.id === 'independence' ? independenceShift(fixed) : fixed;
}

/** The holiday on at R.D. `fixed` (with its eve), or null; `day` 0 is the eve, 1 its first day. */
export function holidayOn(fixed: number): { index: number; day: number; year: number } | null {
  const y = hebrewYearOf(fixed);
  for (const year of [y - 1, y]) {
    for (let i = 0; i < HOLIDAYS.length; i++) {
      const start = holidayStart(HOLIDAYS[i]!, year);
      const day = fixed - start + HOLIDAY.eveDays;
      if (day >= 0 && day < HOLIDAYS[i]!.days + HOLIDAY.eveDays) return { index: i, day, year };
    }
  }
  return null;
}

/** The next holiday from R.D. `fixed` on (for the "coming soon" line): its index and how many days away. */
export function nextHoliday(fixed: number): { index: number; inDays: number } {
  const y = hebrewYearOf(fixed);
  let best = { index: 0, inDays: Infinity };
  for (const year of [y, y + 1]) {
    HOLIDAYS.forEach((h, i) => {
      const inDays = holidayStart(h, year) - HOLIDAY.eveDays - fixed;
      if (inDays > 0 && inDays < best.inDays) best = { index: i, inDays };
    });
  }
  return best;
}

/** Called with the phone's clock: which holiday is on; its gift the first time. */
export function syncHolidays(s: GameState, now: number, tzMin: number): void {
  const fixed = localFixed(now, tzMin);
  const on = holidayOn(fixed);
  const h = s.holidays;
  const was = h.on;
  h.on = on ? on.index : -1;
  h.day = on ? on.day : 0;
  if (!on) return;
  const def = HOLIDAYS[on.index]!;
  const key = `${def.id}.${on.year}`;
  if (was !== on.index) emit(s, Ev.HolidayStart, 0, 0, on.index, h.gifted.includes(key) ? 0 : def.gift);
  if (!h.gifted.includes(key)) {
    h.gifted = [...h.gifted.slice(-30), key];
    s.gems += def.gift;
  }
}

export const holidayNow = (s: GameState): HolidayDef | null => (s.holidays.on >= 0 ? HOLIDAYS[s.holidays.on]! : null);

/** More guests on a holiday. */
export const holidayArrivals = (s: GameState): number => holidayNow(s)?.arrivals ?? 1;

/** The holiday dish sells for more while it is on. */
export const holidayPrice = (s: GameState, dish: number): number => (holidayNow(s)?.dish === dish ? HOLIDAY.dishPrice : 1);

/** Gifts given, as saved (strings only, the last few). */
export const cleanGifted = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.length < 40).slice(-31) : []);
