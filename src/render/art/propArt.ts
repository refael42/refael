import { ClipOp, type SkCanvas, type SkPath } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { drawBurger } from './characterArt';
import { darken, lighten } from './color';
import { blurred, contactShadow, dot, fill, glowStroke, INK, ink, line, path, stroke, type Pt } from './kit';

// Props use the 3/4 "stacked faces" look: a top face above a front face, anchored at the
// front-bottom center of the footprint (that y is what depth-sorting uses).

const STEEL = '#BCC6D0';
const STEEL_TOP = '#DCE2E8';
const DARK = '#3B4450';
const WOOD = '#C98B55';
const RED = '#E25545';

function box(c: SkCanvas, x: number, w: number, frontH: number, depth: number, front: string, top: string) {
  contactShadow(c, x + w / 2, -0.5, w * 0.56, 4.6, 0.26);
  ink(c, path.rrect(x, -frontH - depth, w, depth + 3, 3), top, { depth: 1.4 });
  ink(c, path.rrect(x, -frontH, w, frontH, 3), front, { depth: 2.4 });
}

function clipTo(c: SkCanvas, p: SkPath, draw: () => void) {
  c.save();
  c.clipPath(p, ClipOp.Intersect, true);
  draw();
  c.restore();
}

// ---------- stove ----------

const stove = sprite([-36, -42, 36, 6], (c) => {
  ink(c, path.rrect(-31, -40, 62, 9, 2.5), '#A3AEBA', { depth: 1 });
  box(c, -33, 66, 20, 14, STEEL, STEEL_TOP);
  // Burner grates.
  for (const bx of [-14, 14]) {
    ink(c, path.oval(bx, -27.4, 9.6, 4.6), DARK, { line: 1, light: '#5C6675' });
    c.drawOval({ x: bx - 6, y: -30.2, width: 12, height: 5.6 }, stroke('#56606D', 1));
  }
  ink(c, path.rrect(-31, -19.6, 62, 4.4, 1.6), '#A3AEBA', { line: 1, light: false });
  for (const kx of [-24, -17, 17, 24]) ink(c, path.circle(kx, -17.4, 1.5), RED, { line: 0.8, light: '#FF9A8A' });
  ink(c, path.rrect(-21, -14.2, 42, 11.4, 2.2), '#AEB8C3', { line: 1.1 });
  ink(c, path.rrect(-17, -11.2, 34, 6.6, 1.6), '#3A3F4B', { line: 1, light: false, shade: false });
  line(c, [[-12, -12.8], [12, -12.8]], '#E9EEF3', 1.6);
});
/** Warm light behind the oven glass; drawn with a flickering alpha while cooking. */
const ovenGlow = sprite([-18, -12, 18, -4], (c) => {
  c.drawRect({ x: -16.4, y: -10.6, width: 32.8, height: 5.4 }, blurred('#FF9A3A', 0.9, 1.2));
  c.drawRect({ x: -12, y: -9.4, width: 24, height: 3 }, fill('#FFD27A', 0.8));
});
const pan = sprite([-27, -6, 11, 5], (c) => {
  line(c, [[-8, -0.4], [-24, -1.6]], INK, 4.2);
  line(c, [[-8, -0.4], [-24, -1.6]], '#5A4A44', 2.2);
  ink(c, path.oval(0, 0, 9.2, 4.2), '#2E2A30', { depth: 1, light: '#6A6470' });
  c.drawOval({ x: -6.6, y: -2.6, width: 13.2, height: 5.2 }, fill('#45404A'));
});
const patty = sprite([-6, -4, 6, 3], (c) => {
  ink(c, path.oval(0, 0, 4.6, 2.2), '#7A4128', { line: 1, light: '#A8673F' });
  line(c, [[-2.4, -0.4], [2, -0.6]], '#5A2E1C', 0.7);
});
const pot = sprite([-10, -16, 10, 4], (c) => {
  ink(c, path.rrect(-7.6, -10.6, 15.2, 11.6, 3), RED, { depth: 1.8 });
  ink(c, path.oval(0, -10.6, 7.8, 2.8), '#D04536', { line: 1, light: false });
  ink(c, path.oval(0, -11.6, 6.6, 2.4), '#C9D1D9', { line: 1 });
  ink(c, path.circle(0, -13.4, 1.4), DARK, { line: 0.8, light: false });
  for (const sx of [-9.2, 9.2]) ink(c, path.rrect(sx - 1.4, -9, 2.8, 2.2, 1), DARK, { line: 0.8, light: false });
});
const flame = sprite([-3, -8, 3, 1], (c) => {
  const outer = path.smooth([[0, -7.2], [2.2, -3], [1.8, 0], [-1.8, 0], [-2.2, -3]]);
  c.drawPath(outer, blurred('#FF7A2A', 0.9, 0.5));
  c.drawPath(path.smooth([[0, -4.6], [1.2, -1.8], [0.8, 0], [-0.8, 0], [-1.2, -1.8]]), fill('#FFE07A'));
  c.drawOval({ x: -1.6, y: -0.9, width: 3.2, height: 1.4 }, fill('#5BB8FF', 0.9));
});

