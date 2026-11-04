/**
 * Terminal buildings (from the small airfield on): open-roofed, so you see
 * everything inside. A building is a footprint with walls (the back walls are
 * tall, the front ones low glass), doors, glass partitions between zones,
 * floors by zone and furniture. Passengers only cross walls through doors.
 * Coordinates are tiles; the apron is to the south (+y), the road to the east.
 */
import type { P2 } from './tiers';

export type ZoneKind = 'checkin' | 'security' | 'departures' | 'arrivals' | 'passport' | 'dutyFree' | 'food' | 'lounge' | 'gates' | 'customs';

export type Box = readonly [number, number, number, number];

/** A straight wall from a to b (along x or along y). */
export interface WallLine {
  a: P2;
  b: P2;
  /** back: tall outer wall with windows; front: low outer glass wall; glass: inner partition. */
  kind: 'back' | 'front' | 'glass';
}

export type DoorKind = 'entrance' | 'exit' | 'gate' | 'arrivals' | 'service';

export interface DoorDef {
  kind: DoorKind;
  /** Middle of the opening, on the wall line. */
  at: P2;
  /** Opening width (tiles). */
  width: number;
}

export type FurnitureKind =
  | 'seats'
  | 'board'
  | 'plant'
  | 'info'
  | 'wc'
  | 'bin'
  | 'atm'
  | 'water'
  | 'signCheckin'
  | 'signSecurity'
  | 'signGate'
  | 'signArrivals'
  | 'signExit'
  | 'signBaggage'
  | 'baggageRoom'
  // the big terminal (from the city airport on)
  | 'selfCheckin'
  | 'booth'
  | 'shelf'
  | 'till'
  | 'table'
  | 'foodStall'
  | 'sofa'
  | 'gateDesk'
  | 'customsDesk'
  | 'rental'
  | 'signDutyFree'
  | 'signFood'
  | 'signLounge'
  | 'signPassport'
  | 'signCustoms';

export interface Furniture {
  kind: FurnitureKind;
  at: P2;
  /** Row direction for seats (along x by default). */
  alongY?: boolean;
  /** Seats in the row; a variant for stalls and shelves. */
  n?: number;
  /** Only from this airport tier on (passport control at the international airport). */
  tier?: number;
}

export interface TerminalBuilding {
  /** Footprint x0, y0, x1, y1. */
  box: Box;
  zones: readonly { kind: ZoneKind; box: Box }[];
  partitions: readonly WallLine[];
  doors: readonly DoorDef[];
  furniture: readonly Furniture[];
  /** Height of the tall back walls (tiles of height). */
  height: number;
}

/** Doors of a building that people walk through (stations of the passenger flow). */
export interface TerminalDoors {
  /** From the curb into the check-in hall. */
  entrance: P2;
  /** From the arrivals hall out to the curb. */
  exit: P2;
  /** From the departures lounge out to the apron. */
  gate: P2;
  /** From the apron into the arrivals hall. */
  arrivals: P2;
}

/**
 * Terminal 1 (small airfield on): check-in hall at the back by the road,
 * security across the middle, the departures lounge (café, seats, the gate
 * door) and arrivals (carousel, exit to the curb) at the front by the apron.
 */
