/**
 * The terminals. Departing passengers come in through the doors, queue for
 * check-in (their bag goes on the belt), queue for security, show their
 * passports (international airport), shop (the kiosk, or the duty free of the
 * big terminal) and wait at the gate. Arriving passengers come in from the
 * apron (or along the concourse from a jet bridge), show their passports
 * (international airport), wait at a carousel for the cart, go through
 * customs and leave. A bag checked in after the cart already loaded the
 * plane is lost.
 *
 * Terminal 1 (index 0) is the old terminal; Terminal 3 (index 1, from the
 * city airport on) takes the big jets. Both run on the same rules.
 */
import { AIRCRAFT } from '../../data/aircraft';
import { PAX_TYPES } from '../../data/paxTypes';
import { tierDef, type P2, type Stations, type TierLayout } from '../../data/tiers';
import type { TerminalBuilding } from '../../data/terminals';
import { Big } from '../big';
import { hash01 } from '../hash';
import { pushEvent } from './events';
import { recordIncome } from './income';
import { AT_FOOD, AT_GATE, loungeSeat, toApm } from './apm';
import { bussed } from './buses';
import { gatePoint, gateSpot, layoutOf, satGate } from './layout';
import { leavesByTrain, railSpot } from './rail';
import { doorSides, exitRoute, gateRoute, pierWalk } from './routes';
import { STAFF_ROLES } from '../../data/staff';
import { decorPos } from './tiers';
import { FUEL, PST, type Flight, type GameState, type Person, type TermQueues } from './types';
import { effects, effectValue } from './upgrades';

/** Spacing between people in a queue (tiles). */
export const QUEUE_GAP = 0.36;
const CHECKIN_SECONDS = 3.5;
const SCAN_SECONDS = 2.6;
const PASSPORT_SECONDS = 2.2;
const ARR_PASSPORT_SECONDS = 1.8;
/** Duty free sells more than the kiosk. */
const DUTY_FREE_SPEND = 1.6;
/** Where a passenger of the big terminal waits (in Person.slot): the food court, or at the gate. */

/** One terminal: its stations, its building and its queues. */
export interface Term {
  t: number;
  st: Stations;
  b?: TerminalBuilding;
  q: TermQueues;
}

const t1Cache = new WeakMap<GameState, TermQueues>();

/** Terminal 1's queues are the old top-level fields (kept for saves and tests). */
function t1Queues(s: GameState): TermQueues {
  let q = t1Cache.get(s);
  if (!q || q.checkinQ !== s.checkinQ || q.securityQ !== s.securityQ || q.counterBusy !== s.counterBusy || q.laneBusy !== s.laneBusy) {
    q = { checkinQ: s.checkinQ, securityQ: s.securityQ, counterBusy: s.counterBusy, laneBusy: s.laneBusy, passportQ: [], arrPassQ: [], boothBusy: [], arrBoothBusy: [] };
    t1Cache.set(s, q);
  }
  return q;
}

/** The terminals of the airport now (Terminal 3 from the city airport on). */
export function terms(s: GameState): Term[] {
  const L = layoutOf(s.tier);
  const out: Term[] = [{ t: 0, st: L.terminal, b: L.building, q: t1Queues(s) }];
  if (L.t3) out.push({ t: 1, st: L.t3.st, b: L.t3.building, q: s.t3q });
  if (L.t3 && L.t4) out.push({ t: 2, st: L.t4.st, b: L.t4.building, q: s.t4q });
  return out;
}

export function termOf(s: GameState, t: number): Term {
  const all = terms(s);
  return all[t] ?? all[0];
}

/** Which terminal a flight's passengers use: the big jets go to Terminal 3 where there is one, the jumbos to Terminal 4. */
export function terminalFor(s: GameState, f: Flight): number {
  const L = layoutOf(s.tier);
  if (!L.t3) return 0;
  const need = AIRCRAFT[f.aircraft]?.stand;
  if (L.t4 && need === 'hugeX') return 2;
  return need === 'large' || need === 'huge' || need === 'hugeX' ? 1 : 0;
}

export function counterCount(s: GameState, t = 0): number {
  const base = 1 + Math.round(effectValue(s, 'counters'));
  const T = termOf(s, t);
  // the big terminal opens two counters (and lanes) for every one of the old terminal
  return Math.min(T.st.counters.length, T.t >= 1 ? base * 2 : base);
}

