import { UNLOCK_TIER, type UnlockId } from '../data/unlocks';
import type { GameState } from './game/types';

/**
 * Has this restaurant's building opened it yet (src/data/unlocks.ts)? The lucky wheel stays
 * open in every branch once the first restaurant got it (a new city starts in a small diner,
 * but the player already knows it).
 */
export function isOpen(s: GameState, id: UnlockId): boolean {
  if (s.map.tier >= UNLOCK_TIER[id]) return true;
  return id === 'wheel' && s.city > 0;
}
