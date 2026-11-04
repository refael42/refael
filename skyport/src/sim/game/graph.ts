/**
 * Taxiway graph and reservations. Every edge is one-way and the ground flow
 * is a DAG (runway exit -> stands -> hold short), so waiting planes can never
 * form a cycle: there is no deadlock as long as each arrival has a reserved
 * stand and departures drain through the runway.
 *
 * A plane may enter an edge only after reserving it together with its end
 * node; it releases them once its tail has cleared the end node.
 */
import { layoutFor, type TierLayout } from '../../data/tiers';
import { chaikin, type Path } from './path';
import type { Flight, GameState } from './types';

export interface GraphEdge {
  from: number;
  to: number;
  len: number;
}

/** One direction of operations: where arrivals leave the runway, where departures wait, which edges are waiting spots. */
export interface Flow {
  exits: number[];
  /** Exit node a plane takes for each stand (-1 for a helipad). */
  standExit: number[];
  holdShort: number;
  /**
   * Edges a plane may wait on: neither the edge nor its end node is used by
   * any arrival route of this direction.
   */
  safe: boolean[];
}

export interface Graph {
  ids: string[];
  pos: [number, number][];
  edges: GraphEdge[];
  out: number[][];
  /** Graph node of each stand (-1 for a helipad, which is not on the taxiways). */
  standNode: number[];
  /** First runway exit (small planes); every exit, nearest first. */
  exit: number;
  exits: number[];
  /** Exit node a plane takes for each stand (-1 for a helipad). */
  standExit: number[];
  holdShort: number;
  /**
   * Edges a plane may wait on: neither the edge nor its end node is used by
   * any arrival route. Departures never stop anywhere else (holding area rule).
   */
  safe: boolean[];
  /** Per runway direction (1 = toward +x, -1 = the other way when the layout has one). */
  flows: Map<number, Flow>;
}

const cache = new Map<number, Graph>();

/** The operations for a runway direction (falls back to the normal one). */
export function flowOf(g: Graph, dir: number): Flow {
  return g.flows.get(dir) ?? (g.flows.get(1) as Flow);
}

export function graphOf(tier: number): Graph {
  const hit = cache.get(tier);
  if (hit) return hit;
  const g = buildGraph(layoutFor(tier));
  cache.set(tier, g);
  return g;
}

function buildGraph(L: TierLayout): Graph {
  const ids: string[] = [];
  const pos: [number, number][] = [];
  const index = new Map<string, number>();
  const addNode = (id: string, p: readonly [number, number]) => {
    index.set(id, ids.length);
    ids.push(id);
    pos.push([p[0], p[1]]);
  };
  for (const [id, p] of Object.entries(L.taxi.nodes)) addNode(id, p);
  if (L.rev) for (const [id, p] of Object.entries(L.rev.nodes)) if (!index.has(id)) addNode(id, p);
  for (const st of L.stands) if (st.from && st.to) addNode(st.id, st.pos);
  const edges: GraphEdge[] = [];
  const addEdge = (a: string, b: string) => {
    const from = index.get(a);
    const to = index.get(b);
    if (from === undefined || to === undefined) throw new Error(`bad edge ${a}->${b}`);
    edges.push({ from, to, len: Math.hypot(pos[to][0] - pos[from][0], pos[to][1] - pos[from][1]) });
  };
  for (const [a, b] of L.taxi.edges) addEdge(a, b);
  if (L.rev) for (const [a, b] of L.rev.edges) addEdge(a, b);
  for (const st of L.stands) {
    if (!st.from || !st.to) continue;
    addEdge(st.from, st.id);
    addEdge(st.id, st.to);
  }
  const out: number[][] = ids.map(() => []);
  edges.forEach((e, i) => out[e.from].push(i));
  const g: Graph = {
    ids,
    pos,
    edges,
    out,
    standNode: L.stands.map((st) => index.get(st.id) ?? -1),
    exit: index.get(L.taxi.exit) as number,
    exits: (L.taxi.exits ?? [L.taxi.exit]).map((id) => {
      const n = index.get(id);
      if (n === undefined) throw new Error(`unknown exit ${id}`);
      return n;
    }),
    standExit: [],
    holdShort: index.get(L.taxi.holdShort) as number,
    safe: [],
    flows: new Map(),
  };
  const node = (id: string) => {
    const n = index.get(id);
    if (n === undefined) throw new Error(`unknown node ${id}`);
    return n;
  };
  g.flows.set(1, buildFlow(g, g.exits, g.holdShort));
  if (L.rev) g.flows.set(-1, buildFlow(g, [node(L.rev.exit)], node(L.rev.holdShort)));
  const fwd = g.flows.get(1) as Flow;
  g.standExit = fwd.standExit;
  g.safe = fwd.safe;
  return g;
}

