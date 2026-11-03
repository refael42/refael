/**
 * The special events on the map (M11): the paramedics carrying the patient to
 * the ambulance, a celebrity's arrival (red carpet, limousine, the press or
 * the bodyguards), a historic plane on show (rope barrier, visitors, ticket
 * booth) and the holiday decorations by the terminal (string lights, bunting,
 * a centerpiece, candles, a bonfire, fireworks, confetti).
 */
import { HOLIDAYS } from '../data/holidays';
import { MEDICAL_WORK } from '../data/incidents';
import type { TierLayout } from '../data/tiers';
import { hash01 } from '../sim/hash';
import { doorPoint, layoutOf } from '../sim/game/layout';
import type { Flight, GameState, Incident } from '../sim/game/types';
import { BONFIRE_AT, MENORAH_AXIS, MENORAH_FLAMES } from './art/events';
import { OUTFITS, PAX_OUTFITS } from './art/people';
import { isoX, isoY } from './iso';
import type { SnapWriter } from './scene';
import { BULB_COLORS, dirIndex, GLOW_COLORS, ROPE_X, ROPE_Y, VEHICLE_KINDS, type SpriteSet } from './sprites';

const outfit = (id: string) => Math.max(0, OUTFITS.findIndex((o) => o.id === id));
const MEDIC = outfit('medic');
const PRESS = outfit('press');
const GUARD = outfit('guard');
const STAR = outfit('star');
const VISITORS = PAX_OUTFITS.map((id) => outfit(id));
const LIMO = VEHICLE_KINDS.indexOf('limo');

/** Where a bonfire burns (on the grass west of the terminal, well away from the fuel). */
export const BONFIRE_SPOT: readonly [number, number] = [18.3, 19.3];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function person(w: SnapWriter, sp: SpriteSet, o: number, x: number, y: number, back: boolean, mirror: boolean, frame: number): void {
  w.sprite(sp.person(o, back, mirror, frame), isoX(x, y), isoY(x, y), 1, x + y + 0.05);
}

export interface SceneOptions {
  time: number;
  /** Seconds of sim time into the current step (smooth movement between steps). */
  alpha: number;
  inv: number;
  visible: (x: number, y: number, r: number) => boolean;
}

/** The scenes of incidents that play out at a plane (medical, celebrity, historic). */
export function drawEventScenes(w: SnapWriter, s: GameState, sp: SpriteSet, o: SceneOptions): void {
  if (s.incidents.length === 0) return;
  const L = layoutOf(s.tier);
  for (const inc of s.incidents) {
    if (inc.kind !== 'medical' && inc.kind !== 'celebrity' && inc.kind !== 'historic') continue;
    const f = inc.flight ? s.flights.find((x) => x.id === inc.flight) : undefined;
    if (inc.kind === 'medical') drawMedical(w, sp, L, inc, f, o);
    else if (!f || inc.state !== 'active') continue;
    else if (inc.kind === 'celebrity') drawCelebrity(w, sp, L, inc, f, o);
    else drawExhibit(w, s, sp, f, o);
  }
}

