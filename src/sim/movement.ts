import type { Point } from '../data/maps';
import type { CharacterView, Facing } from './types';
import { Facing as F, Pose } from './types';

/**
 * Picks the sprite facing for a floor-plane direction. The world is isometric: floor (dx, dy)
 * shows on screen as (dx - dy, dx + dy), so "down-right on screen" is +x.
 */
export function facingFor(dx: number, dy: number, previous: Facing): Facing {
  const sx = dx - dy;
  const sy = dx + dy;
  const wasRight = previous === F.FrontRight || previous === F.BackRight;
  const right = Math.abs(sx) < 0.01 ? wasRight : sx > 0;
  if (sy < -0.01) return right ? F.BackRight : F.BackLeft;
  return right ? F.FrontRight : F.FrontLeft;
}

export function setPose(c: CharacterView, pose: CharacterView['pose']): void {
  if (c.pose !== pose) {
    c.pose = pose;
    c.poseTime = 0;
  }
}

/** Steps toward a target; returns true on arrival (snapped exactly onto it). */
export function moveToward(c: CharacterView, target: Point, speed: number, dt: number): boolean {
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  const dist = Math.hypot(dx, dy);
  const move = speed * dt;
  if (dist > 0.001) c.facing = facingFor(dx, dy, c.facing);
  if (move >= dist || speed <= 0) {
    c.x = target.x;
    c.y = target.y;
    return true;
  }
  c.x += (dx / dist) * move;
  c.y += (dy / dist) * move;
  return false;
}

/** Walks along a list of waypoints, consuming them; returns true when the last one is reached. */
export function followPath(c: CharacterView, path: Point[], speed: number, dt: number): boolean {
  setPose(c, Pose.Walk);
  if (path.length === 0) return true;
  if (moveToward(c, path[0]!, speed, dt)) path.shift();
  return path.length === 0;
}
