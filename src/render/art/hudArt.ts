import { PathOp, Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { fill, path, stroke, type Pt } from './kit';
import { EDGE } from './iconKit';
import { menuIcons } from './menuIcons';
import { shopIcons } from './shopIcons';

// The HUD's big icons: drawn once at high resolution into PNGs for the screen overlay (they are
// not part of the world atlas). Glossy, beveled and thick, like the coins and stars of
// casino-style idle games: a shadow edge for depth, a gradient face, a bevel, a shine.

function radial(cx: number, cy: number, r: number, colors: string[], stops: number[]) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeRadialGradient(vec(cx, cy), r, colors.map((c) => Skia.Color(c)), stops, TileMode.Clamp));
  return p;
}

function starPoints(cx: number, cy: number, outer: number, inner: number): Pt[] {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
  });
}

/** A thick gold coin: dark edge underneath, gradient face, embossed rim and star, a shine. */
const hudCoin = sprite([-26, -26, 26, 29], (c: SkCanvas) => {
  c.drawCircle(0, 4, 24.6, fill(EDGE, 0.45));
  c.drawCircle(0, 1.2, 24.6, fill(EDGE));
  c.drawCircle(0, 3, 23, fill('#7A4508'));
  c.drawCircle(0, 0, 23, fill('#B8741A'));
  c.drawCircle(0, 0, 21, radial(-7, -8, 30, ['#FFF2A8', '#FFD23F', '#E39A12', '#B8741A'], [0, 0.35, 0.8, 1]));
  c.drawCircle(0, 0, 15.5, stroke('#C8860F', 2.4));
  c.drawCircle(0, -0.8, 15.5, stroke('#FFF0A0', 1, 0.7));
  const star = path.poly(starPoints(0, 1, 10, 4.4));
  c.drawPath(path.poly(starPoints(0, 2.2, 10, 4.4)), fill('#A8650C'));
  c.drawPath(star, radial(-2, -4, 12, ['#FFE680', '#F2B21C'], [0, 1]));
  c.drawPath(star, stroke('#C8860F', 0.9));
  // The shine sweeping over the top left.
  c.drawOval(Skia.XYWHRect(-15, -17, 15, 8), fill('#FFFFFF', 0.5));
  c.drawCircle(11, -11, 1.8, fill('#FFFFFF', 0.8));
});

/** A big glossy star with a bevel: the rating. */
const hudStar = sprite([-27, -27, 27, 28], (c: SkCanvas) => {
  const outer = starPoints(0, 2, 25, 11.5);
  c.drawPath(path.smooth(starPoints(0, 4.5, 25, 11.5), true, 0.18), fill('#8A4A06'));
  const body = path.smooth(outer, true, 0.18);
  c.drawPath(path.smooth(starPoints(0, 5, 25, 11.5), true, 0.18), stroke(EDGE, 3.2, 0.45));
  c.drawPath(body, stroke(EDGE, 3.4));
  c.drawPath(body, radial(-6, -8, 32, ['#FFF6B0', '#FFD23F', '#F29A12', '#C8700A'], [0, 0.35, 0.8, 1]));
  c.drawPath(body, stroke('#B8640A', 1.6));
  // Bevel: a smaller, lighter star inside.
  c.drawPath(path.smooth(starPoints(0, 2.6, 15, 7), true, 0.18), radial(-3, -5, 16, ['#FFFBE0', '#FFE36A'], [0, 1]));
  c.drawOval(Skia.XYWHRect(-13, -15, 12, 7), fill('#FFFFFF', 0.55));
});

/** Day: a warm sun with rays. */
const hudSun = sprite([-24, -24, 24, 24], (c: SkCanvas) => {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const [x0, y0, x1, y1] = [Math.cos(a) * 15, Math.sin(a) * 15, Math.cos(a) * 22, Math.sin(a) * 22];
    c.drawLine(x0, y0, x1, y1, stroke(i % 2 ? '#FFB020' : '#FFD23F', 3.4));
  }
  c.drawCircle(0, 2, 13, fill('#C8700A'));
  c.drawCircle(0, 0, 13, radial(-4, -5, 18, ['#FFF6B0', '#FFC21A', '#F28A12'], [0, 0.55, 1]));
  c.drawOval(Skia.XYWHRect(-8, -10, 8, 5), fill('#FFFFFF', 0.55));
});

/** Night: a crescent moon with a few stars. */
const hudMoon = sprite([-24, -24, 24, 24], (c: SkCanvas) => {
  const disc = Skia.Path.Circle(0, 0, 16);
  const moon = Skia.Path.MakeFromOp(disc, Skia.Path.Circle(8, -6, 14), PathOp.Difference) ?? disc;
  c.save();
  c.translate(0, 2);
  c.drawPath(moon, fill('#5A5A8A'));
  c.restore();
  c.drawPath(moon, radial(-8, 4, 22, ['#FFFFFF', '#E8E4FF', '#B8B2E8'], [0, 0.5, 1]));
  for (const [x, y, r] of [[14, 8, 2.4], [18, -12, 1.6], [6, 14, 1.4]] as const) c.drawCircle(x, y, r, fill('#FFF6C8'));
});

/**
 * The tutorial's pointing hand: a white cartoon glove, fingertip at the top middle. The index
 * finger stands up on the thumb's side and the other three fingers curl into the fist (owner:
 * the old one, a lone finger up the middle of the fist, read as a rude gesture).
 */
