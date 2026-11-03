/** Writes the game state into the frame snapshot (JS thread, every frame). */
import { planeArt } from '../data/aircraft';
import { STAFF_ROLES } from '../data/staff';
import { layoutOf } from '../sim/game/layout';
import { decorPos } from '../sim/game/tiers';
import { layoutFor } from '../data/tiers';
import { FUEL, PST, WANT, type Flight, type GameState } from '../sim/game/types';
import type { IconName } from './art/icons';
import { OUTFITS } from './art/people';
import type { Camera } from './camera';
import type { Effects } from './effects';
import { isoX, isoY, Z_PX } from './iso';
import type { SnapWriter } from './scene';
import { BEACON } from './art/vehicles';
import { dirIndex, DIRS, GLOW_COLORS, VEHICLE_KINDS, VEHICLE_SCALE, type SpriteSet } from './sprites';
import { parkedCars, roadCars, type CarPose } from './traffic';
import type { World } from './world';

const WANT_ICON: Record<number, IconName> = {
  [WANT.clearLanding]: 'actLand',
  [WANT.fuel]: 'actFuel',
  [WANT.board]: 'actBoard',
  [WANT.clearTakeoff]: 'actTakeoff',
  [WANT.bags]: 'actBags',
};

const STAFF_OUTFIT = STAFF_ROLES.map((r) => Math.max(0, OUTFITS.findIndex((o) => o.id === r.outfit)));

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
  /** Build mode: tiles under movable things, and the one being dragged. */
  build?: { drag: string | null; x: number; y: number; ok: boolean };
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

  // things upgrades add, and construction sites
  const LL = layoutOf(s.tier);
  const deco = (sprite: number, p: readonly [number, number], d = 0.6) => {
    const sx = isoX(p[0], p[1]);
    const sy = isoY(p[0], p[1]);
    if (visible(sx, sy, 80)) w.sprite(sprite, sx, sy, 1, p[0] + p[1] + d);
  };
  const items = decorItems(s);
  for (const it of items) {
    const dragged = o.build?.drag === it.id;
    const p = decorPos(s, it.id);
    if (o.build) w.decal(o.build.drag && dragged ? (o.build.ok ? sp.tileOk : sp.tileBad) : sp.tileOk, isoX(p[0], p[1]), isoY(p[0], p[1]), 1, dragged ? 0.35 : 0.8);
    if (dragged && o.build) {
      w.decal(o.build.ok ? sp.tileOk : sp.tileBad, isoX(o.build.x, o.build.y), isoY(o.build.x, o.build.y), 1, 1);
      w.fx(spriteOf(sp, it.id), isoX(o.build.x, o.build.y), isoY(o.build.x, o.build.y), 1, 0.75);
      continue;
    }
    deco(spriteOf(sp, it.id), p, it.id.startsWith('bench') ? 0.3 : 0.6);
  }
  const site = constructionSite(s);
  if (site) {
    deco(sp.crane, site.at, 0.2);
    w.bar(isoX(site.at[0], site.at[1]), isoY(site.at[0], site.at[1], 2.3), 52, site.progress, 0xf59e0b);
  }
  // building the next tier: cranes on the new plots and next to the hut
  if (s.tierBuild) {
    const NL = layoutFor(s.tierBuild.to);
    const prog = 1 - s.tierBuild.remaining / Math.max(0.001, s.tierBuild.total);
    const spots: (readonly [number, number])[] = NL.stands.slice(LL.stands.length).map((st) => st.pos);
    spots.push([LL.hut[0] - 1.1, LL.hut[1] + 0.4]);
    for (const p of spots) deco(sp.crane, p, 0.2);
    const head = spots[spots.length - 1];
    w.bar(isoX(head[0], head[1]), isoY(head[0], head[1], 2.3), 64, prog, 0x6366f1);
  }

  // vehicles (an amber beacon blinks while they are out working)
  for (const v of s.vehicles) {
    const x = lerp(v.px, v.x, a);
    const y = lerp(v.py, v.y, a);
    const sx = isoX(x, y);
    const sy = isoY(x, y);
    if (!visible(sx, sy, 40)) continue;
    const d = dirIndex(v.heading);
    const k = Math.max(0, VEHICLE_KINDS.indexOf(v.kind));
    w.shadow(sp.vehicleShadow(k, d), sx + 2, sy + 2, 1, 0.28);
    w.sprite(sp.vehicle(k, d), sx, sy, 1, x + y);
    if (v.state !== 'idle' && Math.floor(o.time * 3 + v.id * 0.5) % 2 === 0) {
      const b = BEACON[v.kind];
      const p = modelPoint(x, y, 0, d, b.u * VEHICLE_SCALE, b.v * VEHICLE_SCALE, b.h * VEHICLE_SCALE);
      w.fx(sp.glow(GLOW_COLORS.amber), p.x, p.y, 1, 0.95);
    }
  }

  // background traffic: parked cars and cars on the access road
  drawCars(w, sp, parkedCars(LL, s.stats.served), visible, o.time, false);
  drawCars(w, sp, roadCars(LL, s.time), visible, o.time, true);

  // idle staff at their posts (fueler and porter ride their vehicles while working)
  const L = layoutOf(s.tier);
  const seen = new Array(STAFF_ROLES.length).fill(0);
  for (const m of s.staff) {
    const role = STAFF_ROLES[m.role];
    const spot = L.staffSpots[role.id];
    if (!spot) continue;
    const n = seen[m.role]++;
    if (role.id !== 'atc') {
      const kind = role.id === 'fueler' ? 'fuel' : 'bags';
      const busy = s.vehicles.filter((v) => v.kind === kind && v.state !== 'idle').length;
      if (n < busy) continue;
    }
    let x = spot[0] + n * 0.45;
    let y = spot[1] + n * 0.2;
    if (role.id === 'agent') {
      const c = LL.terminal.counters[Math.min(n, LL.terminal.counters.length - 1)];
      x = c[0];
      y = c[1] - 0.55;
    }
    w.sprite(sp.person(STAFF_OUTFIT[m.role], false, n % 2 === 1, 4), isoX(x, y), isoY(x, y), 1, x + y);
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
    if (icon) w.over(sp.icon(icon), wx, wy, 1.5 * inv * pulse);
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
  planeLights(w, f, sp, x, y, z, d, o.time);

  const b = bubbleAnchor({ x, y, z, aircraft: f.aircraft }, 1 / inv);
  // action bubble
  if (f.want !== WANT.none) {
    const icon = WANT_ICON[f.want];
    const pulse = 1 + Math.sin(o.time * 6 + f.id) * 0.07;
    const k = Math.max(1, inv * 0.75) * pulse;
    if (icon) w.over(sp.icon(icon), b.x, b.y - 10 * k, 1.45 * k);
  }
  // progress bars over the plane
  const barY = b.y + (f.want !== WANT.none ? 16 * Math.max(1, inv * 0.75) : 14 * inv);
  if (f.phase === 'deboarding' && f.paxIn > 0) w.bar(b.x, barY, 44, f.deboarded / f.paxIn, 0x3d8bfd);
  if (f.fuelState === FUEL.fueling) w.bar(b.x, barY + 8 * inv, 44, f.fuelNeed > 0 ? f.fuel / f.fuelNeed : 1, 0xff9f1c);
  if (f.phase === 'boarding' && f.paxOut > 0) w.bar(b.x, barY, 44, f.boarded / f.paxOut, 0x10b981);
  if (f.bagState === FUEL.fueling) w.bar(b.x, barY + 16 * inv, 44, f.bagWork, 0x8b5cf6);
  if (f.gWaiting && f.want === WANT.none) w.over(sp.icon('wait'), b.x, b.y - 4 * inv, 0.9 * inv);
  if ((f.phase === 'holding' || f.phase === 'inbound') && !f.landCleared && f.patience < 0.999) {
    w.bar(b.x, barY, 44, f.patience, f.patience < 0.35 ? 0xff6b5e : 0xffd23f);
  }
}

