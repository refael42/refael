/** Staff roles. Adding a role = adding a row (plus i18n keys role.<id> and roleDesc.<id>). */
export type StaffRole = 'atc' | 'fueler' | 'porter' | 'agent';

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
