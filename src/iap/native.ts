import { requireOptionalNativeModule } from 'expo';
import type { Product, Purchase } from 'expo-iap';
import { OFFERS } from '../data/offers';
import { GEM_PACKS } from '../data/shop';
import type { BuyResult, Store, StoreGrant } from './types';

// The real App Store / Google Play (owner M28): expo-iap, which only exists in a native build.
// In Expo Go its native part is missing and loading it throws: then there is no real store and
// src/iap/index.ts falls back. The web build uses native.web.ts instead (nothing to load).

type Iap = typeof import('expo-iap');

function load(): Iap | null {
  // Expo Go has no store module: check before loading the library (which would only fail later).
  if (!requireOptionalNativeModule('ExpoIap')) return null;
  try {
    return require('expo-iap') as Iap;
  } catch {
    return null;
  }
}

/** The store's id for a purchase: the transaction (iOS) or the purchase token (Android). */
const txOf = (p: Purchase): string => p.id || p.purchaseToken || `${p.productId}-${p.transactionDate}`;

/** How long a tap on "buy" waits for the store's answer before giving up on showing it (ms). */
const BUY_TIMEOUT_MS = 5 * 60 * 1000;

export function nativeStore(): Store | null {
  const iap = load();
  if (!iap) return null;
  const prices: Record<string, string> = {};
  /** Paid purchases waiting to be finished, by transaction. */
  const open = new Map<string, Purchase>();
  /** The tap on "buy" waiting for its answer (one at a time). */
  let waiting: { product: string; done: (r: BuyResult) => void } | null = null;
  let subs: { remove: () => void }[] = [];

  const answer = (product: string | null | undefined, result: BuyResult) => {
    if (!waiting || (product && product !== waiting.product)) return;
    const w = waiting;
    waiting = null;
    w.done(result);
  };

  return {
    mode: 'store',
    async start(onGrant) {
      const take = (p: Purchase) => {
        if (p.purchaseState === 'pending') return answer(p.productId, 'pending');
        if (p.purchaseState !== 'purchased') return;
        const grant: StoreGrant = { product: p.productId, transaction: txOf(p), time: Number(p.transactionDate) || Date.now() };
        open.set(grant.transaction, p);
        onGrant(grant);
        answer(p.productId, 'ok');
      };
      subs = [
        iap.purchaseUpdatedListener(take),
        iap.purchaseErrorListener((e) => answer(e.productId, e.code === iap.ErrorCode.UserCancelled ? 'cancelled' : e.code === iap.ErrorCode.Pending || e.code === iap.ErrorCode.DeferredPayment ? 'pending' : 'failed')),
      ];
      await iap.initConnection();
      const products = ((await iap.fetchProducts({ skus: [...GEM_PACKS.map((g) => g.id), ...OFFERS.map((o) => o.id)], type: 'in-app' })) ?? []) as Product[];
      for (const p of products) prices[p.id] = p.displayPrice;
      // Paid before but never finished (the app closed in between): pay them out now.
      for (const p of (await iap.getAvailablePurchases()) ?? []) take(p);
    },
    prices: () => prices,
    buy(product) {
      if (waiting) return Promise.resolve('failed');
      return new Promise<BuyResult>((resolve) => {
        const timer = setTimeout(() => answer(product, 'failed'), BUY_TIMEOUT_MS);
        waiting = {
          product,
          done: (r) => {
            clearTimeout(timer);
            resolve(r);
          },
        };
        iap.requestPurchase({ request: { apple: { sku: product }, google: { skus: [product] } }, type: 'in-app' }).catch(() => answer(product, 'failed'));
      });
    },
    async restore() {
      // The store's own sync first (it may ask the player to sign in), then the whole history.
      await iap.restorePurchases();
      const all = ((await iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: false, alsoPublishToEventListenerIOS: false })) ?? []) as Purchase[];
      return all.filter((p) => p.purchaseState !== 'pending').map((p) => ({ product: p.productId, transaction: txOf(p), time: Number(p.transactionDate) || 0 }));
    },
    async finish(grant) {
      const p = open.get(grant.transaction);
      if (!p) return;
      // Gems are consumables: finishing consumes them, so the pack can be bought again.
      await iap.finishTransaction({ purchase: p, isConsumable: true });
      open.delete(grant.transaction);
    },
    stop() {
      for (const s of subs) s.remove();
      subs = [];
      void iap.endConnection().catch(() => {});
    },
  };
}
