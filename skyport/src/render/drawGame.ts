/** Writes the game state into the frame snapshot (JS thread, every frame). */
import { AIRCRAFT, planeArt } from '../data/aircraft';
import { STAFF_ROLES } from '../data/staff';
import { bigTerminal, doorPoint, layoutOf } from '../sim/game/layout';
import { decorPos } from '../sim/game/tiers';
import { layoutFor, type TierLayout } from '../data/tiers';
import { FUEL, PST, WANT, type Flight, type GameState } from '../sim/game/types';
import { weather } from '../sim/game/weather';
import { meteoSpot } from '../sim/game/tower';
import { APM_CAR } from '../sim/game/apm';
import { RAIL_CAR, RAIL_CARS, railTrain } from '../sim/game/rail';
import { capacity, storeActive } from '../sim/game/supplies';
import { GAUGE_STEPS, towerTop } from './art/objects';
import type { IconName } from './art/icons';
import { OUTFITS, PAX_OUTFITS } from './art/people';
import type { Camera } from './camera';
import type { Effects } from './effects';
import { isoX, isoY, Z_PX } from './iso';
import type { SnapWriter } from './scene';
import { BEACON, CAR_VARIANTS } from './art/vehicles';
import { dirIndex, DIRS, GLOW_COLORS, planeRes, VEHICLE_KINDS, VEHICLE_SCALE, type SpriteSet } from './sprites';
import { parkedCars, roadCars, type CarPose } from './traffic';
import { drawEventScenes, drawHolidayDecor } from './drawEvents';
import { versionOf } from '../data/versions';
import { noticeSeconds } from '../sim/game/security';
import type { World } from './world';
import { gameClock } from '../sim/game/clock';
import { cleanAreas } from '../sim/game/cleaning';

const WANT_ICON: Record<number, IconName> = {
  [WANT.clearLanding]: 'actLand',
  [WANT.fuel]: 'actFuel',
  [WANT.board]: 'actBoard',
  [WANT.clearTakeoff]: 'actTakeoff',
  [WANT.bags]: 'actBags',
  [WANT.repair]: 'actRepair',
};

/** Where the radar mast stands, beside the control tower. */
const RADAR_POS: readonly [number, number] = [16.5, 15.3];

