// What opens with each bigger building (owner request: "as the restaurant grows, things open up
// for the player: the couriers, the lucky wheel, new tables for more people, more dishes").
// One list, so the banner when a building opens, the "next building" card and the game itself
// all agree on what comes when. `tier` is the index in TIERS (src/data/buildings.ts): the
// diner is 0, the bistro 1, and so on.

export type UnlockId = 'wheel' | 'courier' | 'promoter' | 'family' | 'checker' | 'barSeats' | 'packer' | 'pizza' | 'sushi' | 'steak' | 'cake' | 'lobster';

export interface UnlockDef {
  id: UnlockId;
  tier: number;
  /** Shown next to its name on the banner and the cards. */
  icon: string;
  /** i18n key of its name. */
  name: string;
}

export const UNLOCKS: readonly UnlockDef[] = [
  { id: 'wheel', tier: 1, icon: '🎡', name: 'unlock.wheel' },
  { id: 'courier', tier: 1, icon: '🛵', name: 'unlock.courier' },
  { id: 'promoter', tier: 1, icon: '📣', name: 'role.promoter' },
  { id: 'family', tier: 2, icon: '🍽️', name: 'unlock.family' },
  { id: 'checker', tier: 2, icon: '✅', name: 'role.checker' },
  { id: 'barSeats', tier: 2, icon: '🍸', name: 'unlock.barSeats' },
  { id: 'pizza', tier: 2, icon: '🍕', name: 'dish.pizza' },
  { id: 'packer', tier: 3, icon: '📦', name: 'unlock.packer' },
  { id: 'sushi', tier: 3, icon: '🍣', name: 'dish.sushi' },
  { id: 'steak', tier: 4, icon: '🥩', name: 'dish.steak' },
  { id: 'cake', tier: 5, icon: '🎂', name: 'dish.cake' },
  { id: 'lobster', tier: 6, icon: '🦞', name: 'dish.lobster' },
];

export const UNLOCK_TIER = Object.fromEntries(UNLOCKS.map((u) => [u.id, u.tier])) as Record<UnlockId, number>;

/** What opens with this building. */
export const unlocksAt = (tier: number): UnlockDef[] => UNLOCKS.filter((u) => u.tier === tier);
