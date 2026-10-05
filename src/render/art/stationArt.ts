import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { HALF_H, HALF_W } from '../iso';
import { sprite, type SpriteDef } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onFaceX, onTop, P, rectIn } from './iso3d';
import { fill, glowStroke, path, stroke, type Pt } from './kit';
import { palmFronds } from './propArt';

// Upgradeable stations, each in four looks: base, then level 10, 25 and 50 milestones. The
// look tells the story of the upgrade (a second basin, a dishwasher, a pro range...), so the
// player SEES what they bought. Past the last look, the renderer adds a golden aura instead.

export const LOOKS = 4;
const GOLD = '#E2B13C';
const STEEL = '#AEB8C4';
const STEEL_DARK = '#7E8A98';
const VELVET = '#C8202E';

/** `name0`..`name3` sprites from one parametric drawing. */
function looks(name: string, bounds: SpriteDef['bounds'], draw: (c: SkCanvas, t: number) => void): Record<string, SpriteDef> {
  return Object.fromEntries(Array.from({ length: LOOKS }, (_, t) => [`${name}${t}`, sprite(bounds, (c) => draw(c, t))]));
}

/** Pixel art on a wall plane facing +y (skewed along x): the neon board hangs here. */
function onWallY(c: SkCanvas, draw: () => void) {
  c.save();
  c.concat(Skia.Matrix([1, 0, 0, HALF_H / HALF_W, 1, 0, 0, 0, 1]));
  draw();
  c.restore();
}

// ---------- stove: steel -> chrome with gold -> red enamel 3-burner -> black & gold pro range ----------

const STOVE = [
  { body: STEEL, back: STEEL_DARK, knob: '#E5483B', trim: null },
  { body: '#C4CDD8', back: '#8F9AA8', knob: GOLD, trim: GOLD },
  { body: '#C8302A', back: '#E9E4DC', knob: GOLD, trim: '#D8DEE5' },
  { body: '#26232E', back: '#3A3646', knob: GOLD, trim: GOLD },
] as const;

const stoves = looks('stove', [-44, -76, 44, 14], (c, t) => {
  const s = STOVE[t]!;
  floorShadow(c, 0.1, 0, 0.9, 0.3);
  box(c, { x: 0, y: 0, w: 0.86, d: 1.86, h: 20, color: s.body, rim: true });
  // Trim bands go under the top so only their edge shows.
  if (s.trim) box(c, { x: 0, y: 0, z: 19, w: 0.9, d: 1.9, h: 1.2, color: s.trim });
  box(c, { x: 0, y: 0, z: 20, w: 0.88, d: 1.88, h: 2, color: t >= 2 ? '#D8DEE5' : s.body, rim: true });
  box(c, { x: -0.39, y: 0, z: 22, w: 0.08, d: 1.86, h: t >= 2 ? 20 : 15, color: s.back, rim: true });
  if (t >= 2) box(c, { x: -0.39, y: 0, z: 42, w: 0.1, d: 1.9, h: 1.6, color: GOLD });
  for (const y of [-0.45, 0.45]) cylinder(c, 0.05, y, 0.27, 22, 0.8, '#2B2F38', '#3A404C');
  if (t >= 2) cylinder(c, -0.2, 0, 0.12, 22, 0.8, '#2B2F38', '#3A404C');
  onFaceX(c, 0.43, 0.93, () => {
    rectIn(c, 0.12, 3.5, 1.62, 11, t === 3 ? '#14121A' : '#2B2F38');
    rectIn(c, 0.2, 5, 1.46, 8, t === 3 ? '#5A3020' : '#3D4452');
    if (t === 3) rectIn(c, 0.24, 6, 1.38, 6, '#8A4A22');
    rectIn(c, 0.12, 15.6, 1.62, 1.4, t >= 1 ? GOLD : '#E9EEF3');
    const knobs = t >= 2 ? [0.2, 0.42, 0.93, 1.44, 1.66] : [0.2, 0.42, 1.44, 1.66];
    for (const a of knobs) rectIn(c, a - 0.045, 17.6, 0.09, 2.6, s.knob);
  });
});

