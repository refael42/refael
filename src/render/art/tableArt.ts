import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { BACKREST_SHIFT } from '../../data/maps';
import type { SpriteDef } from '../sprite';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onTop, P } from './iso3d';
import { fill, path, stroke } from './kit';
import { candle, CLOTH, GOLD, looks, stationSprites } from './stationArt';

/** The chairs and the round table, for the whole sets. */
const STATION = stationSprites as Record<string, SpriteDef>;

// The table designs (owner: "a variety of tables: long, round and more"). Each comes in the same
// four looks as the round table (the tablecloth upgrade: white, cream and gold, red velvet,
// black and gold), so a room of mixed tables still reads as one restaurant.

type Cloth = (typeof CLOTH)[number];

/** A centerpiece for look `t` standing at (x, y) on a top at height z. */
function centerpiece(c: SkCanvas, t: number, x: number, y: number, z: number) {
  if (t === 0) cylinder(c, x, y, 0.05, z, 3, '#E8E2D6', '#FFFFFF');
  if (t === 1) candle(c, x, y, z, 5);
  if (t === 2) {
    cylinder(c, x, y, 0.035, z, 6, '#BFE3FF', '#D6EEFF');
    const [rx, ry] = P(x, y, z + 8);
    c.drawPath(path.smooth([[rx, ry - 3], [rx + 2.6, ry - 0.6], [rx, ry + 1.6], [rx - 2.6, ry - 0.6]]), fill('#E8305A'));
  }
  if (t === 3) {
    cylinder(c, x, y, 0.05, z, 1, GOLD, '#FFE08A');
    box(c, { x, y, z: z + 1, w: 0.025, d: 0.025, h: 6, color: GOLD });
    for (const dy of [-0.08, 0.08]) candle(c, x, y + dy, z + 7, 3.6);
  }
}

/** A cloth-covered top on four legs: `w` x `d` tiles centered at (0, cy). */
function clothTop(c: SkCanvas, s: Cloth, t: number, w: number, d: number, cy: number, rim = true) {
  box(c, { x: 0, y: cy, z: 11, w, d, h: 6, color: s.cloth, shade: { top: s.top }, rim });
  if (t >= 2) box(c, { x: 0, y: cy, z: 11, w: w + 0.01, d: d + 0.01, h: 1.2, color: GOLD });
}

// ---------- a small square table for two: four thin legs, a square cloth, the runner across ----------

const SMALL = 0.62;
const tableSmall = looks('tableSmall', [-30, -48, 30, 14], (c, t) => {
  const s = CLOTH[t]!;
  floorShadow(c, 0, 0, 0.42, 0.3);
  for (const [x, y] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]] as const) {
    box(c, { x, y, w: 0.05, d: 0.05, h: 11, color: t === 3 ? GOLD : '#5A3A2A' });
  }
  clothTop(c, s, t, SMALL, SMALL, 0);
  onTop(c, 17, () => {
    c.drawRect(Skia.XYWHRect(-SMALL / 2, -0.07, SMALL, 0.14), fill(s.runner));
    c.drawRect(Skia.XYWHRect(-SMALL / 2 + 0.03, -SMALL / 2 + 0.03, SMALL - 0.06, SMALL - 0.06), stroke(s.rim, t === 3 ? 0.03 : 0.018));
  });
  centerpiece(c, t, 0.12, -0.16, 17);
});

// ---------- a bigger round table for four: the pedestal table, wider ----------

const tableRoundBig = looks('tableRound4', [-38, -52, 38, 18], (c, t) => {
  const s = CLOTH[t]!;
  floorShadow(c, 0, 0, 0.5, 0.32);
  cylinder(c, 0, 0, 0.2, 0, 2, '#B8892A', GOLD);
  cylinder(c, 0, 0, 0.055, 2, 11, '#3A2430', '#4A3040');
  cylinder(c, 0, 0, 0.47, 11, 6, s.cloth, s.top);
  if (t >= 2) cylinder(c, 0, 0, 0.475, 11, 1.2, GOLD, GOLD);
  onTop(c, 17, () => {
    c.drawCircle(0, 0, 0.43, stroke(s.rim, t === 3 ? 0.04 : 0.02));
    c.drawCircle(0, 0, 0.13, fill(s.runner));
  });
  centerpiece(c, t, 0, 0, 17);
});

