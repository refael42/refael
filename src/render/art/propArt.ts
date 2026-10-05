import { Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';
import { HALF_H, HALF_W } from '../iso';
import { sprite } from '../sprite';
import { miniBurger } from './charArt';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onFaceX, onFaceY, onTop, P, rectIn } from './iso3d';
import { fill, glowStroke, path, stroke, type Pt } from './kit';

// Isometric low-poly props. Anchor = center of the footprint on the floor (tiles x/y, z in px).

const STEEL = '#AEB8C4';
const STEEL_DARK = '#7E8A98';
const GOLD = '#E2B13C';
const WOOD_DARK = '#5A2E1E';
const VELVET = '#C8202E';

/** Pixel art on a wall plane facing +y (skewed along x). u = px along the wall, v = px down. */
function onWallY(c: SkCanvas, draw: () => void) {
  c.save();
  c.concat(Skia.Matrix([1, 0, 0, HALF_H / HALF_W, 1, 0, 0, 0, 1]));
  draw();
  c.restore();
}

// ---------- kitchen ----------

const stove = sprite([-44, -70, 44, 14], (c) => {
  floorShadow(c, 0.1, 0, 0.9, 0.3);
  box(c, { x: 0, y: 0, w: 0.86, d: 1.86, h: 22, color: STEEL, rim: true });
  box(c, { x: -0.39, y: 0, z: 22, w: 0.08, d: 1.86, h: 15, color: STEEL_DARK, rim: true });
  for (const y of [-0.45, 0.45]) cylinder(c, 0.05, y, 0.27, 22, 0.8, '#2B2F38', '#3A404C');
  onFaceX(c, 0.43, 0.93, () => {
    rectIn(c, 0.12, 3.5, 1.62, 11, '#2B2F38');
    rectIn(c, 0.2, 5, 1.46, 8, '#3D4452');
    rectIn(c, 0.12, 15.6, 1.62, 1.4, '#E9EEF3');
    for (const a of [0.2, 0.42, 1.44, 1.66]) rectIn(c, a - 0.04, 18, 0.08, 2.4, '#E5483B');
  });
});
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

const pass = sprite([-62, -92, 62, 24], (c) => {
  floorShadow(c, 0.1, 0, 1.2, 0.3);
  box(c, { x: 0, y: 0, w: 0.8, d: 2.8, h: 21, color: WOOD_DARK });
  onFaceX(c, 0.4, 1.4, () => {
    for (let a = 0.12; a < 2.7; a += 0.46) rectIn(c, a, 3, 0.36, 14, lighten(WOOD_DARK, 0.08));
  });
  onFaceY(c, 1.4, -0.4, () => rectIn(c, 0.08, 3, 0.64, 14, lighten(WOOD_DARK, 0.06)));
  box(c, { x: 0, y: 0, z: 21, w: 0.84, d: 2.84, h: 2, color: GOLD, rim: true });
  box(c, { x: 0, y: 0, z: 23, w: 0.8, d: 2.8, h: 1, color: '#D8DEE5' });
  // Service bell: rung when a dish is ready.
  cylinder(c, 0.15, 1.2, 0.07, 24, 1, '#B8892A', GOLD);
  cylinder(c, 0.15, 1.2, 0.05, 25, 3, GOLD, '#FFE08A');
  // Ticket rail on the kitchen side: orders hang here until cooked.
  for (const y of [-1.35, 1.35]) box(c, { x: -0.4, y, z: 24, w: 0.05, d: 0.05, h: 30, color: '#C9D1D9' });
  box(c, { x: -0.4, y: 0, z: 50, w: 0.06, d: 2.76, h: 3, color: '#D8DEE5', rim: true });
});
/** A paper order ticket (billboard), hanging from its clip. */
const ticket = sprite([-8, -2, 8, 20], (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-1.6, -1, 3.2, 3), 0.6, 0.6), fill('#7E8A98'));
  c.drawRect(Skia.XYWHRect(-5.6, 1.6, 11.2, 15), fill('#3A2A30', 0.25));
  c.drawRect(Skia.XYWHRect(-6, 1, 11.2, 15), fill('#FFFDF4'));
  c.drawRect(Skia.XYWHRect(-6, 1, 11.2, 2.4), fill('#E5483B'));
  for (const y of [12.4, 14.2]) c.drawRect(Skia.XYWHRect(-4.4, y, 8, 0.7), fill('#C9C2B4'));
});
const plateSingle = sprite([-12, -6, 12, 6], (c) => cylinder(c, 0, 0, 0.14, 0, 1.6, '#DDE2E8', '#F7F9FB'));
const plateSingleDirty = sprite([-12, -8, 12, 6], (c) => {
  cylinder(c, 0, 0, 0.14, 0, 1.6, '#CFC9BE', '#EDE7DC');
  onTop(c, 1.6, () => {
    c.drawCircle(0.03, 0, 0.065, fill('#A35A2E', 0.7));
    c.drawCircle(-0.06, 0.05, 0.016, fill('#A35A2E', 0.8));
  });
});

