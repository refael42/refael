/**
 * The land around the airport (owner request: grow to the sides like Hay Day
 * or Clash of Clans): the obstacles on wild plots, the sign on a plot for
 * sale, and the pieces the facilities are built from (their count and size
 * grow with the level). Chunky shapes, few colours, soft shadows. Drawn with
 * the iso pen, anchored at the piece's foot.
 */
import type { IsoPen } from './objects';

/** A round bush of three green blobs. */
export function drawBush(p: IsoPen): void {
  p.shadow(0.02, 0.02, 13, 5, 0.22);
  p.circle(-0.08, 0.04, 0.12, 7, '#15803d');
  p.circle(0.08, -0.03, 0.14, 8, '#16a34a');
  p.circle(0.02, 0.06, 0.2, 7.5, '#22c55e');
  p.circle(0.05, 0.02, 0.27, 3, '#4ade80', false);
}

/** A tree stump with its rings and a root or two. */
export function drawStump(p: IsoPen): void {
  p.shadow(0, 0, 9, 4, 0.22);
  for (let z = 0; z < 0.16; z += 0.02) p.circle(0, 0, z, 6, '#92400e', false);
  p.circle(0, 0, 0.16, 6, '#fcd34d');
  p.circle(0, 0, 0.165, 3.6, '#d97706', false);
  p.circle(0, 0, 0.167, 1.4, '#b45309', false);
  p.line(0.08, 0.02, 0.02, 0.18, 0.06, 0, '#78350f', 2.2);
  p.line(-0.06, 0.06, 0.02, -0.14, 0.14, 0, '#78350f', 2);
}

/** A big grey boulder with a lighter top and a crack. */
export function drawBoulder(p: IsoPen): void {
  p.shadow(0.03, 0.03, 18, 7, 0.24);
  p.poly([-0.22, 0.06, 0, -0.1, -0.18, 0, 0.16, -0.14, 0, 0.24, 0.04, 0, 0.12, 0.2, 0, -0.14, 0.18, 0], '#64748b');
  p.poly([-0.18, 0.04, 0.16, -0.06, -0.14, 0.3, 0.14, -0.1, 0.24, 0.18, 0.02, 0.16, 0.1, 0.16, 0.12, -0.12, 0.14, 0.1], '#94a3b8');
  p.poly([-0.06, -0.08, 0.3, 0.1, -0.08, 0.26, 0.08, 0.06, 0.2, -0.08, 0.04, 0.22], '#cbd5e1', false);
  p.line(0.0, -0.02, 0.28, 0.06, 0.08, 0.16, '#475569', 1.2);
}

/** An old wooden shed, a little crooked, with a rusty roof. */
export function drawShed(p: IsoPen): void {
  p.shadow(0.05, 0.05, 22, 9, 0.24);
  p.box(-0.25, -0.2, 0.25, 0.2, 0, 0.32, '#a16207');
  for (let k = 0; k < 4; k++) p.line(-0.25 + k * 0.12, 0.2, 0.02, -0.25 + k * 0.12, 0.2, 0.3, '#713f12', 1);
  p.poly([0.25, -0.06, 0.02, 0.25, 0.08, 0.02, 0.25, 0.08, 0.22, 0.25, -0.06, 0.22], '#422006', false);
  p.gableX(-0.25, -0.2, 0.25, 0.2, 0.32, 0.14, '#b45309', 0.05);
}

/** Three square straw bales, two below and one on top, tied with twine. */
export function drawHay(p: IsoPen): void {
  p.shadow(0.04, 0.04, 17, 7, 0.22);
  const bale = (x: number, y: number, z: number) => {
    p.box(x - 0.13, y - 0.09, x + 0.13, y + 0.09, z, z + 0.14, '#d9b85c');
    for (const t of [-0.06, 0.06]) {
      p.line(x + t, y - 0.09, z + 0.14, x + t, y + 0.09, z + 0.14, '#92400e', 0.9);
      p.line(x + t, y + 0.09, z, x + t, y + 0.09, z + 0.14, '#92400e', 0.9);
    }
    for (let k = 0; k < 5; k++) p.line(x - 0.12, y - 0.07 + k * 0.035, z + 0.141, x + 0.12, y - 0.07 + k * 0.035, z + 0.141, 'rgba(255,255,255,0.25)', 0.6);
  };
  bale(-0.1, -0.06, 0);
  bale(0.1, 0.08, 0);
  bale(0, 0.01, 0.14);
}

