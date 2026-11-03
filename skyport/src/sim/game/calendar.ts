/**
 * The real calendar (M11 holidays). Pure arithmetic on day numbers: no clock
 * is read here, the UI tells the sim what day it is (command setToday), so a
 * game stays deterministic.
 *
 * Day numbers are "epoch days": days since 1970-01-01. The Hebrew calendar is
 * the arithmetic one (molad and postponements), after Dershowitz & Reingold,
 * "Calendrical Calculations".
 */
import { HOLIDAYS, type HolidayId } from '../../data/holidays';

/** Fixed date (R.D., day 1 = 0001-01-01) of 1970-01-01. */
const RD_UNIX = 719163;
/** Fixed date of 1 Tishrei of the year 1 (the Hebrew epoch). */
const HEBREW_EPOCH = -1373427;

/** Epoch day of a Gregorian date (month 1..12), after Howard Hinnant's days_from_civil. */
export function epochDay(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Calendar year of an epoch day (civil_from_days). */
export function yearOf(day: number): number {
  const z = Math.floor(day) + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  return yoe + era * 400 + (mp >= 10 ? 1 : 0);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

function elapsedDays(y: number): number {
  const months = Math.floor((235 * y - 234) / 19);
  const parts = 12084 + 13753 * months;
  const days = 29 * months + Math.floor(parts / 25920);
  return (3 * (days + 1)) % 7 < 3 ? days + 1 : days;
}

function newYearDelay(y: number): number {
  const ny0 = elapsedDays(y - 1);
  const ny1 = elapsedDays(y);
  const ny2 = elapsedDays(y + 1);
  if (ny2 - ny1 === 356) return 2;
  if (ny1 - ny0 === 382) return 1;
  return 0;
}

/** Epoch day of 1 Tishrei (Rosh Hashanah) of the Hebrew year y. */
export function roshHashana(y: number): number {
  return HEBREW_EPOCH + elapsedDays(y) + newYearDelay(y) - RD_UNIX;
}

/** First day of each holiday of the Hebrew year y (which starts in the autumn of y - 3761). */
function hebrewHolidays(y: number): [HolidayId, number][] {
  const rh = roshHashana(y);
  const len = roshHashana(y + 1) - rh;
  // a "complete" year has a long Cheshvan, a "deficient" one a short Kislev
  const cheshvan = len % 10 === 5 ? 30 : 29;
  const kislev = len % 10 === 3 ? 29 : 30;
  // the months from Nisan on never change length: Nisan 1 is 177 days before the next new year
  const nisan = roshHashana(y + 1) - 177;
  // Independence Day moves off the Sabbath and away from it
  let iyar5 = nisan + 34;
  const wd = weekdayOf(iyar5);
  if (wd === 5) iyar5 -= 1;
  else if (wd === 6) iyar5 -= 2;
  else if (wd === 1) iyar5 += 1;
  return [
    ['roshHashana', rh],
    ['sukkot', rh + 14],
    ['hanukkah', rh + 30 + cheshvan + 24],
    ['tuBishvat', rh + 30 + cheshvan + kislev + 29 + 14],
    ['purim', nisan - 16],
    ['passover', nisan + 14],
    ['independence', iyar5],
    ['lagBaomer', nisan + 47],
    ['shavuot', nisan + 64],
  ];
}

/** Every holiday that starts in (or just around) this calendar year, with its first day. */
function holidaysAround(year: number): [HolidayId, number][] {
  return [
    ...hebrewHolidays(year + 3760),
    ...hebrewHolidays(year + 3761),
    ['newYear', epochDay(year - 1, 12, 31)],
    ['newYear', epochDay(year, 12, 31)],
    ['halloween', epochDay(year, 10, 31)],
  ];
}

export interface HolidayNow {
  /** Index into HOLIDAYS. */
  h: number;
  /** Day of the holiday (1 = the first), 0 on the travel days before it. */
  day: number;
  /** Epoch day it starts. */
  start: number;
}

/** The holiday on this day (or the travel days before it), or null. */
export function holidayOn(day: number): HolidayNow | null {
  if (!(day > 0)) return null;
  let best: HolidayNow | null = null;
  for (const [id, start] of holidaysAround(yearOf(day))) {
    const h = HOLIDAYS.findIndex((x) => x.id === id);
    const def = HOLIDAYS[h];
    if (day < start - def.before || day >= start + def.days) continue;
    const now = { h, day: day >= start ? day - start + 1 : 0, start };
    // the holiday itself wins over the travel days of the next one
    if (!best || (best.day === 0 && now.day > 0)) best = now;
  }
  return best;
}

/** First day of the next time this holiday starts, on or after the given day. */
export function nextHoliday(id: HolidayId, from: number): number {
  const y = yearOf(from);
  const starts = [...holidaysAround(y), ...holidaysAround(y + 1)]
    .filter(([x, d]) => x === id && d >= from)
    .map(([, d]) => d)
    .sort((a, b) => a - b);
  return starts[0] ?? from;
}
