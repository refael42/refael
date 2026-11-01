/**
 * The running game session on the JS thread: owns the GameState, steps it at
 * a fixed rate from the frame loop, and hands out new events to the UI.
 */
import {
  createGame,
  DT,
  eventsSince,
  queueCommand,
  stepGame,
  type Command,
  type GameEvent,
  type GameState,
} from '../../sim';

/** Most sim steps per frame (avoid the spiral of death after a stall). */
const MAX_STEPS = 10;

export class GameController {
  state: GameState;
  private acc = 0;
  private lastEventId = 0;
  /** Game speed multiplier (debug / tests). */
  speed = 1;

  constructor(seed: number, state?: GameState) {
    this.state = state ?? createGame(seed);
  }

  /** Advances by real elapsed ms; returns the interpolation alpha. */
  tick(dtMs: number): number {
    this.acc += (dtMs / 1000) * this.speed;
    let steps = 0;
    while (this.acc >= DT && steps < MAX_STEPS * this.speed) {
      stepGame(this.state, DT);
      this.acc -= DT;
      steps++;
    }
    if (this.acc > DT * 2) this.acc = DT * 2;
    return Math.max(0, Math.min(1, this.acc / DT));
  }

  send(cmd: Command): void {
    queueCommand(this.state, cmd);
  }

  /** Events the UI has not seen yet. */
  takeEvents(): GameEvent[] {
    const ev = eventsSince(this.state, this.lastEventId);
    if (ev.length) this.lastEventId = ev[ev.length - 1].id;
    return ev;
  }
}
