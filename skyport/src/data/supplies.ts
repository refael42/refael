/**
 * Supplies: the fuel farm and the spare-parts store. Each has a stock, a
 * supplier (price, lead time, reliability) and deliveries that drive in by
 * road. Prices are per liter / per part at the dirt strip and grow with the
 * tier's pay (like everything else that costs money).
 */
export type StoreKind = 'fuel' | 'parts';

export interface SupplierDef {
  id: string;
  /** Coins per unit (liter / part) before the tier's pay multiplier. */
  price: number;
  /** Seconds from order to the truck at the gate. */
  lead: number;
  /** Chance a delivery runs late, and by how much (seconds). */
  lateChance: number;
  lateBy: number;
  /** Green fuel: passengers and airlines like it (a little mood on every flight it goes into). */
  green?: boolean;
}

export const FUEL_SUPPLIERS: readonly SupplierDef[] = [
  { id: 'budget', price: 0.003, lead: 210, lateChance: 0.3, lateBy: 150 },
  { id: 'standard', price: 0.0034, lead: 140, lateChance: 0.08, lateBy: 60 },
  { id: 'green', price: 0.0042, lead: 170, lateChance: 0.08, lateBy: 60, green: true },
];

export const PARTS_SUPPLIERS: readonly SupplierDef[] = [
  { id: 'surplus', price: 22, lead: 260, lateChance: 0.25, lateBy: 180 },
  { id: 'oem', price: 34, lead: 160, lateChance: 0.06, lateBy: 60 },
  { id: 'premium', price: 50, lead: 110, lateChance: 0.02, lateBy: 30 },
];

/** What airlines pay per liter pumped into their planes (before the tier's pay). */
export const FUEL_SELL = 0.0042;

/** An urgent order: this much dearer, and here in this many seconds. */
export const URGENT_PRICE = 2.2;
export const URGENT_LEAD = 45;

/** Order more when stock plus what is on its way falls below this share of the capacity. */
export const REORDER_AT = 0.45;

export interface StoreDef {
  kind: StoreKind;
  /** Upgrade line that grows the capacity (level 0 = what a new tier comes with). */
  line: string;
  /** First tier that keeps a stock (below it the supply is unlimited). */
  fromTier: number;
  /** Capacity by line level. */
  cap: readonly number[];
  suppliers: readonly SupplierDef[];
  /** Default supplier index. */
  defaultSupplier: number;
  /** Seconds the truck needs to unload a full delivery. */
  unload: number;
}

export const STORES: Record<StoreKind, StoreDef> = {
  fuel: {
    kind: 'fuel',
    line: 'fuelFarm',
    fromTier: 2,
    // (sized so each tier's traffic can bridge a tanker's lead time with the farm it can build)
    cap: [5000, 20000, 60000, 200000, 900000, 3000000],
    suppliers: FUEL_SUPPLIERS,
    defaultSupplier: 1,
    unload: 16,
  },
  parts: {
    kind: 'parts',
    line: 'partsStore',
    fromTier: 3,
    cap: [4, 8, 14, 22, 32],
    suppliers: PARTS_SUPPLIERS,
    defaultSupplier: 1,
    unload: 8,
  },
};

export function storeCap(kind: StoreKind, level: number): number {
  const c = STORES[kind].cap;
  return c[Math.max(0, Math.min(c.length - 1, level))];
}
