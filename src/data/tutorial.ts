// The first-run tutorial: what the new manager is walked through, in order. Each step ends by
// itself when the player has done the thing (see sim/tutorial.ts), or with the Skip button.

export const TUTORIAL_STEPS = ['seat', 'serve', 'coins', 'upgrade', 'hire', 'done'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

export const TUTORIAL = {
  /** The "coins" step stays up this long after the first payment, so it can be read. */
  coinsSeconds: 3,
  /** The closing "you're the manager" message. */
  doneSeconds: 4,
} as const;

/** Suggested restaurant names for the dice button (and when the field is left empty). */
export const RESTAURANT_NAMES = {
  en: ['Falafel Palace', 'Shuk Bites', 'Golden Pita', 'Sunset Grill', 'Hummus House', 'Night Market', 'Seaside Shawarma', 'Lucky Fries'],
  he: ['ארמון הפלאפל', 'ביס מהשוק', 'הפיתה הזהובה', 'גריל השקיעה', 'בית החומוס', 'שוק הלילה', 'שווארמה על הים', 'הצ׳יפס של המזל'],
} as const;

/** Names are short enough for the banners. */
export const NAME_MAX = 18;
