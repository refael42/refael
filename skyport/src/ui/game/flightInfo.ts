import { AIRCRAFT } from '../../data/aircraft';
import { AIRLINES } from '../../data/airlines';
import { CITIES } from '../../data/cities';
import type { TKey } from '../../i18n';
import { clockText, FUEL, WANT, type Flight } from '../../sim';
import { ACTION_COLORS, type IconName } from '../../render/art/icons';

export function flightCode(f: Flight): string {
  return `${AIRLINES[f.airline]?.code ?? '???'}${f.num}`;
}

export function cityKey(i: number): TKey {
  return `city.${CITIES[i]?.id ?? CITIES[0].id}` as TKey;
}

export const WANT_ACTION: Record<
  number,
  { key: TKey; icon: IconName; color: string; cmd: 'clearLanding' | 'sendFuel' | 'startBoarding' | 'clearTakeoff' } | undefined
> = {
  [WANT.clearLanding]: { key: 'action.clearLanding', icon: 'land', color: ACTION_COLORS.land, cmd: 'clearLanding' },
  [WANT.fuel]: { key: 'action.fuel', icon: 'fuel', color: ACTION_COLORS.fuel, cmd: 'sendFuel' },
  [WANT.board]: { key: 'action.board', icon: 'pax', color: ACTION_COLORS.board, cmd: 'startBoarding' },
  [WANT.clearTakeoff]: { key: 'action.clearTakeoff', icon: 'takeoff', color: ACTION_COLORS.takeoff, cmd: 'clearTakeoff' },
};

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
}

export function viewOf(f: Flight): FlightView {
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
  };
}

export function sameView(a: FlightView | null, b: FlightView | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  for (const k of Object.keys(a) as (keyof FlightView)[]) if (a[k] !== b[k]) return false;
  return true;
}
