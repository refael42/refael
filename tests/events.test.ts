import { describe, expect, it } from 'vitest';
import { BUS, FESTIVAL, FESTIVAL_THEMES, FLASH } from '../src/data/events';
import { mapForTier, STAND_MAP } from '../src/data/maps';
import { SHOP_BY_ID } from '../src/data/shop';
import { STEP_SEC } from '../src/data/sim';
import { queueCommand } from '../src/sim/game/commands';
import { createGame } from '../src/sim/game/create';
import { Ev } from '../src/sim/game/events';
import { stepGame } from '../src/sim/game/step';
import { CustomerState, type Customer, type GameState } from '../src/sim/game/types';
import { openBranch } from '../src/sim/franchise';
import { claimFestival, festivalAt, festivalBonus, festivalEnds, festivalPoints, stepsReached, syncFestival, themeOf } from '../src/sim/festival';
import { makeSave, parseSave, restoreGame } from '../src/sim/save';
import { buyDeal, dealAt } from '../src/sim/shop';
import { buildGrid, findPath } from '../src/sim/grid';

const DAY_MS = 24 * 3600 * 1000;
/** Half a day into festival number 40. */
const NOW = FESTIVAL.epoch + 40 * FESTIVAL.days * DAY_MS + DAY_MS / 2;

const run = (s: GameState, seconds: number) => {
  for (let i = Math.round(seconds / STEP_SEC); i > 0; i--) stepGame(s, STEP_SEC);
};

/** A guest as far as festival points care. */
const guest = (dish: number, extra: Partial<Customer> = {}) => ({ x: 0, y: 0, dish, vip: false, tourist: false, ...extra }) as Customer;

