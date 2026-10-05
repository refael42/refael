import type { CustomerTypeId } from '../../data/customers';
import type { Role, StatId } from '../../data/staff';
import type { TraitId } from '../../data/traits';
import type { MapDef, Point } from '../../data/maps';
import type { Big } from '../big';
import type { Levels, Mods } from '../economy/upgrades';
import type { Grid } from '../grid';
import type { Rng } from '../rng';
import type { CharacterView, PropKind, PropView } from '../types';

export const CustomerState = {
  Arriving: 0,
  Queued: 1,
  ToTable: 2,
  Reading: 3,
  Waiting: 4,
  Eating: 5,
  Paying: 6,
  Leaving: 7,
} as const;
export type CustomerState = (typeof CustomerState)[keyof typeof CustomerState];

export const TableState = { Free: 0, Reserved: 1, Occupied: 2, Dirty: 3, Cleaning: 4 } as const;
export type TableState = (typeof TableState)[keyof typeof TableState];

export const OrderState = { Queued: 0, Cooking: 1, Plating: 2, Ready: 3, Flying: 4, Carried: 5 } as const;
export type OrderState = (typeof OrderState)[keyof typeof OrderState];

export interface Customer extends CharacterView {
  type: CustomerTypeId;
  state: CustomerState;
  stateTime: number;
  walkSpeed: number;
  path: Point[];
  queueSlot: number;
  table: number;
  order: number;
  dish: number;
  /** Seconds of patience left in the current wait, and its starting value. */
  patienceLeft: number;
  patienceMax: number;
  /** Sum of "patience left" fractions at the end of each wait; averaged into mood. */
  moodSum: number;
  moodCount: number;
  foodWaited: number;
  angryEmoted: boolean;
  /** Set when served: the cook's quality multiplies the price, the server's charm the tip. */
  dishQuality: number;
  tipBoost: number;
  /** Who they came with: the party leader's id (their own when alone), and the party size. */
  party: number;
  partySize: number;
  /** Their chair at the table (-1 until seated). */
  seat: number;
}

export interface Table {
  index: number;
  /** Waiter on the way to clear it (-1 none). */
  waiter: number;
  propId: number;
  x: number;
  y: number;
  state: TableState;
  /** Chairs at it (1, or 2 with "More chairs"). */
  seats: number;
  /** Who sits in each chair (-1 empty) and the dish in front of them (-1 none). */
  party: number[];
  dishes: number[];
  /** Dirty plates left behind for whoever clears it. */
  plates: number;
  progress: number;
  since: number;
}

export interface Order {
  id: number;
  customer: number;
  dish: number;
  state: OrderState;
  progress: number;
  /** Pass slot while Ready (-1 none). */
  slot: number;
  since: number;
  landsAt: number;
  /** Waiter assigned to carry it (-1 none). */
  waiter: number;
  /** Price multiplier from the cook who made it. */
  quality: number;
}

/** Player actions, resolved from taps by the UI and applied at the next fixed step. */
export type Command =
  | { type: 'seat'; customer: number }
  /** Rush hour: on while the button is held down. */
  | { type: 'rush'; on: boolean }
  /** Take a finished quest's reward (index in the current level). */
  | { type: 'claim'; quest: number }
  | { type: 'serve'; order: number }
  | { type: 'clean'; table: number }
  | { type: 'wash' }
  /** `at` = the tile for decor placed in build mode. */
  | { type: 'buy'; item: string; at?: Point }
  | { type: 'hire'; applicant: number; trial: boolean }
  | { type: 'negotiate'; applicant: number }
  | { type: 'reject'; applicant: number }
  | { type: 'fire'; staff: number }
  | { type: 'bonus'; staff: number }
  | { type: 'train'; staff: number }
  | { type: 'scold'; staff: number }
  | { type: 'reassign'; staff: number; role: Role }
  /** Yes/no on a raise request or the end of a trial shift. */
  | { type: 'answer'; notice: number; yes: boolean }
  /** Coins from outside the restaurant (offline earnings, rewards), as a saved Big string. */
  | { type: 'grant'; coins: string };

/** Something tappable: its floor position, how high its visual center sits, and what tapping does. */
export interface TapTarget {
  x: number;
  y: number;
  height: number;
  command: Command;
}

/** A worker or applicant (tapping them opens their card). */
export interface PersonTarget {
  x: number;
  y: number;
  height: number;
  id: number;
  applicant: boolean;
}

/** A station with upgrades (tapping it opens them). */
export interface StationTarget {
  x: number;
  y: number;
  height: number;
  kind: PropKind;
}

/** What a staff member is doing; `phase` advances as they walk and work. */
export type Job =
  | { kind: 'cook'; order: number; phase: 'cooking' | 'plating' }
  | { kind: 'pickup'; order: number; phase: 'toPass' | 'handoff' | 'toTable' | 'serve' }
  | { kind: 'buss'; table: number; phase: 'toTable' | 'wipe' | 'toSink' | 'drop'; plates?: number }
  /** The shift manager's table visit to calm an impatient guest. */
  | { kind: 'calm'; customer: number; phase: 'walk' | 'talk' }
  | { kind: 'home' };

