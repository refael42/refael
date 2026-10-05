import { dishDef } from '../../data/dishes';
import { ECONOMY } from '../../data/economy';
import { SERVE_OFFSET, type Point } from '../../data/maps';
import { KITCHEN, ROLES, STAFF, type Role } from '../../data/staff';
import { TRAIT_FX } from '../../data/traits';
import { followPath, setPose } from '../movement';
import { chance } from '../rng';
import { Bubble, Emote, Expression, Facing, Held, Pose, PropKind } from '../types';
import { dishSpot, emote, route, seatCustomer, startEating, tableFor } from './customers';
import { emit, Ev } from './events';
import { has, statFactor, workRate } from './people';
import { CustomerState, OrderState, TableState, type GameState, type Order, type Person, type Staff, type Table } from './types';
import { gainXp, walkOut } from './workers';

/** Where a waiter stands to serve or clear a table: the open side, facing the table. */
export const besideTable = (t: Table): Point => ({ x: t.x + SERVE_OFFSET.x, y: t.y + SERVE_OFFSET.y });
/** ...facing the table from there. */
const FACING_TABLE = Facing.BackRight;

/** Each worker's own spot: their stove, their idle place, the host stand... */
export function homeOf(s: GameState, st: Staff): Point {
  switch (st.role) {
    case 'cook':
      return s.stoves[st.slot]?.cook ?? s.map.stoves[0]!.cook;
    case 'waiter':
      return s.map.waiterIdle[st.slot % s.map.waiterIdle.length]!;
    case 'washer':
      return s.map.washerSpot;
    case 'host':
      return s.map.hostSpot;
    case 'cleaner':
      return s.map.cleanerIdle[st.slot % s.map.cleanerIdle.length]!;
  }
}

const HOME_FACING: Record<Role, Staff['facing']> = {
  cook: Facing.BackLeft,
  waiter: Facing.FrontLeft,
  washer: Facing.BackLeft,
  host: Facing.FrontRight,
  cleaner: Facing.FrontLeft,
};

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
    held: role === 'cook' ? Held.Spatula : Held.None,
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
  };
  st.slot = freeSlot(s, role, st);
  const p = at ?? homeOf(s, st);
  st.x = st.prevX = p.x;
  st.y = st.prevY = p.y;
  return st;
}

function freePassSlot(s: GameState): number {
  for (let i = 0; i < s.map.passSlots.length; i++) {
    if (!s.orders.some((o) => (o.state === OrderState.Ready || o.state === OrderState.Plating) && o.slot === i)) return i;
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
    st.facing = HOME_FACING[st.role];
    if (st.job?.kind === 'home') st.job = null;
  }
}

// ---------- cook ----------

function updateCook(s: GameState, st: Staff, dt: number): boolean {
  let job = st.job;
  if (!job || job.kind !== 'cook') {
    if (st.leaving || st.pendingRole) return false;
    const next = s.orders.find((o) => o.state === OrderState.Queued);
    if (!next) {
      st.stalled = null;
      return false;
    }
    next.state = OrderState.Cooking;
    next.since = s.time;
    next.quality = statFactor(st.stats.quality);
    setJob(st, { kind: 'cook', order: next.id, phase: 'cooking' });
    job = st.job!;
  }
  if (job.kind !== 'cook') return false;
  const order = s.orders.find((o) => o.id === job.order);
  if (!order) {
    setJob(st, null);
    return false;
  }
  // Cooks work at their own stove: walk there first if they just arrived.
  if (!walkTo(s, st, homeOf(s, st), dt)) return true;
  const rate = workRate(s, st);
  st.jobTime += dt * rate;
  if (job.phase === 'cooking') {
    if (order.progress < 1) {
      order.progress = Math.min(1, order.progress + (dt * s.mods.cookSpeed * rate) / dishDef(order.dish).cookSeconds);
      setPose(st, Pose.Cook);
      st.facing = Facing.BackLeft;
      return true;
    }
    // Done cooking: it needs a clean plate and a free spot on the pass.
    const slot = freePassSlot(s);
    st.stalled = s.cleanPlates <= 0 ? 'plates' : slot < 0 ? 'pass' : null;
    if (st.stalled) {
      setPose(st, Pose.Idle);
      if (st.emote === 0) emote(st, Emote.Exclaim);
      return false;
    }
    s.cleanPlates -= 1;
    order.state = OrderState.Plating;
    order.slot = slot;
    st.facing = Facing.FrontRight;
    setPose(st, Pose.Idle);
    setJob(st, { kind: 'cook', order: order.id, phase: 'plating' });
    return true;
  }
  if (st.jobTime >= KITCHEN.plateSeconds) {
    order.state = OrderState.Ready;
    order.since = s.time;
    const p = s.map.passSlots[order.slot]!;
    emit(s, Ev.Ding, p.x, p.y);
    emote(st, Emote.Star);
    st.facing = Facing.BackLeft;
    setJob(st, null);
    gainXp(s, st);
  }
  return true;
}

