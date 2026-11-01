// The Hebrew calendar, worked out (Reingold & Dershowitz, "Calendrical Calculations"): the
// holidays move on the civil calendar every year, and the phone's own Intl support for the
// Hebrew calendar is not there on every phone. Dates are "fixed" day numbers (R.D.: day 1 =
// 1 January of year 1, proleptic Gregorian). Months are numbered from Nisan: 1 Nisan, 2 Iyar,
// 3 Sivan, 4 Tammuz, 5 Av, 6 Elul, 7 Tishri, 8 Heshvan, 9 Kislev, 10 Tevet, 11 Shevat, 12 Adar
// (Adar I in a leap year), 13 Adar II. Checked against Intl's Hebrew calendar in tests/holidays.test.ts.

export const HebrewMonth = { Nisan: 1, Iyar: 2, Sivan: 3, Tammuz: 4, Av: 5, Elul: 6, Tishri: 7, Heshvan: 8, Kislev: 9, Tevet: 10, Shevat: 11, Adar: 12, AdarII: 13 } as const;

const EPOCH = -1373427;
/** R.D. of 1 January 1970. */
const UNIX_RD = 719163;
const DAY_MS = 86400000;

const mod = (a: number, b: number) => ((a % b) + b) % b;

export const isLeap = (y: number): boolean => mod(7 * y + 1, 19) < 7;
export const lastMonth = (y: number): number => (isLeap(y) ? 13 : 12);

function elapsedDays(y: number): number {
  const months = Math.floor((235 * y - 234) / 19);
  const parts = 12084 + 13753 * months;
  const days = 29 * months + Math.floor(parts / 25920);
  return mod(3 * (days + 1), 7) < 3 ? days + 1 : days;
}

function correction(y: number): number {
  const ny0 = elapsedDays(y - 1);
  const ny1 = elapsedDays(y);
  const ny2 = elapsedDays(y + 1);
  if (ny2 - ny1 === 356) return 2;
  if (ny1 - ny0 === 382) return 1;
  return 0;
}

/** R.D. of 1 Tishri of year `y`. */
export const newYear = (y: number): number => EPOCH + elapsedDays(y) + correction(y);
const yearDays = (y: number): number => newYear(y + 1) - newYear(y);

export function monthDays(m: number, y: number): number {
  const len = yearDays(y);
  if (m === 2 || m === 4 || m === 6 || m === 10 || m === 13) return 29;
  if (m === 12 && !isLeap(y)) return 29;
  if (m === 8 && len % 10 !== 5) return 29;
  if (m === 9 && len % 10 === 3) return 29;
  return 30;
}

/** R.D. of day `d` of month `m` of year `y`. */
export function fixedFromHebrew(y: number, m: number, d: number): number {
  let r = newYear(y) + d - 1;
  if (m < 7) {
    for (let k = 7; k <= lastMonth(y); k++) r += monthDays(k, y);
    for (let k = 1; k < m; k++) r += monthDays(k, y);
  } else for (let k = 7; k < m; k++) r += monthDays(k, y);
  return r;
}

/** The Hebrew year that R.D. `fixed` falls in. */
export function hebrewYearOf(fixed: number): number {
  let y = Math.floor((fixed - EPOCH) / 365.2468) + 1;
  while (newYear(y) > fixed) y--;
  while (newYear(y + 1) <= fixed) y++;
  return y;
}

export function hebrewFromFixed(fixed: number): { y: number; m: number; d: number } {
  const y = hebrewYearOf(fixed);
  let m = fixed < fixedFromHebrew(y, 1, 1) ? 7 : 1;
  while (fixed > fixedFromHebrew(y, m, monthDays(m, y))) m++;
  return { y, m, d: fixed - fixedFromHebrew(y, m, 1) + 1 };
}

/** The phone's local day as R.D. (`tzMin` = Date#getTimezoneOffset). */
export const localFixed = (now: number, tzMin: number): number => Math.floor((now - tzMin * 60000) / DAY_MS) + UNIX_RD;

/** Weekday of R.D. `fixed`: 0 Sunday .. 6 Saturday. */
export const weekdayOfFixed = (fixed: number): number => mod(fixed, 7);
