/**
 * Cleanliness (from the small airfield on). Passengers drop litter on the busy
 * floors of the terminals (the clean areas: lounges, food courts, gate
 * lounges, the halls), less with more bins. Each cleaner looks after one area:
 * walks to the nearest piece and picks it up, or makes rounds; one whose area
 * stays clean moves on to the dirtiest area nobody looks after. Dirty floors
 * put the passengers in a bad mood. Deterministic and transient.
 */
import { STAFF_ROLES } from '../../data/staff';
import type { Box } from '../../data/terminals';
import type { TierLayout } from '../../data/tiers';
import { hash01 } from '../hash';
import { layoutOf } from './layout';
import type { GameState, Sweeper } from './types';
import { effectValue } from './upgrades';

/** Most litter one area holds (and how much makes the airport count as a mess). */
export const AREA_CAP = 8;
/** Chance a passenger drops something, per second spent on a busy floor. */
const DROP_RATE = 0.0035;
const SPEED = 0.85;
/** Seconds bent down picking a piece up. */
const PICK_SECONDS = 0.8;
/** An area clean this long sends its cleaner on to a dirtier one. */
const IDLE_MOVE = 25;

const CLEANER = STAFF_ROLES.findIndex((r) => r.id === 'cleaner');

const areaCache = new WeakMap<TierLayout, Box[]>();

/** Every clean area of the airport (Terminal 1, Terminal 3, Concourse D, Terminal 4). */
export function cleanAreas(L: TierLayout): Box[] {
  const hit = areaCache.get(L);
  if (hit) return hit;
  const out = [L.building, L.t3?.building, L.sat?.building, L.t4?.building].flatMap((b) => [...(b?.cleanAreas ?? [])]);
  areaCache.set(L, out);
  return out;
}

/** 1 spotless .. 0 a mess. */
export function cleanliness(s: GameState): number {
  const n = cleanAreas(layoutOf(s.tier)).length;
  if (n === 0) return 1;
  return Math.max(0, Math.min(1, 1 - s.litter.length / (n * AREA_CAP * 0.6)));
}

function inside(b: Box, x: number, y: number): boolean {
  return x > b[0] && x < b[2] && y > b[1] && y < b[3];
}

/** A point on the round of an area (its edge, a little inside), t in 0..1. */
function roundPoint(b: Box, t: number): [number, number] {
  const x0 = b[0] + 0.15;
  const y0 = b[1] + 0.15;
  const w = b[2] - b[0] - 0.3;
  const h = b[3] - b[1] - 0.3;
  let d = (((t % 1) + 1) % 1) * 2 * (w + h);
  if (d < w) return [x0 + d, y0];
  d -= w;
  if (d < h) return [x0 + w, y0 + d];
  d -= h;
  if (d < w) return [x0 + w - d, y0 + h];
  d -= w;
  return [x0, y0 + h - d];
}

function litterIn(s: GameState, area: number): number {
  let n = 0;
  for (const l of s.litter) if (l.area === area) n++;
  return n;
}

/** The dirtiest area nobody looks after (the first one when all are clean). */
function pickArea(s: GameState, areas: readonly Box[], taken: Set<number>): number {
  let best = -1;
  let most = -1;
  for (let a = 0; a < areas.length; a++) {
    if (taken.has(a)) continue;
    const n = litterIn(s, a);
    if (n > most) {
      most = n;
      best = a;
    }
  }
  return best;
}

function place(w: Sweeper, b: Box): void {
  const [x, y] = roundPoint(b, w.round);
  w.x = x;
  w.y = y;
  w.px = x;
  w.py = y;
}