function buildFlow(g: Graph, exits: number[], holdShort: number): Flow {
  // each stand is reached from the nearest exit that leads to it
  const standExit = g.standNode.map((sn) => {
    if (sn < 0) return -1;
    for (const ex of exits) if (findRoute(g, ex, sn)) return ex;
    throw new Error('stand unreachable from every runway exit');
  });
  // everything an arrival may touch on its way to any stand
  const arrivalEdges = new Set<number>();
  const arrivalNodes = new Set<number>(exits);
  for (let i = 0; i < g.standNode.length; i++) {
    const sn = g.standNode[i];
    if (sn < 0) continue;
    const r = findRoute(g, standExit[i], sn);
    if (!r) throw new Error('stand unreachable from the runway exit');
    for (const e of r) {
      arrivalEdges.add(e);
      arrivalNodes.add(g.edges[e].from);
      // stand nodes are private to the parked plane, not shared lane
      if (!g.standNode.includes(g.edges[e].to)) arrivalNodes.add(g.edges[e].to);
    }
  }
  const safe = g.edges.map((e, i) => !arrivalEdges.has(i) && !arrivalNodes.has(e.to));
  return { exits, standExit, holdShort, safe };
}

/**
 * Last route index of a run that starts at `from` and must not end on the
 * shared lane: through the shared edges to the next waiting spot, and on
 * along waiting edges until the whole tail (`tail` long) fits there.
 */
/** How much shorter than its straight length an edge can be to drive, once the corners are rounded. */
const CORNER_SLACK = 0.5;

export function safeRunEnd(g: Graph, flow: Flow, route: number[], from: number, tail: number): number {
  const n = route.length;
  let j = from;
  while (j < n - 1 && !flow.safe[route[j]]) j++;
  // (a plane stops a little short of an edge it can't enter: count that gap too; and the route
  // rounds the corners, so an edge is a little shorter to drive than its straight length)
  let room = flow.safe[route[j]] ? g.edges[route[j]].len : 0;
  while (j < n - 1 && room < tail + STOP_GAP + CORNER_SLACK && flow.safe[route[j + 1]]) {
    j++;
    room += g.edges[route[j]].len;
  }
  return j;
}

/** Index of the first edge in a route where a plane may stop and wait (-1 none). */
export function firstSafe(g: Pick<Graph, 'safe'> | Flow, route: number[]): number {
  for (let i = 0; i < route.length; i++) if (g.safe[route[i]]) return i;
  return -1;
}

/**
 * Shortest route (edge ids) from node a to node b. Stand nodes are only
 * passed through when they are the start or the goal.
 */
export function findRoute(g: Graph, a: number, b: number): number[] | null {
  const n = g.ids.length;
  const dist = new Array<number>(n).fill(Infinity);
  const via = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  const isStand = new Set(g.standNode);
  dist[a] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) return null;
    if (u === b) break;
    done[u] = true;
    if (u !== a && isStand.has(u)) continue;
    for (const e of g.out[u]) {
      const v = g.edges[e].to;
      const d = dist[u] + g.edges[e].len;
      if (d < dist[v]) {
        dist[v] = d;
        via[v] = e;
      }
    }
  }
  const route: number[] = [];
  for (let v = b; v !== a; v = g.edges[via[v]].from) route.unshift(via[v]);
  return route;
}

export interface GroundRoute {
  edges: number[];
  path: Path;
  /** Distance along the smoothed path where each route node sits (edges.length + 1 entries). */
  nodeDist: number[];
}

/** Smooth path through the route nodes plus where each node falls on it. */
export function routeGeometry(g: Graph, edges: number[], startPoint?: readonly [number, number]): GroundRoute {
  const nodes = [g.edges[edges[0]].from, ...edges.map((e) => g.edges[e].to)];
  const raw: Path = [];
  nodes.forEach((n, i) => {
    const p = i === 0 && startPoint ? startPoint : g.pos[n];
    raw.push(p[0], p[1], 0);
  });
  const path = chaikin(raw, 3);
  const cum: number[] = [0];
  for (let i = 3; i < path.length; i += 3) cum.push(cum[cum.length - 1] + Math.hypot(path[i] - path[i - 3], path[i + 1] - path[i - 2]));
  const nodeDist = nodes.map((n, k) => {
    if (k === 0) return 0;
    if (k === nodes.length - 1) return cum[cum.length - 1];
    const [nx, ny] = g.pos[n];
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < cum.length; i++) {
      const d = Math.hypot(path[i * 3] - nx, path[i * 3 + 1] - ny);
      if (d < bd) {
        bd = d;
        best = cum[i];
      }
    }
    return best;
  });
  return { edges, path, nodeDist };
}

// ------------------------------------------------------------ reservations

export function ensureHoldArrays(s: GameState): void {
  const g = graphOf(s.tier);
  if (s.edgeHold.length !== g.edges.length) s.edgeHold = new Array(g.edges.length).fill(0);
  if (s.nodeHold.length !== g.ids.length) s.nodeHold = new Array(g.ids.length).fill(0);
}

