/**
 * The open-roofed terminal building (from the small airfield on): wall
 * pieces (tall back walls with windows, low glass front walls, glass
 * partitions), door frames and canopies, and the furniture inside: rows of
 * seats, departure boards, an information desk, restrooms, bins, an ATM, a
 * water fountain, potted plants, hanging signs with pictograms and the
 * baggage room the belt runs into. Drawn with the iso pen, anchored at the
 * start of each piece on the ground.
 */
import { shade } from './color';
import { IsoPen } from './objects';

/** Wall pieces are this long (tiles), so people sort right against them. */
export const WALL_SEG = 0.5;

const WALL = '#f1f5f9';
const WALL_BAND = '#3b82f6';
const GLASS = 'rgba(186,230,253,0.55)';
const FRAME = '#94a3b8';

/** A piece of wall from the origin along x (or y), `len` long. */
export function drawWallPiece(p: IsoPen, kind: 'back' | 'front' | 'glass', alongY: boolean, len: number, height: number): void {
  const T = 0.05;
  const box = (a0: number, a1: number, z0: number, z1: number, color: string, outline = true) => {
    if (alongY) p.box(-T, a0, T, a1, z0, z1, color, outline);
    else p.box(a0, -T, a1, T, z0, z1, color, outline);
  };
  const quad = (a0: number, a1: number, z0: number, z1: number, color: string) => {
    if (alongY) p.poly([0, a0, z0, 0, a1, z0, 0, a1, z1, 0, a0, z1], color, false);
    else p.poly([a0, 0, z0, a1, 0, z0, a1, 0, z1, a0, 0, z1], color, false);
  };
  if (kind === 'back') {
    // plinth, wall, a band of windows between columns, a blue stripe and the top cap
    box(0, len, 0, 0.05, '#94a3b8');
    box(0, len, 0.05, height, WALL);
    const w0 = 0.2;
    const w1 = height - 0.12;
    quad(0.07, len - 0.07, w0, w1, '#7dd3fc');
    quad(0.07, len - 0.07, w1 - 0.07, w1, 'rgba(255,255,255,0.45)');
    for (const a of [0.05, len - 0.05]) {
      if (alongY) p.line(T + 0.001, a, w0, T + 0.001, a, w1, '#cbd5e1', 2);
      else p.line(a, T + 0.001, w0, a, T + 0.001, w1, '#cbd5e1', 2);
    }
    box(0, len, height - 0.05, height - 0.03, WALL_BAND, false);
    box(-0.01, len + 0.01, height, height + 0.03, '#ffffff');
    return;
  }
  if (kind === 'front') {
    // a low concrete sill and a glass panel with a steel rail
    box(0, len, 0, 0.1, '#cbd5e1');
    quad(0, len, 0.1, 0.34, GLASS);
    if (alongY) {
      p.line(0, 0, 0.34, 0, len, 0.34, '#64748b', 1.6);
      p.line(0, 0, 0.1, 0, 0, 0.34, FRAME, 1.2);
    } else {
      p.line(0, 0, 0.34, len, 0, 0.34, '#64748b', 1.6);
      p.line(0, 0, 0.1, 0, 0, 0.34, FRAME, 1.2);
    }
    return;
  }
  // an inner glass partition: frame posts, glass, a rail
  quad(0, len, 0.02, 0.3, 'rgba(203,232,250,0.5)');
  if (alongY) {
    p.line(0, 0, 0.3, 0, len, 0.3, FRAME, 1.4);
    p.line(0, 0, 0, 0, 0, 0.3, FRAME, 1.4);
  } else {
    p.line(0, 0, 0.3, len, 0, 0.3, FRAME, 1.4);
    p.line(0, 0, 0, 0, 0, 0.3, FRAME, 1.4);
  }
}

/** Sliding glass doors in an opening `width` wide, with a frame and a header. */
export function drawDoorFrame(p: IsoPen, alongY: boolean, width: number, tall: boolean): void {
  const h = tall ? 0.58 : 0.42;
  const at = (a: number, z: number): [number, number, number] => (alongY ? [0, a, z] : [a, 0, z]);
  const line = (a0: number, z0: number, a1: number, z1: number, color: string, w: number) => {
    const [x0, y0, zz0] = at(a0, z0);
    const [x1, y1, zz1] = at(a1, z1);
    p.line(x0, y0, zz0, x1, y1, zz1, color, w);
  };
  // the two sliding leaves, pulled back to the sides
  const leaf = (a0: number, a1: number) => {
    const [x0, y0] = at(a0, 0);
    const [x1, y1] = at(a1, 0);
    p.poly([x0, y0, 0.02, x1, y1, 0.02, x1, y1, h - 0.04, x0, y0, h - 0.04], 'rgba(186,230,253,0.6)', false);
  };
  leaf(0, width * 0.22);
  leaf(width * 0.78, width);
  line(0, 0, 0, h, '#475569', 2.4);
  line(width, 0, width, h, '#475569', 2.4);
  line(0, h, width, h, '#334155', 3.2);
  // the door sensor
  const [sx, sy] = at(width / 2, 0);
  p.circle(sx, sy, h + 0.03, 1.4, '#22c55e', false);
}

