import { STORE_BUILD } from '../config';
import { demoStore, offStore } from './demo';
import { nativeStore } from './native';
import type { Store } from './types';

export type { BuyResult, Store, StoreGrant } from './types';


/** The store this run sells through: the real one, else the demo (never in a store build). */
export function createStore(): Store {
  return nativeStore() ?? (STORE_BUILD ? offStore() : demoStore());
}
