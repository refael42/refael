import { Dish } from './dishes';

// The recipe lab (owner's idea 2: "combine ingredients and invent a new dish with your own name,
// price and design"). The player takes a dish from the menu, adds a sauce and a topping, names it
// and picks a plate. Every ingredient brings a flavor; every dish wants two flavors and dislikes
// one. Both wanted flavors, one from the sauce and one from the topping, is five stars. The tasting
// notes after a test say what is missing, so the perfect pairing is a little puzzle, not luck.

export const FLAVORS = ['rich', 'fresh', 'spicy', 'sweet', 'crunch', 'tangy'] as const;
export type Flavor = (typeof FLAVORS)[number];

export interface Ingredient {
  id: string;
  flavors: readonly Flavor[];
  /** Its color in the plate picture. */
  color: string;
}

export const SAUCES: readonly Ingredient[] = [
  { id: 'tahini', flavors: ['rich'], color: '#E8CF9A' },
  { id: 'tomato', flavors: ['tangy'], color: '#D8402F' },
  { id: 'chili', flavors: ['spicy'], color: '#E5641E' },
  { id: 'herb', flavors: ['fresh'], color: '#4FA845' },
  { id: 'date', flavors: ['sweet'], color: '#7A3E1E' },
  { id: 'crispChili', flavors: ['spicy', 'crunch'], color: '#A8281E' },
];

export const TOPPINGS: readonly Ingredient[] = [
  { id: 'cheese', flavors: ['rich'], color: '#F5C842' },
  { id: 'pickles', flavors: ['tangy'], color: '#8FB33A' },
  { id: 'jalapeno', flavors: ['spicy'], color: '#3E9A3A' },
  { id: 'herbs', flavors: ['fresh'], color: '#5CC25A' },
  { id: 'pomegranate', flavors: ['sweet'], color: '#C8213A' },
  { id: 'nuts', flavors: ['crunch'], color: '#C08A4A' },
];

/** The plate's rim colors (the dish's "design"). */
export const PLATES = ['#FFFFFF', '#2E8BD8', '#E2B13C', '#D8352B', '#2F9E5B', '#1E1E28'] as const;

/** What each dish wants (two flavors: every pair is used once) and what spoils it. */
export const DISH_TASTE: Record<number, { wants: readonly [Flavor, Flavor]; hates: Flavor }> = {
  [Dish.Fries]: { wants: ['rich', 'tangy'], hates: 'sweet' },
  [Dish.Burger]: { wants: ['crunch', 'tangy'], hates: 'sweet' },
  [Dish.Falafel]: { wants: ['rich', 'fresh'], hates: 'sweet' },
  [Dish.Shawarma]: { wants: ['spicy', 'tangy'], hates: 'sweet' },
  [Dish.Hummus]: { wants: ['rich', 'crunch'], hates: 'sweet' },
  [Dish.Schnitzel]: { wants: ['fresh', 'tangy'], hates: 'sweet' },
  [Dish.Shakshuka]: { wants: ['fresh', 'spicy'], hates: 'sweet' },
  [Dish.IceCream]: { wants: ['sweet', 'crunch'], hates: 'spicy' },
  [Dish.Pizza]: { wants: ['rich', 'spicy'], hates: 'sweet' },
  [Dish.Sushi]: { wants: ['spicy', 'crunch'], hates: 'sweet' },
  [Dish.Steak]: { wants: ['rich', 'sweet'], hates: 'tangy' },
  [Dish.Cake]: { wants: ['sweet', 'fresh'], hates: 'spicy' },
  [Dish.Lobster]: { wants: ['fresh', 'crunch'], hates: 'sweet' },
  [Dish.Salad]: { wants: ['sweet', 'tangy'], hates: 'rich' },
  [Dish.PadThai]: { wants: ['spicy', 'sweet'], hates: 'rich' },
};

export const LAB = {
  /** Opens after this many guests. */
  minServed: 60,
  /** A test takes this long (sim seconds). */
  testSeconds: 30,
  /** A test costs this many of the dish's own price (so it grows with the restaurant). */
  testPrices: 6,
  /** The dish's price on the menu: +this much per star above one (five stars = +32%). */
  pricePerStar: 0.08,
  /** A signature dish draws this share of the orders at five stars (less with fewer stars). */
  orderChance: 0.22,
  /** Signature dishes on the menu at once, by building (0 = the stand). */
  slots: [1, 1, 2, 2, 3, 3, 3, 3],
  /** Creations kept in the notebook. */
  keep: 12,
  /** Gems for the first five-star creation of each dish. */
  perfectGems: 3,
  nameMax: 22,
} as const;
