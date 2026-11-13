import { applyCommand } from './commands';
import { DT } from './constants';
import { pruneEvents } from './events';
import { spawnFlight, updateDepartingPax, updateFlights, updateSpawning } from './flights';
import { updateIncidents } from './incidents';
import { updatePeople } from './people';
import { updateBuses } from './buses';
import { updateApm } from './apm';
import { updateRail } from './rail';
import { updateCleaning } from './cleaning';
import { updateGuards } from './security';
import { updateTower } from './tower';
import { layoutOf } from './layout';
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
import { updateGuide } from './guide';
import { updateCareer } from './career';
import { updateFestival } from './festival';
import { updateLand } from './land';

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
  updateIncidents(s, dt, (p) => spawnFlight(s, p));
  updateSpawning(s);
  updateStaff(s);
  updateTower(s);
  updateFlights(s, dt);
  updateDepartingPax(s);
  updateVehicles(s, dt);
  updateSupplies(s, dt);
  updatePeople(s, dt);
  updateBuses(s, dt);
  updateApm(s, dt);
  updateRail(s, layoutOf(s.tier).rail);
  updateTerminal(s, dt);
  updateCleaning(s, dt);
  updateGuards(s, dt);
  payWages(s);
  updateStaffLife(s, dt);
  updateApplicants(s);
  updateAirlines(s);
  updateBuilds(s, dt);
  updateTierBuild(s, dt);
  updateGoals(s);
  updateGuide(s);
  updateCareer(s);
  updateFestival(s);
  updateLand(s);
  rollIncome(s);
  pruneEvents(s);
}

/** Runs whole steps for the given number of seconds (tests, bots, offline). */
export function runFor(s: GameState, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepGame(s, DT);
}
