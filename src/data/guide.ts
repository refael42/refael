// The restaurant guide (owner M29: "add Michelin logic, stars you get the way you get them in
// real life"). The game's guide is its own (the real one's name and marks are a trademark), but
// it works the way the real one does:
//  - inspectors come unannounced and eat like any guest (a quiet diner alone); after paying,
//    they say who they were and what they thought;
//  - only the plate counts: the cook's skill, how well the dish is mastered, the kitchen's
//    equipment and ingredients, the food reaching the table hot, and consistency (every plate
//    as good as the last). Decor and service speed at the door do not;
//  - the guide comes out on a set day; a decision needs several visits, more for more stars;
//  - stars go up one at a time, and can be taken away when the kitchen slips.
// How it plays: src/sim/game/guide.ts.

export const GUIDE = {
  /** A new edition every this many game days (on day 7, 14, 21...). */
  everyDays: 7,
  /** The chance an inspector comes on a given day, by the stars already held (starred places are watched more). */
  visitChance: [0.3, 0.4, 0.5, 0.6],
  /** The first inspection waits until the restaurant has been open this many days. */
  firstDay: 2,
  /** Visits an edition needs to recommend the place, and to give each star. */
  visitsFor: { plate: 1, stars: [2, 3, 3] as readonly number[] },
  /** The average score each mark needs: recommended (the plate), one, two and three stars. */
  plateScore: 55,
  starScore: [68, 80, 91] as readonly number[],
  /** No visit of the edition may score below this for the star (consistency). */
  starWorst: [58, 72, 84] as readonly number[],
  /** A starred place that averages this far below its mark loses a star. */
  loseMargin: 6,
  /** What the stars bring: every bill, and how many come (people travel for them). */
  price: [1, 1.12, 1.25, 1.45] as readonly number[],
  arrivals: [1, 1.1, 1.2, 1.32] as readonly number[],
  /** A guest who storms out on the inspector's visit... it was the inspector. */
  walkoutScore: 15,
  /** The score: what each part weighs (they add up to 1), and the checker's bonus points. */
  weights: { chef: 0.25, mastery: 0.2, equipment: 0.15, ingredients: 0.15, temperature: 0.15, consistency: 0.1 },
  checkedBonus: 3,
  /** A level this high counts in full (lower levels count by their log). */
  fullLevel: 300,
  /** The plate reaches the table hot within this many seconds of being set on the pass; cold past `coldSeconds`. */
  hotSeconds: 8,
  coldSeconds: 40,
  /** Plates remembered for consistency. */
  recent: 30,
} as const;

/** How an inspector's score reads (they never say the number): the words they leave. */
export const VERDICTS = [
  { min: 90, key: 'guide.verdict5' },
  { min: 80, key: 'guide.verdict4' },
  { min: 68, key: 'guide.verdict3' },
  { min: 55, key: 'guide.verdict2' },
  { min: 0, key: 'guide.verdict1' },
] as const;

export const verdictOf = (score: number): string => (VERDICTS.find((v) => score >= v.min) ?? VERDICTS[VERDICTS.length - 1]!).key;
