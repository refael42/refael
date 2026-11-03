/**
 * Upgrades: levels, geometric costs, bulk buying, construction, effects and
 * a "best value" estimate. Effects are read through effects(s) (cached per
 * state revision).
 */
import { airportCapacity, flightsPerDay } from './airlines';
import { levelCap, UPGRADES, upgradeDef, type EffectKind, type UpgradeDef } from '../../data/upgrades';
import { Big } from '../big';
import { pushEvent } from './events';
import { layoutOf } from './layout';
import { componentRates, incomeRate } from './income';
import { REJECT, type GameState } from './types';
import { makeVehicle } from './vehicles';

export function level(s: GameState, id: string): number {
  return s.upg[id] ?? 0;
}

/** Levels counting ones still under construction (what you've paid for). */
export function boughtLevel(s: GameState, id: string): number {
  let l = level(s, id);
  for (const b of s.builds) if (b.id === id) l = Math.max(l, b.level);
  return l;
}

export function milestonesReached(def: UpgradeDef, lvl: number): number {
  let n = 0;
  for (const m of def.milestones ?? []) if (lvl >= m) n++;
  return n;
}

/** Next milestone level above lvl (or 0 when there is none). */
export function nextMilestone(def: UpgradeDef, lvl: number): number {
  for (const m of def.milestones ?? []) if (lvl < m) return m;
  return 0;
}

/** Price of level `from` (0-based: buying level from+1). */
export function unitCost(s: GameState, def: UpgradeDef, from: number): Big {
  // whole coins, rounded up
  return Big.fromNumber(def.baseCost * s.priceMul).mul(Big.fromNumber(def.growth).pow(from)).ceil();
}

/** Cost of buying n levels starting at level `from`. */
export function bulkCost(s: GameState, def: UpgradeDef, from: number, n: number): Big {
  if (n <= 0) return Big.ZERO;
  const first = unitCost(s, def, from);
  if (def.growth === 1) return first.mul(n);
  // exact sum of the rounded single prices (levels are capped, so n stays small)
  if (n <= 200) {
    let sum = Big.ZERO;
    for (let i = 0; i < n; i++) sum = sum.add(unitCost(s, def, from + i));
    return sum;
  }
  const gn = Big.fromNumber(def.growth).pow(n);
  return first.mul(gn.sub(1)).div(def.growth - 1).ceil();
}

/** How many levels you can buy now (capped by max level and `limit`). */
export function affordableCount(s: GameState, def: UpgradeDef, limit = Infinity): number {
  const from = boughtLevel(s, def.id);
  const room = Math.min(levelCap(def, s.tier) - from, limit);
  if (room <= 0) return 0;
  if (def.buildSeconds) return s.money.gte(unitCost(s, def, from)) && s.builds.length === 0 ? 1 : 0;
  const first = unitCost(s, def, from);
  if (s.money.lt(first)) return 0;
  let n: number;
  if (def.growth === 1) n = Math.floor(s.money.div(first).toNumber());
  else {
    const x = s.money.mul(def.growth - 1).div(first).add(1).log10() / Math.log10(def.growth);
    n = Math.floor(x + 1e-9);
  }
  n = Math.max(0, Math.min(room, n));
  while (n > 0 && s.money.lt(bulkCost(s, def, from, n))) n--;
  return n;
}

export type BuyResult = 0 | (typeof REJECT)[keyof typeof REJECT];

