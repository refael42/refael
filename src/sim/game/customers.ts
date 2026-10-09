import { CUSTOMER_TYPE_LIST, CUSTOMER_TYPES, KID_RANK, PARTY, PATIENCE_ICON, type CustomerType } from '../../data/customers';
import { weatherArrivals, weatherPatience } from '../weather';
import { DISHES, dishDef, type DishDef } from '../../data/dishes';
import { ECONOMY } from '../../data/economy';
import { ANIM } from '../../data/customers';
import { DAY, KITCHEN } from '../../data/staff';
import { weekArrivals } from '../calendar';
import { REVIEW } from '../../data/reviews';
import type { Point } from '../../data/maps';
import { seatLayout, styleIndex, TOP_MIDDLE } from '../../data/tables';
import { big, type Big } from '../big';
import { findPath } from '../grid';
import { customerLook } from '../looks';
import { followPath, setPose } from '../movement';
import { next, pick, range } from '../rng';
import { Bubble, Emote, Expression, Facing, Held, Pose } from '../types';
import { emit, Ev } from './events';
import { buzzing, maybeReview, serviceMult, serviceStars, walkoutReview } from './reviews';
import { boostNow } from '../shop';
import { hash01, maybeVip, vipBonus } from '../retention';
import { festivalBonus, festivalPoints } from '../festival';
import { guideArrivals, guidePrice, inspectorDish, inspectorDue, inspectorLeaves, makeInspector } from './guide';
import { BUS } from '../../data/events';
import { cancelDrinks, maybeBarGuest, maybeOrderDrink, updateBarGuest } from './bar';
import { CustomerState, OrderState, TableState, type Customer, type GameState, type Table } from './types';

/** About one guest in three checks their phone while waiting for the food. */
const phoneUser = (c: Customer) => c.id % 3 === 1;

const seatOffset = (t: Table, seat: number): Point => seatLayout(t.style, t.seats)[seat] ?? { x: -0.62, y: 0 };
export const chairOf = (t: Table, seat = 0): Point => {
  const o = seatOffset(t, seat);
  return { x: t.x + o.x, y: t.y + o.y };
};

/** Where the dish lands: in front of its chair, pulled in toward the middle of the top. */
export const dishSpot = (t: Table, seat: number): Point => {
  const o = seatOffset(t, seat);
  const mid = TOP_MIDDLE[styleIndex(t.style)]!.y;
  return { x: t.x + (o.x < 0 ? -0.12 : 0.12), y: t.y + mid + (o.y - mid) * 0.6 };
};

/** Everyone who came in together (just them, when alone). */
const partyOf = (s: GameState, c: Customer): Customer[] => s.customers.filter((o) => o.party === c.party);
const leaderOf = (s: GameState, c: Customer): Customer => s.customers.find((o) => o.id === c.party) ?? c;

/** Where a party member waits in line: the leader on the spot, the rest of them around. */
function queueSpot(s: GameState, c: Customer, slot: number): Point {
  const p = s.map.queue[slot]!;
  if (c.party === c.id) return p;
  const member = Math.max(1, s.customers.filter((o) => o.party === c.party).indexOf(c));
  const o = PARTY.queueOffsets[(member - 1) % PARTY.queueOffsets.length]!;
  return { x: p.x + o.x, y: p.y + o.y };
}

function pickType(s: GameState): CustomerType {
  const types = CUSTOMER_TYPE_LIST.filter((t) => s.stats.served >= (t.minServed ?? 0));
  const total = types.reduce((sum, t) => sum + t.weight, 0);
  let roll = next(s.rng) * total;
  for (const t of types) {
    roll -= t.weight;
    if (roll < 0) return t;
  }
  return types[0]!;
}

function freeQueueSlot(s: GameState): number {
  for (let i = 0; i < s.map.queue.length; i++) {
    if (!s.customers.some((c) => c.queueSlot === i)) return i;
  }
  return -1;
}

/** Route along the walkable grid; falls back to a straight line so nobody ever gets stuck. */
export function route(s: GameState, from: Point, to: Point): Point[] {
  return findPath(s.grid, from, to) ?? [{ ...to }];
}

