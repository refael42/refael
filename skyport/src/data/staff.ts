/** Staff roles. Adding a role = adding a row (plus i18n keys role.<id> and roleDesc.<id>). */
export type StaffRole = 'atc' | 'fueler' | 'porter' | 'agent' | 'mechanic';

export interface StaffRoleDef {
  id: StaffRole;
  unlockTier: number;
  /** One-time hiring fee (coins). */
  hireCost: number;
  /** Paid at the end of every game day (coins). */
  wage: number;
  /** Seconds before an average worker reacts to a request. */
  reaction: number;
  /** Outfit drawn for this role (render/art/people.ts). */
  outfit: string;
}

export const STAFF_ROLES: readonly StaffRoleDef[] = [
  { id: 'atc', unlockTier: 1, hireCost: 150, wage: 40, reaction: 2.2, outfit: 'atc' },
  { id: 'fueler', unlockTier: 1, hireCost: 90, wage: 25, reaction: 1.8, outfit: 'fueler' },
  { id: 'porter', unlockTier: 1, hireCost: 70, wage: 20, reaction: 1.8, outfit: 'crew' },
  { id: 'agent', unlockTier: 1, hireCost: 60, wage: 18, reaction: 1.6, outfit: 'agent' },
  { id: 'mechanic', unlockTier: 3, hireCost: 900, wage: 140, reaction: 2.4, outfit: 'mechanic' },
];

export function roleIndex(id: StaffRole): number {
  return STAFF_ROLES.findIndex((r) => r.id === id);
}

/** Staff names in both scripts (index pairs are chosen by hash). */
export const FIRST_NAMES: readonly { en: string; he: string }[] = [
  { en: 'Noa', he: 'נועה' },
  { en: 'Ariel', he: 'אריאל' },
  { en: 'Maya', he: 'מאיה' },
  { en: 'Yoni', he: 'יוני' },
  { en: 'Tamar', he: 'תמר' },
  { en: 'Omer', he: 'עומר' },
  { en: 'Shira', he: 'שירה' },
  { en: 'Eitan', he: 'איתן' },
  { en: 'Lia', he: 'ליה' },
  { en: 'Daniel', he: 'דניאל' },
  { en: 'Yael', he: 'יעל' },
  { en: 'Ido', he: 'עידו' },
  { en: 'Rina', he: 'רינה' },
  { en: 'Amir', he: 'אמיר' },
  { en: 'Gal', he: 'גל' },
  { en: 'Lior', he: 'ליאור' },
];

export const LAST_NAMES: readonly { en: string; he: string }[] = [
  { en: 'Cohen', he: 'כהן' },
  { en: 'Levi', he: 'לוי' },
  { en: 'Mizrahi', he: 'מזרחי' },
  { en: 'Peretz', he: 'פרץ' },
  { en: 'Biton', he: 'ביטון' },
  { en: 'Friedman', he: 'פרידמן' },
  { en: 'Azoulay', he: 'אזולאי' },
  { en: 'Katz', he: 'כץ' },
  { en: 'Shapiro', he: 'שפירא' },
  { en: 'Golan', he: 'גולן' },
  { en: 'Ben-David', he: 'בן דוד' },
  { en: 'Navon', he: 'נבון' },
];

/** Rarity: rarer people are faster, start at a higher level, and cost more. */
export interface RarityDef {
  id: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  weight: number;
  statMul: number;
  levels: readonly [number, number];
  wageMul: number;
  color: string;
}

export const RARITIES: readonly RarityDef[] = [
  { id: 'common', weight: 60, statMul: 1.0, levels: [1, 2], wageMul: 1.0, color: '#64748b' },
  { id: 'rare', weight: 26, statMul: 1.12, levels: [2, 4], wageMul: 1.3, color: '#3b82f6' },
  { id: 'epic', weight: 10, statMul: 1.25, levels: [3, 6], wageMul: 1.7, color: '#8b5cf6' },
  { id: 'legendary', weight: 3.5, statMul: 1.42, levels: [5, 9], wageMul: 2.4, color: '#f59e0b' },
  { id: 'mythic', weight: 0.5, statMul: 1.65, levels: [8, 12], wageMul: 3.2, color: '#ec4899' },
];

/** Personality traits (good and not so good). */
export type TraitId = 'diligent' | 'clumsy' | 'charming' | 'nightOwl' | 'gossip' | 'workaholic';

export interface TraitDef {
  id: TraitId;
  /** Relative chance to appear. */
  weight: number;
  good: boolean;
}

export const TRAITS: readonly TraitDef[] = [
  { id: 'diligent', weight: 3, good: true },
  { id: 'charming', weight: 3, good: true },
  { id: 'nightOwl', weight: 2, good: true },
  { id: 'workaholic', weight: 2, good: true },
  { id: 'clumsy', weight: 2, good: false },
  { id: 'gossip', weight: 2, good: false },
];

/** Talents bought with talent points (one point per level-up), max 5 each. */
export const TALENTS = ['speed', 'stamina', 'precision', 'charm', 'efficiency', 'loyalty'] as const;
export type TalentId = (typeof TALENTS)[number];
export const TALENT_MAX = 5;

/** Number of CV one-liners (i18n keys cv.0 .. cv.N-1). */
export const CV_LINES = 12;