/** count: levels to buy, or -1 for as many as you can afford. */
export function buyUpgrade(s: GameState, id: string, count: number): BuyResult {
  const def = upgradeDef(id);
  if (!def || def.unlockTier > s.tier) return REJECT.unknownFlight;
  const from = boughtLevel(s, id);
  const cap = levelCap(def, s.tier);
  if (from >= cap) return REJECT.limit;
  let n = count < 0 ? affordableCount(s, def) : Math.min(Math.floor(count), cap - from);
  if (def.buildSeconds) n = Math.min(n, 1);
  if (n <= 0) return REJECT.noMoney;
  if (def.buildSeconds && s.builds.length > 0) return REJECT.limit; // one build crew
  const cost = bulkCost(s, def, from, n);
  if (s.money.lt(cost)) return REJECT.noMoney;
  s.money = s.money.sub(cost);
  s.stats.spent = s.stats.spent.add(cost);
  if (def.buildSeconds) {
    const secs = def.buildSeconds[Math.min(from, def.buildSeconds.length - 1)];
    s.builds.push({ id, level: from + 1, remaining: secs, total: secs });
    pushEvent(s, 'buildStart', 0, 0, from + 1, 0, 0);
  } else {
    const before = milestonesReached(def, from);
    setLevel(s, id, from + n);
    if (milestonesReached(def, from + n) > before) pushEvent(s, 'milestone', 0, 0, from + n);
  }
  pushEvent(s, 'upgraded', 0, 0, n, 0, 0);
  return 0;
}

function setLevel(s: GameState, id: string, lvl: number): void {
  s.upg[id] = lvl;
  s.upgRev++;
  applyStructural(s);
}

/** Things a level changes in the world: stands and vehicles. */
export function applyStructural(s: GameState): void {
  const L = layoutOf(s.tier);
  // a stand is open once the level of its build line is reached (no line = there from the start)
  s.standOpen = L.stands.map((st) => !st.line || level(s, st.line) >= (st.level ?? 1));
  s.standsBuilt = s.standOpen.filter(Boolean).length;
  while (s.stands.length < L.stands.length) s.stands.push({ occupant: 0, reserved: 0 });
  const want = { fuel: 1 + Math.round(effectValue(s, 'truck')), bags: 1 + Math.round(effectValue(s, 'cart')) };
  for (const kind of ['fuel', 'bags'] as const) {
    let have = s.vehicles.filter((v) => v.kind === kind).length;
    while (have < want[kind]) {
      s.vehicles.push(makeVehicle(s.nextId++, kind, L));
      have++;
    }
  }
}

/** Construction crews: progress builds; finished ones apply their level. */
export function updateBuilds(s: GameState, dt: number): void {
  if (s.builds.length === 0) return;
  for (const b of s.builds) b.remaining -= dt;
  const done = s.builds.filter((b) => b.remaining <= 0);
  if (done.length === 0) return;
  s.builds = s.builds.filter((b) => b.remaining > 0);
  for (const b of done) {
    setLevel(s, b.id, Math.max(level(s, b.id), b.level));
    pushEvent(s, 'buildDone', 0, 0, b.level);
  }
}

/** A tap on the construction site shaves time off. */
export function rushBuild(s: GameState): boolean {
  const b = s.builds[0];
  if (!b) return false;
  b.remaining = Math.max(0.05, b.remaining - Math.max(1, b.total * 0.04));
  return true;
}

// ----------------------------------------------------------------- effects

/** Sum of an effect over all lines (milestones double the line's effect). */
export function effectValue(s: GameState, kind: EffectKind): number {
  let v = 0;
  for (const def of UPGRADES) {
    if (def.effect !== kind) continue;
    const l = level(s, def.id);
    if (l <= 0) continue;
    v += def.per * l * Math.pow(2, milestonesReached(def, l));
  }
  return v;
}

export interface Effects {
  paxFee: number;
  landingFee: number;
  kioskPerPax: number;
  traffic: number;
  fuelRate: number;
  bagSpeed: number;
  taxiSpeed: number;
  runwayOps: number;
  comfort: number;
  staffSpeed: number;
  offlineCapHours: number;
}

const cache = new WeakMap<GameState, { rev: number; fx: Effects }>();