// ---------- a long table, two tiles deep. In the world it is two pieces (the back half sorts
// behind the chairs along it, the front half in front of them); the whole one is for menus ----------

const LONG = { w: 0.8, front: 0.45, back: -1.45, seam: -0.5 };

/**
 * One piece of the long table, in the table's own coordinates (its anchor is the front tile's
 * middle; it spans LONG.back..LONG.front along y). The back half is drawn from the tile behind,
 * so everything in it shifts by one tile.
 */
function longHalf(c: SkCanvas, t: number, half: 'back' | 'front' | 'whole') {
  const s = CLOTH[t]!;
  const sh = half === 'back' ? 1 : 0;
  const y0 = (half === 'front' ? LONG.seam : LONG.back) + sh;
  const y1 = (half === 'back' ? LONG.seam : LONG.front) + sh;
  const d = y1 - y0;
  floorShadow(c, 0, (y0 + y1) / 2, half === 'whole' ? 0.75 : 0.5, 0.28);
  // Legs at the far end of the back half, the near end of the front half.
  const legs = half === 'front' ? [0.38] : half === 'back' ? [-1.38] : [-1.38, 0.38];
  for (const y of legs) for (const x of [-0.33, 0.33]) box(c, { x, y: y + sh, w: 0.06, d: 0.06, h: 11, color: t === 3 ? GOLD : '#4A3040' });
  // The back half's top has no bright rim on its near edge: the front half goes on from there.
  clothTop(c, s, t, LONG.w, d, (y0 + y1) / 2, half !== 'back');
  if (half === 'back') c.drawPath(path.polyline([P(LONG.w / 2, y0, 17), P(LONG.w / 2, y1, 17)]), stroke(lighten(s.top, 0.5), 0.7, 0.8));
  onTop(c, 17, () => {
    c.drawRect(Skia.XYWHRect(-0.08, y0, 0.16, d), fill(s.runner));
    c.drawPath(path.polyline([[-LONG.w / 2 + 0.04, y0], [-LONG.w / 2 + 0.04, y1]]), stroke(s.rim, 0.02));
    c.drawPath(path.polyline([[LONG.w / 2 - 0.04, y0], [LONG.w / 2 - 0.04, y1]]), stroke(s.rim, 0.02));
  });
  // Centerpieces down the middle, on the back half (so the front half never cuts them).
  if (half !== 'front') {
    centerpiece(c, t, 0, -1.0 + sh, 17);
    if (t >= 1) centerpiece(c, t, 0, -0.64 + sh, 17);
  }
}

const longBack = looks('tableLongBack', [-34, -58, 34, 30], (c, t) => longHalf(c, t, 'back'));
const longFront = looks('tableLongFront', [-34, -44, 34, 18], (c, t) => longHalf(c, t, 'front'));
const longWhole = looks('tableLong', [-34, -64, 66, 22], (c, t) => longHalf(c, t, 'whole'));

// ---------- booths: two sofas facing each other over a table (owner: "and more") ----------

const BOOTH = [
  { seat: '#B8452E', frame: '#5A2A1E', piping: '#E9A23B' },
  { seat: '#2E8B8B', frame: '#20484A', piping: '#BFE8E0' },
  { seat: '#6A2C8F', frame: '#2A1A30', piping: GOLD },
  { seat: '#1E1A24', frame: '#0E0C12', piping: '#FFD54A' },
] as const;
/** A sofa runs the length of its tile, along y. */
const SOFA_D = 0.86;

