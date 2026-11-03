/**
 * The terminal: departing passengers queue for check-in (their bag goes on
 * the belt), queue for security, shop at the kiosk if there is one, then wait
 * at the gate. Arriving passengers wait at the baggage carousel for the cart
 * and then head to the parking lot. A bag checked in after the cart already
 * loaded the plane is lost.
 */
import { PAX_TYPES } from '../../data/paxTypes';
import { tierDef, type P2, type TierLayout } from '../../data/tiers';
import { Big } from '../big';
import { hash01 } from '../hash';
import { pushEvent } from './events';
import { recordIncome } from './income';
import { layoutOf } from './layout';
import { STAFF_ROLES } from '../../data/staff';
import { decorPos } from './tiers';
import { FUEL, PST, type Flight, type GameState, type Person } from './types';
import { effects, effectValue } from './upgrades';

/** Spacing between people in a queue (tiles). */
export const QUEUE_GAP = 0.36;
const CHECKIN_SECONDS = 3.5;
const SCAN_SECONDS = 2.6;

export function counterCount(s: GameState): number {
  return Math.min(layoutOf(s.tier).terminal.counters.length, 1 + Math.round(effectValue(s, 'counters')));
}

export function laneCount(s: GameState): number {
  return Math.min(layoutOf(s.tier).terminal.lanes.length, 1 + Math.round(effectValue(s, 'lanes')));
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

/** Point at distance d along a polyline (clamped to its end). */
function along(line: readonly P2[], d: number): [number, number] {
  let left = d;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (left <= seg) return [ax + ((bx - ax) * left) / seg, ay + ((by - ay) * left) / seg];
    left -= seg;
  }
  // past the end: keep going the way the last leg points for a bit, then bunch up
  const [ax, ay] = line[line.length - 2];
  const [bx, by] = line[line.length - 1];
  const seg = Math.hypot(bx - ax, by - ay) || 1;
  const over = Math.min(1.2, left) + Math.max(0, left - 1.2) * 0.1;
  return [bx + ((bx - ax) * over) / seg, by + ((by - ay) * over) / seg];
}

