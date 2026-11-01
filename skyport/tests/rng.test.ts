import { describe, expect, it } from 'vitest';

import { hash01, hash2, normalizeSeed, rand, randInt, randWeighted } from '../src/sim';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = { rng: normalizeSeed(1234) };
    const b = { rng: normalizeSeed(1234) };
    for (let i = 0; i < 1000; i++) expect(rand(a)).toBe(rand(b));
  });

  it('differs between seeds and stays in [0,1)', () => {
    const a = { rng: normalizeSeed(1) };
    const b = { rng: normalizeSeed(2) };
    let same = 0;
    for (let i = 0; i < 200; i++) {
      const x = rand(a);
      const y = rand(b);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      if (x === y) same++;
    }
    expect(same).toBeLessThan(3);
  });

  it('is roughly uniform', () => {
    const s = { rng: normalizeSeed(99) };
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) buckets[Math.floor(rand(s) * 10)]++;
    for (const b of buckets) expect(Math.abs(b - 2000)).toBeLessThan(250);
  });

  it('randInt covers the inclusive range', () => {
    const s = { rng: normalizeSeed(5) };
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(s, 3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('randWeighted respects zero weights', () => {
    const s = { rng: normalizeSeed(7) };
    for (let i = 0; i < 200; i++) expect(randWeighted(s, [0, 1, 0, 2])).not.toBe(0);
    expect(randWeighted(s, [0, 0])).toBe(-1);
  });

  it('normalizeSeed never returns 0 or NaN', () => {
    expect(normalizeSeed(0)).not.toBe(0);
    expect(Number.isFinite(normalizeSeed(NaN))).toBe(true);
  });

  it('hash01 is stable and spread out', () => {
    expect(hash01(42)).toBe(hash01(42));
    expect(hash01(42)).not.toBe(hash01(43));
    expect(hash2(1, 2)).not.toBe(hash2(2, 1));
    let sum = 0;
    for (let i = 0; i < 5000; i++) sum += hash01(i);
    expect(Math.abs(sum / 5000 - 0.5)).toBeLessThan(0.02);
  });
});
