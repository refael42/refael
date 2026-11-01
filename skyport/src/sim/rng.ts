/**
 * Deterministic random numbers. The generator state is a single uint32 kept
 * inside the game state, so saving and replaying reproduce the same sequence.
 * (mulberry32: tiny, fast and good enough for gameplay.)
 */
export interface RngState {
  rng: number;
}

/** Returns a float in [0, 1) and advances the generator. */
export function rand(s: RngState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [lo, hi] inclusive. */
export function randInt(s: RngState, lo: number, hi: number): number {
  return lo + Math.floor(rand(s) * (hi - lo + 1));
}

/** Float in [lo, hi). */
export function randRange(s: RngState, lo: number, hi: number): number {
  return lo + rand(s) * (hi - lo);
}

/** Picks an index using non-negative weights. Returns -1 when all weights are 0. */
export function randWeighted(s: RngState, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w > 0 ? w : 0;
  if (total <= 0) return -1;
  let r = rand(s) * total;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    if (r < w) return i;
    r -= w;
  }
  return weights.length - 1;
}

/** Turns any number into a valid non-zero uint32 seed. */
export function normalizeSeed(seed: number): number {
  const n = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : 1;
  const u = n >>> 0;
  return u === 0 ? 0x9e3779b9 : u;
}
