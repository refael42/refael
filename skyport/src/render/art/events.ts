/**
 * Art for the special events (M11): the paramedics' stretcher, rope barriers,
 * the ticket booth and sign at a historic plane, the TV camera at a celebrity
 * visit, and the holiday decorations (string lights, bunting and a centerpiece
 * by the terminal for each holiday). Drawn in code with the iso pen.
 */
import type { HolidayId } from '../../data/holidays';
import { shade } from './color';
import { IsoPen } from './objects';

/** A wheeled stretcher with a red blanket and a pillow (along x, 0.36 long). */
export function drawStretcher(p: IsoPen): void {
  p.shadow(0, 0, 11, 4, 0.18);
  for (const x of [-0.14, 0.14]) for (const y of [-0.06, 0.06]) {
    p.line(x, y, 0.02, x, y, 0.13, '#94a3b8', 1.2);
    p.circle(x, y, 0.02, 0.9, '#1f2937', false);
  }
  p.box(-0.18, -0.07, 0.18, 0.07, 0.13, 0.16, '#e2e8f0');
  p.box(-0.1, -0.075, 0.17, 0.075, 0.16, 0.19, '#dc2626');
  p.box(-0.17, -0.055, -0.09, 0.055, 0.16, 0.21, '#ffffff');
  // the patient's head on the pillow
  p.circle(-0.13, 0, 0.25, 1.6, '#e0ac69', false);
}

/**
 * A rope barrier: brass posts with a sagging red velvet rope, along x (or y)
 * from the origin, `len` tiles long.
 */
export function drawRope(p: IsoPen, len: number, alongY: boolean): void {
  const n = Math.max(1, Math.round(len / 0.5));
  const at = (t: number): [number, number] => (alongY ? [0, t * len] : [t * len, 0]);
  for (let k = 0; k < n; k++) {
    // the rope sags between two posts
    const segs = 4;
    for (let j = 0; j < segs; j++) {
      const a = (k + j / segs) / n;
      const b = (k + (j + 1) / segs) / n;
      const za = 0.19 - Math.sin((j / segs) * Math.PI) * 0.05;
      const zb = 0.19 - Math.sin(((j + 1) / segs) * Math.PI) * 0.05;
      const [ax, ay] = at(a);
      const [bx, by] = at(b);
      p.line(ax, ay, za, bx, by, zb, '#991b1b', 1.6);
    }
  }
  for (let k = 0; k <= n; k++) {
    const [x, y] = at(k / n);
    p.circle(x, y, 0.0, 1.6, '#a16207', false);
    p.line(x, y, 0, x, y, 0.21, '#ca8a04', 1.5);
    p.circle(x, y, 0.22, 1.4, '#fde047', false);
  }
}

/** A ticket booth: a little kiosk with a striped awning, a counter and a TICKETS board. */
export function drawTicketBooth(p: IsoPen): void {
  p.shadow(0.25, 0.2, 22, 9, 0.2);
  p.box(0, 0, 0.5, 0.4, 0, 0.42, '#fef3c7');
  // the window and counter on the +y face (toward the visitors)
  p.poly([0.08, 0.4, 0.22, 0.42, 0.4, 0.22, 0.42, 0.4, 0.38, 0.08, 0.4, 0.38], '#1e3a5f');
  p.box(0.05, 0.4, 0.45, 0.48, 0.2, 0.23, '#b45309');
  // striped awning over the window
  for (let k = 0; k < 5; k++) {
    const x0 = k * 0.1;
    p.poly([x0, 0.4, 0.5, x0 + 0.1, 0.4, 0.5, x0 + 0.1, 0.56, 0.42, x0, 0.56, 0.42], k % 2 ? '#ffffff' : '#dc2626', false);
  }
  p.box(-0.02, -0.02, 0.52, 0.42, 0.42, 0.47, '#dc2626');
  // the board on the roof: a ticket on yellow
  p.box(0.1, 0.18, 0.4, 0.22, 0.47, 0.62, '#facc15');
  p.poly([0.16, 0.22, 0.5, 0.34, 0.22, 0.5, 0.34, 0.22, 0.58, 0.16, 0.22, 0.58], '#f59e0b', false);
}