/** A light glass canopy over a door, out toward the curb (+x) or the apron (+y), on two slim posts, with a colored fascia. */
export function drawCanopy(p: IsoPen, alongY: boolean, width: number, depth: number, color: string): void {
  const z = 0.6;
  const glass = 'rgba(186,230,253,0.5)';
  if (alongY) {
    for (const a of [0.05, width - 0.05]) p.line(depth, a, 0, depth, a, z, '#64748b', 1.6);
    p.poly([0, 0, z, depth, 0, z, depth, width, z, 0, width, z], glass, false);
    p.line(depth, 0, z, depth, width, z, '#475569', 1.6);
    p.line(0, 0, z, depth, 0, z, '#475569', 1.2);
    p.line(0, width, z, depth, width, z, '#475569', 1.2);
    p.poly([depth, 0, z, depth, width, z, depth, width, z - 0.06, depth, 0, z - 0.06], color, false);
  } else {
    for (const a of [0.05, width - 0.05]) p.line(a, depth, 0, a, depth, z, '#64748b', 1.6);
    p.poly([0, 0, z, width, 0, z, width, depth, z, 0, depth, z], glass, false);
    p.line(0, depth, z, width, depth, z, '#475569', 1.6);
    p.line(0, 0, z, 0, depth, z, '#475569', 1.2);
    p.line(width, 0, z, width, depth, z, '#475569', 1.2);
    p.poly([0, depth, z, width, depth, z, width, depth, z - 0.06, 0, depth, z - 0.06], color, false);
  }
}

/** A row of n linked seats along x, backs to the north, facing the apron. */
export function drawSeats(p: IsoPen, n: number): void {
  const W = 0.4;
  p.shadow((n * W) / 2, 0.1, n * 13, 6, 0.14);
  // the beam and legs
  p.box(0, 0.06, n * W, 0.1, 0.08, 0.1, '#64748b');
  for (const a of [0.05, n * W - 0.05]) p.box(a - 0.02, 0.06, a + 0.02, 0.1, 0, 0.08, '#475569');
  for (let k = 0; k < n; k++) {
    const a = k * W + 0.04;
    // backrest, then the seat in front of it
    p.box(a, 0.0, a + W - 0.08, 0.04, 0.1, 0.3, '#1d4ed8');
    p.box(a, 0.04, a + W - 0.08, 0.2, 0.1, 0.14, '#3b82f6');
    p.box(a + W - 0.08, 0.04, a + W - 0.06, 0.18, 0.1, 0.18, '#94a3b8');
  }
}

/** A flight information display: a dark screen on a post with rows of yellow and white lines. */
export function drawBoard(p: IsoPen): void {
  p.shadow(0.2, 0.05, 10, 4, 0.14);
  p.line(0.2, 0.05, 0, 0.2, 0.05, 0.4, '#475569', 2.4);
  p.box(0, 0, 0.42, 0.06, 0.38, 0.72, '#0f172a');
  for (let r = 0; r < 5; r++) {
    const z = 0.68 - r * 0.06;
    p.line(0.03, 0.061, z, 0.13, 0.061, z, '#facc15', 1.1);
    p.line(0.16, 0.061, z, 0.3, 0.061, z, '#e2e8f0', 1.1);
    p.line(0.33, 0.061, z, 0.39, 0.061, z, r === 1 ? '#f87171' : '#4ade80', 1.1);
  }
}

/** Information desk: a curved white counter with a blue "i" sign over it. */
export function drawInfoDesk(p: IsoPen): void {
  p.shadow(0.25, 0.15, 16, 7, 0.16);
  p.box(0, 0, 0.5, 0.26, 0, 0.3, '#f8fafc');
  p.box(-0.02, -0.02, 0.52, 0.28, 0.3, 0.33, '#0ea5e9');
  p.line(0.25, 0.05, 0.33, 0.25, 0.05, 0.75, '#64748b', 1.8);
  p.circle(0.25, 0.05, 0.8, 4.2, '#2563eb');
  p.line(0.25, 0.05, 0.74, 0.25, 0.05, 0.81, '#ffffff', 1.6);
  p.circle(0.25, 0.05, 0.85, 0.9, '#ffffff', false);
}

