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
  | 'offline'
  | 'applicantArrived'
  | 'applicantLeft'
  | 'negotiated'
  | 'levelUp'
  | 'raiseRequest'
  | 'raiseAnswered'
  | 'quit'
  | 'trialEnded'
  | 'fired'
  | 'oops'
  | 'onBreak'
  | 'tierBuildStart'
  | 'tierBuildDone'
  | 'tierUp'
  | 'decorMoved'
  | 'checkedIn'
  | 'lostBag'
  | 'sale'
  | 'offerArrived'
  | 'offerExpired'
  | 'offerResult'
  | 'contractSigned'
  | 'contractEnded'
  | 'contractExpanded'
  | 'airlineWarning'
  | 'airlineHappy'
  | 'airlineLeft'
  | 'runwayFlip'
  | 'fogIn'
  | 'fogOut'
  | 'crosswind'
  | 'goAround'
  | 'diversionRequest'
  /** a: store (0 fuel, 1 parts), b: amount, c: 1 when urgent. */
  | 'supplyOrdered'
  | 'supplyArrived'
  /** a: store. Ran dry. */
  | 'supplyOut'
  /** a: store. Running low with nothing on the way (no money for an order). */
  | 'supplyLow'
  /** a: flight id. A technical fault: grounded until repaired. */
  | 'aog'
  | 'repairStart'
  | 'repairDone'
  /** a: flight id. The mechanic waits for a spare part. */
  | 'waitingPart'
  /** a: flight id, b: check (1 A, 2 B). */
  | 'checkRequest'
  /** a: flight id, b: fee, c: check. */
  | 'checkDone'
  /** a: goal index, b: reward. */
  | 'goalDone'
  /** a: incident kind index, b: incident id, c: seconds until it starts. */
  | 'incidentSoon'
  | 'incidentStart'
  /** a: kind index, b: result (1 good, -1 bad), c: coins. */
  | 'incidentEnd'
  /** a: incident id. The inspection car drives out. */
  | 'fodCar'
  /** a: flight id. Fire trucks roll out. */
  | 'fireOut'
  /** a: flight id, b: reward. */
  | 'emergencyLanded'
  | 'emergencyMissed'
  /** a: flight id. */
  | 'birdStrike'
  /** a: flight id, b: tip. */
  | 'vipTip'
  /** a: game day. */
  | 'weekend'
  /** a: holiday index (HOLIDAYS), b: day of it (0 = the travel days before). */
  | 'holiday'
  /** a: flight id. The ambulance is on its way. */
  | 'ambulanceOut'
  /** a: flight id, b: reward. The patient is in good hands. */
  | 'medicalDone'
  | 'medicalMissed'
  /** a: flight id, b: 1 = the press is in, 0 = private. */
  | 'celebDocked'
  /** a: flight id, b: tip (private visit). */
  | 'celebTip'
  /** a: flight id. The press loved it: more people want to fly. */
  | 'buzz'
  /** a: flight id. The press saw a bad visit. */
  | 'badPress'
  /** a: flight id. A historic plane opened for visitors. */
  | 'exhibitOpen'
  /** M12: a passenger wrote a review (a = stars, b = line); the bonus for good ones was collected (a = coins). */
  | 'review'
  | 'reviewBonus'
  /** The Aviation Guide is out. a: stars, b: stars before, c: edition; x: coins, y: diamonds won (not a place). */
  | 'guideEdition'
  /** a: suspects. An undercover inspector is somewhere among the passengers. */
  | 'rumor'
  /** a: person. The staff gives this passenger the VIP care. */
  | 'vipCare'
  /** a: 0 nobody picked, 1 the right one, 2 someone else; b: the inspector, c: the pick. */
  | 'inspectorLeft'
  /** a: the new level, b: coins, c: 1 when it brought a chest. */
  | 'managerLevel'
  /** a: diamonds, b: seconds of double income. */
  | 'chestOpened'
  /** a: achievement, b: medals now, c: diamonds. */
  | 'medal';

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
export const REJECT = { noStand: 1, notReady: 2, unknownFlight: 3, noMoney: 4, limit: 5, needs: 6, badSpot: 7 } as const;

