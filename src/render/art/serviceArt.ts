import { Skia, TileMode, vec, type SkCanvas, type SkPath } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { fill, glowStroke, path, stroke } from './kit';

// Service and kitchen (owner M49): the special-request badges on bubbles and tickets, the cold
// mark on a plate left too long, the prep stock on the pass (a board and bowls of chopped
// vegetables), and the pictures of the three new upgrades.

const EDGE = '#2A1530';

function glossy(c: SkCanvas, p: SkPath, base: string, edge = darken(base, 0.45), width = 1.4) {
  const b = p.getBounds();
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(
    Skia.Shader.MakeLinearGradient(vec(0, b.y), vec(0, b.y + b.height), [Skia.Color(lighten(base, 0.35)), Skia.Color(base), Skia.Color(darken(base, 0.18))], [0, 0.45, 1], TileMode.Clamp),
  );
  c.drawPath(p, stroke(edge, width));
  c.drawPath(p, paint);
}

const BADGE = [-7, -7, 7, 7] as const;

/** A red chili pepper: long and curved, tapering to a point, with a green cap and stem. */
function chili(c: SkCanvas, k = 1) {
  const body: [number, number][] = [[-3.4, -3.2], [-0.6, -3.4], [1.8, -1.8], [3.4, 0.8], [4.4, 4], [2.4, 2.4], [0, 0.4], [-2.8, -1]];
  glossy(c, path.smooth(body.map(([x, y]) => [x * k, y * k] as [number, number]), true, 0.7), '#E5372B', '#7A1410', 0.9 * k);
  c.drawPath(path.smooth([[-3.8 * k, -3.2 * k], [-2.6 * k, -1.2 * k], [-3.6 * k, -2 * k]], true, 0.6), fill('#2E8B47'));
  c.drawPath(path.smooth([[-3.6 * k, -2.6 * k], [-4.6 * k, -4.2 * k], [-3.4 * k, -5 * k]], false), stroke('#2E8B47', 1.2 * k));
  c.drawPath(path.smooth([[-1.2 * k, -2.4 * k], [1 * k, -1.6 * k], [2.2 * k, 0]], false), stroke('#FFFFFF', 0.8 * k, 0.6));
}

/** A green leaf with its vein. */
function leaf(c: SkCanvas, k = 1) {
  glossy(c, path.smooth([[-4 * k, 3.6 * k], [-3.6 * k, -1 * k], [0, -4 * k], [4 * k, -4.2 * k], [3.4 * k, 0], [0, 3.4 * k]], true, 0.8), '#43B04A', '#1E5A22', 0.9 * k);
  c.drawPath(path.polyline([[-4 * k, 3.6 * k], [2.6 * k, -2.8 * k]]), stroke('#D8F5C8', 0.8 * k));
}

/** An ear of wheat, crossed out: gluten-free. */
function wheatCrossed(c: SkCanvas, k = 1) {
  c.drawPath(path.polyline([[0, 4.4 * k], [0, -4 * k]]), stroke('#B07A20', 1 * k));
  for (const y of [-3, -1, 1]) {
    for (const s of [-1, 1]) glossy(c, path.oval(s * 1.5 * k, y * k, 1.3 * k, 0.8 * k), '#F2C14E', '#8A5A10', 0.6 * k);
  }
  c.drawPath(path.polyline([[-4.2 * k, 4.2 * k], [4.2 * k, -4.2 * k]]), stroke('#FFFFFF', 2.6 * k));
  c.drawPath(path.polyline([[-4.2 * k, 4.2 * k], [4.2 * k, -4.2 * k]]), stroke('#E5372B', 1.5 * k));
}

/** The badge behind a request: a white disc with a dark rim, so the small picture reads on anything. */
function badge(c: SkCanvas) {
  c.drawCircle(0, 0, 6.2, fill(EDGE));
  c.drawCircle(0, 0, 5.3, fill('#FFFFFF'));
}

const reqSpicy = sprite(BADGE, (c) => {
  badge(c);
  chili(c, 0.95);
});
const reqVegan = sprite(BADGE, (c) => {
  badge(c);
  leaf(c, 0.95);
});
const reqGluten = sprite(BADGE, (c) => {
  badge(c);
  wheatCrossed(c, 0.95);
});

/** A plate gone cold on the pass: a pale blue snowflake. */
const coldMark = sprite(BADGE, (c) => {
  for (let i = 0; i < 3; i++) {
    c.save();
    c.rotate(i * 60, 0, 0);
    c.drawPath(path.polyline([[0, -5], [0, 5]]), stroke(EDGE, 2.6));
    c.restore();
  }
  for (let i = 0; i < 3; i++) {
    c.save();
    c.rotate(i * 60, 0, 0);
    c.drawPath(path.polyline([[0, -5], [0, 5]]), stroke('#BFE6FF', 1.3));
    for (const s of [-1, 1]) c.drawPath(path.polyline([[-1.6, s * 4.4], [0, s * 3], [1.6, s * 4.4]]), stroke('#BFE6FF', 0.9));
    c.restore();
  }
});

/** The prep stock's board on the pass (the bowls go on it one by one). */
const prepBoard = sprite([-16, -9, 16, 9], (c) => {
  c.drawPath(path.poly([[-14, 0], [0, -7], [14, 0], [0, 7]]), fill('#000000', 0.18));
  glossy(c, path.poly([[-13, -1.5], [0, -8], [13, -1.5], [0, 5]]), '#C98A4A', '#6E3E1A');
  c.drawPath(path.poly([[-13, -1.5], [0, 5], [0, 7], [-13, 0.5]]), fill('#8A5226'));
  c.drawPath(path.poly([[13, -1.5], [0, 5], [0, 7], [13, 0.5]]), fill('#A8683A'));
});

