// The golden pan (owner: idea 7, "a rhythm mini-game at rush hour: tap in time to make a dish,
// and a bonus if you do"). Now and then, while the kitchen is busy, a golden pan sparkles on a
// stove. Tap it: a short timing game (a needle sweeps a bar; tap while it is in the green zone,
// three times, the zone smaller each time). Every good tap is a perfect flip: the kitchen cooks
// faster for a while and the restaurant gets coins. Rules in src/sim/flip.ts; the game itself in
// src/ui/FlipGame.tsx.

export const FLIP = {
  /** First after this many guests served; then every this many seconds (sim), at random in the range. */
  firstServed: 15,
  every: [140, 220] as readonly [number, number],
  /** Only when the kitchen has at least this many orders waiting (a rush is when it matters). */
  minOrders: 3,
  /** The pan waits this long for a tap. */
  staysSeconds: 25,
  /** The three rounds: the green zone's width (share of the bar) and the needle's sweep (seconds end to end). */
  rounds: [
    { zone: 0.26, sweep: 1.3 },
    { zone: 0.19, sweep: 1.05 },
    { zone: 0.13, sweep: 0.85 },
  ] as readonly { zone: number; sweep: number }[],
  /** Per perfect flip: the cooks' speed (+25% each) for this long, and seconds of income in coins. */
  speedPerHit: 0.25,
  speedSeconds: 25,
  coinSecondsPerHit: 40,
  /** A clean sweep (all three): gems on top. */
  perfectGems: 2,
} as const;
