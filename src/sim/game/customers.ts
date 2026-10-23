import { requestTip, rollRequest } from './service';
import { leaveAfterMeal, updateRestroomGuest } from './restroom';
import { CUSTOMER_TYPE_LIST, CUSTOMER_TYPES, KID_RANK, PARTY, PATIENCE_ICON, type CustomerType } from '../../data/customers';
import { weatherArrivals, weatherPatience } from '../weather';
import { DISHES, dishDef, type DishDef } from '../../data/dishes';
import { GUIDE } from '../../data/guide';
import { DESSERT } from '../../data/desserts';
import { chooseDessert, dessertShare, wantsDessert } from './desserts';
import { gainXp as chefXp } from '../chef';
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
import { attentionTip, guideArrivals, guidePrice, inspectorDish, inspectorDue, inspectorLeaves, lookalikeDue, makeInspector, makeLookalike } from './guide';
import { BUS } from '../../data/events';
import { barStoolsFor, cancelDrinks, maybeBarDrink, maybeOrderDrink, offStool, STOOL_LIFT, takeStool, updateBarGuest } from './bar';
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
  if (s.construction || s.closed || s.time < s.nextArrival) return;
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
  // Tables joined for eight or ten (owner M30): some groups are whole parties of 7 up to the
  // longest table's chairs, the more such tables the more often (a table joined is an invitation).
  const banquets = pair ? s.tables.filter((t) => t.seats > 6) : [];
  const most = banquets.reduce((m, t) => Math.max(m, t.seats), 0);
  const feast = banquets.length > 0 && hash01(s.nextId * 4.13 + 0.29) < Math.min(PARTY.banquetMax, PARTY.banquetChance * banquets.length);
  const size = feast
    ? 7 + Math.floor(hash01(s.nextId * 6.71 + 0.17) * (most - 6))
    : crowd
      ? hash01(s.nextId * 2.37 + 0.5) < 0.5 ? 6 : 5
      : family ? (roll < (PARTY.familyChance * familyTables) / pairTables / 2 ? 4 : 3) : pair ? 2 : 1;
  const leader = newCustomer(s, type, start, slot, -1, size);
  if (look) leader.look = { ...look };
  maybeVip(s, leader);
  s.customers.push(leader);
  // Today's inspector is the next guest who comes alone (they take a table, not the bar).
  if (size === 1 && !leader.vip && inspectorDue(s)) {
    makeInspector(s, leader);
    return leader;
  }
  // On a rumor day, look-alikes in suits come too (a table, never the bar: they are suspects).
  if (size === 1 && !leader.vip && lookalikeDue(s)) {
    makeLookalike(s, leader);
    return leader;
  }
  // Someone alone, or a pair, may sit at the bar instead of waiting in line (owner: "guests
  // can sit at the bar too"): most for a meal, some for a drink.
  const bar = barStoolsFor(s, leader, size);
  if (bar) {
    // The friend first, while the leader still holds their place in line (a newcomer heads for it).
    if (bar.stools[1] !== undefined) {
      const o = PARTY.spawnOffsets[0]!;
      const friend = newCustomer(s, type, { x: start.x + o.x, y: start.y + o.y }, -1, leader.id, size);
      takeStool(s, friend, bar.stools[1], bar.meal);
      friend.path = route(s, friend, s.map.bar.stools[friend.stool]!.at);
      s.customers.push(friend);
    }
    takeStool(s, leader, bar.stools[0]!, bar.meal);
    leader.path = route(s, leader, s.map.bar.stools[leader.stool]!.at);
    return leader;
  }
  for (let m = 1; m < size; m++) {
    const o = PARTY.spawnOffsets[(m - 1) % PARTY.spawnOffsets.length]!;
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
  if (s.construction || s.closed) return null;
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
  // The head chef came out to greet them: they wait happily for longer.
  c.patienceLeft = Math.max(0, c.patienceLeft - (c.attention ? dt * GUIDE.attentionPatience : dt));
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

export function changeRating(s: GameState, delta: number, at: Point): void {
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
  // Sent off from inside a restroom stall (the place closing for building work): seen again.
  c.hidden = false;
  setState(c, CustomerState.Leaving);
}

/** Closing (for building work, or the player's sign): the line goes home, smiling (no rating hit). */
export function sendLineHome(s: GameState): void {
  for (const c of s.customers) {
    if (c.state === CustomerState.Arriving || c.state === CustomerState.Queued) {
      c.emote = Emote.Music;
      c.emoteTime = 0;
      sendHome(s, c);
    }
  }
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
  if (c.table >= 0) {
    const t = s.tables[c.table]!;
    t.state = TableState.Occupied;
    t.dishes[c.seat] = dish;
    t.since = s.time;
  } else c.barDish = dish;
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
  // A dessert eaten is on the bill too (a share of the main course, src/data/desserts.ts).
  const price = dishPrice(s, c.dish).mul(c.dishQuality * serviceMult(stars) * boostNow(s) * extra * (1 + dessertShare(c))).floor();
  s.combo = s.time - s.lastPayTime <= ECONOMY.comboWindowSeconds ? Math.min(ECONOMY.comboMax, s.combo + 1) : 1;
  s.stats.bestCombo = Math.max(s.stats.bestCombo, s.combo);
  s.lastPayTime = s.time;
  const comboMult = 1 + ECONOMY.comboTipBonusPerStep * (s.combo - 1);
  let tipShare = type.tipRate * (ECONOMY.tipMoodBase + mood) * comboMult;
  if (type.fastBonus > 0 && c.foodWaited <= type.foodPatience * s.mods.patience * type.fastShare) tipShare += type.fastBonus;
  // A look-alike the head chef cooked for leaves a thank-you on top.
  // A special request made right: a thank-you on top (src/sim/game/service.ts).
  const tip = price.mul(tipShare * s.mods.tips * c.tipBoost + attentionTip(c) + requestTip(s, c)).floor();
  s.coins = s.coins.add(price).add(tip);
  s.stats.earned = s.stats.earned.add(price).add(tip);
  s.stats.served += 1;
  chefXp(s, 'served');
  if (stars >= 5) chefXp(s, 'fiveStar');
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

/** Seconds after taking the menu that it comes open in their hands. */
const MENU_OPENS = 0.45;

/** They read the menu: the order goes to the kitchen, its picture over their head, and the wait starts. */
function orderMeal(s: GameState, c: Customer): void {
  c.dish = c.inspector
    ? inspectorDish(s, c, DISHES.filter((d) => s.mods.menu[d.id]).map((d) => d.id), (dish) => dishPrice(s, dish).toNumber())
    : chooseDish(s, CUSTOMER_TYPES[c.type]);
  const id = s.nextId++;
  s.orders.push({ id, customer: c.id, dish: c.dish, state: OrderState.Queued, progress: 0, slot: -1, since: s.time, landsAt: 0, waiter: -1, quality: 1, delivery: false });
  // Owner M49: spicy, vegan or gluten-free, please (shown on their bubble and the ticket).
  const request = rollRequest(s, c);
  if (request !== undefined) s.orders[s.orders.length - 1]!.request = request;
  c.order = id;
  // The head chef's guest: their ticket goes first.
  if (c.attention) s.orders.unshift(s.orders.pop()!);
  c.held = Held.None;
  c.bubble = Bubble.DishBase + c.dish;
  startWait(c, CUSTOMER_TYPES[c.type].foodPatience * s.mods.patience * weatherPatience(s.day));
  setState(c, CustomerState.Waiting);
}

/**
 * A meal at the bar (owner: "guests can sit at the bar too"): onto the stool, the menu, the
 * order (and a drink from the bartender, when there is one); a waiter sets the plate on the
 * counter; they eat, pay, and go when their friend is done too.
 */
function updateBarDiner(s: GameState, c: Customer, dt: number): void {
  const stool = s.map.bar.stools[c.stool];
  if (!stool) {
    offStool(s, c);
    sendHome(s, c);
    return;
  }
  switch (c.state) {
    case CustomerState.ToTable:
      if (c.path.length === 0 || followPath(c, c.path, c.walkSpeed, dt)) {
        c.x = stool.at.x;
        c.y = stool.at.y;
        c.facing = stool.facing;
        c.lift = STOOL_LIFT;
        setPose(c, Pose.Sit);
        c.held = Held.Menu;
        setState(c, CustomerState.Reading);
      }
      break;
    case CustomerState.Reading:
      if (c.held === Held.Menu && c.stateTime >= MENU_OPENS) c.held = Held.MenuOpen;
      if (c.stateTime >= ECONOMY.readMenuSeconds) {
        orderMeal(s, c);
        maybeBarDrink(s, c);
      }
      break;
    case CustomerState.Waiting: {
      const flying = s.orders.some((o) => o.id === c.order && (o.state === OrderState.Flying || o.state === OrderState.Carried));
      if (!flying) drainPatience(c, dt);
      if (c.patienceLeft <= 0) {
        for (const m of partyOf(s, c)) if (m.stool >= 0) offStool(s, m);
        walkout(s, c);
      } else c.held = phoneUser(c) && c.stateTime > ANIM.phoneAfter && c.patience > ANIM.impatientBelow ? Held.Phone : Held.None;
      break;
    }
    case CustomerState.Eating:
      if (c.stateTime >= dishDef(c.dish).eatSeconds) {
        // The empty plate goes back over the counter to the dish pile.
        c.barDish = -1;
        c.sipping = -1;
        s.dirtyPlates += 1;
        pay(s, c);
      }
      break;
    case CustomerState.Paying: {
      if (c.stateTime < ECONOMY.paySeconds) break;
      c.barDone = true;
      // Friends at the bar go together.
      const party = partyOf(s, c);
      if (party.every((m) => m.barDone || m.stool < 0)) {
        for (const m of party) {
          if (m.stool < 0) continue;
          offStool(s, m);
          leaveAfterMeal(s, m);
        }
      }
      break;
    }
    default:
      break;
  }
}

/** The dessert: reading the small menu, waiting for it (patiently: they skip it if it never comes), eating it, then the bill. */
function updateDessertGuest(s: GameState, c: Customer, dt: number): void {
  if (c.dessertPhase === 'menu') {
    if (c.stateTime < DESSERT.readSeconds) return;
    c.dessert = chooseDessert(s, c);
    s.desserts.push({ id: s.nextId++, customer: c.id, dessert: c.dessert, waiter: -1 });
    c.held = Held.None;
    c.bubble = Bubble.DessertBase + c.dessert;
    startWait(c, DESSERT.patience * s.mods.patience);
    c.dessertPhase = 'wait';
    c.stateTime = 0;
    return;
  }
  if (c.dessertPhase === 'wait') {
    drainPatience(c, dt);
    if (c.patienceLeft > 0) return;
    // It never came: no dessert, and the bill (the wait counts against the service).
    s.desserts = s.desserts.filter((d) => d.customer !== c.id);
    endWait(c);
    c.bubble = Bubble.None;
    c.dessertPhase = undefined;
    pay(s, c);
    return;
  }
  // Eating it; when the patience bar was on, the wait counted once it came.
  if (c.patience >= 0) endWait(c);
  if (c.stateTime >= DESSERT.eatSeconds) {
    c.dessertServed = true;
    c.dessertPhase = undefined;
    pay(s, c);
  }
}

export function updateCustomers(s: GameState, dt: number): void {
  for (const c of s.customers) {
    c.stateTime += dt;
    // A guest at the bar has a day of their own (src/sim/game/bar.ts).
    if (c.stool >= 0 && c.barMeal) {
      updateBarDiner(s, c, dt);
      continue;
    }
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
        // Owner M45: the menu comes open in their hands after a moment; they read, then choose.
        if (c.held === Held.Menu && c.stateTime >= MENU_OPENS) c.held = Held.MenuOpen;
        if (c.stateTime >= ECONOMY.readMenuSeconds) {
          orderMeal(s, c);
          maybeOrderDrink(s, c);
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
        // The inspector's tell: now and then a few words in a small notebook. Look-alikes are on their phones.
        if (c.state === CustomerState.Waiting && c.inspector) c.held = c.stateTime % GUIDE.noteEvery < GUIDE.noteSeconds ? Held.Notebook : Held.None;
        else if (c.state === CustomerState.Waiting) c.held = (phoneUser(c) || c.suspect) && c.stateTime > ANIM.phoneAfter && c.patience > ANIM.impatientBelow ? Held.Phone : Held.None;
        break;
      }
      case CustomerState.Eating:
        if (c.dessertPhase) updateDessertGuest(s, c, dt);
        else if (c.stateTime >= dishDef(c.dish).eatSeconds) {
          // Done with the main course: the dessert menu, sometimes (owner M45).
          if (wantsDessert(s, c)) {
            c.dessertPhase = 'menu';
            c.held = Held.DessertMenu;
            c.expression = Expression.Happy;
            c.stateTime = 0;
            setPose(c, Pose.Sit);
          } else pay(s, c);
        }
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
          // Home, or the restroom first (owner M36).
          for (const m of party) leaveAfterMeal(s, m);
        }
        break;
      }
      case CustomerState.Leaving:
        followPath(c, c.path, c.walkSpeed, dt);
        break;
      case CustomerState.Restroom:
        updateRestroomGuest(s, c, dt);
        break;
    }
  }
  s.customers = s.customers.filter((c) => !(c.state === CustomerState.Leaving && c.path.length === 0));
}
