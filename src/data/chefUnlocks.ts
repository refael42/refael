import { DESSERTS } from './desserts';
import type { ChefUnlock } from './chef';

// What the chef's levels open (src/data/chef.ts), in level order. A level without a line still
// pays its reward. The desserts (owner M45: "each dessert by the player's level").

export const CHEF_UNLOCKS: readonly ChefUnlock[] = DESSERTS.map((d) => ({ level: d.level, kind: 'dessert' as const, id: d.id, name: d.nameKey, icon: `dessert_${d.id}` })).sort((a, b) => a.level - b.level);
