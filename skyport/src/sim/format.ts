import { Big, type BigLike } from './big';

/** Suffix for the n-th group of thousands (n = 1 -> K). */
export function suffixFor(group: number): string {
  if (group <= 0) return '';
  const named = ['K', 'M', 'B', 'T'];
  if (group <= named.length) return named[group - 1];
  // aa, ab, ... az, ba, ... zz, then aaa ...
  let i = group - named.length - 1;
  let letters = 2;
  let span = 26 * 26;
  while (i >= span) {
    i -= span;
    letters++;
    span *= 26;
  }
  let out = '';
  for (let k = 0; k < letters; k++) {
    out = String.fromCharCode(97 + (i % 26)) + out;
    i = Math.floor(i / 26);
  }
  return out;
}

function trimZeros(s: string): string {
  return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
}

/**
 * Short money format: 950, 1.2K, 12.3K, 123K, 3.4M, 5.6B, 7.8T, 1.2aa ...
 * Always rounds down, so the shown value is never more than what you have.
 */
export function formatBig(v: BigLike): string {
  const b = Big.from(v);
  if (b.isZero()) return '0';
  const sign = b.isNeg() ? '-' : '';
  const a = b.abs();
  if (a.e < 3) {
    return sign + String(Math.floor(a.toNumber() + 1e-9));
  }
  const group = Math.floor(a.e / 3);
  const rest = a.e - group * 3;
  const value = a.m * Math.pow(10, rest); // 1 <= value < 1000
  let text: string;
  if (value < 100) {
    text = trimZeros((Math.floor(value * 10 + 1e-9) / 10).toFixed(1));
  } else {
    text = String(Math.floor(value + 1e-9));
  }
  return sign + text + suffixFor(group);
}

/** Formats a duration in seconds as m:ss or h:mm:ss. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
