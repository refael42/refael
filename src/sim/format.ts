import { big, type BigSource } from './big';

// Number formatting shared by the sim (exact Big values) and the UI thread (rolling HUD digits).
// The plain-number functions are worklets so the renderer can format every frame.

const NAMED_SUFFIXES = ['', 'K', 'M', 'B', 'T'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Suffix for a power-of-1000 tier: K, M, B, T, then aa, ab ... zz, aaa ... (never runs out). */
export function tierSuffix(tier: number): string {
  'worklet';
  if (tier < NAMED_SUFFIXES.length) return NAMED_SUFFIXES[tier]!;
  let n = tier - NAMED_SUFFIXES.length;
  let length = 2;
  let count = Math.pow(26, length);
  while (n >= count) {
    n -= count;
    length += 1;
    count = Math.pow(26, length);
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
  'worklet';
  const f = Math.pow(10, decimals);
  // The epsilon absorbs float noise such as 2.3 * 100 = 229.99999999999997.
  const text = (Math.floor(value * f + 1e-7) / f).toFixed(decimals);
  return text.indexOf('.') >= 0 ? text.replace(/\.?0+$/, '') : text;
}

/** Formats a value given as mantissa (1..10) and base-10 exponent (>= 3). */
export function formatParts(mantissa: number, exponent: number): string {
  'worklet';
  const tier = Math.floor(exponent / 3);
  const shown = mantissa * Math.pow(10, exponent - tier * 3);
  const decimals = shown < 10 ? 2 : shown < 100 ? 1 : 0;
  return truncate(shown, decimals) + tierSuffix(tier);
}

/** Plain-number version (valid up to ~1e308), used by the UI thread. */
export function formatNumber(n: number): string {
  'worklet';
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + formatNumber(-n);
  if (n < 1000) return String(Math.floor(n + 1e-9));
  let exponent = Math.floor(Math.log10(n));
  let mantissa = n / Math.pow(10, exponent);
  if (mantissa >= 10 - 1e-12) {
    mantissa /= 10;
    exponent += 1;
  }
  return formatParts(mantissa, exponent);
}

/** 999 -> "999", 1234 -> "1.23K", 5.6e9 -> "5.6B", 1e15 -> "1aa". */
export function formatBig(source: BigSource): string {
  const value = big(source);
  if (value.sign() < 0) return `-${formatBig(value.neg())}`;
  if (value.lt(1000)) return String(Math.floor(value.toNumber() + 1e-9));
  return formatParts(value.mantissa, value.exponent);
}

/** Time left on a job: "45s", "3:05", "1h05". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  if (s >= 3600) return `${Math.floor(s / 3600)}h${pad(Math.floor((s % 3600) / 60))}`;
  if (s >= 60) return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  return `${s}s`;
}
