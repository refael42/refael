import { Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { fill, glowStroke, path, stroke, type Pt } from './kit';

// Emote bubbles, order icons and small effects: glossy, flat-shaded, no heavy outlines.

const EDGE = '#2A1530';

function glossy(c: SkCanvas, p: ReturnType<typeof path.smooth>, base: string, edge = darken(base, 0.45)) {
  const b = p.getBounds();
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(
    Skia.Shader.MakeLinearGradient(vec(0, b.y), vec(0, b.y + b.height), [Skia.Color(lighten(base, 0.35)), Skia.Color(base), Skia.Color(darken(base, 0.18))], [0, 0.45, 1], TileMode.Clamp),
  );
  c.drawPath(p, stroke(edge, 1.6));
  c.drawPath(p, paint);
}

const bubble = sprite([-13, -26, 13, 2], (c) => {
  const shape = path.smooth([[-10, -20.6], [10, -20.6], [11.4, -9.6], [5.6, -4.8], [1.6, -4.6], [0, -0.6], [-1.6, -4.6], [-5.6, -4.8], [-11.4, -9.6]], true, 0.7);
  glossy(c, shape, '#FFFFFF', '#3C2A48');
});

const ICON = [-9, -9, 9, 9] as const;
const heart = sprite(ICON, (c) =>
  glossy(c, path.smooth([[0, 5.6], [-5.6, 0.4], [-5.2, -3.8], [-2.5, -5.2], [0, -2.9], [2.5, -5.2], [5.2, -3.8], [5.6, 0.4]], true, 0.8), '#FF3D6E'),
);
const anger = sprite(ICON, (c) => {
  for (const r of [0, 90, 180, 270]) {
    c.save();
    c.rotate(r + 45, 0, 0);
    const p = path.smooth([[1.4, -5.4], [1.4, -1.4], [5.4, -1.4]], false);
    c.drawPath(p, stroke(EDGE, 3.6));
    c.drawPath(p, stroke('#FF3B30', 2));
    c.restore();
  }
});
const clock = sprite(ICON, (c) => {
  glossy(c, path.circle(0, 0, 5.6), '#5B8EDB');
  c.drawCircle(0, 0, 4, fill('#FFFFFF'));
  c.drawPath(path.polyline([[0, -3], [0, 0], [2.2, 0.8]]), stroke(EDGE, 1.1));
});
/** In a hurry: a lightning bolt. */
const bolt = sprite(ICON, (c) => {
  glossy(c, path.circle(0, 0, 5.6), '#E5483B');
  c.drawPath(path.poly([[0.9, -4], [-2.2, 0.6], [0.2, 0.6], [-0.9, 4], [2.4, -0.8], [0, -0.8]]), fill('#FFE14A'));
});
/** Takes their time: a snail. */
const snail = sprite(ICON, (c) => {
  glossy(c, path.circle(0, 0, 5.6), '#3FAE5A');
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-4, 1, 8, 2.2), 1.1, 1.1), fill('#F2D6A8'));
  c.drawCircle(-0.6, -0.4, 2.8, fill('#C8814A'));
  c.drawPath(path.polyline([[-0.6, -0.4], [0.6, -0.9], [0.3, 0.6], [-1.6, 0.3], [-1.4, -2.2], [1.2, -2.4], [2, 0]]), stroke('#7A4A22', 0.6));
  c.drawPath(path.polyline([[3, 1.2], [3.6, -1.6]]), stroke('#F2D6A8', 0.6));
});
const coin = sprite(ICON, (c) => {
  glossy(c, path.circle(0, 0, 5.8), '#FFC21A', '#9A6A00');
  c.drawCircle(0, 0, 3.9, stroke('#E09A00', 1));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.9, -2.6, 1.8, 5.2), 0.9, 0.9), fill('#E09A00'));
});
const starPts = (r1: number, r2: number): Pt[] =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? r1 : r2;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
  });
