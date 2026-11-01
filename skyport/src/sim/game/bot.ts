/**
 * A simple player: answers every request after a reaction delay. Used by
 * tests and the balance script (pure, deterministic).
 */
import { WANT, type Command, type GameState } from './types';

export interface BotOptions {
  /** Seconds before reacting to a request. */
  reaction: number;
}

export function botCommands(s: GameState, opts: BotOptions = { reaction: 1 }): Command[] {
  const out: Command[] = [];
  const freeStands = s.stands.filter((st) => st.occupant === 0 && st.reserved === 0).length;
  let standsLeft = freeStands;
  for (const f of s.flights) {
    if (f.want === WANT.none || s.time - f.readyAt < opts.reaction) continue;
    switch (f.want) {
      case WANT.clearLanding:
        if (standsLeft > 0) {
          out.push({ type: 'clearLanding', flightId: f.id });
          standsLeft--;
        }
        break;
      case WANT.fuel:
        out.push({ type: 'sendFuel', flightId: f.id });
        break;
      case WANT.board:
        out.push({ type: 'startBoarding', flightId: f.id });
        break;
      case WANT.clearTakeoff:
        out.push({ type: 'clearTakeoff', flightId: f.id });
        break;
    }
  }
  return out;
}
