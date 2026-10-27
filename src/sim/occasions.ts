import { CUSTOMER_TYPES } from '../data/customers';
import { DISHES } from '../data/dishes';
import { OCCASION, OCCASION_BY_ID, OCCASIONS, type OccasionDef, type OccasionId } from '../data/occasions';
import { big, type Big } from './big';
import { changeRating, dishPrice, partyArrives, seatAt } from './game/customers';
import { emit, Ev } from './game/events';
import { hash01 } from './retention';
import { CustomerState, TableState, type GameState, type Table } from './game/types';

// Private events (src/data/occasions.ts): the phone call, the held table, the party at the door,
// the evening, and how it went. Not saved: a call or a booking in progress is gone when the game
// closes (the party never knew). The dice are left alone (hash01 by the call's number), so a game
// that never takes a booking plays exactly as before.

export interface Booking {
  id: number;
  kind: OccasionId;
  size: number;
  /** The set menu (dish ids): each guest has one of them, by their chair. */
  dishes: number[];
  /**
   * offer: the phone is ringing (answer by `at`); booked: they come at `at`; held: their table is
   * kept for them; door: they are at the door, waiting for it; seated: the evening is on; failed:
   * they walked out (ended next tick).
   */
  phase: 'offer' | 'booked' | 'held' | 'door' | 'seated' | 'failed';
  at: number;
  /** Their table (index; -1 none yet) and their leader (customer id; -1 not here yet). */
  table: number;
  leader: number;
  /** Service stars of every guest who paid, and what they paid. */
  stars: number;
  paid: number;
  earned: Big;
}

export interface OccasionState {
  /** When the phone rings next (sim seconds). */
  next: number;
  current: Booking | null;
  /** Calls so far (the dice for the next one) and events hosted well (this session). */
  calls: number;
  hosted: number;
}

export const newOccasions = (): OccasionState => ({ next: OCCASION.firstAfter, current: null, calls: 0, hosted: 0 });

/** Outside the front door (where the calls' toasts and the party's arrival point). */
const door = (s: GameState) => s.map.doors[0]?.outside ?? s.map.queue[0]!;

const biggestTable = (s: GameState): number => s.tables.reduce((m, t) => Math.max(m, t.seats), 0);

/** The kinds that could call now: by the building and the biggest table. */
export function bookable(s: GameState): OccasionDef[] {
  const most = biggestTable(s);
  return OCCASIONS.filter((o) => s.mods.building >= o.minTier && most >= o.size[0]);
}

const gap = (s: GameState): number => {
  const [lo, hi] = OCCASION.every;
  return lo + hash01(s.occasion.calls * 7.31 + 0.4) * (hi - lo);
};

/** The phone rings: a party, its size, its set menu. */
function call(s: GameState): void {
  const o = s.occasion;
  const kinds = bookable(s);
  o.calls += 1;
  if (kinds.length === 0) {
    o.next = s.time + gap(s);
    return;
  }
  const roll = (k: number) => hash01(o.calls * k + s.day * 0.37);
  // The grander events a little more often once they can be booked.
  const kind = kinds[Math.min(kinds.length - 1, Math.floor(Math.sqrt(roll(3.17)) * kinds.length))]!;
  const top = Math.min(kind.size[1], biggestTable(s));
  const size = kind.size[0] + Math.floor(roll(5.91) * (top - kind.size[0] + 1));
  const menu = DISHES.filter((d) => s.mods.menu[d.id]).map((d) => d.id);
  let dishes: number[];
  if (kind.priciest) dishes = [...menu].sort((a, b) => (dishPrice(s, b).gt(dishPrice(s, a)) ? 1 : dishPrice(s, b).lt(dishPrice(s, a)) ? -1 : 0)).slice(0, 2);
  else {
    const first = menu[Math.floor(roll(2.63) * menu.length)]!;
    const rest = menu.filter((d) => d !== first);
    dishes = rest.length > 0 ? [first, rest[Math.floor(roll(8.11) * rest.length)]!] : [first];
  }
  o.current = { id: o.calls, kind: kind.id, size, dishes, phase: 'offer', at: s.time + OCCASION.answerSeconds, table: -1, leader: -1, stars: 0, paid: 0, earned: big(0) };
  emit(s, Ev.OccasionCall, door(s).x, door(s).y, OCCASIONS.indexOf(kind), size);
}

/** About what the evening pays (for the call's card): every plate at the event's price, tips as usual. */
export function bookingValue(s: GameState, b: Booking): Big {
  const def = OCCASION_BY_ID[b.kind];
  const avg = b.dishes.reduce((sum, d) => sum.add(dishPrice(s, d)), big(0)).div(Math.max(1, b.dishes.length));
  const tips = 1 + CUSTOMER_TYPES[def.guests[0]!].tipRate;
  return avg.mul(b.size * def.fee * tips).floor();
}

/** Yes: they come in `leadSeconds`. */
export function acceptBooking(s: GameState): boolean {
  const b = s.occasion.current;
  if (!b || b.phase !== 'offer' || s.construction) return false;
  b.phase = 'booked';
  b.at = s.time + OCCASION.leadSeconds;
  emit(s, Ev.OccasionBooked, door(s).x, door(s).y, OCCASIONS.findIndex((o) => o.id === b.kind), b.size);
  return true;
}

