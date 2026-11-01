// Achievements (owner: idea 11, "achievements and a leaderboard; Game Center on iPhone and Play
// Games on Android"). Each has three medals: bronze, silver, gold, each with gems. They count
// across branches (the player's, not the restaurant's). `gameCenter`: the id to set up for each
// medal in App Store Connect and the Play Console (store/achievements.md), so the native
// services can mirror them later.

export type AchievementId =
  | 'served' | 'fiveStars' | 'delivered' | 'hires' | 'occasions' | 'vip' | 'inspector' | 'combo'
  | 'building' | 'branches' | 'guide' | 'album' | 'chef' | 'holidays' | 'earned' | 'trophies';

export interface AchievementDef {
  id: AchievementId;
  /** What to reach for bronze, silver and gold. */
  goals: readonly [number, number, number];
  /**
   * How it is measured: `count` adds up what the game's own counter gained (it starts over in a
   * new branch, the achievement does not); `best` keeps the highest value seen.
   */
  kind: 'count' | 'best';
  /** Shown as 10^n (earnings): the goals are powers of ten. */
  power?: boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'served', goals: [100, 2000, 25000], kind: 'count' },
  { id: 'fiveStars', goals: [50, 1000, 10000], kind: 'count' },
  { id: 'earned', goals: [6, 12, 18], kind: 'best', power: true },
  { id: 'combo', goals: [5, 8, 10], kind: 'best' },
  { id: 'hires', goals: [5, 30, 150], kind: 'count' },
  { id: 'building', goals: [1, 3, 6], kind: 'best' },
  { id: 'chef', goals: [10, 25, 50], kind: 'best' },
  { id: 'album', goals: [6, 12, 18], kind: 'best' },
  { id: 'vip', goals: [5, 50, 300], kind: 'best' },
  { id: 'delivered', goals: [20, 300, 3000], kind: 'count' },
  { id: 'occasions', goals: [1, 10, 50], kind: 'count' },
  { id: 'inspector', goals: [1, 5, 20], kind: 'best' },
  { id: 'guide', goals: [1, 2, 3], kind: 'best' },
  { id: 'trophies', goals: [1, 3, 6], kind: 'best' },
  { id: 'holidays', goals: [1, 5, 10], kind: 'best' },
  { id: 'branches', goals: [1, 3, 6], kind: 'best' },
];

export const ACHIEVEMENT = {
  /** Gems for bronze, silver, gold. */
  gems: [5, 15, 40] as readonly number[],
  /** The store id of an achievement's medal (0-2), for Game Center / Play Games. */
  storeId: (id: AchievementId, medal: number) => `ach_${id}_${['bronze', 'silver', 'gold'][medal]}`,
} as const;
