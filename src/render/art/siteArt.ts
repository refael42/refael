import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onFaceX, onFaceY, P, rectIn } from './iso3d';
import { fill, path, stroke, type Pt } from './kit';

// Construction, done properly (owner: "make the building areas look better and more
// professional"): the lot of a new building gets a site fence, safety-netted scaffolding, a
// tower crane, a site office and its materials; a big upgrade in progress gets a taped-off work
// zone with a barricade and cones; build mode marks the tiles like a planner's grid.

const SAFETY = '#FF8A1F';
const HAZARD = '#F6C33A';
const INK = '#2A2230';
const STEEL = '#B9BEC8';
const CRANE = '#F2B417';

const line = (c: SkCanvas, a: Pt, b: Pt, color: string, w: number, alpha = 1) => c.drawPath(path.polyline([a, b]), stroke(color, w, alpha));

/** A traffic cone with its two white bands, standing at (x, y). */
export function cone(c: SkCanvas, x: number, y: number, scale = 1) {
  const [bx, by] = P(x, y, 0);
  const w = 5.2 * scale;
  const h = 15 * scale;
  c.drawPath(path.oval(bx, by + 0.5, w + 2.4, (w + 2.4) * 0.5), fill('#20161E', 0.35));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(bx - w - 1.6, by - 2.2, (w + 1.6) * 2, 3.4), 1.2, 1.2), fill('#3A3036'));
  c.drawPath(path.poly([[bx - w, by - 1.4], [bx + w, by - 1.4], [bx + 1.2, by - h], [bx - 1.2, by - h]]), fill(SAFETY));
  c.drawPath(path.poly([[bx, by - 1.4], [bx + w, by - 1.4], [bx + 1.2, by - h], [bx, by - h]]), fill(darken(SAFETY, 0.18)));
  for (const [u, v] of [[0.32, 0.46], [0.62, 0.74]] as const) {
    const wu = w - (w - 1.2) * u;
    const wv = w - (w - 1.2) * v;
    c.drawPath(path.poly([[bx - wu, by - 1.4 - (h - 1.4) * u], [bx + wu, by - 1.4 - (h - 1.4) * u], [bx + wv, by - 1.4 - (h - 1.4) * v], [bx - wv, by - 1.4 - (h - 1.4) * v]]), fill('#FFFFFF', 0.92));
  }
}

/** Black and yellow tape on the floor around a square of `half` tiles. */
export function hazardTape(c: SkCanvas, half: number) {
  const corners: Pt[] = [P(-half, -half), P(half, -half), P(half, half), P(-half, half)];
  c.drawPath(path.poly(corners), fill(HAZARD, 0.1));
  for (let k = 0; k < 4; k++) {
    const a = corners[k]!;
    const b = corners[(k + 1) % 4]!;
    line(c, a, b, HAZARD, 3);
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      if (i % 2) continue;
      const u0 = i / n;
      const u1 = (i + 1) / n;
      line(c, [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0], [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1], INK, 3);
    }
  }
}

/** The orange diamond "men at work" sign: a worker with a shovel, centered at (sx, sy). */
function workSign(c: SkCanvas, sx: number, sy: number, r: number) {
  c.drawPath(path.poly([[sx, sy - r - 1.2], [sx + r + 1.2, sy], [sx, sy + r + 1.2], [sx - r - 1.2, sy]]), fill(INK));
  c.drawPath(path.poly([[sx, sy - r], [sx + r, sy], [sx, sy + r], [sx - r, sy]]), fill(SAFETY));
  const k = r / 9;
  c.drawCircle(sx - 0.6 * k, sy - 4.6 * k, 1.4 * k, fill(INK));
  c.drawPath(path.polyline([[sx - 0.8 * k, sy - 3 * k], [sx - 1.6 * k, sy + 1.2 * k], [sx - 3.2 * k, sy + 4.6 * k]]), stroke(INK, 1.3 * k));
  c.drawPath(path.polyline([[sx - 1.6 * k, sy + 1.2 * k], [sx + 0.4 * k, sy + 4.6 * k]]), stroke(INK, 1.3 * k));
  c.drawPath(path.polyline([[sx - 1 * k, sy - 1.6 * k], [sx + 2.4 * k, sy - 0.2 * k]]), stroke(INK, 1.1 * k));
  c.drawPath(path.polyline([[sx + 2.4 * k, sy - 2.6 * k], [sx + 3.4 * k, sy + 3.6 * k]]), stroke(INK, 1 * k));
  c.drawPath(path.poly([[sx + 2.6 * k, sy + 3.2 * k], [sx + 4.6 * k, sy + 3.4 * k], [sx + 4 * k, sy + 5 * k]]), fill(INK));
  c.drawPath(path.oval(sx + 1.4 * k, sy + 4.8 * k, 2.4 * k, 0.8 * k), fill(INK));
}