/** Restrooms: a little block with two doors and the pictograms. */
export function drawRestrooms(p: IsoPen): void {
  p.shadow(0.3, 0.25, 20, 9, 0.18);
  p.box(0, 0, 0.62, 0.5, 0, 0.48, '#e2e8f0');
  p.box(-0.02, -0.02, 0.64, 0.52, 0.48, 0.52, '#94a3b8');
  // two doors on the +y face, the pictograms on the +x face
  for (const [a, c] of [
    [0.06, '#60a5fa'],
    [0.34, '#f472b6'],
  ] as const) {
    p.poly([a, 0.5, 0, a + 0.2, 0.5, 0, a + 0.2, 0.5, 0.36, a, 0.5, 0.36], shade(c, -0.25));
    p.circle(a + 0.1, 0.5, 0.42, 1.6, c, false);
  }
  p.circle(0.62, 0.15, 0.36, 1.8, '#2563eb', false);
  p.circle(0.62, 0.35, 0.36, 1.8, '#db2777', false);
}

/** Bins for recycling: a blue and a green one with lids. */
export function drawBins(p: IsoPen): void {
  p.shadow(0.12, 0.05, 9, 4, 0.16);
  p.box(0, 0, 0.1, 0.1, 0, 0.18, '#2563eb');
  p.box(-0.01, -0.01, 0.11, 0.11, 0.18, 0.2, '#1e40af');
  p.box(0.13, 0, 0.23, 0.1, 0, 0.18, '#16a34a');
  p.box(0.12, -0.01, 0.24, 0.11, 0.18, 0.2, '#166534');
}

/** A cash machine with a lit screen. */
export function drawAtm(p: IsoPen): void {
  p.shadow(0.1, 0.08, 8, 4, 0.16);
  p.box(0, 0, 0.18, 0.16, 0, 0.42, '#475569');
  p.poly([0.03, 0.16, 0.24, 0.15, 0.16, 0.24, 0.15, 0.16, 0.34, 0.03, 0.16, 0.34], '#38bdf8', false);
  p.box(0, 0, 0.18, 0.16, 0.42, 0.46, '#16a34a');
}

/** A drinking fountain. */
export function drawFountain(p: IsoPen): void {
  p.shadow(0.08, 0.06, 7, 3, 0.15);
  p.box(0, 0, 0.16, 0.12, 0, 0.26, '#e2e8f0');
  p.box(-0.02, -0.02, 0.18, 0.14, 0.26, 0.3, '#94a3b8');
  p.circle(0.08, 0.06, 0.31, 1.6, '#38bdf8', false);
}

/** An indoor plant in a round white pot. */
export function drawPottedPlant(p: IsoPen): void {
  p.shadow(0.08, 0.06, 9, 4, 0.18);
  for (let z = 0; z < 0.16; z += 0.02) p.circle(0.08, 0.08, z, 5 - z * 6, z > 0.14 ? '#cbd5e1' : '#f8fafc', false);
  const leaves: [number, number, number, number, string][] = [
    [0.08, 0.08, 0.32, 7, '#15803d'],
    [0.02, 0.06, 0.26, 5, '#16a34a'],
    [0.14, 0.1, 0.27, 5, '#22c55e'],
    [0.08, 0.04, 0.4, 4, '#4ade80'],
  ];
  for (const [x, y, z, r, c] of leaves) p.circle(x, y, z, r, c);
}

export type SignKind = 'checkin' | 'security' | 'gate' | 'arrivals' | 'exit' | 'baggage' | 'dutyFree' | 'food' | 'lounge' | 'passport' | 'customs' | 'train';

