// Desserts (owner: "when they finish they can order a dessert from the new dessert menu, each
// dessert by the player's level"): after the main course a guest may ask for the dessert menu,
// choose, wait a little, eat it, and pay for it with the bill. A waiter plates it at the pass;
// the player can tap the guest to serve it at once. Each opens at a chef level (src/data/chef.ts).

export interface DessertDef {
  id: string;
  nameKey: string;
  /** Its price as a share of the guest's main course (so desserts keep up with the menu). */
  share: number;
  /** The chef level it opens at. */
  level: number;
}

export const DESSERTS: readonly DessertDef[] = [
  { id: 'malabi', nameKey: 'dessert.malabi', share: 0.2, level: 6 },
  { id: 'sufganiya', nameKey: 'dessert.sufganiya', share: 0.24, level: 9 },
  { id: 'baklava', nameKey: 'dessert.baklava', share: 0.28, level: 12 },
  { id: 'chocMousse', nameKey: 'dessert.chocMousse', share: 0.32, level: 15 },
  { id: 'cheesecake', nameKey: 'dessert.cheesecake', share: 0.36, level: 18 },
  { id: 'tiramisu', nameKey: 'dessert.tiramisu', share: 0.4, level: 21 },
  { id: 'cremeBrulee', nameKey: 'dessert.cremeBrulee', share: 0.45, level: 24 },
  { id: 'lavaCake', nameKey: 'dessert.lavaCake', share: 0.5, level: 27 },
  { id: 'waffle', nameKey: 'dessert.waffle', share: 0.55, level: 30 },
  { id: 'knafeh', nameKey: 'dessert.knafeh', share: 0.6, level: 34 },
];

export const DESSERT = {
  /** A guest at a table asks for the dessert menu this often, a little more with every dessert open. */
  chance: 0.25,
  perDessert: 0.025,
  maxChance: 0.5,
  /** Seconds over the dessert menu; patience for the dessert (they skip it, unhappy, if it never comes). */
  readSeconds: 2.4,
  patience: 30,
  /** A waiter plates it at the pass in this many seconds; it is eaten in this many. */
  plateSeconds: 1.4,
  eatSeconds: 4,
} as const;
