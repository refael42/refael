// Talents (owner M46: "skills for the workers, speed, mood and so on, and skill points you have
// to earn, from the lucky wheel, quests and all sorts of things"). A worker's talents sit on top
// of their stats: each one has a few levels, a level costs talent points, and the points are the
// player's own (like gems): earned from chef levels, quests, the wheel, the daily gift and the
// guide, or bought for gems. How many levels a worker can hold grows with their level.

export type TalentId = 'quick' | 'mood' | 'fit' | 'craft' | 'charisma' | 'loyal';
export const TALENT_IDS: readonly TalentId[] = ['quick', 'mood', 'fit', 'craft', 'charisma', 'loyal'];

export type TalentLevels = Partial<Record<TalentId, number>>;

export interface TalentDef {
  id: TalentId;
  /** The house icon on its row (src/render/art/menuIcons.ts, src/ui/GameIcon.tsx). */
  icon: string;
  /** Its color on the card (the pips and the button). */
  color: string;
}

export const TALENTS: Record<TalentId, TalentDef> = {
  quick: { id: 'quick', icon: 'iconBolt', color: '#FFC233' },
  mood: { id: 'mood', icon: 'iconSmile', color: '#FF6FA8' },
  fit: { id: 'fit', icon: 'iconLeaf', color: '#5CD66E' },
  craft: { id: 'craft', icon: 'iconChef', color: '#4FA3FF' },
  charisma: { id: 'charisma', icon: 'iconCrown', color: '#B45CFF' },
  loyal: { id: 'loyal', icon: 'iconHeart', color: '#FF5A6E' },
};

export const TALENT = {
  /** Levels per talent. */
  max: 5,
  /** Talent levels a worker can hold in all: this many, plus one per worker level. */
  slotsBase: 1,
  /** Level n of a talent costs n points (1 + 2 + ... + 5 = 15 to fill one). */
  costPerLevel: 1,
  /** Per level: work 4% faster. */
  quick: 0.04,
  /** Per level: morale falls 15% less, and every payday lifts it a little more. */
  moodShield: 0.15,
  moodPayday: 0.02,
  /** Per level: energy drains 12% slower and comes back 10% faster. */
  fitDrain: 0.12,
  fitRecover: 0.1,
  /** Per level: 3% more on what they make (cooks, bartenders, the checker) and on their charm. */
  craft: 0.03,
  charisma: 0.03,
  /** Per level: 4% off their wage, and 20% fewer raise requests; at the top level they never quit over morale. */
  loyalWage: 0.04,
  loyalRaise: 0.2,
  /** Points a new restaurant starts with (the first come with chef level 2, a minute or two in), and what a save from before talents gets once. */
  start: 0,
  welcome: 3,
  /** Taking a worker's talents back costs gems; firing someone gives every point back, a worker who quits takes half. */
  resetGems: 10,
  quitKeeps: 0.5,
  /** Where points come from. */
  points: {
    /** Every chef level, and more on a chest level. */
    chefLevel: 1,
    chefChest: 3,
    /** Every restaurant (quest) level. */
    questLevel: 1,
    /** The first time this restaurant wins each guide mark (the plate, one, two, three stars). */
    guide: [2, 5, 5, 5] as readonly number[],
    /** The daily gift's are in src/data/retention.ts, the wheel's in src/data/wheel.ts, the shop's in src/data/shop.ts. */
  },
} as const;

/** Points the next level of a talent costs (it is at `level` now). */
export const talentCost = (level: number): number => (level + 1) * TALENT.costPerLevel;

/** Every point spent on these levels. */
export function talentSpent(t: TalentLevels | undefined): number {
  if (!t) return 0;
  let sum = 0;
  for (const id of TALENT_IDS) {
    const lv = t[id] ?? 0;
    for (let k = 0; k < lv; k++) sum += talentCost(k);
  }
  return sum;
}

/** Talent levels held in all. */
export const talentCount = (t: TalentLevels | undefined): number => (t ? TALENT_IDS.reduce((sum, id) => sum + (t[id] ?? 0), 0) : 0);

/** How many talent levels a worker of this level can hold. */
export const talentSlots = (level: number): number => TALENT.slotsBase + Math.max(1, level);

export type TalentBlock = null | 'max' | 'slots' | 'points' | 'leaving';

/** Why a worker cannot take the next level of a talent (null: they can), from what the staff card knows too. */
export function talentBlockOf(w: { talents?: TalentLevels; level: number; leaving?: boolean }, id: TalentId, points: number): TalentBlock {
  if (w.leaving) return 'leaving';
  const lv = w.talents?.[id] ?? 0;
  if (lv >= TALENT.max) return 'max';
  if (talentCount(w.talents) >= talentSlots(w.level)) return 'slots';
  if (points < talentCost(lv)) return 'points';
  return null;
}
