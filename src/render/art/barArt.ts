import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import type { SpriteDef } from '../sprite';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onTop, P } from './iso3d';
import { fill, path, stroke } from './kit';
import { GOLD, looks } from './stationArt';

// The bar (owner: "a bar from the first moment that grows with the stages"): its counter in
// pieces that join (along y, along x, the two corners), in four looks like every station (the
// counter upgrade: plain wood, dark wood with a marble top, velvet with black granite, black
// and gold), the stools, the drinks and what the bartenders and waiters hold.

const BAR = [
  { body: '#8A5530', top: '#B57A45', trim: '#5E3820', rail: '#C9A35A' },
  { body: '#4A2C1E', top: '#E9E4DC', trim: '#2E1A12', rail: GOLD },
  { body: '#6A1E3A', top: '#2E2836', trim: GOLD, rail: GOLD },
  { body: '#1E1A24', top: '#2A2430', trim: '#FFD54A', rail: '#FFD54A' },
] as const;
type Look = (typeof BAR)[number];

/** The counter's body (px high) and top slab; tops overhang toward the guests. */
const H = 21;
const TOP = 3;
const BODY = 0.5;

/** One block of counter: body, panels on the face the camera sees, the top slab, a foot rail. */
function block(c: SkCanvas, s: Look, t: number, x0: number, x1: number, y0: number, y1: number) {
  const w = x1 - x0;
  const d = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  box(c, { x: cx, y: cy, w, d, h: H, color: s.body });
  // Padding or panels: darker bands down the faces.
  if (t === 2) {
    for (let k = 1; k < 4; k++) {
      c.drawPath(path.polyline([P(x1, y0 + (d * k) / 4, 3), P(x1, y0 + (d * k) / 4, H - 2)]), stroke(darken(s.body, 0.35), 0.8));
      c.drawPath(path.polyline([P(x0 + (w * k) / 4, y1, 3), P(x0 + (w * k) / 4, y1, H - 2)]), stroke(darken(s.body, 0.35), 0.8));
    }
  } else {
    c.drawPath(path.polyline([P(x1, y0 + 0.06, H - 4), P(x1, y1 - 0.06, H - 4)]), stroke(s.trim, 0.9));
    c.drawPath(path.polyline([P(x0 + 0.06, y1, H - 4), P(x1 - 0.06, y1, H - 4)]), stroke(s.trim, 0.9));
  }
  // The kick at the floor, and a brass rail for the feet on the guests' sides.
  box(c, { x: cx, y: cy, w: w + 0.01, d: d + 0.01, h: 2.5, color: darken(s.body, 0.3) });
}

function slab(c: SkCanvas, s: Look, t: number, x0: number, x1: number, y0: number, y1: number) {
  box(c, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: H, w: x1 - x0, d: y1 - y0, h: TOP, color: s.top, rim: true });
  if (t >= 1) box(c, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: H, w: x1 - x0 + 0.01, d: y1 - y0 + 0.01, h: 0.9, color: s.trim });
}

/** A brass foot rail along x (at `y`) or along y (at `x`). */
function rail(c: SkCanvas, s: Look, a: [number, number], b: [number, number]) {
  c.drawPath(path.polyline([P(a[0], a[1], 4), P(b[0], b[1], 4)]), stroke(s.rail, 1.4));
}

/** Bottles and glasses on a shelf: the inside of the counter, seen past the bartenders. */
function bottles(c: SkCanvas, x0: number, x1: number, y: number) {
  const colors = ['#2E8B47', '#C8642A', '#5B8EDB', '#E8C14E', '#9E2E4A'];
  let k = 0;
  for (let x = x0 + 0.08; x < x1 - 0.04; x += 0.12, k++) {
    const col = colors[k % colors.length]!;
    cylinder(c, x, y, 0.035, H + TOP, 7 + (k % 2) * 2, darken(col, 0.15), lighten(col, 0.1));
    cylinder(c, x, y, 0.015, H + TOP + 7 + (k % 2) * 2, 3, '#2A2430', '#3A3446');
  }
}

/** variant 0: along y (the long side), 1: the back side (along x, bottles on the inside), 2: the
 * back corner, 3: the front corner, 4: the front side (along x, the guests' face to the camera). */
