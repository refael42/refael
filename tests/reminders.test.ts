import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { OFFLINE } from '../src/data/economy';
import { REMINDERS } from '../src/data/reminders';
import { he } from '../src/i18n/he';
import { en } from '../src/i18n/en';
import { noteFor } from '../src/notify/text';
import { createGame } from '../src/sim/game/create';
import { seeOffers } from '../src/sim/offers';
import { awake, planReminders } from '../src/sim/reminders';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
/** Israel in winter: UTC+2 (getTimezoneOffset gives -120). */
const IL = -120;
/** 14:00 in Israel on a Wednesday. */
const NOON = Date.UTC(2026, 9, 14, 12, 0);
const localHour = (at: number) => (((at / HOUR + 2) % 24) + 24) % 24;

describe('phone reminders (owner M35)', () => {
  it('nothing at night: a time in the quiet hours moves to the morning', () => {
    const late = Date.UTC(2026, 9, 14, 21, 30); // 23:30 local
    const moved = awake(late, IL);
    expect(localHour(moved)).toBeGreaterThanOrEqual(REMINDERS.quiet.to);
    expect(localHour(moved)).toBeLessThan(REMINDERS.quiet.to + 1);
    expect(moved - late).toBeLessThan(12 * HOUR);
    expect(awake(NOON, IL)).toBe(NOON);
  });

  it('a big upgrade under way: "done" when its crew finishes, and "all done" for the last', () => {
    const s = createGame(STAND_MAP, 1);
    s.works = [
      { item: 'fries', level: 2, total: 600, left: 600, at: null },
      { item: 'burger', level: 2, total: 9000, left: 9000, at: null },
    ] as typeof s.works;
    const plan = planReminders(s, NOON, IL);
    expect(plan.find((r) => r.kind === 'work')?.at).toBe(NOON + 600 * 1000);
    expect(plan.find((r) => r.kind === 'works')).toMatchObject({ at: NOON + 9000 * 1000, count: 2 });
  });

  it('the till fills after the offline cap; the daily gift tomorrow; "we miss you" after a day', () => {
    const plan = planReminders(createGame(STAND_MAP, 2), NOON, IL);
    expect(plan.find((r) => r.kind === 'full')?.at).toBe(NOON + OFFLINE.capHours * HOUR);
    const daily = plan.find((r) => r.kind === 'daily')!;
    expect(localHour(daily.at)).toBeCloseTo(REMINDERS.dailyHour);
    expect(daily.at - NOON).toBeLessThan(24 * HOUR);
    expect(plan.some((r) => r.kind === 'miss')).toBe(true);
  });

  it('the free spin only when it is not back yet; the paid offers in their last hours', () => {
    const s = createGame(STAND_MAP, 3);
    s.wheel.nextFree = NOON - HOUR;
    expect(planReminders(s, NOON, IL).some((r) => r.kind === 'wheel')).toBe(false);
    s.wheel.nextFree = NOON + HOUR;
    seeOffers(s, NOON);
    const plan = planReminders(s, NOON, IL);
    expect(plan.some((r) => r.kind === 'wheel')).toBe(true);
    const offer = plan.find((r) => r.kind === 'offer');
    if (offer) expect(offer.hero).toBeTruthy();
    expect(plan.some((r) => r.kind === 'starter')).toBe(true);
  });

  it('a few at a time, soonest first, never at night, never two on top of each other (the upgrade wins)', () => {
    const s = createGame(STAND_MAP, 4);
    // A crew done 10 minutes before the till is full: too close, the upgrade stays.
    s.works = [{ item: 'fries', level: 2, total: 6600, left: OFFLINE.capHours * 3600 - 600, at: null }] as typeof s.works;
    seeOffers(s, NOON);
    const plan = planReminders(s, NOON, IL);
    expect(plan.length).toBeLessThanOrEqual(REMINDERS.max);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]!.at).toBeGreaterThan(plan[i - 1]!.at);
      expect(plan[i]!.at - plan[i - 1]!.at).toBeGreaterThanOrEqual(REMINDERS.minGapMinutes * MIN);
    }
    for (const r of plan) {
      const h = localHour(r.at);
      expect(h >= REMINDERS.quiet.to && h < REMINDERS.quiet.from, `${r.kind} at ${h}`).toBe(true);
    }
    expect(plan.some((r) => r.kind === 'work')).toBe(true);
    expect(plan.some((r) => r.kind === 'full')).toBe(false);
  });

  it('every reminder has words in both languages, with the names filled in', () => {
    const kinds = ['work', 'works', 'full', 'wheel', 'daily', 'offer', 'starter', 'festival', 'miss'] as const;
    for (const dict of [he, en] as Record<string, string>[]) {
      const t = (k: string) => dict[k] ?? k;
      for (const kind of kinds) {
        const note = noteFor({ kind, at: NOON, hero: 'goldie', count: 3 }, t, 'The Taste');
        expect(note.title, kind).not.toMatch(/notify\.|\{/);
        expect(note.body, kind).not.toMatch(/notify\.|\{/);
      }
    }
    expect(noteFor({ kind: 'offer', at: 0, hero: 'goldie' }, (k) => (en as Record<string, string>)[k] ?? k, 'x').title).toContain('Chef Goldie');
  });
});
