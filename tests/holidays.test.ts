import { describe, expect, it } from 'vitest';
import { Dish } from '../src/data/dishes';
import { HOLIDAYS } from '../src/data/holidays';
import { STAND_MAP } from '../src/data/maps';
import { hebrewFromFixed, isLeap, localFixed } from '../src/sim/hebrew';
import { holidayArrivals, holidayOn, holidayPrice, nextHoliday, syncHolidays } from '../src/sim/holidays';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';

// Owner, idea 5: "real holidays: doughnuts on Hanukkah, decorations by the season, a holiday menu, by the real date".

const UNIX_RD = 719163;
const rd = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 86400000) + UNIX_RD;
const at = (y: number, m: number, d: number, hour = 12) => Date.UTC(y, m - 1, d, hour);
const name = (id: string) => HOLIDAYS.findIndex((h) => h.id === id);

describe('the Hebrew calendar', () => {
  it('matches Intl, day by day, for twelve years', () => {
    const f = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
    const MONTHS = ['', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul', 'Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat'];
    for (let fixed = rd(2024, 1, 1); fixed < rd(2036, 1, 1); fixed++) {
      const parts = Object.fromEntries(f.formatToParts((fixed - UNIX_RD) * 86400000).map((p) => [p.type, p.value]));
      const h = hebrewFromFixed(fixed);
      const month = h.m === 12 ? (isLeap(h.y) ? 'Adar I' : 'Adar') : h.m === 13 ? 'Adar II' : MONTHS[h.m];
      expect(`${h.d} ${month} ${h.y}`).toBe(`${parts.day} ${parts.month} ${parts.year}`);
    }
  });
});

describe('real holidays', () => {
  it('fall on their real dates (with their eve)', () => {
    // Hanukkah 5787: the first candle on the evening of 4 December 2026, eight days.
    expect(holidayOn(rd(2026, 12, 4))).toMatchObject({ index: name('hanukkah'), day: 0 });
    expect(holidayOn(rd(2026, 12, 12))).toMatchObject({ index: name('hanukkah'), day: 8 });
    expect(holidayOn(rd(2026, 12, 13))).toBeNull();
    // Purim 5787 is in Adar II (a leap year): 23 March 2027.
    expect(holidayOn(rd(2027, 3, 23))?.index).toBe(name('purim'));
    // Passover 5787: 22 April 2027.
    expect(holidayOn(rd(2027, 4, 22))?.index).toBe(name('passover'));
    // Rosh Hashana 5787: 12 September 2026.
    expect(holidayOn(rd(2026, 9, 12))?.index).toBe(name('roshHashana'));
    // New Year: 31 December and 1 January.
    expect(holidayOn(rd(2026, 12, 31))?.index).toBe(name('newYear'));
    expect(holidayOn(rd(2027, 1, 1))?.index).toBe(name('newYear'));
    // An ordinary day.
    expect(holidayOn(rd(2026, 11, 3))).toBeNull();
  });

  it('Independence Day moves off the weekend and off Monday, as in Israel', () => {
    // 5 Iyar 5787 is Wednesday 12 May 2027: no move. 5 Iyar 5788 falls on Monday 1 May 2028: Tuesday 2 May.
    expect(holidayOn(rd(2027, 5, 12))).toMatchObject({ index: name('independence'), day: 1 });
    expect(holidayOn(rd(2028, 5, 2))).toMatchObject({ index: name('independence'), day: 1 });
    // 5 Iyar 5789 is Saturday 21 April 2029: Thursday the 19th.
    expect(holidayOn(rd(2029, 4, 19))).toMatchObject({ index: name('independence'), day: 1 });
  });

  it('the next one is always somewhere ahead', () => {
    for (let f = rd(2026, 1, 1); f < rd(2029, 1, 1); f += 13) {
      const n = nextHoliday(f);
      expect(n.inDays).toBeGreaterThan(0);
      expect(n.inDays).toBeLessThan(120);
    }
  });

  it('in the game: more guests, the holiday dish sells for more, one gift each, costumes on Purim', () => {
    const s = createGame(STAND_MAP, 4);
    const tz = 0;
    syncHolidays(s, at(2026, 11, 3), tz);
    expect(s.holidays.on).toBe(-1);
    expect(holidayArrivals(s)).toBe(1);
    const gems = s.gems;
    syncHolidays(s, at(2026, 12, 6), tz);
    expect(HOLIDAYS[s.holidays.on]!.id).toBe('hanukkah');
    expect(holidayArrivals(s)).toBeGreaterThan(1);
    expect(holidayPrice(s, Dish.Fries)).toBeGreaterThan(1);
    expect(holidayPrice(s, Dish.Burger)).toBe(1);
    expect(s.gems).toBe(gems + HOLIDAYS[name('hanukkah')]!.gift);
    expect(s.events.some((e) => e.type === Ev.HolidayStart && e.b > 0)).toBe(true);
    // The same holiday again (another day, or after a restart): no second gift.
    syncHolidays(s, at(2026, 12, 7), tz);
    const r = parseSave(JSON.stringify(makeSave(s, 1000)));
    if (!r.ok) throw new Error(r.reason);
    const back = restoreGame(r.save, 1, 2000);
    const g2 = back.gems;
    syncHolidays(back, at(2026, 12, 8), tz);
    expect(back.gems).toBe(g2);
    // The phone's time zone decides the day.
    expect(localFixed(at(2026, 12, 3, 23), -180)).toBe(rd(2026, 12, 4));
  });
});
