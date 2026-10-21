import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { sprite, type SpriteDef } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, onFaceX, P, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';
import { GOLD } from './stationArt';

// The bar's design levels (owner M30: "improve the bar with more design levels you can unlock";
// rules in src/data/bar.ts BAR_STAGES): a rack of glasses hanging over the counter, soda taps,
// a neon sign on the counter, a dry-ice shake bowl, a tower of sparkling juice, a crystal
// chandelier. Every drink in the game is alcohol-free (the App Store age rating counts alcohol). The counter-top ones are drawn from the counter's top (the prop is lifted there);
// the hanging ones from the floor. The renderer adds what moves (src/render/draw/drawBarDecor.ts).

const BRASS = '#C9A35A';
const GLASS = '#D8F0FA';
const JUICE = '#FF8FB3';

/** A wine glass hanging upside down from the rack: its foot up at `z`, the bowl below. */
function hangingGlass(c: SkCanvas, x: number, y: number, z: number) {
  const [fx, fy] = P(x, y, z);
  c.drawOval(Skia.XYWHRect(fx - 2.2, fy - 0.7, 4.4, 1.4), fill(GLASS, 0.9));
  c.drawLine(fx, fy, fx, fy + 4, stroke(GLASS, 0.8));
  c.drawPath(path.smooth([[fx - 2.4, fy + 4], [fx - 2.6, fy + 7.5], [fx, fy + 9.5], [fx + 2.6, fy + 7.5], [fx + 2.4, fy + 4]], true), fill(GLASS, 0.55));
  c.drawLine(fx - 1.2, fy + 5, fx - 1.4, fy + 8, stroke('#FFFFFF', 0.6, 0.9));
}

function glassRack(c: SkCanvas) {
  // Two brass rods from the ceiling, the dark wood rack, the glasses hanging under it.
  for (const y of [-0.62, 0.62]) box(c, { x: 0, y, z: 74, w: 0.04, d: 0.04, h: 30, color: BRASS });
  box(c, { x: 0, y: 0, z: 72, w: 0.46, d: 1.5, h: 3, color: '#4A2E1E', rim: true });
  box(c, { x: 0, y: 0, z: 71.4, w: 0.48, d: 1.52, h: 0.6, color: BRASS });
  for (let i = 0; i < 7; i++) {
    const y = -0.6 + i * 0.2;
    hangingGlass(c, -0.1, y, 71);
    if (i % 2 === 0) hangingGlass(c, 0.12, y + 0.1, 71);
  }
}

function taps(c: SkCanvas) {
  // The drip tray, the chrome tower, three taps with their handles, a pint just poured.
  box(c, { x: 0.02, y: 0, z: 0, w: 0.3, d: 0.5, h: 1, color: '#2B2F38', rim: true });
  box(c, { x: -0.06, y: 0, z: 1, w: 0.12, d: 0.42, h: 13, color: '#C9D1D9', rim: true });
  box(c, { x: -0.06, y: 0, z: 14, w: 0.16, d: 0.46, h: 2, color: '#E4E9EE', rim: true });
  ['#E5483B', '#F2C14E', '#3A6EA8'].forEach((col, i) => {
    const y = -0.14 + i * 0.14;
    box(c, { x: 0.04, y, z: 10, w: 0.08, d: 0.03, h: 1.4, color: '#9AA6B4' });
    box(c, { x: 0, y, z: 16, w: 0.04, d: 0.05, h: 6, color: col, rim: true });
  });
  cylinder(c, 0.1, 0.18, 0.06, 1, 7, '#F2C14E', '#FFF4DE');
}

function neon(c: SkCanvas) {
  // A neon sign standing on the counter: a dark frame on a little base, a pink cocktail glass
  // and a cyan star in neon tube.
  box(c, { x: 0, y: 0, z: 0, w: 0.16, d: 0.42, h: 1.4, color: '#2B2F38' });
  box(c, { x: 0, y: 0, z: 1.4, w: 0.05, d: 0.6, h: 22, color: '#1A1020', rim: true });
  const [ax, ay] = P(0.03, -0.12, 20);
  const glass = path.polyline([
    [ax - 5, ay - 0.5],
    [ax + 5, ay + 2.2],
    [ax + 0.4, ay + 6.5],
    [ax + 0.4, ay + 11],
    [ax - 2.4, ay + 11.4],
    [ax + 3, ay + 12.2],
  ]);
  c.drawPath(glass, stroke('#FF6FB5', 2.6, 0.35));
  c.drawPath(glass, stroke('#FFD1E8', 1));
  c.drawLine(ax - 5, ay - 0.5, ax + 0.4, ay + 6.5, stroke('#FFD1E8', 1));
  const [sx, sy] = P(0.03, 0.16, 15);
  const star = path.poly(Array.from({ length: 10 }, (_, k) => {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const r = k % 2 ? 1.7 : 4;
    return [sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.8] as [number, number];
  }));
  c.drawPath(star, stroke('#5FE6FF', 2.6, 0.35));
  c.drawPath(star, stroke('#D8FBFF', 1));
}