export const T1: TerminalBuilding = {
  box: [16.9, 12.6, 21.9, 19.5],
  height: 0.62,
  zones: [
    { kind: 'checkin', box: [16.9, 12.6, 21.9, 15.2] },
    { kind: 'security', box: [16.9, 15.2, 21.9, 17.0] },
    { kind: 'departures', box: [16.9, 17.0, 19.2, 19.5] },
    { kind: 'arrivals', box: [19.2, 17.0, 21.9, 19.5] },
  ],
  partitions: [
    // check-in | security: open in the middle (the queue line is the way through)
    { a: [16.9, 15.2], b: [17.25, 15.2], kind: 'glass' },
    { a: [21.55, 15.2], b: [21.9, 15.2], kind: 'glass' },
    // security | departures: the scanners are the way through
    { a: [16.9, 17.0], b: [17.3, 17.0], kind: 'glass' },
    // security | arrivals, and departures | arrivals: closed
    { a: [19.2, 17.0], b: [21.9, 17.0], kind: 'glass' },
    { a: [19.2, 17.0], b: [19.2, 19.5], kind: 'glass' },
  ],
  doors: [
    { kind: 'entrance', at: [21.9, 14.0], width: 0.8 },
    { kind: 'exit', at: [21.9, 17.75], width: 0.8 },
    { kind: 'gate', at: [18.75, 19.5], width: 0.8 },
    { kind: 'arrivals', at: [21.25, 19.5], width: 0.8 },
    { kind: 'service', at: [16.9, 15.4], width: 0.5 },
  ],
  furniture: [
    // departures lounge: rows of seats facing the apron, a water fountain, plants, a bin
    { kind: 'seats', at: [17.05, 17.95], n: 3 },
    { kind: 'seats', at: [17.05, 18.45], n: 3 },
    { kind: 'seats', at: [17.05, 18.95], n: 3 },
    { kind: 'board', at: [18.95, 17.2] },
    { kind: 'plant', at: [17.05, 19.3] },
    { kind: 'water', at: [19.0, 19.15] },
    { kind: 'bin', at: [18.45, 17.2] },

    // arrivals: restrooms, an ATM by the exit, a plant, a bin
    { kind: 'wc', at: [19.28, 17.08] },
    { kind: 'atm', at: [21.62, 18.35] },
    { kind: 'plant', at: [19.35, 19.3] },
    { kind: 'bin', at: [21.7, 19.2] },
    // check-in hall: departures board, information desk, plants
    { kind: 'board', at: [21.2, 12.75] },
    { kind: 'info', at: [21.35, 15.6] },
    { kind: 'plant', at: [17.05, 12.8] },
    { kind: 'plant', at: [21.75, 12.8] },
    { kind: 'bin', at: [20.05, 15.0] },
    // hanging signs over the way
    { kind: 'signCheckin', at: [20.3, 13.2] },
    { kind: 'signSecurity', at: [19.3, 15.4] },
    { kind: 'signGate', at: [18.75, 19.1] },
    { kind: 'signBaggage', at: [20.45, 17.35] },
    { kind: 'signExit', at: [21.55, 17.75] },
    { kind: 'signArrivals', at: [21.25, 19.15] },
    // the baggage room behind the west wall, where the belt goes
    { kind: 'baggageRoom', at: [15.5, 14.8] },
  ],
};

export const T1_DOORS: TerminalDoors = {
  entrance: [21.9, 14.0],
  exit: [21.9, 17.75],
  gate: [18.75, 19.5],
  arrivals: [21.25, 19.5],
};

/** The outer walls of a building with its door openings cut out, plus its partitions. */
export function buildingWalls(b: TerminalBuilding): WallLine[] {
  const [x0, y0, x1, y1] = b.box;
  const sides: WallLine[] = [
    { a: [x0, y0], b: [x1, y0], kind: 'back' },
    { a: [x0, y0], b: [x0, y1], kind: 'back' },
    { a: [x0, y1], b: [x1, y1], kind: 'front' },
    { a: [x1, y0], b: [x1, y1], kind: 'front' },
  ];
  const out: WallLine[] = [];
  for (const w of [...sides, ...b.partitions]) {
    const alongX = w.a[1] === w.b[1];
    const lo = alongX ? Math.min(w.a[0], w.b[0]) : Math.min(w.a[1], w.b[1]);
    const hi = alongX ? Math.max(w.a[0], w.b[0]) : Math.max(w.a[1], w.b[1]);
    const line = alongX ? w.a[1] : w.a[0];
    // door openings on this line
    const cuts = b.doors
      .filter((d) => (alongX ? Math.abs(d.at[1] - line) < 1e-6 : Math.abs(d.at[0] - line) < 1e-6))
      .map((d) => {
        const c = alongX ? d.at[0] : d.at[1];
        return [c - d.width / 2, c + d.width / 2] as const;
      })
      .filter(([a, c]) => c > lo && a < hi)
      .sort((p, q) => p[0] - q[0]);
    let from = lo;
    for (const [a, c] of cuts) {
      if (a > from + 1e-6) out.push(alongX ? { a: [from, line], b: [a, line], kind: w.kind } : { a: [line, from], b: [line, a], kind: w.kind });
      from = Math.max(from, c);
    }
    if (hi > from + 1e-6) out.push(alongX ? { a: [from, line], b: [hi, line], kind: w.kind } : { a: [line, from], b: [line, hi], kind: w.kind });
  }
  return out;
}

