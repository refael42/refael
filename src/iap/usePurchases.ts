import { useCallback, useEffect, useRef, useState } from 'react';
import { SHOP_BY_ID } from '../data/shop';
import type { GameState } from '../sim/game/types';
import { makeSave } from '../sim/save';
import { grantPurchase, purchasePaid } from '../sim/shop';
import { writeSave } from '../store/persistence';
import { createStore, type BuyResult, type StoreGrant } from './index';

/** How often purchases the store sent are paid out (ms). */
const PAY_EVERY_MS = 300;

export interface Purchases {
  mode: 'store' | 'demo' | 'off';
  /** The store's price text per gem pack (local currency). */
  prices: Readonly<Record<string, string>>;
  /** The pack being paid for right now (one at a time). */
  busy: string | null;
  /** The last outcome to show: gems arrived, cancelled, waiting for approval, failed. */
  note: { kind: 'paid'; gems: number } | { kind: Exclude<BuyResult, 'ok'> } | null;
  buy: (product: string) => void;
  clearNote: () => void;
}

/**
 * Lives as long as the game screen, so a purchase the store still owes (the app was closed while
 * paying) is paid out at the next start. The order matters: gems in, save written, THEN the
 * store is told it was paid. If the app dies in between, the store sends it again and the
 * save's purchase log (src/sim/shop.ts grantPurchase) makes sure it pays once.
 */
export function usePurchases(gameRef: { current: GameState | null }, paused: { current: boolean }): Purchases {
  const [store] = useState(createStore);
  const [prices, setPrices] = useState(() => store.prices());
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Purchases['note']>(null);
  const owed = useRef<StoreGrant[]>([]);

  useEffect(() => {
    let alive = true;
    void store
      .start((grant) => owed.current.push(grant))
      .then(() => {
        if (alive) setPrices({ ...store.prices() });
      })
      .catch((e: unknown) => console.warn('Store did not start', e));
    // Not while the welcome-back screen holds the game: a save then would skip the time away.
    const timer = setInterval(() => {
      const game = gameRef.current;
      if (!game || paused.current || owed.current.length === 0) return;
      const grants = owed.current.splice(0);
      let gems = 0;
      for (const g of grants) if (grantPurchase(game, g.product, g.transaction)) gems += (SHOP_BY_ID[g.product] as { gems?: number } | undefined)?.gems ?? 0;
      if (gems > 0 && alive) setNote({ kind: 'paid', gems });
      void writeSave(makeSave(game, Date.now())).then(() => {
        // Only what the saved game shows as paid (an unknown product is left to the store, which refunds it).
        for (const g of grants) if (purchasePaid(game, g.transaction)) void store.finish(g).catch((e: unknown) => console.warn('Store finish failed', e));
      });
    }, PAY_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
      store.stop();
    };
  }, [store, gameRef, paused]);

  const buy = useCallback(
    (product: string) => {
      if (busy) return;
      setBusy(product);
      setNote(null);
      void store
        .buy(product)
        .catch((): BuyResult => 'failed')
        .then((result) => {
          setBusy(null);
          if (result !== 'ok') setNote({ kind: result });
        });
    },
    [store, busy],
  );

  const clearNote = useCallback(() => setNote(null), []);
  return { mode: store.mode, prices, busy, note, buy, clearNote };
}
