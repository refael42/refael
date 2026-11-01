/**
 * Big numbers for money: value = m * 10^e with 1 <= |m| < 10 (or m = 0).
 * Immutable. Precise enough for an idle game (about 15 significant digits).
 */
export type BigLike = Big | number | string | readonly [number, number] | { m: number; e: number };

const MAX_EXP_DIFF = 17;

function pow10(n: number): number {
  // Exact for small integer powers, which keeps arithmetic stable.
  if (Number.isInteger(n)) {
    if (n >= 0 && n < POW10.length) return POW10[n];
    if (n < 0 && -n < POW10.length) return 1 / POW10[-n];
  }
  return Math.pow(10, n);
}
const POW10: number[] = [];
for (let i = 0, v = 1; i <= 22; i++, v *= 10) POW10.push(v);

export class Big {
  readonly m: number;
  readonly e: number;

  static readonly ZERO = new Big(0, 0);
  static readonly ONE = new Big(1, 0);

  constructor(m: number, e: number) {
    if (!Number.isFinite(m) || !Number.isFinite(e) || m === 0) {
      this.m = 0;
      this.e = 0;
      return;
    }
    let mm = m;
    let ee = Math.trunc(e);
    const am = Math.abs(mm);
    if (am >= 10 || am < 1) {
      const shift = Math.floor(Math.log10(am));
      mm = mm / pow10(shift);
      ee += shift;
      // Guard against floating point landing on 10 or 0.999...
      if (Math.abs(mm) >= 10) {
        mm /= 10;
        ee += 1;
      } else if (Math.abs(mm) < 1) {
        mm *= 10;
        ee -= 1;
      }
    }
    // Drop float noise (7.429999999999 -> 7.43) so integer amounts stay exact.
    mm = Math.round(mm * 1e13) / 1e13;
    if (Math.abs(mm) >= 10) {
      mm /= 10;
      ee += 1;
    }
    this.m = mm;
    this.e = ee;
  }

  static from(v: BigLike | null | undefined): Big {
    if (v instanceof Big) return v;
    if (typeof v === 'number') return Big.fromNumber(v);
    if (typeof v === 'string') return Big.parse(v);
    if (Array.isArray(v)) {
      const [m, e] = v as readonly [number, number];
      return typeof m === 'number' && typeof e === 'number' ? new Big(m, e) : Big.ZERO;
    }
    if (v && typeof v === 'object') {
      const o = v as { m?: unknown; e?: unknown };
      if (typeof o.m === 'number' && typeof o.e === 'number') return new Big(o.m, o.e);
    }
    return Big.ZERO;
  }

  static fromNumber(n: number): Big {
    if (!Number.isFinite(n) || n === 0) return Big.ZERO;
    return new Big(n, 0);
  }

  /** Parses "123", "1.5e30" or "1.5e+30". Invalid input gives zero. */
  static parse(s: string): Big {
    const t = s.trim();
    const match = /^(-?\d+(?:\.\d+)?)(?:e([+-]?\d+))?$/i.exec(t);
    if (!match) return Big.ZERO;
    return new Big(parseFloat(match[1]), match[2] ? parseInt(match[2], 10) : 0);
  }

  isZero(): boolean {
    return this.m === 0;
  }

  isNeg(): boolean {
    return this.m < 0;
  }

  neg(): Big {
    return new Big(-this.m, this.e);
  }

  abs(): Big {
    return this.m < 0 ? new Big(-this.m, this.e) : this;
  }

  add(other: BigLike): Big {
    const b = Big.from(other);
    if (b.m === 0) return this;
    if (this.m === 0) return b;
    if (this.e >= b.e) {
      const d = this.e - b.e;
      if (d > MAX_EXP_DIFF) return this;
      return new Big(this.m + b.m / pow10(d), this.e);
    }
    const d = b.e - this.e;
    if (d > MAX_EXP_DIFF) return b;
    return new Big(b.m + this.m / pow10(d), b.e);
  }

  sub(other: BigLike): Big {
    return this.add(Big.from(other).neg());
  }

  mul(other: BigLike): Big {
    const b = Big.from(other);
    if (b.m === 0 || this.m === 0) return Big.ZERO;
    return new Big(this.m * b.m, this.e + b.e);
  }

  div(other: BigLike): Big {
    const b = Big.from(other);
    if (b.m === 0) return Big.ZERO;
    if (this.m === 0) return Big.ZERO;
    return new Big(this.m / b.m, this.e - b.e);
  }

  /** this ^ p for a plain-number power (used for exponential costs). */
  pow(p: number): Big {
    if (this.m === 0) return p === 0 ? Big.ONE : Big.ZERO;
    if (this.m < 0) return Big.ZERO;
    const log = (Math.log10(this.m) + this.e) * p;
    const e = Math.floor(log);
    return new Big(pow10(log - e), e);
  }

  cmp(other: BigLike): -1 | 0 | 1 {
    const b = Big.from(other);
    if (this.m === b.m && this.e === b.e) return 0;
    const sa = Math.sign(this.m);
    const sb = Math.sign(b.m);
    if (sa !== sb) return sa < sb ? -1 : 1;
    // Same sign, both non-zero. Mantissas carry the sign; exponents don't.
    if (this.e === b.e) return this.m > b.m ? 1 : -1;
    const r = this.e > b.e ? 1 : -1;
    return (sa < 0 ? -r : r) as -1 | 1;
  }

  gte(other: BigLike): boolean {
    return this.cmp(other) >= 0;
  }

  gt(other: BigLike): boolean {
    return this.cmp(other) > 0;
  }

  lt(other: BigLike): boolean {
    return this.cmp(other) < 0;
  }

  lte(other: BigLike): boolean {
    return this.cmp(other) <= 0;
  }

  eq(other: BigLike): boolean {
    return this.cmp(other) === 0;
  }

  static max(a: BigLike, b: BigLike): Big {
    const x = Big.from(a);
    const y = Big.from(b);
    return x.gte(y) ? x : y;
  }

  static min(a: BigLike, b: BigLike): Big {
    const x = Big.from(a);
    const y = Big.from(b);
    return x.lte(y) ? x : y;
  }

  /** Plain number. Infinity when the exponent is beyond float range. */
  toNumber(): number {
    if (this.m === 0) return 0;
    if (this.e > 308) return this.m > 0 ? Infinity : -Infinity;
    if (this.e < -308) return 0;
    // via a decimal string so 1.09e2 is exactly 109 (not 109.00000000000001)
    return Number(this.m.toPrecision(15) + 'e' + this.e);
  }

  floor(): Big {
    if (this.e >= 16 || this.m === 0) return this;
    if (this.e < 0) return this.m < 0 ? new Big(-1, 0) : Big.ZERO;
    return Big.fromNumber(Math.floor(this.toNumber()));
  }

  /** Rounds up to a whole number (no-op for huge values). */
  ceil(): Big {
    if (this.e >= 15 || this.m === 0) return this;
    return Big.fromNumber(Math.ceil(this.toNumber() - 1e-9));
  }

  /** Log10 of the absolute value (for UI bars and ROI). */
  log10(): number {
    if (this.m === 0) return -Infinity;
    return Math.log10(Math.abs(this.m)) + this.e;
  }

  toJSON(): [number, number] {
    return [this.m, this.e];
  }

  toString(): string {
    return this.e < 16 && this.e > -7 ? String(this.toNumber()) : `${this.m}e${this.e}`;
  }
}