/** A small bowl of chopped mise en place: carrots, herbs, tomato, onion. */
const BOWL_FILLS = ['#F28C28', '#43B04A', '#E5372B', '#F3E9D2'] as const;
const prepBowls = BOWL_FILLS.map((color) =>
  sprite([-6, -6, 6, 5], (c) => {
    c.drawOval(Skia.XYWHRect(-4.6, 1.4, 9.2, 3), fill('#000000', 0.2));
    glossy(c, path.smooth([[-4.6, -1], [4.6, -1], [3.4, 2.6], [-3.4, 2.6]], true, 0.4), '#FFFFFF', '#6A7480', 0.8);
    c.drawOval(Skia.XYWHRect(-4.4, -2.6, 8.8, 3.2), fill(darken(color, 0.15)));
    for (const [x, y] of [[-2.2, -1.4], [0.4, -1.8], [2.2, -1.1], [-0.8, -0.6], [1.2, -0.4]] as const) c.drawCircle(x, y, 0.9, fill(lighten(color, 0.2)));
  }),
);

/** Steam over a hot plate: a soft white wisp with a faint grey edge, so it shows on the steel pass too. */
const steamWisp = sprite([-5, -9, 5, 9], (c) => {
  const p = path.smooth([[0, 8], [-2.6, 4], [1.8, 0], [-1.6, -4], [0.6, -8]], false);
  c.drawPath(p, glowStroke('#8A96A6', 3.2, 0.35, 1));
  c.drawPath(p, stroke('#FFFFFF', 1.8, 0.95));
});

const ICON = [-18, -22, 18, 14] as const;

/** Heat lamps: a red hood glowing orange over a steaming plate. */
const heatLamp = sprite(ICON, (c) => {
  c.drawPath(path.polyline([[0, -21], [0, -14]]), stroke('#5A6470', 1.6));
  glossy(c, path.smooth([[-11, -4], [-7, -13], [0, -15], [7, -13], [11, -4]], true, 0.6), '#E5483B', '#7A1410');
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  glow.setShader(Skia.Shader.MakeRadialGradient(vec(0, -2), 12, [Skia.Color('rgba(255,190,80,0.85)'), Skia.Color('rgba(255,150,40,0)')], null, TileMode.Clamp));
  c.drawCircle(0, 2, 12, glow);
  c.drawOval(Skia.XYWHRect(-6, -6, 12, 4), fill('#FFE58A'));
  c.drawOval(Skia.XYWHRect(-13, 6, 26, 7), fill('#000000', 0.2));
  glossy(c, path.oval(0, 7, 12, 4.5), '#FFFFFF', '#6A7480');
  c.drawOval(Skia.XYWHRect(-7, 4.4, 14, 4.6), fill('#C8814A'));
  for (const x of [-4, 0, 4]) c.drawPath(path.smooth([[x, 3], [x - 1.4, 0], [x + 0.6, -2]], false), glowStroke('#FFFFFF', 1.2, 0.8, 0.6));
});

/** The prep fridge: a steel prep fridge with bowls set out on its board. */
const prepFridge = sprite(ICON, (c) => {
  glossy(c, path.rrect(-14, -6, 28, 18, 2.5), '#C9D2DE', '#4A5462');
  c.drawRect(Skia.XYWHRect(-12, -1, 11, 11), stroke('#8A94A2', 1));
  c.drawRect(Skia.XYWHRect(1, -1, 11, 11), stroke('#8A94A2', 1));
  c.drawRect(Skia.XYWHRect(-4, 3, 2, 3), fill('#4A5462'));
  c.drawRect(Skia.XYWHRect(2, 3, 2, 3), fill('#4A5462'));
  glossy(c, path.rrect(-15, -9, 30, 4, 1.4), '#C98A4A', '#6E3E1A');
  BOWL_FILLS.forEach((color, i) => {
    const x = -10.5 + i * 7;
    glossy(c, path.smooth([[x - 3.2, -12], [x + 3.2, -12], [x + 2.4, -8.6], [x - 2.4, -8.6]], true, 0.4), '#FFFFFF', '#6A7480', 0.7);
    c.drawOval(Skia.XYWHRect(x - 3, -13.4, 6, 2.6), fill(color));
  });
});

/** The special-requests board: a chalkboard with a chili, a leaf and crossed-out wheat. */
const requestBoard = sprite(ICON, (c) => {
  c.drawPath(path.polyline([[-9, 4], [-12, 13]]), stroke('#6E3E1A', 2));
  c.drawPath(path.polyline([[9, 4], [12, 13]]), stroke('#6E3E1A', 2));
  glossy(c, path.rrect(-15, -19, 30, 25, 2.5), '#C98A4A', '#6E3E1A');
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-12.5, -16.5, 25, 20), 1.5, 1.5), fill('#2F3B36'));
  c.save();
  c.translate(-6.5, -11);
  chili(c, 1);
  c.restore();
  c.save();
  c.translate(6, -11);
  leaf(c, 1);
  c.restore();
  c.save();
  c.translate(0, -2);
  wheatCrossed(c, 0.9);
  c.restore();
  for (const y of [-14.5, 1.5]) c.drawPath(path.polyline([[-10, y], [10, y]]), stroke('#FFFFFF', 0.5, 0.35));
});

export const serviceSprites = {
  reqSpicy, reqVegan, reqGluten, coldMark, prepBoard, steamWisp,
  prepBowl0: prepBowls[0]!, prepBowl1: prepBowls[1]!, prepBowl2: prepBowls[2]!, prepBowl3: prepBowls[3]!,
  heatLamp, prepFridge, requestBoard,
};

/** Request badges in REQUESTS order (src/data/service.ts). */
export const REQUEST_BADGES = ['reqSpicy', 'reqVegan', 'reqGluten'] as const;