// ---------- sink counter ----------

const sink = sprite([-58, -42, 58, 6], (c) => {
  // White tiled backsplash.
  ink(c, path.rrect(-54, -38.5, 108, 6.5, 2), '#F7F4EE', { depth: 1, shade: '#E2DDD4' });
  for (let x = -46; x < 54; x += 8) line(c, [[x, -37.8], [x, -33]], '#BFD8E6', 0.7);
  box(c, -55, 110, 20, 14, '#5DB8A8', '#ECE7E0');
  for (const [dx, dw] of [[-52, 32], [-18, 36], [20, 32]] as const) {
    ink(c, path.rrect(dx, -17.4, dw, 14.4, 2), '#55AC9C', { line: 1, light: false });
    ink(c, path.circle(dx + dw / 2, -10.2, 1.2), '#F2C14E', { line: 0.7, light: false });
  }
  // Basin with water.
  ink(c, path.rrect(-20, -32.6, 38, 11.2, 4), '#8A96A3', { line: 1.2, light: false });
  ink(c, path.rrect(-17.6, -30.4, 33.2, 7.6, 3), '#9FD3EE', { line: 0.8, shade: '#7FBCE0' });
  // Faucet.
  const faucet = path.smooth([[-1, -32], [-1, -37.6], [3.4, -38.6], [6.4, -35.4]], false);
  c.drawPath(faucet, stroke(INK, 3.4));
  c.drawPath(faucet, stroke('#D7DEE6', 1.8));
  // Drying rack slats under the clean plates.
  for (let x = 28; x < 52; x += 4) line(c, [[x, -32], [x, -22.6]], '#CFC7BC', 0.9);
});
const washPlate = sprite([-8, -4, 8, 4], (c) => {
  ink(c, path.oval(0, 0, 6.4, 2.6), '#FFFFFF', { line: 1, shade: '#E2E6EC' });
  c.drawOval({ x: -4.6, y: -1.8, width: 9.2, height: 3.6 }, stroke('#5B8EDB', 0.6));
});

// ---------- table, chairs, tableware ----------

