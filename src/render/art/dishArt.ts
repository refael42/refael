import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, P } from './iso3d';
import { fill, path, stroke, type Pt } from './kit';
import { looks, plateBase } from './stationArt';

// Tel Aviv street food (owner request: more food): falafel, shawarma, hummus, schnitzel,
// shakshuka and ice cream. Each has a plated look per recipe milestone (a wooden board from
// the third, gold from the fourth, more garnish along the way) and a small icon for the order
// bubbles and tickets.

const GOLD = '#E2B13C';
const EDGE = '#2A1530';

/** A soft-shaded blob: an outline, a top-lit body, a highlight. */
function blob(c: SkCanvas, pts: readonly Pt[], base: string, tension = 0.9) {
  const p = path.smooth(pts, true, tension);
  c.drawPath(p, stroke(darken(base, 0.45), 0.9));
  c.drawPath(p, fill(base));
}

/** Points of an ellipse around (x, y). */
function ellipse(x: number, y: number, rx: number, ry: number, n = 10): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * rx, y + Math.sin(a) * ry] as Pt;
  });
}

// ---------- plated ----------

const falafelPlates = looks('plateFalafel', [-16, -26, 16, 6], (c, t) => {
  const [x, y] = P(0, 0, plateBase(c, t));
  // A pita pocket standing up, stuffed: falafel balls, salad, tahini.
  blob(c, [[x - 7, y - 9], [x - 7, y - 2], [x, y + 1], [x + 7, y - 2], [x + 7, y - 9]], t === 3 ? '#F2D48A' : '#E9C88A', 0.7);
  blob(c, ellipse(x, y - 9, 6.5, 2.2), '#5FC35A');
  for (const [dx, dy] of [[-3.5, -11], [0.5, -12.5], [3.8, -10.8], ...(t >= 1 ? ([[-0.8, -9.6]] as const) : [])] as const) {
    c.drawCircle(x + dx, y + dy, 2.3, fill('#7A4420'));
    c.drawCircle(x + dx - 0.6, y + dy - 0.7, 0.9, fill('#B0703A'));
  }
  if (t >= 1) c.drawPath(path.smooth([[x - 5, y - 12], [x - 2, y - 13.5], [x + 1, y - 12], [x + 4, y - 13.5]], false), stroke('#FFF6DE', 1.1));
  if (t >= 2) for (const [dx, dy] of [[-6, -9], [5.5, -8]] as const) c.drawCircle(x + dx, y + dy, 1.2, fill('#E5483B'));
  if (t === 3) c.drawCircle(x + 6, y - 3, 1.1, fill(GOLD));
});

const shawarmaPlates = looks('plateShawarma', [-16, -24, 16, 6], (c, t) => {
  const [x, y] = P(0, 0, plateBase(c, t));
  // A laffa rolled up and lying on the plate, its open end showing the meat.
  const wrap = t === 3 ? '#F4DC9A' : '#EBCB8E';
  blob(c, [[x - 9, y - 3], [x - 8, y - 7], [x + 5, y - 9], [x + 8, y - 6], [x + 7, y - 2], [x - 6, y]], wrap, 0.8);
  // Foil around the bottom half.
  c.drawPath(path.smooth([[x - 9, y - 3], [x - 4, y - 5], [x - 3, y - 0.5], [x - 6, y]], true, 0.8), fill(t === 3 ? GOLD : '#C9D1D9'));
  blob(c, ellipse(x + 7, y - 5.5, 2.4, 3), '#9A4A22');
  for (const [dx, dy] of [[6.5, -6.5], [7.8, -4.6]] as const) c.drawCircle(x + dx, y + dy, 0.8, fill('#5FC35A'));
  if (t >= 1) for (const [dx, dy] of [[-1, -9], [2, -10]] as const) blob(c, ellipse(x + dx, y + dy, 1.6, 0.9, 8), '#8DBF4A');
  if (t >= 2) c.drawCircle(x + 9.5, y - 2, 1.3, fill('#E5483B'));
});

