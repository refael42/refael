/**
 * A simple player: answers every request after a reaction delay. Used by
 * tests and the balance script (pure, deterministic).
 */
import { STAFF_ROLES } from '../../data/staff';
import { MAX_PER_ROLE, staffCount } from './staff';
import { bestOffer } from './upgrades';
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
      case WANT.bags:
        out.push({ type: 'sendBags', flightId: f.id });
        break;
    }
    // also handle a second pending service at the stand
    if (f.want === WANT.bags && (f.wants & (1 << WANT.fuel)) !== 0) out.push({ type: 'sendFuel', flightId: f.id });
  }
  return out;
}

/** Hires the cheapest useful worker when there is comfortable money. */
export function botHires(s: GameState, keep = 1.3): Command[] {
  const order = ['porter', 'agent', 'fueler', 'atc'];
  for (const id of order) {
    const role = STAFF_ROLES.findIndex((r) => r.id === id);
    if (role < 0 || staffCount(s, role) >= 1) continue;
    const a = s.applicants.find((x) => x.role === role);
    if (a && s.money.gte(a.cost * keep)) return [{ type: 'hire', applicantId: a.id }];
    return [];
  }
  void MAX_PER_ROLE;
  return [];
}

/** Buys the best-value upgrade it can afford (keeps a small reserve for staff). */
export function botBuys(s: GameState): Command[] {
  const o = bestOffer(s, true);
  if (!o) return [];
  return [{ type: 'buyUpgrade', id: o.id, count: 1 }];
}
