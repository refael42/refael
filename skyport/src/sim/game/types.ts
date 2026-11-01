import type { Big } from '../big';
import type { IncomeState } from './income';

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
  | 'diverted'
  | 'bagsQueued'
  | 'bagsStart'
  | 'bagsDone'
  | 'hired'
  | 'wagesPaid'
  | 'notEnoughMoney'
  | 'upgraded'
  | 'milestone'
  | 'buildStart'
  | 'buildDone'
  | 'offline';

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
export const REJECT = { noStand: 1, notReady: 2, unknownFlight: 3, noMoney: 4, limit: 5 } as const;

export type Command =
  | { type: 'debugAddMoney'; amount: number }
  | { type: 'clearLanding'; flightId: number }
  | { type: 'sendFuel'; flightId: number }
  | { type: 'startBoarding'; flightId: number }
  | { type: 'clearTakeoff'; flightId: number }
  | { type: 'sendBags'; flightId: number }
  | { type: 'hire'; applicantId: number }
  /** count: levels to buy, -1 = as many as you can afford. */
  | { type: 'buyUpgrade'; id: string; count: number }
  | { type: 'rushBuild' };

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
export const WANT = { none: 0, clearLanding: 1, fuel: 2, board: 3, clearTakeoff: 4, bags: 5 } as const;
export type Want = (typeof WANT)[keyof typeof WANT];

/** Service progress (fuel, bags): 0 none, 1 requested (queued), 2 vehicle driving, 3 working, 4 done. */
export const FUEL = { none: 0, queued: 1, driving: 2, fueling: 3, done: 4 } as const;
export const SVC = FUEL;

/** One leg of a ground route on the taxi graph (see graph.ts). */
export interface GroundRouteState {
  edges: number[];
  path: number[];
  nodeDist: number[];
}

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
  /** Bitmask of pending actions (1 << WANT value). */
  wants: number;
  bagsIn: number;
  bagsOut: number;
  bagState: number;
  /** 0..1 progress of unloading + loading. */
  bagWork: number;
  /** Ground route on the taxi graph (null in the air / on the runway). */
  groute: GroundRouteState | null;
  /** Index of the route edge the plane is on. */
  gIdx: number;
  /** Edges reserved by this plane. */
  gHeld: number[];
  /** Node held at the route start until the tail clears it (-1 none). */
  gStart: number;
  /** Stopped because the way ahead is reserved by someone else. */
  gWaiting: boolean;
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

export type ServiceKind = 'fuel' | 'bags';

export interface Vehicle {
  id: number;
  kind: ServiceKind;
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
  wages: Big;
  spent: Big;
}

export interface Build {
  id: string;
  /** Level the upgrade reaches when done. */
  level: number;
  /** Seconds left (stored as remaining time, so offline progress is a subtraction). */
  remaining: number;
  total: number;
}

export interface StaffMember {
  id: number;
  /** Index into STAFF_ROLES. */
  role: number;
  /** Indices into FIRST_NAMES / LAST_NAMES. */
  first: number;
  last: number;
  /** 0.8 .. 1.3, higher reacts faster. */
  speed: number;
  wage: number;
  hiredAt: number;
  /** Sim time until which the worker is busy. */
  busyUntil: number;
}

export interface Applicant {
  id: number;
  role: number;
  first: number;
  last: number;
  speed: number;
  cost: number;
  wage: number;
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
  /** Flight ids waiting for the baggage cart. */
  bagQueue: number[];
  /** Taxi graph reservations: flight id per edge / node (0 = free). */
  edgeHold: number[];
  nodeHold: number[];
  /** How many of the layout's stands are built. */
  standsBuilt: number;
  /** Traffic multiplier (marketing raises it). */
  traffic: number;
  staff: StaffMember[];
  applicants: Applicant[];
  /** Last game day whose wages were paid. */
  wageDay: number;
  /** Upgrade levels by id. */
  upg: Record<string, number>;
  /** Bumped whenever a level changes (effects cache key). */
  upgRev: number;
  /** Construction in progress (one crew for now). */
  builds: Build[];
  /** Global price multiplier (trophies later). */
  priceMul: number;
  income: IncomeState;
  nextId: number;
  nextArrival: number;
  spotCursor: number;
  stats: Stats;
  events: GameEvent[];
  nextEventId: number;
  /** Commands waiting for the next step. */
  queue: Command[];
}
