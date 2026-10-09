// Real-money purchases (owner decision M28: gem packs on the App Store and Google Play).
// The game never talks to a store directly: it goes through this small interface, so the
// browser and Expo Go (no store there) use a demo store, and a store build that cannot reach
// the store sells nothing at all instead of handing out free gems.

/** A purchase the store says was paid: its product and the store's id for it. */
export interface StoreGrant {
  product: string;
  transaction: string;
}

/** How a tap on "buy" ended. The gems themselves come through `onGrant`, never from here. */
export type BuyResult = 'ok' | 'cancelled' | 'pending' | 'failed';

export interface Store {
  /**
   * `store`: Apple / Google take real money. `demo`: nothing is charged (browser, Expo Go, the
   * owner's dev runs). `off`: a store build whose payments could not start (sells nothing).
   */
  readonly mode: 'store' | 'demo' | 'off';
  /** Connects. Purchases (new ones, and any the store still owes from before) come to `onGrant`. */
  start(onGrant: (grant: StoreGrant) => void): Promise<void>;
  /** The store's price text per product id, in the player's currency (empty until known). */
  prices(): Readonly<Record<string, string>>;
  /** Opens the store's own payment sheet. */
  buy(product: string): Promise<BuyResult>;
  /** Tells the store a purchase was paid out (only after it is saved): it is not sent again. */
  finish(grant: StoreGrant): Promise<void>;
  stop(): void;
}