/** A hanging sign: a dark board under the ceiling line with a yellow pictogram (green for the exit). */
export function drawSign(p: IsoPen, kind: SignKind): void {
  const z = 0.86;
  p.line(0, 0, 0, 0, 0, z - 0.1, 'rgba(100,116,139,0.6)', 1.2);
  const W = 0.34;
  const H = 0.13;
  p.box(-W / 2, -0.02, W / 2, 0.02, z - H / 2, z + H / 2, kind === 'exit' ? '#15803d' : '#1e293b');
  const c = kind === 'exit' ? '#ffffff' : '#facc15';
  const y = 0.021;
  const L = (x0: number, z0: number, x1: number, z1: number, w = 1.4) => p.line(x0, y, z + z0, x1, y, z + z1, c, w);
  switch (kind) {
    case 'checkin':
      // a suitcase on a counter
      p.box(-0.06, y, 0.02, y + 0.001, z - 0.04, z + 0.03, c, false);
      L(-0.04, 0.03, -0.04, 0.045);
      L(0.0, 0.03, 0.0, 0.045);
      L(-0.12, -0.045, 0.12, -0.045, 1.6);
      break;
    case 'security':
      // a shield
      p.poly([-0.05, y, z + 0.045, 0.05, y, z + 0.045, 0.05, y, z, 0, y, z - 0.05, -0.05, y, z], c, false);
      break;
    case 'gate':
    case 'arrivals': {
      // a plane, climbing or landing
      const up = kind === 'gate' ? 1 : -1;
      L(-0.08, -0.025 * up, 0.08, 0.025 * up, 2);
      L(-0.01, 0.0, 0.03, -0.04 * up, 1.4);
      L(-0.01, 0.0, -0.04, 0.035 * up, 1.4);
      break;
    }
    case 'baggage':
      p.box(-0.05, y, 0.05, y + 0.001, z - 0.02, z + 0.04, c, false);
      L(-0.12, -0.04, 0.12, -0.04, 1.4);
      break;
    case 'exit':
      // an arrow out
      L(-0.1, 0, 0.08, 0, 1.8);
      L(0.08, 0, 0.03, 0.035, 1.8);
      L(0.08, 0, 0.03, -0.035, 1.8);
      break;
    case 'dutyFree':
      // a shopping bag
      p.box(-0.05, y, 0.05, y + 0.001, z - 0.045, z + 0.025, c, false);
      L(-0.025, 0.025, -0.02, 0.05, 1.2);
      L(0.025, 0.025, 0.02, 0.05, 1.2);
      L(-0.02, 0.05, 0.02, 0.05, 1.2);
      break;
    case 'food':
      // a cup and a fork
      p.box(-0.08, y, -0.01, y + 0.001, z - 0.04, z + 0.03, c, false);
      L(0.05, -0.045, 0.05, 0.045, 1.4);
      L(0.03, 0.045, 0.03, 0.02, 1.1);
      L(0.07, 0.045, 0.07, 0.02, 1.1);
      break;
    case 'lounge':
      // an armchair
      L(-0.06, -0.03, 0.06, -0.03, 2);
      L(-0.06, -0.03, -0.06, 0.04, 2);
      L(0.06, -0.03, 0.06, 0.01, 2);
      break;
    case 'passport':
      // a passport booklet
      p.box(-0.04, y, 0.04, y + 0.001, z - 0.05, z + 0.05, c, false);
      p.circle(0, y + 0.002, z, 1.2, '#1e293b', false);
      break;
    case 'customs':
      // a green arrow through
      L(-0.1, 0, 0.1, 0, 1.8);
      L(0.1, 0, 0.05, 0.035, 1.8);
      L(0.1, 0, 0.05, -0.035, 1.8);
      break;
    case 'train':
      // the front of a train: the body, its windscreen, two lights, the rail
      p.box(-0.05, y, 0.05, y + 0.001, z - 0.04, z + 0.05, c, false);
      p.box(-0.035, y + 0.0015, 0.035, y + 0.002, z + 0.005, z + 0.035, '#1e293b', false);
      L(-0.08, -0.055, 0.08, -0.055, 1.2);
      break;
  }
}

/** A play corner: a soft mat, a little slide, a rocking animal and balls. */
export function drawKidsPlay(p: IsoPen): void {
  p.shadow(0.4, 0.3, 26, 12, 0.14);
  p.box(-0.1, -0.05, 0.9, 0.6, 0, 0.03, '#86efac');
  p.box(0.05, 0.05, 0.25, 0.25, 0.03, 0.3, '#f97316');
  p.box(0.03, 0.03, 0.27, 0.27, 0.3, 0.33, '#facc15');
  p.poly([0.25, 0.08, 0.3, 0.62, 0.08, 0.05, 0.62, 0.22, 0.05, 0.25, 0.22, 0.3], '#38bdf8');
  p.box(0.55, 0.38, 0.75, 0.46, 0.05, 0.16, '#f472b6');
  p.box(0.7, 0.38, 0.78, 0.46, 0.16, 0.24, '#f472b6');
  const balls: [number, number, string][] = [
    [0.2, 0.45, '#ef4444'],
    [0.35, 0.52, '#3b82f6'],
    [0.82, 0.12, '#facc15'],
    [0.45, 0.36, '#22c55e'],
  ];
  for (const [x, by, col] of balls) p.circle(x, by, 0.06, 2.6, col);
}