export function laneCount(s: GameState, t = 0): number {
  const base = 1 + Math.round(effectValue(s, 'lanes'));
  const T = termOf(s, t);
  return Math.min(T.st.lanes.length, T.t >= 1 ? base * 2 : base);
}

function agentOnDuty(s: GameState): boolean {
  const role = STAFF_ROLES.findIndex((r) => r.id === 'agent');
  return s.staff.some((m) => m.role === role && m.breakUntil <= s.time);
}

export function checkinSeconds(s: GameState): number {
  return CHECKIN_SECONDS / ((agentOnDuty(s) ? 1.4 : 1) * (1 + effectValue(s, 'checkinSpeed')));
}

export function scanSeconds(s: GameState): number {
  return SCAN_SECONDS / (1 + effectValue(s, 'scanSpeed'));
}

/**
 * Point at distance d along a polyline. A line longer than the drawn one
 * bunches up around its end (a little spiral), never past it, so a long line
 * never spills through a wall.
 */
function along(line: readonly P2[], d: number): [number, number] {
  let left = d;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (left <= seg) return [ax + ((bx - ax) * left) / seg, ay + ((by - ay) * left) / seg];
    left -= seg;
  }
  const [bx, by] = line[line.length - 1];
  const k = left / QUEUE_GAP;
  const r = Math.min(0.18, 0.06 + k * 0.012);
  return [bx + Math.cos(k * 2.4) * r, by + Math.sin(k * 2.4) * r];
}

function walk(p: Person, x: number, y: number): void {
  p.path = [p.x, p.y, 0, x, y, 0];
  p.pathPos = 0;
  p.moving = true;
}

/** Walks through these points (flat x, y pairs). */
function walkVia(p: Person, pts: readonly number[]): void {
  const path = [p.x, p.y, 0];
  for (let i = 0; i + 1 < pts.length; i += 2) path.push(pts[i], pts[i + 1], 0);
  p.path = path;
  p.pathPos = 0;
  p.moving = true;
}

function byId(s: GameState): Map<number, Person> {
  const m = new Map<number, Person>();
  for (const p of s.people) m.set(p.id, p);
  return m;
}

function flightById(s: GameState, id: number): Flight | undefined {
  for (const f of s.flights) if (f.id === id) return f;
  return undefined;
}

/** Keeps the items that pass, in place (the arrays are shared). */
function keepIf<T>(arr: T[], ok: (x: T) => boolean): void {
  let w = 0;
  for (let i = 0; i < arr.length; i++) if (ok(arr[i])) arr[w++] = arr[i];
  arr.length = w;
}

function joinLine(p: Person, q: number[], line: readonly P2[], state: number): void {
  p.state = state;
  p.slot = q.length;
  q.push(p.id);
  const [x, y] = along(line, p.slot * QUEUE_GAP);
  walk(p, x, y);
}

/** A departing passenger reaches the check-in line (inside the building, if there is one). */
export function joinCheckin(s: GameState, p: Person): void {
  const T = termOf(s, p.term);
  joinLine(p, T.q.checkinQ, T.st.checkinQueue, PST.inCheckin);
}

/** An arriving passenger reaches the passport line (international airport), or goes straight on to the carousel. */
export function joinArrPassport(s: GameState, p: Person): void {
  const T = termOf(s, p.term);
  if (!T.st.arrPassport) return toCarousel(s, p, T);
  joinLine(p, T.q.arrPassQ, T.st.arrPassport.queue, PST.inArrPass);
}

/** Moves everyone in a queue up to their slot after someone left. */
function compact(q: number[], line: readonly P2[], people: Map<number, Person>): void {
  for (let i = 0; i < q.length; i++) {
    const p = people.get(q[i]);
    if (!p) continue;
    if (p.slot !== i) {
      p.slot = i;
      const [x, y] = along(line, i * QUEUE_GAP);
      walk(p, x, y);
    }
  }
}

/** Terminal 1: to the departures lounge (or, for a jet-bridge gate without Terminal 3, out along the apron to the pier). */
function toGate1(s: GameState, p: Person, L: TierLayout): void {
  const spot = s.spotCursor++ % L.waitSpots.length;
  p.spot = spot;
  p.state = PST.toSpot;
  const f = flightById(s, p.flight);
  // (a smaller plane at a jet-bridge gate is reached by the apron bus: wait in the lounge for it)
  const atPier = !!f && f.stand >= 0 && !!gatePoint(L, f.stand) && !bussed(s, f);
  const sp = atPier ? gateSpot(L, f.stand, spot) : L.waitSpots[spot];
  const via = atPier && L.building ? [...gateRoute(L), ...pierWalk(L, sp)] : [];
  walkVia(p, [L.terminal.airside[0], L.terminal.airside[1], ...via, sp[0], sp[1]]);
}

