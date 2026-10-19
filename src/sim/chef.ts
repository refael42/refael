import { CHEF, levelReward, xpNeed } from '../data/chef';
import { CHEF_UNLOCKS } from '../data/chefUnlocks';
import { emit, Ev } from './game/events';
import type { GameState } from './game/types';
import { grantCoins, incomeRate } from './shop';
import { grantTalentPoints } from './game/talents';

// The chef's level (owner: "like Hay Day"): experience comes in from serving, buying, hiring,
// quests and the guide; each level pays gems and coins (a chest every few) and may open
// something new (src/data/chefUnlocks.ts). The level is the player's: it goes with every branch.

export interface ChefState {
  level: number;
  /** Experience toward the next level. */
  xp: number;
  /** Levels reached that the player has not seen the card of yet (the UI shows them one by one). */
  pending: number[];
}

export const newChef = (): ChefState => ({ level: 1, xp: 0, pending: [] });

export type XpSource = Exclude<keyof typeof CHEF.xp, 'upgradeMax'>;

/** Experience for something done (`count` of them); levels up as often as it fills. */
export function gainXp(s: GameState, source: XpSource, count = 1): void {
  const per = CHEF.xp[source];
  const n = source === 'upgrade' ? Math.min(count, CHEF.xp.upgradeMax) : count;
  if (per <= 0 || n <= 0) return;
  const c = s.chef;
  c.xp += per * n;
  while (c.xp >= xpNeed(c.level)) {
    c.xp -= xpNeed(c.level);
    c.level += 1;
    levelUp(s, c.level);
  }
}

/** A new level: its gems, its coins, a chest's boost, the card to show. */
function levelUp(s: GameState, level: number): void {
  const r = levelReward(level);
  s.gems += r.gems;
  grantTalentPoints(s, r.talent, true);
  const coins = incomeRate(s).mul(r.minutes * 60).floor();
  grantCoins(s, coins);
  if (r.chest) {
    const b = CHEF.chestBoost;
    const left = Math.max(0, s.boost.until - s.time);
    s.boost = { mult: Math.max(b.mult, s.boost.mult), until: s.time + left + b.minutes * 60 };
  }
  s.chef.pending.push(level);
  if (s.chef.pending.length > 5) s.chef.pending.shift();
  emit(s, Ev.ChefLevel, 0, 0, level, coins.toNumber(), r.gems);
}

/** The player saw the card of this level. */
export function seenLevel(s: GameState, level: number): void {
  s.chef.pending = s.chef.pending.filter((l) => l !== level);
}

/** Is this unlock open at the chef's level? */
export const isOpen = (s: GameState, id: string): boolean => {
  const u = CHEF_UNLOCKS.find((x) => x.id === id);
  return !u || s.chef.level >= u.level;
};

/** What `level` opens. */
export const opensAt = (level: number) => CHEF_UNLOCKS.filter((u) => u.level === level);

/** The next levels that open something, from the level after this one. */
export const upcoming = (level: number, count: number) => CHEF_UNLOCKS.filter((u) => u.level > level).slice(0, count);