const sink = sprite([-44, -60, 44, 14], (c) => {
  floorShadow(c, 0.1, 0, 0.9, 0.3);
  box(c, { x: 0, y: 0, w: 0.86, d: 1.86, h: 21, color: '#2C8F87' });
  onFaceX(c, 0.43, 0.93, () => {
    rectIn(c, 0.1, 2.5, 0.78, 15, '#33A399');
    rectIn(c, 0.98, 2.5, 0.78, 15, '#33A399');
    rectIn(c, 0.8, 9, 0.06, 2, GOLD);
    rectIn(c, 1.0, 9, 0.06, 2, GOLD);
  });
  box(c, { x: 0, y: 0, z: 21, w: 0.88, d: 1.88, h: 1.6, color: '#D8DEE5', rim: true });
  onTop(c, 22.6, () => {
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.28, -0.42, 0.58, 0.84), 0.08, 0.08), fill('#6C7886'));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.24, -0.38, 0.5, 0.76), 0.06, 0.06), fill('#8FD0F0'));
  });
  box(c, { x: -0.36, y: 0, z: 22.6, w: 0.06, d: 0.06, h: 9, color: '#C9D1D9' });
  box(c, { x: -0.25, y: 0, z: 29.6, w: 0.22, d: 0.05, h: 2, color: '#C9D1D9' });
});
const washPlate = sprite([-10, -6, 10, 6], (c) => cylinder(c, 0, 0, 0.13, 0, 1, '#E2E6EC', '#FFFFFF'));

const fridge = sprite([-30, -80, 30, 12], (c) => {
  floorShadow(c, 0.08, 0, 0.55, 0.3);
  box(c, { x: 0, y: 0, w: 0.8, d: 0.8, h: 54, color: '#C7D0DA', rim: true });
  onFaceX(c, 0.4, 0.4, () => {
    rectIn(c, 0.02, 33, 0.76, 0.8, STEEL_DARK);
    rectIn(c, 0.62, 18, 0.05, 12, '#5E6878');
    rectIn(c, 0.62, 37, 0.05, 10, '#5E6878');
    rectIn(c, 0.18, 22, 0.08, 3, '#E5483B');
    rectIn(c, 0.32, 40, 0.08, 3, '#F2C14E');
    rectIn(c, 0.12, 44, 0.08, 3, '#47B2BE');
  });
});

// ---------- dining ----------

const table = sprite([-32, -36, 32, 14], (c) => {
  floorShadow(c, 0, 0, 0.42, 0.32);
  cylinder(c, 0, 0, 0.17, 0, 2, '#B8892A', GOLD);
  cylinder(c, 0, 0, 0.045, 2, 11, '#3A2430', '#4A3040');
  // White cloth with a short drape and a gold-rimmed red runner: the resort table look.
  cylinder(c, 0, 0, 0.39, 11, 6, '#F1EBE1', '#FFFFFF');
  onTop(c, 17, () => {
    c.drawCircle(0, 0, 0.36, stroke(GOLD, 0.02));
    c.drawRect(Skia.XYWHRect(-0.28, -0.08, 0.56, 0.16), fill(VELVET));
    c.drawRect(Skia.XYWHRect(-0.28, -0.08, 0.56, 0.16), stroke(GOLD, 0.02));
  });
});
const plateBurger = sprite([-14, -16, 14, 6], (c) => {
  cylinder(c, 0, 0, 0.13, 0, 1.2, '#DDE2E8', '#FFFFFF');
  miniBurger(c, 0, 0, 1.2);
});
const plateFries = sprite([-14, -18, 14, 6], (c) => {
  cylinder(c, 0, 0, 0.13, 0, 1.2, '#DDE2E8', '#FFFFFF');
  box(c, { x: 0, y: 0, z: 1.2, w: 0.09, d: 0.09, h: 6, color: '#D8342C' });
  for (const [x, y, h] of [[-0.02, -0.02, 4], [0.02, 0.01, 5], [0, 0.03, 3.5], [0.03, -0.03, 4.5]] as const) {
    box(c, { x, y, z: 7, w: 0.022, d: 0.022, h, color: '#F6C945' });
  }
});
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

