import { AMBIENT } from '../../data/ambient';
import type { Point } from '../../data/maps';
import { isWalkable } from '../grid';
import { randomLook } from '../looks';
import { followPath, setPose } from '../movement';
import { createRng, next, pick, range } from '../rng';
import { Expression, Facing, Held, Pose } from '../types';
import { route } from './customers';
import type { GameState, Walker } from './types';

function makeWalker(s: GameState, mode: Walker['mode'], at: Point, speed: number, rng = s.rng, id = s.nextId++): Walker {
  return {
    id,
    mode,
    look: randomLook(rng),
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
  const ends = s.map.streetEnds;
  const far = ends.reduce((a, b) => (Math.hypot(b.x - from.x, b.y - from.y) > Math.hypot(a.x - from.x, a.y - from.y) ? b : a));
  return { x: far.x, y: far.y + range(s.rng, -0.4, 0.4) };
}

/** Strollers walk the sidewalk end to end, then reappear as someone new. */
export function spawnPedestrian(s: GameState, spread = false): void {
  const start = pick(s.rng, s.map.streetEnds);
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

const AMBIENT_IDS = 2_000_000_000;

/**
 * Strollers across the road, on the far sidewalk. They have their own dice (seeded by their id):
 * adding them changed nothing else the game rolls.
 */
export function spawnFarWalker(s: GameState, spread = false): void {
  const ends = s.map.farStreetEnds;
  if (ends.length < 2) return;
  // Ids of their own (far above the game's), so the game's ids (VIPs, children...) stay the same too.
  const id = AMBIENT_IDS + s.ambientSeq++;
  const rng = createRng(id * 7919 + 17);
  const forward = next(rng) < 0.5;
  const start = ends[forward ? 0 : 1]!;
  const end = ends[forward ? 1 : 0]!;
  const w = makeWalker(s, 'far', { x: start.x, y: start.y + range(rng, -0.3, 0.3) }, range(rng, AMBIENT.pedestrianSpeed.min, AMBIENT.pedestrianSpeed.max), rng, id);
  if (spread) {
    const t = range(rng, 0.05, 0.95);
    w.x = w.prevX = start.x + (end.x - start.x) * t;
    w.y = w.prevY = start.y + (end.y - start.y) * t;
  }
  w.path = route(s, w, { x: end.x, y: end.y + range(rng, -0.3, 0.3) });
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
  const done = (mode: Walker['mode']) => s.walkers.filter((w) => w.mode === mode && w.path.length === 0).length;
  const near = done('pedestrian');
  const far = done('far');
  if (near + far === 0) return;
  s.walkers = s.walkers.filter((w) => (w.mode !== 'pedestrian' && w.mode !== 'far') || w.path.length > 0);
  for (let i = 0; i < near; i++) spawnPedestrian(s);
  for (let i = 0; i < far; i++) spawnFarWalker(s);
}