export type Command =
  | { type: 'debugAddMoney'; amount: number }
  | { type: 'clearLanding'; flightId: number }
  | { type: 'sendFuel'; flightId: number }
  | { type: 'startBoarding'; flightId: number }
  | { type: 'clearTakeoff'; flightId: number }
  | { type: 'sendBags'; flightId: number }
  | { type: 'repair'; flightId: number }
  | { type: 'hire'; applicantId: number }
  | { type: 'negotiate'; applicantId: number }
  | { type: 'trial'; applicantId: number }
  | { type: 'confirmTrial'; staffId: number; keep: boolean }
  | { type: 'fire'; staffId: number }
  | { type: 'transfer'; staffId: number; role: number }
  | { type: 'talent'; staffId: number; talent: number }
  /** answer: 0 decline, 1 accept, 2 counter-offer half. */
  | { type: 'answerRaise'; staffId: number; answer: number }
  | { type: 'upgradeTier' }
  | { type: 'moveDecor'; id: string; x: number; y: number }
  | { type: 'setProfile'; manager: string; airport: string }
  /** count: levels to buy, -1 = as many as you can afford. */
  | { type: 'buyUpgrade'; id: string; count: number }
  | { type: 'rushBuild' }
  | { type: 'signOffer'; offerId: number }
  /** mode 0: ask for more pay, 1: offer a discount for more flights. */
  | { type: 'negotiateOffer'; offerId: number; mode: number }
  | { type: 'declineOffer'; offerId: number }
  | { type: 'expandContract'; airline: number }
  | { type: 'endContract'; airline: number }
  /** store: 0 fuel, 1 parts. */
  | { type: 'setSupplier'; store: number; supplier: number }
  | { type: 'urgentOrder'; store: number }
  /** A celebrity visit: let the press in (false) or keep it private (true). */
  | { type: 'celebPrivacy'; incident: number; private: boolean }
  | { type: 'claimReviews' }
  | { type: 'openChest' }
  /** Collect the medals an achievement (ACHIEVEMENTS index) has reached. */
  | { type: 'claimMedals'; index: number }
  /** The inspector's day: the VIP care for this passenger (a suspect). */
  | { type: 'pickSuspect'; person: number }
  /** The real date (epoch day), for the holidays. */
  | { type: 'setToday'; day: number };

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
  | 'goAround'
  | 'diverted';

/** What the flight is waiting for the player (or staff) to do. */
export const WANT = { none: 0, clearLanding: 1, fuel: 2, board: 3, clearTakeoff: 4, bags: 5, repair: 6 } as const;
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
  /** Departing passengers whose bag went through check-in. */
  bagsChecked: number;
  lostBags: number;
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
  /** Planned arrival time from the schedule (board). */
  sched: number;
  /** Contract pay multiplier at the time it was planned. */
  payMul: number;
  /** Runway direction its current approach or departure was planned for (1 or -1). */
  dir: number;
  /** Diverted here from another airport (no contract, pays a bonus, low on fuel). */
  guest: boolean;
  /** Missed approaches so far. */
  goArounds: number;
  /** Technical fault found at the stand (AOG): 0 none, 1 grounded, 2 repaired. */
  aog: number;
  /** Repair progress: service state (like fuel), work 0..1, seconds it takes, parts still to fit. */
  repState: number;
  repWork: number;
  repNeed: number;
  repParts: number;
  /** The mechanic is there but the part is not (store empty). */
  partWait: boolean;
  /** In for a scheduled check in the hangar: 0 no, 1 A check, 2 B check. */
  check: number;
  /** Incidents: declared an emergency; a VIP flight (and whether it tipped); took a bird on landing. */
  emergency: boolean;
  vip: boolean;
  vipGood: boolean;
  birdHit: boolean;
  /** A sick passenger on board: nobody gets off before the paramedics have them. */
  medical: boolean;
  /** A celebrity's private plane; a historic plane on a visit. */
  celeb: boolean;
  historic: boolean;
  /** No boarding before this time (a historic plane on show). */
  holdUntil: number;
}

