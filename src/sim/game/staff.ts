import { dishDef } from '../../data/dishes';
import { ECONOMY } from '../../data/economy';
import type { Point } from '../../data/maps';
import { KITCHEN, ROLES, type Role } from '../../data/staff';
import { followPath, setPose } from '../movement';
import { Emote, Expression, Facing, Held, Pose, PropKind } from '../types';
import { emote, route, startEating } from './customers';
import { emit, Ev } from './events';
import { CustomerState, OrderState, TableState, type GameState, type Order, type Staff, type Table } from './types';

/** Where a waiter stands to serve or clear a table: the open side, facing the table. */
export const besideTable = (t: Table): Point => ({ x: t.x + 0.8, y: t.y });

export function homeOf(s: GameState, role: Role): Point {
  return role === 'cook' ? s.map.cookSpot : role === 'waiter' ? s.map.waiterIdle : s.map.washerSpot;
}

const HOME_FACING: Record<Role, Staff['facing']> = { cook: Facing.BackLeft, waiter: Facing.FrontLeft, washer: Facing.BackLeft };

export function createStaff(s: GameState, role: Role): Staff {
  const home = homeOf(s, role);
  return {
    id: s.nextId++,
    role,
    look: { ...ROLES[role].look },
    x: home.x,
    y: home.y,
    prevX: home.x,
    prevY: home.y,
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
  };
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
function walkTo(s: GameState, st: Staff, to: Point, dt: number): boolean {
  if (st.path.length === 0 && (Math.abs(st.x - to.x) > 0.01 || Math.abs(st.y - to.y) > 0.01)) st.path = route(s, st, to);
  if (st.path.length === 0) return true;
  return followPath(st, st.path, st.speed, dt);
}

function goHome(s: GameState, st: Staff, dt: number): void {
  if (walkTo(s, st, homeOf(s, st.role), dt)) {
    setPose(st, Pose.Idle);
    st.facing = HOME_FACING[st.role];
    if (st.job?.kind === 'home') st.job = null;
  }
}

// ---------- cook ----------

function updateCook(s: GameState, st: Staff, dt: number): boolean {
  let job = st.job;
  if (!job || job.kind !== 'cook') {
    const next = s.orders.find((o) => o.state === OrderState.Queued);
    if (!next) {
      st.stalled = null;
      setPose(st, Pose.Idle);
      st.facing = Facing.BackLeft;
      return false;
    }
    next.state = OrderState.Cooking;
    next.since = s.time;
    setJob(st, { kind: 'cook', order: next.id, phase: 'cooking' });
    job = st.job!;
  }
  if (job.kind !== 'cook') return false;
  const order = s.orders.find((o) => o.id === job.order);
  if (!order) {
    setJob(st, null);
    return false;
  }
  st.jobTime += dt;
  if (job.phase === 'cooking') {
    if (order.progress < 1) {
      order.progress = Math.min(1, order.progress + (dt * s.mods.cookSpeed) / dishDef(order.dish).cookSeconds);
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
    return false;
  }
  if (st.jobTime >= KITCHEN.plateSeconds) {
    order.state = OrderState.Ready;
    order.since = s.time;
    const p = s.map.passSlots[order.slot]!;
    emit(s, Ev.Ding, p.x, p.y);
    emote(st, Emote.Star);
    st.facing = Facing.BackLeft;
    setJob(st, null);
  }
  return false;
}

// ---------- waiter ----------

function waiterFindJob(s: GameState, st: Staff): void {
  const ready = s.orders
    .filter((o) => o.state === OrderState.Ready && o.waiter < 0)
    .sort((a, b) => a.since - b.since)[0];
  if (ready) {
    ready.waiter = st.id;
    st.path = [];
    setJob(st, { kind: 'pickup', order: ready.id, phase: 'toPass' });
    return;
  }
  const dirty = s.tables.find((t) => t.state === TableState.Dirty && t.waiter < 0);
  if (dirty) {
    dirty.waiter = st.id;
    st.path = [];
    setJob(st, { kind: 'buss', table: dirty.index, phase: 'toTable' });
  }
}

function releaseWaiter(st: Staff): void {
  st.held = Held.None;
  st.path = [];
  setJob(st, { kind: 'home' });
}

function updatePickup(s: GameState, st: Staff, order: Order | undefined, dt: number): void {
  const job = st.job as Extract<Staff['job'], { kind: 'pickup' }>;
  if (job.phase === 'toPass' || job.phase === 'handoff') {
    // The player may have served it already (or the customer left).
    if (!order || order.state !== OrderState.Ready) return releaseWaiter(st);
    if (job.phase === 'toPass') {
      if (walkTo(s, st, s.map.pickupSpots[order.slot]!, dt)) {
        setPose(st, Pose.Idle);
        st.facing = Facing.BackLeft;
        setJob(st, { kind: 'pickup', order: order.id, phase: 'handoff' });
      }
      return;
    }
    st.jobTime += dt;
    if (st.jobTime < KITCHEN.handoffSeconds) return;
    const c = s.customers.find((x) => x.id === order.customer);
    if (!c || c.table < 0) return releaseWaiter(st);
    order.state = OrderState.Carried;
    order.slot = -1;
    st.held = Held.TrayFull;
    st.path = [];
    setJob(st, { kind: 'pickup', order: order.id, phase: 'toTable' });
    return;
  }
  const c = order ? s.customers.find((x) => x.id === order.customer) : undefined;
  if (!order || !c || c.table < 0) return releaseWaiter(st);
  const t = s.tables[c.table]!;
  if (job.phase === 'toTable') {
    if (walkTo(s, st, besideTable(t), dt)) {
      setPose(st, Pose.Idle);
      st.facing = Facing.BackLeft;
      setJob(st, { kind: 'pickup', order: order.id, phase: 'serve' });
    }
    return;
  }
  st.jobTime += dt;
  if (st.jobTime < KITCHEN.handoffSeconds) return;
  s.orders.splice(s.orders.indexOf(order), 1);
  if (c.state === CustomerState.Waiting) startEating(s, c, order.dish);
  st.held = Held.None;
  setJob(st, { kind: 'home' });
}

function updateBuss(s: GameState, st: Staff, dt: number): void {
  const job = st.job as Extract<Staff['job'], { kind: 'buss' }>;
  const t = s.tables[job.table]!;
  if (job.phase === 'toTable') {
    // The player may have cleaned it first.
    if (t.state !== TableState.Dirty) {
      t.waiter = -1;
      return releaseWaiter(st);
    }
    if (walkTo(s, st, besideTable(t), dt)) {
      setPose(st, Pose.Wash);
      st.facing = Facing.BackLeft;
      t.state = TableState.Cleaning;
      t.progress = 0;
      t.since = s.time;
      setJob(st, { kind: 'buss', table: t.index, phase: 'wipe' });
    }
    return;
  }
  if (job.phase === 'wipe') {
    t.progress = Math.min(1, t.progress + dt / KITCHEN.bussSeconds);
    if (t.state !== TableState.Cleaning || t.progress >= 1) {
      if (t.state === TableState.Cleaning) finishCleaning(s, t, false);
      st.held = Held.DirtyPlates;
      st.path = [];
      setJob(st, { kind: 'buss', table: t.index, phase: 'toSink' });
    }
    return;
  }
  if (job.phase === 'toSink') {
    if (walkTo(s, st, s.map.dirtyDrop, dt)) {
      setPose(st, Pose.Idle);
      st.facing = Facing.BackLeft;
      setJob(st, { kind: 'buss', table: t.index, phase: 'drop' });
    }
    return;
  }
  st.jobTime += dt;
  if (st.jobTime >= KITCHEN.handoffSeconds) {
    s.dirtyPlates += 1;
    releaseWaiter(st);
  }
}

function updateWaiter(s: GameState, st: Staff, dt: number): void {
  if (!st.job || st.job.kind === 'home') waiterFindJob(s, st);
  const job = st.job;
  if (!job || job.kind === 'home') return goHome(s, st, dt);
  if (job.kind === 'pickup') updatePickup(s, st, s.orders.find((o) => o.id === job.order), dt);
  else if (job.kind === 'buss') updateBuss(s, st, dt);
}

// ---------- tables & dishwashing ----------

/**
 * A table is clean again. `toPile` = the player wiped it, so the dirty plate flies straight to
 * the dish pile; a waiter carries it there instead.
 */
export function finishCleaning(s: GameState, t: Table, toPile: boolean): void {
  t.state = TableState.Free;
  t.progress = 0;
  t.since = s.time;
  t.waiter = -1;
  emit(s, Ev.Burst, t.x, t.y);
  if (toPile) {
    s.dirtyPlates += 1;
    emit(s, Ev.PlateFly, t.x, t.y, s.map.dirtyStack.x, s.map.dirtyStack.y);
  }
}

/** One plate scrubbed clean (by the dishwasher or the player's taps). */
function washProgress(s: GameState, amount: number): void {
  if (s.dirtyPlates <= 0) {
    s.washProgress = 0;
    return;
  }
  s.washProgress += amount;
  while (s.washProgress >= 1 && s.dirtyPlates > 0) {
    s.washProgress -= 1;
    s.dirtyPlates -= 1;
    s.cleanPlates += 1;
    emit(s, Ev.Washed, s.map.cleanStack.x, s.map.cleanStack.y);
  }
}

export function handWash(s: GameState): void {
  washProgress(s, KITCHEN.handWashTapBoost);
}

function updateWasher(s: GameState, st: Staff, dt: number): boolean {
  if (s.dirtyPlates <= 0) {
    setPose(st, Pose.Idle);
    return false;
  }
  setPose(st, Pose.Wash);
  st.facing = Facing.BackLeft;
  washProgress(s, (dt * s.mods.washSpeed) / KITCHEN.washSeconds);
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

export function updateStaff(s: GameState, dt: number): void {
  let cooking = false;
  let washing = false;
  for (const st of s.staff) {
    if (st.role === 'cook') cooking = updateCook(s, st, dt) || cooking;
    else if (st.role === 'waiter') updateWaiter(s, st, dt);
    else washing = updateWasher(s, st, dt) || washing;
  }
  for (const p of s.props) {
    if (p.kind === PropKind.Stove) p.active = cooking;
    else if (p.kind === PropKind.Sink) p.active = washing;
  }
}

/** Manager action: tap a ready dish to send it flying to its customer's table. */
export function serveOrder(s: GameState, order: Order): void {
  const c = s.customers.find((x) => x.id === order.customer);
  if (!c || c.table < 0) return;
  const t = s.tables[c.table]!;
  const p = s.map.passSlots[order.slot]!;
  emit(s, Ev.DishFly, p.x, p.y, t.x, t.y, order.dish);
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
    if (c && c.state === CustomerState.Waiting) startEating(s, c, order.dish);
  }
}
