// The lucky wheel (owner request: "a cool wheel of fortune"). A free spin every few hours of
// real time, one more for every quest stage cleared, and extra spins for gems. Coin prizes are
// minutes of the restaurant's own recent income (like the daily gift), so a spin matters in
// the first diner and in the last empire alike.

export type WheelPrize =
  /** `minutes` of income in coins. */
  | { kind: 'coins'; minutes: number }
  | { kind: 'gems'; gems: number }
  /** All income x`mult` for `minutes`. */
  | { kind: 'boost'; mult: number; minutes: number }
  /** The big one: coins and gems together. */
  | { kind: 'jackpot'; minutes: number; gems: number };

export interface WheelSegment {
  prize: WheelPrize;
  /** How likely it is, against the other segments' weights. */
  weight: number;
  /** The segment's colors on the wheel: face and the darker edge. */
  color: string;
  edge: string;
}

/** Clockwise from the top. Big and small prizes alternate so every spin passes something exciting. */
export const WHEEL_SEGMENTS: readonly WheelSegment[] = [
  { prize: { kind: 'coins', minutes: 5 }, weight: 24, color: '#E5483B', edge: '#9A2420' },
  { prize: { kind: 'gems', gems: 5 }, weight: 16, color: '#3E6FE0', edge: '#22409A' },
  { prize: { kind: 'coins', minutes: 15 }, weight: 18, color: '#35B957', edge: '#1D7434' },
  { prize: { kind: 'boost', mult: 2, minutes: 10 }, weight: 12, color: '#9B4FD8', edge: '#5E2A8E' },
  { prize: { kind: 'coins', minutes: 30 }, weight: 12, color: '#F28A12', edge: '#A85A08' },
  { prize: { kind: 'gems', gems: 15 }, weight: 8, color: '#1FB5C9', edge: '#117482' },
  { prize: { kind: 'coins', minutes: 60 }, weight: 7, color: '#E0457E', edge: '#972451' },
  { prize: { kind: 'jackpot', minutes: 120, gems: 25 }, weight: 3, color: '#2A1530', edge: '#120818' },
];

export const WHEEL = {
  /** Real hours between free spins (the first one is free at once). */
  freeEveryHours: 4,
  /** Spins stored from cleared stages, at most this many. */
  maxTokens: 5,
  /** An extra spin, any time. */
  gemCost: 20,
  /** The very first spin always lands here (15 gems: a taste of the shop, without flooding the first stand with coins). */
  firstSegment: 5,
  /** Coin prizes are at least this much per minute of income (a brand-new stand earns almost nothing). */
  minPerMinute: 30,
  /** The spin itself, for the screen: whole turns before it settles, and how long it takes. */
  turns: 5,
  spinMs: 4600,
} as const;