/** A vehicle an incident sends out (the runway inspection car, a fire truck). */
export interface IncidentUnit {
  kind: 'opsCar' | 'fire' | 'ambulance';
  x: number;
  y: number;
  px: number;
  py: number;
  heading: number;
  path: number[];
  pathPos: number;
  /** (the ambulance waits inside the gate, then goes to the plane) */
  state: 'home' | 'out' | 'wait' | 'go' | 'work' | 'back';
}

/** Something happening at the airport (see incidents.ts). */
export interface Incident {
  id: number;
  kind: import('../../data/incidents').IncidentKind;
  state: 'announced' | 'active' | 'done';
  /** When it starts (announced) or started (active). */
  at: number;
  /** When it ends (0 = when it resolves); for a finished one, when it ended. */
  ends: number;
  /** The flight it is about (emergency, VIP, bird strike), 0 = none. */
  flight: number;
  /** Where (debris, the flock). */
  x: number;
  y: number;
  units: IncidentUnit[];
  /** How it went: 1 well, -1 badly, 0 neither. */
  result: number;
  /** Coins it brought in (tickets, a reward, a tip). */
  amount: number;
  /** The player's choice (a celebrity: 0 = let the press in, 1 = keep it private). */
  choice: number;
}

/** A signed airline contract. */
export interface Contract {
  /** Airline index (AIRLINES). */
  al: number;
  perDay: number;
  pay: number;
  /** On-time goal 0..1. */
  goal: number;
  signedAt: number;
  /** When a seasonal contract ends (0 = open-ended). */
  endsAt: number;
  flights: number;
  onTime: number;
  /** Results of the latest flights, newest last: 1 on time, 0 late or diverted. */
  last: number[];
  /** What its flights paid (the season bonus is a share of it). */
  earned: number;
  /** The airline has warned you (late flights / bad mood). */
  warned: boolean;
  /** Bad flights since the warning. */
  strikes: number;
  expandedAt: number;
  /** Schedule cursor: when its next flight is planned. */
  nextAt: number;
}

/** An airline that wants a contract (like a job applicant). */
export interface AirlineOffer {
  id: number;
  al: number;
  perDay: number;
  pay: number;
  goal: number;
  /** Contract length in game days (0 = open-ended). */
  days: number;
  expiresAt: number;
  negotiated: boolean;
}

/** A planned arrival on the schedule (not spawned yet). */
export interface Planned {
  id: number;
  at: number;
  al: number;
  num: number;
  origin: number;
  dest: number;
  /** A special visitor's own aircraft (AIRCRAFT index), instead of one from the airline's fleet. */
  ac?: number;
}

/** A finished departure kept for the board. */
export interface BoardLog {
  al: number;
  num: number;
  dest: number;
  /** Scheduled and actual off-block times. */
  slot: number;
  at: number;
  /** 0 departed, 1 cancelled (diverted before landing). */
  status: number;
}

/** Person states (arrivals: toHut=toClaim -> atClaim -> toExit; departures: toCheckin -> ... -> toPlane). */
export const PST = {
  toHut: 0,
  toSpot: 1,
  waiting: 2,
  toPlane: 3,
  leaving: 4,
  atClaim: 5,
  toExit: 6,
  inCheckin: 8,
  atCounter: 9,
  inSecurity: 11,
  atScanner: 12,
  toShop: 13,
  shopping: 14,
  /** Walking from the parking lot to the terminal entrance (from the small airfield on). */
  toEntrance: 15,
  /** Passport control on the way out (international airport): in the line, at a booth. */
  inPassport: 16,
  atBooth: 17,
  /** Passport control on the way in: walking to the line, in it, at a booth. */
  toArrPass: 18,
  inArrPass: 19,
  atArrBooth: 20,
  /** Apron buses: departing (to the stop, waiting at it, riding) and arriving (waiting at the plane, to the bus, at it, riding). */
  toBus: 21,
  atBusStop: 22,
  inBus: 23,
  waitBus: 24,
  toBusA: 25,
  atBusA: 26,
  inBusA: 27,
  /** The people mover to the satellite (hub): departing (to the platform, on it, riding) and arriving (to the platform, on it, riding). */
  toApm: 28,
  atApm: 29,
  inApm: 30,
  toApmA: 31,
  atApmA: 32,
  inApmA: 33,
  /** The railway (hub): an arriving passenger walking to the platform, waiting there for the train. */
  toRail: 34,
  atRail: 35,
} as const;

