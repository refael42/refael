import { AMBIENT } from '../../data/ambient';
import { ECONOMY } from '../../data/economy';
import { DECOR, DECOR_BY_ID, placeRow, type DecorId } from '../../data/decor';
import { BACKREST_SHIFT, SEAT_OFFSETS, type Furniture, type MapDef, type Point } from '../../data/maps';
import { APPLICANTS, KITCHEN, STARTING_STAFF, type Role } from '../../data/staff';
import { big, ZERO, type Big } from '../big';
import { GEMS } from '../../data/shop';
import { computeMods, levelOf, type Levels, type Perks } from '../economy/upgrades';
import { buildGrid } from '../grid';
import { createRng } from '../rng';
import type { PropView } from '../types';
import { PropKind } from '../types';
import { applicantLook, generatePerson, rankOf, uniformLook } from './people';
import { createStaff } from './staff';
import { autoTile, canPlaceAt } from './build';
import { TableState, type GameState, type Person, type PlacedDecor, type QuestState, type Staff, type Table } from './types';
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
  s.grid = buildGrid(s.map, s.tables.length, s.stoves.length, s.tables.filter((t) => t.seats > 1).length, s.placed);
};

/** Puts a decor piece on a tile: its prop, the tile it now blocks, and the record the save keeps. */
export function placeDecor(s: GameState, item: DecorId, at: Point): Point {
  const tile = { x: Math.floor(at.x) + 0.5, y: Math.floor(at.y) + 0.5 };
  s.props.push(propFrom(s.nextId++, { kind: DECOR_BY_ID[item]!.kind, ...tile, w: 1, d: 1, blocks: true }));
  s.placed.push({ item, ...tile });
  rebuildGrid(s);
  return tile;
}

const sameTile = (a: Point, b: Point) => Math.floor(a.x) === Math.floor(b.x) && Math.floor(a.y) === Math.floor(b.y);

/** The decor piece standing on this tile, if any. */
export const decorAt = (s: GameState, at: Point): PlacedDecor | undefined => s.placed.find((p) => sameTile(p, at));

/**
 * Moves a placed piece to another tile (build mode). The new tile is checked as if the piece
 * were already gone from the old one; if it does not work, the piece stays where it was.
 */
export function moveDecor(s: GameState, from: Point, to: Point, canPlace: (s: GameState, x: number, y: number) => boolean): boolean {
  const piece = decorAt(s, from);
  if (!piece || sameTile(from, to)) return false;
  const kind = DECOR_BY_ID[piece.item]!.kind;
  const prop = s.props.find((p) => p.kind === kind && sameTile(p, from));
  s.placed = s.placed.filter((p) => p !== piece);
  s.props = s.props.filter((p) => p !== prop);
  rebuildGrid(s);
  const ok = canPlace(s, to.x, to.y);
  placeDecor(s, piece.item as DecorId, ok ? to : piece);
  return ok;
}

/**
 * Decor from a save goes back where it was. A piece whose spot is gone (another building, a
 * changed layout) moves to the nearest free tile; with no room left it is dropped (and so is its level).
 */
function restoreDecor(s: GameState, placed: readonly PlacedDecor[]): void {
  let changed = false;
  for (const d of DECOR) {
    const row = placeRow(d.id);
    const want = levelOf(s.levels, row);
    if (want <= 0) continue;
    const spots = placed.filter((p) => p.item === d.id);
    let n = 0;
    for (; n < want; n++) {
      const p = spots[n];
      const at = p && canPlaceAt(s, p.x, p.y) ? p : autoTile(s, p);
      if (!at) break;
      placeDecor(s, d.id, at);
    }
    if (n !== want) {
      s.levels = { ...s.levels, [row]: n };
      changed = true;
    }
  }
  if (changed) s.mods = computeMods(s.levels, s.perks);
}

/**
 * Chair props for one seat. The first chair has its back to the wall side and is one piece;
 * the second one faces it, so its backrest is a separate prop drawn in front of the sitter.
 */
function addChair(s: GameState, t: { x: number; y: number }, seat: number): void {
  const o = SEAT_OFFSETS[seat]!;
  const at = { x: t.x + o.x, y: t.y + o.y, w: 1, d: 1, blocks: true };
  if (seat === 0) {
    s.props.push(propFrom(s.nextId++, { kind: PropKind.Chair, ...at }));
    return;
  }
  s.props.push(propFrom(s.nextId++, { kind: PropKind.Chair, ...at, variant: 1 }));
  s.props.push(propFrom(s.nextId++, { kind: PropKind.Chair, ...at, x: at.x + BACKREST_SHIFT, variant: 2 }));
}