// ---------- a big upgrade in progress ----------

/** Taped off in front of a station: the A-frame barricade with its sign and amber lamp, cones, a toolbox. */
export const workBarrier = sprite([-40, -56, 40, 16], (c) => {
  hazardTape(c, 0.46);
  floorShadow(c, 0, 0, 0.45, 0.2);
  // The barricade's A-frame legs, then its striped board facing the camera.
  for (const x of [-0.34, 0.34]) {
    for (const y of [-0.09, 0.09]) line(c, P(x, y, 0), P(x, 0, 20), '#8E95A1', 1.8);
    box(c, { x, y: 0, w: 0.06, d: 0.24, h: 1.6, color: '#4A4F5A' });
  }
  box(c, { x: 0, y: 0, z: 13, w: 0.82, d: 0.05, h: 8, color: '#F7F4EE', rim: true });
  for (let i = 0; i < 5; i++) {
    const a = -0.41 + i * 0.17;
    c.drawPath(path.poly([P(a, 0.026, 13), P(a + 0.075, 0.026, 13), P(Math.min(0.41, a + 0.15), 0.026, 21), P(Math.min(0.41, a + 0.075), 0.026, 21)]), fill('#E8502A'));
  }
  // The sign on its post above the middle.
  line(c, P(0, 0.03, 21), P(0, 0.03, 27), '#6E7480', 1.6);
  const [sx, sy] = P(0, 0.03, 34);
  workSign(c, sx, sy, 8);
  // The amber lamp (the renderer pulses its halo).
  const [lx, ly] = P(0.36, 0, 24);
  c.drawCircle(lx, ly + 0.8, 3, fill('#5A3A10'));
  c.drawCircle(lx, ly, 2.8, fill('#FFB020'));
  c.drawCircle(lx - 0.8, ly - 0.8, 1, fill('#FFF1C8'));
  cone(c, -0.4, 0.34, 0.9);
  cone(c, 0.42, -0.36, 0.9);
  // A red toolbox by the barricade.
  box(c, { x: -0.18, y: 0.3, w: 0.2, d: 0.11, h: 6, color: '#D23A2E', rim: true });
  line(c, P(-0.24, 0.3, 8), P(-0.12, 0.3, 8), INK, 1.2);
});

