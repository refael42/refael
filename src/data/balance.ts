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
  targets: { firstUpgrade: 20, firstMilestone: 300, firstHire: 120 },
} as const;
