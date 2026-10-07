import { Skia, TileMode, vec, type SkCanvas, type SkPath } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { fill, path, stroke } from './kit';

// The opening screen's art: the chef hat on the title (chunky: thick warm outline, a top-lit
// gradient, a shine) and the sunburst behind it. Rendered once into PNGs.

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

export const splashIcons = { splashHat, splashRays };
export type SplashIcon = keyof typeof splashIcons;
