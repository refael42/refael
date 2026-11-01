/**
 * Stateless deterministic hashing. New features that need randomness use
 * hash01(entityId * k + c) instead of drawing from the shared RNG, so adding
 * a feature never changes the RNG sequence of existing games.
 */
export function hashU32(n: number): number {
  let x = (Math.floor(n) ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

/** Float in [0, 1). */
export function hash01(n: number): number {
  return hashU32(n) / 4294967296;
}

/** Combines two integers into one hash input. */
export function hash2(a: number, b: number): number {
  return hash01(hashU32(a) * 31 + Math.floor(b));
}
