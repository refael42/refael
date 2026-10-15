// Deliveries (owner request: "deliveries, add them"). Once a courier is on the team, orders
// come in by phone/app: the kitchen cooks them like any other (into a takeaway bag, no plate),
// the courier carries the bag from the pass to the scooter on the sidewalk, rides off and comes
// back with the money. More couriers = more orders; the cooks become the limit.

export const DELIVERY = {
  /** Orders a minute per courier (at 3 stars; every star moves it by `perStar`). */
  perMinute: 1.6,
  perStar: 0.15,
  /** Orders waiting (not yet out the door) per courier, at most. */
  waitingPerCourier: 2,
  /** A delivery costs more than eating in (the delivery fee). */
  priceMult: 1.35,
  /** Tip share of the bill (times the courier's charm and the restaurant's tip upgrades). */
  tip: 0.12,
  /** The ride there and back (seconds at speed 5; the courier's speed shortens it). */
  tripSeconds: 16,
  /** Packing the bags at the pass. */
  packSeconds: 0.6,
  /** From this courier level the bag holds two orders. */
  bigBagLevel: 3,
  /** An order nobody took out in this long is cancelled (and the rating dips a little). */
  cancelSeconds: 120,
  cancelRating: -0.02,
  /** The scooter's drive off and back in on screen (s). */
  driveSeconds: 2,
};

/**
 * The packing corner (owner request: "a place that packs, connected with the deliveries, where
 * online orders come in, workers pack them and hand them to the courier through a window").
 * It opens with a bigger building (src/data/unlocks.ts): packers take the delivery bags off the
 * pass, pack them at the counter by the front wall, and leave them on the takeaway window's
 * shelf; couriers take them from outside, without walking through the kitchen.
 */
export const PACKING = {
  /** Packing one order (seconds at speed 5). */
  seconds: 2.2,
  /** Lifting the food box off the pass. */
  takeSeconds: 0.4,
  /** A cold drink out of the drinks fridge for the bag. */
  fridgeSeconds: 0.5,
  /** The bag handed out through the window into the courier's hands (its flight on screen). */
  windowSeconds: 0.6,
  /** Packed orders sell for a little more (sealed, neat, still hot). */
  priceMult: 1.1,
  /** Bags the shelf shows at most (more wait there, drawn as this many). */
  shelfShown: 4,
};

/**
 * The delivery hub (owner M30: "a grander delivery station that really grows, more things open
 * as you level up"): the packing station's levels add a piece at a time, along the kitchen's
 * front row and then outside, and every piece brings something. The pieces wait as faint
 * outlines (with a lock) until their level.
 *  - `inside`: in the kitchen's front row, this many tiles past the drinks fridge (they block
 *    the tile); otherwise out front: the sign by the takeaway window, the chargers at the
 *    scooters, the lockers on the wall.
 *  - perks: `packers` more packers' posts (the piece is a counter with its own packer),
 *    `deliveryPrice` / `deliveryDemand` / `tripSpeed` multiply, `couriers` more couriers' places.
 */
export const HubPiece = { Counter: 0, BagWall: 1, OrderScreen: 2, GoldCounter: 3, Sign: 4, Chargers: 5, Lockers: 6 } as const;
export type HubPiece = (typeof HubPiece)[keyof typeof HubPiece];

export interface HubStage {
  piece: HubPiece;
  level: number;
  /** Tiles past the drinks fridge in the kitchen's front row (inside pieces only). */
  inside?: number;
  perk: { packers?: number; deliveryPrice?: number; deliveryDemand?: number; tripSpeed?: number; couriers?: number };
  /** i18n keys: its name and what it brings. */
  name: string;
  gives: string;
}

export const HUB: readonly HubStage[] = [
  { piece: HubPiece.Counter, level: 10, inside: 1, perk: { packers: 1 }, name: 'hub.counter', gives: 'hub.counter.gives' },
  { piece: HubPiece.BagWall, level: 25, inside: 2, perk: { deliveryPrice: 1.15 }, name: 'hub.bagWall', gives: 'hub.bagWall.gives' },
  { piece: HubPiece.OrderScreen, level: 50, inside: 3, perk: { deliveryDemand: 1.25 }, name: 'hub.screen', gives: 'hub.screen.gives' },
  { piece: HubPiece.GoldCounter, level: 75, inside: 4, perk: { packers: 1 }, name: 'hub.goldCounter', gives: 'hub.goldCounter.gives' },
  { piece: HubPiece.Sign, level: 100, perk: { deliveryDemand: 1.2, deliveryPrice: 1.1 }, name: 'hub.sign', gives: 'hub.sign.gives' },
  { piece: HubPiece.Chargers, level: 150, perk: { tripSpeed: 1.25 }, name: 'hub.chargers', gives: 'hub.chargers.gives' },
  { piece: HubPiece.Lockers, level: 200, perk: { couriers: 1, deliveryPrice: 1.15 }, name: 'hub.lockers', gives: 'hub.lockers.gives' },
];

/** How many hub pieces a packing-station level has opened. */
export const hubStage = (level: number): number => HUB.filter((h) => level >= h.level).length;