function counter(c: SkCanvas, t: number, variant: number) {
  const s = BAR[t]!;
  const half = BODY / 2;
  floorShadow(c, 0, 0, 0.5, 0.22);
  if (variant === 0) {
    block(c, s, t, -half, half, -0.5, 0.5);
    slab(c, s, t, -half, half + 0.12, -0.5, 0.5);
    rail(c, s, [half + 0.08, -0.5], [half + 0.08, 0.5]);
  } else if (variant === 1 || variant === 4) {
    block(c, s, t, -0.5, 0.5, -half, half);
    slab(c, s, t, -0.5, 0.5, -half - (variant === 1 ? 0.12 : 0), half + (variant === 4 ? 0.12 : 0));
    if (variant === 1) bottles(c, -0.5, 0.5, half - 0.06);
    else rail(c, s, [-0.5, half + 0.08], [0.5, half + 0.08]);
  } else if (variant === 2) {
    // Joins the back side (toward -x) and the long side (toward +y).
    block(c, s, t, -0.5, half, -half, half);
    block(c, s, t, -half, half, -half, 0.5);
    slab(c, s, t, -0.5, half + 0.12, -half - 0.12, half);
    slab(c, s, t, -half, half + 0.12, half, 0.5);
    rail(c, s, [half + 0.08, -half], [half + 0.08, 0.5]);
  } else {
    // Joins the long side (toward -y) and the front side (toward -x).
    block(c, s, t, -half, half, -0.5, half);
    block(c, s, t, -0.5, half, -half, half);
    slab(c, s, t, -half, half + 0.12, -0.5, -half);
    slab(c, s, t, -0.5, half + 0.12, -half, half + 0.12);
    rail(c, s, [half + 0.08, -0.5], [half + 0.08, half + 0.08]);
    rail(c, s, [-0.5, half + 0.08], [half + 0.08, half + 0.08]);
  }
}

const counters = {
  ...looks('barY', [-40, -46, 40, 26], (c, t) => counter(c, t, 0)),
  ...looks('barXBack', [-40, -58, 40, 26], (c, t) => counter(c, t, 1)),
  ...looks('barCornerBack', [-40, -46, 40, 26], (c, t) => counter(c, t, 2)),
  ...looks('barCornerFront', [-40, -46, 40, 26], (c, t) => counter(c, t, 3)),
  ...looks('barXFront', [-40, -46, 40, 26], (c, t) => counter(c, t, 4)),
};

/** Where ready drinks wait: a rubber bar mat on the counter. */
const barMat = sprite([-20, -36, 20, -14], (c) => {
  onTop(c, H + TOP, () => {
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.3, -0.36, 0.6, 0.72), 0.04, 0.04), fill('#2A2A30'));
    for (let y = -0.3; y < 0.33; y += 0.1) c.drawPath(path.polyline([[-0.26, y], [0.26, y]]), stroke('#45454E', 0.025));
  });
});

// ---------- stools: chrome with a red seat -> wood and gold -> velvet -> black and gold ----------

const SEAT = ['#C8202E', '#7A4A2A', '#6A2C8F', '#1E1A24'] as const;
const POLE = ['#AEB8C4', GOLD, GOLD, '#FFD54A'] as const;
const stools = looks('barStool', [-14, -32, 14, 8], (c, t) => {
  floorShadow(c, 0, 0, 0.2, 0.25);
  cylinder(c, 0, 0, 0.13, 0, 1.4, darken(POLE[t]!, 0.2), POLE[t]!);
  cylinder(c, 0, 0, 0.025, 1.4, 14, darken(POLE[t]!, 0.25), POLE[t]!);
  // The foot ring.
  cylinder(c, 0, 0, 0.1, 6, 0.8, darken(POLE[t]!, 0.15), POLE[t]!);
  cylinder(c, 0, 0, 0.16, 15, 3, darken(SEAT[t]!, 0.25), SEAT[t]!);
  if (t >= 2) cylinder(c, 0, 0, 0.165, 15, 0.8, GOLD, GOLD);
});

// ---------- drinks (src/data/bar.ts order): soda, lemonade, mojito, margarita, tropical, martini ----------

const GLASS = '#DDEFFF';

/** A tall glass with something in it, a straw and ice. */
function tall(c: SkCanvas, liquid: string, extra: (c: SkCanvas) => void) {
  cylinder(c, 0, 0, 0.055, 0, 11, GLASS, '#F4FAFF');
  cylinder(c, 0, 0, 0.05, 0.6, 8.5, liquid, lighten(liquid, 0.25));
  const [x, y] = P(0, 0, 9);
  c.drawRect(Skia.XYWHRect(x - 1.6, y - 1.2, 1.4, 1.4), fill('#FFFFFF', 0.8));
  extra(c);
}

const straw = (c: SkCanvas, color: string) => {
  const [x, y] = P(0.02, 0, 8);
  c.drawPath(path.polyline([[x, y], [x + 2.2, y - 7]]), stroke(color, 1));
};

/** A glass on a stem: `bowl` draws the bowl (top at z). */
function stemmed(c: SkCanvas, bowl: (top: number) => void) {
  cylinder(c, 0, 0, 0.05, 0, 0.6, GLASS, '#F4FAFF');
  cylinder(c, 0, 0, 0.012, 0.6, 5, GLASS, GLASS);
  bowl(5.6);
}

