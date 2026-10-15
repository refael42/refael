import { CustomerState } from './types';
import { CREW, RoomItem, type Room } from '../../data/kitchenRooms';
import { Hat, Outfit, type Look } from '../../data/looks';
import type { Point } from '../../data/maps';
import { LOOKS } from '../../data/scenes';
import { randomLook } from '../looks';
import { followPath, setPose } from '../movement';
import { createRng, next, range } from '../rng';
import { Expression, Facing, Held, Pose, PropKind, type Pose as PoseT } from '../types';
import { route } from './customers';
import type { Crew, GameState } from './types';

// The kitchen rooms' crew (owner M32: the kitchen in rooms, "a small manager's office, very
// detailed"): in each room someone at its work (the vegetable cook cutting at the board, the
// prep cook plating, the pastry chef at the mixer, the butcher at the block, the storekeeper
// with the stock list, the manager at the desk), now and then off on an errand: to the walk-in
// for supplies, back with a crate; the manager to the coffee machine, or out to watch the line.
// They are part of the place, like the strollers outside: not hired, not paid, not saved, and
// with dice of their own, so nothing else the game rolls changes because they are there.

/** Ids of their own, above the game's and the strollers'. */
const CREW_IDS = 2_100_000_000;

/** What they do at each room's work: the pose and what they hold. */
const AT_WORK: Partial<Record<number, { pose: PoseT; held: Held }>> = {
  [RoomItem.VegBoard]: { pose: Pose.Slice, held: Held.Knife },
  [RoomItem.VegSink]: { pose: Pose.Wash, held: Held.None },
  [RoomItem.Plating]: { pose: Pose.Plate, held: Held.Tweezers },
  [RoomItem.Bowls]: { pose: Pose.Mix, held: Held.Bowl },
  [RoomItem.StockPots]: { pose: Pose.Stir, held: Held.Ladle },
  [RoomItem.Pastry]: { pose: Pose.Mix, held: Held.Bowl },
  [RoomItem.Dough]: { pose: Pose.Mix, held: Held.None },
  [RoomItem.Butcher]: { pose: Pose.Slice, held: Held.Knife },
  [RoomItem.Stores]: { pose: Pose.Idle, held: Held.Clipboard },
  [RoomItem.Rack]: { pose: Pose.Idle, held: Held.Clipboard },
  [RoomItem.Desk]: { pose: Pose.Sit, held: Held.None },
};

/** Their whites by room: a bandana for the vegetables, a toque for pastry, a cap in the stores, the manager in a suit. */
function lookFor(room: Room, base: Look): Look {
  const person = { skin: base.skin, hair: base.hair, hairColor: base.hairColor };
  if (room.kind === 'office') return { ...LOOKS.manager, ...person, hat: Hat.None, accessory: LOOKS.manager.accessory };
  if (room.kind === 'stores') return { ...LOOKS.cook, ...person, outfit: Outfit.Washer, hat: Hat.Cap };
  const hat = room.kind === 'pastry' ? Hat.Toque : room.kind === 'butchery' ? Hat.Cap : Hat.Bandana;
  return { ...LOOKS.cook, ...person, hat };
}

/** The crew of the map's rooms: one in each room but the dish room (the washers) and the walk-in (everyone's errand). */
export function makeCrew(s: GameState): Crew[] {
  const out: Crew[] = [];
  s.map.rooms.forEach((room, i) => {
    if (room.kind === 'dish' || room.kind === 'cold' || room.task < 0) return;
    const rng = createRng(i * 7717 + 31 + s.map.tier * 101);
    const piece = s.props.find((p) => p.kind === PropKind.RoomPiece && Math.abs(p.x - room.work.x) < 0.01 && Math.abs(p.y - room.work.y) < 0.01);
    const work = AT_WORK[room.task] ?? { pose: Pose.Idle, held: Held.None };
    out.push({
      id: CREW_IDS + i,
      look: lookFor(room, randomLook(rng)),
      x: room.post.x,
      y: room.post.y,
      prevX: room.post.x,
      prevY: room.post.y,
      facing: room.front ? Facing.FrontRight : Facing.BackLeft,
      pose: work.pose,
      poseTime: range(rng, 0, 2),
      held: work.held,
      expression: Expression.Happy,
      emote: 0,
      emoteTime: 0,
      patience: -1,
      bubble: 0,
      room: i,
      phase: 'work',
      errand: 'stretch',
      path: [],
      timer: range(rng, CREW.work.min, CREW.work.max),
      piece: piece?.id ?? -1,
      rng,
    });
  });
  return out;
}