/** Opens the next table spot: the table, its chairs, and the tiles they now block. */
export function addTable(s: GameState): Table | null {
  const spot = s.map.tables[s.tables.length];
  if (!spot) return null;
  const index = s.tables.length;
  // Tables are paired up in order: the first `seats` of them have their second chair.
  const seats = index < s.mods.seats ? 2 : 1;
  for (let seat = 0; seat < seats; seat++) addChair(s, spot, seat);
  const table: Table = {
    index,
    propId: s.nextId++,
    x: spot.x,
    y: spot.y,
    state: TableState.Free,
    waiter: -1,
    seats,
    party: new Array<number>(seats).fill(-1),
    dishes: new Array<number>(seats).fill(-1),
    plates: 0,
    progress: 0,
    since: s.time,
  };
  s.tables.push(table);
  rebuildGrid(s);
  return table;
}

/** "More chairs": the next single table gets a chair opposite the first one. */
export function addSeat(s: GameState): Table | null {
  const t = s.tables.find((x) => x.seats < SEAT_OFFSETS.length);
  if (!t) return null;
  addChair(s, t, t.seats);
  t.seats += 1;
  t.party.push(-1);
  t.dishes.push(-1);
  rebuildGrid(s);
  return t;
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

/** A worker as the save (and a rebuilt restaurant) keeps them. */
export function workerOf(st: Staff): SavedWorker {
  return {
    role: st.role,
    name: st.name,
    stats: { ...st.stats },
    traits: [...st.traits],
    level: st.level,
    wage: st.wage,
    xp: st.xp,
    morale: st.morale,
    look: { ...st.look },
    hiredDay: st.hiredDay,
    lastRaiseDay: st.lastRaiseDay,
    trial: st.trial,
  };
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
  /** Where the decor bought in build mode stands. */
  placed?: readonly PlacedDecor[];
  /** Quest progress and the all-time counters quests ask for. */
  quests?: QuestState;
  /** The item shop: gems, perks owned, a running income boost (seconds left). */
  gems?: number;
  perks?: Perks;
  boost?: { mult: number; seconds: number };
  fiveStars?: number;
  rushes?: number;
  bestCombo?: number;
  /** Big upgrades a crew was working on. */
  works?: readonly SavedWork[];
}

/** A job in progress as the save keeps it. */
export interface SavedWork {
  item: string;
  level: number;
  total: number;
  left: number;
  at: Point | null;
}

export function createGame(map: MapDef, seed: number, setup: GameSetup = {}): GameState {
  const levels = { ...(setup.levels ?? {}) };
  const perks = { ...(setup.perks ?? {}) };
  const mods = computeMods(levels, perks);
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
    reviews: [],
    lastReviewTime: -Infinity,
    buzzUntil: -Infinity,
    rush: { on: false, charge: 1 },
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
    stats: {
      served: setup.served ?? 0,
      walkouts: 0,
      earned: setup.earned ?? ZERO,
      hires: setup.hires ?? 0,
      fiveStars: setup.fiveStars ?? 0,
      rushes: setup.rushes ?? 0,
      bestCombo: setup.bestCombo ?? 0,
    },
    quests: setup.quests ? { level: setup.quests.level, claimed: [...setup.quests.claimed] } : { level: 1, claimed: [] },
    gems: setup.gems ?? GEMS.start,
    perks,
    boost: setup.boost && setup.boost.seconds > 0 ? { mult: setup.boost.mult, until: setup.boost.seconds } : { mult: 1, until: -Infinity },
    earnLog: [],
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
    construction: null,
    placed: [],
    works: (setup.works ?? []).map((w, i) => ({ ...w, at: w.at ? { ...w.at } : null, id: i + 1, lastTap: -Infinity })),
    nextWorkId: (setup.works?.length ?? 0) + 1,
  };
  const tableCount = Math.min(map.tables.length, map.startTables + mods.tables);
  while (s.tables.length < tableCount) addTable(s);
  const stoveCount = Math.min(map.stoves.length, map.startStoves + mods.stoves);
  while (s.stoves.length < stoveCount) addStove(s);
  restoreDecor(s, setup.placed ?? []);
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
