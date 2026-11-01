import type { Big } from '../big';

export type GameEventKind =
  | 'cmdRejected'
  | 'moneyChanged'
  | 'landingRequest'
  | 'landingCleared'
  | 'touchdown'
  | 'docked'
  | 'fuelQueued'
  | 'fuelStart'
  | 'fuelDone'
  | 'boardingStart'
  | 'boardingDone'
  | 'takeoffRequest'
  | 'takeoffCleared'
  | 'liftoff'
  | 'paid'
  | 'diverted';

export interface GameEvent {
  id: number;
  kind: GameEventKind;
  /** Sim time when it happened. */
  t: number;
  x: number;
  y: number;
  a: number;
  b: number;
  c: number;
}

/** Why a command was refused (event cmdRejected, field a). */
export const REJECT = { noStand: 1, notReady: 2, unknownFlight: 3 } as const;

export type Command =
  | { type: 'debugAddMoney'; amount: number }
  | { type: 'clearLanding'; flightId: number }
  | { type: 'sendFuel'; flightId: number }
  | { type: 'startBoarding'; flightId: number }
  | { type: 'clearTakeoff'; flightId: number };

export type FlightPhase =
  | 'inbound'
  | 'holding'
  | 'final'
  | 'landing'
  | 'rollout'
  | 'taxiIn'
  | 'deboarding'
  | 'turnaround'
  | 'boarding'
  | 'doorsClosed'
  | 'taxiOut'
  | 'holdShort'
  | 'lineUp'
  | 'takeoff'
  | 'diverted';

/** What the flight is waiting for the player (or staff) to do. */
export const WANT = { none: 0, clearLanding: 1, fuel: 2, board: 3, clearTakeoff: 4 } as const;
export type Want = (typeof WANT)[keyof typeof WANT];

/** Fuel service: 0 none, 1 requested (queued), 2 truck driving, 3 fueling, 4 done. */
export const FUEL = { none: 0, queued: 1, driving: 2, fueling: 3, done: 4 } as const;

export interface Flight {
  id: number;
  airline: number;
  aircraft: number;
  /** Flight number shown after the airline code (e.g. 214). */
  num: number;
  origin: number;
  dest: number;
  phase: FlightPhase;
  phaseT: number;
  x: number;
  y: number;
  z: number;
  /** Position at the previous step, for render interpolation. */
  px: number;
  py: number;
  pz: number;
  heading: number;
  speed: number;
  path: number[];
  pathPos: number;
  stand: number;
  paxIn: number;
  paxOut: number;
  deboarded: number;
  /** Departing passengers created so far (they walk out of the hut). */
  paxSpawned: number;
  boarded: number;
  fuelNeed: number;
  fuel: number;
  fuelState: number;
  landCleared: boolean;
  takeoffCleared: boolean;
  boardingStarted: boolean;
  holdAngle: number;
  holdLevel: number;
  /** 0..1, runs out while circling: then the flight diverts. */
  patience: number;
  /** 0..1 satisfaction, multiplies the payment. */
  mood: number;
  spawnedAt: number;
  dockedAt: number;
  offBlockAt: number;
  /** Scheduled off-block time; later is "late". */
  slot: number;
  /** When the current wanted action became possible. */
  readyAt: number;
  want: Want;
  /** 1 on time, -1 late, 0 not yet known. */
  onTime: number;
  /** Paid amount (plain number for the card). */
  paid: number;
  /** Timer for spawning passengers one by one. */
  paxTimer: number;
}

/** Person states. */
export const PST = { toHut: 0, toSpot: 1, waiting: 2, toPlane: 3, leaving: 4 } as const;

export interface Person {
  id: number;
  flight: number;
  outfit: number;
  state: number;
  x: number;
  y: number;
  px: number;
  py: number;
  heading: number;
  speed: number;
  path: number[];
  pathPos: number;
  spot: number;
  /** Walking or not (for the animation). */
  moving: boolean;
}

export type VehicleState = 'idle' | 'toPlane' | 'fueling' | 'return';

export interface Vehicle {
  id: number;
  kind: 'fuel';
  x: number;
  y: number;
  px: number;
  py: number;
  heading: number;
  speed: number;
  path: number[];
  pathPos: number;
  state: VehicleState;
  flight: number;
}

export interface Stand {
  /** Flight id parked here, 0 = free. */
  occupant: number;
  /** Flight id that will park here, 0 = none. */
  reserved: number;
}

export interface Stats {
  served: number;
  pax: number;
  onTime: number;
  late: number;
  diverted: number;
  earned: Big;
}

export interface GameState {
  version: number;
  seed: number;
  /** RNG state (uint32), advanced by rand(). */
  rng: number;
  tick: number;
  /** Seconds since this game started (sim clock). */
  time: number;
  tier: number;
  money: Big;
  diamonds: number;
  /** Airfield rating 1..5 (moving average of passenger mood). */
  rating: number;
  flights: Flight[];
  people: Person[];
  vehicles: Vehicle[];
  stands: Stand[];
  /** Flight ids waiting for the fuel truck. */
  fuelQueue: number[];
  nextId: number;
  nextArrival: number;
  spotCursor: number;
  stats: Stats;
  events: GameEvent[];
  nextEventId: number;
  /** Commands waiting for the next step. */
  queue: Command[];
}