/** Where a showpiece is going in: a strapped crate on a pallet, the plans rolled on top, a hard hat, cones. */
export const workCrate = sprite([-40, -54, 40, 16], (c) => {
  hazardTape(c, 0.47);
  floorShadow(c, 0, 0, 0.42, 0.26);
  // The pallet.
  box(c, { x: 0, y: 0, w: 0.72, d: 0.72, h: 4, color: '#B9874E' });
  for (const a of [0.1, 0.36, 0.62]) onFaceY(c, 0.36, -0.36, () => rectIn(c, a - 0.04, 0.6, 0.08, 2.4, '#4A3020'));
  // The crate, braced and strapped.
  const W = '#C99A5B';
  box(c, { x: 0, y: 0, z: 4, w: 0.6, d: 0.6, h: 20, color: W, rim: true });
  // Frame boards and an X brace on the two faces we see (lines in world space: a face's own
  // transform would stretch a stroke a tile wide).
  onFaceY(c, 0.3, -0.3, () => {
    rectIn(c, 0, 5, 0.6, 1.4, darken(W, 0.25));
    rectIn(c, 0, 21.6, 0.6, 1.4, darken(W, 0.25));
  });
  onFaceX(c, 0.3, 0.3, () => {
    rectIn(c, 0, 5, 0.6, 1.4, darken(W, 0.35));
    rectIn(c, 0, 21.6, 0.6, 1.4, darken(W, 0.35));
  });
  for (const [a, b] of [[P(-0.27, 0.3, 7), P(0.27, 0.3, 21)], [P(-0.27, 0.3, 21), P(0.27, 0.3, 7)], [P(0.3, 0.27, 7), P(0.3, -0.27, 21)], [P(0.3, 0.27, 21), P(0.3, -0.27, 7)]] as const) line(c, a, b, darken(W, 0.32), 1.4);
  // Two steel straps over the top.
  for (const a of [-0.12, 0.12]) {
    line(c, P(a, -0.3, 24), P(a, 0.3, 24), '#4E5866', 1.4);
    line(c, P(a, 0.3, 24), P(a, 0.3, 4), '#4E5866', 1.2);
  }
  // The plans, rolled up, and the hard hat.
  const [tx, ty] = P(-0.1, 0.05, 25);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(tx - 9, ty - 3.2, 16, 4.4), 2.2, 2.2), fill('#3C7DD6'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(tx - 9, ty - 3.2, 16, 1.4), 0.7, 0.7), fill('#8FC0FF'));
  c.drawCircle(tx + 7, ty - 1, 2.2, fill('#DCEBFF'));
  const [hx, hy] = P(0.12, -0.08, 24);
  const hat: Pt[] = [[hx - 8, hy - 1], [hx - 6, hy - 7], [hx, hy - 9.5], [hx + 6, hy - 7], [hx + 8, hy - 1]];
  c.drawPath(path.smooth(hat, true, 0.8), fill(HAZARD));
  c.drawPath(path.smooth(hat, true, 0.8), stroke(darken(HAZARD, 0.4), 1));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(hx - 10, hy - 2, 20, 3), 1.4, 1.4), fill(darken(HAZARD, 0.1)));
  line(c, [hx, hy - 9.2], [hx, hy - 2.4], darken(HAZARD, 0.3), 1.2);
  cone(c, 0.44, 0.38, 0.9);
  cone(c, -0.44, 0.4, 0.9);
});

// ---------- the lot of a new building ----------

