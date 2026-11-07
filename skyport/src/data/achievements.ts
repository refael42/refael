/**
 * Achievements (M13): each has four medals, bronze, silver, gold and diamond,
 * at growing counts of one thing the player does. Counted for the whole
 * career (a later new airport keeps them). Text in i18n (ach.<id>,
 * ach.<id>.how).
 */
export type AchMetric =
  | 'served'
  | 'pax'
  | 'earned'
  | 'onTime'
  | 'stands'
  | 'staff'
  | 'airlines'
  | 'tier'
  | 'upgrades'
  | 'fiveStars'
  | 'guideStars'
  | 'inspectors'
  | 'emergencies'
  | 'checks'
  | 'guests'
  | 'incidents'
  | 'holidays'
  | 'sales'
  | 'level';

export interface AchievementDef {
  id: string;
  /** UI icon name. */
  icon: string;
  metric: AchMetric;
  /** Counts for bronze, silver, gold and diamond. */
  medals: readonly [number, number, number, number];
}

export const MEDALS = ['bronze', 'silver', 'gold', 'diamond'] as const;
/** Diamonds for each medal. */
export const MEDAL_GEMS: readonly number[] = [2, 5, 10, 25];

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'flights', icon: 'takeoff', metric: 'served', medals: [25, 250, 2500, 25000] },
  { id: 'passengers', icon: 'pax', metric: 'pax', medals: [500, 10000, 200000, 2000000] },
  { id: 'tycoon', icon: 'coin', metric: 'earned', medals: [1e4, 1e7, 1e10, 1e13] },
  { id: 'punctual', icon: 'clock', metric: 'onTime', medals: [20, 300, 3000, 30000] },
  { id: 'builder', icon: 'build', metric: 'stands', medals: [3, 8, 14, 24] },
  { id: 'team', icon: 'team', metric: 'staff', medals: [4, 10, 18, 30] },
  { id: 'partners', icon: 'handshake', metric: 'airlines', medals: [2, 4, 7, 10] },
  { id: 'explorer', icon: 'plane', metric: 'tier', medals: [2, 4, 6, 8] },
  { id: 'upgrader', icon: 'wrench', metric: 'upgrades', medals: [10, 80, 300, 1000] },
  { id: 'loved', icon: 'star', metric: 'fiveStars', medals: [5, 50, 300, 1500] },
  { id: 'guide', icon: 'guide', metric: 'guideStars', medals: [1, 6, 20, 60] },
  { id: 'detective', icon: 'search', metric: 'inspectors', medals: [1, 3, 8, 20] },
  { id: 'hero', icon: 'medic', metric: 'emergencies', medals: [1, 5, 20, 60] },
  { id: 'hangar', icon: 'actRepair', metric: 'checks', medals: [1, 10, 50, 200] },
  { id: 'samaritan', icon: 'land', metric: 'guests', medals: [1, 10, 50, 200] },
  { id: 'cool', icon: 'bell', metric: 'incidents', medals: [1, 10, 50, 150] },
  { id: 'festive', icon: 'party', metric: 'holidays', medals: [1, 3, 8, 20] },
  { id: 'shopkeeper', icon: 'ticket', metric: 'sales', medals: [1e4, 1e6, 1e8, 1e10] },
  { id: 'veteran', icon: 'up', metric: 'level', medals: [5, 15, 30, 50] },
];
