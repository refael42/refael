// Core timing constants. The simulation is deterministic, so these define "game physics".
export const SIM = {
  /** Fixed simulation rate. Low on purpose: rendering interpolates, so 20 Hz looks smooth at 60 fps. */
  tickHz: 20,
  /** Max fixed steps per real frame; beyond this we drop time instead of freezing (spiral of death). */
  maxStepsPerFrame: 10,
} as const;

export const STEP_MS = 1000 / SIM.tickHz;
export const STEP_SEC = 1 / SIM.tickHz;

/** How long an emote bubble stays above a head. */
export const EMOTE_SECONDS = 2.2;
/** Style-test only: seconds for a demo patience bar to drain fully. */
export const DEMO_PATIENCE_SECONDS = 8;
