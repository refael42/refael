import { PropKind as K, type PropKind } from '../sim/types';

// Decor you place yourself in build mode, on any free tile of the dining room. Each kind has
// two upgrade rows (src/data/upgrades.ts): placing another one, and an endless track that
// makes all of them better (with a new look at milestones).

export type DecorId = 'flowers' | 'lamp' | 'aquarium' | 'statue' | 'fountain' | 'piano';

export interface DecorDef {
  id: DecorId;
  kind: PropKind;
  /** How many of them fit in one restaurant. */
  max: number;
}

export const DECOR: readonly DecorDef[] = [
  { id: 'flowers', kind: K.Flowers, max: 6 },
  { id: 'lamp', kind: K.FloorLamp, max: 6 },
  { id: 'aquarium', kind: K.Aquarium, max: 3 },
  { id: 'statue', kind: K.Statue, max: 3 },
  { id: 'fountain', kind: K.Fountain, max: 2 },
  { id: 'piano', kind: K.Piano, max: 2 },
];

export const DECOR_BY_ID: Readonly<Record<string, DecorDef>> = Object.fromEntries(DECOR.map((d) => [d.id, d]));

/** The upgrade row that places one more of a decor kind. */
export const placeRow = (id: DecorId): string => `place_${id}`;
