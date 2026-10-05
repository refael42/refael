import type { CustomerTypeId } from '../../data/customers';
import type { MapDef, Point } from '../../data/maps';
import type { Big } from '../big';
import type { Grid } from '../grid';
import type { Rng } from '../rng';
import type { CharacterView, PropView } from '../types';

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

export const OrderState = { Queued: 0, Cooking: 1, Ready: 2, Flying: 3 } as const;
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
  /** Pass slot while Ready/Flying (-1 none). */
  slot: number;
  since: number;
  landsAt: number;
}

/** Player actions, resolved from taps by the UI and applied at the next fixed step. */
export type Command =
  | { type: 'seat'; customer: number }
  | { type: 'serve'; order: number }
  | { type: 'clean'; table: number };

/** Something tappable: its floor position, how high its visual center sits, and what tapping does. */
export interface TapTarget {
  x: number;
  y: number;
  height: number;
  command: Command;
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
  cook: CharacterView;
  walkers: Walker[];
  /** Decor plus the stove (whose `active` follows the cook). */
  props: PropView[];
  events: SimEventRecord[];
  nextEventId: number;
  commands: Command[];
  stats: GameStats;
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
