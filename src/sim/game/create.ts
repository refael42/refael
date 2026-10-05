import { AMBIENT } from '../../data/ambient';
import { ECONOMY } from '../../data/economy';
import { CHAIR_OFFSET, type Furniture, type MapDef } from '../../data/maps';
import { APPLICANTS, KITCHEN, STARTING_STAFF, type Role } from '../../data/staff';
import { big, ZERO, type Big } from '../big';
import { computeMods, type Levels } from '../economy/upgrades';
import { buildGrid } from '../grid';
import { createRng } from '../rng';
import type { PropView } from '../types';
import { PropKind } from '../types';
import { applicantLook, generatePerson, rankOf, uniformLook } from './people';
import { createStaff } from './staff';
import { TableState, type GameState, type Person, type Staff, type Table } from './types';
import { spawnPedestrian } from './walkers';

/** First customer shows up almost immediately: the first seconds must never feel empty. */
const FIRST_ARRIVAL_SECONDS = 1.5;

/** Wall-mounted decor is painted with the back wall, before anything standing on the floor. */
const WALL_KINDS: readonly PropKind[] = [PropKind.Neon];

export function propFrom(id: number, f: Furniture): PropView {
  const lift = f.lift ?? 0;
  return {
    id,
    kind: f.kind,
    x: f.x,
    y: f.y,
    variant: f.variant ?? 0,
    level: 1,
    active: f.active ?? false,
    lift,
    since: 0,
    progress: 0,
    bubble: 0,
    depthBias: WALL_KINDS.includes(f.kind) ? -100 : lift > 0 ? 1 : 0,
  };
}

const rebuildGrid = (s: GameState) => {
  s.grid = buildGrid(s.map, s.tables.length, s.stoves.length);
};

/** Opens the next table spot: the table, its chair, and the tiles they now block. */
export function addTable(s: GameState): Table | null {
  const spot = s.map.tables[s.tables.length];
  if (!spot) return null;
  s.props.push(propFrom(s.nextId++, { kind: PropKind.Chair, x: spot.x + CHAIR_OFFSET.x, y: spot.y + CHAIR_OFFSET.y, w: 1, d: 1, blocks: true }));
  const table: Table = {
    index: s.tables.length,
    propId: s.nextId++,
    x: spot.x,
    y: spot.y,
    state: TableState.Free,
    waiter: -1,
    customer: -1,
    dish: -1,
    progress: 0,
    since: s.time,
  };
  s.tables.push(table);
  rebuildGrid(s);
  return table;
}

/** Installs the next stove spot (room for one more cook). */
export function addStove(s: GameState): GameState['stoves'][number] | null {
  const spot = s.map.stoves[s.stoves.length];
  if (!spot) return null;
  const prop = propFrom(s.nextId++, spot.stove);
  s.props.push(prop);
  const stove = { propId: prop.id, x: spot.stove.x, y: spot.stove.y, cook: spot.cook };
  s.stoves.push(stove);
  rebuildGrid(s);
  return stove;
}

/** A worker as stored in a save: who they are, how far they got. */
export interface SavedWorker extends Omit<Person, 'wage'> {
  role: Role;
  wage: Big;
  xp: number;
  morale: number;
  look: Staff['look'];
  hiredDay: number;
  lastRaiseDay: number;
  trial: boolean;
}

export interface GameSetup {
  /** Fresh plain workers for these jobs (new games, tests)... */
  roster?: readonly Role[];
  /** ...or the saved team. */
  team?: readonly SavedWorker[];
  /** Persistent progress carried in from a save. */
  levels?: Levels;
  coins?: Big;
  rating?: number;
  earned?: Big;
  served?: number;
  hires?: number;
  day?: number;
}

export function createGame(map: MapDef, seed: number, setup: GameSetup = {}): GameState {
  const levels = { ...(setup.levels ?? {}) };
  const mods = computeMods(levels);
  let nextId = 1;
  const props: PropView[] = [map.pass, map.sink, ...map.decor].map((f) => propFrom(nextId++, f));
  const s: GameState = {
    map,
    grid: buildGrid(map, 0, 0),
    tick: 0,
    time: 0,
    rng: createRng(seed),
    nextId,
    coins: setup.coins ?? big(ECONOMY.startCoins),
    rating: setup.rating ?? ECONOMY.rating.start,
    combo: 0,
    lastPayTime: -Infinity,
    nextArrival: FIRST_ARRIVAL_SECONDS,
    customers: [],
    tables: [],
    orders: [],
    staff: [],
    walkers: [],
    cleanPlates: KITCHEN.plates + mods.plates,
    dirtyPlates: 0,
    washProgress: 0,
    props,
    events: [],
    nextEventId: 1,
    commands: [],
    stats: { served: setup.served ?? 0, walkouts: 0, earned: setup.earned ?? ZERO, hires: setup.hires ?? 0 },
    levels,
    mods,
    bumpAt: Object.values(PropKind).map(() => -Infinity),
    stoves: [],
    applicants: [],
    nextApplicant: APPLICANTS.firstSeconds,
    day: setup.day ?? 1,
    dayTime: 0,
    notices: [],
    nextNoticeId: 1,
  };
  const tableCount = Math.min(map.tables.length, map.startTables + mods.tables);
  while (s.tables.length < tableCount) addTable(s);
  const stoveCount = Math.min(map.stoves.length, map.startStoves + mods.stoves);
  while (s.stoves.length < stoveCount) addStove(s);
  if (setup.team) {
    for (const w of setup.team) {
      const { role, look, xp, morale, hiredDay, lastRaiseDay, trial, ...person } = w;
      // Copies: the game must never write back into the save it was loaded from.
      const st = createStaff(s, role, { ...person, stats: { ...person.stats }, traits: [...person.traits] }, { ...look });
      Object.assign(st, { xp, morale, hiredDay, lastRaiseDay, trial, rank: rankOf(person.level) });
      s.staff.push(st);
    }
  } else {
    for (const role of setup.roster ?? STARTING_STAFF) {
      const person = generatePerson(s, role, true);
      s.staff.push(createStaff(s, role, person, uniformLook(role, applicantLook(s.rng))));
    }
  }
  for (let i = 0; i < AMBIENT.pedestrians; i++) spawnPedestrian(s, true);
  return s;
}