/** An art piece in the arrivals hall: a big folded paper plane on a pole over a stone plinth. */
export function drawSculpture(p: IsoPen): void {
  p.shadow(0.2, 0.2, 18, 9, 0.16);
  p.box(0, 0, 0.4, 0.4, 0, 0.12, '#e7e5e4');
  p.line(0.2, 0.2, 0.12, 0.2, 0.2, 0.62, '#475569', 1.6);
  p.poly([-0.1, 0.25, 0.66, 0.6, 0.05, 0.86, 0.35, 0.24, 0.66], '#f8fafc');
  p.poly([-0.1, 0.25, 0.66, 0.6, 0.05, 0.86, 0.42, 0.44, 0.56], '#cbd5e1');
}

/** The baggage room behind the terminal: a shed with a roller door where the belt comes in. */
export function drawBaggageRoom(p: IsoPen): void {
  p.shadow(0.45, 0.6, 30, 16, 0.2);
  p.box(0, 0, 0.9, 1.2, 0, 0.5, '#cbd5e1');
  p.box(-0.03, -0.03, 0.93, 1.23, 0.5, 0.55, '#64748b');
  for (let k = 0; k < 6; k++) p.poly([0.12, 1.2, 0.04 + k * 0.06, 0.62, 1.2, 0.04 + k * 0.06, 0.62, 1.2, 0.09 + k * 0.06, 0.12, 1.2, 0.09 + k * 0.06], k % 2 ? '#94a3b8' : '#e2e8f0', false);
  // a yellow-and-black band on the two faces you see, and a light over the door
  for (let k = 0; k < 9; k++) p.poly([0.9, k * 0.133, 0.42, 0.9, (k + 1) * 0.133, 0.42, 0.9, (k + 1) * 0.133, 0.46, 0.9, k * 0.133, 0.46], k % 2 ? '#1f2937' : '#facc15', false);
  for (let k = 0; k < 7; k++) p.poly([k * 0.128, 1.2, 0.42, (k + 1) * 0.128, 1.2, 0.42, (k + 1) * 0.128, 1.2, 0.46, k * 0.128, 1.2, 0.46], k % 2 ? '#1f2937' : '#facc15', false);
  p.circle(0.75, 1.2, 0.48, 1.6, '#fde68a', false);
}

// ------------------------------------------------------------------ Terminal 3

/** A self check-in kiosk: a slim white stand with a touch screen. */
export function drawSelfCheckin(p: IsoPen): void {
  p.shadow(0.08, 0.06, 7, 3, 0.15);
  p.box(0, 0, 0.16, 0.12, 0, 0.36, '#f8fafc');
  p.poly([0.02, 0.121, 0.24, 0.14, 0.121, 0.24, 0.14, 0.121, 0.34, 0.02, 0.121, 0.34], '#0ea5e9', false);
  p.box(0, 0, 0.16, 0.12, 0.36, 0.4, '#6366f1');
}

/** A passport control booth: glass on a wooden counter, an officer's cap inside. */
export function drawBooth(p: IsoPen): void {
  p.shadow(0.22, 0.15, 16, 7, 0.18);
  p.box(0, 0, 0.44, 0.3, 0, 0.3, '#78716c');
  p.box(-0.02, -0.02, 0.46, 0.32, 0.3, 0.33, '#57534e');
  p.poly([0, 0.3, 0.33, 0.44, 0.3, 0.33, 0.44, 0.3, 0.55, 0, 0.3, 0.55], 'rgba(186,230,253,0.55)', false);
  p.line(0, 0.3, 0.55, 0.44, 0.3, 0.55, '#475569', 1.4);
  // the officer behind the glass
  p.circle(0.22, 0.12, 0.42, 3.2, '#e0ac69');
  p.circle(0.22, 0.12, 0.47, 3.4, '#1e3a8a');
  p.box(0.32, 0.3, 0.4, 0.31, 0.56, 0.62, '#16a34a', false);
}

