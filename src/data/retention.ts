// Things that bring a player back (owner request: "more professional and addictive"): a gift
// for every day in a row, a golden VIP guest now and then, and a present left on the sidewalk.
// Coin rewards are minutes or seconds of the restaurant's own recent income, so they matter in
// the first diner and in the last empire alike.

export interface DailyReward {
  /** Minutes of income in coins (0 = none). */
  minutes: number;
  gems: number;
  /** An income boost: x`mult` for `boostMinutes`. */
  boostMult?: number;
  boostMinutes?: number;
}

export const DAILY = {
  /** Day 1..7 of a streak; after day 7 it starts over at day 1. Miss a day and it starts over too. */
  rewards: [
    { minutes: 3, gems: 0 },
    { minutes: 5, gems: 0 },
    { minutes: 0, gems: 10 },
    { minutes: 10, gems: 0 },
    { minutes: 15, gems: 0 },
    { minutes: 20, gems: 5 },
    { minutes: 0, gems: 30, boostMult: 2, boostMinutes: 15 },
  ] as readonly DailyReward[],
};

export const VIP = {
  /** Once the place is known (after the first quarter hour), then at most one at a time, this far apart. */
  afterSeconds: 900,
  gapSeconds: 300,
  /** Chance that a newcomer is a VIP (once the gap has passed). */
  chance: 0.06,
  /** Their bonus: this many seconds of income, times the service grade (5 stars = all of it). */
  bonusSeconds: 45,
  /** ...and sometimes gems. */
  gemChance: 0.35,
  gems: 2,
};

export const GIFT = {
  /** A present appears on the sidewalk this often (and the first one after `firstSeconds`). */
  everySeconds: 240,
  firstSeconds: 90,
  /** It waits this long for a tap, then the street sweeper takes it. */
  staysSeconds: 45,
  /** Inside: this many seconds of income, or (sometimes) gems. */
  coinSeconds: 60,
  gemChance: 0.2,
  gems: 3,
};