const chair = sprite([-20, -44, 20, 10], (c) => {
  floorShadow(c, 0, 0, 0.26, 0.25);
  for (const [x, y] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]] as const) {
    box(c, { x, y, w: 0.04, d: 0.04, h: 9, color: '#9C7A2A' });
  }
  box(c, { x: -0.16, y: 0, z: 9, w: 0.06, d: 0.36, h: 20, color: GOLD });
  box(c, { x: -0.15, y: 0, z: 12, w: 0.06, d: 0.3, h: 15, color: VELVET });
  box(c, { x: 0, y: 0, z: 9, w: 0.36, d: 0.36, h: 2, color: GOLD });
  box(c, { x: 0.01, y: 0, z: 11, w: 0.32, d: 0.32, h: 2.5, color: VELVET, rim: true });
});

// ---------- plate stacks (the clean-dishes loop made visible) ----------



// ---------- decor ----------

function palmFronds(c: SkCanvas, top: Pt, size: number) {
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
const plantPalm = sprite([-30, -78, 30, 12], (c) => {
  floorShadow(c, 0, 0, 0.3, 0.28);
  cylinder(c, 0, 0, 0.17, 0, 13, GOLD, '#4A3A2A');
  cylinder(c, 0, 0, 0.18, 10, 2.4, '#B8892A', '#C99A32');
  for (let i = 0; i < 6; i++) box(c, { x: 0.004 * i, y: 0, z: 13 + i * 6, w: 0.07, d: 0.07, h: 6, color: i % 2 ? '#8A6239' : '#7A5430' });
  palmFronds(c, P(0.024, 0, 50), 24);
});
const plantBush = sprite([-26, -56, 26, 12], (c) => {
  floorShadow(c, 0, 0, 0.3, 0.28);
  box(c, { x: 0, y: 0, w: 0.34, d: 0.34, h: 14, color: '#22202A', rim: true });
  box(c, { x: 0, y: 0, z: 11, w: 0.36, d: 0.36, h: 2, color: GOLD });
  for (const [x, y, z, s, col] of [[0, 0, 14, 0.3, '#2E8B47'], [0.06, -0.05, 24, 0.22, '#3FA65A'], [-0.05, 0.06, 22, 0.2, '#36994F'], [0, 0, 31, 0.14, '#4CBB66']] as const) {
    box(c, { x, y, z, w: s, d: s, h: s * 50, color: col });
  }
});
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

// ---------- neon sign on the back wall ----------

const NEON = '#FF4FA0';
function neonArt(c: SkCanvas, lit: boolean) {
  const tube = (p: ReturnType<typeof path.smooth>, color: string) => {
    if (lit) c.drawPath(p, glowStroke(color, 5, 0.55, 3));
    c.drawPath(p, stroke(lit ? lighten(color, 0.6) : darken(color, 0.45), 1.6));
  };
  tube(path.smooth([[-14, -18], [-11, -27], [0, -30.4], [11, -27], [14, -18]], false), NEON);
  tube(path.smooth([[-15, -14.6], [-5, -12.6], [5, -15.6], [15, -13.6]], false), '#59FF9E');
  tube(path.smooth([[-14, -10], [0, -9.4], [14, -10], [12, -6], [-12, -6], [-14, -10]], false), NEON);
  for (const [x, y] of [[-26, -26], [26, -28], [24, -9], [-25, -8]] as const) {
    tube(path.poly([[x, y - 3], [x + 0.9, y - 0.9], [x + 3, y], [x + 0.9, y + 0.9], [x, y + 3], [x - 0.9, y + 0.9], [x - 3, y], [x - 0.9, y - 0.9]]), '#FFD86B');
  }
}
const neonBoard = sprite([-50, -70, 50, 30], (c) =>
  onWallY(c, () => {
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-40, -38, 80, 36), 6, 6), fill('#1C1424'));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-40, -38, 80, 36), 6, 6), stroke(GOLD, 1.6));
    neonArt(c, false);
  }),
);
const neonLit = sprite([-50, -70, 50, 30], (c) => onWallY(c, () => neonArt(c, true)));

export const propSprites = {
  stove, ovenGlow, pan, patty, pot, flame, pass, sink, washPlate, fridge,
  table, plateBurger, plateFries, plateDirty, glass, glassEmpty, stain, chair,
  ticket, plateSingle, plateSingleDirty, plantPalm, plantBush, treePalm, treeRound, lamp, glowHalo, saleSign,
  neonBoard, neonLit,
};

