/** Passenger types. Order matches the outfits drawn in render/art/people.ts. */
export interface PaxTypeDef {
  id: 'tourist' | 'business' | 'businessW' | 'family' | 'kid' | 'student' | 'vip' | 'elder';
  /** Walking speed in tiles/second. */
  speed: number;
  /** Relative frequency. */
  weight: number;
  /** How much they like to shop (1 = average). */
  spend: number;
}

export const PAX_TYPES: readonly PaxTypeDef[] = [
  { id: 'tourist', speed: 1.25, weight: 5, spend: 1.3 },
  { id: 'business', speed: 1.55, weight: 3, spend: 0.8 },
  { id: 'businessW', speed: 1.5, weight: 3, spend: 0.9 },
  { id: 'family', speed: 1.05, weight: 3, spend: 1.1 },
  { id: 'kid', speed: 1.15, weight: 2, spend: 0.5 },
  { id: 'student', speed: 1.35, weight: 3, spend: 0.6 },
  { id: 'vip', speed: 1.2, weight: 0.4, spend: 2.2 },
  { id: 'elder', speed: 0.85, weight: 1.5, spend: 0.9 },
];

const TOTAL = PAX_TYPES.reduce((a, p) => a + p.weight, 0);

/** Picks a type from a uniform number in [0, 1). */
export function paxTypeFrom(u: number): number {
  let r = u * TOTAL;
  for (let i = 0; i < PAX_TYPES.length; i++) {
    if (r < PAX_TYPES[i].weight) return i;
    r -= PAX_TYPES[i].weight;
  }
  return 0;
}
