import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { OCCASIONS } from '../../data/occasions';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { fill, path, stroke } from './kit';

// Private events (src/data/occasions.ts): the balloons tied to a party's table (in the event's
// colors), the little "reserved" card on a table kept for a booking, and the pictures for the
// phone's card: a ringing phone, the anniversary's heart, the birthday cake, the business lunch's briefcase, the bar
// mitzvah's party popper, the wedding rings. Anchor = the table's middle on the floor (the
// balloons stand on the top: the renderer lifts them).

const ICON = [-20, -24, 20, 16] as const;

/** One balloon on a string, its top at (x, y). */
function balloon(c: SkCanvas, x: number, y: number, color: string, sway: number) {
  c.drawPath(path.smooth([[x, y + 13], [x + sway * 0.5, y + 22], [x - sway * 0.3, y + 30], [x + sway * 0.2, y + 38]], false, 0.9), stroke('#6A5A70', 0.7));
  c.drawPath(path.smooth([[x, y], [x + 6, y + 3], [x + 5.5, y + 10], [x, y + 13.5], [x - 5.5, y + 10], [x - 6, y + 3]], true, 0.95), fill(color));
  c.drawPath(path.smooth([[x, y], [x + 6, y + 3], [x + 5.5, y + 10], [x, y + 13.5], [x - 5.5, y + 10], [x - 6, y + 3]], true, 0.95), stroke(darken(color, 0.3), 0.6));
  c.drawOval(Skia.XYWHRect(x - 3.6, y + 2.2, 2.6, 4), fill('#FFFFFF', 0.55));
  c.drawPath(path.poly([[x - 1.4, y + 15], [x + 1.4, y + 15], [x, y + 13]]), fill(darken(color, 0.15)));
}

/** A bunch of three balloons tied to a weight (drawn on the table top). */
const balloons = (colors: readonly [string, string, string]) =>
  sprite([-16, -44, 16, 4], (c) => {
    balloon(c, -7, -42, colors[0], -3);
    balloon(c, 7, -40, colors[2], 3);
    balloon(c, 0, -44, colors[1], 0);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-2.5, -3, 5, 4), 1, 1), fill('#E8C76A'));
  });

/** A folded card on the table: "reserved". */
const reservedCard = sprite([-10, -12, 10, 2], (c) => {
  c.drawPath(path.poly([[-8, 0], [0, 2], [8, 0], [8, -9], [0, -7], [-8, -9]]), fill('#FFF6E3'));
  c.drawPath(path.poly([[0, 2], [8, 0], [8, -9], [0, -7]]), fill('#E8DCC4'));
  c.drawPath(path.poly([[-8, 0], [0, 2], [8, 0], [8, -9], [0, -7], [-8, -9]]), stroke('#B8862A', 0.8));
  for (const y of [-5.5, -3.5]) c.drawPath(path.polyline([[-6, y], [-1.5, y + 1]]), stroke('#B8862A', 0.9));
  c.drawCircle(4, -4, 1.6, fill('#D8352B'));
});

/** The phone ringing (the event's button). */
const phoneIcon = sprite(ICON, (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-15, -4, 30, 16), 4, 4), fill('#D8352B'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-15, -4, 30, 16), 4, 4), stroke('#7A1A14', 1.3));
  for (let i = 0; i < 9; i++) c.drawCircle(-5 + (i % 3) * 5, 0 + Math.floor(i / 3) * 4, 1.3, fill('#FFE0D8'));
  // The handset on top.
  c.drawPath(path.smooth([[-17, -8], [-12, -14], [0, -16], [12, -14], [17, -8], [12, -6], [8, -10], [-8, -10], [-12, -6]], true, 0.6), fill('#F04A3D'));
  c.drawPath(path.smooth([[-17, -8], [-12, -14], [0, -16], [12, -14], [17, -8], [12, -6], [8, -10], [-8, -10], [-12, -6]], true, 0.6), stroke('#7A1A14', 1.2));
  // It rings.
  for (const s of [-1, 1]) {
    c.drawPath(path.smooth([[s * 19, -18], [s * 22, -14], [s * 21, -9]], false), stroke('#FFC93C', 1.6));
    c.drawPath(path.smooth([[s * 15, -21], [s * 19, -21], [s * 22, -19]], false), stroke('#FFC93C', 1.6));
  }
});

/** An anniversary: a heart. */
const heartIcon = sprite(ICON, (c) => {
  const heart = path.smooth([[0, -8], [6, -16], [16, -12], [14, -2], [0, 13], [-14, -2], [-16, -12], [-6, -16]], true, 0.9);
  c.drawPath(heart, fill('#E5372B'));
  c.drawPath(heart, stroke('#7A1A14', 1.3));
  c.drawOval(Skia.XYWHRect(-11, -13, 6, 5), fill('#FFFFFF', 0.5));
});

