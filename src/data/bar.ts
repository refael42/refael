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

/**
 * The bar's design levels (owner M30: "improve the bar with more design levels you can unlock"):
 * on top of the counter's looks and finishes, the bar counter's levels open pieces one at a time,
 * each bringing something. Overhead pieces hang above the bar, the rest stand on the counter.
 *  - perks: `drinkPrice` and `mixSpeed` multiply, `drinkChance` and `barGuests` add to the
 *    chance a table orders a drink and a guest alone sits at the bar, `arrivals` multiplies.
 */
export const BarPiece = { GlassRack: 0, Taps: 1, Neon: 2, DryIce: 3, Champagne: 4, Chandelier: 5 } as const;
export type BarPiece = (typeof BarPiece)[keyof typeof BarPiece];

export interface BarStage {
  piece: BarPiece;
  level: number;
  perk: { drinkPrice?: number; mixSpeed?: number; drinkChance?: number; barGuests?: number; arrivals?: number };
  name: string;
  gives: string;
}

export const BAR_STAGES: readonly BarStage[] = [
  { piece: BarPiece.GlassRack, level: 10, perk: { drinkPrice: 1.1 }, name: 'barStage.rack', gives: 'barStage.rack.gives' },
  { piece: BarPiece.Taps, level: 25, perk: { drinkChance: 0.1 }, name: 'barStage.taps', gives: 'barStage.taps.gives' },
  { piece: BarPiece.Neon, level: 50, perk: { barGuests: 0.15 }, name: 'barStage.neon', gives: 'barStage.neon.gives' },
  { piece: BarPiece.DryIce, level: 75, perk: { mixSpeed: 1.25 }, name: 'barStage.dryIce', gives: 'barStage.dryIce.gives' },
  { piece: BarPiece.Champagne, level: 100, perk: { drinkPrice: 1.25 }, name: 'barStage.champagne', gives: 'barStage.champagne.gives' },
  { piece: BarPiece.Chandelier, level: 150, perk: { arrivals: 1.05, drinkChance: 0.1 }, name: 'barStage.chandelier', gives: 'barStage.chandelier.gives' },
];

/** How many bar pieces a bar counter level has opened. */
export const barStage = (level: number): number => BAR_STAGES.filter((b) => level >= b.level).length;
