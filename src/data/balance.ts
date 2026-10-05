// Pacing targets and thresholds for the headless balance check (`npm run balance`).

export const BALANCE = {
  /** The bot reacts to tappable things after this many seconds (an attentive human). */
  reactionSeconds: 1.2,
  sampleSeconds: 60,
  /** Longer than this with nothing affordable = boring. */
  deadZoneSeconds: 180,
  /** More purchases than this in one minute = upgrades are too cheap. */
  bulkPerMinute: 30,
  /** Income per minute multiplying by more than this between samples = something exploded. */
  incomeJump: 4,
  /** Targets from the design brief, in seconds. */
  targets: { firstUpgrade: 20, firstMilestone: 300, firstHire: 120, firstBuilding: [1800, 2700] as const },
} as const;

/**
 * "Best value" in the upgrades screen: how strongly each stat moves income, for ranking one more
 * level by gain per coin. A rough guide, not a simulation (prices and quality multiply every
 * bill; more people only help while there is room; tips are a share of the bill).
 */
export const VALUE = {
  price: 1,
  quality: 1,
  arrivals: 0.7,
  cookSpeed: 0.5,
  washSpeed: 0.25,
  plates: 0.25,
  patience: 0.3,
  tips: 0.25,
  tables: 0.6,
  stoves: 0.5,
  seats: 0.3,
  /** A new dish on the menu (more choice, a pricier plate). */
  newDish: 0.4,
  /** How many to show in the "best value" list. */
  listSize: 12,
} as const;