const star = sprite(ICON, (c) => glossy(c, path.smooth(starPts(6.4, 3), true, 0.25), '#FFCC22', '#9A6A00'));
const starGray = sprite(ICON, (c) => glossy(c, path.smooth(starPts(6.4, 3), true, 0.25), '#5A4E66', '#2A2232'));
const exclaim = sprite(ICON, (c) => {
  glossy(c, path.smooth([[-1.9, -5.8], [1.9, -5.8], [1.1, 1.6], [-1.1, 1.6]], true, 0.4), '#FF8A1C');
  glossy(c, path.circle(0, 4.3, 1.6), '#FF8A1C');
});
const zzz = sprite(ICON, (c) => {
  const z = (x: number, y: number, s: number) => {
    const p = path.polyline([[x - s, y - s], [x + s, y - s], [x - s, y + s], [x + s, y + s]]);
    c.drawPath(p, stroke(EDGE, 2.8));
    c.drawPath(p, stroke('#8C9CFF', 1.4));
  };
  z(-2.6, 2, 2.4);
  z(2.6, -2.8, 1.8);
});
const music = sprite(ICON, (c) => {
  c.drawPath(path.polyline([[-1, 3], [-1, -4.4], [5, -5.4], [5, 2]]), stroke(EDGE, 1.6));
  glossy(c, path.oval(-3, 3.2, 2.3, 1.8), '#B07CFF');
  glossy(c, path.oval(3, 2.2, 2.3, 1.8), '#B07CFF');
});
/** "Seat me": a little red chair. */
const seat = sprite(ICON, (c) => {
  glossy(c, path.rrect(-4.6, -6, 2.4, 9, 1), '#E2B13C');
  glossy(c, path.rrect(-4.6, 0.6, 9.2, 2.6, 1.2), '#C8202E');
  glossy(c, path.rrect(-4.6, 3, 1.8, 3.4, 0.6), '#9C7A2A');
  glossy(c, path.rrect(2.8, 3, 1.8, 3.4, 0.6), '#9C7A2A');
});
/** "Clean me": a yellow sponge with bubbles. */
const clean = sprite(ICON, (c) => {
  glossy(c, path.rrect(-5, -2, 10, 6, 1.8), '#FFD43B', '#8A6A00');
  c.drawRect(Skia.XYWHRect(-5, 1.4, 10, 2.6), fill('#2FA36B'));
  for (const [x, y, r] of [[-3, -4.5, 1.6], [1.4, -5.6, 2], [4.4, -3.6, 1.2]] as const) {
    c.drawCircle(x, y, r, fill('#E8F7FF', 0.85));
    c.drawCircle(x, y, r, stroke('#7FBCE0', 0.6));
  }
});
const fries = sprite(ICON, (c) => {
  for (const [x, h] of [[-2.6, 7], [-0.8, 8.2], [1, 7.4], [2.6, 6.6]] as const) {
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - 0.8, -6 + (8.2 - h), 1.6, h), 0.6, 0.6), fill('#F6C945'));
  }
  glossy(c, path.poly([[-4.6, -1], [4.6, -1], [3.4, 6], [-3.4, 6]]), '#E5302A');
  c.drawRect(Skia.XYWHRect(-1.6, 1.4, 3.2, 2.2), fill('#FFD54A'));
});
const burger = sprite(ICON, (c) => {
  glossy(c, path.smooth([[-5.6, -0.6], [-4.6, -4.8], [0, -6], [4.6, -4.8], [5.6, -0.6]]), '#F0A84E');
  c.drawRect(Skia.XYWHRect(-5.8, -0.8, 11.6, 1.6), fill('#5FC35A'));
  glossy(c, path.rrect(-5.6, 0.6, 11.2, 2.2, 1), '#6B3A22');
  glossy(c, path.rrect(-5.2, 2.6, 10.4, 2.6, 1.2), '#F0A84E');
  for (const [x, y] of [[-2, -3.6], [1, -4.4], [2.8, -2.8]] as const) c.drawCircle(x, y, 0.45, fill('#FFF6DE'));
});
const cross = sprite(ICON, (c) => {
  for (const r of [45, -45]) {
    c.save();
    c.rotate(r, 0, 0);
    glossy(c, path.rrect(-1.6, -6, 3.2, 12, 1.4), '#FF3B30');
    c.restore();
  }
});
/** "Out of clean plates!": a plate with a red cross. */
const noPlates = sprite(ICON, (c) => {
  glossy(c, path.oval(0, 1, 6, 3.4), '#FFFFFF', '#5A6070');
  c.drawOval(Skia.XYWHRect(-3.6, -1, 7.2, 4), stroke('#C9D1D9', 0.8));
  c.save();
  c.translate(3.4, -3.4);
  for (const r of [45, -45]) {
    c.save();
    c.rotate(r, 0, 0);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.9, -3.4, 1.8, 6.8), 0.8, 0.8), fill('#FF3B30'));
    c.restore();
  }
  c.restore();
});

