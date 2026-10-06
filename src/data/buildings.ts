import type { Role } from './staff';

// Building tiers. The restaurant grows into the lots around it: every tier is bigger,
// redecorated (new dining floor and walls), seats more tables, employs more people, draws
// more customers and charges more. Buying the next tier closes the place for a short
// construction show and reopens it on the bigger map with everything you had.

export type DiningFloor = 'dining' | 'emerald' | 'royal' | 'marble' | 'velvet' | 'ocean' | 'starlight' | 'gold';

/** Tiles a building adds on each side when it opens (owner request: "every direction, not always right"). */
export interface Grow {
  /** The kitchen side: a wider kitchen with more lines of stoves. */
  left: number;
  /** Behind the back wall: more rows of tables (and a longer kitchen). */
  back: number;
  /** The dining room, toward the lot next door. */
  right: number;
  /** Into the front yard, toward the street. */
  front: number;
}

export interface TierDef {
  id: 'diner' | 'bistro' | 'grand' | 'palace' | 'empire' | 'resort' | 'galaxy' | 'crown';
  /** How it grows from the building before (the diner is the starting size, src/data/maps.ts). */
  grow: Grow;
  dining: DiningFloor;
  wall: string;
  /** Multiplies customer arrivals and every dish price. */
  arrivals: number;
  price: number;
  /** Extra places per job on top of the base caps. */
  staff: Partial<Record<Role, number>>;
  /** How far the camera zooms out when the tier opens (it centers on the building). */
  zoom: number;
}

const grow = (g: Partial<Grow>): Grow => ({ left: 0, back: 0, right: 0, front: 0, ...g });

// Every building is wider (right), deeper behind (back) and, for the last one, out toward the
// street (front); two of them widen the kitchen (left). The depths are the same as when they
// grew right and toward the street, so the rooms seat as many and the pace stays where it was;
// growing mostly backward keeps the front yard (the walk in from the street) short.
export const TIERS: readonly TierDef[] = [
  { id: 'diner', grow: grow({}), dining: 'dining', wall: '#4A1F4E', arrivals: 1, price: 1, staff: {}, zoom: 1 },
  { id: 'bistro', grow: grow({ right: 6 }), dining: 'emerald', wall: '#173A44', arrivals: 1.5, price: 1.6, staff: { waiter: 2, cleaner: 1, promoter: 1, courier: 1 }, zoom: 0.85 },
  { id: 'grand', grow: grow({ right: 6, back: 2 }), dining: 'royal', wall: '#1E2350', arrivals: 2.2, price: 2.5, staff: { waiter: 4, cleaner: 2, promoter: 1, host: 1, courier: 1 }, zoom: 0.72 },
  // Late-game areas (owner request: "more places on the map").
  { id: 'palace', grow: grow({ right: 6, back: 2, left: 2 }), dining: 'marble', wall: '#3B2A14', arrivals: 3, price: 4, staff: { waiter: 6, cleaner: 3, promoter: 2, host: 1, courier: 2 }, zoom: 0.62 },
  { id: 'empire', grow: grow({ right: 6, back: 2 }), dining: 'velvet', wall: '#2B0F2E', arrivals: 4, price: 6.5, staff: { waiter: 8, cleaner: 4, promoter: 2, host: 2, courier: 3 }, zoom: 0.54 },
  // Owner request: "keep growing the map". A seaside resort with a mosaic floor, then a hall
  // under a starry ceiling.
  { id: 'resort', grow: grow({ right: 6, back: 2, left: 2 }), dining: 'ocean', wall: '#0E3B4C', arrivals: 5.2, price: 10, staff: { waiter: 10, cleaner: 5, promoter: 3, host: 2, courier: 4 }, zoom: 0.48 },
  { id: 'galaxy', grow: grow({ right: 6, front: 2 }), dining: 'starlight', wall: '#15123A', arrivals: 6.5, price: 15, staff: { waiter: 12, cleaner: 6, promoter: 3, host: 2, courier: 5 }, zoom: 0.45 },
  // Owner request: "keep making the map bigger". The crown: gold parquet, wider every way but the street.
  { id: 'crown', grow: grow({ right: 6, back: 2, left: 2 }), dining: 'gold', wall: '#1E1508', arrivals: 8.5, price: 24, staff: { waiter: 14, cleaner: 7, promoter: 3, host: 2, courier: 6 }, zoom: 0.42 },
];

export const CONSTRUCTION = {
  /** The restaurant is closed this long while the scaffolding is up. */
  seconds: 6,
  /** A dust puff somewhere on the site this often. */
  dustEvery: 0.25,
};
