// Service grades and reviews (owner request: "the better the service, the bigger the reward",
// "customers leave reviews, a good one is a bonus"). Every paying customer grades the visit
// from 1 to 5 stars by how much of their patience was left; the grade scales the bill, on top
// of the tip. Now and then someone writes a review: a good one pays a bonus, and a five-star
// one gets people talking, so more customers come for a while.

export const SERVICE = {
  /** Mood needed for 2, 3, 4 and 5 stars (mood = share of patience left, over the visit). */
  starsAt: [0.25, 0.45, 0.65, 0.85],
  /** The bill per grade, 1 to 5 stars. Good play earns five stars: the base pace is tuned there. */
  payMult: [0.55, 0.7, 0.8, 0.9, 1],
} as const;

export const REVIEW = {
  /** Share of paying groups who write one... */
  chance: 0.25,
  /** ...but no more often than this: a review is a moment, not a stream. */
  minGapSeconds: 45,
  /** The first few guests just eat (the tutorial is running). */
  afterServed: 8,
  /** Bonus coins, in meals of the reviewer's bill, for 4 and 5 stars. */
  bonusMeals: { 4: 1, 5: 2 } as Readonly<Record<number, number>>,
  /** Five stars: more people come for a while ("trending"). */
  buzzSeconds: 15,
  buzzArrivals: 0.2,
  /** Reviews kept on the reviews page (owner: "their own page, claim the money there"). The
   * oldest goes when a new one comes; if its bonus was never taken, it is paid then. */
  keep: 40,
  /** Someone who walked out (fed up in line or at the table) writes an angry one this often... */
  walkoutChance: 0.45,
  /** ...but not more than one in this many seconds. */
  walkoutGapSeconds: 30,
} as const;

/**
 * What a review is about (owner: "vary the reviews, bad ones too, by the service"), and how
 * many written lines each has (strings review.<kind>.<n>; {dish} = what they ate).
 * great/good/ok: the visit in general; dish: praise for what they ate; kids, tourist: families
 * and tourists; slowFood: the food took long; slowLine: the line took long; awful: everything
 * went wrong; walkout: they left without eating.
 */
export const REVIEW_LINES = { great: 10, good: 8, dish: 8, kids: 4, tourist: 4, ok: 8, slowFood: 8, slowLine: 6, awful: 8, walkout: 8 } as const;
export type ReviewKind = keyof typeof REVIEW_LINES;
export const REVIEW_KINDS = Object.keys(REVIEW_LINES) as ReviewKind[];