/** A duty free shelf: four looks (perfume, chocolate, drinks, sunglasses and bags). */
export function drawShelf(p: IsoPen, variant: number): void {
  p.shadow(0.35, 0.12, 22, 7, 0.16);
  p.box(0, 0, 0.7, 0.22, 0, 0.42, '#f5f5f4');
  const palettes = [
    ['#f472b6', '#c084fc', '#fbcfe8', '#f9a8d4'],
    ['#92400e', '#b45309', '#fbbf24', '#dc2626'],
    ['#166534', '#7c2d12', '#facc15', '#1e3a8a'],
    ['#111827', '#f59e0b', '#e11d48', '#0ea5e9'],
  ][variant % 4];
  for (let row = 0; row < 3; row++) {
    const z = 0.08 + row * 0.12;
    p.line(0.02, 0.222, z - 0.01, 0.68, 0.222, z - 0.01, '#d6d3d1', 1.2);
    for (let k = 0; k < 6; k++) {
      const x = 0.06 + k * 0.105;
      p.box(x, 0.2, x + 0.06, 0.222, z, z + 0.07, palettes[(k + row) % 4], false);
    }
  }
  p.box(-0.01, -0.01, 0.71, 0.23, 0.42, 0.45, '#a8a29e');
}

/** The duty free till: a glossy counter with a register. */
export function drawTill(p: IsoPen): void {
  p.shadow(0.25, 0.12, 16, 6, 0.16);
  p.box(0, 0, 0.5, 0.22, 0, 0.3, '#1f2937');
  p.box(-0.01, -0.01, 0.51, 0.23, 0.3, 0.33, '#d4a017');
  p.box(0.08, 0.04, 0.2, 0.14, 0.33, 0.4, '#334155');
  p.poly([0.09, 0.141, 0.35, 0.19, 0.141, 0.35, 0.19, 0.141, 0.39, 0.09, 0.141, 0.39], '#22c55e', false);
}

/** A round café table with two chairs. */
export function drawTable(p: IsoPen): void {
  p.shadow(0.1, 0.1, 14, 7, 0.15);
  for (const [cx, cy] of [
    [-0.12, 0.1],
    [0.32, 0.1],
  ] as const) {
    p.box(cx, cy, cx + 0.1, cy + 0.1, 0, 0.12, '#475569');
    p.box(cx, cy, cx + 0.1, cy + 0.02, 0.12, 0.26, '#ef4444');
  }
  p.line(0.1, 0.1, 0, 0.1, 0.1, 0.2, '#64748b', 2);
  for (let z = 0.2; z < 0.23; z += 0.01) p.circle(0.1, 0.1, z, 7, '#f8fafc', false);
  p.circle(0.06, 0.08, 0.235, 1.6, '#f59e0b', false);
  p.circle(0.15, 0.12, 0.235, 1.4, '#7c2d12', false);
}

/** A food court stall with a colored awning and a menu board: pizza, burgers, coffee. */
export function drawFoodStall(p: IsoPen, variant: number): void {
  const color = ['#dc2626', '#f59e0b', '#7c3aed'][variant % 3];
  p.shadow(0.4, 0.2, 26, 8, 0.16);
  p.box(0, 0, 0.82, 0.22, 0, 0.3, '#f8fafc');
  p.box(-0.01, -0.01, 0.83, 0.23, 0.3, 0.32, '#cbd5e1');
  // the back wall with the menu, the awning stripes
  p.box(0, -0.04, 0.82, 0.0, 0.32, 0.62, shade(color, 0.6));
  for (let k = 0; k < 3; k++) p.line(0.1 + k * 0.25, 0.001, 0.52, 0.25 + k * 0.25, 0.001, 0.52, '#334155', 1.2);
  for (let k = 0; k < 6; k++) p.poly([k * 0.137, 0, 0.62, (k + 1) * 0.137, 0, 0.62, (k + 1) * 0.137, 0.16, 0.56, k * 0.137, 0.16, 0.56], k % 2 ? '#ffffff' : color, false);
  // a little something on the counter: a pizza, a burger, a cup
  if (variant === 0) p.circle(0.3, 0.11, 0.33, 4, '#f59e0b');
  else if (variant === 1) {
    p.circle(0.3, 0.11, 0.33, 3.4, '#b45309');
    p.circle(0.3, 0.11, 0.36, 3.2, '#fbbf24');
  } else p.box(0.27, 0.08, 0.35, 0.15, 0.32, 0.42, '#f5f5f4');
}

/** A lounge sofa (two seats) in plum leather. */
export function drawSofa(p: IsoPen): void {
  p.shadow(0.3, 0.15, 18, 7, 0.16);
  p.box(0, 0.0, 0.62, 0.08, 0.08, 0.3, '#6d28d9');
  p.box(0, 0.08, 0.62, 0.3, 0.06, 0.16, '#7c3aed');
  for (const a of [0, 0.56]) p.box(a, 0.0, a + 0.06, 0.3, 0.06, 0.22, '#5b21b6');
  p.box(0.25, 0.4, 0.4, 0.5, 0, 0.12, '#d4a017');
}