/** Terminal 3: down to the gate if the plane is at its jet bridge (by the people mover to the satellite), else to the food court to wait. */
function toGate3(s: GameState, p: Person, T: Term, via: readonly number[]): void {
  const L = layoutOf(s.tier);
  const f = flightById(s, p.flight);
  p.state = PST.toSpot;
  const k = s.spotCursor++;
  p.spot = k;
  if (f && f.stand >= 0 && satGate(L, f.stand)) {
    p.slot = AT_GATE;
    toApm(s, p, [...via, ...(T.st.concourse ?? []).flat()]);
  } else if (f && f.stand >= 0 && gatePoint(L, f.stand)) {
    const seat = loungeSeat(L, f.stand, k);
    p.slot = AT_GATE;
    walkVia(p, [...via, ...(T.st.concourse ?? []).flat(), seat[0], seat[1]]);
  } else {
    const spots = T.st.waitSpots ?? L.waitSpots;
    const sp = spots[k % spots.length];
    p.slot = AT_FOOD;
    walkVia(p, [...via, sp[0], sp[1]]);
  }
}

/** After security (and passport control): shop, then on to the gate. */
function toAirside(s: GameState, p: Person, T: Term, L: TierLayout, kiosk: boolean): void {
  const f = flightById(s, p.flight);
  if (T.t === 0) {
    if (kiosk && f && f.phase !== 'boarding') {
      const k = decorPos(s, 'kiosk');
      p.state = PST.toShop;
      walkVia(p, [T.st.airside[0], T.st.airside[1], k[0] + 1.05 + hash01(p.id * 5) * 0.4, k[1] + 0.9 + hash01(p.id * 7) * 0.4]);
    } else toGate1(s, p, L);
    return;
  }
  // Terminal 3: through the duty free; shoppers stop at a shelf on the way
  const way = T.st.dutyFree ?? [];
  const start = T.st.passport ? [] : [T.st.airside[0], T.st.airside[1]];
  if (kiosk && f && f.phase !== 'boarding' && way.length > 2) {
    const stop = 1 + Math.floor(hash01(p.id * 13) * (way.length - 2));
    const pts = [...start];
    for (let i = 0; i <= stop; i++) pts.push(way[i][0], way[i][1]);
    p.state = PST.toShop;
    p.spot = stop;
    walkVia(p, pts);
  } else toGate3(s, p, T, [...start, ...way.flat()]);
}

/** On to the carousel of the flight (Terminal 3 has three). */
function toCarousel(s: GameState, p: Person, T: Term): void {
  p.state = PST.toHut;
  const c = claimSpot(s, p);
  // (the big terminals: into the baggage hall through the opening from the arrivals corridor)
  const door = (T.st.toClaim ?? []).flat();
  walkVia(p, [...door, c[0], c[1]]);
}

interface ServiceLine {
  q: number[];
  busy: number[];
  line: readonly P2[];
  points: readonly P2[];
  count: number;
  at: number;
  /** Where the person stands relative to the service point. */
  dy: number;
}

/** Drops people who left, closes gaps, counts waiting time, sends the head to a free point. */
function serve(L: ServiceLine, people: Map<number, Person>, dt: number, waits: boolean): void {
  while (L.busy.length < L.count) L.busy.push(0);
  keepIf(L.q, (id) => people.has(id));
  for (let i = 0; i < L.busy.length; i++) if (L.busy[i] && !people.has(L.busy[i])) L.busy[i] = 0;
  compact(L.q, L.line, people);
  if (waits) {
    for (const id of L.q) {
      const p = people.get(id);
      if (p) p.waited += dt;
    }
  }
  for (let c = 0; c < L.count; c++) {
    if (L.busy[c] || L.q.length === 0) continue;
    const head = people.get(L.q[0]);
    if (!head || head.moving) break;
    L.q.shift();
    L.busy[c] = head.id;
    head.state = L.at;
    head.slot = c;
    head.until = 0;
    walk(head, L.points[c][0], L.points[c][1] + L.dy);
    compact(L.q, L.line, people);
  }
}

