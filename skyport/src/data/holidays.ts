/**
 * Holidays (M11): real dates, from the Hebrew calendar plus a few general
 * ones. While a holiday is on (and on the travel days before it) the airport
 * is decorated and planes fill up. Dates are worked out in sim/game/calendar.ts;
 * text lives in i18n (hol.<id>.title / .body).
 */
export type HolidayId =
  | 'roshHashana'
  | 'sukkot'
  | 'hanukkah'
  | 'tuBishvat'
  | 'purim'
  | 'passover'
  | 'independence'
  | 'lagBaomer'
  | 'shavuot'
  | 'newYear'
  | 'halloween';

export interface HolidayDef {
  id: HolidayId;
  /** Days it lasts. */
  days: number;
  /** Travel days before it: planes are already full and the decorations are up. */
  before: number;
  /** Passenger multiplier while it is on (never above the seats). */
  pax: number;
  /** Decoration colors (string lights and bunting), in order. */
  colors: readonly string[];
}

export const HOLIDAYS: readonly HolidayDef[] = [
  // apples and honey, pomegranates: a sweet new year
  { id: 'roshHashana', days: 2, before: 2, pax: 1.25, colors: ['#e5383b', '#f6c344', '#ffffff'] },
  // the booth with its palm roof, hanging fruit (with Simchat Torah: eight days)
  { id: 'sukkot', days: 8, before: 2, pax: 1.3, colors: ['#3c9d4e', '#f6c344', '#e9762b'] },
  // the eight-branched lamp, one more candle each night
  { id: 'hanukkah', days: 8, before: 1, pax: 1.15, colors: ['#2f6fdf', '#ffffff', '#f6c344'] },
  // the new year of the trees: saplings
  { id: 'tuBishvat', days: 1, before: 0, pax: 1.05, colors: ['#3c9d4e', '#a6d96a', '#f7a1c4'] },
  // costumes, masks and noisemakers
  { id: 'purim', days: 1, before: 1, pax: 1.1, colors: ['#e23bb0', '#f6c344', '#36b6e8', '#7ed957'] },
  // spring, families flying home for the Seder
  { id: 'passover', days: 7, before: 2, pax: 1.3, colors: ['#7ed957', '#f6c344', '#ffffff'] },
  // blue and white flags everywhere, fireworks at night
  { id: 'independence', days: 1, before: 1, pax: 1.2, colors: ['#1f5fd1', '#ffffff'] },
  // bonfires
  { id: 'lagBaomer', days: 1, before: 0, pax: 1.05, colors: ['#ff8a1f', '#f6c344', '#e5383b'] },
  // wheat sheaves and flower crowns
  { id: 'shavuot', days: 1, before: 1, pax: 1.15, colors: ['#ffffff', '#f6c344', '#7ed957'] },
  // December 31 and January 1: fireworks
  { id: 'newYear', days: 2, before: 1, pax: 1.2, colors: ['#f6c344', '#c9ced6', '#e5383b'] },
  // carved pumpkins
  { id: 'halloween', days: 1, before: 0, pax: 1.05, colors: ['#ff8a1f', '#2b2b2b', '#8e44ad'] },
];

export function holidayIndex(id: HolidayId): number {
  return HOLIDAYS.findIndex((h) => h.id === id);
}
