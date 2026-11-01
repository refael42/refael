import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { HOLIDAYS, type HolidayId } from '../../data/holidays';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { P } from './iso3d';
import { fill, path, stroke } from './kit';

// Real holidays (src/data/holidays.ts): a garland along the front of the restaurant, a tile at a
// time like the weekend's bunting, with the holiday's own ornaments (apples and pomegranates,
// paper chains, blue and white flags, leaves, Purim masks, spring flowers, Israeli flags, flames,
// wheat, gold stars), and a menorah by the door for Hanukkah whose candles the renderer lights
// night by night.

/** Height of the string above the floor (px), as the bunting's. */
const STRING_Z = 74;
const sagOf = (x: number) => (1 - 4 * x * x) * 6;
const at = (x: number, lift = 0) => P(x, 0, STRING_Z - sagOf(x) - lift);

type Ornament = (c: SkCanvas, x: number, y: number, k: number) => void;

const flag = (colors: readonly string[]): Ornament => (c, x, y, k) => {
  const col = colors[k % colors.length]!;
  c.drawPath(path.poly([[x - 5, y], [x + 5, y], [x, y + 11]]), fill(col));
  c.drawPath(path.poly([[x - 5, y], [x + 5, y], [x, y + 11]]), stroke(darken(col, 0.3), 0.5));
};

const ORNAMENTS: Record<HolidayId, Ornament> = {
  roshHashana: (c, x, y, k) => {
    c.drawPath(path.polyline([[x, y], [x, y + 4]]), stroke('#6A4A2A', 0.8));
    if (k % 2 === 0) {
      // A red apple with a leaf.
      c.drawCircle(x, y + 8, 4.2, fill('#D8352B'));
      c.drawOval(Skia.XYWHRect(x + 0.5, y + 2.5, 4, 2), fill('#5E9C3A'));
    } else {
      // A pomegranate with its crown.
      c.drawCircle(x, y + 8.5, 4.6, fill('#A81E3A'));
      c.drawPath(path.poly([[x - 2, y + 4], [x - 1, y + 2.2], [x, y + 3.6], [x + 1, y + 2.2], [x + 2, y + 4]]), fill('#7A1428'));
    }
    c.drawCircle(x - 1.4, y + 6.6, 1.1, fill('#FFFFFF', 0.45));
  },
  sukkot: (c, x, y, k) => {
    // A paper chain link and a hanging citrus.
    const cols = ['#E5483B', '#F2C14E', '#35B957', '#3E7BC8'];
    c.drawOval(Skia.XYWHRect(x - 3, y, 6, 8), stroke(cols[k % 4]!, 1.6));
    c.drawOval(Skia.XYWHRect(x - 3.2, y + 9, 6.4, 5.4), fill('#F2D23A'));
  },
  hanukkah: (c, x, y, k) => {
    flag(['#3E7BC8', '#FFFFFF'])(c, x, y, k);
    if (k === 1) {
      // A little star on the middle flag.
      c.drawCircle(x, y + 4, 1.3, fill('#F2C14E'));
    }
  },
  tuBishvat: (c, x, y) => {
    c.drawPath(path.smooth([[x, y], [x + 4, y + 5], [x, y + 12], [x - 4, y + 5]], true, 0.9), fill('#5E9C3A'));
    c.drawPath(path.polyline([[x, y + 1], [x, y + 11]]), stroke('#2E6A1E', 0.7));
  },
  purim: (c, x, y, k) => {
    // A party mask with eye holes.
    const cols = ['#B45CFF', '#F2C14E', '#E2649B'];
    const col = cols[k % 3]!;
    c.drawPath(path.smooth([[x - 7, y + 3], [x, y + 1], [x + 7, y + 3], [x + 6, y + 9], [x + 1, y + 8], [x, y + 6.5], [x - 1, y + 8], [x - 6, y + 9]], true, 0.8), fill(col));
    c.drawOval(Skia.XYWHRect(x - 5, y + 4, 3.4, 2.4), fill('#2A1530'));
    c.drawOval(Skia.XYWHRect(x + 1.6, y + 4, 3.4, 2.4), fill('#2A1530'));
    c.drawCircle(x + 7, y + 2, 1.4, fill(lighten(col, 0.5)));
  },
  passover: (c, x, y, k) => {
    const col = ['#FF8FA8', '#F2C14E', '#FFFFFF'][k % 3]!;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      c.drawCircle(x + Math.cos(a) * 3, y + 6 + Math.sin(a) * 3, 2.4, fill(col));
    }
    c.drawCircle(x, y + 6, 1.8, fill('#E8A21A'));
  },
  independence: (c, x, y) => {
    // A little Israeli flag: white, two blue stripes, the star between them.
    c.drawRect(Skia.XYWHRect(x - 6, y, 12, 9), fill('#FFFFFF'));
    c.drawRect(Skia.XYWHRect(x - 6, y + 1, 12, 1.4), fill('#1F4FA8'));
    c.drawRect(Skia.XYWHRect(x - 6, y + 6.6, 12, 1.4), fill('#1F4FA8'));
    const r = 1.9;
    const tri = (rot: number) => path.poly([0, 1, 2].map((i) => [x + Math.sin(rot + (i * 2 * Math.PI) / 3) * r, y + 4.5 - Math.cos(rot + (i * 2 * Math.PI) / 3) * r] as [number, number]));
    c.drawPath(tri(0), stroke('#1F4FA8', 0.6));
    c.drawPath(tri(Math.PI), stroke('#1F4FA8', 0.6));
    c.drawRect(Skia.XYWHRect(x - 6, y, 12, 9), stroke('#9AA6B4', 0.4));
  },
  lagBaomer: (c, x, y, k) => {
    const col = ['#E8742A', '#D8352B', '#F2C14E'][k % 3]!;
    c.drawPath(path.smooth([[x, y + 12], [x - 4, y + 6], [x - 1, y + 2], [x, y], [x + 1, y + 2], [x + 4, y + 6]], true, 0.8), fill(col));
    c.drawPath(path.smooth([[x, y + 11], [x - 2, y + 7], [x, y + 4], [x + 2, y + 7]], true, 0.8), fill('#FFE27A'));
  },
  shavuot: (c, x, y, k) => {
    if (k % 2 === 0) {
      for (const dx of [-2, 0, 2]) {
        c.drawPath(path.polyline([[x, y + 13], [x + dx, y + 3]]), stroke('#B8862A', 0.8));
        c.drawOval(Skia.XYWHRect(x + dx - 1.2, y + 1, 2.4, 4), fill('#E8C76A'));
      }
    } else {
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        c.drawCircle(x + Math.cos(a) * 2.8, y + 6 + Math.sin(a) * 2.8, 2.2, fill('#FFFFFF'));
      }
      c.drawCircle(x, y + 6, 1.6, fill('#F2C14E'));
    }
  },
  newYear: (c, x, y, k) => {
    const col = k % 2 === 0 ? '#F2C14E' : '#D9DEE6';
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 5 : 2.2;
      pts.push([x + Math.cos(a) * r, y + 6 + Math.sin(a) * r]);
    }
    c.drawPath(path.poly(pts), fill(col));
    c.drawPath(path.poly(pts), stroke(darken(col, 0.35), 0.5));
  },
};

