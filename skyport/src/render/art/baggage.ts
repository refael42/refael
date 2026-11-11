/**
 * Baggage handling in 3D (owner request: the conveyor looked flat and its
 * animation poor): the check-in conveyor in short pieces with a moving rubber
 * belt, the claim carousels (a steel skirt, a slatted belt that turns, a
 * raised island with the feed hatch), and suitcases that ride on them. Drawn
 * with the iso pen, anchored at the piece's (or the carousel's) centre.
 */
import type { IsoPen } from './objects';

/** Animation frames of a moving belt (stripes or slats shift a little each frame). */
export const BELT_FRAMES = 4;
/** Kinds of bag: six hard-shell suitcases, two soft duffels. */
export const BAG_KINDS = 8;
/** The carousel: outer radius, the belt's radius (where bags ride), the island's radius (tiles). */
export const CAROUSEL_R = 0.48;
export const CAROUSEL_BAG_R = 0.355;
const ISLAND_R = 0.23;
/** Height of a belt's top (tiles): bags sit on it. */
export const BELT_Z = 0.1;
/** Length of one conveyor piece (tiles). */
export const BELT_PIECE = 0.5;

const BAG_COLORS = ['#ef4444', '#f59e0b', '#0ea5e9', '#10b981', '#8b5cf6', '#334155', '#be185d', '#475569'];

/** Points of a flat ring (a circle on the floor at height z), as iso poly input. */
function ringPts(r: number, z: number, a0 = 0, a1 = Math.PI * 2, n = 36): number[] {
  const pts: number[] = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    pts.push(Math.cos(a) * r, Math.sin(a) * r, z);
  }
  return pts;
}

/** The side of a cylinder that faces the viewer (outward normals toward +x+y), between two heights. */
function cylinderSide(p: IsoPen, r: number, z0: number, z1: number, color: string): void {
  const a0 = -Math.PI / 4;
  const a1 = (Math.PI * 3) / 4;
  const top = ringPts(r, z1, a0, a1, 24);
  const bottom = ringPts(r, z0, a1, a0, 24);
  p.poly([...top, ...bottom], color, false);
}

/** An annulus (a flat ring between two radii) at height z. */
function annulus(p: IsoPen, r0: number, r1: number, z: number, color: string): void {
  p.poly([...ringPts(r1, z), ...ringPts(r0, z, Math.PI * 2, 0)], color, false);
}

/**
 * The carousel's base: the stainless skirt with a dark kick strip, the steel
 * rim, and the belt of overlapping plates that turns (counter-clockwise from
 * above); `frame` shifts the plates by a quarter of their width.
 */
export function drawCarouselBase(p: IsoPen, frame: number): void {
  const R = CAROUSEL_R;
  p.shadow(0, 0, 26, 12, 0.18);
  // the skirt: brushed steel, a dark kick strip along the floor, a thin highlight under the rim
  cylinderSide(p, R, 0, BELT_Z, '#94a3b8');
  cylinderSide(p, R, 0, 0.025, '#475569');
  cylinderSide(p, R, BELT_Z - 0.015, BELT_Z, '#cbd5e1');
  // the outer rim and the belt of plates
  annulus(p, R - 0.035, R, BELT_Z, '#e2e8f0');
  annulus(p, ISLAND_R, R - 0.035, BELT_Z, '#52627a');
  const n = 18;
  const step = (Math.PI * 2) / n;
  const off = (frame / BELT_FRAMES) * step;
  for (let k = 0; k < n; k++) {
    const a = k * step + off;
    // each plate: a fine dark seam at its leading edge and a soft highlight just behind it
    const seam = (ang: number, color: string, wd: number) =>
      p.line(Math.cos(ang) * (ISLAND_R + 0.01), Math.sin(ang) * (ISLAND_R + 0.01), BELT_Z, Math.cos(ang) * (R - 0.04), Math.sin(ang) * (R - 0.04), BELT_Z, color, wd);
    seam(a, '#334155', 0.9);
    seam(a - step * 0.18, 'rgba(203,213,225,0.45)', 0.8);
  }
  // the belt's inner and outer edges catch the light
  annulus(p, ISLAND_R, ISLAND_R + 0.012, BELT_Z, '#94a3b8');
}

/**
 * The island in the middle of the carousel (drawn on its own, so bags on the far
 * side pass behind it): a steel drum, a sloped top and the feed hatch with its
 * rubber curtain, where the bags come up from the baggage hall.
 */
export function drawCarouselIsland(p: IsoPen): void {
  cylinderSide(p, ISLAND_R, BELT_Z - 0.01, BELT_Z + 0.07, '#94a3b8');
  p.poly(ringPts(ISLAND_R, BELT_Z + 0.07), '#cbd5e1', false);
  p.poly(ringPts(ISLAND_R * 0.62, BELT_Z + 0.1), '#e2e8f0', false);
  // the feed hatch (on the far side): a hood with black curtain strips facing the belt
  p.box(-0.17, -0.1, -0.03, 0.06, BELT_Z + 0.05, BELT_Z + 0.26, '#cbd5e1');
  for (let k = 0; k < 4; k++) {
    const y = -0.085 + k * 0.04;
    p.poly([-0.03, y, BELT_Z + 0.07, -0.03, y + 0.035, BELT_Z + 0.07, -0.03, y + 0.035, BELT_Z + 0.21, -0.03, y, BELT_Z + 0.21], '#0f172a', false);
  }
  p.box(-0.18, -0.11, -0.02, 0.07, BELT_Z + 0.26, BELT_Z + 0.29, '#94a3b8');
  for (let k = 0; k < 4; k++) p.poly([-0.02, -0.1 + k * 0.045, BELT_Z + 0.22, -0.02, -0.1 + k * 0.045 + 0.022, BELT_Z + 0.22, -0.02, -0.1 + k * 0.045 + 0.022, BELT_Z + 0.26, -0.02, -0.1 + k * 0.045, BELT_Z + 0.26], '#facc15', false);
}