function walk(p: Person, x: number, y: number): void {
  p.path = [p.x, p.y, 0, x, y, 0];
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

/** A departing passenger arrives from the parking lot and joins the check-in line. */
export function joinCheckin(s: GameState, p: Person): void {
  p.state = PST.inCheckin;
  p.slot = s.checkinQ.length;
  s.checkinQ.push(p.id);
  const L = layoutOf(s.tier);
  const [x, y] = along(L.terminal.checkinQueue, p.slot * QUEUE_GAP);
  walk(p, x, y);
}

function joinSecurity(s: GameState, p: Person, L: TierLayout): void {
  p.state = PST.inSecurity;
  p.slot = s.securityQ.length;
  s.securityQ.push(p.id);
  const [x, y] = along(L.terminal.securityQueue, p.slot * QUEUE_GAP);
  walk(p, x, y);
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

function toGate(s: GameState, p: Person, L: TierLayout): void {
  const spot = s.spotCursor++ % L.waitSpots.length;
  p.spot = spot;
  p.state = PST.toSpot;
  const sp = L.waitSpots[spot];
  p.path = [p.x, p.y, 0, L.terminal.airside[0], L.terminal.airside[1], 0, sp[0], sp[1], 0];
  p.pathPos = 0;
  p.moving = true;
}

/** Runs queues, counters, scanners, shopping and the baggage claim. Call after people moved. */
export function updateTerminal(s: GameState, dt: number): void {
  const L = layoutOf(s.tier);
  const T = L.terminal;
  const people = byId(s);
  const nc = counterCount(s);
  const nl = laneCount(s);
  while (s.counterBusy.length < nc) s.counterBusy.push(0);
  while (s.laneBusy.length < nl) s.laneBusy.push(0);
  // drop references to people who are gone
  s.checkinQ = s.checkinQ.filter((id) => people.has(id));
  s.securityQ = s.securityQ.filter((id) => people.has(id));
  for (let i = 0; i < s.counterBusy.length; i++) if (s.counterBusy[i] && !people.has(s.counterBusy[i])) s.counterBusy[i] = 0;
  for (let i = 0; i < s.laneBusy.length; i++) if (s.laneBusy[i] && !people.has(s.laneBusy[i])) s.laneBusy[i] = 0;
  // close gaps left by people whose flight went without them
  compact(s.checkinQ, T.checkinQueue, people);
  compact(s.securityQ, T.securityQueue, people);

  // waiting time in queues
  for (const id of s.checkinQ) {
    const p = people.get(id);
    if (p) p.waited += dt;
  }
  for (const id of s.securityQ) {
    const p = people.get(id);
    if (p) p.waited += dt;
  }

  // check-in: the head of the line goes to a free counter
  for (let c = 0; c < nc; c++) {
    if (s.counterBusy[c] || s.checkinQ.length === 0) continue;
    const head = people.get(s.checkinQ[0]);
    if (!head || head.moving) break;
    s.checkinQ.shift();
    s.counterBusy[c] = head.id;
    head.state = PST.atCounter;
    head.slot = c;
    head.until = 0;
    walk(head, T.counters[c][0], T.counters[c][1] + 0.35);
    compact(s.checkinQ, T.checkinQueue, people);
  }
  // security: same with the scanners
  for (let c = 0; c < nl; c++) {
    if (s.laneBusy[c] || s.securityQ.length === 0) continue;
    const head = people.get(s.securityQ[0]);
    if (!head || head.moving) break;
    s.securityQ.shift();
    s.laneBusy[c] = head.id;
    head.state = PST.atScanner;
    head.slot = c;
    head.until = 0;
    walk(head, T.lanes[c][0], T.lanes[c][1] - 0.25);
    compact(s.securityQ, T.securityQueue, people);
  }

  const kiosk = effects(s).kioskPerPax > 0;
  for (const p of s.people) {
    if (p.moving) continue;
    switch (p.state) {
      case PST.atCounter: {
        if (p.until === 0) p.until = s.time + checkinSeconds(s);
        if (s.time < p.until) break;
        if (s.counterBusy[p.slot] === p.id) s.counterBusy[p.slot] = 0;
        const f = flightById(s, p.flight);
        if (f) {
          f.bagsChecked++;
          if (f.bagState === FUEL.done) {
            // the cart already loaded the plane: this bag misses the flight
            f.lostBags++;
            s.stats.lostBags++;
            f.mood = Math.max(0, f.mood - 0.06);
            pushEvent(s, 'lostBag', p.x, p.y, f.id);
          } else pushEvent(s, 'checkedIn', T.counters[p.slot]?.[0] ?? p.x, T.counters[p.slot]?.[1] ?? p.y, p.slot);
          if (p.waited > 8) f.mood = Math.max(0, f.mood - Math.min(0.08, (p.waited - 8) * 0.004));
        }
        joinSecurity(s, p, L);
        break;
      }
      case PST.atScanner: {
        if (p.until === 0) p.until = s.time + scanSeconds(s);
        if (s.time < p.until) break;
        if (s.laneBusy[p.slot] === p.id) s.laneBusy[p.slot] = 0;
        s.stats.queueSecs += p.waited;
        s.stats.queued++;
        const f = flightById(s, p.flight);
        if (f && p.waited > 14) f.mood = Math.max(0, f.mood - Math.min(0.08, (p.waited - 14) * 0.003));
        if (kiosk && f && f.phase !== 'boarding') {
          const k = decorPos(s, 'kiosk');
          p.state = PST.toShop;
          p.path = [p.x, p.y, 0, T.airside[0], T.airside[1], 0, k[0] + 1.05 + hash01(p.id * 5) * 0.4, k[1] + 0.9 + hash01(p.id * 7) * 0.4, 0];
          p.pathPos = 0;
          p.moving = true;
        } else toGate(s, p, L);
        break;
      }
      case PST.toShop: {
        // arrived at the kiosk: browse a little longer when the plane is not even here yet
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
        const amount = Math.round(fx.kioskPerPax * PAX_TYPES[p.outfit].spend * (p.slot === 1 ? 1.6 : 1) * tierDef(s.tier).pay * 10) / 10;
        if (amount > 0) {
          const big = Big.fromNumber(amount);
          s.money = s.money.add(big);
          s.stats.earned = s.stats.earned.add(big);
          s.stats.sales = s.stats.sales.add(big);
          recordIncome(s, amount, [0, 0, 0, amount], 0);
          pushEvent(s, 'sale', p.x, p.y, big.m, big.e, p.id);
        }
        toGate(s, p, L);
        break;
      }
      case PST.atClaim: {
        const f = flightById(s, p.flight);
        const ready = !f || f.bagWork >= 0.5 || f.bagState === FUEL.done;
        if (p.until === 0) p.until = s.time;
        if (ready || s.time - p.until > 45) {
          if (!ready && f) f.mood = Math.max(0, f.mood - 0.03);
          p.state = PST.toExit;
          p.path = [p.x, p.y, 0, 22.1, L.field.y0 + 0.1, 0, T.exit[0], T.exit[1], 0];
          p.pathPos = 0;
          p.moving = true;
        }
        break;
      }
    }
  }
}

/** Where an arriving passenger waits for their bag (spread around the carousel). */
export function claimSpot(s: GameState, p: Person): [number, number] {
  const c = layoutOf(s.tier).terminal.claim;
  const a = hash01(p.id * 11 + 1) * Math.PI * 2;
  const r = 0.55 + hash01(p.id * 13 + 2) * 0.25;
  return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.8];
}

/** Takes a passenger out of every queue and station (their flight left). */
export function leaveStations(s: GameState, p: Person): void {
  s.checkinQ = s.checkinQ.filter((id) => id !== p.id);
  s.securityQ = s.securityQ.filter((id) => id !== p.id);
  for (let i = 0; i < s.counterBusy.length; i++) if (s.counterBusy[i] === p.id) s.counterBusy[i] = 0;
  for (let i = 0; i < s.laneBusy.length; i++) if (s.laneBusy[i] === p.id) s.laneBusy[i] = 0;
}
