// Core economy and pacing numbers for the early game. Everything tunable lives here.

export const ECONOMY = {
  startCoins: 0,

  /** Arrivals per minute at rating 0; each rating star adds `arrivalsPerStar`. */
  baseArrivalsPerMinute: 2.4,
  arrivalsPerStar: 0.8,
  /** Never wait longer than this for the next customer (keeps the first minute lively). */
  maxArrivalGapSeconds: 16,

  rating: { start: 3, min: 1, max: 5, happy: 0.06, neutral: 0.01, angry: -0.18, walkout: -0.12 },

  /** Average mood (0..1) at or above this leaves happy; below `angryMood` leaves angry. */
  happyMood: 0.55,
  angryMood: 0.2,

  /** Tip multiplier = base + mood. */
  tipMoodBase: 0.5,

  /** Payments within this window chain into a combo; each step adds tip bonus. */
  comboWindowSeconds: 8,
  comboTipBonusPerStep: 0.1,
  comboMax: 10,

  readMenuSeconds: 2,
  paySeconds: 0.7,
  /** Time the served dish spends flying from the pass to the table. */
  serveFlightSeconds: 0.5,
  cleanSeconds: 1.1,
  /** Each extra tap while cleaning skips this share of the job. */
  cleanTapBoost: 0.3,
} as const;
