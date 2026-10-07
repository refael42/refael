/**
 * Seeded PRNG (mulberry32). The whole state is one uint32, so it is trivially saved and
 * restored, which keeps the simulation deterministic across save/load and in tests.
 */
export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** Uniform float in [0, 1). */
export function next(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform float in [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * next(rng);
}

/** Uniform integer in [min, maxExclusive). */
export function int(rng: Rng, min: number, maxExclusive: number): number {
  return min + Math.floor(next(rng) * (maxExclusive - min));
}

export function chance(rng: Rng, p: number): boolean {
  return next(rng) < p;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() from empty list');
  return items[int(rng, 0, items.length)]!;
}