// ---------- sink: teal basin -> gold fittings -> two basins -> dishwasher machine ----------

const SINK = ['#2C8F87', '#2C8F87', '#2D4E8F', '#9AA6B4'] as const;

const sinks = looks('sink', [-44, -64, 44, 14], (c, t) => {
  const body = SINK[t]!;
  floorShadow(c, 0.1, 0, 0.9, 0.3);
  box(c, { x: 0, y: 0, w: 0.86, d: 1.86, h: 21, color: body });
  onFaceX(c, 0.43, 0.93, () => {
    if (t === 3) {
      // Dishwasher: a porthole door full of sudsy water, a control strip with green lights.
      rectIn(c, 0.08, 2.5, 0.84, 16, '#B9C3CE');
      rectIn(c, 0.98, 2.5, 0.8, 16, lighten(body, 0.12));
      for (const a of [1.12, 1.28, 1.44]) rectIn(c, a, 15, 0.08, 2, '#3DDC6A');
    } else {
      rectIn(c, 0.1, 2.5, 0.78, 15, lighten(body, 0.1));
      rectIn(c, 0.98, 2.5, 0.78, 15, lighten(body, 0.1));
      const handle = t >= 1 ? GOLD : '#C9D1D9';
      rectIn(c, 0.8, 9, 0.06, 2.4, handle);
      rectIn(c, 1.0, 9, 0.06, 2.4, handle);
    }
  });
  if (t === 3) {
    const [cx, cy] = P(0.43, 0.43, 10.5);
    c.save();
    c.translate(cx, cy);
    c.scale(1, 1.12);
    c.drawCircle(0, 0, 6.6, fill('#5E6878'));
    c.drawCircle(0, 0, 5.2, fill('#6FC3EC'));
    c.drawCircle(-1.6, -1.2, 1.4, fill('#E8F7FF', 0.85));
    c.drawCircle(1.4, 1, 0.9, fill('#E8F7FF', 0.85));
    c.restore();
  }
  if (t >= 1) box(c, { x: 0, y: 0, z: 20.2, w: 0.9, d: 1.9, h: 0.8, color: GOLD });
  box(c, { x: 0, y: 0, z: 21, w: 0.88, d: 1.88, h: 1.6, color: t >= 1 ? '#E4E9EE' : '#D8DEE5', rim: true });
  onTop(c, 22.6, () => {
    const basin = (y0: number, d: number) => {
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.28, y0, 0.58, d), 0.08, 0.08), fill('#6C7886'));
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.24, y0 + 0.04, 0.5, d - 0.08), 0.06, 0.06), fill('#8FD0F0'));
    };
    if (t >= 2) {
      basin(-0.42, 0.4);
      basin(0.02, 0.4);
    } else basin(-0.42, 0.84);
  });
  const tap = t >= 1 ? GOLD : '#C9D1D9';
  box(c, { x: -0.36, y: 0, z: 22.6, w: 0.06, d: 0.06, h: t >= 1 ? 12 : 9, color: tap });
  box(c, { x: -0.25, y: 0, z: t >= 1 ? 32.6 : 29.6, w: 0.22, d: 0.05, h: 2, color: tap });
  if (t >= 1) box(c, { x: -0.32, y: -0.8, z: 22.6, w: 0.08, d: 0.08, h: 7, color: '#3FA65A', rim: true });
});

// ---------- fridge: single door -> double door -> retro mint -> black glass display ----------