/** A sick passenger: a pulse over the plane in the air; at the stand, the paramedics wheel the stretcher to the ambulance. */
function drawMedical(w: SnapWriter, sp: SpriteSet, L: TierLayout, inc: Incident, f: Flight | undefined, o: SceneOptions): void {
  if (f && f.medical && f.dockedAt === 0) {
    const pulse = 0.5 + 0.5 * Math.sin(o.time * 5);
    w.fx(sp.glow(GLOW_COLORS.red), isoX(f.x, f.y), isoY(f.x, f.y, f.z), (1.6 + pulse) * Math.max(1, o.inv * 0.5), 0.4 + 0.3 * pulse);
  }
  const u = inc.units[0];
  if (!u || u.state !== 'work' || !f) return;
  const door = doorPoint(L, f.aircraft, f.x, f.y, f.heading, [u.x, u.y]);
  const rear: [number, number] = [u.x - Math.cos(u.heading) * 0.42, u.y - Math.sin(u.heading) * 0.42];
  const p = Math.min(1, u.pathPos / MEDICAL_WORK);
  // at the door, then across to the ambulance, then lifted in
  const t = p < 0.2 ? 0 : p > 0.85 ? 1 : (p - 0.2) / 0.65;
  const x = lerp(door[0], rear[0], t);
  const y = lerp(door[1], rear[1], t);
  if (p < 0.95 && o.visible(isoX(x, y), isoY(x, y), 30)) {
    w.sprite(sp.stretcher, isoX(x, y), isoY(x, y), 1, x + y + 0.02);
    const dx = rear[0] - door[0];
    const dy = rear[1] - door[1];
    const len = Math.max(0.01, Math.hypot(dx, dy));
    const walk = t > 0 && t < 1 ? Math.floor(o.time * 6) % 4 : 4;
    for (const k of [-1, 1]) {
      const mx = x + (dx / len) * 0.24 * k;
      const my = y + (dy / len) * 0.24 * k;
      person(w, sp, MEDIC, mx, my, k > 0, dx > 0, walk);
    }
  }
  // the ambulance's back doors stand open while they load
  if (p > 0.1) w.fx(sp.glow(GLOW_COLORS.white), isoX(rear[0], rear[1]), isoY(rear[0], rear[1], 0.2), 0.8, 0.5);
}

/** A celebrity at the stand: red carpet, a limousine, and the press (flashes) or the bodyguards. */
function drawCelebrity(w: SnapWriter, sp: SpriteSet, L: TierLayout, inc: Incident, f: Flight, o: SceneOptions): void {
  if (f.dockedAt === 0 || f.offBlockAt > 0) return;
  const door = doorPoint(L, f.aircraft, f.x, f.y, f.heading);
  if (!o.visible(isoX(door[0], door[1]), isoY(door[0], door[1]), 140)) return;
  w.decal(sp.redCarpet, isoX(door[0], door[1]), isoY(door[0], door[1]), 1, 1);
  // the limousine waits across the end of the carpet
  const lx = door[0];
  const ly = door[1] - 1.95;
  if (LIMO >= 0) {
    w.shadow(sp.vehicleShadow(LIMO, dirIndex(0)), isoX(lx, ly) + 2, isoY(lx, ly) + 2, 1, 0.28);
    w.sprite(sp.vehicle(LIMO, dirIndex(0)), isoX(lx, ly), isoY(lx, ly), 1, lx + ly);
  }
  // the star walks the carpet: off the plane to the car, and back to board
  let walk = -1;
  if (f.phase === 'deboarding') walk = Math.min(1, f.deboarded / Math.max(1, f.paxIn) + 0.15);
  else if (f.phase === 'boarding') walk = 1 - Math.min(1, f.boarded / Math.max(1, f.paxOut));
  if (walk >= 0) {
    const sy = door[1] - 0.15 - walk * 1.45;
    const moving = walk > 0.02 && walk < 0.98;
    person(w, sp, STAR, door[0], sy, f.phase === 'deboarding', false, moving ? Math.floor(o.time * 5) % 4 : 4);
    // a little sparkle around them
    const k = Math.floor(o.time * 3) % 3;
    w.fx(sp.glow(GLOW_COLORS.gold), isoX(door[0], sy) + (k - 1) * 6, isoY(door[0], sy, 0.5) - k * 3, 0.6, 0.8);
  }
  if (inc.choice === 0) {
    // the press behind the ropes on both sides, flashes going off
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1;
      const px = door[0] + side * (0.62 + (k % 3) * 0.06);
      const py = door[1] - 0.35 - Math.floor(k / 2) * 0.48;
      person(w, sp, PRESS, px, py, false, side > 0, 4);
      if (hash01(Math.floor(o.time * 6) * 31 + k * 7 + inc.id) > 0.72) w.fx(sp.glow(GLOW_COLORS.white), isoX(px, py) - side * 4, isoY(px, py, 0.42), 1.5, 1);
    }
    const cx = door[0] + 1.0;
    const cy = door[1] - 1.15;
    w.sprite(sp.tvCamera, isoX(cx, cy), isoY(cx, cy), 1, cx + cy);
    person(w, sp, PRESS, cx + 0.22, cy + 0.12, false, true, 4);
  } else {
    // bodyguards in black along the carpet, facing out
    for (let k = 0; k < 4; k++) {
      const side = k % 2 ? 1 : -1;
      const px = door[0] + side * 0.45;
      const py = door[1] - 0.5 - Math.floor(k / 2) * 0.75;
      person(w, sp, GUARD, px, py, false, side > 0, 4);
    }
  }
}

