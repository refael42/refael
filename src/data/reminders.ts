// Phone reminders while the game is closed (owner request M35: "updates to the phone when an
// upgrade is done or when it is worth coming back"). Each one says something true about the
// restaurant at that moment; they never come at night, and only a few are planned at a time.

export const REMINDERS = {
  /** No reminder in these local hours: one that falls inside moves to the morning. */
  quiet: { from: 22, to: 9 },
  /** A reminder moved out of the night lands this many minutes after `quiet.to` (not all at 9:00 sharp). */
  morningSpreadMinutes: 40,
  /** At most this many planned at once, and never two closer than this (the later one is dropped). */
  max: 8,
  minGapMinutes: 25,
  /** Nothing planned further ahead than this. */
  horizonDays: 7,
  /** The daily gift's reminder: the next day at this local hour. */
  dailyHour: 11,
  /** A paid offer's last hours (it ends then), the festival's. */
  offerLeadHours: 3,
  starterLeadHours: 6,
  festivalLeadHours: 6,
  /** "We miss you": after this many hours away, and again after the second. */
  missHours: [26, 74] as const,
} as const;

export type ReminderKind = 'work' | 'works' | 'full' | 'wheel' | 'daily' | 'offer' | 'starter' | 'festival' | 'miss';
