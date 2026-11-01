// The food truck (owner: idea 8, "a side business that drives between neighborhoods and earns
// even while the restaurant is closed"). It waits across the road; send it out to a place for a
// while (by the phone's clock, so it works while the game is closed) and it comes back with what
// it sold: minutes of the restaurant's income, more the further and longer, and gems from the
// big trips. Upgrading the truck sells more. Rules in src/sim/truck.ts.

export interface TruckSpot {
  id: 'beach' | 'offices' | 'market' | 'stadium' | 'festival';
  /** How long the trip takes (real minutes). */
  minutes: number;
  /** What it brings back: this many minutes of the restaurant's income (the rate when it leaves), and gems. */
  incomeMinutes: number;
  gems: number;
  /** The building it is open from. */
  minTier: number;
}

export const TRUCK_SPOTS: readonly TruckSpot[] = [
  { id: 'beach', minutes: 5, incomeMinutes: 4, gems: 0, minTier: 0 },
  { id: 'offices', minutes: 30, incomeMinutes: 18, gems: 0, minTier: 0 },
  { id: 'market', minutes: 120, incomeMinutes: 55, gems: 1, minTier: 1 },
  { id: 'stadium', minutes: 360, incomeMinutes: 130, gems: 3, minTier: 2 },
  { id: 'festival', minutes: 720, incomeMinutes: 220, gems: 6, minTier: 3 },
];

export const TRUCK = {
  /** The truck opens once this many guests were served. */
  minServed: 40,
  /** Each truck level sells this much more. */
  perLevel: 0.2,
  maxLevel: 10,
  /** A level costs this many minutes of income, times this to the level's power. */
  upgradeMinutes: 20,
  upgradeGrowth: 1.7,
  /** Gems to bring it back at once (per hour left, at least one). */
  gemsPerHour: 6,
} as const;
