import { describe, expect, it } from 'vitest';
import { STAND_MAP } from '../src/data/maps';
import { OCCASION, OCCASIONS } from '../src/data/occasions';
import { STEP_SEC } from '../src/data/sim';
import { fullSeats, type TableStyle } from '../src/data/tables';
import { acceptBooking, bookable, bookingValue, declineBooking } from '../src/sim/occasions';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, TableState, type GameState } from '../src/sim/game/types';

// Owner, idea 3: "events: a birthday or a wedding booked at your place; a long table, a special menu, big pay".

const team = ['cook', 'cook', 'waiter', 'waiter', 'washer'] as const;

/** A diner whose first table seats `seats` (a table for four, or one joined for ten). */
function game(style: TableStyle = 'square'): GameState {
  const s = createGame(STAND_MAP, 5, { roster: [...team] });
  const t = s.tables[0]!;
  t.style = style;
  t.seats = fullSeats(style);
  t.party = Array(t.seats).fill(-1);
  t.dishes = Array(t.seats).fill(-1);
  t.drinks = Array(t.seats).fill(-1);
  s.stats.served = OCCASION.firstServed;
  s.chef.xp = -1e12;
  // Plates for a long table (the test puts one in the first diner).
  s.cleanPlates += 16;
  return s;
}

const run = (s: GameState, seconds: number, until?: () => boolean) => {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) {
    // Walk-ins get seated by hand as they line up (an attentive manager).
    for (const c of s.customers) if (c.state === CustomerState.Queued && c.occasion === undefined && c.party === c.id) queueCommand(s, { type: 'seat', customer: c.id });
    stepGame(s, STEP_SEC);
    if (until?.()) return true;
  }
  return false;
};

const ring = (s: GameState) => {
  s.occasion.next = s.time;
  run(s, 0.1);
  return s.occasion.current!;
};

describe('private events', () => {
  it('the phone rings only once the place is known, for what its tables can seat', () => {
    const s = game('square');
    s.stats.served = 0;
    s.occasion.next = 0;
    run(s, 1);
    expect(s.occasion.current).toBeNull();
    s.stats.served = OCCASION.firstServed;
    // A table for four: an anniversary or a birthday (a business lunch from the bistro, a bar mitzvah needs seven chairs).
    expect(bookable(s).map((o) => o.id)).toEqual(['anniversary', 'birthday']);
    const b = ring(s);
    expect(b.phase).toBe('offer');
    expect(['anniversary', 'birthday']).toContain(b.kind);
    expect(b.size).toBeLessThanOrEqual(4);
    expect(b.dishes.length).toBeGreaterThan(0);
    expect(s.events.some((e) => e.type === Ev.OccasionCall)).toBe(true);
    expect(bookingValue(s, b).gt(0)).toBe(true);
  });

  it('a call not answered goes away; no, thank you, too', () => {
    const s = game();
    ring(s);
    run(s, OCCASION.answerSeconds + 1);
    expect(s.occasion.current).toBeNull();
    ring(s);
    expect(declineBooking(s)).toBe(true);
    expect(s.occasion.current).toBeNull();
    expect(s.occasion.next).toBeGreaterThan(s.time);
  });

  it('booked: the table is kept, the party comes on time, eats the set menu with a cake, and pays the event price', () => {
    const s = game('feast');
    s.mods = { ...s.mods, building: 2 };
    const b = ring(s);
    expect(acceptBooking(s)).toBe(true);
    expect(b.phase).toBe('booked');
    // The hold starts a little before.
    run(s, OCCASION.leadSeconds - OCCASION.holdSeconds + 1);
    expect(b.phase === 'held' || b.phase === 'door').toBe(true);
    const t = s.tables[b.table]!;
    expect(t.booked).toBe(true);
    // Nobody else is seated there meanwhile.
    const before = new Set(t.party.filter((id) => id >= 0));
    run(s, OCCASION.holdSeconds - 2);
    for (const id of t.party) if (id >= 0) expect(before.has(id) || s.customers.find((c) => c.id === id)?.occasion !== undefined).toBe(true);
    const dishes = new Set<number>();
    let cake = 0;
    const ended = run(s, 400, () => {
      for (const c of s.customers) {
        if (c.occasion === undefined || c.dish < 0) continue;
        dishes.add(c.dish);
        if (c.dessertPhase) cake |= 1 << c.seat;
      }
      return s.occasion.current === null;
    });
    expect(ended).toBe(true);
    const end = s.events.filter((e) => e.type === Ev.OccasionEnd).pop();
    // A real evening: they paid (b = average stars in tenths > 0).
    expect(end).toBeDefined();
    expect(end!.b).toBeGreaterThan(0);
    expect(b.paid).toBe(b.size);
    expect(t.booked).toBe(false);
    // The set menu, and (desserts open) the cake for everyone.
    for (const d of dishes) expect(b.dishes).toContain(d);
    if (s.chef.level >= 6) expect(cake).toBeGreaterThan(0);
  });

  it('a booked party that walks out costs rating, and frees the table', () => {
    const s = game('square');
    const b = ring(s);
    acceptBooking(s);
    // Fill the table so it is never ready, and the party gives up at the door.
    run(s, OCCASION.leadSeconds - OCCASION.holdSeconds + 0.5);
    const t = s.tables[b.table]!;
    t.state = TableState.Dirty;
    t.plates = 99;
    // Nobody to clear it.
    s.staff = s.staff.filter((st) => st.role !== 'waiter');
    const rating = s.rating;
    run(s, OCCASION.holdSeconds + OCCASION.doorPatience + 30, () => s.occasion.current === null);
    expect(s.occasion.current).toBeNull();
    const end = s.events.filter((e) => e.type === Ev.OccasionEnd).pop();
    expect(end?.b).toBe(-1);
    expect(s.rating).toBeLessThan(rating);
    expect(s.tables.some((x) => x.booked)).toBe(false);
  });

  it('building work calls it off without harm', () => {
    const s = game();
    ring(s);
    acceptBooking(s);
    s.construction = { tier: 1 } as GameState['construction'];
    run(s, 0.1);
    expect(s.occasion.current).toBeNull();
  });

  it('every kind of event has its own guests, size and price', () => {
    for (const o of OCCASIONS) {
      expect(o.size[0]).toBeLessThanOrEqual(o.size[1]);
      expect(o.size[1]).toBeLessThanOrEqual(10);
      expect(o.fee).toBeGreaterThan(1);
      expect(o.guests.length).toBeGreaterThan(0);
    }
  });
});