// ---------- waiter & cleaner ----------

function findJob(s: GameState, st: Staff): void {
  if (st.role === 'waiter') {
    const ready = s.orders
      .filter((o) => o.state === OrderState.Ready && o.waiter < 0)
      .sort((a, b) => a.since - b.since)[0];
    if (ready) {
      ready.waiter = st.id;
      st.path = [];
      setJob(st, { kind: 'pickup', order: ready.id, phase: 'toPass' });
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
  return true;
}

// ---------- host ----------

/** The host welcomes the first person in line and sends them to the nearest free table. */
function updateHost(s: GameState, st: Staff, dt: number): boolean {
  if (!walkTo(s, st, homeOf(s, st), dt)) return true;
  st.facing = HOME_FACING.host;
  const front = s.customers.find((c) => c.state === CustomerState.Queued && c.queueSlot === 0 && c.path.length === 0);
  const free = front !== undefined && tableFor(s, front.partySize, front) !== undefined;
  if (!front || !free || st.leaving) {
    st.jobTime = 0;
    setPose(st, Pose.Idle);
    return false;
  }
  setPose(st, Pose.Cheer);
  st.jobTime += dt * workRate(s, st) * statFactor(st.stats.charm);
  if (st.jobTime >= KITCHEN.hostSeconds) {
    st.jobTime = 0;
    if (seatCustomer(s, front)) {
      emote(front, Emote.Heart);
      gainXp(s, st);
    }
  }
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
  const cooking = new Set<number>();
  let washing = false;
  for (const st of s.staff) {
    if (st.leaving && betweenJobs(st)) {
      walkOut(s, st, dt);
      continue;
    }
    if (st.pendingRole && betweenJobs(st)) switchRole(s, st, st.pendingRole);
    let busy = false;
    if (st.role === 'cook') {
      busy = updateCook(s, st, dt);
      if (busy) cooking.add(st.slot);
      else if (!st.job) goHome(s, st, dt);
    } else if (st.role === 'washer') {
      busy = updateWasher(s, st, dt);
      washing = washing || busy;
    } else if (st.role === 'host') busy = updateHost(s, st, dt);
    else busy = updateRunner(s, st, dt);
    st.busy = busy;
    st.bubble = s.notices.some((n) => n.kind === 'raise' && n.staff === st.id) ? Bubble.Raise : 0;
  }
  for (const p of s.props) {
    if (p.kind === PropKind.Stove) p.active = cooking.has(s.stoves.findIndex((sv) => sv.propId === p.id));
    else if (p.kind === PropKind.Sink) p.active = washing;
  }
}

/** Takes the new job's uniform and spot. Stats, level and wage stay. */
export function switchRole(s: GameState, st: Staff, role: Role): void {
  st.role = role;
  st.pendingRole = null;
  st.look = { ...ROLES[role].look, skin: st.look.skin, hair: st.look.hair, hairColor: st.look.hairColor };
  st.speed = ROLES[role].walkSpeed;
  st.held = role === 'cook' ? Held.Spatula : Held.None;
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
    if (c && c.state === CustomerState.Waiting) startEating(s, c, order.dish, order.quality, 1);
  }
}
