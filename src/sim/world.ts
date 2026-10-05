import { DEMO_PATIENCE_SECONDS, EMOTE_SECONDS } from '../data/sim';
import type { CastMember, SceneDef } from '../data/scenes';
import { moveToward, setPose } from './movement';
import { createRng } from './rng';
import { packSnapshot, type Snapshot } from './snapshot';
import type { Character, RoutineStep, World } from './types';
import { Expression, Held, Pose } from './types';

/** Tiles per second for scripted walks. */
const WALK_SPEED = 1.3;

export function createWorld(scene: SceneDef): World {
  const world: World = { tick: 0, time: 0, rng: createRng(scene.seed), nextId: 1, characters: [], props: [] };
  for (const p of scene.props) {
    world.props.push({
      id: world.nextId++,
      kind: p.kind,
      x: p.x,
      y: p.y,
      variant: p.variant ?? 0,
      level: 1,
      active: p.active ?? false,
      lift: p.lift ?? 0,
      since: 0,
      progress: 0,
      bubble: 0,
      depthBias: (p.lift ?? 0) > 0 ? 1 : 0,
    });
  }
  for (const member of scene.cast) addCharacter(world, member);
  return world;
}

function addCharacter(world: World, m: CastMember): Character {
  const c: Character = {
    id: world.nextId++,
    look: { ...m.look },
    x: m.x,
    y: m.y,
    prevX: m.x,
    prevY: m.y,
    facing: m.facing,
    pose: Pose.Idle,
    poseTime: 0,
    held: Held.None,
    expression: Expression.Happy,
    emote: 0,
    emoteTime: 0,
    patience: -1,
    bubble: 0,
    routine: m.routine,
    step: 0,
    stepTime: 0,
  };
  startStep(c, true);
  world.characters.push(c);
  return c;
}

/** Advances the world by one fixed step. Deterministic: same world + same dt = same result. */
export function stepWorld(world: World, dt: number): void {
  world.tick += 1;
  world.time += dt;
  for (const c of world.characters) {
    c.prevX = c.x;
    c.prevY = c.y;
    updateRoutine(c, dt);
    c.poseTime += dt;
    if (c.emote !== 0) {
      c.emoteTime += dt;
      if (c.emoteTime >= EMOTE_SECONDS) c.emote = 0;
    }
  }
}

function startStep(c: Character, freshLoop: boolean): void {
  const step = c.routine[c.step];
  c.stepTime = 0;
  if (!step) return;
  c.held = step.held ?? Held.None;
  if (step.do === 'walk') {
    setPose(c, Pose.Walk);
    c.patience = -1;
    return;
  }
  setPose(c, step.pose);
  c.expression = step.expression ?? Expression.Happy;
  if (step.facing !== undefined) c.facing = step.facing;
  if (step.emote) {
    c.emote = step.emote;
    c.emoteTime = 0;
  }
  if (!step.patience) c.patience = -1;
  else if (freshLoop || c.patience < 0) c.patience = 1;
}

function nextStep(c: Character): void {
  c.step = (c.step + 1) % c.routine.length;
  startStep(c, c.step === 0);
}

function updateRoutine(c: Character, dt: number): void {
  const step: RoutineStep | undefined = c.routine[c.step];
  if (!step) return;
  c.stepTime += dt;
  if (step.do === 'walk') {
    if (moveToward(c, step, WALK_SPEED, dt)) nextStep(c);
    return;
  }
  if (step.patience && c.patience >= 0) {
    c.patience = Math.max(0, c.patience - dt / DEMO_PATIENCE_SECONDS);
  }
  if (c.stepTime >= step.seconds) nextStep(c);
}

export function worldSnapshot(world: World, seq: number): Snapshot {
  return packSnapshot(world.characters, world.props, seq, world.time);
}