/** Poisson arrivals: exponential gaps whose rate grows with the rating. */
export function updateArrivals(s: GameState): void {
  if (s.construction || s.time < s.nextArrival) return;
  const buzz = buzzing(s) ? 1 + REVIEW.buzzArrivals : 1;
  const perSecond = ((ECONOMY.baseArrivalsPerMinute + ECONOMY.arrivalsPerStar * s.rating) * s.mods.arrivals * buzz * weatherArrivals(s.day) * weekArrivals(s.day, s.dayTime / DAY.seconds) * guideArrivals(s)) / 60;
  const gap = -Math.log(1 - next(s.rng)) / perSecond;
  s.nextArrival = s.time + Math.min(ECONOMY.maxArrivalGapSeconds, gap);
  const slot = freeQueueSlot(s);
  if (slot < 0) return; // The line is full: this one walks on by.
  const type = pickType(s);
  const spawn = s.stats.served === 0 && s.customers.length === 0 ? s.map.firstSpawn : pick(s.rng, s.map.spawns);
  arrive(s, type, { x: spawn.x, y: spawn.y + range(s.rng, -0.3, 0.3) }, slot);
}

/** Someone (and maybe a friend) heads for the line from `start`. */
function arrive(s: GameState, type: CustomerType, start: Point, slot: number, look?: Customer['look']): Customer {
  // Friends come along only once there are tables for two: the more of them, the more pairs.
  const pairTables = s.tables.filter((t) => t.seats >= 2).length;
  const pair = type.pairs && pairTables > 0 && next(s.rng) < (PARTY.pairChance * pairTables) / s.tables.length;
  // With family tables, some pairs are whole families of 3-4 (by the next id: the game's dice
  // are left alone, so a game without family tables plays exactly as before).
  const familyTables = pair ? s.tables.filter((t) => t.seats > 2).length : 0;
  const roll = hash01(s.nextId * 3.17 + 0.61);
  const family = familyTables > 0 && roll < (PARTY.familyChance * familyTables) / pairTables;
  // A long table for six: some families are big groups of 5-6 (by the id again).
  const bigTables = family ? s.tables.filter((t) => t.seats > 4).length : 0;
  const crowd = bigTables > 0 && hash01(s.nextId * 1.91 + 0.13) < (PARTY.bigChance * bigTables) / familyTables;
  const size = crowd ? (hash01(s.nextId * 2.37 + 0.5) < 0.5 ? 6 : 5) : family ? (roll < (PARTY.familyChance * familyTables) / pairTables / 2 ? 4 : 3) : pair ? 2 : 1;
  const leader = newCustomer(s, type, start, slot, -1, size);
  if (look) leader.look = { ...look };
  maybeVip(s, leader);
  s.customers.push(leader);
  // Today's inspector is the next guest who comes alone (they take a table, not the bar).
  if (size === 1 && !leader.vip && inspectorDue(s)) {
    makeInspector(s, leader);
    return leader;
  }
  // Someone alone may sit at the bar instead of waiting in line (from the grand restaurant).
  if (size === 1 && maybeBarGuest(s, leader)) {
    leader.path = route(s, leader, s.map.bar.stools[leader.stool]!.at);
    return leader;
  }
  for (let m = 1; m < size; m++) {
    const o = PARTY.spawnOffsets[m - 1]!;
    const friend = newCustomer(s, type, { x: start.x + o.x, y: start.y + o.y }, -1, leader.id, size);
    // Some come with a child (by the id: the game's dice are left alone); a family's third and
    // fourth are mostly children.
    const kids = family && m >= 2 ? PARTY.familyKidChance : PARTY.kidChance;
    if ((family || PARTY.kidTypes.includes(type.id)) && hash01(friend.id * 5.31 + 0.2) < kids) friend.rank = KID_RANK;
    s.customers.push(friend);
  }
  return leader;
}

/**
 * A passer-by with a flyer decides to come in: they become a customer right where they stand
 * (same face, same clothes). Not if the line is full or the place is closed for building.
 */
export function walkIn(s: GameState, at: Point, look: Customer['look']): Customer | null {
  if (s.construction) return null;
  const slot = freeQueueSlot(s);
  if (slot < 0) return null;
  return arrive(s, pickType(s), { x: at.x, y: at.y }, slot, look);
}

