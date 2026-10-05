// The menu. Adding a dish = adding a row (plus its icon sprite). Prices are in coins.

export const Dish = { Fries: 0, Burger: 1 } as const;
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
  { id: Dish.Burger, nameKey: 'dish.burger', price: 8, cookSeconds: 6, eatSeconds: 6, startsUnlocked: false },
];

export function dishDef(id: number): DishDef {
  const d = DISHES[id];
  if (!d) throw new Error(`Unknown dish ${id}`);
  return d;
}