/** A gate desk with the gate's screen. */
export function drawGateDesk(p: IsoPen): void {
  p.shadow(0.25, 0.12, 16, 6, 0.16);
  p.box(0, 0, 0.5, 0.22, 0, 0.3, '#f8fafc');
  p.box(-0.01, -0.01, 0.51, 0.23, 0.3, 0.33, '#2563eb');
  p.line(0.25, 0.04, 0.33, 0.25, 0.04, 0.62, '#64748b', 1.8);
  p.box(0.08, 0.02, 0.42, 0.06, 0.6, 0.82, '#0f172a');
  p.line(0.12, 0.061, 0.76, 0.24, 0.061, 0.76, '#facc15', 2);
  p.line(0.12, 0.061, 0.69, 0.38, 0.061, 0.69, '#e2e8f0', 1.2);
  p.line(0.12, 0.061, 0.65, 0.3, 0.061, 0.65, '#4ade80', 1.2);
}

/** Customs: a long counter, a green channel sign. */
export function drawCustomsDesk(p: IsoPen): void {
  p.shadow(0.3, 0.12, 18, 6, 0.16);
  p.box(0, 0, 0.6, 0.2, 0, 0.3, '#e2e8f0');
  p.box(-0.01, -0.01, 0.61, 0.21, 0.3, 0.33, '#16a34a');
  p.circle(0.12, 0.1, 0.42, 3, '#e0ac69');
  p.circle(0.12, 0.1, 0.47, 3.2, '#14532d');
}

/** A car rental desk with a red sign. */
export function drawRental(p: IsoPen): void {
  p.shadow(0.25, 0.12, 16, 6, 0.16);
  p.box(0, 0, 0.5, 0.22, 0, 0.3, '#f8fafc');
  p.box(-0.01, -0.01, 0.51, 0.23, 0.3, 0.33, '#dc2626');
  p.line(0.25, 0.03, 0.33, 0.25, 0.03, 0.6, '#64748b', 1.6);
  p.box(0.1, 0.0, 0.4, 0.04, 0.58, 0.7, '#dc2626');
  // a little car on the sign
  p.box(0.18, 0.041, 0.32, 0.042, 0.61, 0.65, '#ffffff', false);
}

/**
 * The parking garage of Terminal 3: three decks of concrete with ramps,
 * cars on the open top deck, a blue P sign. Footprint w x d tiles.
 */
export function drawGarage(p: IsoPen, w: number, d: number): void {
  p.shadow(w / 2, d / 2, w * 34, d * 18, 0.25);
  const deck = 0.32;
  for (let k = 0; k < 3; k++) {
    const z0 = k * deck;
    p.box(0, 0, w, d, z0, z0 + 0.06, '#cbd5e1');
    // pillars between decks on the two faces you see
    for (let x = 0.2; x < w; x += 0.9) p.box(x, d - 0.08, x + 0.08, d, z0 + 0.06, z0 + deck, '#94a3b8');
    for (let y = 0.2; y < d; y += 0.9) p.box(w - 0.08, y, w, y + 0.08, z0 + 0.06, z0 + deck, '#94a3b8');
    // a parapet with a stripe
    p.poly([0, d, z0 + 0.06, w, d, z0 + 0.06, w, d, z0 + 0.14, 0, d, z0 + 0.14], '#e2e8f0', false);
    p.poly([w, 0, z0 + 0.06, w, d, z0 + 0.06, w, d, z0 + 0.14, w, 0, z0 + 0.14], '#d1d5db', false);
  }
  const top = 3 * deck;
  p.box(0, 0, w, d, top, top + 0.06, '#9ca3af');
  for (let x = 0.5; x < w - 0.3; x += 0.55) p.line(x, 0.2, top + 0.061, x, d - 0.2, top + 0.061, '#f1f5f9', 1);
  const colors = ['#ef4444', '#3b82f6', '#f8fafc', '#facc15', '#22c55e', '#111827'];
  for (let k = 0; k < 7; k++) {
    const x = 0.55 + (k % 6) * 0.55 + 0.12;
    const y = k < 6 ? 0.4 : d - 0.8;
    if (x + 0.3 > w) continue;
    p.box(x, y, x + 0.3, y + 0.55, top + 0.06, top + 0.18, colors[k % colors.length]);
  }
  // the P sign on a pole at the corner
  p.line(w - 0.1, d - 0.1, top, w - 0.1, d - 0.1, top + 0.55, '#475569', 2);
  p.box(w - 0.3, d - 0.12, w + 0.1, d - 0.08, top + 0.45, top + 0.75, '#2563eb');
  p.line(w - 0.16, d - 0.07, top + 0.5, w - 0.16, d - 0.07, top + 0.7, '#ffffff', 2.4);
  p.circle(w - 0.12, d - 0.07, top + 0.65, 2.6, '#ffffff', false);
  // the ramp entrance at the front
  p.poly([0.3, d, 0.0, 1.1, d, 0.0, 1.1, d, 0.22, 0.3, d, 0.22], '#334155', false);
}

