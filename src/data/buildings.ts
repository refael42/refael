import type { Role } from './staff';

// Building tiers. The restaurant grows sideways into the lot next door: every tier is wider,
// redecorated (new dining floor and walls), seats more tables, employs more people, draws
// more customers and charges more. Buying the next tier closes the place for a short
// construction show and reopens it on the bigger map with everything you had.

export type DiningFloor = 'dining' | 'emerald' | 'royal';

export interface TierDef {
  id: 'diner' | 'bistro' | 'grand';
  /** The building's right edge (tiles): it reaches this far into the old lot. */
  width: number;
  dining: DiningFloor;
  wall: string;
  /** Multiplies customer arrivals and every dish price. */
  arrivals: number;
  price: number;
  /** Extra places per job on top of the base caps. */
  staff: Partial<Record<Role, number>>;
  /** Where the camera looks when the tier opens. */
  focus: { x: number; y: number; zoom: number };
}

export const TIERS: readonly TierDef[] = [
  { id: 'diner', width: 14, dining: 'dining', wall: '#4A1F4E', arrivals: 1, price: 1, staff: {}, focus: { x: 8.6, y: 6.4, zoom: 1 } },
  { id: 'bistro', width: 20, dining: 'emerald', wall: '#173A44', arrivals: 1.5, price: 1.6, staff: { waiter: 2, cleaner: 1 }, focus: { x: 11.6, y: 6.6, zoom: 0.85 } },
  { id: 'grand', width: 26, dining: 'royal', wall: '#1E2350', arrivals: 2.2, price: 2.5, staff: { waiter: 4, cleaner: 2 }, focus: { x: 14.6, y: 6.8, zoom: 0.75 } },
];

export const CONSTRUCTION = {
  /** The restaurant is closed this long while the scaffolding is up. */
  seconds: 6,
  /** A dust puff somewhere on the site this often. */
  dustEvery: 0.25,
};
