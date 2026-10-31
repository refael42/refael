// Rewarded ads (owner: idea 12, "watch an ad and get x2 for a while"). The player chooses to
// watch; nothing interrupts the game. Each reward has a daily limit (the phone's day), so ads
// are a bonus on top of playing, not a second job. Rules in src/sim/ads.ts; the ad itself comes
// from src/ads (the real network in a native build, a test ad elsewhere, none in a store build
// without one).

export type AdReward = 'boost' | 'gems' | 'spin' | 'offline';

export const AD_REWARDS: readonly AdReward[] = ['boost', 'gems', 'spin', 'offline'];

export const ADS = {
  /** Each reward's ads a day. */
  perDay: { boost: 6, gems: 3, spin: 2, offline: 3 } as Record<AdReward, number>,
  /** x2 income: each ad adds this many minutes (sim time), stored up to the cap. */
  boostMult: 2,
  boostMinutes: 15,
  boostCapMinutes: 60,
  /** Gems for the gem ad. */
  gems: 3,
  /** Ads are offered once the first guests were served (not in the tutorial). */
  minServed: 10,
} as const;