/** Does the step from p to q go through a wall? */
export function crossesWall(walls: readonly WallLine[], p: P2, q: P2): boolean {
  for (const w of walls) {
    const alongX = w.a[1] === w.b[1];
    if (alongX) {
      const y = w.a[1];
      if ((p[1] - y) * (q[1] - y) >= 0) continue;
      const t = (y - p[1]) / (q[1] - p[1]);
      const x = p[0] + (q[0] - p[0]) * t;
      if (x > Math.min(w.a[0], w.b[0]) + 1e-6 && x < Math.max(w.a[0], w.b[0]) - 1e-6) return true;
    } else {
      const x = w.a[0];
      if ((p[0] - x) * (q[0] - x) >= 0) continue;
      const t = (x - p[0]) / (q[0] - p[0]);
      const y = p[1] + (q[1] - p[1]) * t;
      if (y > Math.min(w.a[1], w.b[1]) + 1e-6 && y < Math.max(w.a[1], w.b[1]) - 1e-6) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ Terminal 3

/**
 * Terminal 3 (from the city airport on): the big main terminal north of the
 * gates, for the big jets. Landside along the north wall (the curb, the
 * garage); a check-in hall with two islands; security across it; then
 * passport control (international airport), a walk-through duty free and a
 * food court; along the south wall the concourse with the gate lounges, the
 * jet bridges and a business lounge. Arrivals on the east side: a corridor
 * from the concourse (passport control at the international airport), the
 * baggage hall with three carousels, customs and the arrivals hall.
 */
export const T3: TerminalBuilding = {
  box: [39.5, 8.0, 53.0, 17.3],
  height: 0.62,
  zones: [
    { kind: 'checkin', box: [39.5, 8.0, 47.5, 10.8] },
    { kind: 'arrivals', box: [47.5, 8.0, 53.0, 10.8] },
    { kind: 'security', box: [39.5, 10.8, 47.5, 13.2] },
    { kind: 'customs', box: [47.5, 10.8, 53.0, 13.2] },
    { kind: 'passport', box: [39.5, 13.2, 42.5, 15.8] },
    { kind: 'dutyFree', box: [42.5, 13.2, 46.5, 15.8] },
    { kind: 'food', box: [46.5, 13.2, 49.5, 15.8] },
    { kind: 'passport', box: [49.5, 13.2, 53.0, 15.8] },
    { kind: 'lounge', box: [39.5, 15.8, 41.6, 17.3] },
    { kind: 'gates', box: [41.6, 15.8, 53.0, 17.3] },
  ],
  partitions: [
    // check-in flows wide into security; the arrivals side is closed off, customs is the way out
    { a: [39.5, 10.8], b: [39.9, 10.8], kind: 'glass' },
    { a: [47.5, 10.8], b: [49.8, 10.8], kind: 'glass' },
    { a: [50.7, 10.8], b: [53.0, 10.8], kind: 'glass' },
    { a: [47.5, 8.0], b: [47.5, 13.2], kind: 'glass' },
    // security into the airside; the baggage hall opens to the arrivals corridor
    { a: [46.2, 13.2], b: [47.5, 13.2], kind: 'glass' },
    { a: [47.5, 13.2], b: [50.8, 13.2], kind: 'glass' },
    { a: [51.8, 13.2], b: [53.0, 13.2], kind: 'glass' },
    // passport | duty free | food court | arrivals corridor
    { a: [42.5, 13.65], b: [42.5, 14.4], kind: 'glass' },
    { a: [42.5, 15.4], b: [42.5, 15.8], kind: 'glass' },
    { a: [46.5, 13.2], b: [46.5, 13.6], kind: 'glass' },
    { a: [46.5, 14.6], b: [46.5, 15.8], kind: 'glass' },
    { a: [49.5, 13.2], b: [49.5, 15.8], kind: 'glass' },
    // the concourse: open from the food court, and into the arrivals corridor
    { a: [39.5, 15.8], b: [47.0, 15.8], kind: 'glass' },
    { a: [49.0, 15.8], b: [51.0, 15.8], kind: 'glass' },
    { a: [52.2, 15.8], b: [53.0, 15.8], kind: 'glass' },
    // the business lounge at the west end of the concourse
    { a: [41.6, 15.8], b: [41.6, 16.25], kind: 'glass' },
    { a: [41.6, 16.85], b: [41.6, 17.3], kind: 'glass' },
  ],
  doors: [
    { kind: 'entrance', at: [41.2, 8.0], width: 1.0 },
    { kind: 'entrance', at: [44.8, 8.0], width: 1.0 },
    { kind: 'exit', at: [49.6, 8.0], width: 1.0 },
    { kind: 'exit', at: [52.0, 8.0], width: 0.8 },
    { kind: 'service', at: [39.5, 9.0], width: 0.5 },
    // the jet bridges at the gates (G2, G1)
    { kind: 'gate', at: [44.0, 17.3], width: 0.5 },
    { kind: 'gate', at: [48.4, 17.3], width: 0.5 },
  ],
  furniture: [
    // check-in hall
    { kind: 'selfCheckin', at: [39.75, 8.25] },
    { kind: 'selfCheckin', at: [39.75, 8.75] },
    { kind: 'board', at: [42.75, 8.08] },
    { kind: 'board', at: [43.25, 8.08] },
    { kind: 'info', at: [46.9, 8.3] },
    { kind: 'plant', at: [43.15, 9.0] },
    { kind: 'plant', at: [47.2, 10.4] },
    { kind: 'bin', at: [43.0, 10.6] },
    { kind: 'signCheckin', at: [41.4, 9.95] },
    { kind: 'signCheckin', at: [45.1, 9.95] },
    { kind: 'signSecurity', at: [43.0, 11.0] },
    // passport control (international), duty free, the food court
    { kind: 'signPassport', at: [41.0, 13.35], tier: 5 },
    { kind: 'shelf', at: [42.8, 13.35], n: 0 },
    { kind: 'shelf', at: [43.7, 13.35], n: 1 },
    { kind: 'shelf', at: [44.6, 13.35], n: 2 },
    { kind: 'shelf', at: [45.5, 13.35], n: 3 },
    { kind: 'shelf', at: [43.4, 14.25], n: 2 },
    { kind: 'shelf', at: [44.6, 14.25], n: 0 },
    { kind: 'shelf', at: [45.6, 15.2], n: 1 },
    { kind: 'till', at: [45.9, 14.45] },
    { kind: 'signDutyFree', at: [44.5, 15.6] },
    { kind: 'foodStall', at: [46.65, 13.25], n: 0 },
    { kind: 'foodStall', at: [47.65, 13.25], n: 1 },
    { kind: 'foodStall', at: [48.65, 13.25], n: 2 },
    { kind: 'table', at: [46.9, 14.3] },
    { kind: 'table', at: [47.7, 14.3] },
    { kind: 'table', at: [48.5, 14.3] },
    { kind: 'table', at: [46.9, 15.1] },
    { kind: 'table', at: [48.5, 15.1] },
    { kind: 'signFood', at: [48.0, 15.6] },
    { kind: 'wc', at: [48.75, 15.15] },
    // the concourse: seats facing the apron, gate desks by the jet bridges, boards
    { kind: 'seats', at: [42.1, 16.35], n: 4 },
    { kind: 'seats', at: [42.1, 16.85], n: 4 },
    { kind: 'seats', at: [44.7, 16.35], n: 4 },
    { kind: 'seats', at: [44.7, 16.85], n: 4 },
    { kind: 'seats', at: [46.6, 16.35], n: 4 },
    { kind: 'seats', at: [46.6, 16.85], n: 4 },
    { kind: 'seats', at: [49.0, 16.35], n: 3 },
    { kind: 'gateDesk', at: [43.4, 16.95] },
    { kind: 'gateDesk', at: [47.8, 16.95] },
    { kind: 'board', at: [45.9, 15.95] },
    { kind: 'signGate', at: [44.0, 16.6] },
    { kind: 'signGate', at: [48.4, 16.6] },
    { kind: 'plant', at: [50.6, 16.9] },
    // the business lounge
    { kind: 'sofa', at: [39.75, 16.0] },
    { kind: 'sofa', at: [40.6, 16.0] },
    { kind: 'sofa', at: [39.75, 16.8] },
    { kind: 'plant', at: [41.2, 16.95] },
    { kind: 'signLounge', at: [41.6, 16.55] },
    // arrivals: the corridor (passport control at the international airport), baggage hall, customs, the hall
    { kind: 'signArrivals', at: [51.6, 16.4] },
    { kind: 'signPassport', at: [51.3, 14.0], tier: 5 },
    { kind: 'signBaggage', at: [51.3, 13.4] },
    { kind: 'customsDesk', at: [49.0, 10.95] },
    { kind: 'signCustoms', at: [50.25, 11.05] },
    { kind: 'rental', at: [52.3, 8.3] },
    { kind: 'atm', at: [47.75, 8.25] },
    { kind: 'board', at: [48.3, 8.08] },
    { kind: 'plant', at: [52.75, 10.5] },
    { kind: 'signExit', at: [49.6, 8.35] },
    { kind: 'signExit', at: [52.0, 8.35] },
    // the baggage hall outside the west wall
    { kind: 'baggageRoom', at: [38.2, 8.4] },
  ],
};

/** Where the carousels of Terminal 3 turn. */
export const T3_CAROUSELS: readonly P2[] = [
  [48.6, 12.05],
  [50.3, 12.05],
  [52.0, 12.05],
];
