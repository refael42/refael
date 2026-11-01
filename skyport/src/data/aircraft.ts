/**
 * Aircraft table. Adding an aircraft = adding a row here (plus its name key
 * in i18n). Units: distances in tiles, speeds in tiles/second, times in
 * seconds, money in coins.
 */
export type AircraftCategory =
  | 'lightSingle'
  | 'lightTwin'
  | 'turboprop'
  | 'regional'
  | 'narrow'
  | 'narrowX'
  | 'wide'
  | 'jumbo'
  | 'cargo'
  | 'bizjet'
  | 'heli';

export type StandSize = 'small' | 'medium' | 'large' | 'huge' | 'hugeX' | 'cargo' | 'fbo' | 'heli';
export type WakeCategory = 'light' | 'medium' | 'heavy' | 'super';

/** Drawing description. All sizes in tiles, model space: u = nose direction, v = left, h = up. */
export interface AircraftArt {
  length: number;
  /** Fuselage radius (lateral). */
  radius: number;
  /** Vertical radius multiplier (double-deckers are taller). */
  tall: number;
  span: number;
  chord: number;
  /** Wing sweep: how far back the tip sits, in tiles. */
  sweep: number;
  wing: 'high' | 'low';
  engines: 'nose' | 'wingProps' | 'wingJets2' | 'wingJets4' | 'tailJets' | 'rotor';
  engineSize: number;
  tail: 'normal' | 'T';
  /** Window rows: 0 = none (cargo), 1, or 2 for the double deck. */
  windowRows: number;
  /** Number of side windows per row. */
  windows: number;
  /** Ground clearance of the fuselage bottom. */
  gear: number;
}

export interface AircraftDef {
  id: string;
  /** Fictional model name, shown as-is in every language. */
  model: string;
  category: AircraftCategory;
  paxMin: number;
  paxMax: number;
  stand: StandSize;
  wake: WakeCategory;
  /** First airport tier where it appears (1 = dirt strip). */
  unlockTier: number;
  /** Flights you must have served before it shows up. */
  unlockServed: number;
  approachSpeed: number;
  taxiSpeed: number;
  runwayLength: number;
  fuelLoad: number;
  baseTurnaround: number;
  noise: number;
  landingFee: number;
  paxFee: number;
  art: AircraftArt;
}

