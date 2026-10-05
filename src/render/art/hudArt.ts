import { PathOp, Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { fill, path, stroke, type Pt } from './kit';

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
const hudCoin = sprite([-26, -26, 26, 28], (c: SkCanvas) => {
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

export const hudIcons = { hudCoin, hudStar, hudSun, hudMoon };
export type HudIcon = keyof typeof hudIcons;
