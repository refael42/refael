/**
 * Passenger services in the terminals (owner request: everything a real
 * airport has): charging stations, a currency exchange, a pharmacy, massage
 * chairs, sleep pods, a prayer room and a nursing room. Drawn with the iso
 * pen, anchored at the piece's north-west corner, facing +x (a mirrored copy
 * faces +y, for the pieces against a north wall).
 */
import { IsoPen } from './objects';

/** The same pen with x and y swapped: a piece drawn facing +x comes out facing +y. */
export class SwapPen extends IsoPen {
  override X(x: number, y: number): number {
    return super.X(y, x);
  }
  override Y(x: number, y: number, z: number): number {
    return super.Y(y, x, z);
  }
}



/** A small kiosk counter with a lit sign band and a glass front (the shared shape of the service booths). */
function serviceBooth(p: IsoPen, body: string, band: string): void {
  p.shadow(0.3, 0.2, 22, 9, 0.18);
  p.box(0, 0, 0.6, 0.42, 0, 0.5, body);
  p.poly([0.6, 0.06, 0.12, 0.6, 0.36, 0.12, 0.6, 0.36, 0.42, 0.6, 0.06, 0.42], '#bae6fd', false);
  p.box(0.6, 0.02, 0.66, 0.4, 0.0, 0.24, '#e2e8f0');
  p.box(-0.02, -0.02, 0.62, 0.44, 0.5, 0.62, band);
}

/** Currency exchange: a booth with a green band and a coin sign, a rates board. */
export function drawExchange(p: IsoPen): void {
  serviceBooth(p, '#f8fafc', '#16a34a');
  p.circle(0.3, 0.44, 0.56, 3, '#facc15', false);
  p.box(0.08, 0.425, 0.24, 0.43, 0.2, 0.42, '#1e293b', false);
  for (let k = 0; k < 4; k++) p.line(0.1, 0.43, 0.24 + k * 0.045, 0.22, 0.43, 0.24 + k * 0.045, k % 2 ? '#fde68a' : '#86efac', 1);
}

/** Pharmacy: a white shop front with a green cross and shelves of boxes. */
export function drawPharmacy(p: IsoPen): void {
  serviceBooth(p, '#f8fafc', '#15803d');
  // the green cross on the band
  p.box(0.27, 0.441, 0.33, 0.442, 0.52, 0.6, '#ffffff', false);
  p.box(0.24, 0.441, 0.36, 0.442, 0.54, 0.58, '#ffffff', false);
  for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) p.box(0.08 + j * 0.06, 0.425, 0.12 + j * 0.06, 0.43, 0.14 + k * 0.1, 0.19 + k * 0.1, ['#f472b6', '#60a5fa', '#fbbf24'][(k + j) % 3], false);
}

/** A charging station: a slim pillar with screens and phones on short cables, a bench. */
export function drawCharging(p: IsoPen, bench = true): void {
  p.shadow(0.15, 0.15, 14, 6, 0.16);
  p.box(0, 0, 0.16, 0.16, 0, 0.7, '#1e293b');
  p.poly([0.16, 0.03, 0.4, 0.16, 0.13, 0.4, 0.16, 0.13, 0.62, 0.16, 0.03, 0.62], '#22d3ee', false);
  p.circle(0.08, 0.08, 0.72, 2.4, '#22c55e', false);
  for (const z of [0.3, 0.36]) p.line(0.16, 0.05, z, 0.24, 0.12, z - 0.06, '#94a3b8', 1);
  if (!bench) return;
  p.box(0.3, -0.05, 0.62, 0.1, 0.16, 0.2, '#64748b');
  p.box(0.32, -0.04, 0.34, 0.09, 0, 0.16, '#475569');
  p.box(0.58, -0.04, 0.6, 0.09, 0, 0.16, '#475569');
}

/** A quiet room for prayer: a small walled room with a wooden door and a sign of a crescent and a star. */
export function drawPrayerRoom(p: IsoPen): void {
  p.shadow(0.35, 0.3, 26, 11, 0.18);
  p.box(0, 0, 0.7, 0.6, 0, 0.7, '#e7e5e4');
  p.poly([0.7, 0.18, 0, 0.7, 0.42, 0, 0.7, 0.42, 0.5, 0.7, 0.18, 0.5], '#a16207', false);
  p.circle(0.7, 0.36, 0.25, 1, '#fde68a', false);
  p.box(0.701, 0.2, 0.702, 0.4, 0.55, 0.66, '#1e3a8a', false);
  p.circle(0.702, 0.28, 0.6, 1.8, '#fde68a', false);
  p.box(-0.02, -0.02, 0.72, 0.62, 0.7, 0.75, '#a8a29e');
}

/** A nursing room: a pale pink room with a door and a baby-bottle sign. */
export function drawNursingRoom(p: IsoPen): void {
  p.shadow(0.3, 0.25, 22, 10, 0.18);
  p.box(0, 0, 0.6, 0.5, 0, 0.66, '#fce7f3');
  p.poly([0.6, 0.15, 0, 0.6, 0.35, 0, 0.6, 0.35, 0.46, 0.6, 0.15, 0.46], '#f9a8d4', false);
  p.box(0.601, 0.17, 0.602, 0.33, 0.52, 0.62, '#db2777', false);
  p.box(0.603, 0.23, 0.604, 0.27, 0.54, 0.6, '#ffffff', false);
  p.box(-0.02, -0.02, 0.62, 0.52, 0.66, 0.7, '#f9a8d4');
}

/** Sleeping pods: two white capsules with blue-lit windows, side by side. */
export function drawSleepPods(p: IsoPen): void {
  p.shadow(0.4, 0.3, 30, 12, 0.18);
  for (const y of [0, 0.36]) {
    p.box(0, y, 0.9, y + 0.3, 0, 0.32, '#f8fafc');
    p.box(0.02, y + 0.02, 0.88, y + 0.28, 0.32, 0.36, '#e2e8f0');
    p.poly([0.9, y + 0.06, 0.08, 0.9, y + 0.24, 0.08, 0.9, y + 0.24, 0.26, 0.9, y + 0.06, 0.26], '#38bdf8', false);
    p.circle(0.91, y + 0.15, 0.17, 1.4, '#e0f2fe', false);
  }
}

/** Massage chairs: two big padded chairs with control panels. */
export function drawMassageChairs(p: IsoPen): void {
  p.shadow(0.35, 0.2, 26, 10, 0.18);
  for (const x of [0, 0.42]) {
    p.box(x, 0, x + 0.34, 0.3, 0, 0.16, '#334155');
    p.box(x + 0.02, 0.02, x + 0.32, 0.28, 0.16, 0.24, '#7c3aed');
    p.box(x, -0.06, x + 0.34, 0.04, 0.16, 0.56, '#5b21b6');
    p.box(x - 0.03, 0.02, x + 0.02, 0.28, 0.16, 0.34, '#4c1d95');
    p.box(x + 0.32, 0.02, x + 0.37, 0.28, 0.16, 0.34, '#4c1d95');
    p.circle(x + 0.34, 0.26, 0.36, 1.4, '#22c55e', false);
  }
}