const fridges = looks('fridge', [-30, -86, 30, 12], (c, t) => {
  floorShadow(c, 0.08, 0, 0.55, 0.3);
  const body = ['#C7D0DA', '#D3DAE2', '#8FD9C4', '#24222C'][t]!;
  box(c, { x: 0, y: 0, w: 0.8, d: 0.8, h: t === 2 ? 56 : 54, color: body, rim: true });
  if (t === 2) box(c, { x: 0, y: 0, z: 56, w: 0.7, d: 0.7, h: 2, color: lighten(body, 0.2) });
  onFaceX(c, 0.4, 0.4, () => {
    const handle = t === 0 ? '#5E6878' : t === 2 ? '#E4E9EE' : GOLD;
    if (t === 3) {
      // Glass door with lit shelves of colorful jars.
      rectIn(c, 0.06, 6, 0.68, 44, '#2E4A66');
      for (let b = 12; b < 48; b += 9) {
        rectIn(c, 0.06, b, 0.68, 0.8, '#8FD3FF');
        for (const [a, col] of [[0.14, '#E5483B'], [0.32, '#F2C14E'], [0.5, '#7BC67E']] as const) rectIn(c, a, b + 0.8, 0.1, 4, col);
      }
      rectIn(c, 0.04, 6, 0.02, 44, GOLD);
      rectIn(c, 0.74, 6, 0.02, 44, GOLD);
      rectIn(c, 0.64, 22, 0.05, 14, handle);
      return;
    }
    if (t === 1) {
      rectIn(c, 0.39, 2, 0.02, 50, darken(body, 0.25));
      rectIn(c, 0.3, 24, 0.05, 12, handle);
      rectIn(c, 0.45, 24, 0.05, 12, handle);
    } else {
      rectIn(c, 0.02, 33, 0.76, 0.8, STEEL_DARK);
      rectIn(c, 0.62, 18, 0.05, 12, handle);
      rectIn(c, 0.62, 37, 0.05, 10, handle);
    }
    rectIn(c, 0.12, 22, 0.08, 3, '#E5483B');
    rectIn(c, 0.18, 40, 0.08, 3, '#F2C14E');
    rectIn(c, 0.1, 44, 0.08, 3, '#47B2BE');
    if (t === 2) c.drawCircle(0.2, 50, 2.2, fill('#E5483B'));
  });
});

// ---------- tables: white cloth -> cream & gold with a candle -> red velvet & a rose -> black & gold candelabra ----------

const CLOTH = [
  { cloth: '#F1EBE1', top: '#FFFFFF', runner: VELVET, rim: GOLD },
  { cloth: '#EFE2C6', top: '#FFF6E2', runner: GOLD, rim: '#B8892A' },
  { cloth: '#8E1424', top: '#B3202E', runner: '#F4D58A', rim: GOLD },
  { cloth: '#1E1A24', top: '#2E2836', runner: GOLD, rim: '#FFE08A' },
] as const;

function candle(c: SkCanvas, x: number, y: number, z: number, h: number) {
  cylinder(c, x, y, 0.025, z, h, '#F4EEE2', '#FFFFFF');
  const [fx, fy] = P(x, y, z + h + 2.4);
  c.drawPath(path.smooth([[fx, fy - 2.6], [fx + 1.2, fy], [fx, fy + 1], [fx - 1.2, fy]]), fill('#FFB42A'));
}

