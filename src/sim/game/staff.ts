import { dishDef } from '../../data/dishes';
import { ECONOMY } from '../../data/economy';
import type { Point } from '../../data/maps';
import { serveSpot } from '../../data/tables';
import { KITCHEN, PROMO, ROLES, SHIFT, STAFF, type Role } from '../../data/staff';
import { KITCHEN_LINE, stationOf } from '../../data/kitchen';
import { TRAIT_FX } from '../../data/traits';
import { facingFor, followPath, setPose } from '../movement';
import { chance } from '../rng';
import { Bubble, Emote, Expression, Facing, Held, Pose, PropKind } from '../types';
import { dishSpot, emote, route, seatCustomer, startEating, tableFor, walkIn } from './customers';
import { emit, Ev } from './events';
import { has, managerOnShift, statFactor, workRate } from './people';
import { CustomerState, OrderState, TableState, type Customer, type GameState, type KitchenSpot, type Order, type Person, type Staff, type Table } from './types';
import { gainXp, walkOut } from './workers';
import { updateCourier } from './delivery';
import { updateChecker } from './checker';
import { freeDeliverySlot, packersOn, packingProgress, parking, slotPoint, updatePacker } from './packing';
import { PACKING } from '../../data/delivery';
import { readyDrink, updateBartender, updateDrinkRun } from './bar';
import { chefTouch, inspectPlate, recordPlate } from './guide';

/** Where a waiter stands to serve or clear a table: the open side, facing the table. */
export const besideTable = (t: Table): Point => serveSpot(t.x, t.y);
/** ...facing the table from there. */
const FACING_TABLE = Facing.BackRight;

/** Each worker's own spot: their stove, their idle place, the host stand... */
export function homeOf(s: GameState, st: Staff): Point {
  switch (st.role) {
    case 'cook':
      // Waiting at "their" station (cooks are not tied to it: they go where the ticket's dish is made).
      return s.stoves[st.slot % Math.max(1, s.stoves.length)]?.cook ?? s.map.stoves[0]!.cook;
    case 'waiter':
      return s.map.waiterIdle[st.slot % s.map.waiterIdle.length]!;
    case 'washer':
      return st.slot > 0 ? (s.map.extraSinks[st.slot - 1]?.washer ?? s.map.washerSpot) : s.map.washerSpot;
    case 'host':
      return s.map.hostSpots[st.slot % s.map.hostSpots.length] ?? s.map.hostSpot;
    case 'cleaner':
      return s.map.cleanerIdle[st.slot % s.map.cleanerIdle.length]!;
    case 'manager':
      return s.map.managerSpot;
    case 'promoter':
      return s.map.promoterSpots[st.slot % s.map.promoterSpots.length]!;
    case 'courier':
      return parking(s, st.slot, true);
    case 'checker':
      return s.map.checkerSpot;
    case 'packer': {
      const spots = s.map.packing?.spots ?? [s.map.washerSpot];
      return spots[st.slot % spots.length]!;
    }
    case 'bartender':
      // Behind the counter, the first one by the pass.
      return s.map.bar.stations[st.slot % s.map.bar.stations.length]!;
  }
}

const HOME_FACING: Record<Role, Staff['facing']> = {
  cook: Facing.BackLeft,
  waiter: Facing.FrontLeft,
  washer: Facing.BackLeft,
  host: Facing.FrontRight,
  cleaner: Facing.FrontLeft,
  // Looking out over the dining room.
  manager: Facing.FrontRight,
  // Facing the street.
  promoter: Facing.FrontLeft,
  // Beside the scooter, looking up the road for the next ride.
  courier: Facing.BackLeft,
  // Down along the pass, over the dishes.
  checker: Facing.FrontLeft,
  packer: Facing.FrontLeft,
  // Across the counter, toward the room.
  bartender: Facing.FrontRight,
};

/** What each job carries when not carrying food or plates. */
const TOOL: Partial<Record<Role, Held>> = { cook: Held.Spatula, manager: Held.Clipboard, promoter: Held.Flyers, host: Held.Menu, checker: Held.Clipboard };

/** The first free slot for a job (stoves for cooks, idle spots for the others). */
export function freeSlot(s: GameState, role: Role, except?: Staff): number {
  for (let i = 0; ; i++) {
    if (!s.staff.some((o) => o !== except && o.role === role && o.slot === i && !o.leaving)) return i;
  }
}

/** A hired person, standing at `at` (the door for new hires). */
export function createStaff(s: GameState, role: Role, person: Person, look: Staff['look'], at?: Point): Staff {
  const st: Staff = {
    ...person,
    id: s.nextId++,
    role,
    look,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    facing: HOME_FACING[role],
    pose: Pose.Idle,
    poseTime: 0,
    held: TOOL[role] ?? Held.None,
    expression: Expression.Happy,
    emote: 0,
    emoteTime: 0,
    patience: -1,
    bubble: 0,
    speed: ROLES[role].walkSpeed,
    path: [],
    job: null,
    jobTime: 0,
    stalled: null,
    xp: 0,
    morale: STAFF.morale.start,
    energy: 1,
    unpaidDays: 0,
    hiredDay: s.day,
    lastRaiseDay: s.day,
    trial: false,
    scoldUntil: -1,
    slot: 0,
    leaving: false,
    pendingRole: null,
    busy: false,
    away: false,
  };
  st.slot = freeSlot(s, role, st);
  const p = at ?? homeOf(s, st);
  st.x = st.prevX = p.x;
  st.y = st.prevY = p.y;
  return st;
}

