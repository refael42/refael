import type { Point } from '../src/data/maps';
import { buyUpgrade, finishWork } from '../src/sim/game/purchase';
import type { GameState } from '../src/sim/game/types';

/** Buys an upgrade and, if a crew starts on it, has it done at once (tests about what it does, not how long). */
export function buyNow(s: GameState, id: string, at?: Point): boolean {
  if (!buyUpgrade(s, id, at)) return false;
  const w = s.works.find((x) => x.item === id);
  if (w) {
    s.works = s.works.filter((x) => x !== w);
    finishWork(s, w);
  }
  return true;
}
