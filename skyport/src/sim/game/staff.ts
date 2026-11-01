/**
 * Staff: applicants, hiring, wages, and the automatic work each role does.
 * New randomness here uses hash01(id ...) so older games stay identical.
 */
import { FIRST_NAMES, LAST_NAMES, STAFF_ROLES } from '../../data/staff';
import { Big } from '../big';
import { hash01 } from '../hash';
import { gameClock } from './clock';
import { pushEvent } from './events';
import { clearLanding, clearTakeoff, freeStand, startBoarding, wantsAction } from './flights';
import { REJECT, WANT, type Applicant, type GameState } from './types';
import { requestService } from './vehicles';

/** Most workers of one role (more need more vehicles / tower upgrades). */
export const MAX_PER_ROLE = 2;

export function makeApplicant(s: GameState, role: number): Applicant {
  const id = s.nextId++;
  const r = STAFF_ROLES[role];
  const speed = Math.round((0.8 + hash01(id * 31 + 7) * 0.5) * 100) / 100;
  return {
    id,
    role,
    first: Math.floor(hash01(id * 17 + 3) * FIRST_NAMES.length),
    last: Math.floor(hash01(id * 19 + 5) * LAST_NAMES.length),
    speed,
    cost: Math.round(r.hireCost * (0.7 + speed * 0.3)),
    wage: Math.round(r.wage * (0.7 + speed * 0.3)),
  };
}

/** Makes sure every unlocked role has one applicant waiting. */
export function refreshApplicants(s: GameState): void {
  STAFF_ROLES.forEach((r, i) => {
    if (r.unlockTier > s.tier) return;
    if (!s.applicants.some((a) => a.role === i)) s.applicants.push(makeApplicant(s, i));
  });
}

export function staffCount(s: GameState, role: number): number {
  let n = 0;
  for (const m of s.staff) if (m.role === role) n++;
  return n;
}

export function hire(s: GameState, applicantId: number): number {
  const i = s.applicants.findIndex((a) => a.id === applicantId);
  if (i < 0) return REJECT.unknownFlight;
  const a = s.applicants[i];
  if (staffCount(s, a.role) >= MAX_PER_ROLE) return REJECT.limit;
  if (s.money.lt(a.cost)) return REJECT.noMoney;
  s.money = s.money.sub(a.cost);
  s.staff.push({ id: a.id, role: a.role, first: a.first, last: a.last, speed: a.speed, wage: a.wage, hiredAt: s.time, busyUntil: s.time + 1 });
  s.applicants.splice(i, 1);
  refreshApplicants(s);
  pushEvent(s, 'hired', 0, 0, a.role, a.id);
  return 0;
}

/** Pays wages once per game day. */
export function payWages(s: GameState): void {
  const day = gameClock(s.time).day;
  if (day <= s.wageDay) return;
  s.wageDay = day;
  let total = 0;
  for (const m of s.staff) total += m.wage;
  if (total <= 0) return;
  const amount = Big.fromNumber(total);
  s.money = s.money.gte(amount) ? s.money.sub(amount) : Big.ZERO;
  s.stats.wages = s.stats.wages.add(amount);
  pushEvent(s, 'wagesPaid', 0, 0, total);
}

export function wagesPerDay(s: GameState): number {
  let total = 0;
  for (const m of s.staff) total += m.wage;
  return total;
}

/** Each worker picks one job when free and past their reaction time. */
export function updateStaff(s: GameState): void {
  for (const m of s.staff) {
    if (m.busyUntil > s.time) continue;
    const role = STAFF_ROLES[m.role];
    const reaction = role.reaction / m.speed;
    const ripe = (readyAt: number) => s.time - readyAt >= reaction;
    switch (role.id) {
      case 'atc': {
        let done = false;
        if (freeStand(s) >= 0) {
          for (const f of s.flights) {
            if (wantsAction(f, WANT.clearLanding) && ripe(f.readyAt) && clearLanding(s, f)) {
              done = true;
              break;
            }
          }
        }
        if (!done) {
          for (const f of s.flights) {
            if (wantsAction(f, WANT.clearTakeoff) && ripe(f.readyAt) && clearTakeoff(s, f)) {
              done = true;
              break;
            }
          }
        }
        if (done) m.busyUntil = s.time + reaction * 0.5;
        break;
      }
      case 'agent': {
        for (const f of s.flights) {
          if (wantsAction(f, WANT.board) && ripe(f.readyAt) && startBoarding(s, f)) {
            m.busyUntil = s.time + 1;
            break;
          }
        }
        break;
      }
      case 'fueler':
      case 'porter': {
        const kind = role.id === 'fueler' ? 'fuel' : 'bags';
        const want = kind === 'fuel' ? WANT.fuel : WANT.bags;
        if (!s.vehicles.some((v) => v.kind === kind && v.state === 'idle')) break;
        for (const f of s.flights) {
          if (wantsAction(f, want) && ripe(f.readyAt) && requestService(s, f, kind) !== 'rejected') {
            m.busyUntil = s.time + 0.8;
            break;
          }
        }
        break;
      }
    }
  }
}