const CLOTH_TOP = (): SkPath => path.oval(0, -21, 31, 13.6);
const CLOTH_SKIRT = (): SkPath => {
  const hem: Pt[] = [];
  for (let i = 0; i <= 12; i++) hem.push([30 - i * 5, -9 + (i % 2 === 0 ? 0.9 : -0.6)]);
  return path.smooth([[-31, -21], [31, -21], ...hem], true, 0.7);
};
const table = sprite([-34, -38, 34, 5], (c) => {
  contactShadow(c, 0, -0.6, 24, 4.6, 0.25);
  ink(c, path.rrect(-2.6, -10, 5.2, 9.6, 1.6), '#7A4F33', { line: 1.1, light: false });
  ink(c, path.oval(0, -0.8, 8.4, 2.4), '#7A4F33', { line: 1.1, light: false });
  const cloth = path.union(CLOTH_SKIRT(), CLOTH_TOP());
  c.drawPath(cloth, stroke(INK, 3));
  c.drawPath(cloth, fill('#FFF8EE'));
  clipTo(c, CLOTH_SKIRT(), () => {
    for (let x = -30; x < 31; x += 10) c.drawRect({ x, y: -22, width: 5, height: 15 }, fill(RED, 0.88));
    c.drawRect({ x: -32, y: -21, width: 64, height: 13 }, fill('#3A1F18', 0.12));
  });
  clipTo(c, CLOTH_TOP(), () => {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 11; col++) {
        if ((row + col) % 2 === 0) c.drawRect({ x: -33 + col * 6, y: -35 + row * 3, width: 6, height: 3 }, fill(RED, 0.82));
      }
    }
    c.drawOval({ x: -22, y: -33, width: 26, height: 8 }, blurred('#FFFFFF', 0.35, 2));
  });
  c.drawPath(CLOTH_TOP(), stroke(INK, 1.1));
});
const plateFood = sprite([-10, -10, 10, 4], (c) => {
  ink(c, path.oval(0, 0, 8.4, 3.2), '#FFFFFF', { line: 1.1, shade: '#E2E6EC' });
  c.drawOval({ x: -6.4, y: -2.4, width: 12.8, height: 4.8 }, stroke('#5B8EDB', 0.7));
  for (let i = 0; i < 5; i++) {
    ink(c, path.rrect(3 + i * 0.9, -4.6 - (i % 2) * 0.8, 1.1, 4, 0.5), '#F4C542', { line: 0.5, light: false, shade: false });
  }
  drawBurger(c, -1.6, 0.6, 0.85);
});
const plateDirty = sprite([-10, -6, 10, 4], (c) => {
  ink(c, path.oval(0, 0, 8.4, 3.2), '#F3EFE6', { line: 1.1, shade: '#DDD6C9' });
  c.drawPath(path.smooth([[-4, -0.6], [-1, -1.6], [3, -0.4], [1, 1], [-3, 0.8]]), fill('#B5683A', 0.75));
  for (const [x, y] of [[-5, -1], [4.6, 0.6], [2, -1.6], [-2.4, 1.4]] as const) dot(c, x, y, 0.55, '#C98F4E');
  ink(c, path.smooth([[3.4, -2.2], [6.8, -3], [8, -1], [5, -0.2]]), '#FFFFFF', { line: 0.8, shade: '#E7E1D6' });
});
const glass = sprite([-4, -11, 4, 2], (c) => {
  ink(c, path.rrect(-2.6, -8, 5.2, 8, 1.4), '#DDF1FF', { line: 1, light: false, alpha: 0.95 });
  c.drawRect({ x: -2, y: -5.6, width: 4, height: 5 }, fill('#E58A3A', 0.9));
  line(c, [[1, -7.6], [2.6, -10.6]], RED, 0.9);
});
const glassEmpty = sprite([-4, -11, 4, 2], (c) => {
  ink(c, path.rrect(-2.6, -8, 5.2, 8, 1.4), '#DDF1FF', { line: 1, light: false, alpha: 0.9 });
  c.drawRect({ x: -2, y: -1.6, width: 4, height: 1.2 }, fill('#E58A3A', 0.6));
});
const stain = sprite([-6, -3, 6, 3], (c) =>
  c.drawPath(path.smooth([[-4.6, 0], [-2, -1.8], [2.6, -1.4], [4.4, 0.6], [0.6, 1.8], [-3, 1.4]]), fill('#9C5A30', 0.35)),
);

