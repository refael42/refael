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
  /** A guest who found the restroom dirty (owner M36) writes about it this often (the usual gap applies). */
  restroomChance: 0.4,
} as const;

/**
 * What a review is about (owner: "vary the reviews, bad ones too, by the service"; later "at
 * least 200 different ones, like real restaurant reviews and ratings"), and how many written
 * lines each has (strings review.<kind>.<n>; {dish} = what they ate). The lines are written in
 * the voice of real reviews (what they ordered, the wait, the staff, the room, the bill), not
 * copied from any.
 * great/good/ok: the visit in general; dish: praise for what they ate; kids, tourist, date:
 * families, tourists and couples; staff, host, decor, value: the waiters, the welcome, the room,
 * the bill; dessert, drinks: those who had one; critic: a food writer's five stars; mixed: three
 * stars, good and bad; slowFood: the food took long; slowLine: the line took long; awful:
 * everything went wrong; walkout: they left without eating; restroom: a dirty restroom.
 */
export const REVIEW_LINES = {
  great: 30, good: 28, dish: 28, kids: 18, tourist: 18, date: 12, staff: 14, host: 12, decor: 14, value: 12,
  dessert: 12, drinks: 12, critic: 12, ok: 22, mixed: 14, slowFood: 22, slowLine: 20, awful: 22, walkout: 20, restroom: 16,
} as const;
export type ReviewKind = keyof typeof REVIEW_LINES;
export const REVIEW_KINDS = Object.keys(REVIEW_LINES) as ReviewKind[];

/**
 * How likely a happy guest (4 or 5 stars) is to write about each thing, when it fits them
 * (a tourist, a family, a couple, had dessert or a drink, met the host, five stars).
 */
export const HAPPY_WEIGHTS = { dish: 3, praise: 3, staff: 1.2, decor: 1, value: 0.8, tourist: 3, kids: 3, date: 1.6, dessert: 2, drinks: 1.8, host: 1, critic: 0.5 } as const;

/**
 * The scores under a review, like a review site's: food, service and the place, 1 to 5 (0: not
 * rated). Each is the review's stars plus this shift for its kind (then a nudge of up to a star,
 * by the review's id); `food: null` = they never ate.
 */
export const REVIEW_SCORES: Readonly<Record<ReviewKind, { food: number | null; service: number; place: number }>> = {
  great: { food: 0, service: 0, place: 0 }, good: { food: 0.3, service: 0, place: -0.3 }, dish: { food: 1, service: 0, place: -0.4 },
  kids: { food: 0, service: 0.4, place: 0 }, tourist: { food: 0.4, service: 0, place: 0 }, date: { food: 0, service: 0, place: 0.6 },
  staff: { food: -0.3, service: 1, place: 0 }, host: { food: -0.3, service: 1, place: 0.2 }, decor: { food: -0.3, service: 0, place: 1 },
  value: { food: 0.3, service: -0.3, place: -0.3 }, dessert: { food: 1, service: 0, place: -0.3 }, drinks: { food: 0.4, service: 0.3, place: 0.3 },
  critic: { food: 0, service: 0, place: 0 }, ok: { food: 0.3, service: -0.3, place: 0 }, mixed: { food: 1, service: -0.7, place: 0.3 },
  slowFood: { food: 1.5, service: -0.4, place: 1 }, slowLine: { food: 1.5, service: -0.4, place: 0.7 }, awful: { food: 0.3, service: -0.2, place: 0.5 },
  walkout: { food: null, service: 0, place: 0.8 }, restroom: { food: 2.2, service: 0.6, place: -1 },
};