/** A generated person: who applies, and who works here once hired. */
export interface Person {
  /** Index into NAMES. */
  name: number;
  stats: Record<StatId, number>;
  traits: TraitId[];
  level: number;
  /** Coins per day. */
  wage: Big;
}

export interface Staff extends CharacterView, Person {
  role: Role;
  /** Tiles per second before stats, morale and energy. */
  speed: number;
  path: Point[];
  job: Job | null;
  jobTime: number;
  /** Set while the cook cannot finish a dish (no clean plate or a full pass). */
  stalled: 'plates' | 'pass' | null;
  xp: number;
  morale: number;
  energy: number;
  unpaidDays: number;
  hiredDay: number;
  lastRaiseDay: number;
  /** On a trial shift: no signing fee yet, decided at the end of the day. */
  trial: boolean;
  scoldUntil: number;
  /** Stove index for cooks, idle-spot index for waiters and cleaners. */
  slot: number;
  /** Quit or fired: finishes what they hold, then walks out. */
  leaving: boolean;
  /** Switches to this job once the current one is done. */
  pendingRole: Role | null;
  /** Busy this step (drains energy). */
  busy: boolean;
}

export interface Applicant extends CharacterView, Person {
  role: Role;
  state: 'arriving' | 'waiting' | 'leaving';
  path: Point[];
  speed: number;
  spot: number;
  patienceLeft: number;
  negotiated: 'no' | 'accepted' | 'refused';
}

/** Things the manager should know or decide; the UI shows them as cards. */
export type Notice =
  | { id: number; time: number; kind: 'raise'; staff: number; wage: Big }
  | { id: number; time: number; kind: 'trial'; staff: number }
  | { id: number; time: number; kind: 'quit'; name: number; role: Role; unpaid: boolean }
  | { id: number; time: number; kind: 'payday'; paid: Big; unpaid: number };

/** Ambient people: sidewalk strollers (always) and stress-test roamers (perf testing). */
export interface Walker extends CharacterView {
  mode: 'pedestrian' | 'stress';
  path: Point[];
  speed: number;
  pause: number;
}

/** A review a customer wrote about the restaurant (newest last). */
export interface Review {
  id: number;
  time: number;
  /** 1..5: the service they got. */
  stars: number;
  /** Which written line of that grade (strings review.<stars>.<line>). */
  line: number;
  /** The reviewer's first name: an index into NAMES. */
  name: number;
  dish: number;
  /** Bonus coins it brought in (zero below four stars). */
  bonus: Big;
}

export interface GameStats {
  served: number;
  walkouts: number;
  earned: Big;
  hires: number;
  /** All-time counters the quests ask for. */
  fiveStars: number;
  rushes: number;
  bestCombo: number;
}

/** Restaurant level (1-based) and which of its goals were claimed. */
export interface QuestState {
  level: number;
  claimed: number[];
}

export interface GameState {
  map: MapDef;
  grid: Grid;
  tick: number;
  time: number;
  rng: Rng;
  nextId: number;
  coins: Big;
  rating: number;
  combo: number;
  lastPayTime: number;
  reviews: Review[];
  lastReviewTime: number;
  /** A five-star review has people talking until then: more arrivals. */
  buzzUntil: number;
  /** Rush hour: running now, and the meter (0..1). */
  rush: { on: boolean; charge: number };
  quests: QuestState;
  nextArrival: number;
  customers: Customer[];
  tables: Table[];
  orders: Order[];
  staff: Staff[];
  walkers: Walker[];
  cleanPlates: number;
  dirtyPlates: number;
  /** 0..1 progress on the plate currently being washed. */
  washProgress: number;
  /** Decor plus the stove and sink (whose `active` follows the staff). */
  props: PropView[];
  events: SimEventRecord[];
  nextEventId: number;
  commands: Command[];
  stats: GameStats;
  /** Upgrade levels by item id, and everything they add up to. */
  levels: Levels;
  mods: Mods;
  /** Sim time of the last upgrade per anchor kind (the renderer bounces that station). */
  bumpAt: number[];
  /** Stoves in use: their prop and where their cook stands. */
  stoves: { propId: number; x: number; y: number; cook: Point }[];
  applicants: Applicant[];
  nextApplicant: number;
  /** Day counter (continues across sessions) and seconds into the current day. */
  day: number;
  dayTime: number;
  notices: Notice[];
  nextNoticeId: number;
  /** The next building tier going up (closed meanwhile), or null. */
  construction: Construction | null;
  /** Decor placed in build mode (tile centers); `item` is a DecorId. */
  placed: PlacedDecor[];
}

export interface PlacedDecor {
  item: string;
  x: number;
  y: number;
}

export interface Construction {
  /** The tier being built (the new building level). */
  tier: number;
  start: number;
  end: number;
  nextDust: number;
  /** The lot under scaffolding (tiles). */
  site: { x0: number; y0: number; x1: number; y1: number };
}

export interface SimEventRecord {
  id: number;
  time: number;
  type: number;
  x: number;
  y: number;
  a: number;
  b: number;
  c: number;
}
