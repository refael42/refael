/**
 * A simple player: answers every request after a reaction delay. Used by
 * tests and the balance script (pure, deterministic).
 */
import { storeActive, storeIndex, STORE_KINDS } from './supplies';
import { STAFF_ROLES } from '../../data/staff';
import { MAX_PER_ROLE, staffCount } from './staff';
import { checkTier } from './tiers';
import { addedPerDay, airportCapacity, canExpand, contractSlots, flightsPerDay } from './airlines';
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
      case WANT.repair:
        out.push({ type: 'repair', flightId: f.id });
        // the other services can go on meanwhile
        if ((f.wants & (1 << WANT.bags)) !== 0) out.push({ type: 'sendBags', flightId: f.id });
        break;
    }
    // also handle a second pending service at the stand
    if (f.want === WANT.bags && (f.wants & (1 << WANT.fuel)) !== 0) out.push({ type: 'sendFuel', flightId: f.id });
  }
  return out;
}

/**
 * Hires for empty roles first (best speed for the price), then a second
 * controller once there are several stands; spends talent points on speed,
 * confirms good trials and accepts raises it can afford.
 */
export function botHires(s: GameState, keep = 1.3): Command[] {
  const out: Command[] = [];
  for (const m of s.staff) {
    if (m.points > 0) out.push({ type: 'talent', staffId: m.id, talent: m.talents[0] < 5 ? 0 : m.talents[4] < 5 ? 4 : 1 });
    if (m.raise > 0) out.push({ type: 'answerRaise', staffId: m.id, answer: s.money.gte(m.raise * 20) ? 1 : 2 });
    if (m.trialUntil === 1) out.push({ type: 'confirmTrial', staffId: m.id, keep: true });
  }
  const order = ['porter', 'agent', 'fueler', 'atc'];
  const wants = order.map((id) => STAFF_ROLES.findIndex((r) => r.id === id));
  if (s.standsBuilt >= 2) wants.push(STAFF_ROLES.findIndex((r) => r.id === 'atc'));
  const counted = new Map<number, number>();
  for (const role of wants) {
    if (role < 0) continue;
    const need = (counted.get(role) ?? 0) + 1;
    counted.set(role, need);
    if (staffCount(s, role) >= need) continue;
    const pool = s.applicants.filter((a) => a.role === role && s.money.gte(a.cost * keep));
    if (pool.length === 0) return out;
    pool.sort((a, b) => b.speed / Math.sqrt(b.wage) - a.speed / Math.sqrt(a.wage));
    out.push({ type: 'hire', applicantId: pool[0].id });
    return out;
  }
  void MAX_PER_ROLE;
  return out;
}

/**
 * Airline manager: signs the offer that brings the most money per day while
 * there is a free slot, and asks happy airlines for more flights.
 */
export function botAirlines(s: GameState): Command[] {
  const out: Command[] = [];
  const room = airportCapacity(s) - flightsPerDay(s);
  for (const c of s.contracts) {
    const rate = c.last.length ? c.last.reduce((a, b) => a + b, 0) / c.last.length : 0;
    if (canExpand(s, c) && rate >= 0.9 && room > 4) out.push({ type: 'expandContract', airline: c.al });
  }
  if (s.offers.length > 0 && s.contracts.length < contractSlots(s)) {
    // only offers the airport can actually take
    const fits = s.offers.filter((o) => addedPerDay(s, o.perDay) <= room + 2);
    const best = fits.sort((a, b) => b.perDay * b.pay - a.perDay * a.pay)[0];
    if (best) out.push({ type: 'signOffer', offerId: best.id });
  }
  return out;
}

/** Buys the best-value upgrade it can afford (keeps a small reserve for staff). */
export function botBuys(s: GameState): Command[] {
  // ran dry with nothing arriving soon: an urgent order
  const out: Command[] = [];
  for (const kind of STORE_KINDS) {
    if (!storeActive(s, kind) || !s.stores[kind].out) continue;
    const k = storeIndex(kind);
    if (!s.deliveries.some((d) => d.store === k && (d.state !== 'ordered' || d.eta - s.time < 50))) out.push({ type: 'urgentOrder', store: k });
  }
  if (out.length > 0) return out;
  if (checkTier(s).ok) return [{ type: 'upgradeTier' }];
  // save up for the next tier once its other requirements are met
  const t = checkTier(s);
  if (t.available && t.served && t.rating && !t.busy && !t.money) return [];
  const o = bestOffer(s, true);
  if (!o) return [];
  return [{ type: 'buyUpgrade', id: o.id, count: 1 }];
}
