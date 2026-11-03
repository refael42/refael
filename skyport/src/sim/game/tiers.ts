/**
 * Growing the airport: requirements, a construction project, and the
 * switch to the new layout at a quiet moment (no plane on the ground), so
 * no taxi route ever spans two maps. The new tier keeps every old node and
 * stand in place, so planes in the air and parked ones stay valid.
 */
import { layoutFor, nextTier, tierDef } from '../../data/tiers';
import { Big } from '../big';
import { pushEvent } from './events';
import { ensureHoldArrays } from './graph';
import { refreshApplicants } from './staff';
import { REJECT, type GameState } from './types';
import { applyStructural } from './upgrades';

export interface TierCheck {
  /** The next tier exists and is playable. */
  available: boolean;
  served: boolean;
  rating: boolean;
  money: boolean;
  busy: boolean;
  ok: boolean;
}

export function checkTier(s: GameState): TierCheck {
  const next = nextTier(s.tier);
  const available = !!next?.layout;
  const served = !!next && s.stats.served >= next.needs.served;
  const rating = !!next && s.rating >= next.needs.rating;
  const money = !!next && s.money.gte(next.needs.cost);
  const busy = s.tierBuild !== null || s.tierSwitch;
  return { available, served, rating, money, busy, ok: available && served && rating && money && !busy };
}

export function startTierBuild(s: GameState): number {
  const c = checkTier(s);
  const next = nextTier(s.tier);
  if (!next || !c.available || c.busy) return REJECT.limit;
  if (!c.served || !c.rating) return REJECT.needs;
  if (!c.money) return REJECT.noMoney;
  s.money = s.money.sub(Big.fromNumber(next.needs.cost));
  s.stats.spent = s.stats.spent.add(next.needs.cost);
  s.tierBuild = { to: next.id, remaining: next.buildSeconds, total: next.buildSeconds };
  pushEvent(s, 'tierBuildStart', 0, 0, next.id);
  return 0;
}

/** True while a plane is on the ground or about to be (approach, runway, taxiways, stands). */
function groundBusy(s: GameState): boolean {
  for (const f of s.flights) {
    if (f.phase === 'inbound' || f.phase === 'holding' || f.phase === 'diverted' || f.phase === 'goAround') continue;
    if (f.phase === 'takeoff' && f.z > 0.001) continue;
    return true;
  }
  return false;
}

export function updateTierBuild(s: GameState, dt: number): void {
  if (s.tierBuild) {
    s.tierBuild.remaining -= dt;
    if (s.tierBuild.remaining <= 0) {
      s.tierSwitch = true;
      pushEvent(s, 'tierBuildDone', 0, 0, s.tierBuild.to);
    }
  }
  if (s.tierSwitch && s.tierBuild && !groundBusy(s)) {
    const to = s.tierBuild.to;
    s.tierBuild = null;
    s.tierSwitch = false;
    switchTier(s, to);
  }
}

/** Moves the game onto the new tier's layout. Safe only with an empty ground. */
export function switchTier(s: GameState, to: number): void {
  s.tier = tierDef(to).id;
  ensureHoldArrays(s);
  for (let i = 0; i < s.edgeHold.length; i++) s.edgeHold[i] = 0;
  for (let i = 0; i < s.nodeHold.length; i++) s.nodeHold[i] = 0;
  s.upgRev++;
  applyStructural(s);
  const L = layoutFor(s.tier);
  for (const v of s.vehicles) {
    const h = v.kind === 'fuel' ? L.fuel.home : L.bags.home;
    if (v.state === 'idle') {
      v.x = v.px = h[0];
      v.y = v.py = h[1];
    }
  }
  refreshApplicants(s);
  pushEvent(s, 'tierUp', 0, 0, s.tier);
}

/** A tap on the big construction site speeds it up a little. */
export function rushTier(s: GameState): boolean {
  if (!s.tierBuild || s.tierBuild.remaining <= 0) return false;
  s.tierBuild.remaining = Math.max(0.05, s.tierBuild.remaining - Math.max(1, s.tierBuild.total * 0.02));
  return true;
}

// ------------------------------------------------------------- decorations

export const DECOR_IDS = ['kiosk', 'billboard', 'bench1', 'bench2'] as const;

export function decorPos(s: GameState, id: string): [number, number] {
  const L = layoutFor(s.tier);
  const saved = s.decor[id];
  if (saved) return saved;
  if (id === 'kiosk') return [L.decor.kiosk[0], L.decor.kiosk[1]];
  if (id === 'billboard') return [L.decor.billboard[0], L.decor.billboard[1]];
  const b = L.decor.benches[id === 'bench1' ? 0 : 1] ?? L.decor.benches[0];
  return [b[0], b[1]];
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Where a decoration may stand: inside the world, off runways, taxiways, stands and buildings. */
export function decorSpotOk(s: GameState, id: string, x: number, y: number): boolean {
  const L = layoutFor(s.tier);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < 1 || y < 1 || x > L.world.w - 2 || y > L.world.h - 2) return false;
  const inField = x > L.field.x0 + 0.4 && x < L.field.x1 - 0.6 && y > L.field.y0 + 0.4 && y < L.field.y1 - 0.6;
  // the billboard stands by the road, everything else inside the fence
  if (id !== 'billboard' && !inField) return false;
  for (const R of [L.runway, L.depRunway]) {
    if (R && x > R.x0 - 1.5 && x < R.x1 + 1.5 && Math.abs(y - R.y) < R.width / 2 + 1.1) return false;
  }
  for (const b of L.buildings ?? []) {
    if (x > b.pos[0] - 0.6 && x < b.pos[0] + b.size[0] + 0.6 && y > b.pos[1] - 0.6 && y < b.pos[1] + b.size[1] + 0.6) return false;
  }
  const nodes = L.taxi.nodes;
  for (const [a, b] of L.taxi.edges) {
    const A = nodes[a];
    const B = nodes[b];
    if (A && B && segDist(x, y, A[0], A[1], B[0], B[1]) < 1.0) return false;
  }
  for (const st of L.stands) {
    if (Math.hypot(x - st.pos[0], y - st.pos[1]) < 1.5) return false;
    const n = st.from ? nodes[st.from] : undefined;
    if (n && segDist(x, y, n[0], n[1], st.pos[0], st.pos[1]) < 1.0) return false;
  }
  if (x > L.hut[0] - 0.6 && x < L.hut[0] + 2.6 && y > L.hut[1] - 0.6 && y < L.hut[1] + 2.0) return false;
  if (Math.hypot(x - L.pump[0], y - L.pump[1]) < 1.2) return false;
  for (const r of L.road) if (Math.hypot(x - r[0], y - r[1]) < 0.9) return false;
  for (const other of DECOR_IDS) {
    if (other === id) continue;
    const p = decorPos(s, other);
    if (Math.hypot(x - p[0], y - p[1]) < 0.9) return false;
  }
  return true;
}

export function moveDecor(s: GameState, id: string, x: number, y: number): number {
  if (!(DECOR_IDS as readonly string[]).includes(id)) return REJECT.unknownFlight;
  const sx = Math.round(x * 2) / 2;
  const sy = Math.round(y * 2) / 2;
  if (!decorSpotOk(s, id, sx, sy)) return REJECT.badSpot;
  s.decor[id] = [sx, sy];
  pushEvent(s, 'decorMoved', sx, sy, 0);
  return 0;
}

export function cleanName(v: unknown): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24) : '';
}
