import { dishDef } from '../../data/dishes';
import { ECONOMY } from '../../data/economy';
import { SERVE_OFFSET, type Point } from '../../data/maps';
import { KITCHEN, PROMO, ROLES, SHIFT, STAFF, type Role } from '../../data/staff';
import { TRAIT_FX } from '../../data/traits';
import { facingFor, followPath, setPose } from '../movement';
import { chance } from '../rng';
import { Bubble, Emote, Expression, Facing, Held, Pose, PropKind } from '../types';
import { dishSpot, emote, route, seatCustomer, startEating, tableFor, walkIn } from './customers';
import { emit, Ev } from './events';
import { has, managerOnShift, statFactor, workRate } from './people';
import { CustomerState, OrderState, TableState, type Customer, type GameState, type Order, type Person, type Staff, type Table } from './types';
import { gainXp, walkOut } from './workers';
import { updateCourier } from './delivery';

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
      return s.map.courierSpots[st.slot % s.map.courierSpots.length]!;
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
};

/** What each job carries when not carrying food or plates. */
const TOOL: Partial<Record<Role, Held>> = { cook: Held.Spatula, manager: Held.Clipboard, promoter: Held.Flyers, host: Held.Menu };

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
    // Done cooking: it needs a clean plate (a delivery goes in a bag) and a free spot on the pass.
    const slot = freePassSlot(s);
    st.stalled = s.cleanPlates <= 0 && !order.delivery ? 'plates' : slot < 0 ? 'pass' : null;
    if (st.stalled) {
      setPose(st, Pose.Idle);
      if (st.emote === 0) emote(st, Emote.Exclaim);
      return false;
    }
    if (!order.delivery) s.cleanPlates -= 1;
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
  const cooking = new Set<number>();
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
      if (busy) cooking.add(st.slot);
      else if (!st.job) goHome(s, st, dt);
    } else if (st.role === 'washer') {
      busy = updateWasher(s, st, dt);
      if (busy) washing.add(Math.min(st.slot, s.map.extraSinks.length));
    } else if (st.role === 'host') busy = updateHost(s, st, dt);
    else if (st.role === 'manager') busy = updateManager(s, st, dt);
    else if (st.role === 'promoter') busy = updatePromoter(s, st, dt);
    else if (st.role === 'courier') busy = updateCourier(s, st, dt, (to) => walkTo(s, st, to, dt), homeOf(s, st));
    else busy = updateRunner(s, st, dt);
    st.busy = busy;
    st.bubble = s.notices.some((n) => n.kind === 'raise' && n.staff === st.id) ? Bubble.Raise : 0;
  }
  selfSeat(s);
  for (const p of s.props) {
    if (p.kind === PropKind.Stove) p.active = cooking.has(s.stoves.findIndex((sv) => sv.propId === p.id));
    else if (p.kind === PropKind.Sink) p.active = washing.has(p.variant === 1 ? 1 + s.map.extraSinks.findIndex((e) => e.sink.x === p.x && e.sink.y === p.y) : 0);
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
    if (c && c.state === CustomerState.Waiting) startEating(s, c, order.dish, order.quality, 1);
  }
}
