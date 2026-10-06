import type { GameState } from '../sim/game/types';

/**
 * The running restaurant, for screens opened from outside the game view (the settings' stats).
 * The game view puts its ref here; nothing else writes to it.
 */
export const liveGame: { ref: { current: GameState | null } } = { ref: { current: null } };
