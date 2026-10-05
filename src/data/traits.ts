import type { StatId } from './staff';

// Personality traits: 1-2 per person. Stat tweaks live here; the behaviors (dropping plates,
// working faster at night...) are implemented by the systems that check for the trait.

export type TraitId = 'perfectionist' | 'clumsy' | 'charmer' | 'nightOwl' | 'gossip' | 'workaholic' | 'cheerful';

export interface TraitDef {
  id: TraitId;
  weight: number;
  /** Shown green (helps) or red (hurts) on the cards; mixed traits count as good. */
  good: boolean;
  stats?: Partial<Record<StatId, number>>;
  /** Wage ask multiplier. */
  wage?: number;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  perfectionist: { id: 'perfectionist', weight: 3, good: true, stats: { quality: 2, speed: -1 } },
  clumsy: { id: 'clumsy', weight: 3, good: false },
  charmer: { id: 'charmer', weight: 3, good: true, stats: { charm: 2 } },
  nightOwl: { id: 'nightOwl', weight: 2, good: true },
  gossip: { id: 'gossip', weight: 2, good: false },
  workaholic: { id: 'workaholic', weight: 2, good: true },
  cheerful: { id: 'cheerful', weight: 3, good: true, stats: { speed: -1, quality: -1, charm: -1 }, wage: 0.65 },
};

export const TRAIT_LIST: readonly TraitDef[] = Object.values(TRAITS);

/** Trait behavior numbers. */
export const TRAIT_FX = {
  /** Clumsy waiters drop this share of the dishes they carry. */
  clumsyDrop: 0.06,
  /** Charmers' customers tip this much more. */
  charmerTips: 0.2,
  /** Night owls work this much faster after `nightFrom` of the day. */
  nightOwlBonus: 0.25,
  nightFrom: 0.6,
  /** Workaholics ask for raises this many times as often. */
  workaholicRaises: 2,
} as const;
