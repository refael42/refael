import type { CustomerTypeId } from '../../data/customers';
import type { ReviewKind } from '../../data/reviews';
import type { Role, StatId } from '../../data/staff';
import type { TraitId } from '../../data/traits';
import type { MapDef, Point } from '../../data/maps';
import type { Big } from '../big';
import type { Rarity } from '../../data/rarity';
import type { Levels, Mods, Perks } from '../economy/upgrades';
import type { Grid } from '../grid';
import type { Rng } from '../rng';
import type { CharacterView, PropKind, PropView } from '../types';
import type { BulkStep } from '../../data/works';

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
  /** The host bringing their menu (-1: none, the menu is waiting at the table). */
  menuFrom: number;
  /** A golden VIP guest: a big bonus when they pay (src/data/retention.ts). */
  vip: boolean;
  /** Came on the tourist bus: pays more, double festival points (src/data/events.ts). */
  tourist: boolean;
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
  /** A delivery (src/data/delivery.ts): no guest, a takeaway bag, the courier takes it out. */
  delivery: boolean;
  /** The checker looked it over (it sells for more). */
  checked?: boolean;
  /** On the deliveries' own pass (src/data/maps.ts packing): `slot` indexes its slots. */
  lane?: 1;
  /**
   * Packed by a packer: true while it waits on the takeaway window's shelf, false once a
   * courier took it (it still pays as a packed order); unset if nobody packed it.
   */
  packed?: boolean;
}

/** Player actions, resolved from taps by the UI and applied at the next fixed step. */
export type Command =
  | { type: 'seat'; customer: number }
  /** Rush hour: on while the button is held down. */
  | { type: 'rush'; on: boolean }
  /** Take a finished quest's reward (index in the current level). */
  | { type: 'claim'; quest: number }
  /** Take a review's bonus on the reviews page (-1: every waiting one). */
  | { type: 'review'; id: number }
  /** Spend gems in the item shop. */
  | { type: 'shop'; item: string }
  /** Gems from a (demo) gem pack purchase. */
  | { type: 'gems'; amount: number }
  | { type: 'serve'; order: number }
  | { type: 'clean'; table: number }
  | { type: 'wash' }
  /** `at` = the tile for decor placed in build mode; `step` = levels at once (bulk buying). */
  | { type: 'buy'; item: string; at?: Point; step?: BulkStep }
  /** Speed up a big upgrade in progress (a tap on its site), or finish it now with gems. */
  | { type: 'hurry'; work: number }
  /** Build mode: carry a placed decor piece to another free tile. */
  | { type: 'move'; from: Point; to: Point }
  /** Hand this restaurant over and open a branch in the next city (prestige). */
  | { type: 'branch' }
  /** Open the present on the sidewalk. */
  | { type: 'gift' }
  /** Take today's daily gift; the dates come from the device clock (the sim has none). */
  | { type: 'daily'; today: string; yesterday: string }
  /** The phone's clock (ms): which food festival is on. */
  | { type: 'festival'; now: number }
  /** Take the next festival reward reached. */
  | { type: 'festivalClaim' }
  /** Testing (the settings): the tourist bus comes now. */
  | { type: 'testBus' }
  /** Buy the shop's flash deal (`now`: which deal is on). */
  | { type: 'deal'; now: number }
  /** Spin the lucky wheel (`now` = the phone's clock in ms, for the free spin), then take its prize. */
  | { type: 'spin'; now: number; paid: boolean }
  | { type: 'wheel' }
  | { type: 'finish'; work: number }
  | { type: 'hire'; applicant: number; trial: boolean }
  | { type: 'negotiate'; applicant: number }
  | { type: 'reject'; applicant: number }
  | { type: 'fire'; staff: number }
  | { type: 'bonus'; staff: number }
  /** Paid training for `count` levels at once. */
  | { type: 'train'; staff: number; count?: number }
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
  /** The host welcomes the first in line, walks the party to their table and hands out the menus. */
  | { kind: 'escort'; customer: number; table: number; party: number[]; phase: 'greet' | 'lead' | 'hand' }
  /** A courier takes bags from the pass to the scooter and rides off (`left`/`back`: sim times they rode off and return). */
  | { kind: 'deliver'; orders: number[]; phase: 'toPass' | 'pack' | 'toWindow' | 'window' | 'toScooter' | 'away'; left: number; back: number }
  /** The checker looks over a dish on the pass. */
  | { kind: 'check'; order: number }
  /** A packer takes a delivery off the pass, packs it at the counter, leaves it on the window shelf. */
  | { kind: 'pack'; order: number; phase: 'toPass' | 'take' | 'toFridge' | 'fridge' | 'toTable' | 'packing' }
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
  /** Common, rare, epic or legendary (src/data/rarity.ts). */
  rarity: Rarity;
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
  /** Out on a delivery: not on the map (the scooter is). */
  away: boolean;
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
  /** `far`: strolls the far sidewalk, across the road. */
  mode: 'pedestrian' | 'far' | 'stress';
  path: Point[];
  speed: number;
  pause: number;
  /** A promoter gave them a flyer already (one each). */
  flyer?: boolean;
}