const hummusPlates = looks('plateHummus', [-17, -22, 17, 6], (c, t) => {
  const z = plateBase(c, t);
  // A wide shallow bowl of hummus, a swirl of olive oil, paprika, chickpeas.
  cylinder(c, 0, 0, 0.16, z, 2.2, t === 3 ? GOLD : '#F2EEE6', '#E8DCC0');
  const [x, y] = P(0, 0, z + 2.2);
  c.drawPath(path.smooth(ellipse(x, y, 5.2, 2.6), true, 1), fill('#E2CFA0'));
  c.drawPath(path.smooth([[x - 3.5, y], [x - 1, y - 1.6], [x + 2.5, y - 0.6], [x + 1, y + 1.2], [x - 1, y + 0.4]], false), stroke('#C9B23A', 1.1));
  for (const [dx, dy] of [[-2, -0.8], [2.6, 0.6], [0.3, 1.3]] as const) c.drawCircle(x + dx, y + dy, 0.5, fill('#D8342C'));
  for (const [dx, dy] of [[0.5, -0.4], [-0.6, 0.3]] as const) c.drawCircle(x + dx, y + dy, 0.9, fill('#E8C46A'));
  // Pita triangles leaning on the bowl.
  if (t >= 1) for (const dx of [-7, 6]) blob(c, [[x + dx, y - 1], [x + dx + 3, y - 7], [x + dx + 4, y]], '#E9C88A', 0.4);
  if (t >= 2) c.drawCircle(x - 0.5, y - 0.2, 0.8, fill('#5FC35A'));
});

const schnitzelPlates = looks('plateSchnitzel', [-17, -20, 17, 6], (c, t) => {
  const [x, y] = P(0, 0, plateBase(c, t));
  // A golden breaded cutlet, a lemon wedge, fries from the second look.
  const crumb = t === 3 ? '#F2C24A' : '#D99A3A';
  blob(c, [[x - 8, y - 2], [x - 6, y - 5], [x + 2, y - 6], [x + 7, y - 4], [x + 6, y - 1], [x - 2, y]], crumb, 0.9);
  for (const [dx, dy] of [[-4, -3], [-1, -4.4], [2, -3], [4, -4]] as const) c.drawCircle(x + dx, y + dy, 0.6, fill(lighten(crumb, 0.35)));
  blob(c, [[x + 4, y - 7], [x + 8, y - 6.5], [x + 6, y - 4]], '#F6E04A', 0.5);
  if (t >= 1) {
    for (const [dx, h] of [[-8.5, 5], [-7.2, 6], [-6, 4.5]] as const) {
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + dx, y - 3 - h, 1.1, h), 0.4, 0.4), fill('#F6C945'));
    }
  }
  if (t >= 2) c.drawCircle(x + 1, y - 7, 0.9, fill('#5FC35A'));
});

const shakshukaPlates = looks('plateShakshuka', [-17, -22, 17, 6], (c, t) => {
  const z = t >= 2 ? 1.4 : 0;
  if (t >= 2) box(c, { x: 0, y: 0, w: 0.32, d: 0.32, h: 1.4, color: '#B07A4A', rim: true });
  // A black pan of red sauce with two eggs.
  cylinder(c, 0, 0, 0.16, z, 2.4, t === 3 ? GOLD : '#2E2A36', t === 3 ? '#F2D48A' : '#4A4452');
  const [x, y] = P(0, 0, z + 2.4);
  c.drawPath(path.smooth(ellipse(x, y, 5.6, 2.8), true, 1), fill('#C8342A'));
  for (const [dx, dy] of [[-2, 0], [2.4, -0.4]] as const) {
    c.drawPath(path.smooth(ellipse(x + dx, y + dy, 2, 1.1), true, 1), fill('#FFFDF4'));
    c.drawCircle(x + dx + 0.2, y + dy - 0.2, 0.75, fill('#F6B41A'));
  }
  for (const [dx, dy] of [[0.3, 1.4], [-3.5, -1], [4, 1]] as const) c.drawCircle(x + dx, y + dy, 0.5, fill('#5FC35A'));
  // The handle, and bread on the side from the second look.
  c.drawLine(x + 5.5, y - 0.5, x + 10, y - 2.5, stroke(t === 3 ? GOLD : '#2E2A36', 1.6));
  if (t >= 1) blob(c, [[x - 9, y - 2], [x - 6, y - 6], [x - 4, y - 1]], '#E9C88A', 0.6);
});

const iceCreamPlates = looks('plateIceCream', [-14, -30, 14, 6], (c, t) => {
  const z = plateBase(c, t);
  // A sundae glass with scoops, cream and a cherry.
  const [x, y] = P(0, 0, z);
  const glass = t === 3 ? GOLD : '#DDEAF5';
  c.drawPath(path.poly([[x - 1.2, y], [x + 1.2, y], [x + 0.6, y - 4], [x - 0.6, y - 4]]), fill(glass));
  blob(c, [[x - 5, y - 8], [x + 5, y - 8], [x + 3, y - 4], [x - 3, y - 4]], glass, 0.4);
  const scoops: [number, number, string][] = [[-2.4, -10, '#F7A8C4'], [2.4, -10, '#7A4A2A'], [0, -13, '#FFF6DE']];
  for (const [dx, dy, color] of scoops) {
    c.drawCircle(x + dx, y + dy, 3, fill(darken(color, 0.25)));
    c.drawCircle(x + dx, y + dy - 0.4, 2.7, fill(color));
  }
  if (t >= 1) c.drawCircle(x, y - 16.3, 1.3, fill('#D8142A'));
  if (t >= 2) c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x + 2.5, y - 17, 1.2, 6), 0.4, 0.4), fill('#E8B86A'));
  if (t === 3) for (const [dx, dy] of [[-4, -14], [4.5, -13]] as const) c.drawCircle(x + dx, y + dy, 0.7, fill(GOLD));
});