/** An information sign on two legs: a picture of the old plane and a few lines of text. */
export function drawInfoSign(p: IsoPen): void {
  p.shadow(0.1, 0.05, 12, 4, 0.16);
  p.line(0.02, 0, 0, 0.02, 0, 0.3, '#475569', 1.6);
  p.line(0.38, 0, 0, 0.38, 0, 0.3, '#475569', 1.6);
  p.poly([0, 0.01, 0.22, 0.4, 0.01, 0.22, 0.4, 0.01, 0.52, 0, 0.01, 0.52], '#1e3a5f');
  p.poly([0.03, 0.012, 0.36, 0.2, 0.012, 0.36, 0.2, 0.012, 0.49, 0.03, 0.012, 0.49], '#e2e8f0', false);
  // a tiny propliner on the picture, text lines beside it
  p.line(0.05, 0.013, 0.42, 0.18, 0.013, 0.43, '#94a3b8', 1.6);
  p.line(0.1, 0.013, 0.4, 0.13, 0.013, 0.46, '#94a3b8', 1.4);
  for (let k = 0; k < 3; k++) p.line(0.23, 0.013, 0.46 - k * 0.05, 0.37, 0.013, 0.46 - k * 0.05, '#cbd5e1', 1);
}

/** A TV camera on a tripod with a red "on air" light. */
export function drawTvCamera(p: IsoPen): void {
  p.shadow(0, 0, 9, 4, 0.16);
  p.line(0, 0, 0.26, -0.08, -0.06, 0, '#334155', 1.3);
  p.line(0, 0, 0.26, 0.08, -0.06, 0, '#334155', 1.3);
  p.line(0, 0, 0.26, 0, 0.09, 0, '#334155', 1.3);
  p.box(-0.06, -0.04, 0.08, 0.04, 0.26, 0.34, '#1f2937');
  p.box(0.08, -0.025, 0.13, 0.025, 0.28, 0.32, '#475569');
  p.circle(0.13, 0, 0.3, 1.2, '#93c5fd', false);
  p.circle(-0.04, 0, 0.35, 0.9, '#ef4444', false);
}

// ------------------------------------------------------------------ holidays

/** Bunting along x, `len` tiles: a sagging string with pennants in the holiday colors. */
export function drawBunting(p: IsoPen, len: number, colors: readonly string[]): void {
  const n = Math.round(len / 0.18);
  const z = (t: number) => -Math.sin(t * Math.PI) * 0.12;
  for (let k = 0; k < n; k++) {
    const a = k / n;
    const b = (k + 1) / n;
    p.line(a * len, 0, z(a), b * len, 0, z(b), '#475569', 0.9);
    const m = (a + b) / 2;
    const c = colors[k % colors.length];
    p.poly([a * len + 0.02, 0, z(a) - 0.005, b * len - 0.02, 0, z(b) - 0.005, m * len, 0, z(m) - 0.11], c, true, 0.8);
  }
}

/** Israeli flag on a pole: white, two blue stripes and a blue star (along x, flying in the wind). */
function flagPole(p: IsoPen, x: number, y: number, h: number): void {
  p.line(x, y, 0, x, y, h + 0.05, '#cbd5e1', 1.6);
  p.circle(x, y, h + 0.06, 1.3, '#facc15', false);
  const w = 0.42;
  const fh = 0.27;
  const top = h;
  const bot = h - fh;
  const wave = (t: number) => Math.sin(t * Math.PI * 1.5) * 0.02;
  p.poly([x, y, top, x + w, y, top + wave(1), x + w, y, bot + wave(1), x, y, bot], '#ffffff');
  for (const zz of [top - 0.04, bot + 0.07]) p.poly([x, y, zz, x + w, y, zz + wave(1), x + w, y, zz - 0.03 + wave(1), x, y, zz - 0.03], '#1f5fd1', false);
  // the star: two triangles
  const cx = x + w / 2;
  const cz = (top + bot) / 2;
  const r = 0.055;
  p.line(cx - r, y, cz - r * 0.55, cx + r, y, cz - r * 0.55, '#1f5fd1', 1.1);
  p.line(cx + r, y, cz - r * 0.55, cx, y, cz + r, '#1f5fd1', 1.1);
  p.line(cx, y, cz + r, cx - r, y, cz - r * 0.55, '#1f5fd1', 1.1);
  p.line(cx - r, y, cz + r * 0.55, cx + r, y, cz + r * 0.55, '#1f5fd1', 1.1);
  p.line(cx + r, y, cz + r * 0.55, cx, y, cz - r, '#1f5fd1', 1.1);
  p.line(cx, y, cz - r, cx - r, y, cz + r * 0.55, '#1f5fd1', 1.1);
}

