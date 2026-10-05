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
  /** Written lines per grade, as strings review.<stars>.<n>. */
  lines: 4,
  /** Reviews kept for the screen. */
  keep: 12,
} as const;
