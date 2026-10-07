import Decimal from 'break_infinity.js';

/**
 * All money in the game is a Big. The game is endless, so values pass 2^53 quickly; plain JS
 * numbers would silently lose precision. Everything goes through this module so the underlying
 * library can be swapped without touching game logic.
 */
export type Big = Decimal;
export type BigSource = Decimal | number | string;

export const ZERO: Big = new Decimal(0);
export const ONE: Big = new Decimal(1);

export function big(value: BigSource): Big {
  return new Decimal(value);
}

/** Stable string for saves; round-trips through fromSave without precision loss. */
export function toSave(value: Big): string {
  return `${value.mantissa}e${value.exponent}`;
}

export function fromSave(text: string): Big {
  const v = new Decimal(text);
  if (!Number.isFinite(v.mantissa) || !Number.isFinite(v.exponent)) {
    throw new Error(`Invalid saved number: ${text}`);
  }
  return v;
}