const chairBehind = sprite([-12, -44, 12, 4], (c) => {
  contactShadow(c, 0, -1, 11, 3.2, 0.22);
  for (const x of [-8.4, 7]) ink(c, path.rrect(x, -38, 2.6, 26, 1.2), darken(WOOD, 0.1), { line: 1.1, light: false });
  ink(c, path.rrect(-10, -42, 20, 6.4, 3), WOOD, { depth: 1.2 });
  ink(c, path.rrect(-9, -31, 18, 3, 1.4), WOOD, { line: 1, light: false });
  ink(c, path.rrect(-10.4, -17.4, 20.8, 8.6, 2.6), lighten(WOOD, 0.08), { depth: 1.2 });
  for (const x of [-9.4, 7]) ink(c, path.rrect(x, -10, 2.4, 10, 1.1), darken(WOOD, 0.12), { line: 1, light: false });
});
const chairFront = sprite([-12, -32, 12, 4], (c) => {
  contactShadow(c, 0, -1, 11, 3.2, 0.22);
  ink(c, path.rrect(-10.4, -17.4, 20.8, 8.6, 2.6), lighten(WOOD, 0.08), { depth: 1.2 });
  for (const x of [-9.4, 7]) ink(c, path.rrect(x, -10, 2.4, 10, 1.1), darken(WOOD, 0.12), { line: 1, light: false });
  // Seen from behind: a low backrest so it does not hide the table.
  for (const x of [-8.4, 7]) ink(c, path.rrect(x, -26, 2.6, 16, 1.2), darken(WOOD, 0.1), { line: 1.1, light: false });
  ink(c, path.rrect(-10, -28.5, 20, 5.6, 2.6), WOOD, { depth: 1.2 });
});

// ---------- plate stacks (the clean-dishes loop made visible) ----------

function plateDisc(c: SkCanvas, x: number, y: number, top: boolean, tint = '#FFFFFF') {
  ink(c, path.rrect(x - 9.4, y - 3.4, 18.8, 5, 2.6), darken(tint, 0.08), { line: 1, light: false });
  ink(c, path.oval(x, y - 3.4, 9.4, 3.2), tint, { line: 1, shade: false, light: false });
  if (top) c.drawOval({ x: x - 5.6, y: y - 5.2, width: 11.2, height: 3.6 }, stroke('#D6DCE4', 0.8));
  c.drawOval({ x: x - 8.2, y: y - 6, width: 16.4, height: 5.2 }, stroke('#5B8EDB', 0.6));
}
const platesClean = sprite([-12, -20, 12, 4], (c) => {
  contactShadow(c, 0, -0.6, 10, 2.6, 0.2);
  for (let i = 0; i < 6; i++) plateDisc(c, 0, -i * 2.2, i === 5);
  c.drawOval({ x: -6, y: -18, width: 6, height: 2 }, fill('#FFFFFF', 0.9));
});
const platesDirty = sprite([-14, -16, 14, 4], (c) => {
  contactShadow(c, 0, -0.6, 11, 2.6, 0.2);
  const offsets = [0, 1.4, -1.2, 1.8];
  offsets.forEach((dx, i) => plateDisc(c, dx, -i * 2.4, i === offsets.length - 1, '#F2EDE2'));
  c.drawPath(path.smooth([[-3, -10.6], [0.6, -11.6], [4.6, -10.4], [2, -9.4]]), fill('#B5683A', 0.75));
  for (const [x, y] of [[-4, -9.8], [5, -11], [7.4, -6], [-8, -4]] as const) dot(c, x, y, 0.6, '#B5683A');
  line(c, [[4, -11], [10.4, -15]], INK, 2.4);
  line(c, [[4, -11], [10.4, -15]], '#C9D1D9', 1.1);
});

// ---------- decor ----------

