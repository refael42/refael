import { Dish } from './dishes';

// Suppliers and the storeroom (owner M51: "add suppliers and a storeroom"). Every dish a cook
// starts takes one unit of its main ingredient from the storeroom: vegetables, meat and fish,
// or the pantry (flour, rice, dairy, sugar). A supplier's van comes by itself every so often and
// tops the storeroom up, and the bill is paid on delivery: a small share of what those dishes
// sell for. Each ingredient has its own supplier, picked by the player: the city market is
// cheap but a little worse, the wholesaler is the standard, the organic farm costs
// more and its dishes sell for more (and the guide's inspectors notice). The cheap one keeps
// cash for upgrades early on; the farm pays back once the place is busy. Run out of something
// and the dishes that need it wait for the van, or for an urgent order. Rules in src/sim/supply.ts.

export const INGREDIENTS = ['veg', 'protein', 'pantry'] as const;
export type Ingredient = (typeof INGREDIENTS)[number];
export const Ingr = { Veg: 0, Protein: 1, Pantry: 2 } as const;

/** Each dish's main ingredient (index into INGREDIENTS), by dish id. */
export const DISH_INGREDIENT: Readonly<Record<Dish, number>> = {
  [Dish.Fries]: Ingr.Veg,
  [Dish.Burger]: Ingr.Protein,
  [Dish.Falafel]: Ingr.Veg,
  [Dish.Shawarma]: Ingr.Protein,
  [Dish.Hummus]: Ingr.Pantry,
  [Dish.Schnitzel]: Ingr.Protein,
  [Dish.Shakshuka]: Ingr.Protein,
  [Dish.IceCream]: Ingr.Pantry,
  [Dish.Pizza]: Ingr.Pantry,
  [Dish.Sushi]: Ingr.Protein,
  [Dish.Steak]: Ingr.Protein,
  [Dish.Cake]: Ingr.Pantry,
  [Dish.Lobster]: Ingr.Protein,
  [Dish.Salad]: Ingr.Veg,
  [Dish.PadThai]: Ingr.Pantry,
};

export interface SupplierDef {
  id: 'market' | 'wholesale' | 'farm';
  /** The bill per unit, times the usual. */
  cost: number;
  /** Dishes made with it sell for this much (the cook's touch times this). */
  quality: number;
  /** For the guide's inspectors: the ingredients part of a plate's score, on top of the fridge's. */
  inspector: number;
  /** Opens with this building (0 = the first stand). */
  tier: number;
}

export const SUPPLIERS: readonly SupplierDef[] = [
  { id: 'market', cost: 0.6, quality: 0.95, inspector: -0.1, tier: 0 },
  { id: 'wholesale', cost: 1, quality: 1, inspector: 0, tier: 0 },
  { id: 'farm', cost: 1.7, quality: 1.12, inspector: 0.25, tier: 1 },
];

export const SUPPLY = {
  /** The supplier each ingredient starts with (index into SUPPLIERS). */
  start: 1,
  /** Units of each ingredient the storeroom holds, by building tier (then times the storeroom upgrade). */
  // A van round in the first stand uses about 10-15 units of the busiest ingredient, a grand
  // restaurant's six cooks 15-20, more in the later buildings: the storeroom holds a little more
  // than a round, so a rush, a bus or a bigger kitchen can empty it until it is upgraded.
  capacity: [20, 24, 30, 36, 45, 55, 66, 80] as readonly number[],
  /** The van comes every this many seconds (the supply contract upgrade makes it sooner, and the bill smaller). */
  everySeconds: 75,
  /** Driving up to the curb (and off again), like the tourist bus. */
  driveSeconds: 3.2,
  /** It unloads this long at the curb; the storeroom is full when it leaves. */
  unloadSeconds: 5,
  /** A unit costs this share of what a guest pays lately, tip and all (more for the pricier dishes' ingredient). */
  costShare: 0.12,
  /** An urgent order: this many times the bill, the van on its way at once. */
  urgentCost: 2.5,
  /** An urgent van unloads this fast. */
  urgentUnload: 2,
  /** Below this share of the storeroom an ingredient shows as running low. */
  lowAt: 0.2,
} as const;