/** Runs queues, counters, scanners, booths, shopping and the baggage claim. Call after people moved. */
export function updateTerminal(s: GameState, dt: number): void {
  const people = byId(s);
  const L = layoutOf(s.tier);
  const kiosk = effects(s).kioskPerPax > 0;
  const all = terms(s);
  for (const T of all) {
    const st = T.st;
    serve({ q: T.q.checkinQ, busy: T.q.counterBusy, line: st.checkinQueue, points: st.counters, count: counterCount(s, T.t), at: PST.atCounter, dy: 0.35 }, people, dt, true);
    serve({ q: T.q.securityQ, busy: T.q.laneBusy, line: st.securityQueue, points: st.lanes, count: laneCount(s, T.t), at: PST.atScanner, dy: -0.25 }, people, dt, true);
    if (st.passport) serve({ q: T.q.passportQ, busy: T.q.boothBusy, line: st.passport.queue, points: st.passport.booths, count: st.passport.booths.length, at: PST.atBooth, dy: -0.3 }, people, dt, true);
    if (st.arrPassport) serve({ q: T.q.arrPassQ, busy: T.q.arrBoothBusy, line: st.arrPassport.queue, points: st.arrPassport.booths, count: st.arrPassport.booths.length, at: PST.atArrBooth, dy: 0.3 }, people, dt, false);
  }

  for (const p of s.people) {
    if (p.moving) continue;
    const T = all[p.term] ?? all[0];
    const st = T.st;
    switch (p.state) {
      case PST.atCounter: {
        if (p.until === 0) p.until = s.time + checkinSeconds(s);
        if (s.time < p.until) break;
        if (T.q.counterBusy[p.slot] === p.id) T.q.counterBusy[p.slot] = 0;
        const f = flightById(s, p.flight);
        if (f) {
          f.bagsChecked += p.n;
          if (f.bagState === FUEL.done) {
            // the cart already loaded the plane: these bags miss the flight
            f.lostBags += p.n;
            s.stats.lostBags += p.n;
            f.mood = Math.max(0, f.mood - 0.06);
            pushEvent(s, 'lostBag', p.x, p.y, f.id);
          } else pushEvent(s, 'checkedIn', st.counters[p.slot]?.[0] ?? p.x, st.counters[p.slot]?.[1] ?? p.y, p.slot);
          if (p.waited > 8) f.mood = Math.max(0, f.mood - Math.min(0.08, (p.waited - 8) * 0.004));
        }
        joinLine(p, T.q.securityQ, st.securityQueue, PST.inSecurity);
        break;
      }
      case PST.atScanner: {
        if (p.until === 0) p.until = s.time + scanSeconds(s);
        if (s.time < p.until) break;
        if (T.q.laneBusy[p.slot] === p.id) T.q.laneBusy[p.slot] = 0;
        s.stats.queueSecs += p.waited;
        s.stats.queued++;
        const f = flightById(s, p.flight);
        if (f && p.waited > 14) f.mood = Math.max(0, f.mood - Math.min(0.08, (p.waited - 14) * 0.003));
        if (st.passport) joinLine(p, T.q.passportQ, st.passport.queue, PST.inPassport);
        else toAirside(s, p, T, L, kiosk);
        break;
      }
      case PST.atBooth: {
        if (p.until === 0) p.until = s.time + PASSPORT_SECONDS;
        if (s.time < p.until) break;
        if (T.q.boothBusy[p.slot] === p.id) T.q.boothBusy[p.slot] = 0;
        toAirside(s, p, T, L, kiosk);
        break;
      }
      case PST.atArrBooth: {
        if (p.until === 0) p.until = s.time + ARR_PASSPORT_SECONDS;
        if (s.time < p.until) break;
        if (T.q.arrBoothBusy[p.slot] === p.id) T.q.arrBoothBusy[p.slot] = 0;
        toCarousel(s, p, T);
        break;
      }
      case PST.toShop: {
        // arrived at the kiosk or a duty free shelf: browse a little longer when the plane is not even here yet
        const f = flightById(s, p.flight);
        const early = !f || f.dockedAt === 0;
        p.state = PST.shopping;
        p.until = s.time + (early ? 7 : 3.5);
        p.slot = early ? 1 : 0;
        break;
      }
      case PST.shopping: {
        const f = flightById(s, p.flight);
        if (s.time < p.until && !(f && f.phase === 'boarding')) break;
        const fx = effects(s);
        const mul = T.t >= 1 ? DUTY_FREE_SPEND : 1;
        const amount = Math.round(fx.kioskPerPax * PAX_TYPES[p.outfit].spend * (p.slot === 1 ? 1.6 : 1) * mul * tierDef(s.tier).pay * p.n * 10) / 10;
        if (amount > 0) {
          const big = Big.fromNumber(amount);
          s.money = s.money.add(big);
          s.stats.earned = s.stats.earned.add(big);
          s.stats.sales = s.stats.sales.add(big);
          recordIncome(s, amount, [0, 0, 0, amount], 0);
          pushEvent(s, 'sale', p.x, p.y, big.m, big.e, p.id);
        }
        if (T.t === 0) toGate1(s, p, L);
        else {
          // the rest of the way through the duty free
          const way = st.dutyFree ?? [];
          const rest: number[] = [];
          for (let i = Math.max(0, p.spot) + 1; i < way.length; i++) rest.push(way[i][0], way[i][1]);
          toGate3(s, p, T, rest);
        }
        break;
      }
      case PST.waiting: {
        // Terminal 3: the plane is at its jet bridge now; down from the food court to the gate (or the people mover)
        if (T.t < 1 || p.slot !== AT_FOOD) break;
        const f = flightById(s, p.flight);
        if (!f || f.stand < 0 || !gatePoint(L, f.stand)) break;
        if (satGate(L, f.stand)) {
          p.slot = AT_GATE;
          toApm(s, p, (st.concourse ?? []).flat());
          break;
        }
        if (f.phase === 'boarding') break;
        const seat = loungeSeat(L, f.stand, p.spot);
        p.slot = AT_GATE;
        p.state = PST.toSpot;
        walkVia(p, [...(st.concourse ?? []).flat(), seat[0], seat[1]]);
        break;
      }
      case PST.atClaim: {
        const f = flightById(s, p.flight);
        const ready = !f || f.bagWork >= 0.5 || f.bagState === FUEL.done;
        if (p.until === 0) p.until = s.time;
        if (ready || s.time - p.until > 45) {
          if (!ready && f) f.mood = Math.max(0, f.mood - 0.03);
          p.state = PST.toExit;
          walkVia(p, exitWay(L, T, p));
        }
        break;
      }
    }
  }
}

