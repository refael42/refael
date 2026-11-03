import { layoutFor } from '../../data/tiers';
import { Big } from '../big';
import { normalizeSeed } from '../rng';
import { SAVE_VERSION } from './constants';
import { ensureHoldArrays } from './graph';
import { makeIncome } from './income';
import { refreshApplicants } from './staff';
import { startAirlines } from './airlines';
import type { GameState } from './types';
import { makeVehicle } from './vehicles';

export function createGame(seed: number): GameState {
  const s = normalizeSeed(seed);
  const L = layoutFor(1);
  const game: GameState = {
    version: SAVE_VERSION,
    seed: s,
    rng: s,
    tick: 0,
    time: 0,
    tier: 1,
    money: Big.fromNumber(0),
    diamonds: 0,
    rating: 3,
    flights: [],
    people: [],
    vehicles: [makeVehicle(1, 'fuel', L), makeVehicle(2, 'bags', L)],
    stands: L.stands.map(() => ({ occupant: 0, reserved: 0 })),
    fuelQueue: [],
    bagQueue: [],
    edgeHold: [],
    nodeHold: [],
    standsBuilt: 1,
    standOpen: [true],
    wake: [
      { cat: 0, at: -99 },
      { cat: 0, at: -99 },
    ],
    traffic: 1,
    staff: [],
    applicants: [],
    wageDay: 1,
    nextApplicantAt: 90,
    tierBuild: null,
    tierSwitch: false,
    profile: { manager: '', airport: '' },
    contracts: [],
    offers: [],
    rep: [],
    nextOfferAt: 0,
    schedule: [],
    departed: [],
    decor: {},
    checkinQ: [],
    securityQ: [],
    counterBusy: [],
    laneBusy: [],
    upg: {},
    upgRev: 0,
    builds: [],
    priceMul: 1,
    income: makeIncome(),
    nextId: 3,
    nextArrival: 2,
    spotCursor: 0,
    stats: { served: 0, pax: 0, onTime: 0, late: 0, diverted: 0, earned: Big.fromNumber(0), wages: Big.fromNumber(0), spent: Big.fromNumber(0), lostBags: 0, sales: Big.fromNumber(0), queueSecs: 0, queued: 0 },
    events: [],
    nextEventId: 1,
    queue: [],
  };
  ensureHoldArrays(game);
  refreshApplicants(game);
  startAirlines(game);
  return game;
}

export function findFlight(s: GameState, id: number) {
  for (const f of s.flights) if (f.id === id) return f;
  return undefined;
}
