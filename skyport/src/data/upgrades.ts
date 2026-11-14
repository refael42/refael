/**
 * Upgrade catalog. Adding an upgrade = adding a row (plus i18n keys
 * upg.<id> and upgDesc.<id>). Costs grow geometrically per level.
 */
export type UpgradeCategory = 'runway' | 'apron' | 'terminal' | 'vehicles' | 'marketing' | 'comfort' | 'security';

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
  | 'checkinSpeed'
  /** Builds the stands (or buildings) of this line, one per level. */
  | 'opens'
  /** Air traffic control: shorter wake gaps, more holding patience, landing in fog. */
  | 'tower'
  | 'radar'
  | 'ils'
  /** Capacity of a supply store (fuel farm, parts store), by level. */
  | 'storage'
  /** Bird control (falconer, scare cannons): fewer flocks over the runway. */
  | 'birds'
  /** More bins in the terminals: less litter on the floors. */
  | 'litter'
  /** Security (see security.ts): cameras, the fence, patrol cars, the dog team, drone defence. */
  | 'cctv'
  | 'fence'
  | 'patrol'
  | 'k9'
  | 'drone'
  /** The weather station (see tower.ts). */
  | 'meteo';

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
  icon: 'coin' | 'pax' | 'land' | 'takeoff' | 'fuel' | 'bag' | 'star' | 'clock' | 'team' | 'plus' | 'wrench' | 'sun' | 'plane' | 'gear' | 'check' | 'shield' | 'camera' | 'drone';
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
  // more trucks and carts as the airport grows (levels 2+ need the bigger airports)
  { id: 'truck2', category: 'vehicles', unlockTier: 1, maxLevel: 5, baseCost: 500, growth: 12, effect: 'truck', per: 1, buildSeconds: [30, 60, 90, 120, 150], levelTier: [1, 3, 4, 5, 5], icon: 'fuel' },
  { id: 'cart2', category: 'vehicles', unlockTier: 1, maxLevel: 5, baseCost: 400, growth: 12, effect: 'cart', per: 1, buildSeconds: [30, 60, 90, 120, 150], levelTier: [1, 3, 4, 5, 5], icon: 'bag' },
  { id: 'grader', category: 'apron', unlockTier: 1, maxLevel: 20, baseCost: 60, growth: 1.22, effect: 'taxiSpeed', per: 0.05, icon: 'wrench' },
  { id: 'lights', category: 'runway', unlockTier: 1, maxLevel: 20, baseCost: 90, growth: 1.25, effect: 'runwayOps', per: 0.04, icon: 'takeoff' },
  { id: 'benches', category: 'comfort', unlockTier: 1, maxLevel: 25, baseCost: 40, growth: 1.2, effect: 'comfort', per: 0.02, icon: 'sun' },
  { id: 'coffee', category: 'comfort', unlockTier: 1, maxLevel: 20, baseCost: 120, growth: 1.3, effect: 'staffSpeed', per: 0.06, icon: 'team' },
  { id: 'bins', category: 'terminal', unlockTier: 2, maxLevel: 5, baseCost: 400, growth: 4, effect: 'litter', per: 0.15, icon: 'check' },
  { id: 'counters', category: 'terminal', unlockTier: 1, maxLevel: 3, baseCost: 120, growth: 3, effect: 'counters', per: 1, icon: 'pax' },
  { id: 'lanes', category: 'terminal', unlockTier: 1, maxLevel: 2, baseCost: 220, growth: 3.5, effect: 'lanes', per: 1, icon: 'check' },
  { id: 'scanner', category: 'terminal', unlockTier: 1, maxLevel: 20, baseCost: 70, growth: 1.22, effect: 'scanSpeed', per: 0.12, icon: 'clock' },
  { id: 'conveyor', category: 'terminal', unlockTier: 1, maxLevel: 25, baseCost: 55, growth: 1.2, effect: 'checkinSpeed', per: 0.1, icon: 'bag' },
  // bigger airports: each level builds a stand of the layout that names this line
  { id: 'fbo', category: 'apron', unlockTier: 3, maxLevel: 1, baseCost: 30000, growth: 1, effect: 'opens', per: 1, buildSeconds: [90], icon: 'star' },
  { id: 'standMed', category: 'apron', unlockTier: 3, maxLevel: 2, baseCost: 20000, growth: 2.5, effect: 'opens', per: 1, buildSeconds: [90, 150], icon: 'plane' },
  { id: 'gates', category: 'apron', unlockTier: 4, maxLevel: 2, baseCost: 300000, growth: 2.5, effect: 'opens', per: 1, buildSeconds: [150, 240], icon: 'plane' },
  { id: 'gatesD', category: 'apron', unlockTier: 6, maxLevel: 3, baseCost: 2.5e7, growth: 2.2, effect: 'opens', per: 1, buildSeconds: [240, 300, 360], icon: 'plane' },
  { id: 'gatesE', category: 'apron', unlockTier: 7, maxLevel: 3, baseCost: 6e8, growth: 2.2, effect: 'opens', per: 1, buildSeconds: [300, 420, 480], icon: 'plane' },
  { id: 'vertiport', category: 'apron', unlockTier: 8, maxLevel: 3, baseCost: 2e10, growth: 1.8, effect: 'opens', per: 1, buildSeconds: [180, 240, 300], icon: 'plane' },
  { id: 'cargoApron', category: 'apron', unlockTier: 4, maxLevel: 2, baseCost: 500000, growth: 2000, effect: 'opens', per: 1, buildSeconds: [180, 300], levelTier: [4, 7], icon: 'bag' },
  { id: 'helipad', category: 'apron', unlockTier: 5, maxLevel: 1, baseCost: 4e6, growth: 1, effect: 'opens', per: 1, buildSeconds: [120], icon: 'plane' },
  { id: 'hangar', category: 'apron', unlockTier: 3, maxLevel: 2, baseCost: 40000, growth: 6, effect: 'opens', per: 1, buildSeconds: [150, 240], levelTier: [3, 4], icon: 'wrench' },
  // passenger services in the terminals (owner request): charging, exchange, pharmacy, massage chairs, sleep pods, prayer and nursing rooms
  { id: 'amenities', category: 'comfort', unlockTier: 2, maxLevel: 6, baseCost: 2500, growth: 4.5, effect: 'comfort', per: 0.015, levelTier: [2, 4, 4, 4, 5, 5], icon: 'pax' },
  { id: 'lounge', category: 'comfort', unlockTier: 4, maxLevel: 10, baseCost: 150000, growth: 1.6, effect: 'comfort', per: 0.02, icon: 'star' },
  // air traffic control
  // the control tower (owner request: part of the game): ten levels, abilities at 2, 4, 6, 8 and 10 (tower.ts)
  { id: 'tower', category: 'runway', unlockTier: 2, maxLevel: 10, baseCost: 1500, growth: 4.2, effect: 'tower', per: 0.1, buildSeconds: [60, 90, 120, 150, 180, 210, 240, 270, 300, 360], levelTier: [2, 2, 3, 4, 5, 5, 6, 6, 7, 8], icon: 'gear' },
  // the weather station: storms announced earlier, fewer crosswind go-arounds, a forecast
  { id: 'meteo', category: 'runway', unlockTier: 2, maxLevel: 3, baseCost: 1800, growth: 5, effect: 'meteo', per: 1, buildSeconds: [45, 90, 150], levelTier: [2, 3, 5], icon: 'sun' },
  { id: 'radar', category: 'runway', unlockTier: 2, maxLevel: 3, baseCost: 2500, growth: 10, effect: 'radar', per: 0.25, buildSeconds: [60, 120, 180], levelTier: [2, 3, 4], icon: 'clock' },
  { id: 'ils', category: 'runway', unlockTier: 2, maxLevel: 3, baseCost: 2000, growth: 12, effect: 'ils', per: 1, buildSeconds: [90, 150, 210], levelTier: [2, 3, 4], icon: 'land' },
  // supplies: bigger fuel farm and parts store
  { id: 'fuelFarm', category: 'vehicles', unlockTier: 2, maxLevel: 5, baseCost: 1200, growth: 7, effect: 'storage', per: 1, buildSeconds: [60, 90, 120, 180, 240], levelTier: [2, 3, 3, 4, 5], icon: 'fuel' },
  { id: 'partsStore', category: 'vehicles', unlockTier: 3, maxLevel: 4, baseCost: 15000, growth: 5, effect: 'storage', per: 1, buildSeconds: [60, 90, 150, 200], levelTier: [3, 4, 4, 5], icon: 'wrench' },
  // floodlight masts at the stands (owner request: the details of the night): the crews see better
  { id: 'floodlights', category: 'apron', unlockTier: 2, maxLevel: 3, baseCost: 900, growth: 3, effect: 'staffSpeed', per: 0.03, levelTier: [2, 3, 4], icon: 'sun' },
  // ground services (owner request): power for the cabin, the caterer's trucks, pushback tugs at the gates
  { id: 'gpu', category: 'vehicles', unlockTier: 2, maxLevel: 3, baseCost: 700, growth: 3, effect: 'comfort', per: 0.02, levelTier: [2, 3, 4], icon: 'gear' },
  { id: 'catering', category: 'vehicles', unlockTier: 3, maxLevel: 10, baseCost: 1500, growth: 1.6, effect: 'kiosk', per: 0.5, icon: 'coin' },
  { id: 'pushback', category: 'vehicles', unlockTier: 4, maxLevel: 3, baseCost: 6000, growth: 2.5, effect: 'taxiSpeed', per: 0.04, icon: 'takeoff' },
  // security (owner request)
  { id: 'cctv', category: 'security', unlockTier: 2, maxLevel: 10, baseCost: 350, growth: 1.55, effect: 'cctv', per: 1, icon: 'camera' },
  { id: 'fence', category: 'security', unlockTier: 2, maxLevel: 3, baseCost: 1200, growth: 4, effect: 'fence', per: 1, levelTier: [2, 3, 5], icon: 'shield' },
  { id: 'patrol', category: 'security', unlockTier: 3, maxLevel: 2, baseCost: 4000, growth: 3, effect: 'patrol', per: 1, levelTier: [3, 5], icon: 'shield' },
  { id: 'k9', category: 'security', unlockTier: 4, maxLevel: 1, baseCost: 9000, growth: 1, effect: 'k9', per: 1, icon: 'team' },
  { id: 'droneDefense', category: 'security', unlockTier: 4, maxLevel: 2, baseCost: 25000, growth: 3, effect: 'drone', per: 1, levelTier: [4, 6], icon: 'drone' },
  { id: 'birdControl', category: 'runway', unlockTier: 3, maxLevel: 3, baseCost: 12000, growth: 6, effect: 'birds', per: 1, levelTier: [3, 4, 5], icon: 'star' },
  { id: 'night', category: 'comfort', unlockTier: 1, maxLevel: 10, baseCost: 250, growth: 1.8, effect: 'offlineCap', per: 1, icon: 'clock' },
];

export const CATEGORIES: readonly UpgradeCategory[] = ['runway', 'apron', 'terminal', 'vehicles', 'security', 'marketing', 'comfort'];

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
