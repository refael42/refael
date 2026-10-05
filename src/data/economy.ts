// Core economy and pacing numbers for the early game. Everything tunable lives here.

export const ECONOMY = {
  /** Enough for the very first upgrade, so the first purchase happens in the first seconds. */
  startCoins: 10,

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

  readMenuSeconds: 1.5,
  paySeconds: 0.7,
  /** Time the served dish spends flying from the pass to the table. */
  serveFlightSeconds: 0.5,
  cleanSeconds: 1.1,
  /** Each extra tap while cleaning skips this share of the job. */
  cleanTapBoost: 0.3,
} as const;

/** While the app is closed the staff keep the doors open, a bit slower than with you around. */
export const OFFLINE = {
  /** Shorter absences are not worth a "welcome back" screen. */
  minSeconds: 60,
  /** Earnings stop after this long away (later upgrades raise it toward 8–12 h). */
  capHours: 2,
  /** Share of the measured income rate that is paid while away. */
  efficiency: 0.5,
  /** The rate is measured by simulating the restaurant headless for this long... */
  sampleSeconds: 180,
  /** ...ignoring the first seconds while it fills up. */
  warmupSeconds: 30,
  /** How slowly the staff seat people while you are away. */
  reactionSeconds: 3,
  /** The (placeholder) rewarded ad multiplies the offline earnings by this. */
  adMultiplier: 2,
} as const;

/** The settings' test-money button (for trying things out): at least this, else x1000 the coins. */
export const TEST_MONEY = { min: 1e6, times: 1000 } as const;

/** Autosave cadence; the game also saves whenever it goes to the background. */
export const SAVE = { intervalSeconds: 5 } as const;
