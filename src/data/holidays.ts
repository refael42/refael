import { Dish } from './dishes';
import { HebrewMonth as M } from '../sim/hebrew';

// Real holidays (owner: idea 5, "doughnuts on Hanukkah, decorations by the season, a holiday
// menu for a limited time, by the real date"). By the phone's date and the Hebrew calendar
// (src/sim/hebrew.ts): while a holiday is on, the restaurant is decorated for it, more people
// go out, its dish is the guests' favorite and sells for more, and the first visit of each
// holiday brings a gift of gems. Rules in src/sim/holidays.ts.

export type HolidayId = 'roshHashana' | 'sukkot' | 'hanukkah' | 'tuBishvat' | 'purim' | 'passover' | 'independence' | 'lagBaomer' | 'shavuot' | 'newYear';

export interface HolidayDef {
  id: HolidayId;
  /** Its first day: a Hebrew date (month as src/sim/hebrew.ts numbers it; Adar means Adar II in a leap year), or a civil one. */
  start: { hebrew: [number, number] } | { civil: [number, number] };
  /** Days it lasts (from its first day). */
  days: number;
  /** More guests while it is on. */
  arrivals: number;
  /** The holiday's dish: ordered more, and sold for more. */
  dish: number;
  /** The decoration by the door (src/render/art/holidayArt.ts HOLIDAY_DECOR order = this list's order). */
  color: string;
  /** Gems the first visit of the holiday brings. */
  gift: number;
  /** Guests come in costume (Purim). */
  costumes?: boolean;
}

export const HOLIDAYS: readonly HolidayDef[] = [
  { id: 'roshHashana', start: { hebrew: [M.Tishri, 1] }, days: 2, arrivals: 1.1, dish: Dish.Salad, color: '#C8342A', gift: 10 },
  { id: 'sukkot', start: { hebrew: [M.Tishri, 15] }, days: 8, arrivals: 1.1, dish: Dish.Shakshuka, color: '#5E9C3A', gift: 10 },
  { id: 'hanukkah', start: { hebrew: [M.Kislev, 25] }, days: 8, arrivals: 1.15, dish: Dish.Fries, color: '#3E7BC8', gift: 15 },
  { id: 'tuBishvat', start: { hebrew: [M.Shevat, 15] }, days: 1, arrivals: 1.05, dish: Dish.Salad, color: '#7BB33A', gift: 5 },
  { id: 'purim', start: { hebrew: [M.Adar, 14] }, days: 2, arrivals: 1.15, dish: Dish.Cake, color: '#B45CFF', gift: 10, costumes: true },
  { id: 'passover', start: { hebrew: [M.Nisan, 15] }, days: 7, arrivals: 1.1, dish: Dish.Steak, color: '#E8C76A', gift: 10 },
  { id: 'independence', start: { hebrew: [M.Iyar, 5] }, days: 1, arrivals: 1.2, dish: Dish.Shawarma, color: '#2F68B0', gift: 10 },
  { id: 'lagBaomer', start: { hebrew: [M.Iyar, 18] }, days: 1, arrivals: 1.1, dish: Dish.Burger, color: '#E8742A', gift: 5 },
  { id: 'shavuot', start: { hebrew: [M.Sivan, 6] }, days: 1, arrivals: 1.1, dish: Dish.Pizza, color: '#F2E4B0', gift: 5 },
  { id: 'newYear', start: { civil: [12, 31] }, days: 2, arrivals: 1.15, dish: Dish.Lobster, color: '#E2B13C', gift: 10 },
];

export const HOLIDAY = {
  /** A holiday's dish sells for this much more while it is on. */
  dishPrice: 1.2,
  /** ...and a guest who could order it does so this often (else as usual). */
  dishChance: 0.35,
  /** The decoration goes up this many days before (the eve counts as the holiday). */
  eveDays: 1,
} as const;
