import { Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onFaceX, onFaceY, onTop, P, rectIn } from './iso3d';
import { fill, path, stroke, type Pt } from './kit';

// Isometric low-poly props. Anchor = center of the footprint on the floor (tiles x/y, z in px).

const GOLD = '#E2B13C';
const WOOD_DARK = '#5A2E1E';

// ---------- kitchen ----------

const ovenGlow = sprite([-44, -40, 44, 14], (c) =>
  onFaceX(c, 0.43, 0.93, () => {
    rectIn(c, 0.2, 5, 1.46, 8, '#FF9A3A', 0.75);
    rectIn(c, 0.35, 6.5, 1.16, 5, '#FFD27A', 0.7);
  }),
);
const pan = sprite([-20, -16, 14, 8], (c) => {
  box(c, { x: -0.2, y: 0, z: 2, w: 0.3, d: 0.05, h: 1.5, color: '#3B2B26' });
  cylinder(c, 0, 0, 0.2, 0, 3, '#2A2730', '#3E3946');
});
const patty = sprite([-10, -10, 10, 6], (c) => cylinder(c, 0, 0, 0.11, 0, 2.2, '#7A4128', '#94552F'));
const pot = sprite([-14, -24, 14, 8], (c) => {
  cylinder(c, 0, 0, 0.2, 0, 11, '#D8342C', '#B8291F');
  cylinder(c, 0, 0, 0.18, 11, 1.4, '#C9D1D9', '#E4E9EE');
  box(c, { x: 0, y: 0, z: 12.4, w: 0.05, d: 0.05, h: 2, color: '#2B2F38' });
});
const flame = sprite([-4, -10, 4, 2], (c) => {
  c.drawPath(path.smooth([[0, -8], [2.4, -3], [1.8, 0], [-1.8, 0], [-2.4, -3]]), fill('#FF7A2A', 0.95));
  c.drawPath(path.smooth([[0, -5], [1.3, -1.8], [0.8, 0], [-0.8, 0], [-1.3, -1.8]]), fill('#FFE07A'));
});

/** The pass counter, `len` tiles long (3; 5 in the deep buildings' bigger kitchen). */
function passCounter(c: SkCanvas, len: number) {
  const d = len - 0.2;
  floorShadow(c, 0.1, 0, len * 0.4, 0.3);
  box(c, { x: 0, y: 0, w: 0.8, d, h: 21, color: WOOD_DARK });
  onFaceX(c, 0.4, d / 2, () => {
    for (let a = 0.12; a < d - 0.1; a += 0.46) rectIn(c, a, 3, 0.36, 14, lighten(WOOD_DARK, 0.08));
  });
  onFaceY(c, d / 2, -0.4, () => rectIn(c, 0.08, 3, 0.64, 14, lighten(WOOD_DARK, 0.06)));
  box(c, { x: 0, y: 0, z: 21, w: 0.84, d: d + 0.04, h: 2, color: GOLD, rim: true });
  box(c, { x: 0, y: 0, z: 23, w: 0.8, d, h: 1, color: '#D8DEE5' });
  // Service bell: rung when a dish is ready.
  cylinder(c, 0.15, d / 2 - 0.2, 0.07, 24, 1, '#B8892A', GOLD);
  cylinder(c, 0.15, d / 2 - 0.2, 0.05, 25, 3, GOLD, '#FFE08A');
  // Ticket rail on the kitchen side: orders hang here until cooked.
  for (const y of [-(d / 2 - 0.05), d / 2 - 0.05]) box(c, { x: -0.4, y, z: 24, w: 0.05, d: 0.05, h: 30, color: '#C9D1D9' });
  box(c, { x: -0.4, y: 0, z: 50, w: 0.06, d: d - 0.04, h: 3, color: '#D8DEE5', rim: true });
}
const pass = sprite([-62, -92, 62, 24], (c) => passCounter(c, 3));
const passLong = sprite([-94, -108, 94, 40], (c) => passCounter(c, 5));
/** A paper order ticket (billboard), hanging from its clip. */
const ticket = sprite([-8, -2, 8, 20], (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-1.6, -1, 3.2, 3), 0.6, 0.6), fill('#7E8A98'));
  c.drawRect(Skia.XYWHRect(-5.6, 1.6, 11.2, 15), fill('#3A2A30', 0.25));
  c.drawRect(Skia.XYWHRect(-6, 1, 11.2, 15), fill('#FFFDF4'));
  c.drawRect(Skia.XYWHRect(-6, 1, 11.2, 2.4), fill('#E5483B'));
  for (const y of [12.4, 14.2]) c.drawRect(Skia.XYWHRect(-4.4, y, 8, 0.7), fill('#C9C2B4'));
});
const plateSingleDirty = sprite([-12, -8, 12, 6], (c) => {
  cylinder(c, 0, 0, 0.14, 0, 1.6, '#CFC9BE', '#EDE7DC');
  onTop(c, 1.6, () => {
    c.drawCircle(0.03, 0, 0.065, fill('#A35A2E', 0.7));
    c.drawCircle(-0.06, 0.05, 0.016, fill('#A35A2E', 0.8));
  });
});