function freePassSlot(s: GameState): number {
  for (let i = 0; i < s.map.passSlots.length; i++) {
    if (!s.orders.some((o) => (o.state === OrderState.Ready || o.state === OrderState.Plating) && o.slot === i && !o.lane)) return i;
  }
  return -1;
}

function setJob(st: Staff, job: Staff['job']): void {
  st.job = job;
  st.jobTime = 0;
}

/** Walk toward a point; returns true once standing there. */
export function walkTo(s: GameState, st: Staff, to: Point, dt: number): boolean {
  if (st.path.length === 0 && (Math.abs(st.x - to.x) > 0.01 || Math.abs(st.y - to.y) > 0.01)) st.path = route(s, st, to);
  if (st.path.length === 0) return true;
  return followPath(st, st.path, st.speed * workRate(s, st), dt);
}

function goHome(s: GameState, st: Staff, dt: number): void {
  if (walkTo(s, st, homeOf(s, st), dt)) {
    setPose(st, Pose.Idle);
    st.facing = st.role === 'cook' ? (s.stoves[st.slot % Math.max(1, s.stoves.length)]?.facing ?? HOME_FACING.cook) : HOME_FACING[st.role];
    if (st.job?.kind === 'home') st.job = null;
  }
}

// ---------- cook ----------

/** The pose and the tool for each kind of station (src/data/kitchen.ts order). */
const STATION_POSE: readonly Pose[] = [Pose.Fry, Pose.Flip, Pose.Mix, Pose.Stir, Pose.Toss, Pose.Bake, Pose.Slice];
const STATION_TOOL: readonly Held[] = [Held.Basket, Held.Spatula, Held.Bowl, Held.Ladle, Held.Wok, Held.Peel, Held.Knife];

/** The chef's line: the stations right behind the pass (their cooks set plates straight onto it). */
const onChefLine = (s: GameState, sv: KitchenSpot): boolean => Math.abs(sv.x - (s.map.kitchenX - 2.5)) < 0.01;

/**
 * Where a cook sets this order's plate down: from the chef's line, right where they stand (the
 * pass is just over their station); from the lines behind, at the nearer end of the pass; a
 * delivery on the deliveries' own pass.
 */
function dropPoint(s: GameState, st: Staff, o: Order, sv: KitchenSpot | undefined): Point {
  if (o.lane && s.map.packing) return s.map.packing.pickups[o.slot] ?? s.map.packing.pickups[0]!;
  if (sv && onChefLine(s, sv)) return sv.cook;
  let best = s.map.passDrops[0]!;
  for (const p of s.map.passDrops) if (Math.hypot(p.x - st.x, p.y - st.y) < Math.hypot(best.x - st.x, best.y - st.y)) best = p;
  return best;
}

/** A free pass slot, the one in front of this chef's-line station first (no plate slides along the pass then). */
function passSlotFor(s: GameState, sv: KitchenSpot): number {
  if (onChefLine(s, sv)) {
    const mine = s.map.passSlots.findIndex((p) => Math.abs(p.y - sv.y) < 0.01);
    if (mine >= 0 && !s.orders.some((o) => (o.state === OrderState.Ready || o.state === OrderState.Plating) && o.slot === mine && !o.lane)) return mine;
  }
  return freePassSlot(s);
}

/**
 * The station for a ticket: a free one of its dish's kind, this cook's own first (where they
 * wait), then one no other idle cook is standing at, nearest first. -1 = all busy.
 */
