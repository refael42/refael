// The week (owner request: "regular days have the usual number of customers, the weekend
// usually more"). Day 1 of the game is a Sunday, as the Israeli week starts; Friday and Saturday
// are the weekend. Like the weather it is a calendar, not dice: the same day is the same for
// everyone, and the simulation's random numbers stay untouched.

export const WEEK = {
  days: 7,
  /** Weekdays (0 = Sunday) that are the weekend: Friday and Saturday. */
  weekend: [5, 6] as readonly number[],
  /** A weekend day brings this many more walk-ins (picked per day between the two). */
  weekendArrivals: [1.3, 1.6] as const,
  /** Thursday evening already gets going: the last part of the day, a little busier. */
  thursday: { weekday: 4, from: 0.6, arrivals: 1.15 },
};

export const WEEKDAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