/** A review a customer wrote about the restaurant (newest last), on the reviews page. */
export interface Review {
  /** Its own counter (saved), so ids stay unique across sessions. */
  id: number;
  /** The game day it was written. */
  day: number;
  /** 1..5: the service they got. */
  stars: number;
  /** What it is about, and which written line of that (strings review.<kind>.<line>). */
  kind: ReviewKind;
  line: number;
  /** The reviewer's first name: an index into NAMES. */
  name: number;
  dish: number;
  /** Bonus coins it brings (zero below four stars), taken on the reviews page. */
  bonus: Big;
  claimed: boolean;
}

export interface GameStats {
  served: number;
  walkouts: number;
  earned: Big;
  /**
   * The part of `earned` that was handed out (prizes, presents, time warps, offline earnings)
   * rather than earned by serving. The income rate leaves it out: otherwise every prize sized
   * by the income rate would make the next one bigger. Not saved (the rate starts over on load).
   */
  granted: Big;
  hires: number;
  /** All-time counters the quests ask for. */
  fiveStars: number;
  rushes: number;
  bestCombo: number;
  /** Deliveries brought out (all time). */
  delivered: number;
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
  /** The next review's id. */
  reviewSeq: number;
  lastReviewTime: number;
  /** The last angry review from someone who walked out. */
  lastWalkoutReview: number;
  /** A five-star review has people talking until then: more arrivals. */
  buzzUntil: number;
  /** Rush hour: running now, and the meter (0..1). */
  rush: { on: boolean; charge: number };
  quests: QuestState;
  /** Item shop: premium gems, perks owned, an income boost running until `until` (sim time). */
  gems: number;
  perks: Perks;
  boost: { mult: number; until: number };
  /** Coins earned, sampled every few seconds: the recent income rate (time warps pay by it). */
  earnLog: { time: number; earned: Big }[];
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
  /** Big upgrades a crew is working on (they count when done). */
  works: Work[];
  nextWorkId: number;
  /** Branches (prestige): the city this restaurant is in (0 = the first one), chef trophies won. */
  city: number;
  trophies: number;
  /** The last VIP guest came at this time. */
  lastVip: number;
  /** The day someone last asked for a raise (one at a time, with days in between). */
  lastRaiseAsk: number;
  /** A present on the sidewalk (tap it), and when the next one comes. */
  gift: { x: number; y: number; until: number } | null;
  nextGift: number;
  /** The daily gift: the last day claimed (local date, "YYYY-MM-DD") and the streak so far (1..7). */
  daily: { last: string | null; streak: number };
  /**
   * The lucky wheel: when the next free spin comes (phone clock, ms), spins stored from cleared
   * stages, spins so far, and the segment waiting to be taken (-1 = none).
   */
  wheel: { nextFree: number; tokens: number; spins: number; prize: number };
  /**
   * The food festival on now (src/data/events.ts): its number (-1 = no clock reading yet), points
   * so far, rewards taken; and the themes whose trophy was won (kept for good).
   */
  festival: { id: number; points: number; claimed: number; trophies: number[] };
  /** The flash deal last bought (its number), so each deal sells once. */
  flash: { slot: number; bought: boolean };
  /** Strollers across the road counted apart from everything else (their ids, their dice). */
  ambientSeq: number;
  /** When the next delivery order comes in (sim time). */
  nextDelivery: number;
  /** The tourist bus outside (null = none), and when the next one comes. */
  bus: Bus | null;
  nextBus: number;
}

/** The tourist bus: drives in, lets the group off one by one, then drives on. */
export interface Bus {
  /** Where it stops on the road; tourists step off at `door`. */
  x: number;
  y: number;
  door: Point;
  /** Sim times: it started driving in; it leaves (Infinity until everyone is off). */
  arrive: number;
  leave: number;
  /** Tourists still on board, and when the next one steps off. */
  aboard: number;
  nextDrop: number;
}

/** A big upgrade in progress (src/data/works.ts). */
export interface Work {
  id: number;
  item: string;
  /** The level it brings. */
  level: number;
  total: number;
  left: number;
  /** The tile picked for decor (kept free meanwhile), else null. */
  at: Point | null;
  /** Sim time of the last tap that sped it up. */
  lastTap: number;
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