const hudHand = sprite([-22, -32, 22, 32], (c: SkCanvas) => {
  const edge = '#2A1530';
  const glove = (p: ReturnType<typeof path.rrect>) => {
    c.drawPath(p, stroke(edge, 4.4));
    c.drawPath(p, fill('#FFFFFF'));
  };
  // The three curled fingers: knuckles over the top of the fist, right of the pointing finger.
  glove(path.rrect(13, -12, 7.5, 13, 3.75));
  glove(path.rrect(8.5, -14.5, 7.5, 14, 3.75));
  glove(path.rrect(3.5, -16, 7.5, 15, 3.75));
  // The pointing finger, then the fist over all their roots.
  glove(path.rrect(-5, -30, 10, 30, 5));
  glove(path.rrect(-9, -7, 28, 25, 9));
  for (const x of [10, 15]) c.drawLine(x, -6, x, -1, stroke('#C9C2D6', 1.6));
  // The thumb, folded across the front of the curled fingers.
  c.save();
  c.rotate(-10, -2, 4);
  glove(path.rrect(-13, -0.5, 21, 9, 4.5));
  c.restore();
  // The cuff.
  c.drawPath(path.rrect(-7, 15, 24, 11, 4), stroke(edge, 4.4));
  c.drawPath(path.rrect(-7, 15, 24, 11, 4), fill('#E2B13C'));
  // A soft shade down the side of the finger and under the thumb.
  c.drawPath(path.rrect(2, -25, 1.8, 20, 0.9), fill('#EDE8F6'));
  c.drawOval(Skia.XYWHRect(-5, 9, 18, 4), fill('#EDE8F6'));
});

/** The premium gem: a cut diamond, cyan to violet, with bright facets. */
const hudGem = sprite([-24, -22, 24, 24], (c: SkCanvas) => {
  const outline: Pt[] = [[-21, -6], [-12, -18], [12, -18], [21, -6], [0, 21]];
  c.drawPath(path.poly(outline.map(([x, y]) => [x, y + 3] as Pt)), fill(EDGE, 0.55));
  c.drawPath(path.poly(outline), stroke(EDGE, 5));
  c.drawPath(path.poly(outline), radial(-6, -10, 34, ['#E6FBFF', '#5FE3FF', '#7A5CFF', '#4A20B0'], [0, 0.3, 0.75, 1]));
  // Facets: the table on top and the cuts down to the point.
  c.drawPath(path.poly([[-12, -18], [12, -18], [7, -6], [-7, -6]]), fill('#FFFFFF', 0.45));
  c.drawPath(path.poly([[-21, -6], [-7, -6], [0, 21]]), fill('#FFFFFF', 0.18));
  c.drawPath(path.poly([[7, -6], [21, -6], [0, 21]]), fill('#2A1060', 0.25));
  c.drawPath(path.poly(outline), stroke(EDGE, 2.6));
  c.drawCircle(-9, -13, 2, fill('#FFFFFF', 0.95));
});

/** A puffy cloud (cloudy days), optionally with the sun peeking out behind it. */
function cloud(c: SkCanvas, dx: number, dy: number, k: number, base: string) {
  const puffs: [number, number, number][] = [[-9, 3, 8], [0, -3, 11], [10, 2, 9], [3, 6, 8]];
  for (const [x, y, r] of puffs) c.drawCircle(dx + x * k, dy + y * k + 2, r * k, fill('#5A6A86'));
  for (const [x, y, r] of puffs) c.drawCircle(dx + x * k, dy + y * k, r * k, radial(dx - 4, dy - 8, 22 * k, ['#FFFFFF', base], [0, 1]));
}

const hudCloud = sprite([-24, -24, 24, 24], (c: SkCanvas) => {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - 0.4;
    c.drawLine(8 + Math.cos(a) * 10, -8 + Math.sin(a) * 10, 8 + Math.cos(a) * 15, -8 + Math.sin(a) * 15, stroke('#FFD23F', 2.6));
  }
  c.drawCircle(8, -8, 9, radial(5, -11, 12, ['#FFF6B0', '#FFC21A'], [0, 1]));
  cloud(c, -3, 5, 1, '#D8E2F0');
});

/** Rain: a grey cloud with blue drops. */
const hudRain = sprite([-24, -24, 24, 24], (c: SkCanvas) => {
  for (const [x, y] of [[-10, 12], [-1, 15], [8, 12], [-5, 20], [4, 20]] as const) {
    c.drawPath(path.smooth([[x, y - 4], [x + 2, y], [x, y + 2], [x - 2, y]], true, 0.9), fill('#5FB8FF'));
  }
  cloud(c, 0, -5, 1.05, '#AEB8CC');
});

/**
 * Every menu icon. The guide, reviews, deal, trophies, quests and gift keep their old names
 * (the screens ask for them by name) but are drawn in the house style now (M41).
 */
export const hudIcons = {
  hudCoin,
  hudStar,
  hudSun,
  hudMoon,
  hudHand,
  hudGem,
  hudCloud,
  hudRain,
  hudBubble: menuIcons.iconBubble,
  hudBook: menuIcons.iconBook,
  hudBolt: menuIcons.iconBolt,
  hudTrophy: menuIcons.iconTrophy,
  hudScroll: menuIcons.iconScroll,
  hudGift: menuIcons.iconGift,
  ...menuIcons,
  ...shopIcons,
};
export type HudIcon = keyof typeof hudIcons;
