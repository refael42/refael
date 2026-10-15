import type { Store } from './types';

/** The browser has no App Store or Google Play (src/iap/native.ts is the phones' one). */
export function nativeStore(): Store | null {
  return null;
}
