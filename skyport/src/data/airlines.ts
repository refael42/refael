/** Fictional airlines only: original names, codes and liveries. */
export type AirlineKind = 'lowcost' | 'regional' | 'flag' | 'cargo' | 'luxury' | 'charter' | 'private';

export interface Livery {
  body: string;
  belly: string;
  tail: string;
  stripe: string;
  accent: string;
  wing: string;
  engine: string;
}

/** Facilities some airlines insist on (built in later milestones). */
export type AirlineNeed = 'jetBridge' | 'lounge' | 'cargoApron' | 'fbo';

/** How each kind of airline behaves under contract. */
export interface AirlineKindDef {
  /** Multiplier on everything its flights pay. */
  pay: number;
  /** Flights per game day in a typical offer, added per expansion, and the most it will fly. */
  perDay: number;
  step: number;
  maxPerDay: number;
  /** Multiplier on the aircraft's turnaround allowance (low-cost wants it quick). */
  turnaround: number;
  /** On-time goal written into the contract. */
  goal: number;
  /** Loyal airlines forgive more: reputation losses are divided by this. */
  loyalty: number;
  /** Contract length in game days (0 = open-ended; charters are seasonal). */
  days: number;
  needs: readonly AirlineNeed[];
}

export const AIRLINE_KINDS: Readonly<Record<AirlineKind, AirlineKindDef>> = {
  lowcost: { pay: 0.85, perDay: 8, step: 3, maxPerDay: 18, turnaround: 0.9, goal: 0.75, loyalty: 0.8, days: 0, needs: [] },
  regional: { pay: 1, perDay: 7, step: 2, maxPerDay: 14, turnaround: 1, goal: 0.7, loyalty: 1.3, days: 0, needs: [] },
  flag: { pay: 1.6, perDay: 6, step: 2, maxPerDay: 12, turnaround: 1, goal: 0.85, loyalty: 1, days: 0, needs: ['jetBridge', 'lounge'] },
  cargo: { pay: 1.4, perDay: 4, step: 1, maxPerDay: 8, turnaround: 1, goal: 0.8, loyalty: 1, days: 0, needs: ['cargoApron'] },
  luxury: { pay: 3, perDay: 2, step: 1, maxPerDay: 4, turnaround: 1.1, goal: 0.9, loyalty: 0.7, days: 0, needs: ['fbo'] },
  charter: { pay: 1.25, perDay: 5, step: 2, maxPerDay: 10, turnaround: 1, goal: 0.75, loyalty: 1, days: 3, needs: [] },
  private: { pay: 1.8, perDay: 3, step: 1, maxPerDay: 6, turnaround: 1, goal: 0.7, loyalty: 1.1, days: 0, needs: [] },
};

export const AIRLINE_KIND_IDS = Object.keys(AIRLINE_KINDS) as AirlineKind[];

export interface AirlineDef {
  id: string;
  /** Three-letter flight code prefix. */
  code: string;
  /** Brand name, shown as-is in every language. */
  name: string;
  kind: AirlineKind;
  unlockTier: number;
  /** Aircraft ids it flies. */
  fleet: readonly string[];
  /** Relative chance to appear when several airlines are available. */
  weight: number;
  livery: Livery;
}

export const AIRLINES: readonly AirlineDef[] = [
  {
    id: 'meadowlark', code: 'MLK', name: 'Meadowlark Air', kind: 'regional', unlockTier: 1, fleet: ['sparrow', 'finch', 'heron'], weight: 3,
    livery: { body: '#f4f1e8', belly: '#d9d4c6', tail: '#2f9e6b', stripe: '#f2a43a', accent: '#ffd266', wing: '#e6e2d6', engine: '#cfc9b9' },
  },
  {
    id: 'puddle', code: 'PDJ', name: 'Puddle Jumpers', kind: 'private', unlockTier: 1, fleet: ['sparrow'], weight: 2,
    livery: { body: '#e8473f', belly: '#f3efe6', tail: '#f3efe6', stripe: '#f7c548', accent: '#1f3a5f', wing: '#f3efe6', engine: '#d8d2c4' },
  },
  {
    id: 'bluefin', code: 'BFX', name: 'Bluefin Express', kind: 'lowcost', unlockTier: 2, fleet: ['finch', 'heron', 'falcon'], weight: 3,
    livery: { body: '#f7f9fc', belly: '#dfe6ef', tail: '#1f6fd1', stripe: '#38b6ff', accent: '#ffe04a', wing: '#e3e9f2', engine: '#1f6fd1' },
  },
  {
    id: 'sunhop', code: 'SNH', name: 'Sunhop', kind: 'charter', unlockTier: 3, fleet: ['heron', 'swift', 'falcon'], weight: 2,
    livery: { body: '#fff8ec', belly: '#f1e5cf', tail: '#ff8a1f', stripe: '#ffcf3a', accent: '#d9381e', wing: '#efe7d8', engine: '#ff8a1f' },
  },
  {
    id: 'aurelia', code: 'AUR', name: 'Aurelia Air', kind: 'flag', unlockTier: 4, fleet: ['falcon', 'falconx', 'albatross', 'condor'], weight: 2,
    livery: { body: '#fbfbfd', belly: '#1d2a4d', tail: '#1d2a4d', stripe: '#c9a646', accent: '#c9a646', wing: '#e4e6ec', engine: '#1d2a4d' },
  },
  {
    id: 'ironbird', code: 'IBC', name: 'Ironbird Cargo', kind: 'cargo', unlockTier: 4, fleet: ['pelican'], weight: 1,
    livery: { body: '#d6d9de', belly: '#a9aeb6', tail: '#c4302b', stripe: '#3a3f47', accent: '#ffffff', wing: '#c3c7cd', engine: '#3a3f47' },
  },
  {
    id: 'velvet', code: 'VLV', name: 'Velvetjet', kind: 'luxury', unlockTier: 3, fleet: ['kestrel', 'dragonfly'], weight: 1,
    livery: { body: '#2b1b3d', belly: '#1a1026', tail: '#2b1b3d', stripe: '#d4af7a', accent: '#d4af7a', wing: '#3a2a4f', engine: '#d4af7a' },
  },
  {
    id: 'coralina', code: 'CRN', name: 'Coralina', kind: 'lowcost', unlockTier: 4, fleet: ['falcon', 'falconx'], weight: 2,
    livery: { body: '#ffffff', belly: '#ffe3dc', tail: '#ff5f6d', stripe: '#ff9a8b', accent: '#5b2a86', wing: '#f1e6e4', engine: '#ff5f6d' },
  },
  {
    id: 'cloudberry', code: 'CBR', name: 'Cloudberry Air', kind: 'regional', unlockTier: 2, fleet: ['sparrow', 'finch', 'swift'], weight: 2,
    livery: { body: '#fbf7fb', belly: '#e9dde9', tail: '#b0306a', stripe: '#f08cb4', accent: '#ffd3e4', wing: '#ece4ec', engine: '#b0306a' },
  },
  {
    id: 'paperkite', code: 'PKT', name: 'Paperkite', kind: 'charter', unlockTier: 2, fleet: ['finch'], weight: 2,
    livery: { body: '#fffdf5', belly: '#eee9d6', tail: '#14a3a3', stripe: '#ffb627', accent: '#ff6b35', wing: '#efebdd', engine: '#14a3a3' },
  },
];

export function airlineIndex(id: string): number {
  return AIRLINES.findIndex((a) => a.id === id);
}