const washPlate = sprite([-10, -6, 10, 6], (c) => cylinder(c, 0, 0, 0.13, 0, 1, '#E2E6EC', '#FFFFFF'));

// ---------- dining ----------

const plateDirty = sprite([-14, -10, 14, 6], (c) => {
  cylinder(c, 0, 0, 0.13, 0, 1.2, '#D5D0C6', '#F0EBE2');
  onTop(c, 1.2, () => {
    c.drawCircle(0.02, -0.01, 0.06, fill('#A35A2E', 0.75));
    c.drawCircle(-0.06, 0.04, 0.015, fill('#A35A2E', 0.8));
    c.drawCircle(0.07, 0.05, 0.012, fill('#A35A2E', 0.8));
  });
});
const glass = sprite([-6, -16, 6, 4], (c) => cylinder(c, 0, 0, 0.035, 0, 8, '#BFE3FF', '#E58A3A'));
const glassEmpty = sprite([-6, -16, 6, 4], (c) => cylinder(c, 0, 0, 0.035, 0, 8, '#D6EEFF', '#EAF6FF'));
const stain = sprite([-12, -26, 12, 6], (c) =>
  onTop(c, 17.2, () => c.drawOval(Skia.XYWHRect(-0.12, -0.07, 0.22, 0.14), fill('#9C5A30', 0.3))),
);

// ---------- decor ----------

