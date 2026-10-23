// Service and kitchen logic (owner M49: "three big ideas, mostly logic for service and the
// kitchen"): hot plates, mise en place, and special requests. Numbers only; the systems are in
// src/sim/game/service.ts.

/**
 * Hot plates: a dish set on the pass stays hot for `hotSeconds`, then cools to cold over
 * `coolSeconds` (the heat lamps upgrade stretches both). What the guest gets is the heat when the
 * waiter takes it off the pass (or the player sends it flying): hot sells for more, cold brings
 * a complaint (a sour note in the guest's mood, and maybe a review about it).
 */
export const HEAT = {
  hotSeconds: 7,
  coolSeconds: 16,
  /** At or above this it is served hot: the bill x `hotBonus`. */
  hotAt: 0.66,
  hotBonus: 1.05,
  /** Below this it is cold: the bill x `coldPrice`, and a mood note of `coldMood` (0 = furious, 1 = delighted). */
  coldBelow: 0.2,
  coldPrice: 0.85,
  coldMood: 0.2,
} as const;

/**
 * Mise en place: a cook with no ticket chops and portions at their station, filling the prep
 * stock one unit every `seconds`, up to `cap` units (the prep fridge upgrade makes both better,
 * up to `maxCap`). A dish started with a unit of prep cooks `cut` faster: a full stock eats the
 * first minutes of a rush.
 */
export const PREP = {
  seconds: 6,
  cap: 3,
  maxCap: 24,
  cut: 0.35,
} as const;

/** What a guest may ask for on top of the dish (strings req.<id>). */
export const REQUESTS = ['spicy', 'vegan', 'glutenFree'] as const;
export type RequestId = (typeof REQUESTS)[number];

/**
 * Special requests: some guests ask for the dish their way (spicy, vegan, gluten-free). It takes
 * the cook `extraCook` longer, and they may get it wrong: `mistake` for a cook of average craft,
 * less for a better one (and with the special-requests board upgrade). The checker sees a wrong
 * dish and sends it back to be made again; one that reaches the guest is a big complaint. Made
 * right, the guest leaves `tip` of the bill on top of the usual tip, and likes to write about it.
 */
export const REQUEST = {
  /** Share of diners who ask for something, from the first building on, plus `perTier` per building. */
  chance: 0.12,
  perTier: 0.03,
  maxChance: 0.3,
  /** Only once this many guests were served (the tutorial is quiet). */
  afterServed: 12,
  extraCook: 0.25,
  mistake: 0.22,
  /** A wrong dish served: a mood note of `wrongMood`. */
  wrongMood: 0,
  tip: 0.25,
} as const;
