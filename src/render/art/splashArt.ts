import { Skia, TileMode, vec, type SkCanvas, type SkPath } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { fill, path, stroke, type Pt } from './kit';

// The opening screen's art: Tel Aviv street food, drawn big and chunky (thick warm outline,
// a top-lit gradient, a shine), and the sunburst behind the title. Rendered once into PNGs.

const EDGE = '#2A1530';

/** Outline, then a top-lit gradient body: every piece shares one lighting model. */
function chunky(c: SkCanvas, p: SkPath, base: string, outline = 2.6) {
  const b = p.getBounds();
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(
    Skia.Shader.MakeLinearGradient(vec(0, b.y), vec(0, b.y + b.height), [Skia.Color(lighten(base, 0.3)), Skia.Color(base), Skia.Color(darken(base, 0.2))], [0, 0.5, 1], TileMode.Clamp),
  );
  c.drawPath(p, stroke(EDGE, outline * 2));
  c.drawPath(p, paint);
}

const shine = (c: SkCanvas, x: number, y: number, w: number, h: number) => c.drawOval(Skia.XYWHRect(x, y, w, h), fill('#FFFFFF', 0.45));

const splashBurger = sprite([-30, -28, 30, 26], (c) => {
  chunky(c, path.rrect(-23, 9, 46, 12, 6), '#E9A04A');
  chunky(c, path.rrect(-26, 1, 52, 10, 5), '#6B3A22');
  const cheese: Pt[] = [[-25, 0], [25, 0], [23, 6], [15, 3.5], [9, 10], [3, 3.5], [-7, 8], [-14, 3], [-23, 6]];
  c.drawPath(path.poly(cheese), fill('#FFC93C'));
  c.drawPath(path.poly(cheese), stroke(darken('#FFC93C', 0.4), 1));
  chunky(c, path.smooth([[-26, -2], [-18, -6], [-9, -2], [0, -6], [9, -2], [18, -6], [26, -2], [18, 2], [0, 1], [-18, 2]], true, 0.8), '#5FC35A', 1.6);
  chunky(c, path.smooth([[-26, -3], [-22, -16], [0, -25], [22, -16], [26, -3]], true, 0.9), '#F0A84E');
  for (const [x, y, r] of [[-12, -13, 15], [-3, -18, -10], [7, -15, 25], [14, -9, -20], [-17, -6, 30], [1, -10, 5]] as const) {
    c.save();
    c.translate(x, y);
    c.rotate(r, 0, 0);
    c.drawOval(Skia.XYWHRect(-1.6, -0.9, 3.2, 1.8), fill('#FFF6DE'));
    c.restore();
  }
  shine(c, -17, -21, 16, 6);
});

const splashFries = sprite([-24, -32, 24, 28], (c) => {
  const sticks: [number, number, number][] = [[-12, -22, -8], [-6, -30, -3], [0, -26, 2], [6, -31, 5], [11, -21, 9], [-2, -18, -1]];
  for (const [x, top, tilt] of sticks) {
    c.save();
    c.rotate(tilt, x, 0);
    chunky(c, path.rrect(x - 2.6, top, 5.2, 30, 1.6), '#F6C945', 1.4);
    c.restore();
  }
  chunky(c, path.smooth([[-19, -6], [-10, -3], [0, -6], [10, -3], [19, -6], [14, 25], [-14, 25]], true, 0.35), '#E5302A');
  // A white star badge on the box.
  const star = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 7 : 3;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [Math.cos(a) * r, 10 + Math.sin(a) * r] as Pt;
  });
  c.drawPath(path.poly(star), fill('#FFF4E3'));
  shine(c, -14, -2, 9, 12);
});

/** The local hero: a pita stuffed with falafel, salad and tahini. */
const splashPita = sprite([-30, -26, 30, 30], (c) => {
  // Salad and falafel peeking out of the pocket, behind its front edge.
  chunky(c, path.smooth([[-22, -6], [-14, -14], [-6, -8], [2, -15], [10, -9], [18, -15], [23, -6], [0, -2]], true, 0.8), '#5FC35A', 1.6);
  for (const [x, y] of [[-12, -12], [1, -15], [13, -12]] as const) {
    chunky(c, path.circle(x, y, 7.5), '#9A5B2A', 1.6);
    for (const [dx, dy] of [[-2.5, -2], [2, 1], [-0.5, 3]] as const) c.drawCircle(x + dx, y + dy, 0.9, fill('#5E3214'));
    c.drawCircle(x - 2.5, y - 3.5, 2, fill('#FFFFFF', 0.35));
  }
  for (const [x, y] of [[-18, -9], [19, -10], [7, -6]] as const) chunky(c, path.circle(x, y, 3.4), '#E5483B', 1.2);
  c.drawPath(path.smooth([[-16, -18], [-8, -21], [0, -19], [8, -22], [16, -18]], false), stroke('#FFF6DE', 2.4));
  chunky(c, path.smooth([[-25, -6], [0, -3], [25, -6], [21, 14], [0, 28], [-21, 14]], true, 0.75), '#F1D08F');
  for (const [x, y] of [[-10, 8], [6, 14], [12, 3], [-3, 18]] as const) c.drawCircle(x, y, 1.6, fill('#C8964E', 0.8));
  shine(c, -18, 0, 12, 6);
});

const splashSoda = sprite([-20, -36, 22, 28], (c) => {
  c.save();
  c.rotate(14, 0, -20);
  chunky(c, path.rrect(1, -36, 5, 22, 2), '#FF5A4E', 1.4);
  for (const y of [-31, -24]) c.drawRect(Skia.XYWHRect(1, y, 5, 3), fill('#FFF4E3'));
  c.restore();
  chunky(c, path.poly([[-15, -14], [15, -14], [11, 26], [-11, 26]]), '#2FA39A');
  c.drawRect(Skia.XYWHRect(-13.4, 2, 26.2, 6), fill('#FFF4E3'));
  chunky(c, path.rrect(-17, -20, 34, 7, 3.5), '#FFFFFF', 1.8);
  shine(c, -12, -11, 7, 12);
});

/** Sits tilted on the title: the manager's chef hat. */
const splashHat = sprite([-28, -32, 28, 22], (c) => {
  chunky(c, path.smooth([[-18, 8], [-25, -6], [-17, -20], [-6, -18], [0, -28], [10, -20], [21, -19], [25, -5], [18, 8]], true, 0.9), '#FFFFFF');
  chunky(c, path.rrect(-18, 6, 36, 13, 4), '#F4F0FA', 2);
  for (const x of [-9, 0, 9]) c.drawLine(x, 8, x, 17, stroke('#C9C2D6', 1.6));
  shine(c, -18, -18, 14, 7);
});

/** Soft gold rays fading out from the middle; spun slowly behind the title. */
const splashRays = sprite([-100, -100, 100, 100], (c) => {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(Skia.Shader.MakeRadialGradient(vec(0, 0), 100, [Skia.Color('rgba(255,214,120,0.30)'), Skia.Color('rgba(255,214,120,0)')], [0, 1], TileMode.Clamp));
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + Math.PI / n;
    c.drawPath(path.poly([[0, 0], [Math.cos(a0) * 140, Math.sin(a0) * 140], [Math.cos(a1) * 140, Math.sin(a1) * 140]]), paint);
  }
});

export const splashIcons = { splashBurger, splashFries, splashPita, splashSoda, splashHat, splashRays };
export type SplashIcon = keyof typeof splashIcons;
