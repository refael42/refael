/**
 * The departures / arrivals board: rows built from the schedule, the planes
 * in the air or on the ground, and the latest departures. Pure: reads state.
 */
import { AIRCRAFT } from '../../data/aircraft';
import { kindOf } from './airlines';
import type { GameState } from './types';

export type BoardStatus =
  | 'scheduled'
  | 'delayed'
  | 'approach'
  | 'holding'
  | 'landing'
  | 'landed'
  | 'onTime'
  | 'boarding'
  | 'closed'
  | 'departed'
  | 'cancelled';

export interface BoardRow {
  /** Unique key for lists. */
  key: string;
  /** Scheduled time (sim seconds) shown as a clock time. */
  time: number;
  /** Later time when it slipped (0 = none). */
  expected: number;
  al: number;
  num: number;
  /** City index: origin for arrivals, destination for departures. */
  city: number;
  status: BoardStatus;
  /** The plane on the map, if there is one (0 = none). */
  flightId: number;
}

/** Arrivals that slip more than this (seconds) show as delayed. */
const LATE = 15;
const ROWS = 9;
/** Turnaround assumed for a flight whose aircraft is not known yet (seconds). */
const PLANNED_TURN = 28;

export function arrivalsBoard(s: GameState): BoardRow[] {
  const rows: BoardRow[] = [];
  for (const f of s.flights) {
    let status: BoardStatus | null = null;
    switch (f.phase) {
      case 'inbound':
        status = 'approach';
        break;
      case 'holding':
        status = 'holding';
        break;
      case 'final':
      case 'landing':
        status = 'landing';
        break;
      case 'rollout':
      case 'taxiIn':
        status = 'landed';
        break;
      case 'diverted':
        if (f.dockedAt === 0) status = 'cancelled';
        break;
    }
    if (!status) continue;
    rows.push({ key: `f${f.id}`, time: f.sched, expected: 0, al: f.airline, num: f.num, city: f.origin, status, flightId: f.id });
  }
  for (const p of s.schedule) {
    if (rows.length >= ROWS) break;
    const late = s.time > p.at + LATE;
    rows.push({ key: `p${p.id}`, time: p.at, expected: late ? s.time + 10 : 0, al: p.al, num: p.num, city: p.origin, status: late ? 'delayed' : 'scheduled', flightId: 0 });
  }
  return rows.sort((a, b) => a.time - b.time).slice(0, ROWS);
}

/** The latest two departures on top, then what is still to go, earliest first. */
export function departuresBoard(s: GameState): BoardRow[] {
  const gone: BoardRow[] = [];
  for (const d of s.departed) {
    gone.push({ key: `d${d.al}-${d.num}-${d.at}`, time: d.slot, expected: 0, al: d.al, num: d.num, city: d.dest, status: d.status === 1 ? 'cancelled' : 'departed', flightId: 0 });
  }
  const rows: BoardRow[] = [];
  for (const f of s.flights) {
    if (f.phase === 'diverted' || f.offBlockAt > 0) continue;
    const turn = AIRCRAFT[f.aircraft].baseTurnaround * kindOf(f.airline).turnaround;
    // before docking: planned arrival + a typical landing and taxi + the turnaround
    const time = f.dockedAt > 0 ? f.slot : f.sched + 40 + turn;
    let status: BoardStatus = 'onTime';
    if (f.phase === 'boarding') status = 'boarding';
    else if (f.phase === 'doorsClosed') status = 'closed';
    let expected = 0;
    if (f.dockedAt > 0 && s.time > time + 3) {
      if (status === 'onTime') status = 'delayed';
      expected = s.time + 5;
    } else if (f.dockedAt === 0 && (f.phase === 'holding' || s.time > f.sched + 60)) {
      // still circling or slow to get in: the departure slips
      status = 'delayed';
      expected = s.time + 25 + turn;
    }
    rows.push({ key: `f${f.id}`, time, expected, al: f.airline, num: f.num, city: f.dest, status, flightId: f.id });
  }
  // left the gate but not in the air yet: departed (once airborne they are in the log)
  for (const f of s.flights) {
    if (f.phase === 'diverted' || f.offBlockAt === 0 || f.paid > 0) continue;
    gone.push({ key: `f${f.id}`, time: f.slot, expected: 0, al: f.airline, num: f.num, city: f.dest, status: 'departed', flightId: f.id });
  }
  // planned arrivals turn around and leave again: they are on the departures board already
  for (const p of s.schedule) {
    if (rows.length >= ROWS) break;
    const time = p.at + 40 + PLANNED_TURN * kindOf(p.al).turnaround;
    rows.push({ key: `p${p.id}`, time, expected: 0, al: p.al, num: p.num, city: p.dest, status: 'scheduled', flightId: 0 });
  }
  gone.sort((a, b) => a.time - b.time);
  rows.sort((a, b) => a.time - b.time);
  return [...gone.slice(-2), ...rows].slice(0, ROWS);
}