export function effects(s: GameState): Effects {
  const hit = cache.get(s);
  if (hit && hit.rev === s.upgRev) return hit.fx;
  const fx: Effects = {
    paxFee: 1 + effectValue(s, 'paxFee'),
    landingFee: 1 + effectValue(s, 'landingFee'),
    kioskPerPax: effectValue(s, 'kiosk'),
    traffic: 1 + effectValue(s, 'traffic'),
    fuelRate: 1 + effectValue(s, 'fuelRate'),
    bagSpeed: 1 + effectValue(s, 'bagSpeed'),
    taxiSpeed: 1 + effectValue(s, 'taxiSpeed'),
    runwayOps: 1 + effectValue(s, 'runwayOps'),
    comfort: Math.min(0.5, effectValue(s, 'comfort')),
    staffSpeed: 1 + effectValue(s, 'staffSpeed'),
    offlineCapHours: 2 + effectValue(s, 'offlineCap'),
  };
  cache.set(s, { rev: s.upgRev, fx });
  return fx;
}

// -------------------------------------------------------------- best value

export interface UpgradeOffer {
  id: string;
  level: number;
  cost: Big;
  /** Estimated coins per second gained by the next level. */
  gain: number;
  /** gain / cost (higher is better). */
  roi: number;
}

/** Estimated value of one more level of each line, from the income breakdown. */
export function offers(s: GameState): UpgradeOffer[] {
  const rate = Math.max(0.3, incomeRate(s));
  const comp = componentRates(s);
  const fx = effects(s);
  const out: UpgradeOffer[] = [];
  const holdingShare = s.flights.filter((f) => f.phase === 'holding').length / Math.max(1, s.standsBuilt);
  for (const def of UPGRADES) {
    if (def.unlockTier > s.tier) continue;
    const lvl = boughtLevel(s, def.id);
    if (lvl >= levelCap(def, s.tier)) continue;
    const cost = unitCost(s, def, lvl);
    // how much the line's total effect grows with one more level
    const now = def.per * lvl * Math.pow(2, milestonesReached(def, lvl));
    const next = def.per * (lvl + 1) * Math.pow(2, milestonesReached(def, lvl + 1));
    const delta = next - now;
    let gain: number;
    switch (def.effect) {
      case 'paxFee':
        gain = comp.pax * (delta / fx.paxFee);
        break;
      case 'landingFee':
        gain = comp.landing * (delta / fx.landingFee);
        break;
      case 'kiosk':
        gain = comp.paxPerSec * delta * 0.85;
        break;
      case 'traffic': {
        // more planes only help while the ground can still turn them around on time
        const load = flightsPerDay(s) / Math.max(1, airportCapacity(s));
        gain = rate * (delta / fx.traffic) * Math.max(0.1, 1 - holdingShare) * Math.max(0, Math.min(1, (1.05 - load) * 4));
        break;
      }
      case 'stands':
        gain = rate * (0.25 + 0.6 * Math.min(1, holdingShare + 0.2));
        break;
      case 'opens':
        // a new kind of stand brings new, bigger aircraft and airlines
        gain = rate * 0.6;
        break;
      case 'ils':
        // fewer diversions in fog (fog is only now and then)
        gain = rate * 0.12;
        break;
      case 'tower':
      case 'radar':
        gain = rate * 0.05;
        break;
      case 'truck':
      case 'cart':
        gain = rate * 0.06;
        break;
      default:
        gain = rate * delta * 0.15;
    }
    out.push({ id: def.id, level: lvl, cost, gain, roi: gain / Math.max(1e-9, cost.toNumber()) });
  }
  return out;
}

export function bestOffer(s: GameState, affordableOnly = false): UpgradeOffer | null {
  let best: UpgradeOffer | null = null;
  for (const o of offers(s)) {
    if (affordableOnly && s.money.lt(o.cost)) continue;
    const def = upgradeDef(o.id);
    if (affordableOnly && def?.buildSeconds && s.builds.length > 0) continue;
    if (!best || o.roi > best.roi) best = o;
  }
  return best;
}