/** One tile of scaffolding along an edge: two rows of poles, braces, planks with toe boards, a safety net over the top, a ladder on some. */
function scaffold(c: SkCanvas, alongX: boolean, ladder: boolean) {
  const at = (u: number, v: number, z = 0) => (alongX ? P(u, v, z) : P(v, u, z));
  const pole = (u: number, v: number) => box(c, { ...(alongX ? { x: u, y: v } : { x: v, y: u }), w: 0.06, d: 0.06, h: 96, color: STEEL });
  for (const u of [-0.48, 0.48]) for (const v of [-0.2, 0.2]) pole(u, v);
  // Cross braces on the outer face.
  for (const [z0, z1] of [[2, 32], [32, 62], [62, 92]] as const) line(c, at(-0.48, 0.21, z0), at(0.48, 0.21, z1), '#8E95A1', 1.3);
  // Planks and toe boards on three lifts.
  for (const z of [30, 60, 90]) {
    box(c, { ...(alongX ? { x: 0, y: 0, w: 1, d: 0.42 } : { x: 0, y: 0, w: 0.42, d: 1 }), z, h: 2.6, color: '#C8914F', rim: true });
    box(c, { ...(alongX ? { x: 0, y: 0.2, w: 1, d: 0.03 } : { x: 0.2, y: 0, w: 0.03, d: 1 }), z: z + 2.6, h: 4, color: '#E0A85C' });
    // The guard rail.
    line(c, at(-0.48, 0.21, z + 14), at(0.48, 0.21, z + 14), '#D9DEE5', 1.6);
  }
  if (ladder) {
    for (const s of [-0.12, 0.12]) line(c, at(s, 0.22, 2), at(s, 0.22, 30), '#6E7480', 1.6);
    for (let z = 6; z < 30; z += 5) line(c, at(-0.12, 0.22, z), at(0.12, 0.22, z), '#6E7480', 1.2);
  }
  // The debris net over the top two lifts, see-through.
  const net = [at(-0.5, 0.23, 34), at(0.5, 0.23, 34), at(0.5, 0.23, 96), at(-0.5, 0.23, 96)];
  c.drawPath(path.poly(net), fill('#2E9E58', 0.42));
  for (let z = 40; z < 96; z += 8) line(c, at(-0.5, 0.23, z), at(0.5, 0.23, z), '#1E6E3C', 0.6, 0.6);
  for (let u = -0.4; u < 0.5; u += 0.2) line(c, at(u, 0.23, 34), at(u, 0.23, 96), '#1E6E3C', 0.6, 0.6);
}
export const scaffoldX = sprite([-34, -112, 34, 22], (c) => scaffold(c, true, false));
export const scaffoldY = sprite([-34, -112, 34, 22], (c) => scaffold(c, false, false));
export const scaffoldXLadder = sprite([-34, -112, 34, 22], (c) => scaffold(c, true, true));
export const scaffoldYLadder = sprite([-34, -112, 34, 22], (c) => scaffold(c, false, true));

