import { AIRCRAFT } from '../../data/aircraft';
import { AIRLINES } from '../../data/airlines';
import { CITIES } from '../../data/cities';
import type { TKey } from '../../i18n';
import { clockText, FUEL, SVC, WANT, type Flight } from '../../sim';
import { ACTION_COLORS, type IconName } from '../../render/art/icons';

export function flightCode(f: Flight): string {
  return `${AIRLINES[f.airline]?.code ?? '???'}${f.num}`;
}

export function cityKey(i: number): TKey {
  return `city.${CITIES[i]?.id ?? CITIES[0].id}` as TKey;
}

export const WANT_ACTION: Record<
  number,
  { key: TKey; icon: IconName; color: string; cmd: 'clearLanding' | 'sendFuel' | 'startBoarding' | 'clearTakeoff' | 'sendBags' | 'repair' } | undefined
> = {
  [WANT.clearLanding]: { key: 'action.clearLanding', icon: 'land', color: ACTION_COLORS.land, cmd: 'clearLanding' },
  [WANT.fuel]: { key: 'action.fuel', icon: 'fuel', color: ACTION_COLORS.fuel, cmd: 'sendFuel' },
  [WANT.board]: { key: 'action.board', icon: 'pax', color: ACTION_COLORS.board, cmd: 'startBoarding' },
  [WANT.clearTakeoff]: { key: 'action.clearTakeoff', icon: 'takeoff', color: ACTION_COLORS.takeoff, cmd: 'clearTakeoff' },
  [WANT.bags]: { key: 'action.bags', icon: 'bag', color: ACTION_COLORS.bags, cmd: 'sendBags' },
  [WANT.repair]: { key: 'action.repair', icon: 'wrench', color: ACTION_COLORS.repair, cmd: 'repair' },
};

const ORDER = [WANT.clearLanding, WANT.repair, WANT.bags, WANT.fuel, WANT.board, WANT.clearTakeoff];

/** Flat, comparable view of a flight for the card (polled twice a second). */
export interface FlightView {
  id: number;
  code: string;
  airline: string;
  tail: string;
  model: string;
  origin: number;
  dest: number;
  phase: Flight['phase'];
  pax: number;
  mood: number;
  patience: number;
  airborne: boolean;
  fuel: number;
  fuelActive: boolean;
  deboard: number;
  board: number;
  slot: string;
  onTime: number;
  want: number;
  /** Pending actions, comma separated WANT values (string keeps the shallow compare simple). */
  actions: string;
  bags: number;
  bagsActive: boolean;
  /** Share of departing passengers through check-in (-1 = not relevant now). */
  checked: number;
  waiting: boolean;
  /** Airline kind id and its reputation with you (rounded, -1 unknown). */
  kind: string;
  rep: number;
  /** Why a cleared plane is still circling ('' = it isn't). */
  hold: '' | 'fog' | 'storm' | 'closed' | 'crosswind' | 'turn' | 'wake' | 'runway';
  /** Declared an emergency / a VIP flight. */
  emergency: boolean;
  vip: boolean;
  /** A sick passenger on board; a celebrity's jet; a historic plane on a visit (seconds left on show, -1 none). */
  medical: boolean;
  celeb: boolean;
  historic: number;
  /** Diverted here from another airport (pays double). */
  guest: boolean;
  /** Grounded with a fault (1), in for a check (check 1/2), repair progress, waiting for a part. */
  aog: number;
  check: number;
  repair: number;
  partWait: boolean;
}

export function viewOf(f: Flight, rep = -1, hold: FlightView['hold'] = '', now = 0): FlightView {
  const al = AIRLINES[f.airline];
  return {
    id: f.id,
    code: flightCode(f),
    airline: al?.name ?? '',
    tail: al?.livery.tail ?? '#888',
    model: AIRCRAFT[f.aircraft]?.model ?? '',
    origin: f.origin,
    dest: f.dest,
    phase: f.phase,
    pax: f.phase === 'boarding' || f.phase === 'turnaround' || f.dockedAt > 0 ? f.paxOut : f.paxIn,
    mood: Math.round(f.mood * 100) / 100,
    patience: Math.round(f.patience * 100) / 100,
    airborne: f.phase === 'inbound' || f.phase === 'holding',
    fuel: f.fuelNeed > 0 ? Math.round((f.fuel / f.fuelNeed) * 100) / 100 : 0,
    fuelActive: f.fuelState === FUEL.driving || f.fuelState === FUEL.fueling || f.fuelState === FUEL.done,
    deboard: f.paxIn > 0 ? Math.round((f.deboarded / f.paxIn) * 100) / 100 : 1,
    board: f.paxOut > 0 ? Math.round((f.boarded / f.paxOut) * 100) / 100 : 0,
    slot: f.slot > 0 ? clockText(f.slot) : '',
    onTime: f.onTime,
    want: f.want,
    actions: ORDER.filter((w) => (f.wants & (1 << w)) !== 0).join(','),
    bags: Math.round(Math.max(0, f.bagWork) * 100) / 100,
    checked: f.paxOut > 0 && f.phase !== 'taxiOut' && f.phase !== 'holdShort' && f.phase !== 'lineUp' && f.phase !== 'takeoff' ? Math.round((f.bagsChecked / f.paxOut) * 100) / 100 : -1,
    bagsActive: f.bagState >= SVC.driving,
    waiting: f.gWaiting,
    kind: al?.kind ?? 'regional',
    rep: rep >= 0 ? Math.round(rep) : -1,
    hold,
    guest: f.guest,
    aog: f.aog,
    check: f.check,
    repair: f.aog === 1 && f.repState >= 3 ? Math.round(f.repWork * 100) / 100 : -1,
    partWait: f.partWait,
    emergency: f.emergency,
    vip: f.vip,
    medical: f.medical,
    celeb: f.celeb,
    historic: f.historic ? (f.dockedAt > 0 && f.holdUntil > 0 ? Math.max(0, Math.ceil(f.holdUntil - now)) : 0) : -1,
  };
}

export function sameView(a: FlightView | null, b: FlightView | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  for (const k of Object.keys(a) as (keyof FlightView)[]) if (a[k] !== b[k]) return false;
  return true;
}