/** Palm leaves fanning out from the top of a trunk (shared by potted palms and trees). */
export function palmFronds(c: SkCanvas, top: Pt, size: number) {
  const [tx, ty] = top;
  const leaves = [
    [-150, '#2E8B47'], [-30, '#2E8B47'], [-110, '#3FA65A'], [-70, '#3FA65A'], [170, '#36994F'], [10, '#36994F'], [-90, '#4CBB66'],
  ] as const;
  for (const [deg, col] of leaves) {
    const a = (deg * Math.PI) / 180;
    const len = size * (deg === -90 ? 0.7 : 1);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.55 + len * 0.28;
    const nx = -Math.sin(a) * size * 0.16;
    const ny = Math.cos(a) * size * 0.08;
    const mx = (tx + ex) / 2;
    const my = (ty + ey) / 2 - size * 0.18;
    c.drawPath(path.smooth([[tx, ty], [mx + nx, my + ny], [ex, ey], [mx - nx, my - ny]], true, 0.8), fill(col));
    c.drawPath(path.smooth([[tx, ty], [mx, my], [ex, ey]], false), stroke(darken(col, 0.25), 0.7));
  }
}
const treePalm = sprite([-50, -150, 50, 14], (c) => {
  floorShadow(c, 0, 0, 0.5, 0.25);
  for (let i = 0; i < 10; i++) box(c, { x: 0.012 * i, y: -0.006 * i, z: i * 10, w: 0.12, d: 0.12, h: 10, color: i % 2 ? '#8A6239' : '#7A5430' });
  palmFronds(c, P(0.12, -0.06, 100), 46);
});
const treeRound = sprite([-46, -120, 46, 14], (c) => {
  floorShadow(c, 0, 0, 0.5, 0.25);
  box(c, { x: 0, y: 0, w: 0.14, d: 0.14, h: 40, color: '#7A5430' });
  box(c, { x: 0, y: 0, z: 34, w: 0.8, d: 0.8, h: 34, color: '#2E8B47' });
  box(c, { x: 0, y: 0, z: 68, w: 0.55, d: 0.55, h: 18, color: '#3FA65A' });
});
/** Jerusalem: a gnarled olive tree, silver-green and wide. */
const treeOlive = sprite([-50, -110, 50, 14], (c) => {
  floorShadow(c, 0, 0, 0.55, 0.25);
  for (let i = 0; i < 4; i++) box(c, { x: 0.03 * Math.sin(i * 1.7), y: 0.03 * Math.cos(i * 1.3), z: i * 9, w: 0.16 - i * 0.015, d: 0.16 - i * 0.015, h: 9, color: i % 2 ? '#7A6A52' : '#6A5A44' });
  for (const [x, y, z, w, h, color] of [[0, 0, 32, 0.95, 18, '#7E9A6A'], [-0.18, 0.12, 44, 0.6, 16, '#93AE7E'], [0.2, -0.1, 46, 0.55, 14, '#8AA676'], [0, 0, 58, 0.45, 10, '#A4BD8E']] as const) {
    box(c, { x, y, z, w, d: w, h, color });
  }
});
/** Haifa and Jerusalem: a tall, slim cypress. */
const treeCypress = sprite([-26, -150, 26, 12], (c) => {
  floorShadow(c, 0, 0, 0.3, 0.25);
  box(c, { x: 0, y: 0, w: 0.08, d: 0.08, h: 14, color: '#6A4A2A' });
  const tiers: [number, number, number][] = [[10, 0.38, 34], [42, 0.32, 34], [74, 0.24, 30], [102, 0.14, 26]];
  tiers.forEach(([z, w, h], i) => box(c, { x: 0, y: 0, z, w, d: w, h, color: i % 2 ? '#2F6B3E' : '#285E36' }));
});
const lamp = sprite([-20, -110, 20, 8], (c) => {
  floorShadow(c, 0, 0, 0.2, 0.25);
  box(c, { x: 0, y: 0, w: 0.1, d: 0.1, h: 4, color: '#22202A' });
  box(c, { x: 0, y: 0, z: 4, w: 0.05, d: 0.05, h: 74, color: '#2E2B38' });
  box(c, { x: 0, y: 0, z: 78, w: 0.18, d: 0.18, h: 4, color: '#2E2B38' });
  box(c, { x: 0, y: 0, z: 74, w: 0.14, d: 0.14, h: 4, color: '#FFE9A8', shade: { left: '#FFE9A8', right: '#F2C14E' } });
});
/** Soft halo, drawn with a pulsing alpha by the renderer. */
const glowHalo = sprite([-34, -34, 34, 34], (c) => {
  const p = Skia.Paint();
  p.setShader(Skia.Shader.MakeRadialGradient(vec(0, 0), 30, [Skia.Color('rgba(255,226,140,0.6)'), Skia.Color('rgba(255,226,140,0)')], null, TileMode.Clamp));
  c.drawCircle(0, 0, 30, p);
});
const saleSign = sprite([-34, -70, 34, 10], (c) => {
  floorShadow(c, 0, 0, 0.25, 0.25);
  box(c, { x: 0, y: 0, w: 0.06, d: 0.06, h: 30, color: '#7A5430' });
  box(c, { x: 0, y: 0, z: 26, w: 0.05, d: 1.1, h: 28, color: GOLD, rim: true });
  onFaceX(c, 0.025, 0.55, () => rectIn(c, 0.06, 29, 0.98, 22, '#B8202E'));
  // A coin with a padlock: "buy this lot", readable without words.
  const [cx, cy] = P(0.03, 0, 40);
  c.drawOval(Skia.XYWHRect(cx - 7, cy - 7, 14, 14), fill('#FFD54A'));
  c.drawOval(Skia.XYWHRect(cx - 7, cy - 7, 14, 14), stroke('#B8892A', 1.4));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(cx - 3.2, cy - 1.5, 6.4, 5), 1, 1), fill('#5A3A1A'));
  c.drawPath(path.smooth([[cx - 2, cy - 1.4], [cx - 2, cy - 4], [cx, cy - 5.4], [cx + 2, cy - 4], [cx + 2, cy - 1.4]], false), stroke('#5A3A1A', 1.2));
});