function dryIce(c: SkCanvas) {
  // A wide glass bowl on a gold stand, three cocktails round it (the renderer adds the fog).
  cylinder(c, 0, 0, 0.05, 0, 3, GOLD, lighten(GOLD, 0.2));
  cylinder(c, 0, 0, 0.18, 3, 5, '#CFE8F2', '#8C5AC8');
  onFaceX(c, 0.13, 0.13, () => rectIn(c, 0.04, 4, 0.04, 3, '#FFFFFF', 0.5));
  ['#3FD48A', '#F28A12', '#E85A8A'].forEach((col, i) => {
    const a = (i / 3) * Math.PI * 2 + 0.6;
    const x = Math.cos(a) * 0.26;
    const y = Math.sin(a) * 0.26;
    cylinder(c, x, y, 0.035, 0, 3, GLASS, GLASS);
    cylinder(c, x, y, 0.06, 3, 3, col, lighten(col, 0.25));
  });
}

function champagne(c: SkCanvas) {
  // Coupes of sparkling juice stacked in a pyramid, a jug on top pouring.
  const coupe = (x: number, y: number, z: number) => {
    cylinder(c, x, y, 0.012, z, 2.4, GLASS, GLASS);
    cylinder(c, x, y, 0.07, z + 2.4, 1.6, JUICE, lighten(JUICE, 0.35));
  };
  for (const [x, y] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]] as const) coupe(x, y, 0);
  for (const [x, y] of [[0, -0.05], [0, 0.05]] as const) coupe(x, y, 4);
  coupe(0, 0, 8);
  // A glass jug of pink sparkling juice, tipped toward the top coupe.
  const [bx, by] = P(0.05, 0.12, 16);
  c.save();
  c.rotate(-35, bx, by);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(bx - 3, by - 9, 6, 9), 2.4, 2.4), fill(GLASS));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(bx - 2.4, by - 5.5, 4.8, 5), 1.8, 1.8), fill(JUICE));
  c.drawRect(Skia.XYWHRect(bx - 1.6, by - 11, 3.2, 2.4), fill(GLASS));
  c.drawArc(Skia.XYWHRect(bx + 2, by - 7.5, 3.2, 5), -90, 180, false, stroke(GLASS, 1.1));
  c.restore();
}

function chandelier(c: SkCanvas) {
  // A chain from the ceiling, two gold rings of crystal drops, candles on the upper one.
  box(c, { x: 0, y: 0, z: 70, w: 0.02, d: 0.02, h: 40, color: GOLD });
  const ring = (z: number, r: number, drops: number) => {
    const [cx, cy] = P(0, 0, z);
    const rx = r * 32 * Math.SQRT2;
    const ry = rx / 2;
    c.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), stroke(GOLD, 1.6));
    for (let k = 0; k < drops; k++) {
      const a = (k / drops) * Math.PI * 2;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      c.drawLine(x, y, x, y + 3, stroke(GOLD, 0.5));
      c.drawCircle(x, y + 4, 1.2, fill(GLASS));
      c.drawCircle(x - 0.3, y + 3.7, 0.4, fill('#FFFFFF'));
    }
    return { cx, cy, rx, ry };
  };
  const top = ring(66, 0.34, 10);
  ring(58, 0.22, 7);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const x = top.cx + Math.cos(a) * top.rx;
    const y = top.cy + Math.sin(a) * top.ry;
    c.drawRect(Skia.XYWHRect(x - 0.7, y - 4.5, 1.4, 4.5), fill('#F4EEE2'));
    c.drawOval(Skia.XYWHRect(x - 0.8, y - 7, 1.6, 2.6), fill('#FFD24A'));
  }
  const [cx, cy] = P(0, 0, 56);
  c.drawPath(path.smooth([[cx - 3, cy - 2], [cx, cy + 5], [cx + 3, cy - 2]], true), fill(darken(GOLD, 0.1)));
}

/** By piece (src/data/bar.ts BarPiece order). */
export const BAR_DECOR_SPRITES = ['barRack', 'barTaps', 'barNeon', 'barDryIce', 'barChampagne', 'barChandelier'] as const;

export const barDecorSprites: Record<(typeof BAR_DECOR_SPRITES)[number], SpriteDef> = {
  barRack: sprite([-46, -120, 46, -40], glassRack),
  barTaps: sprite([-16, -28, 18, 10], taps),
  barNeon: sprite([-26, -34, 26, 10], neon),
  barDryIce: sprite([-18, -16, 18, 10], dryIce),
  barChampagne: sprite([-16, -32, 18, 8], champagne),
  barChandelier: sprite([-30, -118, 30, -34], chandelier),
};