/** A bus stop shelter with a bench and a timetable. */
export function drawBusStop(p: IsoPen): void {
  p.shadow(0.4, 0.15, 24, 7, 0.16);
  p.poly([0, 0, 0, 0.8, 0, 0, 0.8, 0, 0.5, 0, 0, 0.5], 'rgba(186,230,253,0.55)', false);
  for (const a of [0, 0.8]) p.line(a, 0, 0, a, 0, 0.5, '#475569', 1.6);
  p.box(-0.05, -0.05, 0.85, 0.3, 0.5, 0.54, '#16a34a');
  p.box(0.15, 0.05, 0.65, 0.15, 0.12, 0.16, '#78350f');
  p.box(0.68, 0.0, 0.76, 0.03, 0.15, 0.42, '#f8fafc');
}

/** A piece of litter on the floor: a paper cup, a crumpled wrapper or a can (a bit big, so you see it). */
export function drawLitter(p: IsoPen, kind: number): void {
  if (kind === 0) {
    p.box(-0.05, -0.05, 0.05, 0.05, 0, 0.12, '#f8fafc');
    p.box(-0.052, -0.052, 0.052, 0.052, 0.05, 0.075, '#ef4444', false);
  } else if (kind === 1) {
    p.poly([-0.1, -0.03, 0.005, 0.08, -0.07, 0.005, 0.1, 0.05, 0.005, -0.05, 0.08, 0.005], '#facc15');
    p.poly([-0.03, -0.02, 0.015, 0.05, 0.0, 0.015, 0.0, 0.05, 0.015], '#f59e0b', false);
  } else {
    p.box(-0.09, -0.035, 0.09, 0.035, 0, 0.07, '#22c55e');
    p.box(0.09, -0.035, 0.105, 0.035, 0.008, 0.062, '#cbd5e1', false);
  }
}

/** The cleaner's trolley: a grey cart with a bin bag and a mop. */
export function drawCleanCart(p: IsoPen): void {
  p.shadow(0, 0, 9, 5, 0.18);
  p.box(-0.12, -0.08, 0.12, 0.08, 0.03, 0.2, '#94a3b8');
  p.box(-0.1, -0.06, 0.02, 0.06, 0.2, 0.3, '#1f2937');
  p.box(0.04, -0.05, 0.11, 0.05, 0.2, 0.24, '#facc15');
  p.line(0.08, 0.0, 0.24, 0.12, 0.0, 0.5, '#a16207', 1.4);
}

/** A star on the front face (y) of a board: five points around (x, z), r in tiles. */
function faceStar(p: IsoPen, x: number, y: number, z: number, r: number, color: string): void {
  const pts: number[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.42;
    pts.push(x + Math.cos(a) * rr, y, z - Math.sin(a) * rr);
  }
  p.poly(pts, color, true, 0.9);
}

/**
 * The Aviation Guide's pylon by the terminal: two posts, a white board with the
 * guide's red band and book, and three stars (gold for the stars it gave).
 */
export function drawGuidePylon(p: IsoPen, stars: number): void {
  p.shadow(0, 0, 18, 7, 0.18);
  p.box(-0.22, -0.03, -0.17, 0.02, 0, 0.6, '#64748b');
  p.box(0.17, -0.03, 0.22, 0.02, 0, 0.6, '#64748b');
  p.box(-0.3, -0.04, 0.3, 0.04, 0.48, 1.08, '#f8fafc');
  p.box(-0.3, -0.04, 0.3, 0.04, 0.94, 1.08, '#dc2626');
  const y = 0.041;
  // the book, white on the red band
  p.box(-0.05, y, 0.05, y + 0.001, 0.965, 1.055, '#ffffff', false);
  p.line(0, y + 0.002, 0.965, 0, y + 0.002, 1.055, '#dc2626', 1);
  for (let k = 0; k < 3; k++) faceStar(p, -0.17 + k * 0.17, y, 0.71, 0.075, k < stars ? '#f5b301' : '#cbd5e1');
  // a thin line under the stars
  p.line(-0.22, y, 0.57, 0.22, y, 0.57, '#94a3b8', 1);
}