/** Where an errand takes them: the walk-in's shelf, the office's coffee machine, the corridor by the line. */
function errandSpot(s: GameState, c: Crew, room: Room): Point | null {
  if (c.errand === 'fetch') {
    // The nearest walk-in or dry store (a big kitchen has a few), a little way in past its door.
    const mid = (r: Room) => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
    const far = (r: Room) => Math.abs(mid(r).x - c.x) + Math.abs(mid(r).y - c.y) * 2;
    const store = s.map.rooms.filter((r) => r !== room && (r.kind === 'cold' || r.kind === 'stores')).sort((a, b) => far(a) - far(b))[0];
    return store ? { x: store.x0 + 1.5, y: store.y0 + Math.min(store.y1 - store.y0 - 1, 2) + 0.5 } : null;
  }
  if (c.errand === 'coffee') {
    const machine = s.props.find((p) => p.kind === PropKind.RoomPiece && p.variant === RoomItem.Coffee && p.x > room.x0 && p.x < room.x1 && p.y > room.y0 && p.y < room.y1);
    return machine ? { x: machine.x + (machine.x < room.x0 + 1 ? 1.05 : -1.05), y: machine.y } : null;
  }
  if (c.errand === 'rounds') {
    // Out of the office to the corridor below the line room, by the pass: watching the line work.
    const first = s.map.rooms[0];
    return first ? { x: s.map.kitchenX - 3.5, y: first.y0 - 0.5 } : null;
  }
  return null;
}

function atWork(c: Crew, room: Room): void {
  const work = AT_WORK[room.task] ?? { pose: Pose.Idle, held: Held.None };
  c.x = room.post.x;
  c.y = room.post.y;
  c.facing = room.front ? Facing.FrontRight : Facing.BackLeft;
  c.held = work.held;
  setPose(c, work.pose);
}

function updateOne(s: GameState, c: Crew, dt: number): void {
  const room = s.map.rooms[c.room];
  if (!room) return;
  if (c.phase === 'work') {
    atWork(c, room);
    c.timer -= dt;
    if (c.timer > 0) return;
    // Off on an errand: the manager to the coffee or the line, the others mostly to the walk-in.
    const roll = next(c.rng);
    c.errand = room.kind === 'office' ? (roll < 0.5 ? 'coffee' : 'rounds') : roll < CREW.fetchChance ? 'fetch' : 'stretch';
    const to = errandSpot(s, c, room);
    if (!to) {
      // A stretch where they stand.
      c.phase = 'stop';
      c.timer = range(c.rng, CREW.stop.min, CREW.stop.max);
      setPose(c, Pose.Idle);
      c.facing = Facing.FrontRight;
      c.held = Held.None;
      return;
    }
    c.held = Held.None;
    c.path = route(s, c, to);
    c.phase = 'go';
  } else if (c.phase === 'go' || c.phase === 'back') {
    if (!followPath(c, c.path, CREW.speed, dt)) return;
    if (c.phase === 'back') {
      c.phase = 'work';
      c.timer = range(c.rng, CREW.work.min, CREW.work.max);
      atWork(c, room);
      return;
    }
    c.phase = 'stop';
    c.timer = range(c.rng, CREW.stop.min, CREW.stop.max);
    // Facing the shelf, the machine, or up the line toward the pass.
    setPose(c, Pose.Idle);
    c.facing = c.errand === 'rounds' ? Facing.BackRight : Facing.BackLeft;
    if (c.errand === 'rounds') c.held = Held.Clipboard;
  } else if (c.phase === 'stop') {
    c.timer -= dt;
    if (c.timer > 0) return;
    // Back with what they came for: a crate from the walk-in, a coffee.
    c.held = c.errand === 'fetch' ? Held.FoodBox : c.errand === 'coffee' ? Held.Glass : Held.None;
    if (c.errand === 'stretch') {
      c.phase = 'work';
      c.timer = range(c.rng, CREW.work.min, CREW.work.max);
      atWork(c, room);
      return;
    }
    c.path = route(s, c, room.post);
    c.phase = 'back';
  }
}

/** Is someone in this doorway (door prop at the middle of its tile edge; variant 10+ along y)? */
function inDoorway(x: number, y: number, alongY: boolean, px: number, py: number): boolean {
  const across = alongY ? Math.abs(px - x) : Math.abs(py - y);
  const along = alongY ? Math.abs(py - y) : Math.abs(px - x);
  return across < CREW.doorReach && along < CREW.doorHalf;
}

/** The crew at work; doors open while someone passes; a room's work shows its worker at it. */
export function updateCrew(s: GameState, dt: number): void {
  for (const c of s.crew) updateOne(s, c, dt);
  if (s.map.roomDoors.length === 0) return;
  for (const p of s.props) {
    if (p.kind === PropKind.RoomDoor) {
      const alongY = p.variant >= 10;
      p.active =
        s.crew.some((c) => inDoorway(p.x, p.y, alongY, c.x, c.y)) ||
        s.staff.some((st) => !st.away && inDoorway(p.x, p.y, alongY, st.x, st.y)) ||
        // Guests through the restroom's door (owner M36).
        s.customers.some((c) => c.state === CustomerState.Restroom && inDoorway(p.x, p.y, alongY, c.x, c.y));
    } else if (p.kind === PropKind.RoomPiece) p.active = s.crew.some((c) => c.piece === p.id && c.phase === 'work');
  }
}
