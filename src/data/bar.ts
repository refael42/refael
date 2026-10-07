// The bar (owner: "a bar from the first moment that grows with the stages: bartenders who
// shake cocktails, plain drinks too; a ready drink goes on the bar's pass and a waiter takes
// it; at the last stage the bar is a rectangle with only the side toward the kitchen open,
// three sides in all; later guests sit at the bar and the bartenders serve them too").
// Where it stands in each building: src/data/maps.ts. How it runs: src/sim/game/bar.ts.

export interface DrinkDef {
  id: string;
  /** i18n key of its name. */
  nameKey: string;
  /** Its price as a share of the meal it comes with (so drinks keep up with the menu). */
  share: number;
  /** Seconds to make at base speed. */
  mixSeconds: number;
  /** A cocktail: shaken (the bartender shakes it over their shoulder); else poured. */
  shaken: boolean;
  /** The building it opens with. */
  tier: number;
}

export const DRINKS: readonly DrinkDef[] = [
  { id: 'soda', nameKey: 'drink.soda', share: 0.18, mixSeconds: 1.6, shaken: false, tier: 0 },
  { id: 'lemonade', nameKey: 'drink.lemonade', share: 0.22, mixSeconds: 2, shaken: false, tier: 0 },
  { id: 'mojito', nameKey: 'drink.mojito', share: 0.4, mixSeconds: 4, shaken: true, tier: 0 },
  { id: 'margarita', nameKey: 'drink.margarita', share: 0.48, mixSeconds: 4.5, shaken: true, tier: 2 },
  { id: 'tropical', nameKey: 'drink.tropical', share: 0.55, mixSeconds: 5, shaken: true, tier: 4 },
  { id: 'martini', nameKey: 'drink.martini', share: 0.65, mixSeconds: 5, shaken: true, tier: 6 },
];

export const BAR = {
  /** A seated guest orders a drink with the meal this often (by their id: the game's dice are left alone). */
  drinkChance: 0.45,
  /** Drinks on the bar's pass at once (more wait for room, like dishes). */
  passSlots: 3,
  /** Seconds to hand a drink over (to a waiter, or across the counter). */
  handoffSeconds: 0.5,
  /** Bar seats (stools) open with this building (src/data/unlocks.ts); before that the bar only makes drinks for the tables. */
  seatsTier: 2,
  /** A guest who comes alone sits at the bar this often, when a stool is free and a bartender works. */
  barGuestChance: 0.35,
  /** A bar guest's drink (and a second one this often) is worth this much of the priciest dish on the menu. */
  barShare: 0.5,
  secondRound: 0.4,
  /** Seconds a bar guest spends over a drink. */
  sipSeconds: 6,
  /** How long a bar guest waits for their drink before giving up (times the patience upgrades). */
  barPatience: 30,
} as const;

/** Drinks on the menu in a building of this tier. */
export const drinksAt = (tier: number): DrinkDef[] => DRINKS.filter((d) => d.tier <= tier);
