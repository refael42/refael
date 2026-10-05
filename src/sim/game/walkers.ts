import { AMBIENT } from '../../data/ambient';
import type { Point } from '../../data/maps';
import { isWalkable } from '../grid';
import { randomLook } from '../looks';
import { followPath, setPose } from '../movement';
import { pick, range } from '../rng';
import { Expression, Facing, Held, Pose } from '../types';
import { route } from './customers';
import type { GameState, Walker } from './types';

function makeWalker(s: GameState, mode: Walker['mode'], at: Point, speed: number): Walker {
  return {
    id: s.nextId++,
    mode,
    look: randomLook(s.rng),
    x: at.x,
    y: at.y,
    prevX: at.x,
    prevY: at.y,
    facing: Facing.FrontRight,
    pose: Pose.Walk,
    poseTime: 0,
    held: Held.None,
    expression: Expression.Happy,
    emote: 0,
    emoteTime: 0,
    patience: -1,
    bubble: 0,
    path: [],
    speed,
    pause: 0,
  };
}

function otherEnd(s: GameState, from: Point): Point {
  const ends = s.map.spawns;
  const far = ends.reduce((a, b) => (Math.hypot(b.x - from.x, b.y - from.y) > Math.hypot(a.x - from.x, a.y - from.y) ? b : a));
  return { x: far.x, y: far.y + range(s.rng, -0.4, 0.4) };
}

/** Strollers walk the sidewalk end to end, then reappear as someone new. */
export function spawnPedestrian(s: GameState, spread = false): void {
  const start = pick(s.rng, s.map.spawns);
  const w = makeWalker(s, 'pedestrian', { x: start.x, y: start.y }, range(s.rng, AMBIENT.pedestrianSpeed.min, AMBIENT.pedestrianSpeed.max));
  const end = otherEnd(s, start);
  if (spread) {
    // At game start, scatter them along the street instead of all at the corners.
    const t = range(s.rng, 0.1, 0.9);
    w.x = start.x + (end.x - start.x) * t;
    w.y = start.y + (end.y - start.y) * t;
    w.prevX = w.x;
    w.prevY = w.y;
  }
  w.path = route(s, w, end);
  s.walkers.push(w);
}

function randomWalkableTile(s: GameState): Point {
  for (let i = 0; i < 50; i++) {
    const p = { x: Math.floor(range(s.rng, 0, s.map.width)) + 0.5, y: Math.floor(range(s.rng, 0, s.map.height)) + 0.5 };
    if (isWalkable(s.grid, p)) return p;
  }
  return { ...s.map.queue[0]! };
}

export function addStressWalkers(s: GameState, count: number): void {
  for (let i = 0; i < count; i++) {
    const w = makeWalker(s, 'stress', randomWalkableTile(s), range(s.rng, 0.9, 1.8));
    w.path = route(s, w, randomWalkableTile(s));
    s.walkers.push(w);
  }
}

export function removeStressWalkers(s: GameState): void {
  s.walkers = s.walkers.filter((w) => w.mode !== 'stress');
}

export function updateWalkers(s: GameState, dt: number): void {
  for (const w of s.walkers) {
    if (w.pause > 0) {
      w.pause -= dt;
      if (w.pause <= 0) w.path = route(s, w, randomWalkableTile(s));
      continue;
    }
    if (!followPath(w, w.path, w.speed, dt)) continue;
    if (w.mode === 'stress') {
      setPose(w, Pose.Idle);
      w.pause = range(s.rng, AMBIENT.stressPause.min, AMBIENT.stressPause.max);
    }
  }
  const before = s.walkers.length;
  s.walkers = s.walkers.filter((w) => w.mode !== 'pedestrian' || w.path.length > 0);
  for (let i = s.walkers.length; i < before; i++) spawnPedestrian(s);
}