/** A birthday cake with candles. */
const cakeIcon = sprite(ICON, (c) => {
  c.drawOval(Skia.XYWHRect(-17, 8, 34, 7), fill('#D9D3E0'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-14, -4, 28, 15), 3, 3), fill('#F7C6D4'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-14, -4, 28, 15), 3, 3), stroke('#B5577A', 1.2));
  c.drawPath(path.smooth([[-14, 0], [-9, 4], [-4, 0], [1, 4], [6, 0], [10, 4], [14, 0]], false), stroke('#FFFFFF', 2.2));
  c.drawRect(Skia.XYWHRect(-14, 5, 28, 2.4), fill('#8A4A2A'));
  for (const [x, col] of [[-8, '#4AB8FF'], [0, '#FFC93C'], [8, '#43B04A']] as const) {
    c.drawRect(Skia.XYWHRect(x - 1.2, -13, 2.4, 9), fill(col));
    c.drawPath(path.smooth([[x, -21], [x + 2.4, -16.5], [x, -14], [x - 2.4, -16.5]], true), fill('#FF9A2A'));
    c.drawCircle(x, -16.2, 1, fill('#FFF3B0'));
  }
});

/** A business lunch: a briefcase. */
const briefcaseIcon = sprite(ICON, (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-6, -16, 12, 8), 3, 3), stroke('#3A2A20', 2.4));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-16, -10, 32, 22), 3, 3), fill('#7A4A2A'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-16, -10, 32, 22), 3, 3), stroke('#3A2A20', 1.3));
  c.drawRect(Skia.XYWHRect(-16, -1, 32, 2.2), fill(darken('#7A4A2A', 0.25)));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-3, -3.5, 6, 5.5), 1, 1), fill('#E8C76A'));
});

/** A bar mitzvah: a party popper and its confetti. */
const popperIcon = sprite(ICON, (c) => {
  c.drawPath(path.poly([[-14, 12], [-4, -4], [4, 4]]), fill('#3E7BC8'));
  c.drawPath(path.poly([[-14, 12], [-4, -4], [4, 4]]), stroke('#1E3A6A', 1.2));
  for (const t of [0.35, 0.65]) c.drawPath(path.polyline([[-14 + (-4 + 14) * t, 12 + (-4 - 12) * t], [-14 + (4 + 14) * t, 12 + (4 - 12) * t]]), stroke('#FFFFFF', 1.4));
  const bits: readonly [number, number, string][] = [[4, -10, '#FFC93C'], [10, -4, '#FF5A7A'], [8, -16, '#43B04A'], [15, -12, '#4AB8FF'], [-1, -18, '#FF5A7A'], [14, 2, '#FFC93C'], [17, -20, '#FFFFFF']];
  for (const [x, y, col] of bits) {
    c.save();
    c.rotate(x * 9, x, y);
    c.drawRect(Skia.XYWHRect(x - 2, y - 1, 4, 2), fill(col));
    c.restore();
  }
  c.drawPath(path.smooth([[2, -4], [7, -9], [6, -14], [11, -18]], false), stroke('#F2C14E', 1.3));
});

/** A wedding: two rings and a sparkle. */
const ringsIcon = sprite(ICON, (c) => {
  const ring = (x: number, y: number) => {
    c.drawCircle(x, y, 9, stroke('#B8862A', 4.4));
    c.drawCircle(x, y, 9, stroke('#F2C14E', 2.6));
    c.drawCircle(x - 3, y - 6, 1.4, fill(lighten('#F2C14E', 0.6)));
  };
  ring(-6, 4);
  ring(6, 2);
  c.drawPath(path.poly([[6, -13], [9, -17], [12, -13], [9, -9]]), fill('#BFE8FF'));
  c.drawPath(path.poly([[6, -13], [9, -17], [12, -13], [9, -9]]), stroke('#4A88B8', 0.9));
  for (const [x, y] of [[-14, -14], [16, -4]] as const) {
    c.drawPath(path.poly([[x, y - 3], [x + 1, y - 1], [x + 3, y], [x + 1, y + 1], [x, y + 3], [x - 1, y + 1], [x - 3, y], [x - 1, y - 1]]), fill('#FFF3B0'));
  }
});

export const occasionSprites = {
  balloons0: balloons(OCCASIONS[0]!.colors),
  balloons1: balloons(OCCASIONS[1]!.colors),
  balloons2: balloons(OCCASIONS[2]!.colors),
  balloons3: balloons(OCCASIONS[3]!.colors),
  balloons4: balloons(OCCASIONS[4]!.colors),
  reservedCard,
  phoneIcon,
  heartIcon,
  cakeIcon,
  briefcaseIcon,
  popperIcon,
  ringsIcon,
};

/** By OCCASIONS order: the balloons on the table, the card's picture. */
export const BALLOONS = ['balloons0', 'balloons1', 'balloons2', 'balloons3', 'balloons4'] as const;
export const OCCASION_ICONS = ['heartIcon', 'cakeIcon', 'briefcaseIcon', 'popperIcon', 'ringsIcon'] as const;
