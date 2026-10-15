// The restrooms (owner request M36: "add restrooms to the restaurant, and a cleaner who keeps
// the restaurant tidy and cleans the restrooms"). A room in the dining room's back corner with
// stalls along the back wall and a sink; more stalls as the building grows. Guests drop in on
// their way out, every visit dirties it a little, and the cleaners come with a mop. A dirty
// restroom shows (flies, a smell), angers the guests who see it and costs rating and reviews.

export const RESTROOM = {
  /** Stalls by building (the room is one tile wider than its stalls: the sink). */
  stalls: [2, 2, 3, 3, 4, 4, 5, 5] as readonly number[],
  /** Two rows deep: the stalls and the sink against the back wall, the way along in front. */
  depth: 2,
  /** A guest who has paid goes first with this chance (one in four or so). */
  visitChance: 0.26,
  /** Seconds in a stall (picked between these), at the sink. */
  useSeconds: [4, 7] as const,
  washSeconds: 2.2,
  /** Waits this long at the door for a stall, then gives up and goes home. */
  waitSeconds: 12,
  /** How much one visit dirties it (0 clean .. 1 filthy). */
  dirtPerUse: 0.07,
  /** From here guests see it: flies and a smell, an angry face, a little off the rating. */
  dirtyAt: 0.5,
  /** A cleaner comes from here; with no cleaner on the team, a waiter does once it is this bad. */
  cleanAt: 0.3,
  waiterAt: 0.8,
  /** Mopping a filthy restroom takes this long (less when it is only a bit dirty), at a normal pace. */
  cleanSeconds: 7,
  /** Rating lost by a guest who found it dirty (a walkout costs -0.12, an angry guest -0.18). */
  rating: -0.05,
  /** A guest who found it spotless now and then is pleased (a heart). */
  sparkleChance: 0.35,
} as const;