/** A historic plane on show: a rope in front of it, visitors along the rope, a ticket booth and a sign. */
function drawExhibit(w: SnapWriter, s: GameState, sp: SpriteSet, f: Flight, o: SceneOptions): void {
  if (f.dockedAt === 0 || f.offBlockAt > 0 || s.time >= f.holdUntil) return;
  if (!o.visible(isoX(f.x, f.y), isoY(f.x, f.y), 180)) return;
  const x0 = f.x - 1.45;
  const x1 = x0 + ROPE_X;
  const yr = f.y - 1.35;
  w.sprite(sp.rope(false), isoX(x0, yr), isoY(x0, yr), 1, x0 + yr + ROPE_X / 2);
  for (const x of [x0, x1]) w.sprite(sp.rope(true), isoX(x, yr), isoY(x, yr), 1, x + yr + ROPE_Y / 2 + 0.1);
  const bx = f.x + 0.95;
  const by = f.y - 2.1;
  w.sprite(sp.ticketBooth, isoX(bx, by), isoY(bx, by), 1, bx + by + 0.6);
  const ix = f.x - 1.35;
  const iy = f.y - 1.75;
  w.sprite(sp.infoSign, isoX(ix, iy), isoY(ix, iy), 1, ix + iy + 0.2);
  // visitors along the rope (a few strolling), one queueing at the booth
  const n = 11;
  for (let k = 0; k < n; k++) {
    const h = hash01(f.id * 97 + k * 13);
    const stroll = k % 4 === 0;
    let px = x0 + 0.15 + (k / (n - 1)) * (ROPE_X - 0.3) + (h - 0.5) * 0.12;
    if (stroll) px += Math.sin(o.time * 0.4 + k) * 0.3;
    const py = yr - 0.22 - (k % 3) * 0.17 - h * 0.05;
    const oi = VISITORS[(k * 5 + Math.floor(h * 7)) % VISITORS.length];
    const frame = stroll ? Math.floor(o.time * 4 + k) % 4 : 4;
    person(w, sp, oi, px, py, false, stroll ? Math.cos(o.time * 0.4 + k) < 0 : h > 0.5, frame);
    // a photo now and then
    if (hash01(Math.floor(o.time * 2) * 17 + k * 3 + f.id) > 0.93) w.fx(sp.glow(GLOW_COLORS.white), isoX(px, py) + 3, isoY(px, py, 0.4), 1.1, 0.95);
  }
  person(w, sp, VISITORS[2], bx + 0.25, by + 0.62, true, false, 4);
}

// ------------------------------------------------------------------ holidays

/** The terminal (or the dirt strip's hut): footprint and roof height, for the string lights. */
function buildingBox(L: TierLayout): { x0: number; y0: number; x1: number; y1: number; z: number; depth: number } {
  const h = L.hut;
  if (L.runway.surface === 'asphalt') return { x0: h[0] - 0.04, y0: h[1] - 0.04, x1: h[0] + 2.64, y1: h[1] + 1.54, z: 1.03, depth: h[0] + 1.3 + h[1] + 0.75 };
  return { x0: h[0], y0: h[1], x1: h[0] + 2, y1: h[1] + 1.4, z: 0.86, depth: h[0] + 1 + h[1] + 0.7 };
}

const BULB_INDEX = new Map(BULB_COLORS.map((c, i) => [c, i]));