/** Screen point of a model-space point (u forward, v right, h up) on something at (x, y, z) facing direction d. */
function modelPoint(x: number, y: number, z: number, d: number, u: number, v: number, h: number): { x: number; y: number } {
  const hd = (d / DIRS) * Math.PI * 2;
  const c = Math.cos(hd);
  const sn = Math.sin(hd);
  const wx = x + u * c - v * sn;
  const wy = y + u * sn + v * c;
  return { x: isoX(wx, wy), y: isoY(wx, wy, z + h) };
}

function drawCars(w: SnapWriter, sp: SpriteSet, cars: CarPose[], visible: (x: number, y: number, r: number) => boolean, time: number, moving: boolean): void {
  for (const c of cars) {
    const sx = isoX(c.x, c.y);
    const sy = isoY(c.x, c.y);
    if (!visible(sx, sy, 40)) continue;
    const d = dirIndex(c.heading);
    w.shadow(sp.carShadow(c.variant, d), sx + 1.5, sy + 1.5, 1, 0.25);
    w.sprite(sp.car(c.variant, d), sx, sy, 1, c.x + c.y);
    if (moving && c.stopped) {
      // brake lights at the curb, hazard blink while dropping people off
      const on = Math.floor(time * 2.5 + c.x) % 2 === 0;
      for (const v of [-0.05, 0.05]) {
        const p = modelPoint(c.x, c.y, 0, d, -0.2 * VEHICLE_SCALE, v * VEHICLE_SCALE, 0.07 * VEHICLE_SCALE);
        w.fx(sp.glow(on ? GLOW_COLORS.amber : GLOW_COLORS.red), p.x, p.y, 0.7, 0.85);
      }
    }
  }
}

