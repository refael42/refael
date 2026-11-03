import type { AircraftDef } from '../../data/aircraft';
import { Big } from '../big';
import { FUEL_SELL } from '../../data/supplies';
import type { Flight } from './types';
import type { Effects } from './upgrades';

/** Coins per second of parking. */
export const PARK_RATE = 0.05;

/** Mood multiplier: grumpy 0.7x .. delighted 1.3x (like tips in a restaurant). */
export function moodMultiplier(mood: number): number {
  return 0.7 + 0.6 * Math.max(0, Math.min(1, mood));
}

export function punctualityMultiplier(onTime: number): number {
  return onTime > 0 ? 1.15 : onTime < 0 ? 0.85 : 1;
}

export interface Revenue {
  total: Big;
  /** landing, parking, passenger fees, fuel sold (after multipliers). */
  parts: [number, number, number, number];
}

/** What a departing flight pays, split by source. */
export function flightRevenue(f: Flight, ac: AircraftDef, fx?: Effects, tierPay = 1): Revenue {
  const parked = Math.max(0, f.offBlockAt - f.dockedAt);
  const mul = moodMultiplier(f.mood) * punctualityMultiplier(f.onTime) * tierPay * (f.payMul ?? 1);
  const landing = ac.landingFee * (fx?.landingFee ?? 1) * mul;
  const parking = parked * PARK_RATE * mul;
  const pax = ac.paxFee * (fx?.paxFee ?? 1) * f.boarded * mul;
  // the fuel pumped into the plane (fuel is fuel: no mood or punctuality on its price)
  // (the kiosk earns from real shoppers in the terminal, terminal.ts)
  void fx?.kioskPerPax;
  const fuel = Math.max(0, f.fuel || 0) * FUEL_SELL * tierPay;
  const total = Math.max(1, Math.round(landing + parking + pax + fuel));
  return { total: Big.fromNumber(total), parts: [landing, parking, pax, fuel] };
}

/** Rating 1..5 as a moving average of how happy each flight left. */
export function nextRating(rating: number, mood: number): number {
  const target = 1 + 4 * Math.max(0, Math.min(1, mood));
  const r = rating * 0.85 + target * 0.15;
  return Math.max(1, Math.min(5, r));
}

/** What a typical full Sparrow pays at a tier (for tests and the tier sheet). */
export function flightRevenueFor(tierPay: number): number {
  const f = { offBlockAt: 30, dockedAt: 0, mood: 0.8, onTime: 1, boarded: 4 } as unknown as Flight;
  const ac = { landingFee: 6, paxFee: 4 } as unknown as AircraftDef;
  return flightRevenue(f, ac, undefined, tierPay).total.toNumber();
}
