/**
 * Passenger services in the terminals (owner request: everything a real
 * airport has), by the level of the "amenities" upgrade: what comes with each
 * level and where it stands in each terminal (spots chosen off the walking
 * routes, against walls and between seat rows).
 */
import type { P2 } from './tiers';

export type AmenityKind = 'charging' | 'exchange' | 'pharmacy' | 'massage' | 'pods' | 'prayer' | 'nursing';
export const AMENITY_KINDS: readonly AmenityKind[] = ['charging', 'exchange', 'pharmacy', 'massage', 'pods', 'prayer', 'nursing'];

/** The upgrade level each service comes with (the prayer and nursing rooms come together). */
export const AMENITY_LEVEL: Readonly<Record<AmenityKind, number>> = { charging: 1, exchange: 2, pharmacy: 3, massage: 4, pods: 5, prayer: 6, nursing: 6 };

export interface AmenitySpot {
  kind: AmenityKind;
  at: P2;
  /** Faces +y (against a north wall) instead of +x. */
  faceY?: boolean;
  /** A charging pillar alone, without its bench (where there is no room). */
  slim?: boolean;
}

/** Terminal 1's departures lounge has room for a charging pillar. */
export const T1_AMENITIES: readonly AmenitySpot[] = [{ kind: 'charging', at: [17.95, 17.25], slim: true }];

/** Terminal 3 (Terminal 4 is built on its plan, moved east; the hub's wider Terminal 3 keeps the same west part). */
export const T3_AMENITIES: readonly AmenitySpot[] = [
  { kind: 'charging', at: [43.55, 16.05] },
  { kind: 'charging', at: [45.75, 16.75] },
  { kind: 'exchange', at: [50.15, 8.05], faceY: true },
  { kind: 'pharmacy', at: [50.85, 8.05], faceY: true },
  { kind: 'massage', at: [40.45, 16.55] },
  { kind: 'pods', at: [50.85, 16.6] },
  // (the quiet south-west corner of the passport hall: people leave the booths eastward)
  { kind: 'nursing', at: [39.55, 15.2] },
  { kind: 'prayer', at: [40.25, 15.15] },
];
/** Terminal 3's west wall (the spots above are for a building that starts here). */
export const T3_X0 = 39.5;