/** Phases with engines running: the red anti-collision beacon flashes. */
function enginesOn(f: Flight): boolean {
  return f.phase !== 'deboarding' && f.phase !== 'turnaround' && f.phase !== 'boarding';
}

/**
 * Aircraft lights: red (left) and green (right) wingtips and a white tail
 * light always on; a red beacon flashing while engines run; white strobes
 * and the landing light while flying or on the runway.
 */
function planeLights(w: SnapWriter, f: Flight, sp: SpriteSet, x: number, y: number, z: number, d: number, time: number): void {
  const art = planeArt(f.aircraft);
  if (art.engines === 'rotor' || art.chord <= 0) return;
  const L = art.length;
  const uw = art.wing === 'high' ? -L / 2 + L * 0.6 : -L / 2 + L * 0.52;
  const tipChord = art.chord * (art.sweep > 0.1 ? 0.4 : 0.75);
  const tipU = uw + art.chord / 2 - art.sweep - tipChord * 0.5;
  const rv = art.radius * art.tall;
  const hc = art.gear + rv;
  const hWing = (art.wing === 'high' ? hc + rv * 0.86 : art.gear + rv * 0.5) + Math.max(0.028, art.chord * 0.12);
  const half = art.span / 2 + 0.01;
  const k = 0.75;
  const left = modelPoint(x, y, z, d, tipU, -half, hWing);
  const right = modelPoint(x, y, z, d, tipU, half, hWing);
  const tail = modelPoint(x, y, z, d, -L / 2 - 0.02, 0, hc);
  w.fx(sp.glow(GLOW_COLORS.red), left.x, left.y, k, 0.9);
  w.fx(sp.glow(GLOW_COLORS.green), right.x, right.y, k, 0.9);
  w.fx(sp.glow(GLOW_COLORS.white), tail.x, tail.y, k * 0.8, 0.7);
  const ph = time + f.id * 0.37;
  if (enginesOn(f) && ph % 1.2 < 0.14) {
    const top = modelPoint(x, y, z, d, 0, 0, hc + rv + 0.01);
    w.fx(sp.glow(GLOW_COLORS.red), top.x, top.y, 1.1, 1);
  }
  const lit = f.phase === 'final' || f.phase === 'landing' || f.phase === 'takeoff' || f.phase === 'lineUp' || f.phase === 'holding' || f.phase === 'inbound' || f.phase === 'diverted';
  if (lit && (ph + 0.5) % 1.5 < 0.08) {
    w.fx(sp.glow(GLOW_COLORS.white), left.x, left.y, 1.4, 1);
    w.fx(sp.glow(GLOW_COLORS.white), right.x, right.y, 1.4, 1);
  }
  if (f.phase === 'final' || f.phase === 'landing' || f.phase === 'takeoff' || f.phase === 'lineUp') {
    const nose = modelPoint(x, y, z, d, L / 2 + 0.02, 0, hc - rv * 0.4);
    w.fx(sp.glow(GLOW_COLORS.white), nose.x, nose.y, 1.6, 0.95);
  }
}

/** Movable decorations the player owns (from upgrade levels). */
export function decorItems(s: GameState): { id: string }[] {
  const lv = (id: string) => s.upg[id] ?? 0;
  const out: { id: string }[] = [];
  if (lv('kiosk') > 0) out.push({ id: 'kiosk' });
  if (lv('billboard') > 0) out.push({ id: 'billboard' });
  if (lv('benches') > 0) out.push({ id: 'bench1' });
  if (lv('benches') >= 10) out.push({ id: 'bench2' });
  return out;
}

function spriteOf(sp: SpriteSet, id: string): number {
  return id === 'kiosk' ? sp.kiosk : id === 'billboard' ? sp.billboard : sp.bench;
}

/** Where the current construction is (stand plot or vehicle depot) and how far along. */
export function constructionSite(s: GameState): { at: readonly [number, number]; progress: number } | null {
  const b = s.builds[0];
  if (!b) {
    if (!s.tierBuild) return null;
    const L = layoutOf(s.tier);
    return { at: [L.hut[0] - 1.1, L.hut[1] + 0.4], progress: 1 - s.tierBuild.remaining / Math.max(0.001, s.tierBuild.total) };
  }
  const L = layoutOf(s.tier);
  let at: readonly [number, number];
  if (b.id === 'stand') at = L.stands[Math.min(b.level, L.stands.length - 1)].pos;
  else if (b.id === 'truck2') at = [L.fuel.home[0] + 0.8, L.fuel.home[1] - 0.6];
  else at = [L.bags.home[0] - 0.8, L.bags.home[1] - 0.4];
  return { at, progress: 1 - b.remaining / Math.max(0.001, b.total) };
}
