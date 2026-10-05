import type { Hair, Look } from '../data/looks';
import {
  CASUAL_ACCESSORIES,
  CASUAL_HATS,
  CASUAL_OUTFITS,
  HAIR_COLORS,
  HAIR_STYLE_COUNT,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
} from '../data/looks';
import type { SceneDef } from '../data/scenes';
import { WALK_SPEED } from '../data/scenes';
import { int, pick, range, type Rng } from './rng';
import type { RoutineStep, World } from './types';
import { Facing, Pose } from './types';
import { addCharacter } from './world';

/** A random casual look; the same generator will dress random customers and applicants later. */
export function randomLook(rng: Rng): Look {
  return {
    outfit: pick(rng, CASUAL_OUTFITS),
    hair: int(rng, 0, HAIR_STYLE_COUNT) as Hair,
    hairColor: int(rng, 0, HAIR_COLORS.length),
    skin: int(rng, 0, SKIN_TONES.length),
    shirt: int(rng, 0, SHIRT_COLORS.length),
    pants: int(rng, 0, PANTS_COLORS.length),
    hat: pick(rng, CASUAL_HATS),
    accessory: pick(rng, CASUAL_ACCESSORIES),
  };
}

/** Adds walkers that roam the scene, used to measure fps with many animated entities. */
export function addWanderers(world: World, scene: SceneDef, count: number): void {
  const { minX, maxX, minY, maxY } = scene.roam;
  for (let i = 0; i < count; i++) {
    const rng = world.rng;
    const routine: RoutineStep[] = [];
    for (let s = 0; s < 4; s++) {
      routine.push({ do: 'walk', x: range(rng, minX, maxX), y: range(rng, minY, maxY) });
      routine.push({ do: 'act', pose: Pose.Idle, seconds: range(rng, 0.5, 2.5) });
    }
    addCharacter(
      world,
      {
        look: randomLook(rng),
        x: range(rng, minX, maxX),
        y: range(rng, minY, maxY),
        speed: range(rng, WALK_SPEED.stroll, WALK_SPEED.rushed),
        facing: Facing.FrontRight,
        routine,
      },
      'stress',
    );
  }
}

export function removeWanderers(world: World): void {
  world.characters = world.characters.filter((c) => c.tag !== 'stress');
}
