// Worker rarity (owner request: "a legendary shift manager could come along, or a rare waiter,
// common or epic; every worker gets one, and their levels to match"). Every applicant rolls a
// rarity; it lifts their stats and level, they learn faster, and they ask for more. Bigger
// buildings draw better people: the rare kinds come more often there.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface RarityDef {
  /** How often applicants have it (relative) at the first diner. */
  weight: number;
  /** Extra weight per building tier (the better the place, the better the people). */
  perTier: number;
  /** Added to every stat (before the 1..10 clamp) and to the starting level. */
  stats: number;
  levels: number;
  /** XP from every job, times this: they level up faster. */
  xp: number;
  /** Their wage on top of what their stats and level ask for. */
  wage: number;
  /** Card and ring color. */
  color: string;
}

/** The first hires are always common: a gentle start, cheap to sign. */
export const COMMON_FIRST_HIRES = 2;

export const RARITY: Record<Rarity, RarityDef> = {
  common: { weight: 64, perTier: 0, stats: 0, levels: 0, xp: 1, wage: 1, color: '#B8B0C4' },
  rare: { weight: 25, perTier: 2, stats: 1, levels: 1, xp: 1.15, wage: 1.1, color: '#4FA3FF' },
  epic: { weight: 9, perTier: 1.5, stats: 2, levels: 2, xp: 1.3, wage: 1.25, color: '#B45CFF' },
  legendary: { weight: 2, perTier: 0.8, stats: 3, levels: 3, xp: 1.6, wage: 1.45, color: '#FFC233' },
};
