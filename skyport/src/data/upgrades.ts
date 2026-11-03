/**
 * Upgrade catalog. Adding an upgrade = adding a row (plus i18n keys
 * upg.<id> and upgDesc.<id>). Costs grow geometrically per level.
 */
export type UpgradeCategory = 'runway' | 'apron' | 'terminal' | 'vehicles' | 'marketing' | 'comfort';

export type EffectKind =
  | 'paxFee'
  | 'landingFee'
  | 'kiosk'
  | 'traffic'
  | 'stands'
  | 'fuelRate'
  | 'bagSpeed'
  | 'taxiSpeed'
  | 'runwayOps'
  | 'truck'
  | 'cart'
  | 'comfort'
  | 'staffSpeed'
  | 'offlineCap'
  | 'counters'
  | 'lanes'
  | 'scanSpeed'
  | 'checkinSpeed';

export interface UpgradeDef {
  id: string;
  category: UpgradeCategory;
  unlockTier: number;
  maxLevel: number;
  baseCost: number;
  /** Cost multiplier per level. */
  growth: number;
  effect: EffectKind;
  /** Effect per level (fraction for % lines, absolute for counts). */
  per: number;
  /** Levels where the effect doubles (income lines). */
  milestones?: readonly number[];
  /** Seconds of construction per level (big upgrades). */
  buildSeconds?: readonly number[];
  /** Airport tier needed for each level (1-based index = level). */
  levelTier?: readonly number[];
  icon: 'coin' | 'pax' | 'land' | 'takeoff' | 'fuel' | 'bag' | 'star' | 'clock' | 'team' | 'plus' | 'wrench' | 'sun' | 'plane' | 'gear' | 'check';
}

export const MILESTONES = [10, 25, 50, 75, 100] as const;

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'ticket', category: 'terminal', unlockTier: 1, maxLevel: 100, baseCost: 20, growth: 1.14, effect: 'paxFee', per: 0.25, milestones: MILESTONES, icon: 'pax' },
  { id: 'landing', category: 'runway', unlockTier: 1, maxLevel: 100, baseCost: 25, growth: 1.14, effect: 'landingFee', per: 0.25, milestones: MILESTONES, icon: 'land' },
  { id: 'kiosk', category: 'terminal', unlockTier: 1, maxLevel: 100, baseCost: 45, growth: 1.15, effect: 'kiosk', per: 1, milestones: MILESTONES, icon: 'coin' },
  { id: 'billboard', category: 'marketing', unlockTier: 1, maxLevel: 30, baseCost: 80, growth: 1.25, effect: 'traffic', per: 0.06, icon: 'star' },
  { id: 'stand', category: 'apron', unlockTier: 1, maxLevel: 4, baseCost: 300, growth: 4, effect: 'stands', per: 1, buildSeconds: [40, 80, 120, 160], levelTier: [1, 1, 2, 2], icon: 'plane' },
  { id: 'pump', category: 'vehicles', unlockTier: 1, maxLevel: 50, baseCost: 35, growth: 1.17, effect: 'fuelRate', per: 0.2, icon: 'fuel' },
  { id: 'carts', category: 'vehicles', unlockTier: 1, maxLevel: 50, baseCost: 35, growth: 1.17, effect: 'bagSpeed', per: 0.2, icon: 'bag' },
  { id: 'truck2', category: 'vehicles', unlockTier: 1, maxLevel: 1, baseCost: 500, growth: 1, effect: 'truck', per: 1, buildSeconds: [30], icon: 'fuel' },
  { id: 'cart2', category: 'vehicles', unlockTier: 1, maxLevel: 1, baseCost: 400, growth: 1, effect: 'cart', per: 1, buildSeconds: [30], icon: 'bag' },
  { id: 'grader', category: 'apron', unlockTier: 1, maxLevel: 20, baseCost: 60, growth: 1.22, effect: 'taxiSpeed', per: 0.05, icon: 'wrench' },
  { id: 'lights', category: 'runway', unlockTier: 1, maxLevel: 20, baseCost: 90, growth: 1.25, effect: 'runwayOps', per: 0.04, icon: 'takeoff' },
  { id: 'benches', category: 'comfort', unlockTier: 1, maxLevel: 25, baseCost: 40, growth: 1.2, effect: 'comfort', per: 0.02, icon: 'sun' },
  { id: 'coffee', category: 'comfort', unlockTier: 1, maxLevel: 20, baseCost: 120, growth: 1.3, effect: 'staffSpeed', per: 0.06, icon: 'team' },
  { id: 'counters', category: 'terminal', unlockTier: 1, maxLevel: 3, baseCost: 120, growth: 3, effect: 'counters', per: 1, icon: 'pax' },
  { id: 'lanes', category: 'terminal', unlockTier: 1, maxLevel: 2, baseCost: 220, growth: 3.5, effect: 'lanes', per: 1, icon: 'check' },
  { id: 'scanner', category: 'terminal', unlockTier: 1, maxLevel: 20, baseCost: 70, growth: 1.22, effect: 'scanSpeed', per: 0.12, icon: 'clock' },
  { id: 'conveyor', category: 'terminal', unlockTier: 1, maxLevel: 25, baseCost: 55, growth: 1.2, effect: 'checkinSpeed', per: 0.1, icon: 'bag' },
  { id: 'night', category: 'comfort', unlockTier: 1, maxLevel: 10, baseCost: 250, growth: 1.8, effect: 'offlineCap', per: 1, icon: 'clock' },
];

export const CATEGORIES: readonly UpgradeCategory[] = ['runway', 'apron', 'terminal', 'vehicles', 'marketing', 'comfort'];

export function upgradeDef(id: string): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.id === id);
}

/** Highest level of an upgrade allowed at an airport tier. */
export function levelCap(def: UpgradeDef, tier: number): number {
  if (!def.levelTier) return def.maxLevel;
  let cap = 0;
  for (let l = 1; l <= def.maxLevel; l++) if ((def.levelTier[l - 1] ?? 1) <= tier) cap = l;
  return cap;
}