const tables = looks('table', [-32, -50, 32, 14], (c, t) => {
  const s = CLOTH[t]!;
  floorShadow(c, 0, 0, 0.42, 0.32);
  cylinder(c, 0, 0, 0.17, 0, 2, '#B8892A', GOLD);
  cylinder(c, 0, 0, 0.045, 2, 11, '#3A2430', '#4A3040');
  cylinder(c, 0, 0, 0.39, 11, 6, s.cloth, s.top);
  if (t >= 2) cylinder(c, 0, 0, 0.395, 11, 1.2, GOLD, GOLD);
  onTop(c, 17, () => {
    c.drawCircle(0, 0, 0.36, stroke(s.rim, t === 3 ? 0.04 : 0.02));
    c.drawRect(Skia.XYWHRect(-0.28, -0.08, 0.56, 0.16), fill(s.runner));
    c.drawRect(Skia.XYWHRect(-0.28, -0.08, 0.56, 0.16), stroke(s.rim, 0.02));
  });
  if (t === 1) candle(c, 0.16, -0.2, 17, 5);
  if (t === 2) {
    cylinder(c, 0.16, -0.2, 0.035, 17, 6, '#BFE3FF', '#D6EEFF');
    const [rx, ry] = P(0.16, -0.2, 25);
    c.drawPath(path.smooth([[rx, ry - 3], [rx + 2.6, ry - 0.6], [rx, ry + 1.6], [rx - 2.6, ry - 0.6]]), fill('#E8305A'));
    c.drawPath(path.polyline([[rx, ry + 1.4], [rx, ry + 4]]), stroke('#2E8B47', 0.9));
  }
  if (t === 3) {
    cylinder(c, 0.16, -0.2, 0.05, 17, 1, GOLD, '#FFE08A');
    box(c, { x: 0.16, y: -0.2, z: 18, w: 0.025, d: 0.025, h: 6, color: GOLD });
    box(c, { x: 0.16, y: -0.2, z: 23, w: 0.03, d: 0.22, h: 1, color: GOLD });
    for (const dy of [-0.1, 0, 0.1]) candle(c, 0.16, -0.2 + dy, 24, dy === 0 ? 5 : 3.6);
  }
});

// ---------- chairs: red velvet -> tufted -> tall purple velvet -> gold throne ----------

const CHAIR = [
  { frame: GOLD, leg: '#9C7A2A', seat: VELVET, back: 20 },
  { frame: GOLD, leg: '#9C7A2A', seat: VELVET, back: 20 },
  { frame: '#D9A93A', leg: '#7A5A1E', seat: '#6A2C8F', back: 26 },
  { frame: '#FFD54A', leg: GOLD, seat: '#B3202E', back: 28 },
] as const;

const chairs = looks('chair', [-20, -54, 20, 10], (c, t) => {
  const s = CHAIR[t]!;
  floorShadow(c, 0, 0, 0.26, 0.25);
  for (const [x, y] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]] as const) {
    box(c, { x, y, w: 0.04, d: 0.04, h: 9, color: s.leg });
    if (t >= 1) box(c, { x, y, w: 0.05, d: 0.05, h: 1.2, color: GOLD });
  }
  box(c, { x: -0.16, y: 0, z: 9, w: 0.06, d: 0.36, h: s.back, color: s.frame });
  box(c, { x: -0.15, y: 0, z: 12, w: 0.06, d: 0.3, h: s.back - 5, color: s.seat });
  if (t >= 1) {
    // Tufting buttons on the backrest (drawn on its +x face).
    onFaceX(c, -0.12, 0.15, () => {
      for (const [a, b] of [[0.08, 16], [0.22, 16], [0.15, 22], [0.08, 28], [0.22, 28]] as const) {
        if (b < 9 + s.back - 4) c.drawCircle(a, b, 0.012 * 32, fill(darken(s.seat, 0.35)));
      }
    });
  }
  if (t === 3) {
    for (const y of [-0.15, 0.15]) {
      const [x0, y0] = P(-0.16, y, 9 + s.back + 3);
      c.drawCircle(x0, y0, 1.8, fill('#FFE08A'));
      c.drawCircle(x0, y0, 1.8, stroke('#B8892A', 0.6));
    }
  }
  box(c, { x: 0, y: 0, z: 9, w: 0.36, d: 0.36, h: 2, color: s.frame });
  box(c, { x: 0.01, y: 0, z: 11, w: 0.32, d: 0.32, h: 2.5, color: s.seat, rim: true });
});

// ---------- plants: pots get fancier and the plants fuller ----------

const POT = [
  { body: GOLD, top: '#4A3A2A', band: '#B8892A' },
  { body: '#22202A', top: '#3A2A1E', band: GOLD },
  { body: '#EDE8E2', top: '#3A2A1E', band: GOLD },
  { body: '#FFD54A', top: '#3A2A1E', band: '#E5483B' },
] as const;