function pumpkin(p: IsoPen, x: number, y: number, r: number, face: boolean): void {
  p.shadow(x, y, r * 70, r * 30, 0.2);
  for (let k = -2; k <= 2; k++) p.circle(x + k * r * 0.18, y + k * r * 0.18, r * 0.75, r * 40 * (1 - Math.abs(k) * 0.12), k === 0 ? '#f97316' : shade('#ea580c', -Math.abs(k) * 0.05));
  p.line(x, y, r * 1.35, x + 0.02, y, r * 1.7, '#3f6212', 2.2);
  if (face) {
    // carved: triangle eyes and a toothy grin, lit from inside
    const fy = y + r * 0.95;
    p.poly([x - r * 0.45, fy, r * 0.95, x - r * 0.2, fy, r * 0.95, x - r * 0.32, fy, r * 1.15], '#fde047', false);
    p.poly([x + r * 0.2, fy, r * 0.95, x + r * 0.45, fy, r * 0.95, x + r * 0.32, fy, r * 1.15], '#fde047', false);
    p.poly([x - r * 0.5, fy, r * 0.6, x + r * 0.5, fy, r * 0.6, x + r * 0.3, fy, r * 0.42, x, fy, r * 0.5, x - r * 0.3, fy, r * 0.42], '#fde047', false);
  }
}

function sapling(p: IsoPen, x: number, y: number, ribbon: string): void {
  p.box(x - 0.09, y - 0.09, x + 0.09, y + 0.09, 0, 0.12, '#a16207');
  p.line(x, y, 0.12, x, y, 0.42, '#78350f', 1.8);
  for (const [dx, dz, r] of [
    [0, 0.5, 6],
    [-0.06, 0.42, 5],
    [0.07, 0.43, 5],
  ] as const)
    p.circle(x + dx, y, dz, r, '#4ade80');
  p.circle(x + 0.02, y, 0.53, 3, '#86efac', false);
  p.line(x - 0.03, y + 0.01, 0.3, x + 0.06, y + 0.01, 0.27, ribbon, 2.2);
}

function wheat(p: IsoPen, x: number, y: number): void {
  for (let k = -3; k <= 3; k++) {
    const lean = k * 0.03;
    p.line(x, y, 0, x + lean, y, 0.42, '#ca8a04', 1.4);
    p.circle(x + lean * 1.05, y, 0.45, 1.8, '#eab308', false);
  }
  p.line(x - 0.06, y + 0.01, 0.16, x + 0.06, y + 0.01, 0.16, '#16a34a', 2.2);
}

function balloon(p: IsoPen, x: number, y: number, z: number, color: string): void {
  p.line(x, y, 0, x, y, z - 0.06, '#cbd5e1', 0.8);
  p.circle(x, y, z, 5, color);
  p.circle(x - 0.015, y, z + 0.03, 1.4, '#ffffff', false);
}

/** The hanukkiah stands across the view: a step t along it is (t, -t) * MENORAH_AXIS in tiles. */
export const MENORAH_AXIS = 0.55;

/** Where the hanukkiah's candle flames are (step along it, height), shamash last. */
export const MENORAH_FLAMES: readonly (readonly [number, number])[] = [
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [k < 4 ? -0.56 + k * 0.13 : 0.17 + (k - 4) * 0.13, 0.92] as const),
  [0, 1.08] as const,
];