/** A site fence panel along x (the lot's street side): navy boards, a gold band, the restaurant's star now and then. */
function hoarding(c: SkCanvas, logo: boolean) {
  const NAVY = '#22304A';
  floorShadow(c, 0, 0.05, 0.4, 0.18);
  for (const x of [-0.48, 0.48]) box(c, { x, y: 0, w: 0.06, d: 0.1, h: 40, color: '#4A5466' });
  box(c, { x: 0, y: 0, z: 2, w: 0.98, d: 0.04, h: 36, color: NAVY });
  onFaceY(c, 0.02, -0.49, () => {
    rectIn(c, 0, 26, 0.98, 3.2, '#E2B13C');
    rectIn(c, 0, 8, 0.98, 1, lighten(NAVY, 0.12));
    for (const a of [0.24, 0.49, 0.74]) rectIn(c, a, 2, 0.008, 36, darken(NAVY, 0.25));
  });
  if (logo) {
    const [cx, cy] = P(0, 0.03, 16);
    c.drawCircle(cx, cy, 6.4, fill('#E2B13C'));
    c.drawCircle(cx, cy, 5.2, fill(NAVY));
    const star: Pt[] = Array.from({ length: 10 }, (_, k) => {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? 1.8 : 4.2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
    c.drawPath(path.poly(star), fill('#FFD23F'));
  }
  // Feet blocks.
  for (const x of [-0.48, 0.48]) box(c, { x, y: 0.02, w: 0.16, d: 0.22, h: 4, color: '#9AA1AC' });
}
export const siteFence = sprite([-34, -58, 34, 20], (c) => hoarding(c, false));
export const siteFenceLogo = sprite([-34, -58, 34, 20], (c) => hoarding(c, true));

/** The tower crane: a lattice mast, the cab, the long jib to the front and its counterweight. The hook hangs from `CRANE_HOOK` (drawn by the renderer). */
export const CRANE_TOP = 196;
export const CRANE_HOOK = 2.6;
export const siteCrane = sprite([-80, -268, 150, 24], (c) => {
  floorShadow(c, 0.4, 0.4, 1.4, 0.24);
  // The concrete base and the mast.
  box(c, { x: 0, y: 0, w: 0.9, d: 0.9, h: 8, color: '#A7ADB6', rim: true });
  // The mast: an open lattice, four chords braced in a zigzag (the back ones first, darker).
  const m = 0.17;
  for (const [x, y] of [[-m, -m], [m, -m], [-m, m]] as const) box(c, { x, y, z: 8, w: 0.045, d: 0.045, h: CRANE_TOP - 8, color: x < 0 && y < 0 ? darken(CRANE, 0.3) : CRANE });
  for (let z = 8; z < CRANE_TOP - 4; z += 14) {
    line(c, P(-m, -m, z), P(-m, m, z + 14), darken(CRANE, 0.42), 1);
    line(c, P(-m, -m, z), P(m, -m, z + 14), darken(CRANE, 0.42), 1);
  }
  box(c, { x: m, y: m, z: 8, w: 0.05, d: 0.05, h: CRANE_TOP - 8, color: CRANE });
  for (let z = 8; z < CRANE_TOP - 4; z += 14) {
    line(c, P(-m, m, z), P(m, m, z), darken(CRANE, 0.2), 1.3);
    line(c, P(m, m, z), P(m, -m, z), darken(CRANE, 0.3), 1.3);
    line(c, P(-m, m, z), P(m, m, z + 14), darken(CRANE, 0.25), 1.2);
    line(c, P(m, m, z), P(m, -m, z + 14), darken(CRANE, 0.35), 1.2);
  }
  // The slewing ring, the cab (glass to the front), the apex.
  box(c, { x: 0, y: 0, z: CRANE_TOP, w: 0.5, d: 0.5, h: 5, color: '#4A5466' });
  box(c, { x: 0.18, y: 0.32, z: CRANE_TOP - 14, w: 0.34, d: 0.3, h: 16, color: '#F7F4EE', rim: true });
  onFaceY(c, 0.47, 0.01, () => rectIn(c, 0.04, 4, 0.26, 9, '#7FC4E8'));
  line(c, P(0, 0, CRANE_TOP + 5), P(0, 0, CRANE_TOP + 40), darken(CRANE, 0.2), 3);
  // The jib to the front (+x) and the counter jib behind, a lattice each.
  box(c, { x: 1.5, y: 0, z: CRANE_TOP + 5, w: 3.6, d: 0.16, h: 9, color: CRANE });
  for (let x = -0.2; x < 3.2; x += 0.3) {
    line(c, P(x, 0.08, CRANE_TOP + 5), P(x + 0.15, 0.08, CRANE_TOP + 14), darken(CRANE, 0.35), 1);
    line(c, P(x + 0.15, 0.08, CRANE_TOP + 14), P(x + 0.3, 0.08, CRANE_TOP + 5), darken(CRANE, 0.35), 1);
  }
  box(c, { x: -0.8, y: 0, z: CRANE_TOP + 5, w: 1.2, d: 0.2, h: 7, color: CRANE });
  box(c, { x: -1.2, y: 0, z: CRANE_TOP - 6, w: 0.4, d: 0.36, h: 14, color: '#8E949E', rim: true });
  // The tie bars from the apex.
  line(c, P(0, 0, CRANE_TOP + 40), P(3.2, 0, CRANE_TOP + 14), '#5A5040', 1.3);
  line(c, P(0, 0, CRANE_TOP + 40), P(-1.3, 0, CRANE_TOP + 12), '#5A5040', 1.3);
  // The trolley the hook hangs from, and a red light at the tip.
  box(c, { x: CRANE_HOOK, y: 0, z: CRANE_TOP + 1, w: 0.18, d: 0.22, h: 4, color: '#4A5466' });
  const [rx, ry] = P(3.3, 0, CRANE_TOP + 15);
  c.drawCircle(rx, ry, 2, fill('#FF3B30'));
});
/** One px of the hook's cable (the renderer stretches it from the trolley down to the hook). */
export const siteCable = sprite([-1, 0, 1, 100], (c) => c.drawRect(Skia.XYWHRect(-0.6, 0, 1.2, 100), fill('#2B2F38')));
/** The hook and its load: a bundle of steel beams on two slings. */
export const siteHook = sprite([-30, -6, 30, 34], (c) => {
  c.drawPath(path.polyline([[0, 0], [0, 6]]), stroke('#2B2F38', 1.2));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-3, 5, 6, 5), 1.4, 1.4), fill(HAZARD));
  c.drawPath(path.polyline([[-1, 10], [-16, 22]]), stroke('#4A4F5A', 1));
  c.drawPath(path.polyline([[1, 10], [16, 18]]), stroke('#4A4F5A', 1));
  c.drawPath(path.poly([[-24, 22], [12, 14], [26, 18], [-10, 27]]), fill('#7A3A2A'));
  c.drawPath(path.poly([[-24, 22], [-10, 27], [-10, 30], [-24, 25]]), fill('#5A2A20'));
  c.drawPath(path.poly([[-10, 27], [26, 18], [26, 21], [-10, 30]]), fill('#4A2018'));
});