/** From the carousel to the curb: out of the exit (Terminal 3: through customs first). */
function exitWay(L: TierLayout, T: Term, p: Person): number[] {
  const st = T.st;
  if (T.t >= 1 && T.b) {
    const ex = st.exits ?? [st.doors!.exit];
    const d = doorSides(T.b, ex[p.id % ex.length]);
    const out = [...(st.customs ?? []).flat(), d.in[0], d.in[1], d.out[0], d.out[1]];
    if (L.rail && T.t === 1 && leavesByTrain(p.id)) {
      // to the station: across the road and up the footpath to the platform
      p.state = PST.toRail;
      const sp = railSpot(L.rail, p.id);
      return [...out, ...L.rail.path.slice().reverse().flat(), sp[0], sp[1]];
    }
    return [...out, st.exit[0] + (hash01(p.id * 3) - 0.5) * 1.6, st.exit[1]];
  }
  if (L.building) return [...exitRoute(L), st.exit[0], st.exit[1]];
  return [22.1, L.field.y0 + 0.1, st.exit[0], st.exit[1]];
}

/** Where an arriving passenger waits for their bag (spread around the flight's carousel). */
export function claimSpot(s: GameState, p: Person): [number, number] {
  const T = termOf(s, p.term);
  const cs = T.st.carousels ?? [T.st.claim];
  const c = cs[p.flight % cs.length];
  const a = hash01(p.id * 11 + 1) * Math.PI * 2;
  const r = 0.55 + hash01(p.id * 13 + 2) * 0.25;
  return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.8];
}

/** Takes a passenger out of every queue and station (their flight left). */
export function leaveStations(s: GameState, p: Person): void {
  const q = termOf(s, p.term).q;
  for (const arr of [q.checkinQ, q.securityQ, q.passportQ, q.arrPassQ]) keepIf(arr, (id) => id !== p.id);
  for (const arr of [q.counterBusy, q.laneBusy, q.boothBusy, q.arrBoothBusy]) for (let i = 0; i < arr.length; i++) if (arr[i] === p.id) arr[i] = 0;
}