/** A tourist steps off the bus at `at` and heads for the line (with a friend, maybe). Null if the line is full. */
export function touristArrives(s: GameState, at: Point): Customer | null {
  const slot = freeQueueSlot(s);
  if (slot < 0) return null;
  const c = arrive(s, pickType(s), { x: at.x, y: at.y }, slot);
  for (const m of s.customers) if (m.party === c.party) m.tourist = true;
  return c;
}

/** A newcomer heading for the line; `party` = their leader's id (-1: they lead), `slot` = their place in line. */
function newCustomer(s: GameState, type: CustomerType, start: Point, slot: number, party: number, partySize: number): Customer {
  const id = s.nextId++;
  const c: Customer = {
    id,
    type: type.id,
    look: customerLook(s.rng, type),
    x: start.x,
    y: start.y,
    prevX: start.x,
    prevY: start.y,
    facing: Facing.FrontRight,
    pose: Pose.Walk,
    poseTime: 0,
    held: Held.None,
    expression: Expression.Happy,
    emote: 0,
    emoteTime: 0,
    patience: -1,
    bubble: 0,
    state: CustomerState.Arriving,
    stateTime: 0,
    walkSpeed: type.walkSpeed,
    path: [],
    queueSlot: slot,
    table: -1,
    order: -1,
    dish: -1,
    patienceLeft: 0,
    patienceMax: 0,
    moodSum: 0,
    moodCount: 0,
    foodWaited: 0,
    angryEmoted: false,
    dishQuality: 1,
    tipBoost: 1,
    party: party < 0 ? id : party,
    partySize,
    seat: -1,
    vip: false,
    patienceKind: PATIENCE_ICON[type.patience],
    menuFrom: -1,
    tourist: false,
    stool: -1,
    drinkOrder: -1,
    rounds: 0,
    sipping: -1,
  };
  const leader = party < 0 ? c : s.customers.find((o) => o.id === party)!;
  c.path = route(s, start, queueSpot(s, c, leader.queueSlot));
  return c;
}

function setState(c: Customer, state: Customer['state']): void {
  c.state = state;
  c.stateTime = 0;
}

function startWait(c: Customer, seconds: number): void {
  c.patienceMax = seconds;
  c.patienceLeft = seconds;
  c.patience = 1;
  c.angryEmoted = false;
}

function endWait(c: Customer): void {
  c.moodSum += c.patienceMax > 0 ? c.patienceLeft / c.patienceMax : 1;
  c.moodCount += 1;
  c.patience = -1;
}

function drainPatience(c: Customer, dt: number): void {
  c.patienceLeft = Math.max(0, c.patienceLeft - dt);
  c.patience = c.patienceLeft / c.patienceMax;
  c.expression = c.patience > 0.5 ? Expression.Happy : c.patience > 0.25 ? Expression.Neutral : Expression.Angry;
  if (c.patience <= 0.25 && !c.angryEmoted) {
    c.angryEmoted = true;
    emote(c, Emote.Anger);
  }
}

export function emote(c: { emote: Emote; emoteTime: number }, e: Emote): void {
  c.emote = e;
  c.emoteTime = 0;
}

function changeRating(s: GameState, delta: number, at: Point): void {
  const r = ECONOMY.rating;
  s.rating = Math.max(r.min, Math.min(r.max, s.rating + delta));
  emit(s, Ev.Rating, at.x, at.y, delta);
}

/** Off home along the street (also used when the place closes for building work). */
export function sendHome(s: GameState, c: Customer): void {
  cancelDrinks(s, c);
  c.path = route(s, c, pick(s.rng, s.map.spawns));
  c.queueSlot = -1;
  c.table = -1;
  c.bubble = Bubble.None;
  c.patience = -1;
  c.held = Held.None;
  setState(c, CustomerState.Leaving);
}

/** A table everyone left: dirty if anyone ate at it, otherwise ready for the next guests. */
function vacate(s: GameState, t: Table): void {
  t.plates = t.dishes.filter((d) => d >= 0).length;
  t.state = t.plates > 0 ? TableState.Dirty : TableState.Free;
  t.party.fill(-1);
  t.dishes.fill(-1);
  t.drinks.fill(-1);
  t.since = s.time;
}