function drinkArt(c: SkCanvas, k: number) {
  if (k === 0) {
    tall(c, '#5A2A1A', (g) => straw(g, '#E5483B'));
  } else if (k === 1) {
    tall(c, '#F4D04D', (g) => {
      straw(g, '#47B2BE');
      const [x, y] = P(-0.05, 0, 11);
      g.drawCircle(x, y, 2, fill('#FFE27A'));
      g.drawCircle(x, y, 2, stroke('#E9B13C', 0.5));
    });
  } else if (k === 2) {
    tall(c, '#CFEFC8', (g) => {
      for (const [dx, dy] of [[-1.5, 2], [1, 3.5], [0, 5]] as const) {
        const [x, y] = P(0, 0, 8);
        g.drawCircle(x + dx, y + dy, 1.2, fill('#2E8B47'));
      }
      straw(g, '#2E8B47');
      const [x, y] = P(0.05, 0, 11);
      g.drawCircle(x, y, 1.8, fill('#7CC77F'));
    });
  } else if (k === 3) {
    stemmed(c, (z) => {
      const [x, y] = P(0, 0, z);
      c.drawPath(path.poly([[x - 5, y - 5], [x + 5, y - 5], [x + 1.5, y], [x - 1.5, y]]), fill('#C9F27A', 0.95));
      c.drawPath(path.polyline([[x - 5, y - 5], [x + 5, y - 5]]), stroke('#FFFFFF', 1.2));
      c.drawCircle(x + 4, y - 5.5, 1.6, fill('#7CC77F'));
    });
  } else if (k === 4) {
    cylinder(c, 0, 0, 0.06, 0, 12, GLASS, '#F4FAFF');
    cylinder(c, 0, 0, 0.055, 0.6, 5, '#E5483B', '#F27A4E');
    cylinder(c, 0, 0, 0.055, 5.6, 5, '#F4A23B', '#F7C35B');
    const [x, y] = P(0, 0, 12);
    // A paper umbrella.
    c.drawPath(path.polyline([[x + 1, y], [x + 3.5, y - 6]]), stroke('#8A6A50', 0.7));
    c.drawPath(path.poly([[x + 0.5, y - 5], [x + 3.5, y - 8], [x + 6.5, y - 5]]), fill('#F38DB3'));
  } else {
    stemmed(c, (z) => {
      const [x, y] = P(0, 0, z);
      c.drawPath(path.poly([[x - 4.5, y - 5], [x + 4.5, y - 5], [x, y]]), fill('#F4FAFF', 0.9));
      c.drawPath(path.poly([[x - 3.6, y - 4.2], [x + 3.6, y - 4.2], [x, y - 0.4]]), fill('#E8F0D8', 0.9));
      c.drawCircle(x + 1, y - 3, 1.3, fill('#6B8E23'));
      c.drawPath(path.polyline([[x + 1, y - 3], [x + 3, y - 7]]), stroke('#C9A35A', 0.6));
    });
  }
}

export const DRINK_SPRITES = ['drinkSoda', 'drinkLemonade', 'drinkMojito', 'drinkMargarita', 'drinkTropical', 'drinkMartini'] as const;
const drinks: Record<string, SpriteDef> = Object.fromEntries(DRINK_SPRITES.map((name, k) => [name, sprite([-10, -24, 10, 4], (c) => drinkArt(c, k))]));

// ---------- in hand ----------

/** The cocktail shaker (shaken by the shoulder). */
const shaker = sprite([-6, -16, 6, 3], (c) => {
  cylinder(c, 0, 0, 0.045, 0, 8, '#AEB8C4', '#DCE3EA');
  cylinder(c, 0, 0, 0.035, 8, 3, '#C7CFD8', '#E8EDF2');
  cylinder(c, 0, 0, 0.015, 11, 1.6, '#AEB8C4', '#DCE3EA');
  const [x, y] = P(0.03, 0, 6);
  c.drawLine(x, y - 4, x, y + 1, stroke('#FFFFFF', 0.8, 0.8));
});

/** A waiter's round tray with one drink on it. */
const drinkTray = sprite([-14, -22, 14, 6], (c) => {
  cylinder(c, 0, 0, 0.15, 0, 1.5, '#AEB8C4', '#DCE3EA');
  c.save();
  const [x, y] = P(0, 0, 1.5);
  c.translate(x, y);
  drinkArt(c, 2);
  c.restore();
});

/** A cocktail glass in hand. */
const glassHeld = sprite([-8, -16, 8, 3], (c) => {
  c.save();
  c.scale(0.8, 0.8);
  drinkArt(c, 3);
  c.restore();
});

export const barSprites = { ...counters, barMat, ...stools, ...drinks, shaker, drinkTray, glassHeld };
