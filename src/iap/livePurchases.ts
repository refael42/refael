import { useSyncExternalStore } from 'react';
import type { Purchases } from './usePurchases';

// The game's store connection (usePurchases) lives inside the running game; the settings panel
// sits outside it but needs "Restore purchases" (App Review 3.1.1). The game publishes its
// purchases here and the panel reads them.

let current: Purchases | null = null;
const listeners = new Set<() => void>();

export function publishPurchases(p: Purchases | null): void {
  if (p === current) return;
  current = p;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The running game's purchases (null before the game starts). */
export const useLivePurchases = (): Purchases | null => useSyncExternalStore(subscribe, () => current, () => current);
