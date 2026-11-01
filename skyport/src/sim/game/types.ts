import type { Big } from '../big';

export type GameEventKind =
  | 'cmdRejected'
  | 'moneyChanged';

export interface GameEvent {
  id: number;
  kind: GameEventKind;
  /** Sim time when it happened. */
  t: number;
  x: number;
  y: number;
  a: number;
  b: number;
  c: number;
}

export type Command = { type: 'debugAddMoney'; amount: number };

export interface GameState {
  version: number;
  seed: number;
  /** RNG state (uint32), advanced by rand(). */
  rng: number;
  tick: number;
  /** Seconds since this game started (sim clock). */
  time: number;
  money: Big;
  diamonds: number;
  events: GameEvent[];
  nextEventId: number;
  /** Commands waiting for the next step. */
  queue: Command[];
}
