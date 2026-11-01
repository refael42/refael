import { applyCommand } from './commands';
import { DT } from './constants';
import { pruneEvents } from './events';
import { updateDepartingPax, updateFlights, updateSpawning } from './flights';
import { updatePeople } from './people';
import { rollIncome } from './income';
import { payWages, updateStaff } from './staff';
import { updateBuilds } from './upgrades';
import type { GameState } from './types';
import { updateVehicles } from './vehicles';

/** Advances the game by one fixed step. dt must be DT (kept for clarity). */
export function stepGame(s: GameState, dt: number = DT): void {
  if (s.queue.length > 0) {
    const cmds = s.queue;
    s.queue = [];
    for (const c of cmds) applyCommand(s, c);
  }
  s.tick++;
  s.time = s.tick * dt;
  updateSpawning(s);
  updateStaff(s);
  updateFlights(s, dt);
  updateDepartingPax(s);
  updateVehicles(s, dt);
  updatePeople(s, dt);
  payWages(s);
  updateBuilds(s, dt);
  rollIncome(s);
  pruneEvents(s);
}

/** Runs whole steps for the given number of seconds (tests, bots, offline). */
export function runFor(s: GameState, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepGame(s, DT);
}