// ---------- icons (order bubbles, tickets) ----------

const ICON = [-9, -9, 9, 9] as const;

function glossy(c: SkCanvas, p: ReturnType<typeof path.smooth>, base: string) {
  c.drawPath(p, stroke(EDGE, 1.4));
  c.drawPath(p, fill(base));
  c.drawPath(p, fill('#FFFFFF', 0.12));
}

const iconFalafel = sprite(ICON, (c) => {
  glossy(c, path.smooth([[-6, -2], [-5.4, 4], [0, 6], [5.4, 4], [6, -2]], true, 0.7), '#E9C88A');
  for (const [x, y] of [[-3, -3], [0.4, -4.4], [3.4, -2.8]] as const) {
    c.drawCircle(x, y, 2.4, fill('#7A4420'));
    c.drawCircle(x - 0.7, y - 0.7, 0.9, fill('#B0703A'));
  }
  c.drawPath(path.smooth([[-5, -1], [-2, -2], [2, -1], [5, -2]], false), stroke('#5FC35A', 1.4));
});

const iconShawarma = sprite(ICON, (c) => {
  c.save();
  c.rotate(-30, 0, 0);
  glossy(c, path.rrect(-7, -3, 14, 6, 3), '#EBCB8E');
  c.drawPath(path.rrect(-7, -3, 6, 6, 3), fill('#C9D1D9'));
  c.drawCircle(6, 0, 2.4, fill('#9A4A22'));
  c.restore();
});

const iconHummus = sprite(ICON, (c) => {
  glossy(c, path.smooth([[-7, -1], [7, -1], [5, 5], [-5, 5]], true, 0.5), '#F2EEE6');
  c.drawPath(path.smooth(ellipse(0, -1, 7, 2.6), true, 1), fill('#E2CFA0'));
  c.drawPath(path.smooth([[-3, -1], [0, -2.2], [3, -1]], false), stroke('#C9B23A', 1));
  for (const [x, y] of [[-2, -0.6], [2.4, -0.4]] as const) c.drawCircle(x, y, 0.6, fill('#D8342C'));
});

const iconSchnitzel = sprite(ICON, (c) => {
  glossy(c, path.smooth([[-7, 1], [-5, -4], [3, -5], [7, -2], [5, 3], [-3, 4]], true, 0.9), '#D99A3A');
  for (const [x, y] of [[-3, -1], [0, -2.5], [3, -0.5]] as const) c.drawCircle(x, y, 0.7, fill('#F2C88A'));
  glossy(c, path.poly([[3, -7], [8, -6], [5, -3]]), '#F6E04A');
});

const iconShakshuka = sprite(ICON, (c) => {
  c.drawLine(5, 0, 9, -3, stroke('#2E2A36', 2.2));
  glossy(c, path.smooth(ellipse(-0.5, 0.5, 6.5, 4), true, 1), '#2E2A36');
  c.drawPath(path.smooth(ellipse(-0.5, 0, 5.2, 3), true, 1), fill('#C8342A'));
  for (const [x, y] of [[-2.4, 0], [1.6, -0.6]] as const) {
    c.drawPath(path.smooth(ellipse(x, y, 1.9, 1.2), true, 1), fill('#FFFDF4'));
    c.drawCircle(x, y, 0.8, fill('#F6B41A'));
  }
});

const iconIceCream = sprite(ICON, (c) => {
  glossy(c, path.poly([[-4, -1], [4, -1], [0, 8]]), '#E8B86A');
  for (const [x, y, color] of [[-2, -2.5, '#F7A8C4'], [2, -2.5, '#7A4A2A'], [0, -5.5, '#FFF6DE']] as const) {
    c.drawCircle(x, y, 2.8, fill(darken(color, 0.3)));
    c.drawCircle(x, y - 0.3, 2.5, fill(color));
  }
  c.drawCircle(0, -8.2, 1.1, fill('#D8142A'));
});

export const dishSprites = {
  ...falafelPlates,
  ...shawarmaPlates,
  ...hummusPlates,
  ...schnitzelPlates,
  ...shakshukaPlates,
  ...iceCreamPlates,
  iconFalafel,
  iconShawarma,
  iconHummus,
  iconSchnitzel,
  iconShakshuka,
  iconIceCream,
};