/** One tile of a holiday garland; `shift` varies which ornament comes first. */
function garland(id: HolidayId, color: string, shift: number) {
  return sprite([-40, -112, 40, -38], (c) => {
    const pts = Array.from({ length: 9 }, (_, i) => at(-0.5 + i / 8));
    c.drawPath(path.polyline(pts), stroke(lighten(color, 0.4), 1));
    for (let k = 0; k < 3; k++) {
      const [x, y] = at(-0.33 + k * 0.33);
      ORNAMENTS[id](c, x, y, k + shift);
    }
  });
}

/** The menorah by the door (its candles are drawn by the renderer, one more each night). */
const menorah = sprite([-30, -70, 30, 6], (c) => {
  const gold = '#E2B13C';
  const dark = darken(gold, 0.35);
  // The base, the stem, and the branches as nested arcs (four a side), the servant's place on top.
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-10, -4, 20, 5), 2, 2), fill(gold));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-10, -4, 20, 5), 2, 2), stroke(dark, 0.8));
  c.drawRect(Skia.XYWHRect(-1.6, -34, 3.2, 31), fill(gold));
  for (let i = 1; i <= 4; i++) {
    const r = i * 5.2;
    c.drawPath(path.smooth([[-r, -36], [-r * 0.7, -36 + r * 0.6], [0, -36 + r * 0.85], [r * 0.7, -36 + r * 0.6], [r, -36]], false, 0.9), stroke(gold, 2.2));
  }
  c.drawRect(Skia.XYWHRect(-2.4, -42, 4.8, 6), fill(gold));
});

/** A lit candle standing in a holder (its foot at the anchor). */
const menorahCandle = sprite([-4, -14, 4, 1], (c) => {
  c.drawRect(Skia.XYWHRect(-1.2, -6, 2.4, 6), fill('#F4F1E8'));
  c.drawPath(path.smooth([[0, -13], [2.2, -8.5], [0, -6.4], [-2.2, -8.5]], true), fill('#FF9A2A'));
  c.drawPath(path.smooth([[0, -11], [1, -8.4], [0, -7.2], [-1, -8.4]], true), fill('#FFF3B0'));
});

export const holidaySprites = { menorah, menorahCandle };
/** The garlands by name (looked up through GARLANDS, not by name in code). */
export const garlandSprites: Record<string, ReturnType<typeof sprite>> = Object.fromEntries(
  HOLIDAYS.flatMap((h) => [[`garland_${h.id}0`, garland(h.id, h.color, 0)], [`garland_${h.id}1`, garland(h.id, h.color, 1)]]),
);

/** The garland tiles by holiday (HOLIDAYS order), two of each. */
export const GARLANDS = HOLIDAYS.map((h) => [`garland_${h.id}0`, `garland_${h.id}1`] as const);
