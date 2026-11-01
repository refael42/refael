import { Big } from '../big';
import { normalizeSeed } from '../rng';
import { SAVE_VERSION } from './constants';
import type { GameState } from './types';

export function createGame(seed: number): GameState {
  const s = normalizeSeed(seed);
  return {
    version: SAVE_VERSION,
    seed: s,
    rng: s,
    tick: 0,
    time: 0,
    money: Big.fromNumber(0),
    diamonds: 0,
    events: [],
    nextEventId: 1,
    queue: [],
  };
}
