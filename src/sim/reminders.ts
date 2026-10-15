import { FESTIVAL } from '../data/events';
import { OFFLINE } from '../data/economy';
import { REMINDERS, type ReminderKind } from '../data/reminders';
import { festivalEnds } from './festival';
import type { GameState } from './game/types';
import { offersAt } from './offers';
import { freeReady } from './wheel';

// Which phone reminders to plan as the game closes (pure: the times come in, a list goes out;
// src/notify turns it into the phone's own notifications). Each is true at its moment: the
// crews do build while the game is closed, the free spin does come back, the offer does end.

export interface Reminder {
  kind: ReminderKind;
  /** When (phone clock, ms). */
  at: number;
  /** What the text needs: a hero's id, a count. */
  hero?: string;
  count?: number;
}

/** When two fall too close together, the earlier kind in this list wins. */
const PRIORITY: readonly ReminderKind[] = ['work', 'works', 'offer', 'starter', 'festival', 'wheel', 'full', 'daily', 'miss'];

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** The local hour (0-23.99) at a moment; `offsetMin` = Date#getTimezoneOffset (minutes, UTC - local). */
const localHour = (at: number, offsetMin: number): number => ((((at - offsetMin * MIN) / HOUR) % 24) + 24) % 24;

/** Out of the quiet hours: a time at night moves to the next morning (a little after it opens). */
export function awake(at: number, offsetMin: number, seed = 0): number {
  const { from, to } = REMINDERS.quiet;
  const h = localHour(at, offsetMin);
  const night = from > to ? h >= from || h < to : h >= from && h < to;
  if (!night) return at;
  const wait = (h >= from ? 24 - h + to : to - h) * HOUR;
  return at + wait + (seed % REMINDERS.morningSpreadMinutes) * MIN;
}

/** The next day at a local hour. */
function tomorrowAt(now: number, hour: number, offsetMin: number): number {
  const h = localHour(now, offsetMin);
  return now + (24 - h + hour) * HOUR;
}

/**
 * The reminders to plan now that the game closes, soonest first: big upgrades done, the time
 * that offline earnings fill up, the free spin back, tomorrow's gift, a paid offer or the
 * festival in its last hours, and "we miss you" after a day or so away.
 */
export function planReminders(s: GameState, now: number, offsetMin: number): Reminder[] {
  const out: Reminder[] = [];
  // Big upgrades: the first done, then (if more) when they all are.
  const works = s.works.map((w) => Math.max(0, w.left)).filter((left) => left > 0).sort((a, b) => a - b);
  if (works.length > 0) out.push({ kind: 'work', at: now + works[0]! * 1000 });
  if (works.length > 1) out.push({ kind: 'works', at: now + works[works.length - 1]! * 1000, count: works.length });
  // Offline earnings stop counting after the cap: worth coming back by then.
  out.push({ kind: 'full', at: now + OFFLINE.capHours * HOUR });
  if (!freeReady(s.wheel, now)) out.push({ kind: 'wheel', at: s.wheel.nextFree });
  out.push({ kind: 'daily', at: tomorrowAt(now, REMINDERS.dailyHour, offsetMin) });
  for (const o of offersAt(s, now)) {
    if (o.bought) continue;
    if (o.offer.kind === 'starter') out.push({ kind: 'starter', at: o.ends - REMINDERS.starterLeadHours * HOUR });
    else if (o.offer.kind === 'hero' && o.hero) out.push({ kind: 'offer', at: o.ends - REMINDERS.offerLeadHours * HOUR, hero: o.hero.id });
  }
  if (s.festival.id >= 0 && s.festival.claimed < FESTIVAL.track.length) out.push({ kind: 'festival', at: festivalEnds(s.festival.id) - REMINDERS.festivalLeadHours * HOUR });
  for (const h of REMINDERS.missHours) out.push({ kind: 'miss', at: now + h * HOUR });

  const horizon = now + REMINDERS.horizonDays * 24 * HOUR;
  const planned = out
    .map((r, i) => ({ ...r, at: awake(r.at, offsetMin, i * 7) }))
    .filter((r) => r.at > now + MIN && r.at < horizon)
    .sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || a.at - b.at);
  // Two too close together: the one that matters more stays.
  const kept: Reminder[] = [];
  for (const r of planned) {
    if (kept.some((k) => Math.abs(k.at - r.at) < REMINDERS.minGapMinutes * MIN)) continue;
    kept.push(r);
  }
  kept.sort((a, b) => a.at - b.at);
  kept.length = Math.min(kept.length, REMINDERS.max);
  return kept;
}
