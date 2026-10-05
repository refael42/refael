import type { Role } from './staff';

// Quests (owner request: "a list of tasks to level up"). The restaurant has a level; each level
// is a short list of goals. Finish one, claim its reward; claim them all and the restaurant
// levels up (with a bonus). The first levels are written by hand to teach the game in order;
// after them, levels are made up forever (sim/quests.ts) from the patterns at the bottom.

export type QuestGoal =
  /** Get an upgrade to this level. */
  | { kind: 'upgrade'; item: string; level: number }
  /** Customers served, all time. */
  | { kind: 'serve'; count: number }
  /** Coins earned, all time. */
  | { kind: 'earn'; amount: number }
  /** Someone in this job on the team. */
  | { kind: 'hire'; role: Role }
  | { kind: 'team'; count: number }
  | { kind: 'rating'; stars: number }
  /** Tables in the dining room. */
  | { kind: 'tables'; count: number }
  /** Five-star reviews, all time. */
  | { kind: 'reviews'; count: number }
  /** Decor placed in build mode. */
  | { kind: 'decor'; count: number }
  /** Times rush hour was used. */
  | { kind: 'rush'; count: number }
  /** The longest payment combo. */
  | { kind: 'combo'; count: number }
  /** Open this building tier (1 = the bistro). */
  | { kind: 'building'; tier: number };

export interface QuestLevel {
  goals: QuestGoal[];
  /** Coins for each goal; the level-up bonus is `QUESTS.levelBonus` times this. */
  reward: number;
}

/** Levels 1..10. Rewards are a nice bump, well under a minute's income when you get there. */
export const QUEST_LEVELS: readonly QuestLevel[] = [
  { reward: 15, goals: [{ kind: 'serve', count: 5 }, { kind: 'upgrade', item: 'fries', level: 3 }, { kind: 'team', count: 2 }] },
  { reward: 40, goals: [{ kind: 'upgrade', item: 'sign', level: 5 }, { kind: 'serve', count: 25 }, { kind: 'hire', role: 'waiter' }] },
  { reward: 60, goals: [{ kind: 'upgrade', item: 'fries', level: 10 }, { kind: 'earn', amount: 2000 }, { kind: 'rating', stars: 3.5 }] },
  { reward: 100, goals: [{ kind: 'upgrade', item: 'burger', level: 1 }, { kind: 'upgrade', item: 'stove', level: 10 }, { kind: 'serve', count: 100 }] },
  { reward: 200, goals: [{ kind: 'tables', count: 4 }, { kind: 'combo', count: 4 }, { kind: 'earn', amount: 20000 }] },
  { reward: 700, goals: [{ kind: 'hire', role: 'host' }, { kind: 'decor', count: 1 }, { kind: 'reviews', count: 2 }] },
  { reward: 2000, goals: [{ kind: 'upgrade', item: 'burger', level: 10 }, { kind: 'team', count: 6 }, { kind: 'rush', count: 3 }] },
  { reward: 6000, goals: [{ kind: 'hire', role: 'manager' }, { kind: 'rating', stars: 4.5 }, { kind: 'earn', amount: 1e6 }] },
  { reward: 40000, goals: [{ kind: 'building', tier: 1 }, { kind: 'serve', count: 600 }, { kind: 'upgrade', item: 'sink', level: 25 }] },
  { reward: 150000, goals: [{ kind: 'upgrade', item: 'fries', level: 50 }, { kind: 'reviews', count: 10 }, { kind: 'team', count: 8 }] },
];

/** Levels past the list are made from these. `k` = how many past the list (1, 2, 3...). */
export const QUESTS = {
  /** Claiming the last goal of a level pays this many goal rewards on top. */
  levelBonus: 2,
  /** Endless levels: */
  endless: {
    /** Upgrades taken in turn, each to a higher level every time it comes round. */
    items: ['stove', 'sink', 'fridge', 'sign', 'cloth', 'chairs', 'plants', 'neon', 'burger', 'fries'],
    upgradeLevel: { base: 50, perLevel: 8 },
    serve: { base: 800, perLevel: 250 },
    earn: { base: 2e6, growth: 6 },
    reviews: { base: 10, perLevel: 3 },
    reward: { base: 150000, growth: 3 },
    /** Endless level -> the building tier it asks for (grand restaurant, palace, empire). */
    buildingAt: { 5: 2, 9: 3, 13: 4 } as Readonly<Record<number, number>>,
  },
} as const;