/** The people-mover train between Terminal 3 and the satellite (hub). */
export interface PeopleMover {
  x: number;
  px: number;
  /** Speed along the track (signed, + toward the satellite). */
  v: number;
  /** Which station it is at or heading for: 0 Terminal 3, 1 the satellite. */
  at: number;
  /** dwell (doors open at a station) or run. */
  state: 'dwell' | 'run';
  timer: number;
  /** Person ids on board. */
  load: number[];
}

/** An apron bus between Terminal 1 and the remote stands. */
export interface ApronBus {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  heading: number;
  path: number[];
  pathPos: number;
  /** idle at the stop; load (departures at the stop); go (to the plane); drop (departures off); pick (arrivals on at the plane); back; unload (arrivals off at the stop). */
  state: 'idle' | 'load' | 'go' | 'drop' | 'pick' | 'back' | 'unload';
  flight: number;
  /** 0 taking departures out, 1 bringing arrivals in. */
  mode: number;
  /** Person ids on board. */
  load: number[];
  timer: number;
}

/** A passenger review (M12): a line of REVIEWS by a passenger of a flight that left. */
export interface Review {
  id: number;
  /** Index into REVIEWS. */
  line: number;
  stars: number;
  /** Writer: a first name (FIRST_NAMES index) and a passenger type (PAX_TYPES index). */
  name: number;
  pax: number;
  /** Flight code (airline code and number) and when. */
  flight: string;
  at: number;
}

/** The manager's career (M13): level and experience, chests, the double-income boost, counters and medals. */
export interface CareerState {
  level: number;
  /** Experience into this level. */
  xp: number;
  /** Chests to open. */
  chests: number;
  /** Double income until then (game time). */
  boostUntil: number;
  /** Career counters (what the stats do not keep). */
  counts: Record<string, number>;
  /** Medals collected per achievement (0..4). */
  medals: number[];
  /** Last event looked at (transient: events are not saved). */
  seen: number;
}

/** Stats at the start of the guide's week (its scores are for the week). */
export interface GuideBase {
  served: number;
  diverted: number;
  goArounds: number;
  onTime: number;
  late: number;
  queued: number;
  queueSecs: number;
  pax: number;
  lostBags: number;
}

/** The undercover inspector's visit: the suspects (person ids), the inspector, the pick (0 none). */
export interface InspectorVisit {
  at: number;
  suspects: number[];
  inspector: number;
  picked: number;
  /** The inspector has left; result: 0 nobody picked, 1 the right one, 2 someone else. */
  done: boolean;
  result: number;
}

/** The Aviation Guide (M12): stars every seven days and the inspector's visits. */
export interface GuideState {
  /** Stars of the latest edition (0..3), the most ever, editions so far. */
  stars: number;
  best: number;
  edition: number;
  /** The latest edition's parts and score (null before the first). */
  last: Record<string, number> | null;
  lastScore: number;
  /** This week: stats at its start, samples of cleanliness and mood, the bonus for spotting the inspector. */
  base: GuideBase;
  cleanSum: number;
  moodSum: number;
  samples: number;
  bonus: number;
  visit: InspectorVisit | null;
  /** The latest inspector's notebook (GUIDE_NOTES indices) and how the VIP care went (-1 none yet). */
  notes: number[];
  noteResult: number;
}

/** A piece of litter on a terminal floor (in one of the clean areas). */
export interface Litter {
  id: number;
  x: number;
  y: number;
  /** Index into the clean areas of the airport (cleaning.ts). */
  area: number;
}

/** A cleaner at work: walks the area they look after, picks litter up. */
export interface Sweeper {
  /** The staff member (StaffMember.id). */
  staffId: number;
  area: number;
  x: number;
  y: number;
  px: number;
  py: number;
  heading: number;
  /** Litter being walked to (0 none), or how far along the round of the area. */
  target: number;
  round: number;
  /** Bending down to pick something up until this time. */
  until: number;
}

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
  /** Queue position, counter or lane index (-1 none). */
  slot: number;
  /** When the current service (check-in, scan, shopping, waiting for bags) ends. */
  until: number;
  /** Seconds spent standing in queues. */
  waited: number;
  /** Passengers this figure stands for (groups on big planes). */
  n: number;
  /** Which terminal: 0 = Terminal 1, 1 = Terminal 3 (the big jets, from the city airport on). */
  term: number;
}