function pot(c: SkCanvas, t: number, h: number) {
  const s = POT[t]!;
  cylinder(c, 0, 0, 0.17, 0, h, s.body, s.top);
  cylinder(c, 0, 0, 0.18, h - 3, 2.4, s.band, lighten(s.band, 0.2));
  if (t === 3) {
    const [gx, gy] = P(0.12, 0.12, h * 0.45);
    c.drawPath(path.poly([[gx, gy - 2.4], [gx + 1.8, gy], [gx, gy + 2.4], [gx - 1.8, gy]]), fill('#59D8FF'));
  }
}

const palms = looks('plantPalm', [-34, -90, 34, 12], (c, t) => {
  floorShadow(c, 0, 0, 0.3, 0.28);
  pot(c, t, 13);
  const trunk = 6 + t;
  for (let i = 0; i < trunk; i++) box(c, { x: 0.004 * i, y: 0, z: 13 + i * 6, w: 0.07, d: 0.07, h: 6, color: i % 2 ? '#8A6239' : '#7A5430' });
  const top = P(0.004 * trunk, 0, 13 + trunk * 6 - 4);
  palmFronds(c, top, 24 + t * 3);
  if (t >= 2) for (const dx of [-2.2, 2.2]) c.drawCircle(top[0] + dx, top[1] + 3, 2, fill('#6B4426'));
});

const bushes = looks('plantBush', [-28, -66, 28, 12], (c, t) => {
  floorShadow(c, 0, 0, 0.3, 0.28);
  pot(c, t, 14);
  const grow = 1 + t * 0.1;
  for (const [x, y, z, s, col] of [[0, 0, 14, 0.3, '#2E8B47'], [0.06, -0.05, 24, 0.22, '#3FA65A'], [-0.05, 0.06, 22, 0.2, '#36994F'], [0, 0, 31, 0.14, '#4CBB66']] as const) {
    box(c, { x, y, z: 14 + (z - 14) * grow, w: s * grow, d: s * grow, h: s * 50 * grow, color: col });
  }
  if (t >= 2) {
    for (const [x, y, z] of [[0.12, 0.1, 24], [-0.1, 0.14, 30], [0.14, -0.08, 34]] as const) {
      const [fx, fy] = P(x, y, z * grow);
      c.drawCircle(fx, fy, 2.2, fill(t === 3 ? '#FFD54A' : '#FF6FA8'));
      c.drawCircle(fx, fy, 0.9, fill('#FFF4E3'));
    }
  }
});

// ---------- neon sign: a burger -> + underline -> marquee bulbs -> two-tone with a crown ----------

