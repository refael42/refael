import { describe, expect, it } from 'vitest';
import { advance, createStepper, stepAlpha } from '../src/sim/loop';
import { chance, createRng, int, next, pick } from '../src/sim/rng';

describe('fixed-timestep stepper', () => {
  it('turns uneven frame times into whole steps and keeps the remainder', () => {
    const s = createStepper(50, 10);
    expect(advance(s, 16)).toBe(0);
    expect(advance(s, 16)).toBe(0);
    expect(advance(s, 20)).toBe(1); // 52ms accumulated
    expect(stepAlpha(s)).toBeCloseTo(2 / 50);
    expect(s.tick).toBe(1);
  });

  it('caps catch-up steps and reports dropped time instead of freezing', () => {
    const s = createStepper(50, 4);
    expect(advance(s, 1000)).toBe(4);
    expect(s.droppedMs).toBe(800);
    expect(s.accumulatorMs).toBe(0);
  });

  it('gives the same tick count regardless of frame rate', () => {
    const fast = createStepper(50, 10);
    const slow = createStepper(50, 10);
    for (let i = 0; i < 600; i++) advance(fast, 1000 / 120);
    for (let i = 0; i < 150; i++) advance(slow, 1000 / 30);
    expect(fast.tick).toBe(slow.tick);
  });
});

describe('seeded rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(next(a)).toBe(next(b));
  });

  it('resumes identically from a saved state', () => {
    const a = createRng(7);
    for (let i = 0; i < 10; i++) next(a);
    const restored = createRng(a.state);
    expect(next(restored)).toBe(next(a));
  });

  it('stays in range and is roughly uniform', () => {
    const r = createRng(1);
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 40000; i++) buckets[int(r, 0, 4)]! += 1;
    for (const b of buckets) expect(b).toBeGreaterThan(9500);
    expect(pick(r, ['x'])).toBe('x');
    expect(chance(r, 0)).toBe(false);
    expect(chance(r, 1)).toBe(true);
  });
});