/** Queues and busy service points of one terminal (people ids, head first; 0 = a free point). */
export interface TermQueues {
  checkinQ: number[];
  securityQ: number[];
  passportQ: number[];
  arrPassQ: number[];
  counterBusy: number[];
  laneBusy: number[];
  boothBusy: number[];
  arrBoothBusy: number[];
}

export type VehicleState = 'idle' | 'toPlane' | 'fueling' | 'return';

/** Service vehicles: fuel truck, baggage cart, mechanics' van. */
export type ServiceKind = 'fuel' | 'bags' | 'mech';

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
  lostBags: number;
  /** Shop sales (coins). */
  sales: Big;
  /** Total seconds passengers stood in queues, and how many queued. */
  queueSecs: number;
  queued: number;
  /** Missed approaches, and planes diverted here from other airports that landed. */
  goArounds: number;
  guests: number;
  /** Checks finished in the hangar. */
  checks: number;
}

export interface Build {
  id: string;
  /** Level the upgrade reaches when done. */
  level: number;
  /** Seconds left (stored as remaining time, so offline progress is a subtraction). */
  remaining: number;
  total: number;
}

/** What staff and applicants have in common (a "CV"). */
export interface Person0 {
  id: number;
  /** Index into STAFF_ROLES. */
  role: number;
  /** Indices into FIRST_NAMES / LAST_NAMES. */
  first: number;
  last: number;
  /** Natural speed (rarity included), higher reacts faster. */
  speed: number;
  /** Index into RARITIES. */
  rarity: number;
  /** Indices into TRAITS. */
  traits: number[];
  level: number;
  /** Points in each of the TALENTS. */
  talents: number[];
  /** CV one-liner index. */
  cv: number;
  wage: number;
}

export interface StaffMember extends Person0 {
  hiredAt: number;
  /** Sim time until which the worker is busy. */
  busyUntil: number;
  xp: number;
  /** Unspent talent points. */
  points: number;
  /** 0..1, multiplies speed (0.8x .. 1.2x); at 0 they quit. */
  mood: number;
  /** 0..1, drained by work; below 0.12 they take a break. */
  energy: number;
  breakUntil: number;
  /** > 0 while on a trial shift (ends at this time). */
  trialUntil: number;
  /** Hire fee still owed if the trial is confirmed. */
  trialCost: number;
  /** Requested wage increase (0 = none) and when it was asked. */
  raise: number;
  raiseAt: number;
}

export interface Applicant extends Person0 {
  cost: number;
  arrivedAt: number;
  expiresAt: number;
  /** Already tried to negotiate (one attempt). */
  negotiated: boolean;
}

/** One kind of supply on hand (fuel in liters, spare parts in pieces). */
export interface StoreState {
  stock: number;
  /** Index into the store's supplier table. */
  supplier: number;
  /** Units used per second, smoothed (for reorder and the panel). */
  use: number;
  /** Announced running dry (until restocked). */
  out: boolean;
  /** Announced running low without money to order (until an order goes out). */
  low: boolean;
}