const NEON = '#FF4FA0';
function neonArt(c: SkCanvas, lit: boolean, t: number) {
  const tube = (p: ReturnType<typeof path.smooth>, color: string) => {
    if (lit) c.drawPath(p, glowStroke(color, 5, 0.55, 3));
    c.drawPath(p, stroke(lit ? lighten(color, 0.6) : darken(color, 0.45), 1.6));
  };
  const bun = t === 3 ? '#FFD54A' : NEON;
  tube(path.smooth([[-14, -18], [-11, -27], [0, -30.4], [11, -27], [14, -18]], false), bun);
  tube(path.smooth([[-15, -14.6], [-5, -12.6], [5, -15.6], [15, -13.6]], false), '#59FF9E');
  tube(path.smooth([[-14, -10], [0, -9.4], [14, -10], [12, -6], [-12, -6], [-14, -10]], false), bun);
  if (t >= 1) tube(path.polyline([[-22, -1.5], [22, -1.5]]), '#4FD8FF');
  for (const [x, y] of [[-26, -26], [26, -28], [24, -9], [-25, -8]] as const) {
    tube(path.poly([[x, y - 3], [x + 0.9, y - 0.9], [x + 3, y], [x + 0.9, y + 0.9], [x, y + 3], [x - 0.9, y + 0.9], [x - 3, y], [x - 0.9, y - 0.9]]), '#FFD86B');
  }
  if (t === 3) tube(path.polyline([[-8, -34], [-5, -40], [0, -35], [5, -40], [8, -34]]), '#FFD54A');
  if (t >= 2) {
    // Marquee bulbs around the frame.
    for (let i = 0; i <= 12; i++) {
      for (const y of [-38, 2]) {
        const x = -38 + i * (76 / 12);
        if (lit) c.drawCircle(x, y, 2.6, glowStroke('#FFE58A', 1.5, 0.6, 1.6));
        c.drawCircle(x, y, 1.3, fill(lit ? '#FFF6C8' : '#7A6A3A'));
      }
    }
  }
}
const neonBoards = looks('neonBoard', [-50, -76, 50, 30], (c, t) =>
  onWallY(c, () => {
    const h = t >= 2 ? 44 : 36;
    const top = t >= 2 ? -42 : -38;
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-40, top, 80, h), 6, 6), fill('#1C1424'));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-40, top, 80, h), 6, 6), stroke(t >= 1 ? '#FFD54A' : GOLD, t >= 1 ? 2.6 : 1.6));
    neonArt(c, false, t);
  }),
);
const neonLits = looks('neonLit', [-50, -76, 50, 30], (c, t) => onWallY(c, () => neonArt(c, true, t)));

/** Menu icon for the neon sign: the lit board seen straight on. */
const neonIcon = sprite([-42, -44, 42, 6], (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-40, -38, 80, 36), 6, 6), fill('#1C1424'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-40, -38, 80, 36), 6, 6), stroke(GOLD, 2));
  neonArt(c, true, 0);
});

// ---------- street sign by the door: chalkboard -> gold frame & bulb -> light box -> marquee pole ----------

/** A line-drawn burger on a face plane, centered at (a, b); `k` = size (1 = 16 px wide). */
function chalkBurger(c: SkCanvas, a: number, b: number, k: number, color: string) {
  const ink = stroke(color, 1.6);
  c.save();
  c.translate(a, b);
  // Face planes run 1 tile (32 px) per unit along a and 1 px along b: undo that for px drawing.
  c.scale(k / 32, -k);
  c.drawPath(path.smooth([[-8, 0], [-6, 6], [0, 8], [6, 6], [8, 0]], false), ink);
  c.drawPath(path.polyline([[-8, -1.5], [8, -1.5]]), ink);
  c.drawPath(path.polyline([[-8, -4], [8, -4]]), ink);
  c.drawPath(path.polyline([[-7, -6.5], [7, -6.5]]), ink);
  c.restore();
}