/** Ran out of patience: no money, lower rating, and everyone sees them go (with their friends). */
function walkout(s: GameState, c: Customer): void {
  s.stats.walkouts += 1;
  walkoutReview(s, c);
  changeRating(s, ECONOMY.rating.walkout, c);
  const table = c.table >= 0 ? s.tables[c.table]! : null;
  for (const m of partyOf(s, c)) storm(s, m);
  if (table) vacate(s, table);
}

function storm(s: GameState, c: Customer): void {
  inspectorLeaves(s, c, true);
  emote(c, Emote.Anger);
  c.expression = Expression.Angry;
  emit(s, Ev.Poof, c.x, c.y);
  const orderIndex = s.orders.findIndex((o) => o.id === c.order);
  if (orderIndex >= 0) {
    const order = s.orders[orderIndex]!;
    if (order.state === OrderState.Ready) {
      const slot = s.map.passSlots[order.slot]!;
      emit(s, Ev.Poof, slot.x, slot.y);
    }
    // A plated dish nobody will eat still dirtied a plate.
    if (order.state === OrderState.Plating || order.state === OrderState.Ready || order.state === OrderState.Carried) s.dirtyPlates += 1;
    s.orders.splice(orderIndex, 1);
  }
  sendHome(s, c);
}

/** A free table with a chair for everyone; a short walk, and a table for two only when needed. */
export function tableFor(s: GameState, size: number, from: Point): Table | undefined {
  let table: Table | undefined;
  let best = Infinity;
  for (const t of s.tables) {
    if (t.state !== TableState.Free || t.seats < size) continue;
    const score = Math.hypot(t.x - from.x, t.y - from.y) + (t.seats - size) * 6;
    if (score < best) {
      best = score;
      table = t;
    }
  }
  return table;
}

/** Manager action: seat someone from the line (and whoever came with them) at a table that fits. */
/** Sends the party to a free table; `hostId`: the host walking them there (and bringing the menus). */
export function seatCustomer(s: GameState, c: Customer, hostId = -1): boolean {
  const leader = leaderOf(s, c);
  const table = tableFor(s, leader.partySize, leader);
  if (!table) {
    emote(c, Emote.Exclaim);
    emit(s, Ev.NoTable, c.x, c.y);
    return false;
  }
  table.state = TableState.Reserved;
  table.since = s.time;
  partyOf(s, leader).forEach((m, seat) => {
    if (m.patience >= 0) endWait(m);
    table.party[seat] = m.id;
    m.table = table.index;
    m.seat = seat;
    m.queueSlot = -1;
    m.bubble = Bubble.None;
    m.expression = Expression.Happy;
    m.path = route(s, m, chairOf(table, seat));
    m.menuFrom = hostId;
    setState(m, CustomerState.ToTable);
  });
  return true;
}

/** What one dish sells for right now: base price x its recipe level x kitchen quality. */
export function dishPrice(s: GameState, dish: number): Big {
  return big(dishDef(dish).price).mul(s.mods.price[dish]! * s.mods.quality).floor();
}

function chooseDish(s: GameState, type: CustomerType): number {
  const menu: DishDef[] = DISHES.filter((d) => s.mods.menu[d.id]);
  if (type.order === 'priciest') return menu.reduce((a, b) => (dishPrice(s, b.id).gt(dishPrice(s, a.id)) ? b : a)).id;
  if (type.order === 'cheapest') return menu.reduce((a, b) => (dishPrice(s, b.id).lt(dishPrice(s, a.id)) ? b : a)).id;
  return pick(s.rng, menu).id;
}

/** The dish landed on the table. `quality` = the cook's touch (price), `tipBoost` = the server's charm. */
export function startEating(s: GameState, c: Customer, dish: number, quality: number, tipBoost: number): void {
  c.dishQuality = quality;
  c.tipBoost = tipBoost;
  c.foodWaited = c.patienceMax - c.patienceLeft;
  endWait(c);
  const t = s.tables[c.table]!;
  t.state = TableState.Occupied;
  t.dishes[c.seat] = dish;
  t.since = s.time;
  c.order = -1;
  c.bubble = Bubble.None;
  c.held = Held.None;
  c.expression = Expression.Eating;
  setPose(c, Pose.SitEat);
  setState(c, CustomerState.Eating);
}

