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
    id: 'meadowlark', code: 'MLK', name: 'Meadowlark Air', kind: 'regional', unlockTier: 1, fleet: ['sparrow', 'finch'], weight: 3,
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
];

export function airlineIndex(id: string): number {
  return AIRLINES.findIndex((a) => a.id === id);
}