/**
 * A bag lying on a belt (local frame: its length along x, or along y). Hard
 * shells: a rounded box with ridges, a handle and a luggage tag; duffels: a
 * soft roll with a strap.
 */
export function drawBeltBag(p: IsoPen, kind: number, alongY: boolean): void {
  const c = BAG_COLORS[((kind % BAG_KINDS) + BAG_KINDS) % BAG_KINDS];
  const L = kind >= 6 ? 0.11 : 0.1 + (kind % 3) * 0.012;
  const W = kind >= 6 ? 0.06 : 0.07;
  const H = kind >= 6 ? 0.06 : 0.05;
  const [x0, y0, x1, y1] = alongY ? [-W, -L, W, L] : [-L, -W, L, W];
  p.shadow(0, 0, 7, 3.2, 0.25);
  if (kind >= 6) {
    // a duffel: a soft roll (two boxes, the top narrower) and a strap across it
    p.box(x0, y0, x1, y1, 0.005, H * 0.6, c);
    const [ix, iy] = alongY ? [W * 0.3, 0] : [0, W * 0.3];
    p.box(x0 + ix, y0 + iy, x1 - ix, y1 - iy, H * 0.6, H, c);
    const [sx, sy] = alongY ? [0, L * 0.2] : [L * 0.2, 0];
    p.line(-sx - (alongY ? W : 0), -sy - (alongY ? 0 : W), H * 0.5, -sx + (alongY ? W : 0), -sy + (alongY ? 0 : W), H * 0.5, '#0f172a', 1.4);
    p.line(sx - (alongY ? W : 0), sy - (alongY ? 0 : W), H * 0.5, sx + (alongY ? W : 0), sy + (alongY ? 0 : W), H * 0.5, '#0f172a', 1.4);
    return;
  }
  p.box(x0, y0, x1, y1, 0.005, H, c);
  // ridges along the shell's top, the zip line round its middle, a handle and a white tag
  for (const t of [-0.5, 0, 0.5]) {
    if (alongY) p.line(t * W, y0 + 0.015, H, t * W, y1 - 0.015, H, 'rgba(255,255,255,0.35)', 0.9);
    else p.line(x0 + 0.015, t * W, H, x1 - 0.015, t * W, H, 'rgba(255,255,255,0.35)', 0.9);
  }
  if (alongY) p.line(x1, y0, H * 0.5, x1, y1, H * 0.5, '#0f172a', 0.8);
  else p.line(x0, y1, H * 0.5, x1, y1, H * 0.5, '#0f172a', 0.8);
  const hx = alongY ? 0 : x1 - 0.02;
  const hy = alongY ? y1 - 0.02 : 0;
  p.box(hx - 0.015, hy - 0.015, hx + 0.015, hy + 0.015, H, H + 0.012, '#0f172a', false);
  if (kind % 2 === 0) p.box(alongY ? x1 - 0.005 : x0 + 0.02, alongY ? y0 + 0.02 : y1 - 0.005, alongY ? x1 + 0.005 : x0 + 0.05, alongY ? y0 + 0.05 : y1 + 0.005, H * 0.3, H * 0.85, '#f8fafc', false);
}

/**
 * One piece of the check-in conveyor (local frame: from -len/2 to +len/2 along
 * x, or along y): low steel side rails on short legs and a black rubber belt
 * with ribs; `frame` moves the ribs along (toward +x, or +y, when `forward`).
 */
export function drawBeltPiece(p: IsoPen, alongY: boolean, frame: number, forward: boolean): void {
  const h = BELT_PIECE / 2 + 0.01;
  const w = 0.13;
  const box = (a0: number, a1: number, b0: number, b1: number, z0: number, z1: number, color: string, outline = false) =>
    alongY ? p.box(b0, a0, b1, a1, z0, z1, color, outline) : p.box(a0, b0, a1, b1, z0, z1, color, outline);
  const line = (a0: number, b0: number, a1: number, b1: number, z: number, color: string, wd: number) =>
    alongY ? p.line(b0, a0, z, b1, a1, z, color, wd) : p.line(a0, b0, z, a1, b1, z, color, wd);
  // legs, the bed, the rubber belt with its ribs, the side rails
  for (const a of [-h + 0.06, h - 0.06]) for (const b of [-w + 0.02, w - 0.04]) box(a - 0.015, a + 0.015, b, b + 0.02, 0, BELT_Z - 0.03, '#64748b');
  box(-h, h, -w, w, BELT_Z - 0.035, BELT_Z - 0.005, '#94a3b8');
  box(-h, h, -w + 0.02, w - 0.02, BELT_Z - 0.006, BELT_Z, '#1e293b');
  const ribs = 5;
  const k0 = ((forward ? frame : BELT_FRAMES - frame) % BELT_FRAMES) / BELT_FRAMES;
  for (let k = 0; k < ribs; k++) {
    const a = -h + ((k + k0) / ribs) * (2 * h);
    line(a, -w + 0.025, a, w - 0.025, BELT_Z + 0.001, '#475569', 1.2);
  }
  for (const b of [-w, w - 0.02]) box(-h, h, b, b + 0.02, BELT_Z - 0.02, BELT_Z + 0.03, '#cbd5e1');
}
