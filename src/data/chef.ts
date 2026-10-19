import { TALENT } from './talents';

// The chef's level (owner: "grow the game, more levels and more things that open, like Hay
// Day"): experience from everything the restaurant does, a level after level with no end, a
// reward at every one and something new to open every few. How it plays: src/sim/chef.ts.

export const CHEF = {
  /** Experience for each thing done. */
  xp: {
    /** A guest who paid; one more for five stars. A delivery brought home. */
    served: 1,
    fiveStar: 1,
    delivery: 1,
    /** A level bought (a big bulk buy counts up to `upgradeMax` of them). */
    upgrade: 1,
    upgradeMax: 5,
    /** A worker hired, a quest stage done, the guide's inspector came, a guide star won, a new building. */
    hire: 4,
    stage: 15,
    inspector: 8,
    star: 40,
    building: 60,
  },
  /** Experience the next level needs: `base` times the level to the `power`. */
  need: { base: 12, power: 1.45 },
  /** Every level: gems, and coins worth minutes of the restaurant's income. */
  gems: { base: 2, perFive: 1 },
  minutes: { base: 0, perFour: 1 },
  /** Every few levels a chest: more gems and a double income for a while. */
  chestEvery: 5,
  chestGems: 10,
  chestBoost: { mult: 2, minutes: 5 },
} as const;

/** Experience from `level` to the next. */
export const xpNeed = (level: number): number => Math.round(CHEF.need.base * Math.max(1, level) ** CHEF.need.power);

/** What reaching `level` gives (before what it opens). */
export function levelReward(level: number): { gems: number; minutes: number; chest: boolean; talent: number } {
  const chest = level % CHEF.chestEvery === 0;
  return {
    talent: chest ? TALENT.points.chefChest : TALENT.points.chefLevel,
    gems: CHEF.gems.base + Math.floor(level / 5) * CHEF.gems.perFive + (chest ? CHEF.chestGems : 0),
    minutes: CHEF.minutes.base + Math.floor(level / 4) * CHEF.minutes.perFour,
    chest,
  };
}

/** Something a level opens (src/data/chefUnlocks.ts lists them). */
export interface ChefUnlock {
  level: number;
  /** What kind of thing: a dessert on the menu, a feature of the restaurant. */
  kind: 'dessert' | 'feature';
  /** Its id in its own table (a dessert's id, a feature's id). */
  id: string;
  /** i18n key of its name, and the HUD icon (or a sprite, for desserts) that shows it. */
  name: string;
  icon: string;
}