/** "You can upgrade this": a glossy green arrow badge floating over the station. */
const arrowUp = sprite([-12, -12, 12, 12], (c) => {
  glossy(c, path.circle(0, 0, 9.4), '#35B957', '#17602A');
  c.drawCircle(0, 0, 9.4, stroke('#B9F5A8', 1.2));
  glossy(c, path.poly([[0, -6.4], [5.6, 0], [2.2, 0], [2.2, 5.4], [-2.2, 5.4], [-2.2, 0], [-5.6, 0]]), '#FFFFFF', '#2E8B47');
});
/** "Buy a new table here": a green plus badge. */
const plusBadge = sprite([-12, -12, 12, 12], (c) => {
  glossy(c, path.circle(0, 0, 9.4), '#35B957', '#17602A');
  c.drawCircle(0, 0, 9.4, stroke('#B9F5A8', 1.2));
  glossy(c, path.rrect(-1.9, -5.6, 3.8, 11.2, 1.4), '#FFFFFF', '#2E8B47');
  glossy(c, path.rrect(-5.6, -1.9, 11.2, 3.8, 1.4), '#FFFFFF', '#2E8B47');
});
/** Settings button icon: a chunky gold gear. */
const gear = sprite([-12, -12, 12, 12], (c) => {
  const pts: Pt[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const r = i % 4 < 2 ? 10.4 : 7.8;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  glossy(c, path.poly(pts), '#F2C14E', '#8A6A00');
  c.drawCircle(0, 0, 3.6, fill('#2A1530'));
  c.drawCircle(0, 0, 3.6, stroke('#8A6A00', 1));
});

/** "I'm here about the job": a CV sheet with a photo and lines. */
const cv = sprite(ICON, (c) => {
  glossy(c, path.rrect(-5, -6.4, 10, 12.8, 1.4), '#FFFFFF', '#5A6070');
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-3.6, -5, 3.4, 3.8), 0.8, 0.8), fill('#5B8EDB'));
  c.drawCircle(-1.9, -3.8, 0.9, fill('#FFE1C9'));
  for (const [y, w] of [[-4.4, 3], [-2.6, 2.4], [0.4, 7], [2.2, 6], [4, 6.6]] as const) {
    c.drawRect(Skia.XYWHRect(y < 0 ? 0.6 : -3.6, y, w, 0.9), fill('#B8C0CC'));
  }
});
/** "Can we talk about my pay?": a coin with an up arrow. */
const raise = sprite(ICON, (c) => {
  glossy(c, path.circle(-1, 1, 5), '#FFC21A', '#9A6A00');
  c.drawCircle(-1, 1, 3.4, stroke('#E09A00', 0.9));
  glossy(c, path.poly([[4.4, -6.4], [7.6, -2.4], [5.4, -2.4], [5.4, 1], [3.4, 1], [3.4, -2.4], [1.2, -2.4]]), '#35B957', '#17602A');
});
/** Uniform rank badge (white, tinted silver or gold by the renderer). */
const rankStar = sprite([-5, -5, 5, 5], (c) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 3.4 : 1.5;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
  });
  c.drawPath(path.poly(pts), stroke('#3A2A20', 1.2));
  c.drawPath(path.poly(pts), fill('#FFFFFF'));
});
/** Confetti piece for milestone celebrations (tinted per piece). */
const confetti = sprite([-4, -3, 4, 3], (c) => c.drawRect(Skia.XYWHRect(-3, -1.8, 6, 3.6), fill('#FFFFFF')));

