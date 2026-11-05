/**
 * The railway of the hub: tunnel portals where the line comes out of the
 * hills, the platform roof (in short pieces, so people sort right under it)
 * and the station's entrance pavilion. Drawn with the iso pen, anchored on
 * the ground.
 */
import { IsoPen } from './objects';

/**
 * A tunnel portal: a grassy bank over the track with a concrete arch. The
 * west portal shows its arch (the line runs out of it toward +x); the east
 * one is seen from behind, as a bank the train runs into.
 */
export function drawTunnelPortal(p: IsoPen, west: boolean): void {
  const x0 = west ? -1.8 : 0;
  const x1 = west ? 0 : 1.8;
  p.shadow((x0 + x1) / 2, 0, 60, 30, 0.2);
  p.box(x0, -1.1, x1, 1.1, 0, 0.5, '#4d7c4a');
  p.box(x0 + 0.2, -0.9, x1 - 0.2, 0.9, 0.5, 0.62, '#5f9a5a');
  if (!west) return;
  // the concrete face, the dark opening and its arch
  p.poly([0, -0.6, 0, 0, 0.6, 0, 0, 0.6, 0.62, 0, -0.6, 0.62], '#a8a29e');
  p.poly([0.001, -0.3, 0, 0.001, 0.3, 0, 0.001, 0.3, 0.36, 0.001, 0.15, 0.44, 0.001, -0.15, 0.44, 0.001, -0.3, 0.36], '#1c1917', false);
  p.line(0.002, -0.32, 0.37, 0.002, -0.15, 0.46, '#78716c', 1.6);
  p.line(0.002, -0.15, 0.46, 0.002, 0.15, 0.46, '#78716c', 1.6);
  p.line(0.002, 0.15, 0.46, 0.002, 0.32, 0.37, '#78716c', 1.6);
}

/** One piece of the platform roof (len along x): a glass roof on a post with a white frame, so the train shows through. */
export function drawPlatformRoof(p: IsoPen, len: number, post: boolean): void {
  if (post) {
    p.box(0.05, 0.3, 0.1, 0.35, 0, 0.6, '#94a3b8');
    p.box(0.05, -0.05, 0.1, 0.0, 0, 0.6, '#94a3b8');
  }
  p.poly([0, -0.35, 0.62, len, -0.35, 0.62, len, 0.7, 0.62, 0, 0.7, 0.62], '#bae6fd', false, 1, 0.42);
  p.line(0, -0.35, 0.62, len, -0.35, 0.62, '#f8fafc', 2);
  p.line(0, 0.7, 0.62, len, 0.7, 0.62, '#f8fafc', 2.4);
  p.line(0, -0.35, 0.62, 0, 0.7, 0.62, '#f8fafc', 1.6);
  p.poly([0, 0.7, 0.58, len, 0.7, 0.58, len, 0.7, 0.62, 0, 0.7, 0.62], '#ef4444', false);
}

/** The station's entrance pavilion: a glass box with a roof, a blue train sign on a pole. */
export function drawStationHall(p: IsoPen): void {
  p.shadow(0.6, 0.4, 40, 18, 0.2);
  p.box(0, 0, 1.2, 0.8, 0, 0.5, '#bae6fd');
  for (const x of [0, 0.4, 0.8, 1.2]) p.line(x, 0.8, 0, x, 0.8, 0.5, '#64748b', 1.2);
  for (const y of [0, 0.4, 0.8]) p.line(1.2, y, 0, 1.2, y, 0.5, '#64748b', 1.2);
  p.box(-0.1, -0.1, 1.3, 0.9, 0.5, 0.56, '#e2e8f0');
  // the doors (open) and a sign over them
  p.poly([1.2, 0.25, 0, 1.2, 0.55, 0, 1.2, 0.55, 0.4, 1.2, 0.25, 0.4], '#334155', false);
  p.line(1.5, 0.9, 0, 1.5, 0.9, 0.85, '#475569', 2);
  p.box(1.38, 0.88, 1.62, 0.92, 0.7, 0.95, '#2563eb');
  p.box(1.45, 0.921, 1.55, 0.922, 0.76, 0.88, '#ffffff', false);
}

/**
 * The airport hotel (skyport): a glass tower on a stone base, rows of rooms
 * (some lit), a blue band and a star on the roof, a canopy over the door on
 * the south side. Footprint w x d tiles, anchored at its corner.
 */
export function drawHotel(p: IsoPen, w: number, d: number): void {
  p.shadow(w / 2, d / 2, w * 36, d * 20, 0.28);
  const floors = 9;
  const fh = 0.2;
  const base = 0.3;
  p.box(0, 0, w, d, 0, base, '#d6d3d1');
  // the tower is set back a little on the base
  const x0 = 0.3;
  const y0 = 0.3;
  const x1 = w - 0.3;
  const y1 = d - 0.3;
  const top = base + floors * fh;
  p.box(x0, y0, x1, y1, base, top, '#dbeafe');
  for (let f = 0; f < floors; f++) {
    const z0 = base + f * fh + 0.05;
    const z1 = z0 + fh - 0.08;
    // windows on the two faces you see (some rooms lit)
    for (let x = x0 + 0.15; x < x1 - 0.2; x += 0.42) {
      const lit = ((f * 7 + Math.round(x * 3)) % 5) === 0;
      p.poly([x, y1 + 0.001, z0, x + 0.28, y1 + 0.001, z0, x + 0.28, y1 + 0.001, z1, x, y1 + 0.001, z1], lit ? '#fde68a' : '#60a5fa', false);
    }
    for (let y = y0 + 0.15; y < y1 - 0.2; y += 0.42) {
      const lit = ((f * 5 + Math.round(y * 7)) % 6) === 0;
      p.poly([x1 + 0.001, y, z0, x1 + 0.001, y + 0.28, z0, x1 + 0.001, y + 0.28, z1, x1 + 0.001, y, z1], lit ? '#fde68a' : '#3b82f6', false);
    }
  }
  // the roof: a band, plant room and the star sign
  p.box(x0 - 0.04, y0 - 0.04, x1 + 0.04, y1 + 0.04, top, top + 0.08, '#1d4ed8');
  p.box(x0 + 0.8, y0 + 0.5, x0 + 1.8, y0 + 1.3, top + 0.08, top + 0.28, '#cbd5e1');
  p.line(x1 - 0.6, y1 - 0.2, top + 0.08, x1 - 0.6, y1 - 0.2, top + 0.5, '#475569', 2);
  p.box(x1 - 1.3, y1 - 0.24, x1 + 0.1, y1 - 0.16, top + 0.35, top + 0.7, '#1e3a8a');
  for (const sx of [x1 - 1.0, x1 - 0.6, x1 - 0.2]) p.circle(sx, y1 - 0.15, top + 0.52, 2.2, '#fde047', false);
  // the entrance canopy and the doors on the south side
  const dx = w - 1.0;
  p.box(dx - 0.6, d - 0.02, dx + 0.6, d + 0.5, base + 0.18, base + 0.24, '#e2e8f0');
  for (const px of [dx - 0.55, dx + 0.55]) p.line(px, d + 0.45, 0, px, d + 0.45, base + 0.18, '#94a3b8', 1.6);
  p.poly([dx - 0.3, d + 0.001, 0, dx + 0.3, d + 0.001, 0, dx + 0.3, d + 0.001, base + 0.15, dx - 0.3, d + 0.001, base + 0.15], '#334155', false);
}