describe('food festival (owner: events and FOMO)', () => {
  it('runs a few days by the clock, every phone on the same one, the themes taking turns', () => {
    expect(festivalAt(FESTIVAL.epoch)).toBe(0);
    expect(festivalAt(FESTIVAL.epoch + FESTIVAL.days * DAY_MS - 1)).toBe(0);
    expect(festivalAt(FESTIVAL.epoch + FESTIVAL.days * DAY_MS)).toBe(1);
    expect(festivalEnds(festivalAt(NOW)) - NOW).toBe(FESTIVAL.days * DAY_MS - DAY_MS / 2);
    const themes = new Set(Array.from({ length: FESTIVAL_THEMES.length }, (_, i) => themeOf(40 + i).id));
    expect(themes.size).toBe(FESTIVAL_THEMES.length);
    expect(themeOf(40 + FESTIVAL_THEMES.length)).toBe(themeOf(40));
  });

  it('counts nothing before the first clock reading, then points for every guest who pays', () => {
    const s = createGame(STAND_MAP, 1, { roster: ['cook', 'waiter', 'host'] });
    run(s, 120);
    expect(s.stats.served).toBeGreaterThan(0);
    expect(s.festival.points).toBe(0);
    queueCommand(s, { type: 'festival', now: NOW });
    const served = s.stats.served;
    run(s, 180);
    expect(s.festival.id).toBe(festivalAt(NOW));
    expect(s.festival.points).toBeGreaterThanOrEqual(s.stats.served - served);
  });

  it('gives more for the festival dish, top service, VIPs and tourists', () => {
    const s = createGame(STAND_MAP, 1);
    syncFestival(s, NOW);
    const dish = themeOf(s.festival.id).dish;
    const other = (dish + 1) % 8;
    const gain = (c: Customer, stars: number) => {
      const before = s.festival.points;
      festivalPoints(s, c, stars);
      return s.festival.points - before;
    };
    const p = FESTIVAL.points;
    expect(gain(guest(other), 3)).toBe(p.guest);
    expect(gain(guest(dish), 3)).toBe(p.guest + p.dish);
    expect(gain(guest(other), 5)).toBe(p.guest + p.fiveStars);
    expect(gain(guest(other, { vip: true }), 3)).toBe(p.guest + p.vip);
    expect(gain(guest(dish, { tourist: true }), 5)).toBe(2 * (p.guest + p.dish + p.fiveStars));
  });

  it('opens rewards in order as the points come; the last one is the trophy, which raises every bill', () => {
    const s = createGame(STAND_MAP, 1, { gems: 0 });
    syncFestival(s, NOW);
    expect(claimFestival(s)).toBe(false);
    const steps: number[] = [];
    const seen = s.nextEventId;
    s.festival.points = FESTIVAL.track[2]!.points;
    festivalPoints(s, guest(-1), 3);
    for (const e of s.events) if (e.id >= seen && e.type === Ev.FestivalStep) steps.push(e.a);
    expect(steps).toEqual([]);
    s.festival.points = FESTIVAL.track[3]!.points - 1;
    festivalPoints(s, guest(-1), 3);
    expect(s.events.some((e) => e.id >= seen && e.type === Ev.FestivalStep && e.a === 4)).toBe(true);
    // Four reached: four rewards, one at a time, then no more.
    for (let i = 0; i < 4; i++) expect(claimFestival(s)).toBe(true);
    expect(claimFestival(s)).toBe(false);
    expect(s.festival.claimed).toBe(4);
    expect(s.gems).toBe(5);
    expect(s.wheel.tokens).toBe(1);
    // The whole track: the trophy, its gems, and +10 % on every bill for good.
    expect(festivalBonus(s)).toBe(1);
    s.festival.points = FESTIVAL.track.at(-1)!.points;
    while (claimFestival(s));
    expect(s.festival.claimed).toBe(FESTIVAL.track.length);
    expect(s.festival.trophies).toEqual([FESTIVAL_THEMES.indexOf(themeOf(s.festival.id))]);
    expect(festivalBonus(s)).toBeCloseTo(1 + FESTIVAL.trophyBonus);
    expect(s.gems).toBe(5 + 15 + 30);
  });

  it('when the next festival starts, rewards reached and not taken are paid, and points start again', () => {
    const s = createGame(STAND_MAP, 1, { gems: 0 });
    syncFestival(s, NOW);
    s.festival.points = FESTIVAL.track[1]!.points;
    const coins = s.coins;
    // A clock that went back keeps this festival.
    syncFestival(s, NOW - 10 * DAY_MS);
    expect(s.festival.points).toBe(FESTIVAL.track[1]!.points);
    syncFestival(s, NOW + FESTIVAL.days * DAY_MS);
    expect(s.festival).toMatchObject({ id: festivalAt(NOW) + 1, points: 0, claimed: 0 });
    expect(s.gems).toBe(5);
    expect(s.coins.gt(coins)).toBe(true);
  });

  it('keeps the trophies in every branch and in the save; an older save starts with none', () => {
    const s = createGame(mapForTier(2), 1, { levels: { building: 2 }, festival: { id: 40, points: 12, claimed: 1, trophies: [2, 4] } });
    const loaded = parseSave(JSON.stringify(makeSave(s, 1000)));
    expect(loaded.ok && restoreGame(loaded.save, 1).festival).toEqual({ id: 40, points: 12, claimed: 1, trophies: [2, 4] });
    const raw = makeSave(s, 1000) as unknown as Record<string, unknown>;
    raw.festival = { id: 40, points: -5, claimed: 99, trophies: [2, 2, 77, 'x'] };
    const bad = parseSave(JSON.stringify(raw));
    expect(bad.ok && bad.save.festival).toEqual({ id: 40, points: 0, claimed: FESTIVAL.track.length, trophies: [2] });
    const old: Record<string, unknown> = { ...raw, version: 8 };
    delete old.festival;
    delete old.flash;
    const migrated = parseSave(JSON.stringify(old));
    expect(migrated.ok && migrated.save.festival).toEqual({ id: -1, points: 0, claimed: 0, trophies: [] });
    expect(openBranch(s)).toBe(true);
    expect(s.festival.trophies).toEqual([2, 4]);
  });
});

describe('flash deal', () => {
  const SLOT_MS = FLASH.everyHours * 3600 * 1000;

  it('one item cheaper for a few hours, the same deal on every phone, then the next one', () => {
    const s = createGame(STAND_MAP, 1, { gems: 1000 });
    const deal = dealAt(s, NOW)!;
    expect(deal.ends - NOW).toBeGreaterThan(0);
    expect(deal.ends - NOW).toBeLessThanOrEqual(SLOT_MS);
    expect(dealAt(s, deal.ends - 1)!.item.id).toBe(deal.item.id);
    expect(deal.cost).toBe(Math.round(deal.item.cost * (1 - deal.off)));
    // Over a day the deals change.
    const items = new Set(Array.from({ length: 8 }, (_, i) => dealAt(s, NOW + i * SLOT_MS)!.item.id));
    expect(items.size).toBeGreaterThan(2);
  });

  it('sells once per deal, at the deal price, and skips what is owned for good', () => {
    // A deal on something that is always for sale: a boost or a time warp.
    let now = NOW;
    const s = createGame(STAND_MAP, 1, { gems: 1000 });
    while (!['boost', 'warp'].includes(dealAt(s, now)!.item.kind)) now += SLOT_MS;
    const deal = dealAt(s, now)!;
    expect(buyDeal(s, now)).toBe(true);
    expect(s.gems).toBe(1000 - deal.cost);
    expect(dealAt(s, now)!.bought).toBe(true);
    expect(buyDeal(s, now)).toBe(false);
    expect(dealAt(s, deal.ends)!.bought).toBe(false);
    // A perk on sale that is already owned gives way to the next deal.
    let perkAt = NOW;
    while (dealAt(s, perkAt)!.item.kind !== 'perk') perkAt += SLOT_MS;
    const perk = dealAt(s, perkAt)!.item.id;
    s.perks = { ...s.perks, [perk]: 1 };
    expect(dealAt(s, perkAt)!.item.id).not.toBe(perk);
    expect(SHOP_BY_ID[perk]).toBeDefined();
  });

  it('needs the gems', () => {
    const s = createGame(STAND_MAP, 1, { gems: 0 });
    expect(buyDeal(s, NOW)).toBe(false);
  });
});

