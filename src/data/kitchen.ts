import { Dish } from './dishes';

// The kitchen (owner M29: "throw out that ugly kitchen and build a huge one, Michelin level, open
// kitchen style: a wok with a toss animation for pad thai, a sushi man cutting sushi, a cold line
// for salads, a hot line, ovens, a deep fryer for the fries, a plancha; animations for
// everything; when a chef finishes cooking they walk to the pass and put the plate down; fix
// which food is made on which equipment").
//
// Every dish is made on its own kind of station. A cook takes the oldest ticket whose station
// is free, walks there, cooks (each station its own animation), plates it, carries the plate to
// the pass and sets it down. Where the stations stand in each building: src/data/maps.ts.

/** The kinds of station (the prop's variant). */
export const Station = { Fryer: 0, Plancha: 1, ColdLine: 2, Range: 3, Wok: 4, Oven: 5, Sushi: 6 } as const;
export type Station = (typeof Station)[keyof typeof Station];
export const STATION_COUNT = 7;

/** What each dish is made on (the cook's pose and tool follow from it). */
export const DISH_STATION: Readonly<Record<Dish, Station>> = {
  [Dish.Fries]: Station.Fryer,
  [Dish.Burger]: Station.Plancha,
  [Dish.Falafel]: Station.Fryer,
  [Dish.Shawarma]: Station.Plancha,
  [Dish.Hummus]: Station.ColdLine,
  [Dish.Schnitzel]: Station.Fryer,
  [Dish.Shakshuka]: Station.Range,
  [Dish.IceCream]: Station.ColdLine,
  [Dish.Pizza]: Station.Oven,
  [Dish.Sushi]: Station.Sushi,
  [Dish.Steak]: Station.Plancha,
  [Dish.Cake]: Station.Oven,
  [Dish.Lobster]: Station.Range,
  [Dish.Salad]: Station.ColdLine,
  [Dish.PadThai]: Station.Wok,
};

export const stationOf = (dish: number): Station => DISH_STATION[dish as Dish] ?? Station.Range;

export interface StationDef {
  id: 'fryer' | 'plancha' | 'coldLine' | 'range' | 'wok' | 'oven' | 'sushi';
  /** Hot equipment goes on the wall line, under the hood; the rest faces the guests. */
  hot: boolean;
}

export const STATIONS: readonly StationDef[] = [
  { id: 'fryer', hot: true },
  { id: 'plancha', hot: false },
  { id: 'coldLine', hot: false },
  { id: 'range', hot: true },
  { id: 'wok', hot: false },
  { id: 'oven', hot: true },
  { id: 'sushi', hot: false },
];

export const KITCHEN_LINE = {
  /** Seconds a cook spends plating a dish at the station (Michelin: tweezers, a swipe of sauce). */
  plateSeconds: 0.6,
  /** Seconds to set a plate down on the pass. */
  placeSeconds: 0.3,
} as const;

/**
 * Which stations each building's kitchen has, in the order they stand (the first ones nearest
 * the pass). Every kind a dish of that building needs is there from the start; the bigger
 * kitchens have more of the busy ones. The cooks are not tied to a station: there are more
 * stations than cooks, so a ticket rarely waits for one.
 */
const S = Station;
export const KITCHEN_STATIONS: readonly (readonly Station[])[] = [
  // Diner: the menu up to ice cream.
  [S.Plancha, S.ColdLine, S.Fryer, S.Fryer, S.Range, S.Plancha, S.ColdLine],
  // Bistro: the wok for pad thai.
  [S.Plancha, S.Wok, S.ColdLine, S.Fryer, S.Fryer, S.Range, S.Plancha, S.ColdLine],
  // Grand: the pizza oven.
  [S.Plancha, S.Wok, S.ColdLine, S.Fryer, S.Fryer, S.Range, S.Oven, S.Oven, S.Plancha, S.ColdLine, S.Wok],
  // Palace: the sushi counter.
  [S.Sushi, S.Wok, S.ColdLine, S.Plancha, S.Plancha, S.Fryer, S.Fryer, S.Fryer, S.Range, S.Range, S.Oven, S.Oven, S.Wok, S.ColdLine],
  // Empire on: more of everything.
  [S.Sushi, S.Wok, S.ColdLine, S.Plancha, S.Sushi, S.Plancha, S.Fryer, S.Fryer, S.Fryer, S.Range, S.Range, S.Oven, S.Oven, S.Wok, S.ColdLine, S.Plancha, S.Range],
  [S.Sushi, S.Wok, S.ColdLine, S.Plancha, S.Sushi, S.Plancha, S.Wok, S.ColdLine, S.Fryer, S.Fryer, S.Fryer, S.Fryer, S.Range, S.Range, S.Range, S.Oven, S.Oven, S.Oven, S.Plancha, S.Sushi, S.ColdLine],
  [S.Sushi, S.Wok, S.ColdLine, S.Plancha, S.Sushi, S.Plancha, S.Wok, S.ColdLine, S.Fryer, S.Fryer, S.Fryer, S.Fryer, S.Range, S.Range, S.Range, S.Range, S.Oven, S.Oven, S.Oven, S.Plancha, S.Sushi, S.ColdLine, S.Wok],
  [S.Sushi, S.Wok, S.ColdLine, S.Plancha, S.Sushi, S.Plancha, S.Wok, S.ColdLine, S.Fryer, S.Fryer, S.Fryer, S.Fryer, S.Fryer, S.Range, S.Range, S.Range, S.Range, S.Oven, S.Oven, S.Oven, S.Oven, S.Plancha, S.Plancha, S.Sushi, S.ColdLine, S.Wok, S.Wok],
];
