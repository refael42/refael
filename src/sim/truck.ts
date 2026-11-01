import { TRUCK, TRUCK_SPOTS } from '../data/truck';
import { big, fromSave, toSave, type Big } from './big';
import { emit, Ev } from './game/events';
import type { GameState } from './game/types';
import { grantCoins, incomeRate } from './shop';

// The food truck (src/data/truck.ts). Trips go by the phone's clock (the command brings `now`,
// in ms), so a trip runs on while the game is closed. What a trip brings is fixed when it leaves
// (the income rate then; more if the restaurant earns more by the time it is back). The player's: it goes
// along to a new branch, and it is saved.

export interface TruckState {
  level: number;
  /** The trip on now: where, when it left and comes back (ms), and what it brings. */
  trip: { spot: number; start: number; end: number; coins: string; gems: number } | null;
  trips: number;
}

export const newTruck = (): TruckState => ({ level: 0, trip: null, trips: 0 });
export const copyTruck = (t: TruckState): TruckState => ({ level: t.level, trip: t.trip ? { ...t.trip } : null, trips: t.trips });

/** Where it parks while home: across the road from the door, a little to its left (in view). */
export const truckSpot = (s: GameState): { x: number; y: number } => ({ x: Math.max(3, (s.map.doors[0]?.outside.x ?? s.map.busStop.x) - 7.5), y: s.map.busStop.y + 1.95 });

export const truckOpen = (s: GameState): boolean => s.stats.served >= TRUCK.minServed || s.truck.trips > 0 || s.truck.level > 0;

/** What a trip to `spot` would bring now. */
export function tripPay(s: GameState, spot: number): { coins: Big; gems: number } {
  const def = TRUCK_SPOTS[spot]!;
  const mult = 1 + TRUCK.perLevel * s.truck.level;
  return { coins: incomeRate(s).mul(def.incomeMinutes * 60 * mult).floor().max(20 * def.incomeMinutes), gems: def.gems };
}

export const spotOpen = (s: GameState, spot: number): boolean => s.mods.building >= (TRUCK_SPOTS[spot]?.minTier ?? 99);

/** Off it goes. */
export function sendTruck(s: GameState, spot: number, now: number): boolean {
  if (s.truck.trip || !truckOpen(s) || !spotOpen(s, spot)) return false;
  const pay = tripPay(s, spot);
  s.truck.trip = { spot, start: now, end: now + TRUCK_SPOTS[spot]!.minutes * 60000, coins: toSave(pay.coins), gems: pay.gems };
  emit(s, Ev.TruckOut, 0, 0, spot);
  return true;
}

/** Back: its takings come in. Too early, nothing happens (unless `rush` pays gems for it). */
export function collectTruck(s: GameState, now: number): boolean {
  const trip = s.truck.trip;
  if (!trip || now < trip.end) return false;
  // What it was worth when it left, or now if the restaurant earns more by then (it never pays
  // less because the income rate was still settling right after the game opened).
  const coins = fromSave(trip.coins).max(tripPay(s, trip.spot).coins);
  grantCoins(s, coins);
  s.gems += trip.gems;
  s.truck.trip = null;
  s.truck.trips += 1;
  emit(s, Ev.TruckBack, 0, 0, coins.toNumber(), trip.gems, trip.spot);
  return true;
}

/** Gems to call it back now: by the hours left (a minute's trip costs one). */
export const rushCost = (s: GameState, now: number): number => {
  const trip = s.truck.trip;
  return trip ? Math.max(1, Math.ceil(((trip.end - now) / 3600000) * TRUCK.gemsPerHour)) : 0;
};

/** Pays gems to have it back now, and collects. */
export function rushTruck(s: GameState, now: number): boolean {
  const trip = s.truck.trip;
  if (!trip || now >= trip.end) return collectTruck(s, now);
  const cost = rushCost(s, now);
  if (s.gems < cost) return false;
  s.gems -= cost;
  trip.end = now;
  return collectTruck(s, now);
}

/** The next level's price. */
export const upgradeCost = (s: GameState): Big => incomeRate(s).mul(TRUCK.upgradeMinutes * 60 * TRUCK.upgradeGrowth ** s.truck.level).floor().max(big(200).mul(TRUCK.upgradeGrowth ** s.truck.level).floor());

export function upgradeTruck(s: GameState): boolean {
  if (s.truck.level >= TRUCK.maxLevel || !truckOpen(s)) return false;
  const cost = upgradeCost(s);
  if (s.coins.lt(cost)) return false;
  s.coins = s.coins.sub(cost);
  s.truck.level += 1;
  emit(s, Ev.TruckLevel, 0, 0, s.truck.level);
  return true;
}

const nat = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** As saved. */
export function cleanTruck(raw: unknown): TruckState {
  if (!raw || typeof raw !== 'object') return newTruck();
  const o = raw as Record<string, unknown>;
  const t = o.trip as Record<string, unknown> | null | undefined;
  const trip =
    t && typeof t === 'object' && typeof t.coins === 'string' && TRUCK_SPOTS[nat(t.spot)]
      ? { spot: nat(t.spot), start: nat(t.start), end: nat(t.end), coins: t.coins, gems: nat(t.gems) }
      : null;
  return { level: Math.min(TRUCK.maxLevel, nat(o.level)), trip, trips: nat(o.trips) };
}