/**
 * 'whole': the first side's sofa, its back toward -x; 'seat' and 'rest': the sofa opposite, its
 * back a piece of its own drawn in front of whoever sits there (like the chairs).
 */
function sofa(c: SkCanvas, t: number, part: 'whole' | 'seat' | 'rest') {
  const s = BOOTH[t]!;
  if (part === 'rest') {
    const x = 0.17 - BACKREST_SHIFT;
    box(c, { x, y: 0, z: 0, w: 0.12, d: SOFA_D + 0.04, h: 30, color: s.frame });
    box(c, { x: x - 0.015, y: 0, z: 13, w: 0.1, d: SOFA_D - 0.04, h: 15, color: s.seat, rim: true });
    if (t >= 2) box(c, { x, y: 0, z: 30, w: 0.13, d: SOFA_D + 0.05, h: 1.4, color: s.piping });
    return;
  }
  floorShadow(c, 0, 0, 0.36, 0.26);
  box(c, { x: 0, y: 0, z: 0, w: 0.4, d: SOFA_D + 0.04, h: 9, color: s.frame });
  box(c, { x: 0.01, y: 0, z: 9, w: 0.36, d: SOFA_D - 0.02, h: 4, color: s.seat, rim: true });
  // A seam between the two cushions.
  onTop(c, 13, () => c.drawPath(path.polyline([[-0.17, 0], [0.18, 0]]), stroke(darken(s.seat, 0.3), 0.02)));
  if (part === 'seat') return;
  box(c, { x: -0.17, y: 0, z: 0, w: 0.12, d: SOFA_D + 0.04, h: 30, color: s.frame });
  box(c, { x: -0.155, y: 0, z: 13, w: 0.1, d: SOFA_D - 0.04, h: 15, color: s.seat });
  if (t >= 1) {
    // Tufting on the back, along the cushion.
    for (const y of [-0.28, 0, 0.28]) {
      const [bx, by] = P(-0.1, y, 22);
      c.drawCircle(bx, by, 0.9, fill(darken(s.seat, 0.35)));
    }
  }
  if (t >= 2) box(c, { x: -0.17, y: 0, z: 30, w: 0.13, d: SOFA_D + 0.05, h: 1.4, color: s.piping });
}

const booths = looks('booth', [-24, -60, 24, 18], (c, t) => sofa(c, t, 'whole'));
const boothSeats = looks('boothSeat', [-24, -30, 24, 18], (c, t) => sofa(c, t, 'seat'));
const boothRests = looks('boothRest', [-30, -62, 18, 12], (c, t) => sofa(c, t, 'rest'));

// ---------- whole sets for the menus and the build-mode preview: a table with its seats ----------

/** Draws `f` as if standing at (x, y) of the set. */
function at(c: SkCanvas, x: number, y: number, f: () => void) {
  const [px, py] = P(x, y, 0);
  c.save();
  c.translate(px, py);
  f();
  c.restore();
}

const SETS: Record<string, SpriteDef> = {
  setLong: sprite([-58, -72, 90, 34], (c) => {
    for (const y of [-1.12, 0.12]) at(c, -0.62, y, () => STATION.chair0!.draw(c));
    longHalf(c, 0, 'whole');
    for (const y of [-1.12, 0.12]) at(c, 0.62, y, () => STATION.chairSeat0!.draw(c));
    for (const y of [-1.12, 0.12]) at(c, 0.62 + BACKREST_SHIFT, y, () => STATION.chairRest0!.draw(c));
  }),
  setRound: sprite([-50, -62, 50, 30], (c) => {
    at(c, -0.62, 0, () => STATION.chair0!.draw(c));
    STATION.table0!.draw(c);
    at(c, 0.62, 0, () => STATION.chairSeat0!.draw(c));
    at(c, 0.62 + BACKREST_SHIFT, 0, () => STATION.chairRest0!.draw(c));
  }),
  setSquare: sprite([-50, -62, 50, 30], (c) => {
    at(c, -0.62, 0, () => STATION.chair0!.draw(c));
    tableSmall.tableSmall0!.draw(c);
    at(c, 0.62, 0, () => STATION.chairSeat0!.draw(c));
    at(c, 0.62 + BACKREST_SHIFT, 0, () => STATION.chairRest0!.draw(c));
  }),
  setBooth: sprite([-50, -62, 50, 34], (c) => {
    at(c, -0.62, 0, () => sofa(c, 0, 'whole'));
    tableSmall.tableSmall0!.draw(c);
    at(c, 0.62, 0, () => sofa(c, 0, 'seat'));
    at(c, 0.62 + BACKREST_SHIFT, 0, () => sofa(c, 0, 'rest'));
  }),
};