/** A supply order and the truck that brings it. */
export interface Delivery {
  id: number;
  /** 0 fuel, 1 parts. */
  store: number;
  amount: number;
  urgent: boolean;
  /** When the truck turns off the main road toward the gate. */
  eta: number;
  state: 'ordered' | 'driving' | 'unloading' | 'leaving';
  /** Unloading progress 0..1 (stock goes up as it unloads). */
  done: number;
  path: number[];
  pathPos: number;
  x: number;
  y: number;
  /** Position at the previous step (render interpolation). */
  px: number;
  py: number;
  heading: number;
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
  /** Apron buses (transient). */
  buses: ApronBus[];
  /** Litter on the terminal floors and the cleaners at work (transient). */
  litter: Litter[];
  sweepers: Sweeper[];
  /** Passenger reviews (newest first) and the bonus earned by the good ones, not collected yet. */
  reviews: Review[];
  reviewBonus: number;
  /** The Aviation Guide. */
  guide: GuideState;
  /** The manager's level, chests and achievements. */
  career: CareerState;
  /** The people mover (hub; transient). */
  apm: PeopleMover | null;
  stands: Stand[];
  /** Flight ids waiting for the fuel truck. */
  fuelQueue: number[];
  /** Flight ids waiting for the baggage cart. */
  bagQueue: number[];
  /** Grounded flights waiting for the mechanics' van. */
  mechQueue: number[];
  /** Taxi graph reservations: flight id per edge / node (0 = free). */
  edgeHold: number[];
  nodeHold: number[];
  /** How many of the layout's stands are built, and which (transient, from upgrade levels). */
  standsBuilt: number;
  standOpen: boolean[];
  /** Last plane that used each runway (wake turbulence), transient. */
  wake: { cat: number; at: number }[];
  /** Runway direction in use: 1 = landing and taking off toward +x, -1 = the other way (transient). */
  /** Runway change under way toward this direction (0 = none): arrivals hold, nobody new leaves a stand. */
  turning: number;
  rwyDir: number;
  /** Tests only: pin the runway direction (0 = follow the wind). Never saved. */
  /** Tests and screenshots only: fixed weather instead of the seed's (not saved). */
  wxForce?: { windTo: number; speed: number; vis: number };
  forceDir?: number;
  /** Weather alerts already announced (transient). */
  wxFog: boolean;
  wxCross: boolean;
  /** Traffic multiplier (marketing raises it). */
  traffic: number;
  staff: StaffMember[];
  applicants: Applicant[];
  /** Last game day whose wages were paid. */
  wageDay: number;
  /** When the next applicant knocks on the door. */
  nextApplicantAt: number;
  /** Building the next airport tier (null when not). */
  tierBuild: { to: number; remaining: number; total: number } | null;
  /** Construction is done; switching once no plane is on the ground. */
  tierSwitch: boolean;
  /** Names chosen by the player. */
  profile: { manager: string; airport: string };
  /** Airline contracts, offers and reputation (0..100 per airline index). */
  contracts: Contract[];
  offers: AirlineOffer[];
  rep: number[];
  nextOfferAt: number;
  /** When the next plane may ask to divert here (transient). */
  nextGuestAt: number;
  /** When the next airline may send a plane in for a check (transient). */
  nextCheckAt: number;
  /** Index of the goal being worked on (GOALS in goals.ts). */
  goal: number;
  /** Incidents under way and the last few finished (transient). */
  incidents: Incident[];
  nextIncidentAt: number;
  /** When each kind last started (cooldowns, transient). */
  incidentLast: Record<string, number>;
  /** Runway 1 closed until this time (after an emergency landing). */
  runwayClosedUntil: number;
  /** Game day already announced as a weekend day (transient). */
  weekendDay: number;
  /** The real date (epoch day) the player's device says it is, -1 unknown (transient: the UI sends it). */
  today: number;
  /** The holiday on now (HOLIDAYS index, -1 none) and the day of it (0 = travel days before). */
  holiday: number;
  holidayDay: number;
  /** More people want to fly until then (a celebrity visit in the news). */
  buzzUntil: number;
  /** Fuel farm and spare-parts store, and the deliveries on their way. */
  stores: { fuel: StoreState; parts: StoreState };
  deliveries: Delivery[];
  /** Planned arrivals, earliest first (transient, rebuilt from the contracts). */
  schedule: Planned[];
  /** Latest departures for the board (transient). */
  departed: BoardLog[];
  /** Moved decorations: id -> tile position (defaults come from the layout). */
  decor: Record<string, [number, number]>;
  /** Terminal queues (person ids, head first) and who is at each counter / lane (0 = free). */
  checkinQ: number[];
  securityQ: number[];
  counterBusy: number[];
  laneBusy: number[];
  /** Terminal 3's queues (Terminal 1's are the four above). */
  t3q: TermQueues;
  /** Terminal 4's lines (mega hub). */
  t4q: TermQueues;
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