const streetSigns = looks('streetSign', [-30, -104, 30, 10], (c, t) => {
  floorShadow(c, 0, 0, 0.25, 0.25);
  if (t <= 1) {
    const frame = t === 1 ? GOLD : '#8E5A3C';
    for (const y of [-0.22, 0.22]) box(c, { x: 0, y, w: 0.05, d: 0.05, h: 36, color: frame });
    box(c, { x: 0, y: 0, z: 10, w: 0.06, d: 0.5, h: 26, color: frame, rim: true });
    onFaceX(c, 0.031, 0.25, () => {
      rectIn(c, 0.04, 12, 0.42, 22, '#24302A');
      rectIn(c, 0.08, 30, 0.34, 1.2, '#F2C14E');
    });
    onFaceX(c, 0.031, 0.25, () => chalkBurger(c, 0.25, 22, 0.6, '#F4EEE2'));
    if (t === 1) {
      box(c, { x: 0, y: 0, z: 36, w: 0.04, d: 0.04, h: 6, color: GOLD });
      const [bx, by] = P(0, 0, 45);
      c.drawCircle(bx, by, 3.4, fill('#FFE58A'));
      c.drawCircle(bx, by, 3.4, stroke('#B8892A', 0.8));
    }
    return;
  }
  // A pole with a lit box (t2) or a marquee board with a star (t3).
  box(c, { x: 0, y: 0, w: 0.14, d: 0.14, h: 3, color: '#2E2B38' });
  box(c, { x: 0, y: 0, z: 3, w: 0.05, d: 0.05, h: t === 3 ? 48 : 40, color: '#3A3646' });
  const z0 = t === 3 ? 48 : 40;
  const h = t === 3 ? 30 : 24;
  box(c, { x: 0, y: 0, z: z0, w: 0.12, d: 0.8, h, color: t === 3 ? '#B3202E' : '#E5483B', rim: true });
  onFaceX(c, 0.061, 0.4, () => {
    rectIn(c, 0.06, z0 + 3, 0.68, h - 6, t === 3 ? '#1C1424' : '#FFF4E3');
    if (t === 3) {
      for (let i = 0; i <= 8; i++) {
        for (const b of [z0 + 1.6, z0 + h - 1.6]) c.drawRect(Skia.XYWHRect(0.03 + i * 0.09, b - 0.8, 0.03, 1.6), fill('#FFE58A'));
      }
    }
  });
  onFaceX(c, 0.061, 0.4, () => chalkBurger(c, 0.4, z0 + h / 2, 1, t === 3 ? '#FFD54A' : '#B3202E'));
  if (t === 3) {
    const [sx, sy] = P(0, 0, z0 + h + 7);
    const star = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? 6 : 2.6;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      return [sx + Math.cos(a) * r, sy + Math.sin(a) * r] as Pt;
    });
    c.drawPath(path.poly(star), fill('#FFD54A'));
    c.drawPath(path.poly(star), stroke('#B8892A', 0.8));
  }
});

// ---------- plates and dishes ----------

const RIM = ['#F7F9FB', '#4F8FE0', GOLD, GOLD] as const;

const plateSingles = looks('plateSingle', [-12, -6, 12, 6], (c, t) => {
  cylinder(c, 0, 0, 0.14, 0, 1.6, '#DDE2E8', '#F7F9FB');
  if (t === 0) return;
  onTop(c, 1.6, () => {
    c.drawCircle(0, 0, 0.12, stroke(RIM[t]!, 0.022));
    if (t === 3) c.drawCircle(0, 0, 0.07, stroke(GOLD, 0.012));
  });
});

/** Menu icon for plates: a short stack. */
const plateStack = sprite([-12, -16, 12, 6], (c) => {
  for (let i = 0; i < 5; i++) cylinder(c, 0, 0, 0.14, i * 2.2, 1.6, '#DDE2E8', '#F7F9FB');
});

function plateBase(c: SkCanvas, t: number) {
  if (t >= 2) box(c, { x: 0, y: 0, w: 0.3, d: 0.3, h: 1.4, color: '#B07A4A', rim: true });
  const z = t >= 2 ? 1.4 : 0;
  cylinder(c, 0, 0, 0.13, z, 1.2, t === 3 ? '#E8C46A' : '#DDE2E8', t === 3 ? '#FFF1C2' : '#FFFFFF');
  return z + 1.2;
}

const friesPlates = looks('plateFries', [-16, -22, 16, 6], (c, t) => {
  const z = plateBase(c, t);
  const cup = t === 3 ? GOLD : '#D8342C';
  box(c, { x: 0, y: 0, z, w: 0.09, d: 0.09, h: 6, color: cup });
  for (const [x, y, h] of [[-0.02, -0.02, 4], [0.02, 0.01, 5], [0, 0.03, 3.5], [0.03, -0.03, 4.5], ...(t >= 1 ? ([[-0.03, 0.02, 5.5]] as const) : [])] as const) {
    box(c, { x, y, z: z + 6, w: 0.022, d: 0.022, h, color: '#F6C945' });
  }
  if (t >= 1) cylinder(c, 0.08, 0.08, 0.035, z, 2.2, '#F4EEE2', '#D8342C');
  if (t === 3) box(c, { x: -0.03, y: 0.03, z: z + 10, w: 0.01, d: 0.01, h: 6, color: GOLD });
});

