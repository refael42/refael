import type { SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { blurred, dot, fill, glowStroke, INK, ink, line, path, stroke, type Pt } from './kit';

// Emote bubbles and small effects. Icons are drawn centered at (0,0) and placed inside the bubble.

const bubble = sprite([-12, -24, 12, 2], (c) => {
  const shape = path.smooth([[-9.4, -19.4], [9.4, -19.4], [10.6, -9], [5.4, -4.6], [1.6, -4.4], [0, -0.6], [-1.6, -4.4], [-5.4, -4.6], [-10.6, -9]], true, 0.7);
  ink(c, shape, '#FFFFFF', { shade: '#E9E1DA', depth: 1.2, line: 1.4 });
});

const ICON_BOUNDS = [-8, -8, 8, 8] as const;

const heart = sprite(ICON_BOUNDS, (c) =>
  ink(c, path.smooth([[0, 5.4], [-5.4, 0.4], [-5, -3.6], [-2.4, -5], [0, -2.8], [2.4, -5], [5, -3.6], [5.4, 0.4]], true, 0.8), '#FF4F6D', { line: 1.1, depth: 1 }),
);
const anger = sprite(ICON_BOUNDS, (c) => {
  for (const r of [0, 90, 180, 270]) {
    c.save();
    c.rotate(r + 45, 0, 0);
    c.drawPath(path.smooth([[1.4, -5], [1.4, -1.4], [5, -1.4]], false), stroke(INK, 3.4));
    c.drawPath(path.smooth([[1.4, -5], [1.4, -1.4], [5, -1.4]], false), stroke('#F0443A', 1.8));
    c.restore();
  }
});
const clock = sprite(ICON_BOUNDS, (c) => {
  ink(c, path.circle(0, 0, 5.4), '#FFFFFF', { line: 1.2, shade: '#DDE6F2' });
  c.drawCircle(0, 0, 4.2, stroke('#5B8EDB', 1.2));
  line(c, [[0, 0], [0, -3]], INK, 1.1);
  line(c, [[0, 0], [2.2, 0.8]], INK, 1.1);
});
const coin = sprite(ICON_BOUNDS, (c) => {
  ink(c, path.circle(0, 0, 5.4), '#FFC93C', { line: 1.2, shade: '#E89B1E', light: '#FFF2B0' });
  c.drawCircle(0, 0, 3.6, stroke('#E89B1E', 0.9));
  ink(c, path.rrect(-0.8, -2.4, 1.6, 4.8, 0.8), '#E89B1E', { ink: false, light: false, shade: false });
});
const starPts = (r1: number, r2: number): Pt[] =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? r1 : r2;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
  });
const star = sprite(ICON_BOUNDS, (c) =>
  ink(c, path.smooth(starPts(6, 2.8), true, 0.25), '#FFD54A', { line: 1.1, shade: '#F2B02E', light: '#FFF6C4', depth: 1 }),
);
const exclaim = sprite(ICON_BOUNDS, (c) => {
  ink(c, path.smooth([[-1.8, -5.6], [1.8, -5.6], [1, 1.6], [-1, 1.6]], true, 0.4), '#FF9F1C', { line: 1.1 });
  ink(c, path.circle(0, 4.2, 1.5), '#FF9F1C', { line: 1.1 });
});
const zzz = sprite(ICON_BOUNDS, (c) => {
  const z = (x: number, y: number, s: number) =>
    line(c, [[x - s, y - s], [x + s, y - s], [x - s, y + s], [x + s, y + s]], '#7A86C8', 1.4);
  z(-2.6, 2, 2.4);
  z(2.6, -2.8, 1.8);
});
const music = sprite(ICON_BOUNDS, (c) => {
  ink(c, path.oval(-3, 3.2, 2.2, 1.7), '#9B7BD8', { line: 1 });
  ink(c, path.oval(3, 2.2, 2.2, 1.7), '#9B7BD8', { line: 1 });
  line(c, [[-1, 3], [-1, -4.4], [5, -5.4], [5, 2]], INK, 1.3);
});

// Effects.
const steam = sprite([-6, -6, 6, 6], (c) => c.drawCircle(0, 0, 3.6, blurred('#FFFFFF', 0.85, 1.6)));
const sparkle = sprite([-6, -6, 6, 6], (c) => {
  const p = path.smooth([[0, -5], [1, -1], [5, 0], [1, 1], [0, 5], [-1, 1], [-5, 0], [-1, -1]], true, 0.2);
  c.drawPath(p, glowStroke('#FFF3B0', 2, 0.7, 1.2));
  c.drawPath(p, fill('#FFFFFF'));
});
const soap = sprite([-4, -4, 4, 4], (c) => {
  c.drawCircle(0, 0, 2.4, fill('#E8F7FF', 0.5));
  c.drawCircle(0, 0, 2.4, stroke('#8FC9E8', 0.7));
  dot(c, -0.8, -0.9, 0.6, '#FFFFFF');
});
const glow = sprite([-14, -14, 14, 14], (c: SkCanvas) => c.drawCircle(0, 0, 8, blurred('#FFD27A', 0.6, 4)));

export const fxSprites = { bubble, heart, anger, clock, coin, star, exclaim, zzz, music, steam, sparkle, soap, glow };
