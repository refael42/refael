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
  /** The bag handed out through the window into the courier's hands (its flight on screen). */
  windowSeconds: 0.6,
  /** Packed orders sell for a little more (sealed, neat, still hot). */
  priceMult: 1.1,
  /** Bags the shelf shows at most (more wait there, drawn as this many). */
  shelfShown: 4,
};
