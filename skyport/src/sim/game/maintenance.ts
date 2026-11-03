/**
 * The hangar: airlines you work with send their smaller planes in for
 * scheduled checks (A: short, B: long) when a bay is free. A check is done by
 * the mechanics with parts from the store, pays a maintenance fee and keeps
 * the whole fleet healthier (fewer faults at the stands).
 */
import { AIRCRAFT, standFits } from '../../data/aircraft';
import { tierDef } from '../../data/tiers';
import { Big } from '../big';
import { hash01, hashU32 } from '../hash';
import { fleetHere } from './airlines';
import { pushEvent } from './events';
import { recordIncome } from './income';
import { layoutOf } from './layout';
import { FUEL, type Flight, type GameState, type Planned } from './types';
import { level } from './upgrades';

export interface CheckDef {
  /** Work in the bay (seconds, before staff speed). */
  seconds: number;
  parts: number;
  /** Fee as a multiple of the plane's landing fee (before the tier's pay). */
  fee: number;
}

/** Index 1 = A check, 2 = B check. */
export const CHECKS: readonly CheckDef[] = [
  { seconds: 0, parts: 0, fee: 0 },
  { seconds: 70, parts: 1, fee: 5 },
  { seconds: 160, parts: 3, fee: 14 },
];

/** Seconds between check requests, roughly (each bay). */
const CHECK_EVERY = 420;

function gh(s: GameState, n: number): number {
  return hash01(hashU32(s.seed ^ 0x6a9) + n);
}

/** Hangar bays built so far (stand indices). */
export function hangarBays(s: GameState): number[] {
  const L = layoutOf(s.tier);
  const out: number[] = [];
  L.stands.forEach((st, i) => {
    if (st.hangar && s.standOpen[i]) out.push(i);
  });
  return out;
}

/** A free bay that fits this aircraft (-1 none). */
function freeBay(s: GameState, aircraft: number): number {
  const L = layoutOf(s.tier);
  for (const i of hangarBays(s)) {
    if (s.stands[i].occupant || s.stands[i].reserved) continue;
    if (standFits(L.stands[i].size, AIRCRAFT[aircraft].stand)) return i;
  }
  return -1;
}

/** Fewer faults at the stands with the fleet maintained in your hangar. */
export function hangarFaultFactor(s: GameState): number {
  return Math.max(0.4, 1 - 0.3 * level(s, 'hangar'));
}

/** Now and then a contracted airline sends a plane in for a check, if a bay is free. */
export function updateChecks(s: GameState, spawn: (p: Planned) => Flight | null): void {
  if (s.time < s.nextCheckAt) return;
  const bays = hangarBays(s);
  s.nextCheckAt = s.time + (CHECK_EVERY / Math.max(1, bays.length)) * (0.7 + 0.6 * gh(s, s.tick));
  if (bays.length === 0 || s.tierSwitch || s.contracts.length === 0) return;
  // the airline books a slot only when the runway has room: nobody circling, few on approach
  let airborne = 0;
  for (const f of s.flights) if (f.phase === 'holding' || f.phase === 'inbound' || f.phase === 'final') airborne++;
  // (and one ferry flight on its way at a time)
  if (airborne > 1 || s.flights.some((f) => f.check > 0 && f.dockedAt === 0)) {
    s.nextCheckAt = s.time + 30;
    return;
  }
  // airlines with a plane that fits a free bay
  const pool: { al: number; ac: number }[] = [];
  for (const c of s.contracts) for (const ac of fleetHere(s, c.al)) if (AIRCRAFT[ac].stand !== 'heli' && freeBay(s, ac) >= 0) pool.push({ al: c.al, ac });
  if (pool.length === 0) return;
  const pick = pool[Math.floor(gh(s, s.tick + 1) * pool.length)];
  const id = s.nextId++;
  const f = spawn({ id, at: s.time, al: pick.al, num: 900 + Math.floor(gh(s, id) * 99), origin: 0, dest: 0 });
  if (!f) return;
  const bay = freeBay(s, pick.ac);
  if (bay < 0) return;
  // a ferry flight: no passengers or bags, a little fuel, straight to the hangar
  const ac = AIRCRAFT[pick.ac];
  f.aircraft = pick.ac;
  f.check = gh(s, id * 3 + 7) < 0.25 ? 2 : 1;
  f.paxIn = 0;
  f.paxOut = 0;
  f.bagsIn = 0;
  f.bagsOut = 0;
  f.bagState = FUEL.done;
  f.bagWork = 1;
  f.fuelNeed = Math.round(ac.fuelLoad * 0.25);
  f.dest = f.origin;
  f.stand = bay;
  s.stands[bay].reserved = f.id;
  pushEvent(s, 'checkRequest', f.x, f.y, f.id, f.check);
}

/** On arrival in the bay: the check is the work the mechanics do (like a repair). */
export function startCheck(f: Flight): void {
  const c = CHECKS[f.check];
  f.aog = 1;
  f.repState = FUEL.none;
  f.repWork = 0;
  f.repNeed = c.seconds;
  f.repParts = c.parts;
  // the airline books the bay for the check: it is not late for that
  f.slot += c.seconds * 1.4;
}

/** The fee for a finished check; the airline is pleased. */
export function finishCheck(s: GameState, f: Flight): void {
  const c = CHECKS[f.check];
  const fee = Math.round(AIRCRAFT[f.aircraft].landingFee * c.fee * tierDef(s.tier).pay);
  s.money = s.money.add(Big.fromNumber(fee));
  s.stats.earned = s.stats.earned.add(Big.fromNumber(fee));
  s.stats.checks++;
  recordIncome(s, fee, [fee, 0, 0, 0], 0);
  s.rep[f.airline] = Math.min(100, (s.rep[f.airline] ?? 50) + (f.check === 2 ? 1 : 0.5));
  pushEvent(s, 'checkDone', f.x, f.y, f.id, fee, f.check);
}