const leaf = (c: SkCanvas, x: number, y: number, angle: number, len: number, color: string) => {
  c.save();
  c.translate(x, y);
  c.rotate(angle, 0, 0);
  ink(c, path.smooth([[0, 0], [len * 0.42, -len * 0.18], [len, 0], [len * 0.42, len * 0.2]], true, 0.9), color, { line: 1.1, depth: 1.2 });
  line(c, [[1, 0], [len * 0.85, 0]], darken(color, 0.25), 0.7);
  c.restore();
};
function plantPot(c: SkCanvas) {
  contactShadow(c, 0, -0.6, 11, 3, 0.25);
  ink(c, path.poly([[-8.6, -15], [8.6, -15], [6.6, 0], [-6.6, 0]]), '#D9744F', { depth: 2 });
  ink(c, path.rrect(-10, -18.6, 20, 5, 2), '#C8664B', { line: 1.1, light: '#F09A7A' });
}
const plantLeafy = sprite([-26, -58, 26, 5], (c) => {
  for (const [a, l, col] of [[-150, 22, '#3F8F55'], [-30, 22, '#3F8F55'], [-120, 26, '#5BAF6A'], [-60, 26, '#5BAF6A'], [-95, 28, '#6CC27A'], [-170, 18, '#5BAF6A'], [-10, 18, '#5BAF6A']] as const) {
    leaf(c, 0, -18, a, l, col);
  }
  plantPot(c);
});
const plantSnake = sprite([-16, -62, 16, 5], (c) => {
  for (const [x, h, tilt, col] of [[-6, 34, -10, '#3F8F55'], [5, 30, 12, '#3F8F55'], [-1, 42, -2, '#5BAF6A'], [2.4, 38, 6, '#6CC27A']] as const) {
    c.save();
    c.translate(x, -17);
    c.rotate(tilt, 0, 0);
    ink(c, path.smooth([[-2.6, 0], [-3, -h * 0.6], [0, -h], [3, -h * 0.6], [2.6, 0]], true, 0.8), col, { line: 1.1, depth: 1.2 });
    line(c, [[0, -2], [0, -h * 0.85]], '#D9E8A8', 0.7);
    c.restore();
  }
  plantPot(c);
});

// ---------- neon sign (wall) ----------

const NEON = '#FF6FA8';
function neonBurger(c: SkCanvas, bright: boolean) {
  const tube = (p: SkPath, color: string) => {
    if (bright) c.drawPath(p, glowStroke(color, 5, 0.5, 3));
    c.drawPath(p, stroke(bright ? lighten(color, 0.55) : darken(color, 0.45), 1.6));
  };
  tube(path.smooth([[-14, -18], [-11, -27], [0, -30.4], [11, -27], [14, -18]], false), NEON);
  tube(path.smooth([[-15, -14.6], [-5, -12.6], [5, -15.6], [15, -13.6]], false), '#7DFFB0');
  tube(path.smooth([[-14, -10], [0, -9.4], [14, -10], [12, -6], [-12, -6], [-14, -10]], false), NEON);
  for (const [x, y] of [[-26, -26], [26, -28], [24, -9]] as const) {
    tube(path.poly([[x, y - 3], [x + 0.9, y - 0.9], [x + 3, y], [x + 0.9, y + 0.9], [x, y + 3], [x - 0.9, y + 0.9], [x - 3, y], [x - 0.9, y - 0.9]]), '#FFD86B');
  }
}
const neonBoard = sprite([-44, -42, 44, 2], (c) => {
  ink(c, path.rrect(-40, -38, 80, 36, 7), '#3B2E3F', { depth: 1.6, light: '#5C4C62' });
  neonBurger(c, false);
});
const neonLit = sprite([-44, -42, 44, 2], (c) => neonBurger(c, true));

export const propSprites = {
  stove, ovenGlow, pan, patty, pot, flame, sink, washPlate,
  table, plateFood, plateDirty, glass, glassEmpty, stain, chairBehind, chairFront,
  platesClean, platesDirty, plantLeafy, plantSnake, neonBoard, neonLit,
};

