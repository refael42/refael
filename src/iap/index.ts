import { STORE_BUILD } from '../config';
import { demoStore, offStore } from './demo';
import type { Store } from './types';

export type { BuyResult, Store, StoreGrant } from './types';

/**
 * The real App Store / Google Play connection. It needs a payment library that only works in a
 * native build (not Expo Go, not the browser); until it is installed there is none.
 */
const nativeStore = (): Store | null => null;

/** The store this run sells through: the real one, else the demo (never in a store build). */
export function createStore(): Store {
  return nativeStore() ?? (STORE_BUILD ? offStore() : demoStore());
}
