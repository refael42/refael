/** Writes the game state into the frame snapshot (JS thread, every frame). */
import { planeArt } from '../data/aircraft';
import { FUEL, PST, WANT, type Flight, type GameState } from '../sim/game/types';
import type { IconName } from './art/icons';
import type { Camera } from './camera';
import type { Effects } from './effects';
import { isoX, isoY, Z_PX } from './iso';
import type { SnapWriter } from './scene';
import { dirIndex, type SpriteSet } from './sprites';
import type { World } from './world';

const WANT_ICON: Record<number, IconName> = {
  [WANT.clearLanding]: 'land',
  [WANT.fuel]: 'fuel',
  [WANT.board]: 'pax',
  [WANT.clearTakeoff]: 'takeoff',
};

/** Screen position of a flight's bubble (world-screen px), used for taps too. */
export function bubbleAnchor(f: { x: number; y: number; z: number; aircraft: number }, zoom: number): { x: number; y: number } {
  const art = planeArt(f.aircraft);
  const top = (art.radius * 2 * art.tall + art.gear + 0.25) * Z_PX;
  return { x: isoX(f.x, f.y), y: isoY(f.x, f.y, f.z) - top - 26 / zoom };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface DrawOptions {
  selected: number;
  /** Interpolation between the previous and current sim step (0..1). */
  alpha: number;
  time: number;
  /** View px covered by the HUD at the top / UI at the bottom. */
  safeTop: number;
  safeBottom: number;
}

/** Edge markers for flights that need you but are off screen (view px). */
export interface Indicator {
  id: number;
  vx: number;
  vy: number;
}

export function drawGame(
  w: SnapWriter,
  s: GameState,
  sp: SpriteSet,
  world: World,
  cam: Camera,
  fx: Effects,
  o: DrawOptions,
  indicators: Indicator[],
): void {
  const zoom = cam.zoom;
  const inv = 1 / zoom;
  const vx0 = cam.x - cam.viewW / 2 / zoom;
  const vx1 = cam.x + cam.viewW / 2 / zoom;
  const vy0 = cam.y - cam.viewH / 2 / zoom;
  const vy1 = cam.y + cam.viewH / 2 / zoom;
  const visible = (x: number, y: number, r: number) => x + r > vx0 && x - r < vx1 && y + r * 1.4 > vy0 && y - r * 0.6 < vy1;
  const a = o.alpha;

  // statics
  for (const st of world.statics) if (visible(st.x, st.y, st.r)) w.sprite(st.sprite, st.x, st.y, 1, st.depth);
  const ws = world.windsock;
  w.sprite(sp.windsock(4, Math.floor(o.time * 3) % 2), isoX(ws.x, ws.y), isoY(ws.x, ws.y), 1, ws.x + ws.y);

  // vehicles
  for (const v of s.vehicles) {
    const x = lerp(v.px, v.x, a);
    const y = lerp(v.py, v.y, a);
    const sx = isoX(x, y);
    const sy = isoY(x, y);
    if (!visible(sx, sy, 40)) continue;
    const d = dirIndex(v.heading);
    w.shadow(sp.vehicleShadow(0, d), sx + 2, sy + 2, 1, 0.28);
    w.sprite(sp.vehicle(0, d), sx, sy, 1, x + y);
  }

  // people
  for (const p of s.people) {
    const x = lerp(p.px, p.x, a);
    const y = lerp(p.py, p.y, a);
    const sx = isoX(x, y);
    const sy = isoY(x, y);
    if (!visible(sx, sy, 30)) continue;
    const h = p.heading;
    const svx = Math.cos(h) - Math.sin(h);
    const svy = Math.cos(h) + Math.sin(h);
    const frame = p.moving ? Math.floor(o.time * 8 + p.id * 0.37) % 4 : 4;
    const idleFront = p.state === PST.waiting;
    w.sprite(sp.person(p.outfit, idleFront ? false : svy < 0, idleFront ? (p.id & 1) === 1 : svx < 0, frame), sx, sy, 1, x + y);
  }

  // flights
  for (const f of s.flights) drawFlight(w, f, sp, o, a, inv, visible);

  fx.draw(w, sp, zoom, o.time);

  // off-screen markers for flights that want something
  indicators.length = 0;
  const W = cam.viewW;
  const H = cam.viewH;
  const m = 34;
  const top = o.safeTop + m;
  const bottom = H - o.safeBottom - m;
  for (const f of s.flights) {
    if (f.want === WANT.none) continue;
    const b = bubbleAnchor(f, zoom);
    const vx = (b.x - cam.x) * zoom + W / 2;
    const vy = (b.y - cam.y) * zoom + H / 2;
    if (vx >= m && vx <= W - m && vy >= top && vy <= bottom) continue;
    // clamp along the ray from the view center
    const cx = W / 2;
    const cy = (top + bottom) / 2;
    const dx = vx - cx;
    const dy = vy - cy;
    const kx = dx !== 0 ? (dx > 0 ? W - m - cx : m - cx) / dx : Infinity;
    const ky = dy !== 0 ? (dy > 0 ? bottom - cy : top - cy) / dy : Infinity;
    const k = Math.max(0, Math.min(1, kx, ky));
    const ix = cx + dx * k;
    const iy = cy + dy * k;
    indicators.push({ id: f.id, vx: ix, vy: iy });
    const wx = cam.x + (ix - W / 2) / zoom;
    const wy = cam.y + (iy - H / 2) / zoom;
    const pulse = 1 + Math.sin(o.time * 6 + f.id) * 0.07;
    const icon = WANT_ICON[f.want];
    w.over(sp.icon('bubble'), wx, wy, 1.3 * inv * pulse);
    if (icon) w.over(sp.icon(icon), wx, wy - 3 * inv, 0.85 * inv * pulse);
  }
}

function drawFlight(
  w: SnapWriter,
  f: Flight,
  sp: SpriteSet,
  o: DrawOptions,
  a: number,
  inv: number,
  visible: (x: number, y: number, r: number) => boolean,
): void {
  const x = lerp(f.px, f.x, a);
  const y = lerp(f.py, f.y, a);
  const z = lerp(f.pz, f.z, a);
  const sx = isoX(x, y);
  const sy = isoY(x, y, z);
  const combo = sp.comboIndex(f.airline, f.aircraft);
  if (combo < 0) return;
  const d = dirIndex(f.heading);
  // shadow falls down-right as the plane climbs
  const shx = isoX(x + z * 0.35, y + z * 0.08);
  const shy = isoY(x + z * 0.35, y + z * 0.08);
  const near = visible(sx, sy, 120) || visible(shx, shy, 120);
  if (!near && f.want === WANT.none) return;
  w.shadow(sp.planeShadow(f.aircraft, d), shx, shy, 1 - Math.min(0.25, z * 0.03), 0.3 * (1 - Math.min(0.6, z / 12)));
  if (o.selected === f.id) w.decal(sp.ring, isoX(x, y), isoY(x, y), 0.5 + planeArt(f.aircraft).length * 0.42, 0.95);
  const depth = z > 0.05 ? 1000 + x + y + z : x + y;
  w.sprite(sp.plane(combo, d), sx, sy, 1, depth);

  const b = bubbleAnchor({ x, y, z, aircraft: f.aircraft }, 1 / inv);
  // action bubble
  if (f.want !== WANT.none) {
    const icon = WANT_ICON[f.want];
    const pulse = 1 + Math.sin(o.time * 6 + f.id) * 0.07;
    const k = Math.max(1, inv * 0.75) * pulse;
    w.over(sp.icon('bubble'), b.x, b.y, 1.25 * k);
    if (icon) w.over(sp.icon(icon), b.x, b.y - 3 * k, 0.82 * k);
  }
  // progress bars over the plane
  const barY = b.y + (f.want !== WANT.none ? 28 * Math.max(1, inv * 0.75) : 14 * inv);
  if (f.phase === 'deboarding' && f.paxIn > 0) w.bar(b.x, barY, 44, f.deboarded / f.paxIn, 0x3d8bfd);
  if (f.fuelState === FUEL.fueling) w.bar(b.x, barY + 8 * inv, 44, f.fuelNeed > 0 ? f.fuel / f.fuelNeed : 1, 0xff9f1c);
  if (f.phase === 'boarding' && f.paxOut > 0) w.bar(b.x, barY, 44, f.boarded / f.paxOut, 0x3fcf6e);
  if ((f.phase === 'holding' || f.phase === 'inbound') && !f.landCleared && f.patience < 0.999) {
    w.bar(b.x, barY, 44, f.patience, f.patience < 0.35 ? 0xff6b5e : 0xffd23f);
  }
}