/** Flying banknote: the "money everywhere" feel. */
const bill = sprite([-11, -7, 11, 7], (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-9, -5, 18, 10), 1.4, 1.4), glowStroke('#7DFF7A', 2.4, 0.5, 2));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-9, -5, 18, 10), 1.4, 1.4), fill('#6FD36A'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-7.6, -3.6, 15.2, 7.2), 1, 1), stroke('#2E8B47', 0.9));
  c.drawCircle(0, 0, 2.6, fill('#B8F5A8'));
  c.drawCircle(0, 0, 2.6, stroke('#2E8B47', 0.8));
});

// Effects.
const steam = sprite([-7, -7, 7, 7], (c) => {
  const p = Skia.Paint();
  p.setShader(Skia.Shader.MakeRadialGradient(vec(0, 0), 5, [Skia.Color('rgba(255,255,255,0.9)'), Skia.Color('rgba(255,255,255,0)')], null, TileMode.Clamp));
  c.drawCircle(0, 0, 5, p);
});
const sparkle = sprite([-7, -7, 7, 7], (c) => {
  const p = path.smooth([[0, -5.4], [1, -1], [5.4, 0], [1, 1], [0, 5.4], [-1, 1], [-5.4, 0], [-1, -1]], true, 0.2);
  c.drawPath(p, glowStroke('#FFF3B0', 2, 0.75, 1.2));
  c.drawPath(p, fill('#FFFFFF'));
});
const soap = sprite([-4, -4, 4, 4], (c) => {
  c.drawCircle(0, 0, 2.4, fill('#E8F7FF', 0.5));
  c.drawCircle(0, 0, 2.4, stroke('#8FC9E8', 0.7));
  c.drawCircle(-0.8, -0.9, 0.6, fill('#FFFFFF'));
});
const puff = sprite([-8, -8, 8, 8], (c) => {
  const p = Skia.Paint();
  p.setShader(Skia.Shader.MakeRadialGradient(vec(0, 0), 6, [Skia.Color('rgba(170,160,180,0.9)'), Skia.Color('rgba(170,160,180,0)')], null, TileMode.Clamp));
  c.drawCircle(0, 0, 6, p);
});
const ring = sprite([-14, -14, 14, 14], (c) => {
  c.drawCircle(0, 0, 11, glowStroke('#FFE58A', 3, 0.7, 2));
  c.drawCircle(0, 0, 11, stroke('#FFF8D6', 1.4));
});

/** A present on the sidewalk: a red box with a gold ribbon and a bow. */
const giftBox = sprite([-14, -24, 14, 6], (c) => {
  c.drawOval(Skia.XYWHRect(-11, -2, 22, 7), fill('#000000', 0.25));
  glossy(c, path.rrect(-10, -12, 20, 13, 2), '#E5483B', '#8A1E1A');
  glossy(c, path.rrect(-11.5, -16, 23, 5, 1.5), '#F25A4C', '#8A1E1A');
  c.drawRect(Skia.XYWHRect(-2, -16, 4, 17), fill('#FFD23F'));
  c.drawRect(Skia.XYWHRect(-2, -16, 4, 17), stroke('#9A6A00', 0.8));
  for (const dx of [-1, 1]) glossy(c, path.smooth([[0, -16], [dx * 8, -22], [dx * 9, -17], [dx * 2, -15]], true, 0.8), '#FFD23F', '#9A6A00');
  c.drawCircle(0, -16, 2.2, fill('#FFE27A'));
});
/** The VIP's crown, floating over their head. */
const crown = sprite([-10, -9, 10, 5], (c) => {
  glossy(c, path.poly([[-8, 3], [-8, -4], [-4, -1], [0, -7], [4, -1], [8, -4], [8, 3]]), '#FFD23F', '#9A6A00');
  for (const x of [-5, 0, 5]) c.drawCircle(x, 0.5, 1.2, fill(x === 0 ? '#E5483B' : '#5FB8FF'));
});

export const fxSprites = {
  giftBox, crown,
  bubble, heart, anger, clock, bolt, snail, coin, star, starGray, exclaim, zzz, music, seat, clean, noPlates, fries, burger, cross, bill,
  arrowUp, plusBadge, confetti, gear, cv, raise, rankStar,
  steam, sparkle, soap, puff, ring,
};
