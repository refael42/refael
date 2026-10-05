import { CUSTOMER_TYPE_LIST, CUSTOMER_TYPES, type CustomerType } from '../../data/customers';
import { DISHES, dishDef, type DishDef } from '../../data/dishes';
import { ECONOMY } from '../../data/economy';
import { CHAIR_OFFSET, type Point } from '../../data/maps';
import { big, type Big } from '../big';
import { findPath } from '../grid';
import { customerLook } from '../looks';
import { followPath, setPose } from '../movement';
import { next, pick, range, type Rng } from '../rng';
import { Bubble, Emote, Expression, Facing, Held, Pose } from '../types';
import { emit, Ev } from './events';
import { CustomerState, OrderState, TableState, type Customer, type GameState, type Table } from './types';

export const chairOf = (t: Table): Point => ({ x: t.x + CHAIR_OFFSET.x, y: t.y + CHAIR_OFFSET.y });

function pickType(rng: Rng): CustomerType {
  const total = CUSTOMER_TYPE_LIST.reduce((sum, t) => sum + t.weight, 0);
  let roll = next(rng) * total;
  for (const t of CUSTOMER_TYPE_LIST) {
    roll -= t.weight;
    if (roll < 0) return t;
  }
  return CUSTOMER_TYPE_LIST[0]!;
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
  const perSecond = ((ECONOMY.baseArrivalsPerMinute + ECONOMY.arrivalsPerStar * s.rating) * s.mods.arrivals) / 60;
  const gap = -Math.log(1 - next(s.rng)) / perSecond;
  s.nextArrival = s.time + Math.min(ECONOMY.maxArrivalGapSeconds, gap);
  const slot = freeQueueSlot(s);
  if (slot < 0) return; // The line is full: this one walks on by.
  const type = pickType(s.rng);
  const spawn = s.stats.served === 0 && s.customers.length === 0 ? s.map.firstSpawn : pick(s.rng, s.map.spawns);
  const start = { x: spawn.x, y: spawn.y + range(s.rng, -0.3, 0.3) };
  s.customers.push({
    id: s.nextId++,
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
    path: route(s, start, s.map.queue[slot]!),
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
  });
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
  c.path = route(s, c, pick(s.rng, s.map.spawns));
  c.queueSlot = -1;
  c.table = -1;
  c.bubble = Bubble.None;
  c.patience = -1;
  c.held = Held.None;
  setState(c, CustomerState.Leaving);
}

/** Ran out of patience: no money, lower rating, and everyone sees them go. */
function walkout(s: GameState, c: Customer): void {
  s.stats.walkouts += 1;
  emote(c, Emote.Anger);
  c.expression = Expression.Angry;
  emit(s, Ev.Poof, c.x, c.y);
  changeRating(s, ECONOMY.rating.walkout, c);
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
  if (c.table >= 0) {
    const t = s.tables[c.table]!;
    t.state = TableState.Free;
    t.customer = -1;
    t.since = s.time;
  }
  sendHome(s, c);
}

/** Manager action: seat a customer from the line at the nearest free table (shortest walk). */
export function seatCustomer(s: GameState, c: Customer): boolean {
  let table: Table | undefined;
  let best = Infinity;
  for (const t of s.tables) {
    const d = Math.hypot(t.x - c.x, t.y - c.y);
    if (t.state === TableState.Free && d < best) {
      best = d;
      table = t;
    }
  }
  if (!table) {
    emote(c, Emote.Exclaim);
    emit(s, Ev.NoTable, c.x, c.y);
    return false;
  }
  endWait(c);
  table.state = TableState.Reserved;
  table.customer = c.id;
  table.since = s.time;
  c.table = table.index;
  c.queueSlot = -1;
  c.bubble = Bubble.None;
  c.expression = Expression.Happy;
  c.path = route(s, c, chairOf(table));
  setState(c, CustomerState.ToTable);
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
  t.dish = dish;
  t.since = s.time;
  c.order = -1;
  c.bubble = Bubble.None;
  c.expression = Expression.Eating;
  setPose(c, Pose.SitEat);
  setState(c, CustomerState.Eating);
}

function pay(s: GameState, c: Customer): void {
  const type = CUSTOMER_TYPES[c.type];
  const price = dishPrice(s, c.dish).mul(c.dishQuality).floor();
  const mood = c.moodCount > 0 ? c.moodSum / c.moodCount : 1;
  s.combo = s.time - s.lastPayTime <= ECONOMY.comboWindowSeconds ? Math.min(ECONOMY.comboMax, s.combo + 1) : 1;
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

export function updateCustomers(s: GameState, dt: number): void {
  for (const c of s.customers) {
    c.stateTime += dt;
    switch (c.state) {
      case CustomerState.Arriving:
        if (followPath(c, c.path, c.walkSpeed, dt)) {
          setPose(c, Pose.Idle);
          c.facing = Facing.BackLeft;
          c.bubble = Bubble.Seat;
          startWait(c, CUSTOMER_TYPES[c.type].queuePatience * s.mods.patience);
          setState(c, CustomerState.Queued);
        }
        break;
      case CustomerState.Queued: {
        // Shuffle forward when the spot ahead frees up.
        const ahead = c.queueSlot - 1;
        if (c.path.length === 0 && ahead >= 0 && !s.customers.some((o) => o.queueSlot === ahead)) {
          c.queueSlot = ahead;
          c.path = route(s, c, s.map.queue[ahead]!);
        }
        if (c.path.length > 0 && followPath(c, c.path, c.walkSpeed, dt)) {
          setPose(c, Pose.Idle);
          c.facing = Facing.BackLeft;
        }
        drainPatience(c, dt);
        if (c.patienceLeft <= 0) walkout(s, c);
        break;
      }
      case CustomerState.ToTable:
        if (followPath(c, c.path, c.walkSpeed, dt)) {
          setPose(c, Pose.Sit);
          c.facing = Facing.FrontRight;
          c.held = Held.Menu;
          setState(c, CustomerState.Reading);
        }
        break;
      case CustomerState.Reading:
        if (c.stateTime >= ECONOMY.readMenuSeconds) {
          c.dish = chooseDish(s, CUSTOMER_TYPES[c.type]);
          const id = s.nextId++;
          s.orders.push({ id, customer: c.id, dish: c.dish, state: OrderState.Queued, progress: 0, slot: -1, since: s.time, landsAt: 0, waiter: -1, quality: 1 });
          c.order = id;
          c.held = Held.None;
          c.bubble = Bubble.DishBase + c.dish;
          startWait(c, CUSTOMER_TYPES[c.type].foodPatience * s.mods.patience);
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
        break;
      }
      case CustomerState.Eating:
        if (c.stateTime >= dishDef(c.dish).eatSeconds) pay(s, c);
        break;
      case CustomerState.Paying:
        if (c.stateTime >= ECONOMY.paySeconds) {
          const t = s.tables[c.table]!;
          t.state = TableState.Dirty;
          t.dish = -1;
          t.customer = -1;
          t.since = s.time;
          sendHome(s, c);
        }
        break;
      case CustomerState.Leaving:
        followPath(c, c.path, c.walkSpeed, dt);
        break;
    }
  }
  s.customers = s.customers.filter((c) => !(c.state === CustomerState.Leaving && c.path.length === 0));
}
