// `node scripts/make-icons.mjs`: draws the app icon and its variants (Android adaptive layers,
// the splash image, the web favicon) into assets/*.png with CanvasKit (the same Skia the game
// draws with). In the game's look: a golden chef hat over a plate with a gold coin, on a deep
// plum background with a soft glow. Re-run after changing the drawing.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import CanvasKitInit from 'canvaskit-wasm';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const ck = await CanvasKitInit();

const color = (hex, a = 1) => {
  const n = parseInt(hex.slice(1), 16);
  return ck.Color((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
};
const paint = (hex, a = 1) => {
  const p = new ck.Paint();
  p.setAntiAlias(true);
  p.setColor(color(hex, a));
  return p;
};
const strokePaint = (hex, w) => {
  const p = paint(hex);
  p.setStyle(ck.PaintStyle.Stroke);
  p.setStrokeWidth(w);
  p.setStrokeJoin(ck.StrokeJoin.Round);
  p.setStrokeCap(ck.StrokeCap.Round);
  return p;
};
const radial = (x, y, r, stops) => {
  const p = new ck.Paint();
  p.setAntiAlias(true);
  p.setShader(ck.Shader.MakeRadialGradient([x, y], r, stops.map(([c, a = 1]) => color(c, a)), stops.map((_, i) => i / (stops.length - 1)), ck.TileMode.Clamp));
  return p;
};
const linear = (x0, y0, x1, y1, stops) => {
  const p = new ck.Paint();
  p.setAntiAlias(true);
  p.setShader(ck.Shader.MakeLinearGradient([x0, y0], [x1, y1], stops.map((c) => color(c)), stops.map((_, i) => i / (stops.length - 1)), ck.TileMode.Clamp));
  return p;
};
const rrect = (x, y, w, h, r) => ck.RRectXY(ck.XYWHRect(x, y, w, h), r, r);

/** The emblem on a 1024 canvas centered at (512, 512); `k` scales it (adaptive icons need room). */
function emblem(c, k) {
  c.save();
  c.translate(512, 512);
  c.scale(k, k);
  c.translate(-512, -512);
  // Plate: a big white ellipse with a gold rim and a shadow.
  c.drawOval(ck.XYWHRect(186, 600, 652, 230), paint('#120818', 0.35));
  c.drawOval(ck.XYWHRect(196, 560, 632, 230), linear(512, 560, 512, 790, ['#FFFFFF', '#DDE2EA']));
  c.drawOval(ck.XYWHRect(196, 560, 632, 230), strokePaint('#E2B13C', 14));
  c.drawOval(ck.XYWHRect(270, 595, 484, 160), strokePaint('#C9CED8', 6));
  // Chef hat: three puffs over a band, golden.
  const puff = (x, y, r) => {
    c.drawCircle(x, y + 10, r, paint('#2A0E30', 0.45));
    c.drawCircle(x, y, r, radial(x - r * 0.35, y - r * 0.45, r * 1.5, [['#FFFFFF'], ['#F4EEF8'], ['#C9B8D6']]));
  };
  puff(390, 330, 120);
  puff(634, 330, 120);
  puff(512, 270, 150);
  c.drawRRect(rrect(352, 380, 320, 190, 40), linear(512, 380, 512, 570, ['#FFFFFF', '#EDE4F2', '#C9B8D6']));
  c.drawRRect(rrect(352, 380, 320, 190, 40), strokePaint('#6A4A7A', 9));
  for (const x of [432, 512, 592]) c.drawLine(x, 410, x, 530, strokePaint('#C9B8D6', 10));
  c.drawRRect(rrect(330, 520, 364, 70, 30), linear(512, 520, 512, 590, ['#FFE27A', '#F2B021', '#C8800A']));
  c.drawRRect(rrect(330, 520, 364, 70, 30), strokePaint('#8A5206', 10));
  // A gold coin leaning on the plate, with a star.
  c.drawCircle(735, 650, 112, paint('#7A4A06', 0.5));
  c.drawCircle(730, 640, 112, radial(700, 600, 160, [['#FFF6B0'], ['#FFC21A'], ['#D8860A']]));
  c.drawCircle(730, 640, 112, strokePaint('#9A6A00', 10));
  c.drawCircle(730, 640, 80, strokePaint('#E09A00', 8));
  const b = new ck.PathBuilder();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 52 : 22;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = 730 + Math.cos(a) * r;
    const y = 640 + Math.sin(a) * r;
    if (i === 0) b.moveTo(x, y);
    else b.lineTo(x, y);
  }
  b.close();
  const p = b.detachAndDelete();
  c.drawPath(p, paint('#FFF6C8'));
  c.drawPath(p, strokePaint('#C8800A', 5));
  c.restore();
}

/** The plum background with a warm glow and a few sparkles (not on the Android layer: the
 * launcher shows only its middle, where the sparkles would crowd the emblem). */
function backdrop(c, size, sparkles = true) {
  const s = size / 1024;
  c.save();
  c.scale(s, s);
  c.drawRect(ck.XYWHRect(0, 0, 1024, 1024), radial(512, 430, 760, [['#7A2E8A'], ['#4A1752'], ['#2A0E30']]));
  c.drawCircle(512, 470, 380, radial(512, 470, 380, [['#FFD23F', 0.35], ['#FFD23F', 0]]));
  for (const [x, y, r] of sparkles ? [[170, 200, 34], [860, 250, 42], [140, 770, 24], [884, 820, 30], [800, 120, 20]] : []) {
    const b = new ck.PathBuilder();
    for (let i = 0; i < 8; i++) {
      const d = i % 2 === 0 ? r : r * 0.22;
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      if (i === 0) b.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      else b.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    b.close();
    c.drawPath(b.detachAndDelete(), paint('#FFF6C8', 0.9));
  }
  c.restore();
}

function png(size, draw) {
  const surface = ck.MakeSurface(size, size);
  const c = surface.getCanvas();
  c.clear(ck.TRANSPARENT);
  draw(c, size);
  surface.flush();
  const image = surface.makeImageSnapshot();
  const bytes = image.encodeToBytes();
  image.delete();
  surface.delete();
  return Buffer.from(bytes);
}

const scaled = (size, k) => (c) => {
  c.save();
  c.scale(size / 1024, size / 1024);
  emblem(c, k);
  c.restore();
};

// The store icon: everything on one square.
writeFileSync(join(OUT, 'icon.png'), png(1024, (c, size) => {
  backdrop(c, size);
  scaled(size, 1)(c);
}));
// Android adaptive icon: the emblem inside the safe circle (the middle 66 of 108 dp) that every
// launcher mask keeps, the background apart.
const ADAPTIVE = 0.7;
writeFileSync(join(OUT, 'android-icon-foreground.png'), png(512, (c, size) => scaled(size, ADAPTIVE)(c)));
writeFileSync(join(OUT, 'android-icon-background.png'), png(512, (c, size) => backdrop(c, size, false)));
writeFileSync(join(OUT, 'android-icon-monochrome.png'), png(512, (c, size) => {
  c.saveLayer();
  scaled(size, ADAPTIVE)(c);
  const tint = new ck.Paint();
  tint.setBlendMode(ck.BlendMode.SrcIn);
  tint.setColor(ck.WHITE);
  c.drawRect(ck.XYWHRect(0, 0, size, size), tint);
  c.restore();
}));
// The native splash image and the web favicon.
writeFileSync(join(OUT, 'splash-icon.png'), png(1024, (c, size) => scaled(size, 0.9)(c)));
writeFileSync(join(OUT, 'favicon.png'), png(64, (c, size) => {
  backdrop(c, size);
  scaled(size, 1.05)(c);
}));
console.log('Wrote the icons to', OUT);