/** Where the bonfire's flames are (model offsets x, y, z). */
export const BONFIRE_AT: readonly [number, number, number] = [0, 0, 0.22];

/** The holiday's centerpiece by the terminal (anchor = its middle on the ground). */
export function drawHolidayPiece(pen: IsoPen, id: HolidayId): void {
  let p = pen;
  switch (id) {
    case 'hanukkah': {
      // a big gold hanukkiah facing you: eight branches in a row and the shamash raised in the middle
      const at = (t: number): [number, number] => [t * MENORAH_AXIS, -t * MENORAH_AXIS];
      p.shadow(0, 0, 40, 10, 0.2);
      p.box(-0.16, -0.16, 0.16, 0.16, 0, 0.1, '#cbd5e1');
      p.box(-0.04, -0.04, 0.04, 0.04, 0.1, 0.62, '#d4a017');
      const [ax, ay] = at(-0.62);
      const [bx, by] = at(0.62);
      p.line(ax, ay, 0.63, bx, by, 0.63, '#b45309', 5.5);
      p.line(ax, ay, 0.645, bx, by, 0.645, '#eab308', 3.5);
      MENORAH_FLAMES.slice(0, 8).forEach(([t], k) => {
        const [x, y] = at(t);
        p.line(x, y, 0.64, x, y, 0.8, '#d4a017', 3);
        p.circle(x, y, 0.8, 2.2, '#eab308', false);
        // the candles: blue and white
        p.line(x, y, 0.81, x, y, 0.9, k % 2 ? '#ffffff' : '#60a5fa', 3.2);
      });
      p.line(0, 0, 0.62, 0, 0, 0.96, '#d4a017', 3.4);
      p.circle(0, 0, 0.96, 2.6, '#eab308', false);
      p.line(0, 0, 0.97, 0, 0, 1.06, '#ffffff', 3.4);
      // sufganiyot (doughnuts) on a tray beside it
      p.box(0.18, 0.12, 0.42, 0.32, 0, 0.16, '#f1f5f9');
      for (const [dx, dy] of [
        [0.24, 0.17],
        [0.36, 0.17],
        [0.3, 0.26],
      ])
        p.circle(dx, dy, 0.19, 3, '#c2410c');
      return;
    }
    case 'sukkot': {
      // a sukkah: wooden posts, fabric walls at the back, a roof of palm fronds, hanging fruit and paper chains
      const W = 0.9;
      const D = 0.7;
      const H = 0.62;
      // (drawn from its back corner; the anchor is its middle)
      p = new IsoPen(p.canvas, p.X(-W / 2, -D / 2), p.Y(-W / 2, -D / 2, 0), p.sc);
      p.shadow(W / 2, D / 2, 52, 22, 0.22);
      p.poly([0, 0, 0, W, 0, 0, W, 0, H, 0, 0, H], '#fef3c7');
      p.poly([0, 0, 0, 0, D, 0, 0, D, H, 0, 0, H], '#fde68a');
      for (let k = 1; k < 6; k++) p.line(0, 0, k * 0.1, W, 0, k * 0.1, k % 2 ? '#fca5a5' : '#93c5fd', 1);
      for (const [x, y] of [
        [0, 0],
        [W, 0],
        [0, D],
        [W, D],
      ])
        p.box(x - 0.025, y - 0.025, x + 0.025, y + 0.025, 0, H, '#a16207');
      // roof beams and fronds
      p.line(0, 0, H, W, 0, H, '#92400e', 2);
      p.line(0, D, H, W, D, H, '#92400e', 2);
      for (let k = 0; k <= 8; k++) {
        const x = (k / 8) * W;
        p.line(x, -0.05, H + 0.02, x + 0.05, D + 0.05, H + 0.04, k % 2 ? '#15803d' : '#22c55e', 2.6);
      }
      // hanging fruit and a paper chain along the front
      const fruit = ['#ef4444', '#f59e0b', '#a3e635', '#8b5cf6'];
      for (let k = 0; k < 4; k++) {
        const x = 0.15 + k * 0.2;
        p.line(x, D, H, x, D, H - 0.15, '#64748b', 0.8);
        p.circle(x, D, H - 0.18, 3.2, fruit[k]);
      }
      for (let k = 0; k < 6; k++) p.circle(0.08 + k * 0.15, D, H - 0.05 - Math.sin((k / 5) * Math.PI) * 0.06, 2, k % 2 ? '#f472b6' : '#facc15', false);
      // a table with a jug inside
      p.box(0.3, 0.25, 0.6, 0.45, 0, 0.22, '#d6d3d1');
      p.box(0.42, 0.3, 0.48, 0.36, 0.22, 0.32, '#60a5fa');
      return;
    }
    case 'roshHashana': {
      // a giant apple, a honey jar with a dipper, a pomegranate
      p.shadow(0, 0, 40, 14, 0.2);
      for (let k = 0; k < 6; k++) p.circle(-0.15, -0.05, 0.12 + k * 0.035, 15 - Math.abs(k - 2.5) * 2.2, k > 3 ? '#f87171' : '#dc2626', k === 0);
      p.circle(-0.21, -0.05, 0.27, 3.5, '#fecaca', false);
      p.line(-0.15, -0.05, 0.32, -0.13, -0.05, 0.4, '#78350f', 2);
      p.poly([-0.13, -0.05, 0.38, 0.0, -0.05, 0.44, -0.05, -0.05, 0.35], '#22c55e');
      // honey jar
      p.box(0.12, 0.1, 0.32, 0.3, 0, 0.26, '#f59e0b');
      p.box(0.11, 0.09, 0.33, 0.31, 0.26, 0.3, '#fef3c7');
      p.line(0.22, 0.2, 0.3, 0.3, 0.2, 0.42, '#a16207', 2);
      p.circle(0.31, 0.2, 0.43, 2.4, '#ca8a04', false);
      // pomegranate with its crown
      p.circle(0.3, -0.25, 0.1, 8, '#be123c');
      p.poly([0.27, -0.25, 0.18, 0.33, -0.25, 0.18, 0.3, -0.25, 0.23], '#9f1239', false);
      return;
    }
    case 'tuBishvat':
      sapling(p, -0.3, 0, '#f472b6');
      sapling(p, 0.05, 0.12, '#60a5fa');
      sapling(p, 0.35, -0.05, '#facc15');
      return;
    case 'purim': {
      // two big masks on poles (comedy and festivity), a noisemaker, confetti on the ground
      p.shadow(0, 0, 38, 12, 0.18);
      for (const [x, c] of [
        [-0.22, '#e23bb0'],
        [0.22, '#36b6e8'],
      ] as const) {
        p.line(x, 0, 0, x, 0, 0.5, '#78350f', 1.8);
        p.poly([x - 0.18, 0, 0.62, x + 0.18, 0, 0.62, x + 0.15, 0, 0.5, x, 0, 0.47, x - 0.15, 0, 0.5], c);
        p.circle(x - 0.08, 0, 0.57, 2.2, '#1f2937', false);
        p.circle(x + 0.08, 0, 0.57, 2.2, '#1f2937', false);
        p.line(x - 0.18, 0, 0.62, x - 0.26, 0, 0.72, '#facc15', 2);
        p.line(x + 0.18, 0, 0.62, x + 0.26, 0, 0.72, '#7ed957', 2);
      }
      const conf = ['#e23bb0', '#facc15', '#36b6e8', '#7ed957', '#f97316'];
      for (let k = 0; k < 16; k++) {
        const a = k * 2.4;
        const r = 0.15 + (k % 5) * 0.08;
        p.circle(Math.cos(a) * r, Math.sin(a) * r * 0.8, 0.005, 1.4, conf[k % conf.length], false);
      }
      // a noisemaker (gragger)
      p.box(0.02, 0.18, 0.12, 0.24, 0, 0.1, '#facc15');
      p.line(0.07, 0.21, 0.1, 0.07, 0.21, 0.2, '#78350f', 1.6);
      return;
    }
    case 'passover': {
      // a big silver cup of Elijah, a stack of matzah, spring flowers around
      p.shadow(0, 0, 40, 14, 0.18);
      p.circle(0, 0, 0.02, 7, '#94a3b8');
      p.line(0, 0, 0.02, 0, 0, 0.22, '#cbd5e1', 3);
      for (let k = 0; k < 6; k++) p.circle(0, 0, 0.24 + k * 0.035, 7 + k * 0.6, k === 5 ? '#7f1d1d' : '#e2e8f0', k === 0);
      for (let k = 0; k < 4; k++) p.box(0.25, 0.1, 0.55, 0.36, k * 0.035, k * 0.035 + 0.03, k % 2 ? '#fde68a' : '#fcd34d', true);
      const fl = ['#f472b6', '#facc15', '#a78bfa', '#fb7185', '#ffffff'];
      for (let k = 0; k < 12; k++) {
        const a = k * 0.52 + 0.3;
        const x = Math.cos(a) * 0.42;
        const y = Math.sin(a) * 0.3;
        p.line(x, y, 0, x, y, 0.08, '#16a34a', 1.2);
        p.circle(x, y, 0.09, 2.4, fl[k % fl.length], false);
      }
      return;
    }
    case 'independence':
      flagPole(p, -0.45, 0, 0.95);
      flagPole(p, 0.05, 0.05, 1.05);
      flagPole(p, 0.55, 0.1, 0.95);
      return;
    case 'lagBaomer': {
      // a ring of stones and a teepee of logs (the flames are drawn live)
      p.shadow(0, 0, 30, 11, 0.22);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        p.circle(Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.02, 3, '#9ca3af');
      }
      p.circle(0, 0, 0.0, 9, '#1f2937', false);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        p.line(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.02, 0, 0, 0.32, k % 2 ? '#92400e' : '#78350f', 3);
      }
      return;
    }
    case 'shavuot':
      p.shadow(0, 0, 40, 12, 0.18);
      wheat(p, -0.35, 0);
      wheat(p, 0.35, 0.05);
      // a basket of fruit and a flower crown on it
      p.box(-0.15, -0.1, 0.15, 0.12, 0, 0.18, '#b45309');
      for (const [dx, dy, c] of [
        [-0.07, 0, '#ef4444'],
        [0.05, -0.02, '#facc15'],
        [0, 0.07, '#a3e635'],
        [0.08, 0.06, '#f97316'],
      ] as const)
        p.circle(dx, dy, 0.22, 3.4, c);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        p.circle(Math.cos(a) * 0.16, Math.sin(a) * 0.13, 0.27, 1.8, k % 2 ? '#f9a8d4' : '#ffffff', false);
      }
      return;
    case 'newYear': {
      // a balloon arch
      p.shadow(0, 0, 44, 12, 0.18);
      const cols = ['#f6c344', '#c9ced6', '#e5383b', '#f6c344', '#c9ced6'];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const x = -0.6 + t * 1.2;
        const z = Math.sin(t * Math.PI) * 0.75 + 0.08;
        p.circle(x, 0, z, 5.2, cols[k % cols.length]);
        p.circle(x - 0.015, 0, z + 0.03, 1.3, '#ffffff', false);
      }
      balloon(p, -0.2, 0.25, 0.55, '#f6c344');
      balloon(p, 0.25, 0.3, 0.6, '#e5383b');
      return;
    }
    case 'halloween':
      p.box(-0.45, -0.12, -0.05, 0.12, 0, 0.18, '#eab308');
      for (let k = 0; k < 5; k++) p.line(-0.45, -0.12 + k * 0.06, 0.18, -0.05, -0.12 + k * 0.06, 0.18, '#ca8a04', 1);
      pumpkin(p, -0.25, 0, 0.26, true);
      pumpkin(p, 0.18, 0.12, 0.3, true);
      pumpkin(p, 0.45, -0.1, 0.18, false);
      return;
  }
}
