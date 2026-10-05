// The menu. Adding a dish = adding a row (plus its icon sprite). Prices are in coins.

export const Dish = { Fries: 0, Burger: 1, Falafel: 2, Shawarma: 3, Hummus: 4, Schnitzel: 5, Shakshuka: 6, IceCream: 7 } as const;
export type Dish = (typeof Dish)[keyof typeof Dish];

export interface DishDef {
  id: Dish;
  nameKey: string;
  price: number;
  /** Seconds the cook needs at base speed. */
  cookSeconds: number;
  /** Seconds a customer spends eating it. */
  eatSeconds: number;
  /** On the menu from the start; others are unlocked by their recipe upgrade. */
  startsUnlocked: boolean;
}

export const DISHES: readonly DishDef[] = [
  { id: Dish.Fries, nameKey: 'dish.fries', price: 4, cookSeconds: 3.5, eatSeconds: 3.5, startsUnlocked: true },
  { id: Dish.Burger, nameKey: 'dish.burger', price: 14, cookSeconds: 6, eatSeconds: 6, startsUnlocked: false },
  // Tel Aviv street food (M8.3). Each opens a bigger price step than the last, so a new recipe
  // is always worth more than another level of the old ones, at the cost of a slower kitchen.
  { id: Dish.Falafel, nameKey: 'dish.falafel', price: 40, cookSeconds: 6.5, eatSeconds: 6, startsUnlocked: false },
  { id: Dish.Shawarma, nameKey: 'dish.shawarma', price: 110, cookSeconds: 7, eatSeconds: 6.5, startsUnlocked: false },
  { id: Dish.Hummus, nameKey: 'dish.hummus', price: 300, cookSeconds: 7.5, eatSeconds: 7, startsUnlocked: false },
  { id: Dish.Schnitzel, nameKey: 'dish.schnitzel', price: 800, cookSeconds: 8, eatSeconds: 7, startsUnlocked: false },
  { id: Dish.Shakshuka, nameKey: 'dish.shakshuka', price: 2200, cookSeconds: 8.5, eatSeconds: 7.5, startsUnlocked: false },
  { id: Dish.IceCream, nameKey: 'dish.iceCream', price: 6000, cookSeconds: 9, eatSeconds: 5, startsUnlocked: false },
];

export function dishDef(id: number): DishDef {
  const d = DISHES[id];
  if (!d) throw new Error(`Unknown dish ${id}`);
  return d;
}
