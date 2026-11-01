import { applyCommand } from './commands';
import { DT } from './constants';
import { pruneEvents } from './events';
import type { GameState } from './types';

/** Advances the game by one fixed step. dt must be DT (kept for clarity). */
export function stepGame(s: GameState, dt: number = DT): void {
  if (s.queue.length > 0) {
    const cmds = s.queue;
    s.queue = [];
    for (const c of cmds) applyCommand(s, c);
  }
  s.tick++;
  s.time = s.tick * dt;
  pruneEvents(s);
}

/** Runs whole steps for the given number of seconds (tests, bots, offline). */
export function runFor(s: GameState, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepGame(s, DT);
}