/** No, thank you: the next call comes later. */
export function declineBooking(s: GameState): boolean {
  const b = s.occasion.current;
  if (!b || b.phase !== 'offer') return false;
  end(s);
  return true;
}

function end(s: GameState): void {
  for (const t of s.tables) t.booked = false;
  s.occasion.current = null;
  s.occasion.next = s.time + gap(s);
}

/** The table they get: one that seats them, the snuggest, a free one first. */
function pickTable(s: GameState, size: number): Table | undefined {
  let best: Table | undefined;
  let score = Infinity;
  for (const t of s.tables) {
    if (t.seats < size) continue;
    const v = (t.seats - size) * 2 + (t.state === TableState.Free ? 0 : 5);
    if (v < score) {
      score = v;
      best = t;
    }
  }
  return best;
}

/** Their table, kept (it may have been moved or joined in build mode meanwhile: then another). */
function holdTable(s: GameState, b: Booking): Table | undefined {
  const held = b.table >= 0 ? s.tables[b.table] : undefined;
  if (held && held.booked && held.seats >= b.size) return held;
  for (const t of s.tables) t.booked = false;
  const t = pickTable(s, b.size);
  b.table = t ? t.index : -1;
  if (t) t.booked = true;
  return t;
}

function fail(s: GameState, b: Booking, walkedOut: boolean): void {
  if (walkedOut) changeRating(s, OCCASION.failRating, door(s));
  emit(s, Ev.OccasionEnd, door(s).x, door(s).y, OCCASIONS.findIndex((o) => o.id === b.kind), walkedOut ? -1 : -2);
  end(s);
}

/** The evening is over: the stars decide the gems and the word that goes round. */
function finish(s: GameState, b: Booking): void {
  const def = OCCASION_BY_ID[b.kind];
  const avg = b.paid > 0 ? b.stars / b.paid : 0;
  const gems = avg >= OCCASION.perfectStars ? def.gems : avg >= OCCASION.goodStars ? Math.ceil(def.gems / 2) : 0;
  s.gems += gems;
  const t = s.tables[b.table];
  const at = t ?? door(s);
  if (avg >= OCCASION.goodStars) {
    changeRating(s, OCCASION.ratingPerGuest * b.size, at);
    s.occasion.hosted += 1;
  } else if (avg < 2.5) changeRating(s, -OCCASION.ratingPerGuest * b.size, at);
  // a = the kind, b = the average stars (tenths), c = gems.
  emit(s, Ev.OccasionEnd, at.x, at.y, OCCASIONS.indexOf(def), Math.round(avg * 10), gems);
  end(s);
}

export function updateOccasions(s: GameState): void {
  const o = s.occasion;
  const b = o.current;
  if (!b) {
    if (s.time >= o.next && !s.construction && s.stats.served >= OCCASION.firstServed) call(s);
    return;
  }
  // Building work: the booking is called off (no harm done; they understand).
  if (s.construction && b.phase !== 'seated') {
    if (b.phase !== 'offer') fail(s, b, false);
    else end(s);
    return;
  }
  switch (b.phase) {
    case 'offer':
      if (s.time >= b.at) end(s);
      break;
    case 'booked':
      if (s.time >= b.at - OCCASION.holdSeconds && holdTable(s, b)) b.phase = 'held';
      break;
    case 'held': {
      const t = holdTable(s, b);
      if (s.time < b.at) break;
      const def = OCCASION_BY_ID[b.kind];
      const leader = partyArrives(s, def.guests, b.size, def.kids, b.id);
      b.leader = leader.id;
      b.phase = 'door';
      emit(s, Ev.OccasionArrive, leader.x, leader.y, OCCASIONS.indexOf(def), b.size);
      if (t && t.state === TableState.Free) seat(s, b, t);
      break;
    }
    case 'door': {
      const t = holdTable(s, b);
      const leader = s.customers.find((c) => c.id === b.leader);
      if (!leader || leader.state === CustomerState.Leaving) fail(s, b, true);
      else if (t && t.state === TableState.Free && leader.state === CustomerState.Queued) seat(s, b, t);
      break;
    }
    case 'seated':
      // Everyone paid and got up (or went home angry: then walkout set 'failed').
      if (!s.customers.some((c) => c.occasion === b.id && c.table >= 0 && c.state !== CustomerState.Leaving && c.state !== CustomerState.Restroom)) finish(s, b);
      break;
    case 'failed':
      fail(s, b, true);
      break;
  }
}

function seat(s: GameState, b: Booking, t: Table): void {
  const leader = s.customers.find((c) => c.id === b.leader);
  if (!leader) return;
  seatAt(s, leader, t);
  b.phase = 'seated';
}

/** The booked party at the door, or walking to their table: for the event's card. */
export const bookingLeft = (s: GameState): number => {
  const b = s.occasion.current;
  return b ? Math.max(0, Math.ceil(b.at - s.time)) : 0;
};
