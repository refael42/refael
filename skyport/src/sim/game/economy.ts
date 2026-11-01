import type { AircraftDef } from '../../data/aircraft';
import { Big } from '../big';
import type { Flight } from './types';

/** Coins per second of parking. */
export const PARK_RATE = 0.05;

/** Mood multiplier: grumpy 0.7x .. delighted 1.3x (like tips in a restaurant). */
export function moodMultiplier(mood: number): number {
  return 0.7 + 0.6 * Math.max(0, Math.min(1, mood));
}

export function punctualityMultiplier(onTime: number): number {
  return onTime > 0 ? 1.15 : onTime < 0 ? 0.85 : 1;
}

/** What a departing flight pays. */
export function flightRevenue(f: Flight, ac: AircraftDef): Big {
  const parked = Math.max(0, f.offBlockAt - f.dockedAt);
  const base = ac.landingFee + parked * PARK_RATE + ac.paxFee * f.boarded;
  const total = base * moodMultiplier(f.mood) * punctualityMultiplier(f.onTime);
  return Big.fromNumber(Math.max(1, Math.round(total)));
}

/** Rating 1..5 as a moving average of how happy each flight left. */
export function nextRating(rating: number, mood: number): number {
  const target = 1 + 4 * Math.max(0, Math.min(1, mood));
  const r = rating * 0.85 + target * 0.15;
  return Math.max(1, Math.min(5, r));
}