export const AIRCRAFT: readonly AircraftDef[] = [
  {
    id: 'sparrow', model: 'Sparrow', category: 'lightSingle', paxMin: 2, paxMax: 4, stand: 'small', wake: 'light',
    unlockTier: 1, unlockServed: 0, approachSpeed: 2.4, taxiSpeed: 1.25, runwayLength: 8, fuelLoad: 120, baseTurnaround: 24, noise: 60,
    landingFee: 6, paxFee: 4,
    art: { length: 1.1, radius: 0.1, tall: 1.05, span: 1.36, chord: 0.2, sweep: 0.0, wing: 'high', engines: 'nose',
      engineSize: 0.09, tail: 'normal', windowRows: 1, windows: 2, gear: 0.07 },
  },
  {
    id: 'finch', model: 'Finch', category: 'lightTwin', paxMin: 6, paxMax: 10, stand: 'small', wake: 'light',
    unlockTier: 1, unlockServed: 6, approachSpeed: 2.6, taxiSpeed: 1.25, runwayLength: 9, fuelLoad: 380, baseTurnaround: 32, noise: 66,
    landingFee: 14, paxFee: 5,
    art: { length: 1.45, radius: 0.115, tall: 1.05, span: 1.7, chord: 0.2, sweep: 0.02, wing: 'low', engines: 'wingProps',
      engineSize: 0.07, tail: 'normal', windowRows: 1, windows: 4, gear: 0.08 },
  },
  {
    id: 'heron', model: 'Heron', category: 'turboprop', paxMin: 50, paxMax: 70, stand: 'medium', wake: 'medium',
    unlockTier: 3, unlockServed: 0, approachSpeed: 2.8, taxiSpeed: 1.2, runwayLength: 12, fuelLoad: 2500, baseTurnaround: 70, noise: 74,
    landingFee: 60, paxFee: 6,
    art: { length: 2.2, radius: 0.15, tall: 1.05, span: 2.5, chord: 0.24, sweep: 0.03, wing: 'high', engines: 'wingProps',
      engineSize: 0.09, tail: 'T', windowRows: 1, windows: 9, gear: 0.07 },
  },
  {
    id: 'swift', model: 'Swift', category: 'regional', paxMin: 80, paxMax: 100, stand: 'medium', wake: 'medium',
    unlockTier: 3, unlockServed: 0, approachSpeed: 3.1, taxiSpeed: 1.2, runwayLength: 14, fuelLoad: 5000, baseTurnaround: 75, noise: 78,
    landingFee: 85, paxFee: 7,
    art: { length: 2.6, radius: 0.16, tall: 1.0, span: 2.4, chord: 0.26, sweep: 0.28, wing: 'low', engines: 'tailJets',
      engineSize: 0.085, tail: 'T', windowRows: 1, windows: 11, gear: 0.08 },
  },
  {
    id: 'falcon', model: 'Falcon', category: 'narrow', paxMin: 150, paxMax: 200, stand: 'large', wake: 'medium',
    unlockTier: 4, unlockServed: 0, approachSpeed: 3.4, taxiSpeed: 1.15, runwayLength: 18, fuelLoad: 18000, baseTurnaround: 90, noise: 82,
    landingFee: 180, paxFee: 9,
    art: { length: 3.2, radius: 0.2, tall: 1.0, span: 3.1, chord: 0.36, sweep: 0.45, wing: 'low', engines: 'wingJets2',
      engineSize: 0.11, tail: 'normal', windowRows: 1, windows: 14, gear: 0.1 },
  },
  {
    id: 'falconx', model: 'Falcon X', category: 'narrowX', paxMin: 200, paxMax: 220, stand: 'large', wake: 'medium',
    unlockTier: 5, unlockServed: 0, approachSpeed: 3.5, taxiSpeed: 1.15, runwayLength: 20, fuelLoad: 22000, baseTurnaround: 100, noise: 83,
    landingFee: 230, paxFee: 10,
    art: { length: 3.7, radius: 0.2, tall: 1.0, span: 3.2, chord: 0.37, sweep: 0.47, wing: 'low', engines: 'wingJets2',
      engineSize: 0.115, tail: 'normal', windowRows: 1, windows: 17, gear: 0.1 },
  },
  {
    id: 'albatross', model: 'Albatross', category: 'wide', paxMin: 300, paxMax: 350, stand: 'huge', wake: 'heavy',
    unlockTier: 5, unlockServed: 0, approachSpeed: 3.6, taxiSpeed: 1.05, runwayLength: 24, fuelLoad: 110000, baseTurnaround: 130, noise: 88,
    landingFee: 600, paxFee: 12,
    art: { length: 4.6, radius: 0.28, tall: 1.0, span: 4.4, chord: 0.55, sweep: 0.7, wing: 'low', engines: 'wingJets2',
      engineSize: 0.17, tail: 'normal', windowRows: 1, windows: 22, gear: 0.12 },
  },
  {
    id: 'condor', model: 'Condor', category: 'jumbo', paxMin: 500, paxMax: 560, stand: 'hugeX', wake: 'super',
    unlockTier: 7, unlockServed: 0, approachSpeed: 3.6, taxiSpeed: 1.0, runwayLength: 28, fuelLoad: 250000, baseTurnaround: 160, noise: 92,
    landingFee: 1100, paxFee: 13,
    art: { length: 5.2, radius: 0.32, tall: 1.35, span: 5.0, chord: 0.7, sweep: 0.8, wing: 'low', engines: 'wingJets4',
      engineSize: 0.16, tail: 'normal', windowRows: 2, windows: 24, gear: 0.13 },
  },
  {
    id: 'pelican', model: 'Pelican F', category: 'cargo', paxMin: 0, paxMax: 0, stand: 'cargo', wake: 'heavy',
    unlockTier: 4, unlockServed: 0, approachSpeed: 3.5, taxiSpeed: 1.05, runwayLength: 24, fuelLoad: 90000, baseTurnaround: 140, noise: 88,
    landingFee: 650, paxFee: 0,
    art: { length: 4.5, radius: 0.28, tall: 1.0, span: 4.3, chord: 0.55, sweep: 0.7, wing: 'low', engines: 'wingJets2',
      engineSize: 0.17, tail: 'normal', windowRows: 0, windows: 0, gear: 0.12 },
  },
  {
    id: 'kestrel', model: 'Kestrel', category: 'bizjet', paxMin: 4, paxMax: 8, stand: 'fbo', wake: 'light',
    unlockTier: 3, unlockServed: 0, approachSpeed: 3.2, taxiSpeed: 1.25, runwayLength: 12, fuelLoad: 3000, baseTurnaround: 55, noise: 72,
    landingFee: 120, paxFee: 40,
    art: { length: 1.7, radius: 0.12, tall: 1.0, span: 1.6, chord: 0.2, sweep: 0.25, wing: 'low', engines: 'tailJets',
      engineSize: 0.065, tail: 'T', windowRows: 1, windows: 5, gear: 0.07 },
  },
  {
    id: 'dragonfly', model: 'Dragonfly', category: 'heli', paxMin: 2, paxMax: 4, stand: 'heli', wake: 'light',
    unlockTier: 5, unlockServed: 0, approachSpeed: 1.8, taxiSpeed: 0.8, runwayLength: 0, fuelLoad: 400, baseTurnaround: 45, noise: 76,
    landingFee: 50, paxFee: 30,
    art: { length: 1.2, radius: 0.13, tall: 1.1, span: 1.5, chord: 0.0, sweep: 0, wing: 'high', engines: 'rotor',
      engineSize: 0.05, tail: 'normal', windowRows: 1, windows: 2, gear: 0.06 },
  },
];

export function aircraftIndex(id: string): number {
  return AIRCRAFT.findIndex((a) => a.id === id);
}

/**
 * Cartoon exaggeration: planes are drawn bigger than their "true" size so
 * they read well on a phone. Used by the art and by gameplay points (doors).
 */
export const ART_SCALE = 1.35;

const scaledArt: AircraftArt[] = AIRCRAFT.map((d) => ({
  ...d.art,
  length: d.art.length * ART_SCALE,
  radius: d.art.radius * ART_SCALE,
  span: d.art.span * ART_SCALE,
  chord: d.art.chord * ART_SCALE,
  sweep: d.art.sweep * ART_SCALE,
  engineSize: d.art.engineSize * ART_SCALE,
  gear: d.art.gear * ART_SCALE,
}));

/** Art dimensions as drawn on screen (scaled). */
export function planeArt(aircraft: number): AircraftArt {
  return scaledArt[aircraft] ?? scaledArt[0];
}
