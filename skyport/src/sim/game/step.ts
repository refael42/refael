import { applyCommand } from './commands';
import { DT } from './constants';
import { pruneEvents } from './events';
import { updateDepartingPax, updateFlights, updateSpawning } from './flights';
import { updatePeople } from './people';
import { updateTerminal } from './terminal';
import { rollIncome } from './income';
import { payWages, updateApplicants, updateStaff, updateStaffLife } from './staff';
import { updateTierBuild } from './tiers';
import { updateAirlines } from './airlines';
import { updateWeather } from './weather';
import { updateBuilds } from './upgrades';
import type { GameState } from './types';
import { updateVehicles } from './vehicles';
import { updateSupplies } from './supplies';
import { updateGoals } from './goals';

/** Advances the game by one fixed step. dt must be DT (kept for clarity). */
export function stepGame(s: GameState, dt: number = DT): void {
  if (s.queue.length > 0) {
    const cmds = s.queue;
    s.queue = [];
    for (const c of cmds) applyCommand(s, c);
  }
  s.tick++;
  s.time = s.tick * dt;
  updateWeather(s);
  updateSpawning(s);
  updateStaff(s);
  updateFlights(s, dt);
  updateDepartingPax(s);
  updateVehicles(s, dt);
  updateSupplies(s, dt);
  updatePeople(s, dt);
  updateTerminal(s, dt);
  payWages(s);
  updateStaffLife(s, dt);
  updateApplicants(s);
  updateAirlines(s);
  updateBuilds(s, dt);
  updateTierBuild(s, dt);
  updateGoals(s);
  rollIncome(s);
  pruneEvents(s);
}

/** Runs whole steps for the given number of seconds (tests, bots, offline). */
export function runFor(s: GameState, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepGame(s, DT);
}
