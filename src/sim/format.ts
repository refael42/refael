import { big, type BigSource } from './big';

const NAMED_SUFFIXES = ['', 'K', 'M', 'B', 'T'] as const;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Suffix for a power-of-1000 tier: K, M, B, T, then aa, ab ... zz, aaa ... (never runs out).
 */
export function tierSuffix(tier: number): string {
  if (tier < NAMED_SUFFIXES.length) return NAMED_SUFFIXES[tier]!;
  let n = tier - NAMED_SUFFIXES.length;
  let length = 2;
  let count = 26 ** length;
  while (n >= count) {
    n -= count;
    length += 1;
    count = 26 ** length;
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out = LETTERS[n % 26] + out;
    n = Math.floor(n / 26);
  }
  return out;
}

/**
 * Truncates (never rounds up) so the HUD never shows more money than the player has:
 * showing "1K" while holding 999.6 would make a 1K item look affordable when it is not.
 */
function truncate(value: number, decimals: number): string {
  const f = 10 ** decimals;
  // The epsilon absorbs float noise such as 2.3 * 100 = 229.99999999999997.
  const text = (Math.floor(value * f + 1e-7) / f).toFixed(decimals);
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** 999 -> "999", 1234 -> "1.23K", 5.6e9 -> "5.6B", 1e15 -> "1aa". */
export function formatBig(source: BigSource): string {
  const value = big(source);
  if (value.sign() < 0) return `-${formatBig(value.neg())}`;
  if (value.lt(1000)) return String(Math.floor(value.toNumber() + 1e-9));

  const exponent = value.exponent;
  const tier = Math.floor(exponent / 3);
  const shown = value.mantissa * 10 ** (exponent - tier * 3);
  const decimals = shown < 10 ? 2 : shown < 100 ? 1 : 0;
  return truncate(shown, decimals) + tierSuffix(tier);
}