function stationFor(s: GameState, st: Staff, dish: number): number {
  const type = stationOf(dish);
  const own = s.stoves[st.slot % Math.max(1, s.stoves.length)];
  if (own && own.type === type && own.user < 0) return st.slot % s.stoves.length;
  const homes = new Set(s.staff.filter((o) => o !== st && o.role === 'cook' && !o.job).map((o) => o.slot % Math.max(1, s.stoves.length)));
  let best = -1;
  let bestScore = Infinity;
  s.stoves.forEach((sv, i) => {
    if (sv.type !== type || sv.user >= 0) return;
    // The walk there, and the walk with the plate to the pass after (none from the chef's line).
    const toPass = onChefLine(s, sv) ? 0 : Math.min(...s.map.passDrops.map((p) => Math.hypot(p.x - sv.cook.x, p.y - sv.cook.y)));
    const score = Math.hypot(sv.cook.x - st.x, sv.cook.y - st.y) + toPass + (homes.has(i) ? 50 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** Lets go of the station (and what was on it). */
function freeStation(s: GameState, i: number): void {
  const sv = s.stoves[i];
  if (!sv) return;
  sv.user = -1;
  sv.dish = -1;
}

/**
 * A cook's shift (owner M29): the oldest ticket a free station can take; walk there; cook it
 * the way that station cooks; plate it there (a clean plate, a delivery goes in a box); then
 * carry it to the pass and set it down: only then is it ready for the waiters.
 */
function updateCook(s: GameState, st: Staff, dt: number): boolean {
  let job = st.job;
  if (!job || job.kind !== 'cook') {
    if (st.leaving || st.pendingRole) return false;
    let pick: Order | null = null;
    let station = -1;
    for (const o of s.orders) {
      if (o.state !== OrderState.Queued) continue;
      const i = stationFor(s, st, o.dish);
      if (i >= 0) {
        pick = o;
        station = i;
        break;
      }
    }
    if (!pick) {
      st.stalled = null;
      return false;
    }
    pick.state = OrderState.Cooking;
    pick.since = s.time;
    pick.quality = statFactor(st.stats.quality);
    pick.chef = chefTouch(st.stats.quality, st.level);
    const sv = s.stoves[station]!;
    sv.user = st.id;
    sv.dish = -1;
    st.path = [];
    setJob(st, { kind: 'cook', order: pick.id, station, phase: 'toStation' });
    job = st.job!;
  }
  if (job.kind !== 'cook') return false;
  const order = s.orders.find((o) => o.id === job.order);
  const sv = s.stoves[job.station];
  if (!order || !sv) {
    // The guest gave up: the station is free again (a plate already used went to the dirty pile with the order).
    if (sv && sv.user === st.id) freeStation(s, job.station);
    st.held = TOOL.cook!;
    st.stalled = null;
    setJob(st, null);
    return false;
  }
  if (job.phase === 'toStation') {
    st.held = STATION_TOOL[sv.type] ?? Held.Spatula;
    if (!walkTo(s, st, sv.cook, dt)) return true;
    sv.dish = order.dish;
    job.phase = 'cooking';
    st.jobTime = 0;
  }
  const rate = workRate(s, st);
  st.jobTime += dt * rate;
  st.facing = sv.facing;
  if (job.phase === 'cooking') {
    if (order.progress < 1) {
      order.progress = Math.min(1, order.progress + (dt * s.mods.cookSpeed * rate) / dishDef(order.dish).cookSeconds);
      setPose(st, STATION_POSE[sv.type] ?? Pose.Cook);
      st.held = STATION_TOOL[sv.type] ?? Held.Spatula;
      return true;
    }
    // Done: it needs a clean plate (a delivery goes in a box).
    st.stalled = s.cleanPlates <= 0 && !order.delivery ? 'plates' : null;
    if (st.stalled) {
      setPose(st, Pose.Idle);
      if (st.emote === 0) emote(st, Emote.Exclaim);
      return true;
    }
    if (!order.delivery) s.cleanPlates -= 1;
    order.state = OrderState.Plating;
    order.slot = -1;
    setJob(st, { ...job, phase: 'plating' });
    st.held = Held.Tweezers;
    setPose(st, Pose.Plate);
    return true;
  }
  if (job.phase === 'plating') {
    setPose(st, Pose.Plate);
    if (st.jobTime < KITCHEN_LINE.plateSeconds) return true;
    // A free spot on the pass (with packers at work, a delivery goes on the deliveries' own pass).
    const lane = order.delivery && packersOn(s) ? 1 : 0;
    const slot = lane ? freeDeliverySlot(s) : passSlotFor(s, sv);
    st.held = order.delivery ? Held.FoodBox : ((Held.PlateBase + order.dish) as Held);
    if (slot < 0) {
      st.stalled = 'pass';
      setPose(st, Pose.Idle);
      if (st.emote === 0) emote(st, Emote.Exclaim);
      return true;
    }
    st.stalled = null;
    order.slot = slot;
    if (lane) order.lane = 1;
    else delete order.lane;
    const drop = dropPoint(s, st, order, sv);
    freeStation(s, job.station);
    st.path = [];
    setJob(st, { ...job, phase: 'toPass' });
    // From the chef's line the pass is right there.
    if (drop === sv.cook) setJob(st, { ...job, phase: 'placing' });
    return true;
  }
  if (job.phase === 'toPass') {
    if (!walkTo(s, st, dropPoint(s, st, order, undefined), dt)) return true;
    setPose(st, Pose.Place);
    setJob(st, { ...job, phase: 'placing' });
    return true;
  }
  // Setting it down: over the pass toward the room (+x), or onto the deliveries' pass in front (+y).
  st.facing = order.lane ? Facing.FrontLeft : Facing.FrontRight;
  setPose(st, Pose.Place);
  if (st.jobTime < KITCHEN_LINE.placeSeconds) return true;
  order.state = OrderState.Ready;
  order.since = s.time;
  order.readyAt = s.time;
  const p = slotPoint(s, order);
  // The plate goes from the cook's hands onto the pass (from an end of the pass it slides along to its slot).
  if (!order.lane) order.from = { x: st.x + 0.6, y: st.y };
  emit(s, Ev.Ding, p.x, p.y);
  if (chance(s.rng, 0.25)) emote(st, Emote.Star);
  st.held = TOOL.cook!;
  setPose(st, Pose.Idle);
  setJob(st, null);
  gainXp(s, st);
  return true;
}

// ---------- waiter & cleaner ----------

/** How much patience the guest waiting for this order has left (0..1); 1 if they are gone. */
function patienceOf(s: GameState, o: Order): number {
  const c = s.customers.find((x) => x.id === o.customer);
  return c && c.patienceMax > 0 ? c.patienceLeft / c.patienceMax : 1;
}

function findJob(s: GameState, st: Staff): void {
  if (st.role === 'waiter') {
    const manager = managerOnShift(s);
    const ready = s.orders.filter((o) => o.state === OrderState.Ready && o.waiter < 0 && !o.delivery);
    // A shift manager sends the dish whose guest is closest to losing patience; otherwise the oldest goes first.
    ready.sort(manager ? (a, b) => patienceOf(s, a) - patienceOf(s, b) : (a, b) => a.since - b.since);
    const order = ready[0];
    // A drink on the bar's pass that has waited longer than the next dish goes first.
    const drink = readyDrink(s);
    if (drink && (!order || drink.since < order.since)) {
      drink.waiter = st.id;
      st.path = [];
      setJob(st, { kind: 'drinkRun', drink: drink.id, phase: 'toBar' });
      return;
    }
    if (order) {
      order.waiter = st.id;
      st.path = [];
      setJob(st, { kind: 'pickup', order: order.id, phase: 'toPass' });
      if (manager && manager.emote === Emote.None) emote(manager, Emote.Exclaim);
      return;
    }
  }
  const dirty = s.tables.find((t) => t.state === TableState.Dirty && t.waiter < 0);
  if (dirty) {
    dirty.waiter = st.id;
    st.path = [];
    setJob(st, { kind: 'buss', table: dirty.index, phase: 'toTable' });
  }
}

function release(st: Staff): void {
  st.held = Held.None;
  st.path = [];
  setJob(st, { kind: 'home' });
}

function updatePickup(s: GameState, st: Staff, order: Order | undefined, dt: number): void {
  const job = st.job as Extract<Staff['job'], { kind: 'pickup' }>;
  if (job.phase === 'toPass' || job.phase === 'handoff') {
    // The player may have served it already (or the customer left).
    if (!order || order.state !== OrderState.Ready) return release(st);
    if (job.phase === 'toPass') {
      if (walkTo(s, st, s.map.pickupSpots[order.slot]!, dt)) {
        setPose(st, Pose.Idle);
        st.facing = Facing.BackLeft;
        setJob(st, { kind: 'pickup', order: order.id, phase: 'handoff' });
      }
      return;
    }
    st.jobTime += dt * workRate(s, st);
    if (st.jobTime < KITCHEN.handoffSeconds) return;
    const c = s.customers.find((x) => x.id === order.customer);
    if (!c || c.table < 0) return release(st);
    order.state = OrderState.Carried;
    order.slot = -1;
    st.held = Held.TrayFull;
    st.path = [];
    setJob(st, { kind: 'pickup', order: order.id, phase: 'toTable' });
    return;
  }
  const c = order ? s.customers.find((x) => x.id === order.customer) : undefined;
  if (!order || !c || c.table < 0) return release(st);
  const t = s.tables[c.table]!;
  if (job.phase === 'toTable') {
    if (walkTo(s, st, besideTable(t), dt)) {
      setPose(st, Pose.Idle);
      st.facing = FACING_TABLE;
      setJob(st, { kind: 'pickup', order: order.id, phase: 'serve' });
    }
    return;
  }
  st.jobTime += dt * workRate(s, st);
  if (st.jobTime < KITCHEN.handoffSeconds) return;
  if (has(st, 'clumsy') && chance(s.rng, TRAIT_FX.clumsyDrop)) {
    // Oops: the dish hits the floor. The plate goes to the dirty pile, the kitchen cooks again.
    emit(s, Ev.Crash, st.x, st.y);
    emote(st, Emote.Exclaim);
    s.dirtyPlates += 1;
    order.state = OrderState.Queued;
    order.progress = 0;
    order.waiter = -1;
    order.since = s.time;
    return release(st);
  }
  s.orders.splice(s.orders.indexOf(order), 1);
  if (c.state === CustomerState.Waiting) {
    const charm = statFactor(st.stats.charm) * (has(st, 'charmer') ? 1 + TRAIT_FX.charmerTips : 1);
    recordPlate(s, order);
    inspectPlate(s, c, order);
    startEating(s, c, order.dish, order.quality, charm);
  }
  gainXp(s, st);
  release(st);
}

function updateBuss(s: GameState, st: Staff, dt: number): void {
  const job = st.job as Extract<Staff['job'], { kind: 'buss' }>;
  const t = s.tables[job.table]!;
  if (job.phase === 'toTable') {
    // The player may have cleaned it first.
    if (t.state !== TableState.Dirty) {
      t.waiter = -1;
      return release(st);
    }
    if (walkTo(s, st, besideTable(t), dt)) {
      setPose(st, Pose.Wash);
      st.facing = FACING_TABLE;
      t.state = TableState.Cleaning;
      t.progress = 0;
      t.since = s.time;
      setJob(st, { kind: 'buss', table: t.index, phase: 'wipe' });
    }
    return;
  }
  if (job.phase === 'wipe') {
    t.progress = Math.min(1, t.progress + (dt * workRate(s, st)) / KITCHEN.bussSeconds);
    if (t.state !== TableState.Cleaning || t.progress >= 1) {
      const plates = t.state === TableState.Cleaning ? finishCleaning(s, t, false) : 0;
      st.held = Held.DirtyPlates;
      st.path = [];
      setJob(st, { kind: 'buss', table: t.index, phase: 'toSink', plates });
    }
    return;
  }
  if (job.phase === 'toSink') {
    if (walkTo(s, st, s.map.dirtyDrop, dt)) {
      setPose(st, Pose.Idle);
      st.facing = Facing.BackLeft;
      setJob(st, { ...job, phase: 'drop' });
    }
    return;
  }
  st.jobTime += dt * workRate(s, st);
  if (st.jobTime >= KITCHEN.handoffSeconds) {
    s.dirtyPlates += job.plates ?? 0;
    gainXp(s, st);
    release(st);
  }
}

function updateRunner(s: GameState, st: Staff, dt: number): boolean {
  if ((!st.job || st.job.kind === 'home') && !st.leaving && !st.pendingRole) findJob(s, st);
  const job = st.job;
  if (!job || job.kind === 'home') {
    goHome(s, st, dt);
    return false;
  }
  if (job.kind === 'pickup') updatePickup(s, st, s.orders.find((o) => o.id === job.order), dt);
  else if (job.kind === 'buss') updateBuss(s, st, dt);
  else if (job.kind === 'drinkRun' && !updateDrinkRun(s, st, dt, (to) => walkTo(s, st, to, dt), besideTable)) {
    // Done, or the drink is gone (its guest left, the player tossed it): free for the next.
    const d = s.drinks.find((x) => x.id === job.drink);
    if (d && d.waiter === st.id && d.state === OrderState.Ready) d.waiter = -1;
    release(st);
  }
  return true;
}

// ---------- shift manager ----------

const CALMABLE: readonly CustomerState[] = [CustomerState.Reading, CustomerState.Waiting];

/** The seated guest closest to losing patience, if anyone is below the manager's threshold. */
function mostImpatient(s: GameState): Customer | undefined {
  let best: Customer | undefined;
  for (const c of s.customers) {
    if (!CALMABLE.includes(c.state) || c.table < 0 || c.patienceMax <= 0) continue;
    const left = c.patienceLeft / c.patienceMax;
    if (left < SHIFT.calmBelow && (!best || left < best.patienceLeft / best.patienceMax)) best = c;
  }
  return best;
}

/**
 * At the end of the pass with the clipboard (calling out dishes happens in findJob); every
 * few seconds walks over to the most impatient seated guest and calms them down.
 */
function updateManager(s: GameState, st: Staff, dt: number): boolean {
  const job = st.job;
  if (job?.kind === 'calm') {
    const c = s.customers.find((x) => x.id === job.customer);
    if (!c || !CALMABLE.includes(c.state) || c.table < 0) {
      setJob(st, { kind: 'home' });
      st.path = [];
      return false;
    }
    if (job.phase === 'walk') {
      if (walkTo(s, st, besideTable(s.tables[c.table]!), dt)) {
        setPose(st, Pose.Idle);
        st.facing = FACING_TABLE;
        setJob(st, { kind: 'calm', customer: c.id, phase: 'talk' });
      }
      return true;
    }
    st.jobTime += dt * workRate(s, st);
    if (st.jobTime < SHIFT.talkSeconds) return true;
    c.patienceLeft = Math.min(c.patienceMax, c.patienceLeft + c.patienceMax * SHIFT.calmPatience * statFactor(st.stats.charm));
    emote(c, Emote.Heart);
    c.expression = Expression.Happy;
    gainXp(s, st);
    st.path = [];
    setJob(st, { kind: 'home' });
    return true;
  }
  goHome(s, st, dt);
  st.jobTime += dt * workRate(s, st);
  if (st.leaving || st.jobTime < SHIFT.calmEverySeconds) return false;
  const c = mostImpatient(s);
  if (c) {
    st.path = [];
    setJob(st, { kind: 'calm', customer: c.id, phase: 'walk' });
  } else st.jobTime = SHIFT.calmEverySeconds - 1; // Nobody needs it: look again in a second.
  return false;
}

// ---------- host ----------

/**
 * The first one standing in line. Not simply slot 0: someone who came from further away may
 * still be walking to the front spot while the one behind them is already waiting.
 */
export function frontOfLine(s: GameState): Customer | undefined {
  let front: Customer | undefined;
  for (const c of s.customers) {
    if (c.state !== CustomerState.Queued || c.party !== c.id || c.path.length > 0) continue;
    if (!front || c.queueSlot < front.queueSlot) front = c;
  }
  return front;
}

/** A host at the stand with nobody to walk in (the first one free, if any). */
export function freeHost(s: GameState): Staff | undefined {
  return s.staff.find((st) => {
    // A host still greeting someone counts as free: the manager's tap skips the welcome.
    if (st.role !== 'host' || st.leaving || (st.job && !(st.job.kind === 'escort' && st.job.phase === 'greet'))) return false;
    const home = homeOf(s, st);
    return Math.hypot(st.x - home.x, st.y - home.y) < 0.4;
  });
}

/**
 * The host takes the party to their table (owner request: "hostesses seat the guests, with the
 * menus"): the guests go to their chairs, the host walks along with the menus, waits for them
 * to sit and hands each one a menu, then goes back to the stand.
 */
export function startEscort(s: GameState, st: Staff, c: Customer): boolean {
  if (!seatCustomer(s, c, st.id)) {
    setJob(st, null);
    return false;
  }
  emote(c, Emote.Heart);
  gainXp(s, st);
  const party = s.customers.filter((m) => m.party === c.party).map((m) => m.id);
  st.path = [];
  setPose(st, Pose.Walk);
  setJob(st, { kind: 'escort', customer: c.id, table: c.table, party, phase: 'lead' });
  return true;
}

function updateEscort(s: GameState, st: Staff, job: Extract<Staff['job'], { kind: 'escort' }>, dt: number): boolean {
  const table = s.tables[job.table];
  const party = job.party.map((id) => s.customers.find((c) => c.id === id)).filter((c): c is Customer => c !== undefined && c.table === job.table);
  if (!table || party.length === 0) {
    st.path = [];
    setJob(st, null);
    return false;
  }
  if (job.phase === 'lead') {
    if (!walkTo(s, st, besideTable(table), dt)) return true;
    setPose(st, Pose.Idle);
    st.facing = FACING_TABLE;
    // Waits for them to sit down (not forever: someone may stop on the way).
    st.jobTime += dt;
    if (party.some((c) => c.state === CustomerState.ToTable) && st.jobTime < KITCHEN.escortWaitSeconds) return true;
    setJob(st, { ...job, phase: 'hand' });
    setPose(st, Pose.Cheer);
    return true;
  }
  st.jobTime += dt * workRate(s, st);
  if (st.jobTime < KITCHEN.handMenuSeconds) return true;
  for (const c of party) {
    if (c.menuFrom !== st.id) continue;
    c.menuFrom = -1;
    // Reading starts now; someone still on the way finds theirs on the table when they sit.
    if (c.state === CustomerState.Reading) {
      c.held = Held.Menu;
      c.stateTime = 0;
    }
    emit(s, Ev.Menu, st.x, st.y, c.x, c.y);
  }
  st.path = [];
  setJob(st, null);
  return true;
}

/** At the stand, the host welcomes the first person in line, then walks them in. */
function updateHost(s: GameState, st: Staff, dt: number): boolean {
  const job = st.job?.kind === 'escort' ? st.job : null;
  if (job && job.phase !== 'greet') return updateEscort(s, st, job, dt);
  if (!walkTo(s, st, homeOf(s, st), dt)) return true;
  st.facing = HOME_FACING.host;
  const front = frontOfLine(s);
  // Two hosts never greet the same guest.
  const taken = front !== undefined && s.staff.some((o) => o !== st && o.job?.kind === 'escort' && o.job.customer === front.id);
  const free = front !== undefined && !taken && tableFor(s, front.partySize, front) !== undefined;
  if (!front || !free || st.leaving) {
    st.jobTime = 0;
    if (job) setJob(st, null);
    setPose(st, Pose.Idle);
    return false;
  }
  if (job?.customer !== front.id) setJob(st, { kind: 'escort', customer: front.id, table: -1, party: [], phase: 'greet' });
  setPose(st, Pose.Cheer);
  st.jobTime += dt * workRate(s, st) * statFactor(st.stats.charm);
  if (st.jobTime >= KITCHEN.hostSeconds) startEscort(s, st, front);
  return true;
}

/**
 * While every host is walking someone in, the line does not stand still: the first in line
 * walks to a free table alone after a few seconds (and finds the menu there). With no host at
 * all, seating stays the manager's tap.
 */
function selfSeat(s: GameState): void {
  const hosts = s.staff.filter((st) => st.role === 'host' && !st.leaving);
  if (hosts.length === 0 || hosts.some((st) => !st.job || st.job.kind !== 'escort' || st.job.phase === 'greet')) return;
  const front = frontOfLine(s);
  if (front && front.stateTime >= KITCHEN.selfSeatSeconds && tableFor(s, front.partySize, front)) seatCustomer(s, front);
}

// ---------- promoter ----------

/**
 * The promoter waits on the sidewalk and hands a flyer to each passer-by who comes close; now
 * and then one of them turns round and walks in (more often for a charming promoter).
 */
function updatePromoter(s: GameState, st: Staff, dt: number): boolean {
  if (!walkTo(s, st, homeOf(s, st), dt)) return true;
  if (st.leaving) {
    setPose(st, Pose.Idle);
    return false;
  }
  st.jobTime = Math.min(PROMO.everySeconds, st.jobTime + dt * workRate(s, st) * statFactor(st.stats.speed));
  const near = st.jobTime >= PROMO.everySeconds ? s.walkers.find((w) => w.mode === 'pedestrian' && !w.flyer && Math.hypot(w.x - st.x, w.y - st.y) < PROMO.reach) : undefined;
  if (!near) {
    // Arm up for a moment after a flyer, then waiting with the stack, looking out at the street.
    if (st.pose !== Pose.Cheer || st.poseTime > 0.6) {
      setPose(st, Pose.Idle);
      st.facing = HOME_FACING.promoter;
    }
    return false;
  }
  st.jobTime = 0;
  near.flyer = true;
  st.facing = facingFor(near.x - st.x, near.y - st.y, st.facing);
  setPose(st, Pose.Cheer);
  gainXp(s, st);
  const comes = chance(s.rng, PROMO.walkIn * statFactor(st.stats.charm)) ? walkIn(s, near, near.look) : null;
  emit(s, Ev.Flyer, st.x, st.y, near.x, near.y, comes ? 1 : 0);
  if (comes) {
    emote(comes, Emote.Heart);
    // The passer-by is the new customer now: they leave the street (a new stroller takes their place).
    near.path = [];
  } else emote(near, Emote.Exclaim);
  return true;
}

// ---------- tables & dishwashing ----------

/**
 * A table is clean again. `toPile` = the player wiped it, so the dirty plates fly straight to
 * the dish pile; a waiter carries them there instead. Returns how many plates came off it.
 */
export function finishCleaning(s: GameState, t: Table, toPile: boolean): number {
  const plates = t.plates;
  t.state = TableState.Free;
  t.plates = 0;
  t.progress = 0;
  t.since = s.time;
  t.waiter = -1;
  emit(s, Ev.Burst, t.x, t.y);
  if (toPile) {
    s.dirtyPlates += plates;
    for (let i = 0; i < plates; i++) emit(s, Ev.PlateFly, t.x + (i - (plates - 1) / 2) * 0.3, t.y, s.map.dirtyStack.x, s.map.dirtyStack.y);
  }
  return plates;
}

/** Scrubs plates; returns how many came out clean. */
function washProgress(s: GameState, amount: number): number {
  if (s.dirtyPlates <= 0) {
    s.washProgress = 0;
    return 0;
  }
  s.washProgress += amount;
  let washed = 0;
  while (s.washProgress >= 1 && s.dirtyPlates > 0) {
    s.washProgress -= 1;
    s.dirtyPlates -= 1;
    s.cleanPlates += 1;
    washed += 1;
    emit(s, Ev.Washed, s.map.cleanStack.x, s.map.cleanStack.y);
  }
  return washed;
}

export function handWash(s: GameState): void {
  washProgress(s, KITCHEN.handWashTapBoost);
}

function updateWasher(s: GameState, st: Staff, dt: number): boolean {
  if (!walkTo(s, st, homeOf(s, st), dt)) return true;
  st.facing = Facing.BackLeft;
  if (s.dirtyPlates <= 0 || st.leaving) {
    setPose(st, Pose.Idle);
    return false;
  }
  setPose(st, Pose.Wash);
  const washed = washProgress(s, (dt * s.mods.washSpeed * workRate(s, st)) / KITCHEN.washSeconds);
  for (let i = 0; i < washed; i++) gainXp(s, st);
  return true;
}

export function updateTables(s: GameState, dt: number): void {
  for (const t of s.tables) {
    // Waiter-driven wipes advance in updateBuss; this handles the player's own cleaning.
    if (t.state !== TableState.Cleaning || t.waiter >= 0) continue;
    t.progress = Math.min(1, t.progress + dt / ECONOMY.cleanSeconds);
    if (t.progress >= 1) finishCleaning(s, t, true);
  }
}

/** Idle and not holding anything: quitters walk out, people changing jobs switch now. */
function betweenJobs(st: Staff): boolean {
  return (!st.job || st.job.kind === 'home') && st.held !== Held.TrayFull && st.held !== Held.DirtyPlates;
}

export function updateStaff(s: GameState, dt: number): void {
  const washing = new Set<number>();
  for (const st of s.staff) {
    if (st.leaving && betweenJobs(st)) {
      walkOut(s, st, dt);
      continue;
    }
    if (st.pendingRole && betweenJobs(st)) switchRole(s, st, st.pendingRole);
    let busy = false;
    if (st.role === 'cook') {
      busy = updateCook(s, st, dt);
      if (!busy && !st.job) goHome(s, st, dt);
    } else if (st.role === 'washer') {
      busy = updateWasher(s, st, dt);
      if (busy) washing.add(Math.min(st.slot, s.map.extraSinks.length));
    } else if (st.role === 'host') busy = updateHost(s, st, dt);
    else if (st.role === 'manager') busy = updateManager(s, st, dt);
    else if (st.role === 'promoter') busy = updatePromoter(s, st, dt);
    else if (st.role === 'courier') busy = updateCourier(s, st, dt, (to) => walkTo(s, st, to, dt), homeOf(s, st));
    else if (st.role === 'checker') busy = updateChecker(s, st, dt, (to) => walkTo(s, st, to, dt), homeOf(s, st));
    else if (st.role === 'packer') busy = updatePacker(s, st, dt, (to) => walkTo(s, st, to, dt), homeOf(s, st));
    else if (st.role === 'bartender') {
      busy = updateBartender(s, st, dt, (to) => walkTo(s, st, to, dt), homeOf(s, st));
      if (!busy) goHome(s, st, dt);
    }
    else busy = updateRunner(s, st, dt);
    st.busy = busy;
    st.bubble = s.notices.some((n) => n.kind === 'raise' && n.staff === st.id) ? Bubble.Raise : 0;
  }
  selfSeat(s);
  for (const p of s.props) {
    if (p.kind === PropKind.Stove) {
      // Fire under it while a dish cooks; the dish on it (+1) while it cooks and is plated.
      const i = s.stoves.findIndex((sv) => sv.propId === p.id);
      const sv = s.stoves[i];
      const cook = sv && sv.user >= 0 ? s.staff.find((o) => o.id === sv.user) : undefined;
      const phase = cook?.job?.kind === 'cook' ? cook.job.phase : null;
      p.active = phase === 'cooking';
      p.extra = sv && sv.dish >= 0 && (phase === 'cooking' || phase === 'plating') ? sv.dish + 1 : 0;
      p.level = phase === 'plating' ? 1 : 0;
      const o = cook?.job?.kind === 'cook' ? s.orders.find((x) => x.id === (cook.job as { order: number }).order) : undefined;
      p.progress = o && phase === 'cooking' ? o.progress : 0;
    }
    else if (p.kind === PropKind.Sink) p.active = washing.has(p.variant === 1 ? 1 + s.map.extraSinks.findIndex((e) => e.sink.x === p.x && e.sink.y === p.y) : 0);
    else if (p.kind === PropKind.DrinksFridge) p.active = s.staff.some((st) => st.job?.kind === 'pack' && st.job.phase === 'fridge');
    else if (p.kind === PropKind.PackTable) {
      // The bags waiting on the window shelf, and whether someone is packing right now.
      p.level = Math.min(PACKING.shelfShown, s.orders.filter((o) => o.delivery && o.packed).length);
      p.progress = packingProgress(s);
      p.active = p.progress > 0;
    }
  }
}

/** Takes the new job's uniform and spot. Stats, level and wage stay. */
export function switchRole(s: GameState, st: Staff, role: Role): void {
  st.role = role;
  st.pendingRole = null;
  st.look = { ...ROLES[role].look, skin: st.look.skin, hair: st.look.hair, hairColor: st.look.hairColor };
  st.speed = ROLES[role].walkSpeed;
  st.held = TOOL[role] ?? Held.None;
  st.slot = freeSlot(s, role, st);
  st.path = [];
  setJob(st, null);
  emote(st, Emote.Star);
}

/** Manager action: tap a ready dish to send it flying to its customer's table. */
export function serveOrder(s: GameState, order: Order): void {
  const c = s.customers.find((x) => x.id === order.customer);
  if (!c || c.table < 0) return;
  const to = dishSpot(s.tables[c.table]!, c.seat);
  const p = s.map.passSlots[order.slot]!;
  emit(s, Ev.DishFly, p.x, p.y, to.x, to.y, order.dish);
  order.state = OrderState.Flying;
  order.slot = -1;
  order.waiter = -1;
  order.landsAt = s.time + ECONOMY.serveFlightSeconds;
}

/** Dishes the player tossed land on their tables. */
export function landFlyingDishes(s: GameState): void {
  const landed = s.orders.filter((o) => o.state === OrderState.Flying && s.time >= o.landsAt);
  for (const order of landed) {
    s.orders.splice(s.orders.indexOf(order), 1);
    const c = s.customers.find((x) => x.id === order.customer);
    if (c && c.state === CustomerState.Waiting) {
      recordPlate(s, order);
      inspectPlate(s, c, order);
      startEating(s, c, order.dish, order.quality, 1);
    }
  }
}