export function tryReserve(s: GameState, f: Flight, e: number): boolean {
  const g = graphOf(s.tier);
  const to = g.edges[e].to;
  const eh = s.edgeHold[e];
  const nh = s.nodeHold[to];
  if ((eh !== 0 && eh !== f.id) || (nh !== 0 && nh !== f.id)) return false;
  s.edgeHold[e] = f.id;
  s.nodeHold[to] = f.id;
  if (!f.gHeld.includes(e)) f.gHeld.push(e);
  return true;
}

export function releaseEdge(s: GameState, f: Flight, e: number): void {
  const g = graphOf(s.tier);
  if (s.edgeHold[e] === f.id) s.edgeHold[e] = 0;
  const to = g.edges[e].to;
  if (s.nodeHold[to] === f.id) s.nodeHold[to] = 0;
  const i = f.gHeld.indexOf(e);
  if (i >= 0) f.gHeld.splice(i, 1);
}

export function releaseNode(s: GameState, f: Flight, n: number): void {
  if (n >= 0 && s.nodeHold[n] === f.id) s.nodeHold[n] = 0;
}

/** Reserves route[0..last] all at once, or nothing. */
export function tryReserveRun(s: GameState, f: Flight, route: number[], last: number): boolean {
  const g = graphOf(s.tier);
  for (let i = 0; i <= last; i++) {
    const e = route[i];
    const eh = s.edgeHold[e];
    const nh = s.nodeHold[g.edges[e].to];
    if ((eh !== 0 && eh !== f.id) || (nh !== 0 && nh !== f.id)) return false;
  }
  for (let i = 0; i <= last; i++) tryReserve(s, f, route[i]);
  return true;
}

/** Drops every reservation a flight holds (it left the ground graph). */
export function releaseAll(s: GameState, f: Flight): void {
  for (let i = 0; i < s.edgeHold.length; i++) if (s.edgeHold[i] === f.id) s.edgeHold[i] = 0;
  for (let i = 0; i < s.nodeHold.length; i++) if (s.nodeHold[i] === f.id) s.nodeHold[i] = 0;
  f.gHeld.length = 0;
}

/** Seconds-free check used by the rollout: can the plane leave the runway? */
export function canEnter(s: GameState, f: Flight, e: number): boolean {
  const g = graphOf(s.tier);
  const eh = s.edgeHold[e];
  const nh = s.nodeHold[g.edges[e].to];
  return (eh === 0 || eh === f.id) && (nh === 0 || nh === f.id);
}

const LOOKAHEAD = 1.6;
const STOP_GAP = 0.25;

/**
 * Moves a flight along its ground route, reserving ahead and stopping before
 * edges it cannot get. Returns true when the end of the route is reached.
 */
export function groundMove(s: GameState, f: Flight, dt: number, maxSpeed: number, tailClear: number, runs: Flow | null = null): boolean {
  const r = f.groute;
  if (!r) return true;
  const n = r.edges.length;
  const total = r.nodeDist[n];
  // the current edge must be ours before moving at all
  if (!f.gHeld.includes(r.edges[f.gIdx]) && !tryReserve(s, f, r.edges[f.gIdx])) {
    f.speed = 0;
    f.gWaiting = true;
    return false;
  }
  let stopAt = total;
  f.gWaiting = false;
  for (let k = f.gIdx + 1; k < n; k++) {
    const start = r.nodeDist[k];
    if (start - f.pathPos > LOOKAHEAD) break;
    if (f.gHeld.includes(r.edges[k])) continue;
    let ok: boolean;
    if (runs && !runs.safe[r.edges[k]] && runs.safe[r.edges[k - 1]]) {
      // leaving a waiting spot into a shared stretch: take all of it up to the next spot at once,
      // so a departure never stops where arrivals have to pass
      // (and far enough in that the tail is off the shared lane too)
      const j = safeRunEnd(graphOf(s.tier), runs, r.edges, k, tailClear);
      ok = tryReserveRun(s, f, r.edges.slice(k), j - k);
    } else ok = tryReserve(s, f, r.edges[k]);
    if (!ok) {
      stopAt = Math.max(f.pathPos, start - STOP_GAP);
      f.gWaiting = true;
      break;
    }
  }
  const left = stopAt - f.pathPos;
  const target = left <= 0 ? 0 : maxSpeed * Math.max(0.25, Math.min(1, left / 0.7));
  // ease the speed (accelerate gently, brake firmly)
  f.speed = f.speed < target ? Math.min(target, f.speed + 1.6 * dt) : target;
  f.pathPos = Math.min(stopAt, f.pathPos + f.speed * dt);
  while (f.gIdx + 1 < n && f.pathPos >= r.nodeDist[f.gIdx + 1]) f.gIdx++;
  // release what the tail has cleared
  if (f.gStart >= 0 && f.pathPos > tailClear) {
    releaseNode(s, f, f.gStart);
    f.gStart = -1;
  }
  for (let j = 0; j < f.gIdx; j++) {
    const e = r.edges[j];
    if (f.gHeld.includes(e) && f.pathPos - r.nodeDist[j + 1] > tailClear) releaseEdge(s, f, e);
  }
  return f.pathPos >= total - 1e-6;
}