/** The site office: a white cabin with a blue band, windows and a door, steps, an AC unit. */
export const siteCabin = sprite([-78, -70, 78, 30], (c) => {
  floorShadow(c, 0, 0, 1, 0.24);
  for (const x of [-0.85, 0.85]) for (const y of [-0.38, 0.38]) box(c, { x, y, w: 0.12, d: 0.12, h: 4, color: '#6E7480' });
  box(c, { x: 0, y: 0, z: 4, w: 1.9, d: 0.9, h: 36, color: '#E8ECEF', rim: true });
  box(c, { x: 0, y: 0, z: 40, w: 1.96, d: 0.96, h: 3, color: '#5E6672', rim: true });
  onFaceY(c, 0.45, -0.95, () => {
    rectIn(c, 0, 30, 1.9, 4, '#2F6FD6');
    for (const a of [0.14, 0.62, 1.38]) {
      rectIn(c, a, 14, 0.34, 12, '#3E4A5C');
      rectIn(c, a + 0.02, 15, 0.3, 10, '#8CC8EE');
      rectIn(c, a + 0.02, 15, 0.3, 3, '#C4E6FA');
    }
    rectIn(c, 1.04, 4, 0.24, 24, '#5E6672');
    rectIn(c, 1.06, 5, 0.2, 22, '#7E8794');
    c.drawCircle(1.22, 16, 0.6, fill('#E2B13C'));
  });
  onFaceX(c, 0.95, 0.45, () => {
    rectIn(c, 0.2, 18, 0.5, 9, '#3E4A5C');
    rectIn(c, 0.22, 19, 0.46, 7, '#8CC8EE');
    rectIn(c, 0, 30, 0.9, 4, '#2F6FD6');
  });
  // The steps up to the door and the AC on the side.
  box(c, { x: 0.2, y: 0.62, w: 0.36, d: 0.3, h: 4, color: '#9AA1AC', rim: true });
  box(c, { x: 1.02, y: -0.1, z: 22, w: 0.12, d: 0.34, h: 10, color: '#C9CED6', rim: true });
});

/** A pallet of bricks, wrapped. */
export const siteBricks = sprite([-34, -40, 34, 16], (c) => {
  floorShadow(c, 0, 0, 0.45, 0.24);
  box(c, { x: 0, y: 0, w: 0.74, d: 0.74, h: 4, color: '#B9874E' });
  box(c, { x: 0, y: 0, z: 4, w: 0.66, d: 0.66, h: 22, color: '#B5523A', rim: true });
  for (const z of [9, 14, 19, 24]) {
    onFaceY(c, 0.33, -0.33, () => {
      rectIn(c, 0, z, 0.66, 0.7, '#E6D3C0');
      for (let a = (z / 5) % 2 ? 0.08 : 0.2; a < 0.66; a += 0.24) rectIn(c, a, z - 4.4, 0.01, 4.4, '#E6D3C0');
    });
    onFaceX(c, 0.33, 0.33, () => rectIn(c, 0, z, 0.66, 0.7, '#D9C2AE'));
  }
  // The wrap's shine.
  c.drawPath(path.poly([P(-0.33, 0.33, 26), P(0.1, 0.33, 26), P(-0.2, 0.33, 6), P(-0.33, 0.33, 6)]), fill('#FFFFFF', 0.16));
});

