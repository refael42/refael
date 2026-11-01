import { describe, expect, it } from 'vitest';

import { Big, formatBig, formatDuration, suffixFor } from '../src/sim';

describe('Big', () => {
  it('normalizes the mantissa', () => {
    const b = Big.fromNumber(12345);
    expect(b.m).toBeCloseTo(1.2345, 10);
    expect(b.e).toBe(4);
    expect(Big.fromNumber(0.05).e).toBe(-2);
    expect(Big.fromNumber(0).isZero()).toBe(true);
    expect(Big.fromNumber(NaN).isZero()).toBe(true);
  });

  it('adds, subtracts, multiplies and divides', () => {
    expect(Big.fromNumber(999).add(1).toNumber()).toBe(1000);
    expect(Big.fromNumber(1000).sub(1).toNumber()).toBeCloseTo(999, 9);
    expect(Big.fromNumber(250).mul(4).toNumber()).toBe(1000);
    expect(Big.fromNumber(1000).div(8).toNumber()).toBe(125);
    expect(Big.fromNumber(5).sub(10).toNumber()).toBe(-5);
    expect(Big.fromNumber(1).div(0).isZero()).toBe(true);
  });

  it('handles numbers far beyond float range', () => {
    const huge = new Big(1.5, 400);
    expect(huge.mul(huge).e).toBe(800);
    expect(huge.add(1).eq(huge)).toBe(true);
    expect(huge.gt(new Big(9.9, 399))).toBe(true);
    expect(huge.toNumber()).toBe(Infinity);
  });

  it('compares with sign', () => {
    expect(Big.fromNumber(-5).lt(-1)).toBe(true);
    expect(Big.fromNumber(-5).cmp(3)).toBe(-1);
    expect(Big.fromNumber(0).cmp(-3)).toBe(1);
    expect(Big.fromNumber(7).cmp(7)).toBe(0);
    expect(Big.max(3, 9).toNumber()).toBe(9);
    expect(Big.min(3, 9).toNumber()).toBe(3);
  });

  it('pow works for costs', () => {
    expect(Big.fromNumber(2).pow(10).toNumber()).toBeCloseTo(1024, 6);
    expect(Big.fromNumber(1.15).pow(1000).e).toBe(60);
  });

  it('round-trips through JSON and tolerates junk', () => {
    const b = new Big(3.25, 42);
    const back = Big.from(JSON.parse(JSON.stringify(b)));
    expect(back.eq(b)).toBe(true);
    expect(Big.from('1.5e30').e).toBe(30);
    expect(Big.from('garbage').isZero()).toBe(true);
    expect(Big.from({ m: 'x', e: 3 } as unknown as { m: number; e: number }).isZero()).toBe(true);
    expect(Big.from(null).isZero()).toBe(true);
  });
});

describe('format', () => {
  it('shows short numbers', () => {
    expect(formatBig(0)).toBe('0');
    expect(formatBig(7)).toBe('7');
    expect(formatBig(950)).toBe('950');
    expect(formatBig(999.9)).toBe('999');
    expect(formatBig(1234)).toBe('1.2K');
    expect(formatBig(1000)).toBe('1K');
    expect(formatBig(12345)).toBe('12.3K');
    expect(formatBig(123456)).toBe('123K');
    expect(formatBig(3.4e6)).toBe('3.4M');
    expect(formatBig(5.6e9)).toBe('5.6B');
    expect(formatBig(7.8e12)).toBe('7.8T');
    expect(formatBig(1.2e15)).toBe('1.2aa');
    expect(formatBig(-1234)).toBe('-1.2K');
  });

  it('never rounds up past what you have', () => {
    expect(formatBig(1999)).toBe('1.9K');
    expect(formatBig(999999)).toBe('999K');
  });

  it('continues the letter suffixes', () => {
    expect(suffixFor(5)).toBe('aa');
    expect(suffixFor(6)).toBe('ab');
    expect(suffixFor(5 + 25)).toBe('az');
    expect(suffixFor(5 + 26)).toBe('ba');
    expect(suffixFor(5 + 676)).toBe('aaa');
    expect(formatBig(new Big(4.56, 45))).toBe('4.5ak');
  });

  it('formats durations', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});
