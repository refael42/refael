import { AMBIENT } from '../../data/ambient';
import { ECONOMY } from '../../data/economy';
import { CHAIR_OFFSET, type Furniture, type MapDef } from '../../data/maps';
import { LOOKS } from '../../data/scenes';
import { big, ZERO } from '../big';
import { buildGrid } from '../grid';
import { createRng } from '../rng';
import type { CharacterView, PropView } from '../types';
import { Expression, Facing, Held, Pose, PropKind } from '../types';
import { TableState, type GameState, type Table } from './types';
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

export function createGame(map: MapDef, seed: number): GameState {
  let nextId = 1;
  const props: PropView[] = [map.stove, map.pass, ...map.decor].map((f) => propFrom(nextId++, f));
  for (const t of map.tables) {
    props.push(propFrom(nextId++, { kind: PropKind.Chair, x: t.x + CHAIR_OFFSET.x, y: t.y + CHAIR_OFFSET.y, w: 1, d: 1, blocks: true }));
  }
  const tables: Table[] = map.tables.map((t, index) => ({
    index,
    propId: nextId++,
    x: t.x,
    y: t.y,
    state: TableState.Free,
    customer: -1,
    dish: -1,
    progress: 0,
    since: 0,
  }));
  const cook: CharacterView = {
    id: nextId++,
    look: { ...LOOKS.cook },
    x: map.cookSpot.x,
    y: map.cookSpot.y,
    prevX: map.cookSpot.x,
    prevY: map.cookSpot.y,
    // Faces the stove against the back wall, like every cook in a busy kitchen.
    facing: Facing.BackLeft,
    pose: Pose.Idle,
    poseTime: 0,
    held: Held.Spatula,
    expression: Expression.Happy,
    emote: 0,
    emoteTime: 0,
    patience: -1,
    bubble: 0,
  };
  const s: GameState = {
    map,
    grid: buildGrid(map),
    tick: 0,
    time: 0,
    rng: createRng(seed),
    nextId,
    coins: big(ECONOMY.startCoins),
    rating: ECONOMY.rating.start,
    combo: 0,
    lastPayTime: -Infinity,
    nextArrival: FIRST_ARRIVAL_SECONDS,
    customers: [],
    tables,
    orders: [],
    cook,
    walkers: [],
    props,
    events: [],
    nextEventId: 1,
    commands: [],
    stats: { served: 0, walkouts: 0, earned: ZERO },
  };
  for (let i = 0; i < AMBIENT.pedestrians; i++) spawnPedestrian(s, true);
  return s;
}
