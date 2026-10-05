import type { CustomerTypeId } from '../../data/customers';
import type { Role } from '../../data/staff';
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
}

export interface Table {
  index: number;
  /** Waiter on the way to clear it (-1 none). */
  waiter: number;
  propId: number;
  x: number;
  y: number;
  state: TableState;
  customer: number;
  /** Dish on the table while eating (-1 none). */
  dish: number;
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
}

/** Player actions, resolved from taps by the UI and applied at the next fixed step. */
export type Command =
  | { type: 'seat'; customer: number }
  | { type: 'serve'; order: number }
  | { type: 'clean'; table: number }
  | { type: 'wash' }
  | { type: 'buy'; item: string }
  /** Coins from outside the restaurant (offline earnings, rewards), as a saved Big string. */
  | { type: 'grant'; coins: string };

/** Something tappable: its floor position, how high its visual center sits, and what tapping does. */
export interface TapTarget {
  x: number;
  y: number;
  height: number;
  command: Command;
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
  | { kind: 'buss'; table: number; phase: 'toTable' | 'wipe' | 'toSink' | 'drop' }
  | { kind: 'home' };

export interface Staff extends CharacterView {
  role: Role;
  speed: number;
  path: Point[];
  job: Job | null;
  jobTime: number;
  /** Set while the cook cannot finish a dish (no clean plate or a full pass). */
  stalled: 'plates' | 'pass' | null;
}

/** Ambient people: sidewalk strollers (always) and stress-test roamers (perf testing). */
export interface Walker extends CharacterView {
  mode: 'pedestrian' | 'stress';
  path: Point[];
  speed: number;
  pause: number;
}

export interface GameStats {
  served: number;
  walkouts: number;
  earned: Big;
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
