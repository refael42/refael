import { Dish } from './dishes';

// Limited-time events (owner request: "events and addictive things that create FOMO"). Three
// kinds, all tuned here:
// - a food festival that runs for a few days by the phone's clock: guests earn festival points,
//   points open rewards on a track, and the last reward is that festival's trophy, which only
//   that festival gives (it comes round again only after every other theme had its turn);
// - a flash deal in the item shop: one item cheaper for a few hours, once;
// - the tourist bus: now and then a bus stops outside and a group walks in at once.

export interface FestivalTheme {
  id: 'fries' | 'burger' | 'falafel' | 'shawarma' | 'hummus' | 'sweet';
  /** Guests who order this dish bring extra points. */
  dish: number;
  /** Banner and trophy colors. */
  color: string;
  accent: string;
}

export const FESTIVAL_THEMES: readonly FestivalTheme[] = [
  { id: 'fries', dish: Dish.Fries, color: '#E8A21A', accent: '#D8352B' },
  { id: 'burger', dish: Dish.Burger, color: '#C8642A', accent: '#F2C14E' },
  { id: 'falafel', dish: Dish.Falafel, color: '#5E9C3A', accent: '#F2D16B' },
  { id: 'shawarma', dish: Dish.Shawarma, color: '#B5452E', accent: '#F4E3B5' },
  { id: 'hummus', dish: Dish.Hummus, color: '#C9A15A', accent: '#6E8B3D' },
  { id: 'sweet', dish: Dish.IceCream, color: '#E2649B', accent: '#7FD3E8' },
];

export type FestivalReward =
  /** Minutes of the restaurant's recent income. */
  | { kind: 'coins'; minutes: number }
  | { kind: 'gems'; gems: number }
  /** Stored spins of the lucky wheel. */
  | { kind: 'spins'; spins: number }
  | { kind: 'boost'; mult: number; minutes: number }
  /** The festival's trophy (kept for good, in every branch), with gems. */
  | { kind: 'trophy'; gems: number };

export const FESTIVAL = {
  /** Each festival runs this long, then the next theme starts at once. */
  days: 3,
  /**
   * Festival number 0 started here (a Monday, 00:00 UTC). Every phone counts from the same
   * moment, so everyone has the same festival on the same days.
   */
  epoch: Date.UTC(2026, 0, 5),
  /** Points: every paying guest, more if they ate the festival dish, plus top service and VIPs. */
  points: { guest: 1, dish: 1, fiveStars: 1, vip: 10 },
  /** The last hours: the button and the banner turn red and say "last hours!". */
  hurryHours: 6,
  /** Every trophy: all bills +10 %, for good. */
  trophyBonus: 0.1,
  /**
   * The reward track: points needed for each step, and what it gives. A first diner reaches
   * the trophy in two or three hours of play over the three days; a big restaurant in one.
   */
  track: [
    { points: 15, reward: { kind: 'coins', minutes: 5 } },
    { points: 40, reward: { kind: 'gems', gems: 5 } },
    { points: 80, reward: { kind: 'spins', spins: 1 } },
    { points: 140, reward: { kind: 'coins', minutes: 15 } },
    { points: 220, reward: { kind: 'boost', mult: 2, minutes: 15 } },
    { points: 330, reward: { kind: 'gems', gems: 15 } },
    { points: 480, reward: { kind: 'spins', spins: 2 } },
    { points: 700, reward: { kind: 'trophy', gems: 30 } },
  ] as readonly { points: number; reward: FestivalReward }[],
  /** Coin rewards pay at least this per minute (a brand-new stand earns almost nothing yet). */
  minPerMinute: 20,
};

/** A flash deal: one shop item for less, for a few hours, once per deal. */
export const FLASH = {
  /** A new deal starts every this many hours (by the phone's clock, the same for everyone). */
  everyHours: 3,
  /** The deals, in a shuffled order by the deal's number; one the player cannot take is skipped. */
  deals: [
    { item: 'boost5', off: 0.5 },
    { item: 'warp4', off: 0.4 },
    { item: 'starCook', off: 0.5 },
    { item: 'boost2', off: 0.5 },
    { item: 'goldenMenu', off: 0.3 },
    { item: 'warp1', off: 0.5 },
    { item: 'starWaiter', off: 0.5 },
    { item: 'turboKitchen', off: 0.35 },
    { item: 'crew3', off: 0.4 },
    { item: 'starManager', off: 0.4 },
  ] as readonly { item: string; off: number }[],
};

/** The tourist bus: a group of guests at once, every so often (sim time, so it never comes offline). */
export const BUS = {
  /** Not before the place is going (seconds played and guests served in this restaurant). */
  firstSeconds: 420,
  minServed: 25,
  /** Gaps between buses (seconds, picked between these). */
  gapSeconds: [420, 720] as const,
  /** Guests on board (picked between these), one stepping off every `dropSeconds`. */
  guests: [5, 8] as const,
  dropSeconds: 1.1,
  /** Driving in and out (s), and the longest it waits for room in the line before leaving. */
  driveSeconds: 3.2,
  waitSeconds: 18,
  /** Tourists pay this much more (they are on holiday) and bring double festival points. */
  payBonus: 0.5,
};
