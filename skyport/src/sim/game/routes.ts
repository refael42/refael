/**
 * Walking routes through the terminal building (from the small airfield on):
 * in and out of its doors, and from one zone to another without going
 * through a wall. Before there is a building (the dirt strip) every route is
 * a straight line, as it always was.
 */
import type { TerminalBuilding, ZoneKind } from '../../data/terminals';
import type { BigTerminal, P2, TierLayout } from '../../data/tiers';

/** The two sides of a door: a step outside it and a step inside it. */
export function doorSides(b: TerminalBuilding, d: P2, outStep = 0.45, inStep = 0.35): { out: P2; in: P2 } {
  const [x0, y0, x1, y1] = b.box;
  let nx = 0;
  let ny = 0;
  if (Math.abs(d[0] - x1) < 1e-6) nx = 1;
  else if (Math.abs(d[0] - x0) < 1e-6) nx = -1;
  else if (Math.abs(d[1] - y1) < 1e-6) ny = 1;
  else if (Math.abs(d[1] - y0) < 1e-6) ny = -1;
  return { out: [d[0] + nx * outStep, d[1] + ny * outStep], in: [d[0] - nx * inStep, d[1] - ny * inStep] };
}

/** The zone a point is in (null outside the building). */
export function zoneAt(b: TerminalBuilding, x: number, y: number): ZoneKind | null {
  const [x0, y0, x1, y1] = b.box;
  if (x < x0 || x > x1 || y < y0 || y > y1) return null;
  for (const z of b.zones) if (x >= z.box[0] && x <= z.box[2] && y >= z.box[1] && y <= z.box[3]) return z.kind;
  return null;
}

/** Flat [x, y, ...] points: from the curb in through the entrance (to the check-in hall). */
export function entranceRoute(L: TierLayout): number[] {
  const D = L.terminal.doors;
  if (!L.building || !D) return [];
  const s = doorSides(L.building, D.entrance);
  return [s.out[0], s.out[1], s.in[0], s.in[1]];
}

/** From the departures lounge out through the gate door onto the apron. */
export function gateRoute(L: TierLayout): number[] {
  const D = L.terminal.doors;
  if (!L.building || !D) return [];
  const s = doorSides(L.building, D.gate);
  return [s.in[0], s.in[1], s.out[0], s.out[1]];
}

/** From the apron in through the arrivals door. */
export function arrivalsRoute(L: TierLayout): number[] {
  const D = L.terminal.doors;
  if (!L.building || !D) return [];
  const s = doorSides(L.building, D.arrivals);
  return [s.out[0], s.out[1], s.in[0], s.in[1]];
}

/** From the arrivals hall out through the exit to the curb. */
export function exitRoute(L: TierLayout): number[] {
  const D = L.terminal.doors;
  if (!L.building || !D) return [];
  const s = doorSides(L.building, D.exit);
  return [s.in[0], s.in[1], s.out[0], s.out[1]];
}

/** Between a jet-bridge pier and the terminal: along the apron, clear of the buildings in between. */
export function pierWalk(L: TierLayout, gate: P2): number[] {
  const pier = (L.buildings ?? []).find((b) => b.kind === 'pier');
  if (!pier || !L.building) return [];
  const y = Math.max(...L.stands.filter((st) => st.size === 'small').map((st) => st.pos[1]), L.building.box[3]) - 1.95;
  return [pier.pos[0] - 0.6, y, gate[0], gate[1] + 0.4];
}

/**
 * A departing passenger whose flight left without them walks back out: from
 * the lounge across security, through the check-in hall and out of the
 * entrance (from outside the building, straight to the exit).
 */
export function homeRoute(L: TierLayout, x: number, y: number): number[] {
  const b = L.building;
  const D = L.terminal.doors;
  if (!b || !D) return [];
  const zone = zoneAt(b, x, y);
  const pts: number[] = [];
  if (zone === 'departures') pts.push(L.terminal.airside[0], L.terminal.airside[1]);
  if (zone === 'departures' || zone === 'security') {
    const q = L.terminal.securityQueue;
    const tail = q[q.length - 1];
    pts.push(tail[0], tail[1]);
  }
  if (zone) {
    const s = doorSides(b, D.entrance);
    pts.push(s.in[0], s.in[1], s.out[0], s.out[1]);
  }
  return pts;
}

/** A big terminal (3 or 4): back out from wherever a departing passenger is (their plane left without them). */
export function homeRoute3(T: BigTerminal | undefined, x: number, y: number): number[] {
  if (!T) return [];
  const zone = zoneAt(T.building, x, y);
  if (!zone) return [];
  const rank: Partial<Record<ZoneKind, number>> = { gates: 5, lounge: 5, station: 5, food: 4, dutyFree: 3, passport: 2, security: 1, checkin: 0 };
  const r = rank[zone] ?? 0;
  const st = T.st;
  const pts: number[] = [];
  if (r >= 5) pts.push(...(st.concourse ?? []).slice().reverse().flat());
  if (r >= 3) pts.push(...(st.dutyFree ?? []).slice().reverse().flat());
  if (r >= 2) pts.push(st.airside[0], st.airside[1]);
  if (r >= 1) {
    const q = st.securityQueue;
    pts.push(q[q.length - 1][0], q[q.length - 1][1]);
  }
  pts.push(...(st.lobby ?? []).flat());
  const ins = st.entrances ?? [st.doors!.entrance];
  const d = doorSides(T.building, ins[0]);
  pts.push(d.in[0], d.in[1], d.out[0], d.out[1]);
  return pts;
}
