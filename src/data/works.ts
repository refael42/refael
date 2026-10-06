import type { DecorId } from './decor';

// Big upgrades take time (owner request: "so the game doesn't race ahead"). A big level — a
// station's milestone (new look), a new recipe, the second stove, a showpiece, the next
// building — is paid at once but a crew works on it for a while before it counts. Small levels
// stay instant. The wait can be cut by tapping the work site or skipped with gems.

export const WORKS = {
  /** Jobs that can run at the same time from the start (the shop sells one more crew). */
  crews: 2,
  /** Seconds per milestone by its number (1st = level 10, then 25, 50, 75, 100), and every later one. */
  milestone: [10, 30, 60, 120, 180],
  laterMilestone: 240,
  /** A new recipe, by dish id (fries is on the menu from the start). */
  recipe: [0, 20, 45, 60, 90, 120, 180, 240],
  /** The next building, by the tier it opens. */
  building: [0, 120, 300, 480, 600, 720, 900],
  /** Decor placed by a crew (the small pieces go down at once). */
  place: { aquarium: 30, statue: 45, fountain: 90, piano: 120 } as Partial<Record<DecorId, number>>,
  /** The second stove. */
  stove: 20,
  /** The next restaurant level: `base` plus `per` for every level already reached, at most `max`. */
  rank: { base: 180, per: 120, max: 900 },
  /** A tap on the work site takes off this share of the whole job (at least `tapMin` seconds)... */
  tapShare: 0.004,
  tapMin: 0.5,
  /** ...and counts at most this often: tapping helps, it does not replace the wait. */
  tapEvery: 0.25,
  /** Finishing now costs one gem per this many seconds left (one gem at least). */
  gemSeconds: 30,
} as const;

/** Bulk buying in the upgrade lists (owner request): one, ten, a hundred, or all you can pay for. */
export const BULK_STEPS = [1, 10, 100, 'max'] as const;
export type BulkStep = (typeof BULK_STEPS)[number];