/** The sign on a plot for sale: a board on two posts, green with a white coin badge. */
export function drawLandSign(p: IsoPen): void {
  p.shadow(0, 0, 10, 4, 0.2);
  for (const y of [-0.12, 0.12]) p.box(-0.015, y - 0.015, 0.015, y + 0.015, 0, 0.42, '#92400e', false);
  p.box(-0.02, -0.2, 0.02, 0.2, 0.26, 0.5, '#16a34a');
  p.poly([0.021, -0.18, 0.28, 0.021, 0.18, 0.28, 0.021, 0.18, 0.48, 0.021, -0.18, 0.48], '#22c55e', false);
  p.circle(0.022, 0, 0.38, 3.6, '#ffffff', false);
  p.circle(0.023, 0, 0.38, 2.4, '#facc15', false);
}

/** The car rental office: a small pavilion with glass, a big orange sign and two flags. Bigger at higher levels. */
export function drawRentalOffice(p: IsoPen, lv: number): void {
  const w = 0.5 + 0.08 * lv;
  p.shadow(0.1, 0.1, 30 + lv * 3, 12, 0.22);
  p.box(-w / 2, -0.3, w / 2, 0.3, 0, 0.42, '#f8fafc');
  p.poly([w / 2, -0.24, 0.05, w / 2, 0.24, 0.05, w / 2, 0.24, 0.34, w / 2, -0.24, 0.34], '#7dd3fc', false);
  p.box(-w / 2 - 0.04, -0.34, w / 2 + 0.04, 0.34, 0.42, 0.47, '#ea580c');
  p.box(-0.18, -0.06, 0.18, 0.06, 0.47, 0.66, '#f97316');
  p.poly([0.18, -0.04, 0.5, 0.18, 0.04, 0.5, 0.18, 0.04, 0.63, 0.18, -0.04, 0.63], '#fff7ed', false);
  for (const y of [-0.42, 0.42]) {
    p.line(w / 2 + 0.1, y, 0, w / 2 + 0.1, y, 0.85, '#94a3b8', 1.4);
    p.poly([w / 2 + 0.1, y, 0.85, w / 2 + 0.1, y + 0.14, 0.8, w / 2 + 0.1, y, 0.72], y < 0 ? '#ef4444' : '#f97316', false);
  }
}

/** A row of solar panels on legs, tilted to the sun (along x, 1.6 tiles). */
export function drawSolarRow(p: IsoPen): void {
  p.shadow(0.8, 0.05, 30, 7, 0.18);
  for (let k = 0; k < 4; k++) {
    const x0 = k * 0.4;
    p.line(x0 + 0.08, -0.12, 0, x0 + 0.08, -0.12, 0.22, '#94a3b8', 1.4);
    p.line(x0 + 0.32, -0.12, 0, x0 + 0.32, -0.12, 0.22, '#94a3b8', 1.4);
    p.poly([x0 + 0.02, -0.22, 0.24, x0 + 0.38, -0.22, 0.24, x0 + 0.38, 0.14, 0.08, x0 + 0.02, 0.14, 0.08], '#1e3a8a');
    for (let j = 1; j < 3; j++) p.line(x0 + 0.02 + j * 0.12, -0.22, 0.24, x0 + 0.02 + j * 0.12, 0.14, 0.08, '#60a5fa', 0.8);
    p.line(x0 + 0.02, -0.04, 0.16, x0 + 0.38, -0.04, 0.16, '#60a5fa', 0.8);
    p.poly([x0 + 0.05, -0.2, 0.235, x0 + 0.18, -0.2, 0.235, x0 + 0.18, -0.12, 0.2, x0 + 0.05, -0.12, 0.2], 'rgba(255,255,255,0.35)', false);
  }
}

/** The flight school's hangar: a round roof on low walls, the door open, a stripe of school colours. */
export function drawSchoolHangar(p: IsoPen, lv: number): void {
  const L = 0.9 + 0.1 * lv;
  p.shadow(0.1, 0.1, 40, 16, 0.22);
  p.box(-L / 2, -0.5, L / 2, 0.5, 0, 0.3, '#e2e8f0');
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI;
    const y = -Math.cos(a) * 0.5;
    const z = 0.3 + Math.sin(a) * 0.3;
    p.line(-L / 2, y, z, L / 2, y, z, k % 2 ? '#64748b' : '#94a3b8', 3.2);
  }
  // the open door (+x end) and the stripe
  p.poly([L / 2 + 0.001, -0.36, 0, L / 2 + 0.001, 0.36, 0, L / 2 + 0.001, 0.36, 0.42, L / 2 + 0.001, -0.36, 0.42], '#1e293b', false);
  p.poly([-L / 2, 0.5, 0.2, L / 2, 0.5, 0.2, L / 2, 0.5, 0.27, -L / 2, 0.5, 0.27], '#2563eb', false);
}