function pay(s: GameState, c: Customer): void {
  const type = CUSTOMER_TYPES[c.type];
  const mood = c.moodCount > 0 ? c.moodSum / c.moodCount : 1;
  // Good service is worth more than the tip: the whole bill follows the grade.
  const stars = serviceStars(mood);
  // A shop boost multiplies the whole bill (and so the tip).
  // So do the festival trophies, and tourists on holiday pay more.
  // The guide's stars too: people come for them and pay for them.
  const extra = festivalBonus(s) * (c.tourist ? 1 + BUS.payBonus : 1) * guidePrice(s);
  const price = dishPrice(s, c.dish).mul(c.dishQuality * serviceMult(stars) * boostNow(s) * extra).floor();
  s.combo = s.time - s.lastPayTime <= ECONOMY.comboWindowSeconds ? Math.min(ECONOMY.comboMax, s.combo + 1) : 1;
  s.stats.bestCombo = Math.max(s.stats.bestCombo, s.combo);
  s.lastPayTime = s.time;
  const comboMult = 1 + ECONOMY.comboTipBonusPerStep * (s.combo - 1);
  let tipShare = type.tipRate * (ECONOMY.tipMoodBase + mood) * comboMult;
  if (type.fastBonus > 0 && c.foodWaited <= type.foodPatience * s.mods.patience * type.fastShare) tipShare += type.fastBonus;
  const tip = price.mul(tipShare * s.mods.tips * c.tipBoost).floor();
  s.coins = s.coins.add(price).add(tip);
  s.stats.earned = s.stats.earned.add(price).add(tip);
  s.stats.served += 1;
  emit(s, Ev.Coins, c.x, c.y, price.toNumber());
  if (tip.gt(0)) emit(s, Ev.Tip, c.x, c.y, tip.toNumber());
  if (s.combo >= 2) emit(s, Ev.Combo, c.x, c.y, s.combo);
  emit(s, Ev.Service, c.x, c.y, stars);
  maybeReview(s, c, stars, price.add(tip));
  inspectorLeaves(s, c, false);
  vipBonus(s, c, stars);
  festivalPoints(s, c, stars);

  const r = ECONOMY.rating;
  if (mood >= ECONOMY.happyMood) {
    emote(c, Emote.Heart);
    c.expression = Expression.Happy;
    changeRating(s, r.happy, c);
  } else if (mood < ECONOMY.angryMood) {
    emote(c, Emote.Anger);
    c.expression = Expression.Angry;
    changeRating(s, r.angry, c);
  } else {
    c.expression = Expression.Neutral;
    changeRating(s, r.neutral, c);
  }
  setPose(c, Pose.Sit);
  setState(c, CustomerState.Paying);
}

/** A friend in line stays next to their leader as the line moves up. */
function followLeader(s: GameState, c: Customer, dt: number): void {
  const leader = leaderOf(s, c);
  if (leader.queueSlot >= 0) {
    const spot = queueSpot(s, c, leader.queueSlot);
    const end = c.path[c.path.length - 1] ?? c;
    if (Math.hypot(end.x - spot.x, end.y - spot.y) > 0.05) c.path = route(s, c, spot);
  }
  if (c.path.length > 0 && followPath(c, c.path, c.walkSpeed, dt)) {
    setPose(c, Pose.Idle);
    c.facing = Facing.BackLeft;
  }
}