describe('where the events stand', () => {
  it('the bus stops on the road, its door opens onto the sidewalk, the trophies stand on the sidewalk', () => {
    for (let t = 0; t < 7; t++) {
      const map = mapForTier(t);
      const area = (p: { x: number; y: number }) => map.areas.filter((a) => p.x >= a.x0 && p.x < a.x1 && p.y >= a.y0 && p.y < a.y1).at(-1)?.floor;
      const grid = buildGrid(map, map.tables.length, map.stoves.length, map.tables.length);
      // The whole bus is on the road (4 tiles long).
      for (const dx of [-2, 2]) expect(area({ x: map.busStop.x + dx * 0.99, y: map.busStop.y }), `tier ${t}`).toBe('road');
      expect(area(map.busDoor), `tier ${t}`).toBe('sidewalk');
      expect(findPath(grid, map.busDoor, map.queue[0]!), `tier ${t}`).not.toBeNull();
      for (const p of map.trophySpots) expect(area(p), `tier ${t}`).toBe('sidewalk');
    }
  });
});

describe('tourist bus', () => {
  /** A busy diner: past the first minutes, with plenty served. */
  const busy = () => {
    const s = createGame(STAND_MAP, 3, { served: 200, levels: { tables: 4 }, roster: ['cook', 'waiter', 'washer', 'host'] });
    s.time = BUS.firstSeconds;
    return s;
  };

  it('pulls up outside, lets a group off into the line, and drives on', () => {
    const s = busy();
    const seen = s.nextEventId;
    stepGame(s, STEP_SEC);
    expect(s.bus).not.toBeNull();
    const bus = s.events.find((e) => e.id >= seen && e.type === Ev.Bus)!;
    expect(bus.a).toBeGreaterThanOrEqual(BUS.guests[0]);
    let tourists = 0;
    for (let i = 0; i < 60 / STEP_SEC && s.bus; i++) {
      stepGame(s, STEP_SEC);
      tourists = Math.max(tourists, s.customers.filter((c) => c.tourist && c.party === c.id).length);
    }
    expect(s.bus).toBeNull();
    expect(tourists).toBeGreaterThan(0);
    // They head for the line like anyone else.
    expect(s.customers.some((c) => c.tourist && (c.state === CustomerState.Queued || c.state === CustomerState.Arriving || c.state === CustomerState.ToTable))).toBe(true);
    const gap = s.nextBus - s.time;
    expect(gap).toBeGreaterThanOrEqual(BUS.gapSeconds[0] - 0.1);
    expect(gap).toBeLessThanOrEqual(BUS.gapSeconds[1]);
  });

  it('never in the first minutes, nor while the place is closed for building', () => {
    const early = createGame(STAND_MAP, 3, { served: 200 });
    run(early, 60);
    expect(early.bus).toBeNull();
    const fresh = createGame(STAND_MAP, 3);
    fresh.time = BUS.firstSeconds;
    stepGame(fresh, STEP_SEC);
    expect(fresh.bus).toBeNull();
  });

  it('tourists pay more', () => {
    const pays = (tourist: boolean) => {
      const s = busy();
      s.nextBus = Infinity;
      for (let i = 0; i < 240 / STEP_SEC; i++) {
        for (const c of s.customers) c.tourist = tourist;
        stepGame(s, STEP_SEC);
      }
      return s.stats.earned;
    };
    expect(pays(true).gt(pays(false).mul(1 + BUS.payBonus * 0.8))).toBe(true);
  });
});
