import type { Point } from '../data/maps';
import type { Camera } from '../render/draw/fx';
import type { GameState } from '../sim/game/types';

/**
 * The running restaurant, for screens opened from outside the game view (the settings' stats).
 * The game view puts its ref here; nothing else writes to it. The camera is here too so the
 * browser-only review scripts can tap a spot on the map the way a finger would (and the green
 * tiles of build mode, where a tap places the chosen thing).
 */
export const liveGame: {
  ref: { current: GameState | null };
  camera: { current: Camera } | null;
  freeTiles: { current: Point[] } | null;
} = { ref: { current: null }, camera: null, freeTiles: null };