const STAFF_OUTFIT = STAFF_ROLES.map((r) => Math.max(0, OUTFITS.findIndex((o) => o.id === r.outfit)));
const MECH_OUTFIT = Math.max(0, OUTFITS.findIndex((o) => o.id === 'mechanic'));
const CLEANER_OUTFIT = Math.max(0, OUTFITS.findIndex((o) => o.id === 'cleaner'));
const GUARD_OUTFIT = Math.max(0, OUTFITS.findIndex((o) => o.id === 'guard'));
const GUARD_ROLE = STAFF_ROLES.findIndex((r) => r.id === 'guard');
const PAX_OUTFIT_IDX = PAX_OUTFITS.map((id) => Math.max(0, OUTFITS.findIndex((o) => o.id === id)));

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
  const wx = weather(s);
  // the sock streams toward where the wind blows; it flaps faster in a strong wind
  const sock8 = (Math.round((wx.windTo / (Math.PI * 2)) * 8) + 8) % 8;
  w.sprite(sp.windsock(sock8, Math.floor(o.time * (2 + wx.speed / 6)) % 2), isoX(ws.x, ws.y), isoY(ws.x, ws.y), 1, ws.x + ws.y);
  const LLr = layoutOf(s.tier);
  if ((s.upg.radar ?? 0) > 0 && s.tier >= 2) {
    const rx = (LLr.radar ?? RADAR_POS)[0];
    const ry = (LLr.radar ?? RADAR_POS)[1];
    const rv = versionOf('radar', s.upg.radar ?? 0);
    // one turn every 4 s (the antenna repeats every half turn); the radome does not turn
    if (rv >= 3) w.sprite(sp.radome, isoX(rx, ry), isoY(rx, ry), 1, rx + ry + 0.2);
    else w.sprite(sp.radar(Math.floor(o.time * (rv >= 2 ? 6 : 4))), isoX(rx, ry), isoY(rx, ry), rv >= 2 ? 1.25 : 1, rx + ry + 0.2);
  }
  // the control tower: it grows with its upgrade; the taller ones have a blinking beacon
  if (world.tower) {
    const [tx, ty] = world.tower;
    const tv = versionOf('tower', s.upg.tower ?? 0);
    const sx = isoX(tx, ty);
    const sy = isoY(tx, ty);
    // the weather station by the tower (its cups turn with the wind)
    const mv = s.upg.meteo ?? 0;
    const ms = mv > 0 ? meteoSpot(s.tier) : null;
    if (ms) {
      const [mx, my] = ms;
      if (visible(isoX(mx, my), isoY(mx, my), 60)) w.sprite(sp.meteo(Math.floor(o.time * (2 + wx.speed / 5)), mv >= 3), isoX(mx, my), isoY(mx, my), 1, mx + my + 0.5);
    }
    if (visible(sx, sy, 180)) {
      w.sprite(sp.towerV(tv), sx, sy, 1, tx + ty + 0.3);
      if (tv >= 2 && Math.floor(o.time * 1.2) % 2 === 0) w.fx(sp.glow(GLOW_COLORS.red), sx, isoY(tx, ty, towerTop(tv)), 0.8, 0.9);
    }
  }

  // things upgrades add, and construction sites
  const LL = layoutOf(s.tier);
  const deco = (sprite: number, p: readonly [number, number], d = 0.6) => {
    const sx = isoX(p[0], p[1]);
    const sy = isoY(p[0], p[1]);
    if (visible(sx, sy, 80)) w.sprite(sprite, sx, sy, 1, p[0] + p[1] + d);
  };
  // floodlight masts at the stands (one every other stand, then all)
  const mastsN = s.upg.floodlights ?? 0;
  if (mastsN > 0)
    LL.stands.forEach((st, i) => {
      if (!s.standOpen[i] || st.size === 'small' || st.size === 'heli' || st.hangar || (mastsN < 2 && i % 2 === 1)) return;
      deco(sp.floodMast, mastSpot(st), 0.3);
    });
  // the Aviation Guide's pylon in front of the main terminal, with its stars
  deco(sp.guidePylon(s.guide.stars), guidePylonSpot(LL), 0.3);
  const items = decorItems(s);
  for (const it of items) {
    const dragged = o.build?.drag === it.id;
    const p = decorPos(s, it.id);
    if (o.build) w.decal(o.build.drag && dragged ? (o.build.ok ? sp.tileOk : sp.tileBad) : sp.tileOk, isoX(p[0], p[1]), isoY(p[0], p[1]), 1, dragged ? 0.35 : 0.8);
    if (dragged && o.build) {
      w.decal(o.build.ok ? sp.tileOk : sp.tileBad, isoX(o.build.x, o.build.y), isoY(o.build.x, o.build.y), 1, 1);
      w.fx(spriteOf(sp, it.id, s, o.time), isoX(o.build.x, o.build.y), isoY(o.build.x, o.build.y), 1, 0.75);
      continue;
    }
    deco(spriteOf(sp, it.id, s, o.time), p, it.id.startsWith('bench') ? 0.3 : 0.6);
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
    if (v.kind === 'mech' && v.state === 'fueling') {
      // the mechanic stands at the engine with the toolbox; now and then a welding flash
      const f = s.flights.find((q) => q.id === v.flight);
      if (f && !f.partWait) {
        const mx = lerp(x, f.x, 0.55);
        const my = lerp(y, f.y, 0.55);
        const frame = Math.floor(o.time * 2 + v.id) % 2 === 0 ? 4 : 1;
        w.sprite(sp.person(MECH_OUTFIT, false, f.x < x, frame), isoX(mx, my), isoY(mx, my), 1, mx + my + 0.05);
        if (Math.floor(o.time * 7 + v.id) % 9 === 0) w.fx(sp.glow(GLOW_COLORS.white), isoX(mx, my) + 6, isoY(mx, my, 0.45), 0.7, 0.9);
      } else if (f) {
        // waiting for a part: by the van, arms folded
        w.sprite(sp.person(MECH_OUTFIT, true, false, 4), isoX(x + 0.3, y + 0.25), isoY(x + 0.3, y + 0.25), 1, x + y + 0.6);
      }
    }
    if (v.state !== 'idle' && Math.floor(o.time * 3 + v.id * 0.5) % 2 === 0) {
      const b = BEACON[v.kind];
      const p = modelPoint(x, y, 0, d, b.u * VEHICLE_SCALE, b.v * VEHICLE_SCALE, b.h * VEHICLE_SCALE);
      w.fx(sp.glow(GLOW_COLORS.amber), p.x, p.y, 1, 0.95);
    }
  }

  // the fuel farm's level gauge follows the stock
  if (LL.depot && storeActive(s, 'fuel')) {
    const gx = LL.depot.farm[0] - 0.29;
    const gy = LL.depot.farm[1] + 0.27;
    const fill = (s.stores.fuel.stock / Math.max(1, capacity(s, 'fuel'))) * GAUGE_STEPS;
    w.sprite(sp.gauge(fill), isoX(gx, gy), isoY(gx, gy), 1, gx + gy + 0.4);
  }
  // grounded planes: a warning triangle at the nose and cones at the wingtips
  for (const f of s.flights) {
    if (f.aog !== 1 || f.check || f.dockedAt === 0 || f.offBlockAt > 0) continue;
    const art = planeArt(f.aircraft);
    const cx = Math.cos(f.heading);
    const cy = Math.sin(f.heading);
    const tx = f.x + cx * art.length * 0.66;
    const ty = f.y + cy * art.length * 0.66;
    w.sprite(sp.warnTriangle, isoX(tx, ty), isoY(tx, ty), 1, tx + ty);
    for (const side of [-1, 1]) {
      const wx2 = f.x - cy * side * art.span * 0.56;
      const wy2 = f.y + cx * side * art.span * 0.56;
      w.sprite(sp.cone, isoX(wx2, wy2), isoY(wx2, wy2), 1, wx2 + wy2);
    }
    // the red beacon on the van's side of the plane blinks
    if (Math.floor(o.time * 2.5 + f.id) % 2 === 0) w.fx(sp.glow(GLOW_COLORS.red), isoX(tx, ty), isoY(tx, ty, 0.3), 0.8, 0.9);
  }

  drawIncidents(w, s, sp, o, a, inv, visible, { x0: vx0, x1: vx1, y0: vy0, y1: vy1 });
  drawEventScenes(w, s, sp, { time: o.time, alpha: a, inv, visible });
  drawHolidayDecor(w, s, sp, { time: o.time, alpha: a, inv, visible });

  // supply trucks on their way in, unloading at the depot, and leaving
  for (const dv of s.deliveries) {
    if (dv.state === 'ordered') continue;
    const x = lerp(dv.px, dv.x, a);
    const y = lerp(dv.py, dv.y, a);
    const sx = isoX(x, y);
    const sy = isoY(x, y);
    if (!visible(sx, sy, 60)) continue;
    const d = dirIndex(dv.heading);
    const kind = dv.store === 0 ? 'tanker' : 'partsTruck';
    const k = VEHICLE_KINDS.indexOf(kind);
    w.shadow(sp.vehicleShadow(k, d), sx + 2, sy + 2, 1, 0.28);
    w.sprite(sp.vehicle(k, d), sx, sy, 1, x + y);
    // hazard lights while unloading, a slower amber blink for an urgent run
    const blink = dv.state === 'unloading' ? Math.floor(o.time * 2) % 2 === 0 : dv.urgent && Math.floor(o.time * 3 + dv.id) % 2 === 0;
    if (blink) {
      const b = BEACON[kind];
      const p = modelPoint(x, y, 0, d, b.u * VEHICLE_SCALE, b.v * VEHICLE_SCALE, b.h * VEHICLE_SCALE);
      w.fx(sp.glow(GLOW_COLORS.amber), p.x, p.y, 1, 0.95);
    }
  }

  // background traffic: parked cars and cars on the access road
  drawCars(w, sp, parkedCars(LL, s.stats.served), visible, o.time, false);
  drawCars(w, sp, roadCars(LL, s.time), visible, o.time, true, nightOf(s.time));
  // Terminal 3's road: cars, taxis and buses to its curb
  if (LL.t3) drawCars(w, sp, roadCars(LL, s.time * 1.3 + 3, LL.t3.road, 7), visible, o.time, true, nightOf(s.time));
  if (LL.t4) drawCars(w, sp, roadCars(LL, s.time * 1.2 + 11, LL.t4.road, 13), visible, o.time, true, nightOf(s.time));

  // idle staff at their posts (fueler and porter ride their vehicles while working)
  const L = layoutOf(s.tier);
  const seen = new Array(STAFF_ROLES.length).fill(0);
  for (const m of s.staff) {
    const role = STAFF_ROLES[m.role];
    // (mechanics wait by their van at the supply area)
    const spot = role.id === 'mechanic' && L.depot ? ([L.depot.mech.home[0] + 0.45, L.depot.mech.home[1] - 0.35] as const) : L.staffSpots[role.id];
    if (!spot) continue;
    const n = seen[m.role]++;
    if (role.id !== 'atc' && role.id !== 'agent') {
      const kind = role.id === 'fueler' ? 'fuel' : role.id === 'porter' ? 'bags' : 'mech';
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
  // apron buses (their riders are inside)
  const BUS = VEHICLE_KINDS.indexOf('apronBus');
  for (const b of s.buses) {
    const x = lerp(b.px, b.x, a);
    const y = lerp(b.py, b.y, a);
    const sx = isoX(x, y);
    const sy = isoY(x, y);
    if (!visible(sx, sy, 60)) continue;
    const d = dirIndex(b.heading);
    w.shadow(sp.vehicleShadow(BUS, d), sx + 2, sy + 2, 1, 0.28);
    w.sprite(sp.vehicle(BUS, d), sx, sy, 1, x + y);
    if (b.state !== 'idle' && Math.floor(o.time * 3 + b.id) % 2 === 0) {
      const bc = BEACON.apronBus;
      const p = modelPoint(x, y, 0, d, bc.u * VEHICLE_SCALE, bc.v * VEHICLE_SCALE, bc.h * VEHICLE_SCALE);
      w.fx(sp.glow(GLOW_COLORS.amber), p.x, p.y, 0.8, 0.9);
    }
  }
  // litter on the terminal floors, and the cleaners with their trolleys
  for (const l of s.litter) {
    const sx = isoX(l.x, l.y);
    const sy = isoY(l.x, l.y);
    if (!visible(sx, sy, 10)) continue;
    w.sprite(sp.litter(l.id), sx, sy, 1, l.x + l.y - 0.15);
  }
  for (const sw of s.sweepers) {
    const x = lerp(sw.px, sw.x, a);
    const y = lerp(sw.py, sw.y, a);
    const sx = isoX(x, y);
    const sy = isoY(x, y);
    if (!visible(sx, sy, 30)) continue;
    const moving = Math.hypot(sw.x - sw.px, sw.y - sw.py) > 1e-4;
    const svx = Math.cos(sw.heading) - Math.sin(sw.heading);
    const svy = Math.cos(sw.heading) + Math.sin(sw.heading);
    // (the trolley goes in front of them)
    const cx = x + Math.cos(sw.heading) * 0.25;
    const cy = y + Math.sin(sw.heading) * 0.25;
    w.sprite(sp.cleanCart, isoX(cx, cy), isoY(cx, cy), 1, cx + cy);
    const frame = moving ? Math.floor(o.time * 7 + sw.staffId * 0.37) % 4 : 4;
    w.sprite(sp.person(CLEANER_OUTFIT, svy < 0, svx < 0, frame), sx, sy, 1, x + y);
  }

  // guards on patrol (one checking a bag stands by it); the bag itself, behind a ring of tape
  for (const g of s.guards) {
    if (g.until > s.time) continue;
    const x = lerp(g.px, g.x, a);
    const y = lerp(g.py, g.y, a);
    const sx = isoX(x, y);
    const sy = isoY(x, y);
    if (!visible(sx, sy, 30)) continue;
    const moving = Math.hypot(g.x - g.px, g.y - g.py) > 1e-4;
    const svx = Math.cos(g.heading) - Math.sin(g.heading);
    const svy = Math.cos(g.heading) + Math.sin(g.heading);
    const frame = moving ? Math.floor(o.time * 8 + g.staffId * 0.37) % 4 : 4;
    w.sprite(sp.person(GUARD_OUTFIT, svy < 0, svx < 0, frame), sx, sy, 1, x + y);
    // the dog team walks with the first guard
    if ((s.upg.k9 ?? 0) > 0 && g === s.guards[0]) {
      const dx = x + Math.cos(g.heading + 1.2) * 0.3;
      const dy = y + Math.sin(g.heading + 1.2) * 0.3;
      w.sprite(sp.dog(dirIndex(g.heading), moving ? Math.floor(o.time * 10) % 2 : 0), isoX(dx, dy), isoY(dx, dy), 1, dx + dy);
    }
  }
  for (const inc of s.incidents) {
    if (inc.kind !== 'bag' || inc.state !== 'active') continue;
    const sx = isoX(inc.x, inc.y);
    const sy = isoY(inc.x, inc.y);
    if (!visible(sx, sy, 40)) continue;
    w.decal(sp.cordon, sx, sy, 1, 0.95);
    w.sprite(sp.lostBag, sx, sy, 1, inc.x + inc.y);
    // noticed: a blinking marker over it
    if (s.time - inc.at >= noticeSeconds(s) && Math.floor(o.time * 2) % 2 === 0) w.over(sp.icon('warn'), sx, sy - 26, 0.5 * inv + 0.2);
  }

  // guards posted at the security checkpoints (one at each terminal's first lane), and a patrol car at the curb
  if (s.staff.some((m) => m.role === GUARD_ROLE)) {
    const posts: (readonly [number, number])[] = [];
    if (LL.building && LL.terminal.lanes[0]) posts.push(LL.terminal.lanes[0]);
    const T3 = bigTerminal(LL, 1);
    if (T3?.st.lanes?.[0]) posts.push(T3.st.lanes[0]);
    const T4 = bigTerminal(LL, 2);
    if (T4?.st.lanes?.[0]) posts.push(T4.st.lanes[0]);
    for (const lane of posts) {
      const gx = lane[0] - 0.55;
      const gy = lane[1] + 0.35;
      if (visible(isoX(gx, gy), isoY(gx, gy), 30)) w.sprite(sp.person(GUARD_OUTFIT, false, true, 4), isoX(gx, gy), isoY(gx, gy), 1, gx + gy);
    }
  }
  if ((s.upg.patrol ?? 0) > 0) {
    const T3 = bigTerminal(LL, 1);
    if (T3) {
      const cx = T3.st.entry[0] + 3.2;
      const cy = T3.st.entry[1] - 0.45;
      const PATROL = VEHICLE_KINDS.indexOf('patrol');
      if (visible(isoX(cx, cy), isoY(cx, cy), 40)) {
        w.shadow(sp.vehicleShadow(PATROL, 0), isoX(cx, cy) + 2, isoY(cx, cy) + 2, 1, 0.26);
        w.sprite(sp.vehicle(PATROL, 0), isoX(cx, cy), isoY(cx, cy), 1, cx + cy);
      }
    }
  }
  // a drone hovering over the field (its light blinks)
  for (const inc of s.incidents) {
    if (inc.kind !== 'drone' || inc.state !== 'active') continue;
    const hx = inc.x + Math.sin(o.time * 0.7) * 0.6;
    const hy = inc.y + Math.cos(o.time * 0.5) * 0.4;
    const hz = 1.4 + Math.sin(o.time * 2.1) * 0.12;
    const sx = isoX(hx, hy);
    if (!visible(sx, isoY(hx, hy), 60)) continue;
    w.shadow(sp.drone(0), sx + 2, isoY(hx, hy) + 2, 1.4, 0.18);
    w.sprite(sp.drone(Math.floor(o.time * 20) % 2), sx, isoY(hx, hy, hz), 1.6, hx + hy + 3);
    if (Math.floor(o.time * 3) % 2 === 0) w.fx(sp.glow(GLOW_COLORS.red), sx, isoY(hx, hy, hz + 0.08), 0.7, 0.9);
  }
  // a hole in the fence: cones by it and a blinking warning until it is checked
  for (const inc of s.incidents) {
    if (inc.kind !== 'breach' || inc.state !== 'active') continue;
    const sx = isoX(inc.x, inc.y);
    const sy = isoY(inc.x, inc.y);
    if (!visible(sx, sy, 60)) continue;
    for (const [dx, dy] of [
      [-0.45, -0.3],
      [0.45, -0.3],
    ] as const)
      w.sprite(sp.cone, isoX(inc.x + dx, inc.y + dy), isoY(inc.x + dx, inc.y + dy), 1, inc.x + dx + inc.y + dy);
    if (Math.floor(o.time * 2) % 2 === 0) w.over(sp.icon('warn'), sx, sy - 30, 0.55 * inv + 0.25);
  }
  // security cameras on poles at the terminals' corners and the fence's (one more each camera level)
  const cams = s.upg.cctv ?? 0;
  if (cams > 0) {
    const spots = cameraSpots(LL);
    for (let i = 0; i < Math.min(cams, spots.length); i++) deco(sp.cameraPole, spots[i], 0.4);
  }
  // patrol cars on their rounds inside the fence (when not out on a call)
  const cars = s.upg.patrol ?? 0;
  if (cars > 0 && s.tier >= 3) {
    const busy = s.incidents.some((i) => i.state !== 'done' && i.units.some((u) => u.kind === 'patrol' && u.state !== 'home'));
    const PATROL = VEHICLE_KINDS.indexOf('patrol');
    for (let k = busy ? 1 : 0; k < cars; k++) {
      const pt = patrolRound(LL, o.time * 1.6 + k * 0.5);
      const sx = isoX(pt[0], pt[1]);
      const sy = isoY(pt[0], pt[1]);
      if (!visible(sx, sy, 40)) continue;
      const d = dirIndex(pt[2]);
      w.shadow(sp.vehicleShadow(PATROL, d), sx + 2, sy + 2, 1, 0.28);
      w.sprite(sp.vehicle(PATROL, d), sx, sy, 1, pt[0] + pt[1]);
    }
  }

  // the hub: the people mover (its riders are inside) and the train at the station
  if (s.apm && LL.sat) {
    const APM = VEHICLE_KINDS.indexOf('apmCar');
    const x = lerp(s.apm.px, s.apm.x, a);
    const y = LL.sat.apm.y;
    for (const k of [-0.5, 0.5]) {
      const cx = x + k * APM_CAR;
      const sx = isoX(cx, y);
      const sy = isoY(cx, y);
      if (!visible(sx, sy, 60)) continue;
      w.shadow(sp.vehicleShadow(APM, 0), sx + 2, sy + 2, 1, 0.22);
      w.sprite(sp.vehicle(APM, 0), sx, sy, 1, cx + y);
    }
  }
  if (LL.rail) {
    const r = LL.rail;
    const tr = railTrain(r, s.time + (a - 1) / 30);
    if (tr.shown) {
      const CAB = VEHICLE_KINDS.indexOf('railCab');
      const CAR = VEHICLE_KINDS.indexOf('railCar');
      const back = dirIndex(Math.PI);
      for (let k = 0; k < RAIL_CARS; k++) {
        const cx = tr.x + (k - (RAIL_CARS - 1) / 2) * RAIL_CAR;
        // (into the tunnels at both ends: the banks cover the part inside)
        if (cx < r.portals[0] - 0.5 || cx > r.portals[1] + 0.5) continue;
        const sx = isoX(cx, r.y);
        const sy = isoY(cx, r.y);
        if (!visible(sx, sy, 90)) continue;
        const kind = k === 0 || k === RAIL_CARS - 1 ? CAB : CAR;
        const d = k === 0 ? back : 0;
        w.shadow(sp.vehicleShadow(kind, d), sx + 2, sy + 2, 1, 0.22);
        w.sprite(sp.vehicle(kind, d), sx, sy, 1, cx + r.y);
      }
    }
  }
  // the inspector's day: a magnifier over each suspect (a star over the one getting the VIP care)
  const visit = s.guide.visit && !s.guide.visit.done ? s.guide.visit : null;
  for (const p of s.people) {
    if (p.state === PST.inBus || p.state === PST.inBusA || p.state === PST.inApm || p.state === PST.inApmA) continue;
    if (visit && visit.suspects.includes(p.id)) {
      const mx = isoX(lerp(p.px, p.x, a), lerp(p.py, p.y, a));
      const my = isoY(lerp(p.px, p.x, a), lerp(p.py, p.y, a));
      const bob = Math.sin(o.time * 4 + p.id) * 2 * inv;
      w.over(sp.icon(visit.picked === p.id ? 'star' : 'search'), mx, my - 22 - 10 * inv + bob, 0.6 * inv + 0.25);
    }
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

  // night: the world darkens and the lights come on
  const night = nightOf(s.time);
  w.dark = night * 0.42;
  if (night > 0.02) drawNightLights(w, s, sp, LL, world, o.time, night, visible);
  // the ground crew's equipment round each parked plane (under the planes' own drawing order)
  for (const f of s.flights) drawGroundService(w, s, f, sp, LL, visible);
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
  const res = 1 / planeRes(f.aircraft);
  w.shadow(sp.planeShadow(f.aircraft, d), shx, shy, (1 - Math.min(0.25, z * 0.03)) * res, 0.3 * (1 - Math.min(0.6, z / 12)));
  if (o.selected === f.id) w.decal(sp.ring, isoX(x, y), isoY(x, y), 0.5 + planeArt(f.aircraft).length * 0.42, 0.95);
  const depth = z > 0.05 ? 1000 + x + y + z : x + y;
  w.sprite(sp.plane(combo, d), sx, sy, res, depth);
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

/** How dark it is, 0 (day) .. 1 (night): dusk 18:00 to 20:00, night until 05:00, dawn until 07:00. */
export function nightOf(time: number): number {
  const m = gameClock(time).minuteOfDay;
  if (m >= 20 * 60 || m < 5 * 60) return 1;
  if (m >= 18 * 60) return (m - 18 * 60) / 120;
  if (m < 7 * 60) return 1 - (m - 5 * 60) / 120;
  return 0;
}

/** Where a stand's floodlight mast stands (behind it, to the side), by stand. */
export function mastSpot(st: { pos: readonly [number, number]; size: string }): [number, number] {
  const r = st.size === 'large' ? 1.2 : st.size === 'huge' || st.size === 'hugeX' ? 1.6 : st.size === 'cargo' ? 1.4 : 1.0;
  return [st.pos[0] + r * 0.82, st.pos[1] - r * 0.82];
}

/**
 * The lights of the night (owner request: the details): runway edge lights (green at the threshold,
 * red at the far end), the approach lights and their running strobe as the lights line grows, the
 * street lamps, floodlight masts over the stands with pools of light, warm light in the halls.
 */
function drawNightLights(w: SnapWriter, s: GameState, sp: SpriteSet, L: TierLayout, world: World, time: number, night: number, visible: (x: number, y: number, r: number) => boolean): void {
  const glow = (c: number, x: number, y: number, z: number, scale: number, alpha: number) => {
    const sx = isoX(x, y);
    const sy = isoY(x, y, z);
    if (visible(sx, sy, 20 * scale)) w.fx(sp.glow(c), sx, sy, scale, alpha * night);
  };
  const lv = versionOf('lights', s.upg.lights ?? 0);
  for (const R of [L.runway, L.depRunway]) {
    if (!R || L.runway.surface === 'dirt') continue;
    const h2 = R.width / 2 + 0.08;
    for (let x = R.x0; x <= R.x1 + 0.01; x += 1.5) for (const side of [-1, 1]) glow(GLOW_COLORS.white, x, R.y + side * h2, 0.05, 0.55, 0.85);
    for (let k = -2; k <= 2; k++) {
      glow(GLOW_COLORS.green, R.x0 - 0.1, R.y + (k * R.width) / 5, 0.05, 0.6, 0.95);
      glow(GLOW_COLORS.red, R.x1 + 0.1, R.y + (k * R.width) / 5, 0.05, 0.6, 0.95);
    }
  }
  // the approach lights before the threshold planes land toward, and the running strobe
  const R = L.runway;
  if (lv >= 2 && R.surface !== 'dirt') {
    const dir = s.rwyDir >= 0 ? 1 : -1;
    const x0 = dir > 0 ? R.x0 : R.x1;
    for (let k = 1; k <= 9; k++) glow(GLOW_COLORS.white, x0 - dir * k * 0.6, R.y, 0.05, 0.6, 0.9);
    for (let k = -2; k <= 2; k++) glow(GLOW_COLORS.white, x0 - dir * 3, R.y + k * 0.35, 0.05, 0.55, 0.85);
    if (lv >= 3) {
      const k = 9 - (Math.floor(time * 18) % 10);
      if (k >= 1) glow(GLOW_COLORS.white, x0 - dir * k * 0.6, R.y, 0.1, 1.6, 1);
    }
  }
  // street lamps
  for (const st of world.statics) if (st.sprite === sp.lamp && visible(st.x, st.y, 40)) w.fx(sp.glow(GLOW_COLORS.amber), st.x + LAMP_DX, st.y + LAMP_DY, 1.3, 0.9 * night);
  // floodlight masts: a light up top and a pool on the stand
  const masts = s.upg.floodlights ?? 0;
  if (masts > 0) {
    L.stands.forEach((st, i) => {
      if (!s.standOpen[i] || st.size === 'small' || st.size === 'heli' || st.hangar || (masts < 2 && i % 2 === 1)) return;
      const m = mastSpot(st);
      glow(masts >= 3 ? GLOW_COLORS.white : GLOW_COLORS.amber, m[0], m[1], MAST_H, 1.5, 1);
      glow(masts >= 3 ? GLOW_COLORS.white : GLOW_COLORS.amber, st.pos[0], st.pos[1], 0, 6, 0.16);
    });
  }
  // warm light in the halls
  for (const b of cleanAreas(L)) {
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    glow(GLOW_COLORS.amber, cx, cy, 0.4, 5, 0.12);
  }
}

/** The street lamp's head, from its anchor (screen px); the floodlight mast's height (tiles). */
const LAMP_DX = isoX(0.2, 0) - isoX(0, 0);
const LAMP_DY = isoY(0.2, 0, 1.27) - isoY(0, 0, 0);
const MAST_H = 2.2;

const PARKED = new Set(['deboarding', 'turnaround', 'boarding', 'doorsClosed']);
const GSE = { gpu: VEHICLE_KINDS.indexOf('gpu'), belt: VEHICLE_KINDS.indexOf('belt'), catering: VEHICLE_KINDS.indexOf('catering'), tug: VEHICLE_KINDS.indexOf('tug'), stairs: VEHICLE_KINDS.indexOf('stairs') };

/**
 * The details of a turnaround (owner request: the small things): chocks at the
 * nose wheel, cones off the wingtips and the tail, and for the bigger planes the
 * ground power unit, the belt loader at the hold, the catering truck lifted to
 * the back door, a stairs truck at a remote stand and the pushback tug waiting
 * at the nose of a jet-bridge plane. Each by its phase and the upgrades bought.
 */
function drawGroundService(w: SnapWriter, s: GameState, f: Flight, sp: SpriteSet, L: TierLayout, visible: (x: number, y: number, r: number) => boolean): void {
  if (!PARKED.has(f.phase) || f.stand < 0 || f.z > 0.01) return;
  const art = planeArt(f.aircraft);
  if (art.engines === 'rotor' || art.engines === 'quad' || art.chord <= 0) return;
  if (!visible(isoX(f.x, f.y), isoY(f.x, f.y), 140)) return;
  const ac = AIRCRAFT[f.aircraft];
  const big = (ac?.paxMax ?? 0) >= 50 || ac?.category === 'cargo';
  const h = f.heading;
  const c = Math.cos(h);
  const sn = Math.sin(h);
  const at = (u: number, v: number): [number, number] => [f.x + u * c - v * sn, f.y + u * sn + v * c];
  const put = (sprite: number, p: [number, number], d = 0) => w.sprite(sprite, isoX(p[0], p[1]), isoY(p[0], p[1]), 1, p[0] + p[1] + d);
  const vehicle = (k: number, p: [number, number], heading: number) => {
    if (k < 0) return;
    const dd = dirIndex(heading);
    w.shadow(sp.vehicleShadow(k, dd), isoX(p[0], p[1]) + 2, isoY(p[0], p[1]) + 2, 1, 0.26);
    put(sp.vehicle(k, dd), p);
  };
  const Lp = art.length;
  const r = art.radius;
  // chocks at the nose wheel, always
  put(sp.chocks, at(Lp * 0.33, 0), 0.02);
  if (!big || s.tier < 2) return;
  // cones off the wingtips and behind the tail
  const half = art.span / 2 + 0.14;
  const tipU = (art.wing === 'high' ? -Lp / 2 + Lp * 0.6 : -Lp / 2 + Lp * 0.52) - art.sweep * 0.8;
  put(sp.cone, at(tipU, -half));
  put(sp.cone, at(tipU, half));
  put(sp.cone, at(-Lp / 2 - 0.18, 0));
  const lv = (id: string) => s.upg[id] ?? 0;
  const bridge = !!L.stands[f.stand]?.bridge;
  // the ground power unit by the nose (the cabin stays cool without the engine running)
  if (lv('gpu') > 0) vehicle(GSE.gpu, at(Lp * 0.3, r + 0.38), h - Math.PI / 2);
  // the belt loader up to the hold while bags come and go
  if (f.phase !== 'doorsClosed') vehicle(GSE.belt, at(Lp * 0.2, -(r + 0.3)), h + Math.PI / 2);
  // the caterer lifted to the back door during the turnaround
  if (lv('catering') > 0 && (f.phase === 'turnaround' || f.phase === 'boarding') && (ac?.paxMax ?? 0) > 0) vehicle(GSE.catering, at(-Lp * 0.4, r + 0.36), h - Math.PI / 2);
  // stairs to the front door at a remote stand
  if (!bridge && s.tier >= 3 && (f.phase === 'deboarding' || f.phase === 'boarding') && (ac?.paxMax ?? 0) > 0) vehicle(GSE.stairs, at(Lp * 0.36, -(r + 0.46)), h - Math.PI / 2);
  // the pushback tug at the nose, ready to push a jet-bridge plane back
  if (bridge && lv('pushback') > 0 && (f.phase === 'boarding' || f.phase === 'doorsClosed')) vehicle(GSE.tug, at(Lp / 2 + 0.3, 0), h + Math.PI);
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

function drawCars(w: SnapWriter, sp: SpriteSet, cars: CarPose[], visible: (x: number, y: number, r: number) => boolean, time: number, moving: boolean, night = 0): void {
  for (const c of cars) {
    const sx = isoX(c.x, c.y);
    const sy = isoY(c.x, c.y);
    if (!visible(sx, sy, 40)) continue;
    const d = dirIndex(c.heading);
    w.shadow(sp.carShadow(c.variant, d), sx + 1.5, sy + 1.5, 1, 0.25);
    w.sprite(sp.car(c.variant, d), sx, sy, 1, c.x + c.y);
    if (moving && night > 0.1 && !c.stopped) {
      // headlights after dark
      for (const v of [-0.05, 0.05]) {
        const p = modelPoint(c.x, c.y, 0, d, 0.22 * VEHICLE_SCALE, v * VEHICLE_SCALE, 0.07 * VEHICLE_SCALE);
        w.fx(sp.glow(GLOW_COLORS.white), p.x, p.y, 0.8, 0.9 * night);
      }
    }
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
/** Where the security cameras go, in order: the main terminal's corners, then the fence's. */
export function cameraSpots(L: TierLayout): [number, number][] {
  const out: [number, number][] = [];
  const corners = (b: readonly number[]) => out.push([b[0] - 0.25, b[1] - 0.25], [b[2] + 0.25, b[3] + 0.25], [b[2] + 0.25, b[1] - 0.25], [b[0] - 0.25, b[3] + 0.25]);
  const T3 = bigTerminal(L, 1);
  if (T3) corners(T3.building.box);
  if (L.building) corners(L.building.box);
  const F = L.field;
  out.push([F.x0 + 0.4, F.y1 - 0.4], [F.x1 - 0.4, F.y1 - 0.4], [F.x1 - 0.4, F.y0 + 0.4], [F.x0 + 0.4, F.y0 + 0.4]);
  return out;
}

/** A patrol car's place on its round inside the fence (x, y and heading) at time t (in rounds of 1 per perimeter tile... by distance). */
export function patrolRound(L: TierLayout, dist: number): [number, number, number] {
  const F = L.field;
  const x0 = F.x0 + 0.8;
  const x1 = F.x1 - 0.8;
  const y0 = F.y0 + 0.8;
  const y1 = F.y1 - 0.8;
  const w = x1 - x0;
  const h = y1 - y0;
  let d = ((dist % (2 * (w + h))) + 2 * (w + h)) % (2 * (w + h));
  if (d < w) return [x0 + d, y1, 0];
  d -= w;
  if (d < h) return [x1, y1 - d, -Math.PI / 2];
  d -= h;
  if (d < w) return [x1 - d, y0, Math.PI];
  d -= w;
  return [x0, y0 + d, Math.PI / 2];
}

/** Where the Aviation Guide's pylon stands: in front of Terminal 3 (or Terminal 1, or by the hut). */
export function guidePylonSpot(L: TierLayout): [number, number] {
  const T3 = bigTerminal(L, 1);
  if (T3) {
    const ins = T3.st.entrances ?? [T3.st.doors!.entrance];
    const x = ins.length > 1 ? (ins[0][0] + ins[1][0]) / 2 : ins[0][0] + 1.6;
    return [x, T3.building.box[1] - 0.45];
  }
  if (L.building) return [L.building.box[2] + 0.55, L.building.box[1] + 0.5];
  return [L.terminal.entry[0] - 1.2, L.terminal.entry[1] - 1.4];
}

export function decorItems(s: GameState): { id: string }[] {
  const lv = (id: string) => s.upg[id] ?? 0;
  const out: { id: string }[] = [];
  if (lv('kiosk') > 0) out.push({ id: 'kiosk' });
  if (lv('billboard') > 0) out.push({ id: 'billboard' });
  if (lv('benches') > 0) out.push({ id: 'bench1' });
  if (lv('benches') >= 10) out.push({ id: 'bench2' });
  return out;
}

/** A movable decoration's sprite: its version by the upgrade's level (the LED screens change adverts). */
function spriteOf(sp: SpriteSet, id: string, s: GameState, time: number): number {
  const lv = (k: string) => s.upg[k] ?? 0;
  if (id === 'kiosk') return sp.kioskV(versionOf('kiosk', lv('kiosk')));
  if (id === 'billboard') return sp.billboardV(versionOf('billboard', lv('billboard')), Math.floor(time / 3));
  return versionOf('benches', lv('benches')) >= 3 ? sp.pergola : sp.bench;
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
  const plot = L.stands.find((st) => (st.line ?? '') === b.id && (st.level ?? 1) === b.level);
  if (plot) at = plot.pos;
  else if (b.id === 'stand') at = L.stands[Math.min(b.level, L.stands.length - 1)].pos;
  else if (b.id === 'truck2') at = [L.fuel.home[0] + 0.8, L.fuel.home[1] - 0.6];
  else at = [L.bags.home[0] - 0.8, L.bags.home[1] - 0.4];
  return { at, progress: 1 - b.remaining / Math.max(0.001, b.total) };
}

/** Incidents: response vehicles, debris, birds, storm, the air show, VIP carpet, emergency pulse. */
function drawIncidents(
  w: SnapWriter,
  s: GameState,
  sp: SpriteSet,
  o: DrawOptions,
  a: number,
  inv: number,
  visible: (x: number, y: number, r: number) => boolean,
  view: { x0: number; x1: number; y0: number; y1: number },
): void {
  const L = layoutOf(s.tier);
  for (const inc of s.incidents) {
    // response vehicles (shown until they are back at the station)
    for (const u of inc.units) {
      if (u.state === 'home') continue;
      const x = lerp(u.px, u.x, a);
      const y = lerp(u.py, u.y, a);
      const sx = isoX(x, y);
      const sy = isoY(x, y);
      if (!visible(sx, sy, 50)) continue;
      const d = dirIndex(u.heading);
      const k = VEHICLE_KINDS.indexOf(u.kind);
      w.shadow(sp.vehicleShadow(k, d), sx + 2, sy + 2, 1, 0.28);
      w.sprite(sp.vehicle(k, d), sx, sy, 1, x + y);
      if (Math.floor(o.time * 4 + inc.id) % 2 === 0) {
        const b = BEACON[u.kind];
        const p = modelPoint(x, y, 0, d, b.u * VEHICLE_SCALE, b.v * VEHICLE_SCALE, b.h * VEHICLE_SCALE);
        w.fx(sp.glow(u.kind === 'fire' ? GLOW_COLORS.red : u.kind === 'ambulance' || u.kind === 'patrol' ? GLOW_COLORS.blue : GLOW_COLORS.amber), p.x, p.y, 1.1, 0.95);
      } else if (u.kind === 'ambulance') {
        // the ambulance flashes blue and red
        const b = BEACON[u.kind];
        const p = modelPoint(x, y, 0, d, b.u * VEHICLE_SCALE, (b.v + 0.06) * VEHICLE_SCALE, b.h * VEHICLE_SCALE);
        w.fx(sp.glow(GLOW_COLORS.red), p.x, p.y, 1.1, 0.95);
      }
    }
    if (inc.state !== 'active') {
      // the crowd gathers while an air show is announced
      if (inc.kind === 'airshow' && inc.state === 'announced') drawCrowd(w, sp, L, o.time, 0.6);
      continue;
    }
    switch (inc.kind) {
      case 'fod': {
        const sx = isoX(inc.x, inc.y);
        const sy = isoY(inc.x, inc.y);
        w.sprite(sp.debris, sx, sy, 1, inc.x + inc.y - 0.2);
        if (Math.floor(o.time * 2) % 2 === 0) w.fx(sp.glow(GLOW_COLORS.amber), sx, sy - 3, 0.6, 0.8);
        break;
      }
      case 'birds': {
        // a flock wheeling over the touchdown zone
        for (let i = 0; i < 11; i++) {
          const ang = o.time * 0.9 + i * 0.57 + Math.sin(i * 1.7) * 0.4;
          const r = 1.2 + (i % 4) * 0.45;
          const bx = inc.x + Math.cos(ang) * r;
          const by = inc.y - 1.5 + Math.sin(ang) * r * 0.6;
          const bz = 0.9 + (i % 3) * 0.25 + Math.sin(o.time * 2 + i) * 0.08;
          w.over(sp.bird(Math.floor(o.time * 8 + i) % 2), isoX(bx, by), isoY(bx, by, bz), 1.8 * Math.max(1, inv * 0.6));
        }
        break;
      }
      case 'storm': {
        // rain over everything in view, slanting; now and then lightning lights the sky
        const W = view.x1 - view.x0;
        const H = view.y1 - view.y0;
        for (let i = 0; i < 160; i++) {
          const fx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
          const fy = (Math.sin(i * 78.233) * 12543.123) % 1;
          const x = view.x0 + (((fx + 1) % 1) * W + o.time * 60 * inv) % W;
          const y = view.y0 + (((fy + 1) % 1) * H + o.time * 520 * inv) % H;
          w.over(sp.rain, x, y, 1.4 * inv);
        }
        const flash = (o.time * 0.37 + inc.id * 0.13) % 1;
        if (flash < 0.025 || (flash > 0.05 && flash < 0.065)) w.fx(sp.glow(GLOW_COLORS.white), (view.x0 + view.x1) / 2, (view.y0 + view.y1) / 2, 60 * inv, 0.55);
        break;
      }
      case 'airshow':
        drawCrowd(w, sp, L, o.time, 1);
        drawAirshow(w, sp, L, s.time - inc.at + o.alpha / 30);
        break;
      case 'emergency': {
        const f = s.flights.find((x) => x.id === inc.flight);
        if (f && f.dockedAt === 0) {
          const x = lerp(f.px, f.x, a);
          const y = lerp(f.py, f.y, a);
          const z = lerp(f.pz, f.z, a);
          const pulse = 0.5 + 0.5 * Math.sin(o.time * 6);
          w.fx(sp.glow(GLOW_COLORS.red), isoX(x, y), isoY(x, y, z), (2.2 + pulse) * Math.max(1, inv * 0.5), 0.55 + 0.35 * pulse);
        }
        break;
      }
      case 'vip':
        break;
    }
  }
  // VIPs at their stand: red carpet to the door, a black car waiting
  for (const f of s.flights) {
    if (!f.vip || f.dockedAt === 0 || f.offBlockAt > 0) continue;
    const door = doorPoint(L, f.aircraft, f.x, f.y, f.heading);
    w.decal(sp.redCarpet, isoX(door[0], door[1]), isoY(door[0], door[1]), 1, 1);
    const cx = door[0] + 0.55;
    const cy = door[1] - 1.5;
    const car = CAR_VARIANTS.findIndex((c) => c.kind === 'suv' && c.color === '#111827');
    if (car >= 0) w.sprite(sp.car(car, dirIndex(Math.PI * 0.5)), isoX(cx, cy), isoY(cx, cy), 1, cx + cy);
  }
}

/** Spectators lining the apron edge by the parking lot. */
function drawCrowd(w: SnapWriter, sp: SpriteSet, L: TierLayout, time: number, share: number): void {
  const PK = L.parking;
  const n = Math.round(22 * share);
  for (let i = 0; i < n; i++) {
    const x = PK.x0 - 0.4 + (i % 11) * 0.3 + (i >= 11 ? 0.15 : 0);
    const y = PK.y1 + 0.35 + (i >= 11 ? 0.32 : 0);
    const outfit = PAX_OUTFIT_IDX[i % PAX_OUTFIT_IDX.length];
    // a little bounce: they are excited
    const frame = Math.floor(time * 2 + i) % 3 === 0 ? 1 : 4;
    w.sprite(sp.person(outfit, false, i % 2 === 1, frame), isoX(x, y), isoY(x, y), 1, x + y);
  }
}

/** Three aerobatic planes looping over the runway, trailing smoke. */
function drawAirshow(w: SnapWriter, sp: SpriteSet, L: TierLayout, t: number): void {
  const r = L.runway;
  const cx = (r.x0 + r.x1) / 2;
  const cy = r.y - 1.8;
  const combo = sp.comboIndex(0, 0);
  if (combo < 0) return;
  for (let k = 0; k < 3; k++) {
    const pos = (tt: number) => {
      const th = tt * 0.7;
      return {
        x: cx + Math.cos(th) * 6.5 + (k - 1) * 0.9 * Math.sin(th),
        y: cy + Math.sin(th) * 2.6 - (k - 1) * 0.9 * Math.cos(th),
        z: 2.0 + Math.sin(th * 2) * 0.9 + (k === 1 ? 0.3 : 0),
      };
    };
    const p = pos(t);
    const q = pos(t + 0.05);
    const heading = Math.atan2(q.y - p.y, q.x - p.x);
    // smoke: puffs left behind along the path, fading
    for (let j = 1; j <= 14; j++) {
      const s0 = pos(t - j * 0.12);
      w.fx(sp.puff, isoX(s0.x, s0.y), isoY(s0.x, s0.y, s0.z), 0.5 + j * 0.05, Math.max(0, 0.75 - j * 0.05));
    }
    w.sprite(sp.plane(combo, dirIndex(heading)), isoX(p.x, p.y), isoY(p.x, p.y, p.z), 1 / planeRes(0), 2000 + p.x + p.y + p.z);
  }
}