export function updateCustomers(s: GameState, dt: number): void {
  for (const c of s.customers) {
    c.stateTime += dt;
    // A guest at the bar has a day of their own (src/sim/game/bar.ts).
    if (c.stool >= 0) {
      updateBarGuest(s, c, dt, (m) => sendHome(s, m), () => {
        s.stats.walkouts += 1;
        changeRating(s, ECONOMY.rating.walkout, c);
      });
      continue;
    }
    switch (c.state) {
      case CustomerState.Arriving:
        if (followPath(c, c.path, c.walkSpeed, dt)) {
          setPose(c, Pose.Idle);
          c.facing = Facing.BackLeft;
          // The party's leader asks for a table and keeps the time; friends just wait with them.
          if (c.party === c.id) {
            c.bubble = Bubble.Seat;
            startWait(c, CUSTOMER_TYPES[c.type].queuePatience * s.mods.patience * weatherPatience(s.day));
          }
          setState(c, CustomerState.Queued);
        }
        break;
      case CustomerState.Queued: {
        if (c.party !== c.id) {
          followLeader(s, c, dt);
          break;
        }
        // Shuffle forward when the spot ahead frees up.
        const ahead = c.queueSlot - 1;
        if (c.path.length === 0 && ahead >= 0 && !s.customers.some((o) => o.queueSlot === ahead)) {
          c.queueSlot = ahead;
          c.path = route(s, c, queueSpot(s, c, ahead));
        }
        if (c.path.length > 0 && followPath(c, c.path, c.walkSpeed, dt)) {
          setPose(c, Pose.Idle);
          c.facing = Facing.BackLeft;
        }
        drainPatience(c, dt);
        // Standing still and running out of patience: tapping a foot (just the look).
        if (c.path.length === 0) setPose(c, c.patience < ANIM.impatientBelow ? Pose.Impatient : Pose.Idle);
        if (c.patienceLeft <= 0) walkout(s, c);
        break;
      }
      case CustomerState.ToTable:
        if (followPath(c, c.path, c.walkSpeed, dt)) {
          setPose(c, Pose.Sit);
          // A chair on the -x side faces the table toward +x, the one opposite faces back toward -x.
          c.facing = seatOffset(s.tables[c.table]!, c.seat).x > 0 ? Facing.BackLeft : Facing.FrontRight;
          // The menu is on the table, or on its way in the host's hand.
          c.held = c.menuFrom >= 0 ? Held.None : Held.Menu;
          setState(c, CustomerState.Reading);
        }
        break;
      case CustomerState.Reading:
        if (c.menuFrom >= 0) {
          // Waiting for the host to hand over the menu (not forever: it is on the table too).
          if (c.stateTime < KITCHEN.menuWaitSeconds) break;
          c.menuFrom = -1;
          c.held = Held.Menu;
          c.stateTime = 0;
        }
        if (c.stateTime >= ECONOMY.readMenuSeconds) {
          c.dish = c.inspector
            ? inspectorDish(s, c, DISHES.filter((d) => s.mods.menu[d.id]).map((d) => d.id), (dish) => dishPrice(s, dish).toNumber())
            : chooseDish(s, CUSTOMER_TYPES[c.type]);
          const id = s.nextId++;
          s.orders.push({ id, customer: c.id, dish: c.dish, state: OrderState.Queued, progress: 0, slot: -1, since: s.time, landsAt: 0, waiter: -1, quality: 1, delivery: false });
          c.order = id;
          maybeOrderDrink(s, c);
          c.held = Held.None;
          c.bubble = Bubble.DishBase + c.dish;
          startWait(c, CUSTOMER_TYPES[c.type].foodPatience * s.mods.patience * weatherPatience(s.day));
          setState(c, CustomerState.Waiting);
        }
        break;
      case CustomerState.Waiting: {
        // Patience pauses while the dish is already on its way to them.
        const flying = s.orders.some((o) => o.id === c.order && (o.state === OrderState.Flying || o.state === OrderState.Carried));
        if (!flying) {
          drainPatience(c, dt);
          if (c.patienceLeft <= 0) walkout(s, c);
        }
        // Some pass the wait on their phone, until they get fed up (just the look; by their id).
        if (c.state === CustomerState.Waiting) c.held = phoneUser(c) && c.stateTime > ANIM.phoneAfter && c.patience > ANIM.impatientBelow ? Held.Phone : Held.None;
        break;
      }
      case CustomerState.Eating:
        if (c.stateTime >= dishDef(c.dish).eatSeconds) pay(s, c);
        break;
      case CustomerState.Paying: {
        // Friends leave together, once everyone at the table has paid.
        const t = s.tables[c.table]!;
        const done = (id: number) => {
          const m = s.customers.find((o) => o.id === id);
          return !m || m.table !== t.index || (m.state === CustomerState.Paying && m.stateTime >= ECONOMY.paySeconds);
        };
        if (t.party.every((id) => id < 0 || done(id))) {
          const party = t.party.map((id) => s.customers.find((o) => o.id === id)).filter((m): m is Customer => m !== undefined);
          vacate(s, t);
          for (const m of party) sendHome(s, m);
        }
        break;
      }
      case CustomerState.Leaving:
        followPath(c, c.path, c.walkSpeed, dt);
        break;
    }
  }
  s.customers = s.customers.filter((c) => !(c.state === CustomerState.Leaving && c.path.length === 0));
}