export function updateCleaning(s: GameState, dt: number): void {
  const L = layoutOf(s.tier);
  const areas = cleanAreas(L);
  if (areas.length === 0) {
    s.litter.length = 0;
    s.sweepers.length = 0;
    return;
  }
  // (after a tier change the areas are new)
  if (s.litter.some((l) => l.area >= areas.length)) s.litter = [];
  // once a second: passengers on the busy floors drop things
  if (s.tick % 30 === 0) {
    const sec = Math.floor(s.time);
    const chance = DROP_RATE * (1 - Math.min(0.75, effectValue(s, 'litter')));
    for (const p of s.people) {
      if (p.moving) continue;
      if (hash01(p.id * 977 + sec * 131) >= chance * p.n) continue;
      for (let a = 0; a < areas.length; a++) {
        if (!inside(areas[a], p.x, p.y)) continue;
        if (litterIn(s, a) >= AREA_CAP) break;
        const b = areas[a];
        // (a little way off, where it shows, not under their feet)
        const ang = hash01(p.id + sec) * Math.PI * 2;
        const r = 0.3 + hash01(p.id * 3 + sec) * 0.25;
        s.litter.push({ id: s.nextId++, area: a, x: Math.max(b[0] + 0.1, Math.min(b[2] - 0.1, p.x + Math.cos(ang) * r)), y: Math.max(b[1] + 0.1, Math.min(b[3] - 0.1, p.y + Math.sin(ang) * r)) });
        break;
      }
    }
  }
  // one sweeper for each cleaner at work
  const working = s.staff.filter((m) => m.role === CLEANER);
  const ids = new Set(working.map((m) => m.id));
  if (s.sweepers.some((w) => !ids.has(w.staffId) || w.area >= areas.length)) s.sweepers = s.sweepers.filter((w) => ids.has(w.staffId) && w.area < areas.length);
  for (const m of working) {
    if (s.sweepers.some((w) => w.staffId === m.id)) continue;
    const area = pickArea(s, areas, new Set(s.sweepers.map((w) => w.area)));
    if (area < 0) continue;
    const w: Sweeper = { staffId: m.id, area, x: 0, y: 0, px: 0, py: 0, heading: 0, target: 0, round: hash01(m.id), until: 0 };
    place(w, areas[area]);
    s.sweepers.push(w);
  }
  for (const w of s.sweepers) {
    w.px = w.x;
    w.py = w.y;
    const m = s.staff.find((x) => x.id === w.staffId);
    if (!m || m.breakUntil > s.time || w.until > s.time) continue;
    const b = areas[w.area];
    let goal: [number, number] | null = null;
    let piece = w.target ? s.litter.find((l) => l.id === w.target) : undefined;
    if (!piece) {
      w.target = 0;
      // the nearest piece in this area
      let best = Infinity;
      for (const l of s.litter) {
        if (l.area !== w.area) continue;
        const d = Math.hypot(l.x - w.x, l.y - w.y);
        if (d < best) {
          best = d;
          piece = l;
        }
      }
      if (piece) w.target = piece.id;
    }
    if (piece) {
      goal = [piece.x, piece.y];
      w.round = s.time;
    } else {
      // all clean: a round of the area; clean long enough, on to a dirtier one nobody looks after
      if (s.time - w.round > IDLE_MOVE) {
        const next = pickArea(s, areas, new Set(s.sweepers.filter((o) => o !== w).map((o) => o.area)));
        if (next >= 0 && next !== w.area && litterIn(s, next) >= 2) {
          w.area = next;
          place(w, areas[next]);
          w.round = s.time;
          continue;
        }
      }
      goal = roundPoint(b, (s.time * SPEED) / (2 * (b[2] - b[0] + b[3] - b[1])) + hash01(w.staffId));
    }
    const dx = goal[0] - w.x;
    const dy = goal[1] - w.y;
    const d = Math.hypot(dx, dy);
    const step = SPEED * dt;
    if (d > 1e-6) w.heading = Math.atan2(dy, dx);
    if (d <= step) {
      w.x = goal[0];
      w.y = goal[1];
      if (piece) {
        s.litter = s.litter.filter((l) => l !== piece);
        w.target = 0;
        w.until = s.time + PICK_SECONDS;
      }
    } else {
      w.x += (dx / d) * step;
      w.y += (dy / d) * step;
    }
  }
}
