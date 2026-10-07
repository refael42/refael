import { describe, expect, it } from 'vitest';
import { big, fromSave, toSave } from '../src/sim/big';
import { formatBig, formatNumber, tierSuffix } from '../src/sim/format';

describe('formatBig', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [12.9, '12'],
    [999, '999'],
    [999.99, '999'],
    [1000, '1K'],
    [1234, '1.23K'],
    [12345, '12.3K'],
    [123456, '123K'],
    [230000, '230K'],
    [999999, '999K'],
    [1e6, '1M'],
    [1.5e9, '1.5B'],
    [1e12, '1T'],
    [1e15, '1aa'],
    [1e18, '1ab'],
    [-1500, '-1.5K'],
  ])('%s -> %s', (input, expected) => {
    expect(formatBig(input)).toBe(expected);
  });

  it('never rounds up (would make unaffordable items look affordable)', () => {
    expect(formatBig(999_999.99)).toBe('999K');
    expect(formatBig(1999)).toBe('1.99K');
  });

  it('handles numbers far beyond 2^53', () => {
    expect(formatBig(big('1e90'))).toBe('1az');
    expect(formatBig(big('1e93'))).toBe('1ba');
    expect(formatBig(big('4.56e2043'))).toBe('4.56aaa');
  });
});

describe('tierSuffix', () => {
  it('continues forever after the two-letter range', () => {
    expect(tierSuffix(5)).toBe('aa');
    expect(tierSuffix(5 + 675)).toBe('zz');
    expect(tierSuffix(5 + 676)).toBe('aaa');
  });
});

describe('Big save round-trip', () => {
  it.each(['0', '1', '123456789', '1.2345e300', '9.87e123456'])('%s', (text) => {
    const v = big(text);
    expect(fromSave(toSave(v)).eq(v)).toBe(true);
  });

  it('rejects garbage', () => {
    expect(() => fromSave('banana')).toThrow();
  });

  // Big trades exact integers for range (~15 significant digits), which is what an idle game needs.
  it('keeps working where plain numbers overflow to Infinity', () => {
    const v = big(1e300).mul(1e300);
    expect(Number.isFinite(1e300 * 1e300)).toBe(false);
    expect(v.exponent).toBe(600);
    expect(v.div(1e300).eq(1e300)).toBe(true);
  });
});

describe('formatNumber (UI-thread twin of formatBig)', () => {
  it.each([0, 7, 999, 1000, 1234, 230000, 1.5e9, 1e15, 4.56e40, 999_999.99])('%s matches formatBig', (n) => {
    expect(formatNumber(n)).toBe(formatBig(n));
  });
});