/** A little high-wing training plane, parked (nose toward +x). */
export function drawTrainer(p: IsoPen, color: string): void {
  p.shadow(0, 0, 16, 6, 0.24);
  p.box(-0.26, -0.05, 0.22, 0.05, 0.05, 0.15, '#f8fafc');
  p.box(0.22, -0.035, 0.28, 0.035, 0.07, 0.13, '#cbd5e1');
  p.box(-0.04, -0.34, 0.1, 0.34, 0.16, 0.18, color);
  p.box(-0.3, -0.12, -0.22, 0.12, 0.13, 0.15, color);
  p.box(-0.3, -0.01, -0.24, 0.01, 0.15, 0.27, color);
  p.box(0.04, -0.04, 0.12, 0.04, 0.15, 0.17, '#38bdf8', false);
  for (const y of [-0.08, 0.08]) p.line(0.06, y, 0.05, 0.06, y, 0, '#334155', 1.4);
  p.line(0.29, 0, 0.05, 0.29, 0, 0.16, '#475569', 1.6);
}

/** A warehouse (size 1 to 3): a long box with a ridged roof, loading doors on the +x side, a yellow stripe. */
export function drawWarehouse(p: IsoPen, size: number): void {
  const L = 0.8 + 0.45 * size;
  const H = 0.38 + 0.08 * size;
  p.shadow(0.1, 0.1, 30 + 14 * size, 14, 0.24);
  p.box(-L / 2, -0.55, L / 2, 0.55, 0, H, '#cbd5e1');
  for (let k = 0; k < 6; k++) p.line(-L / 2 + 0.05, -0.55 + (k + 0.5) * (1.1 / 6), H + 0.002, L / 2 - 0.05, -0.55 + (k + 0.5) * (1.1 / 6), H + 0.002, '#94a3b8', 1);
  for (let k = 0; k < Math.min(4, size + 1); k++) {
    const y = -0.4 + k * 0.27;
    p.poly([L / 2 + 0.001, y, 0, L / 2 + 0.001, y + 0.18, 0, L / 2 + 0.001, y + 0.18, 0.26, L / 2 + 0.001, y, 0.26], '#475569', false);
    for (let z = 0.04; z < 0.26; z += 0.05) p.line(L / 2 + 0.002, y + 0.01, z, L / 2 + 0.002, y + 0.17, z, '#64748b', 0.6);
  }
  p.poly([-L / 2, 0.551, H - 0.08, L / 2, 0.551, H - 0.08, L / 2, 0.551, H - 0.04, -L / 2, 0.551, H - 0.04], '#facc15', false);
}

/** A small box truck, parked (nose toward +x). */
export function drawBoxTruck(p: IsoPen, color: string): void {
  p.shadow(0, 0, 18, 6, 0.24);
  p.box(-0.3, -0.1, 0.12, 0.1, 0.05, 0.3, '#f8fafc');
  p.poly([-0.3, 0.101, 0.12, 0.12, 0.101, 0.12, 0.12, 0.101, 0.2, -0.3, 0.101, 0.2], color, false);
  p.box(0.12, -0.09, 0.3, 0.09, 0.05, 0.24, color);
  p.box(0.25, -0.08, 0.301, 0.08, 0.15, 0.22, '#7dd3fc', false);
  for (const x of [-0.2, 0.2]) for (const y of [-0.1, 0.1]) p.circle(x, y, 0.05, 2.6, '#1e293b', false);
}

/** The garden's fountain: a round basin with a jet of water (two frames). */
export function drawGardenFountain(p: IsoPen, frame: number): void {
  p.shadow(0, 0, 22, 9, 0.2);
  for (let z = 0; z < 0.12; z += 0.02) p.circle(0, 0, z, 18, '#cbd5e1', false);
  p.circle(0, 0, 0.12, 18, '#e2e8f0');
  p.circle(0, 0, 0.125, 15, '#38bdf8', false);
  p.circle(0, 0, 0.13, 6, '#7dd3fc', false);
  for (let z = 0.12; z < 0.3; z += 0.02) p.circle(0, 0, z, 2.2, '#cbd5e1', false);
  const h = frame % 2 === 0 ? 0.62 : 0.56;
  for (let z = 0.3; z < h; z += 0.03) p.circle(0, 0, z, 1.8 + (z - 0.3) * 4, 'rgba(186,230,253,0.85)', false);
  for (const [dx, dy] of [
    [0.12, 0],
    [-0.12, 0],
    [0, 0.12],
    [0, -0.12],
  ] as const)
    p.circle(dx * (frame % 2 ? 1.1 : 1), dy * (frame % 2 ? 1.1 : 1), 0.2, 1.6, '#e0f2fe', false);
}

/** A round flower bed with a stone edge. */
export function drawFlowerBed(p: IsoPen, seed: number): void {
  p.shadow(0, 0, 14, 6, 0.16);
  for (let z = 0; z < 0.06; z += 0.02) p.circle(0, 0, z, 11, '#a8a29e', false);
  p.circle(0, 0, 0.06, 10, '#65a30d');
  const cols = ['#f43f5e', '#facc15', '#a855f7', '#fb923c', '#f8fafc'];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + seed;
    const r = (k % 3) * 0.05 + 0.03;
    p.circle(Math.cos(a) * r, Math.sin(a) * r, 0.09, 2.1, cols[(k + seed) % cols.length], false);
  }
}