/** Decorations while a holiday is on: lights on the roof, bunting over the front, the centerpiece and its live touches. */
export function drawHolidayDecor(w: SnapWriter, s: GameState, sp: SpriteSet, o: SceneOptions): void {
  if (s.holiday < 0) return;
  const def = HOLIDAYS[s.holiday];
  if (!def) return;
  const L = layoutOf(s.tier);
  const B = buildingBox(L);
  if (!o.visible(isoX(B.x0 + 1.3, B.y0 + 0.8), isoY(B.x0 + 1.3, B.y0 + 0.8), 260)) return drawFireworks(w, s, sp, o, B);
  // string lights along the two roof edges you see; every few seconds they chase
  const bulbs: [number, number][] = [];
  for (let x = B.x0; x <= B.x1 + 1e-6; x += 0.14) bulbs.push([x, B.y1]);
  for (let y = B.y1 - 0.14; y >= B.y0 - 1e-6; y -= 0.14) bulbs.push([B.x1, y]);
  const chase = Math.floor(o.time * 2.5);
  bulbs.forEach(([x, y], k) => {
    const c = def.colors[k % def.colors.length];
    const sx = isoX(x, y);
    const sy = isoY(x, y, B.z);
    w.sprite(sp.bulb(BULB_INDEX.get(c) ?? 0), sx, sy, 1, B.depth + 0.6);
    if ((k + chase) % 4 === 0) w.fx(sp.glow(c === '#ffffff' ? GLOW_COLORS.white : GLOW_COLORS.gold), sx, sy, 0.75, 0.55);
  });
  // bunting over the front (where the hut is smaller, a shorter run is enough: it hangs past the corner)
  w.sprite(sp.bunting(s.holiday), isoX(B.x0, B.y1 + 0.02), isoY(B.x0, B.y1 + 0.02, B.z - 0.12), 1, B.depth + 0.7);
  // the centerpiece: on the terminal's roof (a bonfire, and anything at the hut, on the ground)
  const ground = def.id === 'lagBaomer' || L.runway.surface !== 'asphalt';
  const [hx, hy] = def.id === 'lagBaomer' ? BONFIRE_SPOT : ground ? [B.x0 - 0.7, B.y1 + 0.2] : [B.x0 + 0.8, B.y0 + 0.95];
  const hz = ground ? 0 : B.z;
  const pz = (x: number, y: number, z: number) => isoY(x, y, z + hz);
  w.sprite(sp.holidayPiece(s.holiday), isoX(hx, hy), pz(hx, hy, 0), 1, ground ? hx + hy + 0.3 : B.depth + 0.5);
  const flick = (k: number) => 0.8 + 0.25 * Math.sin(o.time * 13 + k * 2.1) + 0.1 * Math.sin(o.time * 31 + k);
  switch (def.id) {
    case 'hanukkah': {
      // one more candle each night (and the shamash that lights them)
      const lit = Math.min(8, s.holidayDay);
      if (lit === 0) break;
      for (let k = 0; k < lit; k++) {
        // lit from the right, the newest on the left
        const [t, fz] = MENORAH_FLAMES[7 - k];
        const fx = hx + t * MENORAH_AXIS;
        const fy = hy - t * MENORAH_AXIS;
        w.fx(sp.glow(GLOW_COLORS.amber), isoX(fx, fy), pz(fx, fy, fz + 0.03), 0.6 * flick(k), 1);
      }
      const [, sz] = MENORAH_FLAMES[8];
      w.fx(sp.glow(GLOW_COLORS.amber), isoX(hx, hy), pz(hx, hy, sz + 0.03), 0.65 * flick(9), 1);
      break;
    }
    case 'lagBaomer': {
      const [bx, by, bz] = BONFIRE_AT;
      const fx = hx + bx;
      const fy = hy + by;
      for (let k = 0; k < 5; k++) w.fx(sp.glow(k % 2 ? GLOW_COLORS.red : GLOW_COLORS.amber), isoX(fx, fy) + (k - 2) * 3.5, isoY(fx, fy, bz + k * 0.07), (2.0 - k * 0.25) * flick(k), 0.95);
      // sparks rising
      for (let k = 0; k < 5; k++) {
        const t = (o.time * 0.7 + k * 0.2) % 1;
        w.fx(sp.glow(GLOW_COLORS.amber), isoX(fx, fy) + Math.sin(k * 3 + o.time) * 8, isoY(fx, fy, bz + 0.2 + t * 1.2), 0.3, 1 - t);
      }
      break;
    }
    case 'halloween':
      // the carved faces glow
      for (const [dx, dy] of [
        [-0.25, 0],
        [0.18, 0.12],
      ])
        w.fx(sp.glow(GLOW_COLORS.amber), isoX(hx + dx, hy + dy + 0.3), pz(hx + dx, hy + dy + 0.3, 0.25), 0.7 * flick(dx * 10), 0.7);
      break;
    case 'purim': {
      // confetti drifting down over the plaza
      for (let k = 0; k < 18; k++) {
        const t = (o.time * 0.25 + hash01(k * 7 + 3)) % 1;
        const cx = hx - 1 + hash01(k * 11 + 1) * 3.6;
        const cy = hy - 0.6 + hash01(k * 13 + 2) * 1.6;
        const c = def.colors[k % def.colors.length];
        w.over(sp.bulb(BULB_INDEX.get(c) ?? 0), isoX(cx, cy) + Math.sin(o.time * 2 + k) * 5, isoY(cx, cy, 2.2 * (1 - t)), 0.8);
      }
      break;
    }
  }
  drawFireworks(w, s, sp, o, B);
}

