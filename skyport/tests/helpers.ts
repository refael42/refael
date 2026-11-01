import { botCommands, createGame, layoutOf, onRunway, queueCommand, stepGame, type GameState } from '../src/sim';

export interface RunReport {
  phases: Map<number, string[]>;
  maxOnRunway: number;
  maxPeople: number;
  maxFlights: number;
}

/** Runs the game for `seconds` with the bot reacting after `reaction` seconds (null = no player). */
export function play(s: GameState, seconds: number, reaction: number | null = 1, every = 3): RunReport {
  const L = layoutOf(s.tier);
  const phases = new Map<number, string[]>();
  let maxOnRunway = 0;
  let maxPeople = 0;
  let maxFlights = 0;
  const steps = Math.round(seconds * 30);
  for (let i = 0; i < steps; i++) {
    if (reaction !== null && i % every === 0) for (const c of botCommands(s, { reaction })) queueCommand(s, c);
    stepGame(s);
    let r = 0;
    for (const f of s.flights) {
      if (onRunway(f, L)) r++;
      const h = phases.get(f.id) ?? [];
      if (h[h.length - 1] !== f.phase) h.push(f.phase);
      phases.set(f.id, h);
      if (!Number.isFinite(f.x + f.y + f.z + f.heading + f.speed)) throw new Error(`bad flight state ${f.id}`);
    }
    for (const p of s.people) if (!Number.isFinite(p.x + p.y)) throw new Error(`bad person ${p.id}`);
    maxOnRunway = Math.max(maxOnRunway, r);
    maxPeople = Math.max(maxPeople, s.people.length);
    maxFlights = Math.max(maxFlights, s.flights.length);
  }
  return { phases, maxOnRunway, maxPeople, maxFlights };
}

export function newGame(seed = 1): GameState {
  return createGame(seed);
}