/**
 * Land of a later building: a post with a board in the color of that building's floor (a taste
 * of what comes), a gold frame and a big padlock. One per building tier.
 */
export const LOCK_BOARDS = ['#B3202E', '#11684A', '#22408F', '#D9CDB5', '#4A1450', '#0F7C8C', '#191750'] as const;
const lockSigns = Object.fromEntries(
  LOCK_BOARDS.map((board, tier) => [
    `lockSign${tier}`,
    sprite([-30, -66, 30, 10], (c) => {
      floorShadow(c, 0, 0, 0.22, 0.22);
      box(c, { x: 0, y: 0, w: 0.06, d: 0.06, h: 28, color: '#5A3A1A' });
      box(c, { x: 0, y: 0, z: 24, w: 0.05, d: 0.95, h: 26, color: GOLD, rim: true });
      onFaceX(c, 0.025, 0.475, () => rectIn(c, 0.05, 26.5, 0.85, 21, board));
      const [cx, cy] = P(0.03, 0, 37);
      // The padlock: a gold body with a keyhole, and its shackle.
      c.drawPath(path.smooth([[cx - 4.2, cy - 1], [cx - 4.2, cy - 6], [cx, cy - 9.5], [cx + 4.2, cy - 6], [cx + 4.2, cy - 1]], false), stroke('#8A6A1A', 2.4));
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(cx - 6.5, cy - 2, 13, 10), 2, 2), fill('#FFD54A'));
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(cx - 6.5, cy - 2, 13, 10), 2, 2), stroke('#8A6A1A', 1.2));
      c.drawCircle(cx, cy + 2, 1.5, fill('#5A3A1A'));
      c.drawRect(Skia.XYWHRect(cx - 0.6, cy + 2, 1.2, 3.2), fill('#5A3A1A'));
    }),
  ]),
);

/** One tile of scaffolding: steel poles, wooden planks and a green safety net. */
function scaffold(c: SkCanvas, alongX: boolean) {
  const [ax, ay] = alongX ? [1, 0] : [0, 1];
  for (const k of [-0.47, 0.47]) box(c, { x: ax * k, y: ay * k, w: 0.07, d: 0.07, h: 86, color: '#B9BEC8' });
  box(c, { x: 0, y: 0, z: 30, w: alongX ? 0.94 : 0.03, d: alongX ? 0.03 : 0.94, h: 24, color: '#3FAE5A', alpha: 0.5 });
  for (const z of [28, 56, 84]) box(c, { x: 0, y: 0, z, w: alongX ? 1 : 0.32, d: alongX ? 0.32 : 1, h: 3, color: '#C8914F', rim: true });
}
const scaffoldX = sprite([-26, -100, 26, 18], (c) => scaffold(c, true));
const scaffoldY = sprite([-26, -100, 26, 18], (c) => scaffold(c, false));

export const propSprites = {
  ovenGlow, pan, patty, pot, flame, pass, passLong, washPlate, plateDirty, glass, glassEmpty, stain,
  ticket, plateSingleDirty, treePalm, treeRound, treeOlive, treeCypress, lamp, glowHalo, saleSign, scaffoldX, scaffoldY,
  ...lockSigns,
};

