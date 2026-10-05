import type { CustomerType } from '../data/customers';
import type { Hair, Look } from '../data/looks';
import {
  CASUAL_ACCESSORIES,
  CASUAL_HATS,
  CASUAL_OUTFITS,
  HAIR_COLORS,
  HAIR_STYLE_COUNT,
  Hat,
  Outfit,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
} from '../data/looks';
import { int, pick, type Rng } from './rng';

/** A random casual look; the same generator will dress applicants later. */
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

/**
 * Customer look: random person, then the type's signature pieces. Regulars wear plain tees so
 * the other types stay recognizable at a glance.
 */
export function customerLook(rng: Rng, type: CustomerType): Look {
  const look = randomLook(rng);
  if (type.id === 'regular') {
    look.outfit = Outfit.Tee;
    if (look.hat === Hat.SunHat) look.hat = Hat.None;
    if (look.accessory !== 0 && look.accessory !== 2) look.accessory = 0;
  }
  return { ...look, ...type.look };
}