/** The land hotel: a tower of floors (more with each level) on a lobby, rows of windows, a rooftop sign. */
export function drawLandHotel(p: IsoPen, floors: number): void {
  const fh = 0.26;
  const top = 0.42 + floors * fh;
  p.shadow(0.2, 0.2, 46, 18, 0.26);
  // the lobby: glass all round, a canopy over the door
  p.box(-0.85, -0.6, 0.85, 0.6, 0, 0.42, '#e2e8f0');
  p.poly([0.85, -0.5, 0.04, 0.85, 0.5, 0.04, 0.85, 0.5, 0.36, 0.85, -0.5, 0.36], '#7dd3fc', false);
  p.box(0.85, -0.25, 1.1, 0.25, 0.34, 0.38, '#b91c1c');
  // the tower: cream floors with window bands
  p.box(-0.7, -0.5, 0.7, 0.5, 0.42, top, '#fef3c7');
  for (let k = 0; k < floors; k++) {
    const z = 0.42 + k * fh + 0.07;
    p.poly([0.701, -0.44, z, 0.701, 0.44, z, 0.701, 0.44, z + 0.13, 0.701, -0.44, z + 0.13], '#38bdf8', false);
    p.poly([-0.64, 0.501, z, 0.64, 0.501, z, 0.64, 0.501, z + 0.13, -0.64, 0.501, z + 0.13], '#0ea5e9', false);
    for (let w = 0; w < 4; w++) p.line(0.702, -0.44 + w * 0.29, z, 0.702, -0.44 + w * 0.29, z + 0.13, '#fef3c7', 1.2);
  }
  // the roof and its red sign with a gold star
  p.box(-0.74, -0.54, 0.74, 0.54, top, top + 0.05, '#94a3b8');
  p.box(-0.3, -0.04, 0.3, 0.04, top + 0.05, top + 0.3, '#dc2626');
  p.poly([0.3, -0.03, top + 0.07, 0.3, 0.03, top + 0.07, 0.3, 0.03, top + 0.28, 0.3, -0.03, top + 0.28], '#ef4444', false);
  p.circle(0.31, 0, top + 0.18, 3, '#facc15', false);
}

/** The outlet mall: a long low building with coloured shop fronts under striped awnings (longer at higher levels). */
export function drawMall(p: IsoPen, size: number): void {
  const L = 1.6 + 0.55 * size;
  p.shadow(0.2, 0.2, 50 + 16 * size, 20, 0.24);
  p.box(-L / 2, -0.7, L / 2, 0.7, 0, 0.5, '#f8fafc');
  // shop fronts along the +y side, each its own colour, with an awning
  const cols = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
  const n = Math.floor(L / 0.45);
  for (let k = 0; k < n; k++) {
    const x0 = -L / 2 + 0.06 + k * (L / n);
    const x1 = x0 + L / n - 0.08;
    const c = cols[k % cols.length];
    p.poly([x0, 0.701, 0.04, x1, 0.701, 0.04, x1, 0.701, 0.32, x0, 0.701, 0.32], '#bae6fd', false);
    p.poly([x0, 0.701, 0.33, x1, 0.701, 0.33, x1, 0.701, 0.42, x0, 0.701, 0.42], c, false);
    p.poly([x0, 0.701, 0.42, x1, 0.701, 0.42, x1, 0.86, 0.34, x0, 0.86, 0.34], c, false);
    p.poly([x0 + (x1 - x0) / 3, 0.702, 0.42, x0 + (2 * (x1 - x0)) / 3, 0.702, 0.42, x0 + (2 * (x1 - x0)) / 3, 0.86, 0.34, x0 + (x1 - x0) / 3, 0.86, 0.34], '#ffffff', false);
  }
  // the main entrance at the +x end: a tall glass box with a sign
  p.box(L / 2 - 0.05, -0.35, L / 2 + 0.2, 0.35, 0, 0.72, '#e2e8f0');
  p.poly([L / 2 + 0.201, -0.28, 0.04, L / 2 + 0.201, 0.28, 0.04, L / 2 + 0.201, 0.28, 0.6, L / 2 + 0.201, -0.28, 0.6], '#7dd3fc', false);
  p.box(L / 2 - 0.05, -0.38, L / 2 + 0.22, 0.38, 0.72, 0.8, '#7c3aed');
  p.box(-L / 2 - 0.02, -0.72, L / 2 + 0.02, 0.72, 0.5, 0.55, '#cbd5e1');
}