/** Independence Day and New Year: bursts over the terminal every couple of seconds. */
function drawFireworks(w: SnapWriter, s: GameState, sp: SpriteSet, o: SceneOptions, B: { x0: number; y0: number }): void {
  const def = HOLIDAYS[s.holiday];
  if (!def || (def.id !== 'independence' && def.id !== 'newYear') || s.holidayDay === 0) return;
  const colors = def.id === 'independence' ? [GLOW_COLORS.blue, GLOW_COLORS.gold, GLOW_COLORS.blue, GLOW_COLORS.purple] : [GLOW_COLORS.gold, GLOW_COLORS.red, GLOW_COLORS.purple, GLOW_COLORS.pink, GLOW_COLORS.green];
  const PERIOD = 2.2;
  for (let lane = 0; lane < 2; lane++) {
    const tt = o.time / PERIOD + lane * 0.5;
    const n = Math.floor(tt);
    const t = tt - n;
    const h = (k: number) => hash01(n * 131 + lane * 977 + k);
    const x = B.x0 - 2 + h(1) * 6;
    const y = B.y0 - 3 + h(2) * 3;
    const z = 2.6 + h(3) * 1.4;
    const cx = isoX(x, y);
    const cy = isoY(x, y, z);
    if (!o.visible(cx, cy, 80)) continue;
    const c = colors[Math.floor(h(4) * colors.length)];
    if (t < 0.25) {
      // the rocket going up
      const zz = z * (t / 0.25);
      w.fx(sp.glow(GLOW_COLORS.gold), isoX(x, y), isoY(x, y, zz), 0.45, 0.9);
      continue;
    }
    const e = (t - 0.25) / 0.75;
    const r = 8 + e * 52;
    const fade = 1 - e * e;
    w.fx(sp.glow(c), cx, cy, 6 * (1 - e) + 1.5, 0.7 * fade);
    for (let ring = 0; ring < 2; ring++) {
      const rr = r * (ring ? 0.55 : 1);
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * Math.PI * 2 + h(5) + ring * 0.2;
        const sx = cx + Math.cos(ang) * rr;
        const sy = cy + Math.sin(ang) * rr * 0.9 + e * e * 16;
        w.fx(sp.glow(k % 4 === 0 ? GLOW_COLORS.white : c), sx, sy, ring ? 1.0 : 1.4, fade);
        // a short trail behind each spark
        if (!ring) w.fx(sp.glow(c), cx + Math.cos(ang) * rr * 0.8, cy + Math.sin(ang) * rr * 0.72 + e * e * 12, 0.8, fade * 0.6);
      }
    }
  }
}
