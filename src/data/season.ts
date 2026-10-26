// The season pass (owner M50: "start with one idea and work on it until it fits the game's
// logic perfectly"; picked from the fifteen: a season pass). Not the festival (a few days, points
// from every guest): a four-week season of missions that ask for the game's own skills (hot
// plates, special requests made right, mise en place, desserts, drinks, deliveries, five-star
// service). Missions give season XP; XP climbs 30 tiers; every tier has a prize on the free track
// and a bigger one on the gold track (bought once a season, in the store or with gems). The last
// free tier gives the season's medal: every bill a little higher, for good. Numbers only; the
// rules are in src/sim/season.ts.

export type MissionKind = 'serve' | 'fiveStar' | 'hot' | 'request' | 'prep' | 'upgrades' | 'rush' | 'dessert' | 'drink' | 'delivery' | 'caught';

export interface MissionDef {
  kind: MissionKind;
  /** How many a daily / weekly mission asks for: base + perTier x the building tier (null: not that kind of mission). */
  daily: readonly [number, number] | null;
  weekly: readonly [number, number] | null;
  /**
   * What the restaurant needs before this mission can come up: a cook (prep), the desserts menu
   * (chef level), a bartender, a courier, a checker, guests who ask for special requests.
   */
  needs?: 'desserts' | 'bartender' | 'courier' | 'checker' | 'requests';
}

export const MISSIONS: readonly MissionDef[] = [
  { kind: 'serve', daily: [30, 15], weekly: [200, 100] },
  { kind: 'fiveStar', daily: [12, 6], weekly: [80, 40] },
  { kind: 'hot', daily: [20, 10], weekly: [130, 65] },
  { kind: 'request', daily: [3, 1], weekly: [16, 6], needs: 'requests' },
  { kind: 'prep', daily: [12, 6], weekly: [80, 40] },
  { kind: 'upgrades', daily: [15, 5], weekly: [90, 30] },
  { kind: 'rush', daily: [2, 0], weekly: [10, 0] },
  { kind: 'dessert', daily: [4, 2], weekly: [25, 10], needs: 'desserts' },
  { kind: 'drink', daily: [6, 3], weekly: [40, 15], needs: 'bartender' },
  { kind: 'delivery', daily: [5, 3], weekly: [30, 15], needs: 'courier' },
  { kind: 'caught', daily: null, weekly: [3, 1], needs: 'checker' },
];

export const MISSION_BY_KIND: Readonly<Record<MissionKind, MissionDef>> = Object.fromEntries(MISSIONS.map((m) => [m.kind, m])) as Record<MissionKind, MissionDef>;

export type SeasonReward =
  /** Minutes of the restaurant's recent income. */
  | { kind: 'coins'; minutes: number }
  | { kind: 'gems'; gems: number }
  /** Stored spins of the lucky wheel. */
  | { kind: 'spins'; spins: number }
  | { kind: 'boost'; mult: number; minutes: number }
  | { kind: 'talent'; points: number }
  /** The season's medal (free: silver, gold: gold): every bill higher for good, with gems. */
  | { kind: 'medal'; gems: number };

const c = (minutes: number): SeasonReward => ({ kind: 'coins', minutes });
const g = (gems: number): SeasonReward => ({ kind: 'gems', gems });
const sp = (spins: number): SeasonReward => ({ kind: 'spins', spins });
const b = (mult: number, minutes: number): SeasonReward => ({ kind: 'boost', mult, minutes });
const tp = (points: number): SeasonReward => ({ kind: 'talent', points });

export const SEASON = {
  /** Each season runs this long, then the next starts at once. */
  days: 28,
  /** Season 0 started here (a Monday, 00:00 UTC, like the festival): the same season on every phone. */
  epoch: Date.UTC(2026, 0, 5),
  /** Missions: three a day (new ones at local midnight), five more every week (they stay till the season ends). */
  dailyCount: 3,
  weeklyCount: 5,
  dailyXp: 60,
  weeklyXp: 220,
  /** XP for each tier; past the last one, every `tierXp` more gives `extra` (the season keeps paying). */
  tierXp: 180,
  extra: g(8),
  /** The gold track: the store product (consumable, once a season), or this many gems. */
  goldProduct: 'season_gold',
  goldPrice: '₪19.90',
  goldGems: 600,
  /** Each medal: every bill this much higher, for good (in every branch). */
  medal: { free: 0.02, gold: 0.03 },
  /** The last days: the button turns red. */
  hurryDays: 2,
  /** Coin rewards pay at least this per minute (a brand-new stand earns almost nothing yet). */
  minPerMinute: 20,
  /** Tier by tier (index 0 = tier 1). */
  free: [
    c(10), sp(1), c(15), tp(2), g(10), c(20), b(2, 15), sp(1), c(30), g(15),
    tp(3), c(30), sp(1), b(2, 20), g(15), c(45), tp(3), sp(2), c(60), g(20),
    b(2, 30), c(60), tp(4), sp(2), g(25), c(90), b(3, 15), tp(5), sp(3), { kind: 'medal', gems: 40 },
  ] as readonly SeasonReward[],
  gold: [
    g(30), c(30), b(3, 15), tp(5), g(30), sp(2), c(60), g(40), b(3, 20), tp(6),
    g(40), sp(3), c(90), g(50), b(3, 30), tp(8), g(50), c(120), sp(3), g(60),
    b(5, 15), tp(10), g(60), c(180), sp(4), g(80), b(5, 20), tp(12), c(240), { kind: 'medal', gems: 150 },
  ] as readonly SeasonReward[],
};

export const SEASON_TIERS = SEASON.free.length;