// ---------- rugs: one under each table (and its chairs), so a room reads as corners of its own
// wherever the tables stand (owner: "a restaurant, not a dining hall") ----------

/** Base, border band, pattern: wine, navy, emerald, cream. */
export const RUG_COLORS = [
  ['#7A1F2E', '#E2B13C', '#F2D48A'],
  ['#1A2D66', '#E2B13C', '#9FB4E8'],
  ['#0E4A35', '#C9A35A', '#8FD6B0'],
  ['#EAD9B2', '#7E1E2A', '#C9A35A'],
] as const;

function rugArt(c: SkCanvas, shape: 'round' | 'rect' | 'long', color: number) {
  const [base, border, accent] = RUG_COLORS[color]!;
  onTop(c, 0, () => {
    if (shape === 'round') {
      c.drawCircle(0, 0, 1.08, fill(darken(base, 0.35), 0.5));
      c.drawCircle(0, 0, 1.04, fill(base));
      c.drawCircle(0, 0, 0.86, stroke(border, 0.12));
      c.drawCircle(0, 0, 0.98, stroke(accent, 0.03));
      c.drawCircle(0, 0, 0.66, stroke(accent, 0.03));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const [x, y] = [Math.cos(a) * 0.76, Math.sin(a) * 0.76];
        c.drawPath(path.poly([[x, y - 0.06], [x + 0.06, y], [x, y + 0.06], [x - 0.06, y]]), fill(accent, 0.8));
      }
      return;
    }
    const y0 = shape === 'long' ? -1.6 : -0.62;
    const y1 = 0.62;
    const rr = (inset: number) => Skia.RRectXY(Skia.XYWHRect(-1.25 + inset, y0 + inset, 2.5 - inset * 2, y1 - y0 - inset * 2), 0.1, 0.1);
    c.drawRRect(rr(-0.04), fill(darken(base, 0.35), 0.5));
    c.drawRRect(rr(0), fill(base));
    c.drawRRect(rr(0.2), stroke(border, 0.14));
    c.drawRRect(rr(0.08), stroke(accent, 0.03));
    c.drawRRect(rr(0.34), stroke(accent, 0.03));
    // Fringes on the two short ends.
    for (let y = y0 + 0.08; y < y1 - 0.04; y += 0.14) {
      c.drawRect(Skia.XYWHRect(-1.36, y, 0.11, 0.045), fill(lighten(base, 0.25)));
      c.drawRect(Skia.XYWHRect(1.25, y, 0.11, 0.045), fill(lighten(base, 0.25)));
    }
  });
}

const RUGS: Record<string, SpriteDef> = Object.fromEntries(
  RUG_COLORS.flatMap((_, k) => [
    [`rugRound${k}`, sprite([-52, -28, 52, 28], (c) => rugArt(c, 'round', k))],
    [`rugRect${k}`, sprite([-66, -34, 66, 34], (c) => rugArt(c, 'rect', k))],
    [`rugLong${k}`, sprite([-66, -50, 96, 34], (c) => rugArt(c, 'long', k))],
  ]),
);

export const tableSprites = { ...RUGS, ...tableSmall, ...tableRoundBig, ...longBack, ...longFront, ...longWhole, ...booths, ...boothSeats, ...boothRests, ...SETS };
