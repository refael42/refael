import type { CustomerTypeId } from './customers';

// Private events (owner: idea 3, "bookings: a birthday or a wedding at your place; set a long
// table and a special menu, and the pay is big"). Now and then the phone rings: a party wants to
// book. Accept and the restaurant holds a table that seats them a little before they come; they
// arrive together on time, sit, all order the set menu at once (a rush for the kitchen), most
// stay for the cake, and pay the event's price for every plate. How it went (the service stars
// of everyone at the table) decides the gems and the rating at the end. Rules in src/sim/occasions.ts.

export type OccasionId = 'anniversary' | 'birthday' | 'business' | 'barMitzvah' | 'wedding';

export interface OccasionDef {
  id: OccasionId;
  /** Guests, smallest to largest (never more than the biggest table seats). */
  size: readonly [number, number];
  /** The building it is booked in from (src/data/buildings.ts TIERS index). */
  minTier: number;
  /** Every plate's bill (and so the tip) times this: the event's price. */
  fee: number;
  /** Food patience times this (a party in a good mood waits more; a business lunch less). */
  patience: number;
  /** Everyone stays for the dessert (once desserts are open): the cake. */
  cake: boolean;
  /** The set menu is the priciest dishes on the menu (else two at random). */
  priciest?: boolean;
  /** Extra chance each guest orders a drink. */
  drinks: number;
  /** Of the guests, this share are children (the birthday's friends). */
  kids: number;
  /** Who comes (by turns). */
  guests: readonly CustomerTypeId[];
  /** Gems for a perfect evening (half for a good one). */
  gems: number;
  /** Its balloons' colors on the table. */
  colors: readonly [string, string, string];
}

export const OCCASIONS: readonly OccasionDef[] = [
  // A table for two from the first diner on: a couple's anniversary, candles and a dessert.
  { id: 'anniversary', size: [2, 2], minTier: 0, fee: 1.6, patience: 1.2, cake: true, drinks: 0.3, kids: 0, guests: ['relaxed', 'regular'], gems: 2, colors: ['#E5372B', '#FF8FA8', '#E5372B'] },
  { id: 'birthday', size: [4, 6], minTier: 0, fee: 1.5, patience: 1.25, cake: true, drinks: 0.1, kids: 0.6, guests: ['regular', 'relaxed', 'grandma', 'tourist'], gems: 4, colors: ['#FF5A7A', '#FFC93C', '#4AB8FF'] },
  { id: 'business', size: [3, 5], minTier: 1, fee: 1.8, patience: 0.9, cake: false, priciest: true, drinks: 0.15, kids: 0, guests: ['business', 'rushed', 'business', 'tycoon'], gems: 4, colors: ['#2E4A7A', '#C9D3E0', '#2E4A7A'] },
  { id: 'barMitzvah', size: [7, 10], minTier: 1, fee: 1.7, patience: 1.2, cake: true, drinks: 0.2, kids: 0.4, guests: ['regular', 'relaxed', 'grandma', 'party', 'foodie'], gems: 6, colors: ['#3E7BC8', '#FFFFFF', '#F2C14E'] },
  { id: 'wedding', size: [8, 10], minTier: 2, fee: 2.2, patience: 1.15, cake: true, drinks: 0.35, kids: 0.1, guests: ['tycoon', 'business', 'party', 'relaxed', 'grandma', 'influencer'], gems: 10, colors: ['#FFFFFF', '#F7C6D4', '#E8C76A'] },
];

export const OCCASION_BY_ID = Object.fromEntries(OCCASIONS.map((o) => [o.id, o])) as Record<OccasionId, OccasionDef>;

export const OCCASION = {
  /** The phone starts ringing once this many guests were served. */
  firstServed: 30,
  /** Seconds (sim) between a call and the next, at random in this range; the first comes sooner. */
  every: [200, 320] as readonly [number, number],
  firstAfter: 60,
  /** A call waits this long for an answer. */
  answerSeconds: 75,
  /** From yes to the party at the door. */
  leadSeconds: 80,
  /** Their table is held (nobody new seated at it) this long before they come. */
  holdSeconds: 40,
  /** How long they stand at the door for a table that is still not ready (their patience). */
  doorPatience: 45,
  /** Average service stars for the full gems, and for half. */
  perfectStars: 4.5,
  goodStars: 3.5,
  /** Rating: a lovely evening (times the guests), an event that walked out. */
  ratingPerGuest: 0.01,
  failRating: -0.25,
} as const;