function burger(c: SkCanvas, x: number, y: number, z: number, s: number, t: number) {
  const bun = t === 3 ? '#E8B84A' : '#E9A55B';
  box(c, { x, y, z, w: 0.1 * s, d: 0.1 * s, h: 1.6 * s, color: bun });
  box(c, { x, y, z: z + 1.6 * s, w: 0.105 * s, d: 0.105 * s, h: 1.4 * s, color: '#6B3A22' });
  let top = z + 3 * s;
  if (t >= 1) {
    box(c, { x, y, z: top, w: 0.112 * s, d: 0.112 * s, h: 0.5 * s, color: '#F7C531' });
    top += 0.5 * s;
  }
  if (t >= 2) {
    box(c, { x, y, z: top, w: 0.105 * s, d: 0.105 * s, h: 1.2 * s, color: '#6B3A22' });
    top += 1.2 * s;
  }
  box(c, { x, y, z: top, w: 0.11 * s, d: 0.11 * s, h: 0.6 * s, color: '#7BC67E' });
  box(c, { x, y, z: top + 0.6 * s, w: 0.1 * s, d: 0.1 * s, h: 2.2 * s, color: t === 3 ? '#F4CF5A' : '#F0B46A' });
  if (t >= 2) {
    box(c, { x, y, z: top + 2.8 * s, w: 0.008, d: 0.008, h: 5, color: '#E8DCC8' });
    const [fx, fy] = P(x, y, top + 2.8 * s + 5);
    c.drawRect(Skia.XYWHRect(fx, fy - 1, 3.2, 2), fill(t === 3 ? GOLD : '#E5483B'));
  }
}

const burgerPlates = looks('plateBurger', [-16, -24, 16, 6], (c, t) => {
  const z = plateBase(c, t);
  burger(c, 0, 0, z, 1 + t * 0.08, t);
  if (t >= 2) for (const [x, y] of [[0.07, 0.08], [0.09, 0.05]] as const) box(c, { x, y, z, w: 0.018, d: 0.018, h: 3, color: '#F6C945' });
});

/** The floor spot of a table you can buy: a dashed outline around table + chair. */
const tableSlot = sprite([-58, -30, 40, 22], (c) =>
  onTop(c, 0, () => {
    const r = Skia.RRectXY(Skia.XYWHRect(-1.1, -0.46, 1.56, 0.92), 0.18, 0.18);
    c.drawRRect(r, fill('#FFFFFF', 0.12));
    const dash = stroke('#FFF4E3', 0.045, 0.85);
    dash.setPathEffect(Skia.PathEffect.MakeDash([0.14, 0.09], 0));
    c.drawRRect(r, dash);
  }),
);

/** The floor spot of a stove you can buy: a dashed outline along the cooking line. */
const stoveSlot = sprite([-44, -30, 44, 30], (c) =>
  onTop(c, 0, () => {
    const r = Skia.RRectXY(Skia.XYWHRect(-0.46, -0.96, 0.92, 1.92), 0.14, 0.14);
    c.drawRRect(r, fill('#FFFFFF', 0.14));
    const dash = stroke('#FFF4E3', 0.045, 0.85);
    dash.setPathEffect(Skia.PathEffect.MakeDash([0.14, 0.09], 0));
    c.drawRRect(r, dash);
  }),
);

export const stationSprites = {
  ...stoves,
  ...sinks,
  ...fridges,
  ...tables,
  ...chairs,
  ...palms,
  ...bushes,
  ...neonBoards,
  ...neonLits,
  ...streetSigns,
  ...plateSingles,
  ...friesPlates,
  ...burgerPlates,
  neonIcon,
  plateStack,
  tableSlot,
  stoveSlot,
};
