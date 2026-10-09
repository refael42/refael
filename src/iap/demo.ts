import { GEM_PACKS } from '../data/shop';
import type { Store, StoreGrant } from './types';

// Where there is no real store (the browser, Expo Go, the owner's dev runs): a purchase just
// adds the gems after a moment, nothing is charged. Never used in a store build (src/iap/index.ts).

const FAKE_PAYMENT_MS = 450;

export function demoStore(): Store {
  let onGrant: ((g: StoreGrant) => void) | null = null;
  let seq = 0;
  const prices = Object.fromEntries(GEM_PACKS.map((p) => [p.id, p.price]));
  return {
    mode: 'demo',
    start: async (cb) => {
      onGrant = cb;
    },
    prices: () => prices,
    buy: (product) =>
      new Promise((resolve) => {
        setTimeout(() => {
          onGrant?.({ product, transaction: `demo-${Date.now()}-${++seq}` });
          resolve('ok');
        }, FAKE_PAYMENT_MS);
      }),
    finish: async () => {},
    stop: () => {
      onGrant = null;
    },
  };
}

/** A store build that could not start payments: shows no prices, sells nothing. */
export function offStore(): Store {
  return {
    mode: 'off',
    start: async () => {},
    prices: () => ({}),
    buy: async () => 'failed',
    finish: async () => {},
    stop: () => {},
  };
}