/** A stack of steel I-beams on timber bearers. */
export const siteBeams = sprite([-56, -30, 56, 20], (c) => {
  floorShadow(c, 0, 0, 0.8, 0.22);
  for (const x of [-0.55, 0.55]) box(c, { x, y: 0, w: 0.12, d: 0.6, h: 3, color: '#8A6038' });
  const beam = (y: number, z: number) => {
    box(c, { x: 0, y, z, w: 1.6, d: 0.16, h: 1.6, color: '#8C3E2E' });
    box(c, { x: 0, y, z: z + 1.6, w: 1.6, d: 0.04, h: 5, color: '#7A3424' });
    box(c, { x: 0, y, z: z + 6.6, w: 1.6, d: 0.16, h: 1.6, color: '#9C4A36', rim: true });
  };
  for (const [y, z] of [[-0.18, 3], [0, 3], [0.18, 3], [-0.09, 11.2], [0.09, 11.2]] as const) beam(y, z);
});

/** A cement mixer: the tilted orange drum on its frame (the renderer turns its stripes). */
export const siteMixer = sprite([-30, -46, 30, 14], (c) => {
  floorShadow(c, 0, 0, 0.4, 0.24);
  for (const x of [-0.22, 0.22]) {
    cylinder(c, x, 0.2, 0.07, 0, 6, '#2B2F38', '#4A4F5A');
    box(c, { x, y: 0, z: 4, w: 0.05, d: 0.5, h: 3, color: '#4A5466' });
  }
  box(c, { x: 0, y: 0, z: 6, w: 0.5, d: 0.12, h: 16, color: '#4A5466' });
  const [dx, dy] = P(0, 0, 26);
  c.save();
  c.translate(dx, dy);
  c.rotate(-24, 0, 0);
  c.drawPath(path.poly([[-11, -9], [9, -11], [15, -4], [15, 4], [9, 11], [-11, 9]]), fill(SAFETY));
  c.drawPath(path.poly([[-11, 2], [9, 3], [15, 4], [9, 11], [-11, 9]]), fill(darken(SAFETY, 0.22)));
  c.drawPath(path.oval(15, 0, 2.6, 4.2), fill('#3A3036'));
  for (const x of [-5, 2]) c.drawPath(path.polyline([[x, -10], [x + 1, 10]]), stroke('#FFFFFF', 1.4, 0.7));
  c.restore();
});

/** A floodlight on its tripod mast. */
export const siteLight = sprite([-20, -86, 20, 12], (c) => {
  for (const [x, y] of [[-0.14, -0.1], [0.14, -0.1], [0, 0.16]] as const) line(c, P(x, y, 0), P(0, 0, 22), '#4A4F5A', 1.4);
  box(c, { x: 0, y: 0, z: 20, w: 0.05, d: 0.05, h: 52, color: '#6E7480' });
  const [lx, ly] = P(0, 0, 74);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(lx - 9, ly - 6, 18, 11), 2, 2), fill('#2B2F38'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(lx - 7.4, ly - 4.4, 14.8, 7.8), 1.4, 1.4), fill('#FFF6D6'));
});

/** The construction site's pieces, by `SiteItem` (src/sim/game/step.ts): kept in this order. */
export const SITE_SPRITES = ['siteCrane', 'siteCabin', 'siteBricks', 'siteBeams', 'siteMixer', 'siteLight', 'siteFence', 'siteFenceLogo'] as const;

export const siteSprites = {
  workBarrier, workCrate, scaffoldX, scaffoldY, scaffoldXLadder, scaffoldYLadder, siteFence, siteFenceLogo, siteCrane, siteCable, siteHook, siteCabin, siteBricks, siteBeams, siteMixer, siteLight,
};
