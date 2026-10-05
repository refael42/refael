import { ClipOp, Skia, TileMode, vec, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';
import type { SceneDef } from '../../data/scenes';
import { bumps } from './characterArt';
import { darken } from './color';
import { blurred, dot, fill, ink, line, path, rect, stroke } from './kit';

// Static backdrop, recorded once as a vector picture and replayed every frame (cheap, crisp).

const WALL = '#FFF0D8';
const WAINSCOT = '#C9694E';
const RAIL = '#8E5A3C';

function planks(c: SkCanvas, x0: number, y0: number, w: number, h: number) {
  const ph = 16;
  c.drawRect(rect(x0, y0, w, h), fill('#E6B985'));
  for (let row = 0, y = y0; y < y0 + h; row++, y += ph) {
    c.drawRect(rect(x0, y, w, ph), fill(row % 2 === 0 ? '#E9BE8C' : '#E2B27E'));
    c.drawRect(rect(x0, y + ph - 1.2, w, 1.2), fill('#C99662'));
    const offset = (row * 37) % 70;
    for (let x = x0 - offset; x < x0 + w; x += 70) {
      c.drawRect(rect(x, y, 1.1, ph - 1.2), fill('#CF9E69'));
      dot(c, x + 4, y + 4, 0.6, '#B98652');
      dot(c, x + 4, y + ph - 5, 0.6, '#B98652');
    }
    c.drawRect(rect(x0, y, w, 2), fill('#FFFFFF', 0.08));
  }
}

function tiles(c: SkCanvas, x0: number, y0: number, w: number, h: number) {
  const tw = 18;
  const th = 12;
  c.drawRect(rect(x0, y0, w, h), fill('#F6EAD7'));
  for (let r = 0; r * th < h; r++) {
    for (let col = 0; col * tw < w; col++) {
      if ((r + col) % 2 === 0) c.drawRect(rect(x0 + col * tw, y0 + r * th, tw, th), fill('#EDBBA4'));
    }
  }
  for (let r = 0; r * th <= h; r++) c.drawRect(rect(x0, y0 + r * th, w, 0.6), fill('#D9B79D', 0.6));
}

function windowWithAwning(c: SkCanvas, x: number, y: number, w: number, h: number) {
  ink(c, path.rrect(x - 4, y - 4, w + 8, h + 8, 5), RAIL, { depth: 2 });
  const glass = path.rrect(x, y, w, h, 3);
  const sky = Skia.Paint();
  sky.setShader(Skia.Shader.MakeLinearGradient(vec(0, y), vec(0, y + h), [Skia.Color('#9ED7F2'), Skia.Color('#FFE6BF')], null, TileMode.Clamp));
  c.drawPath(glass, sky);
  c.save();
  c.clipPath(glass, ClipOp.Intersect, true);
  c.drawPath(bumps([[x + 22, y + 22, 7], [x + 31, y + 18, 9], [x + 41, y + 23, 6.5]]), fill('#FFFFFF', 0.9));
  c.drawPath(bumps([[x + 72, y + 36, 5], [x + 80, y + 32, 7], [x + 88, y + 37, 5]]), fill('#FFFFFF', 0.8));
  // Street outside: rooftops of the houses across the road.
  c.drawRect(rect(x, y + h - 22, w, 22), fill('#F2C9B0'));
  for (const [bx, bw, bh, col] of [[x - 4, 30, 34, '#E8A890'], [x + 24, 26, 26, '#F4D2A2'], [x + 48, 34, 40, '#E3B7A6'], [x + 80, 30, 30, '#F0BFA0']] as const) {
    c.drawRect(rect(bx, y + h - bh, bw, bh), fill(col));
    for (let wy = y + h - bh + 6; wy < y + h - 6; wy += 9) {
      for (let wx = bx + 5; wx < bx + bw - 6; wx += 9) c.drawRect(rect(wx, wy, 4, 5), fill('#FFF3D6', 0.9));
    }
  }
  c.drawRect(rect(x + w * 0.62, y, w * 0.12, h), fill('#FFFFFF', 0.18));
  c.restore();
  c.drawPath(glass, stroke('#4A2F27', 1.4));
  ink(c, path.rrect(x + w / 2 - 2, y, 4, h, 1), RAIL, { line: 1, light: false });
  ink(c, path.rrect(x, y + h * 0.48 - 2, w, 4, 1), RAIL, { line: 1, light: false });
  ink(c, path.rrect(x - 8, y + h + 2, w + 16, 6, 2), RAIL, { depth: 1.4 });
  // Striped scalloped awning: the street-food stand signature.
  const ax = x - 10;
  const aw = w + 20;
  const stripes = 8;
  const sw = aw / stripes;
  const b = Skia.PathBuilder.Make();
  b.moveTo(ax, y - 16);
  b.lineTo(ax + aw, y - 16);
  b.lineTo(ax + aw, y + 2);
  for (let i = stripes - 1; i >= 0; i--) b.quadTo(ax + i * sw + sw / 2, y + 10, ax + i * sw, y + 2);
  const awning = b.close().build();
  c.drawPath(awning, stroke('#4A2F27', 3));
  c.save();
  c.clipPath(awning, ClipOp.Intersect, true);
  for (let i = 0; i < stripes; i++) c.drawRect(rect(ax + i * sw, y - 16, sw, 28), fill(i % 2 === 0 ? '#E25545' : '#FFF6EA'));
  c.drawRect(rect(ax, y - 16, aw, 5), fill('#3A1F18', 0.12));
  c.restore();
}

function chalkboard(c: SkCanvas, x: number, y: number, w: number, h: number) {
  line(c, [[x + w / 2, y - 12], [x + 8, y]], '#6E4330', 1.1);
  line(c, [[x + w / 2, y - 12], [x + w - 8, y]], '#6E4330', 1.1);
  dot(c, x + w / 2, y - 12, 1.6, '#6E4330');
  ink(c, path.rrect(x - 4, y - 4, w + 8, h + 8, 4), RAIL, { depth: 1.6 });
  c.drawRect(rect(x, y, w, h), fill('#2F4A3F'));
  const chalk = (pts: [number, number][], smooth = true) => line(c, pts.map(([px, py]) => [x + px, y + py]), '#F4F1E8', 1.1, smooth);
  chalk([[10, 10], [26, 6], [44, 11], [60, 6], [74, 10]]);
  // Burger.
  chalk([[10, 30], [12, 22], [20, 19], [28, 22], [30, 30]]);
  chalk([[9, 33], [31, 33]], false);
  chalk([[10, 37], [30, 37]], false);
  // Fries.
  for (const fx of [43, 47, 51]) chalk([[fx, 37], [fx + 1, 22]], false);
  chalk([[40, 28], [54, 28], [52, 39], [42, 39], [40, 28]], false);
  // Drink.
  chalk([[63, 22], [75, 22], [73, 39], [65, 39], [63, 22]], false);
  chalk([[70, 22], [74, 15]], false);
  for (let r = 0; r < 3; r++) {
    chalk([[10, 48 + r * 8], [34, 48 + r * 8]], false);
    for (let d = 0; d < 4; d++) dot(c, x + 42 + d * 5, y + 48 + r * 8, 0.6, '#F4F1E8');
    chalk([[64, 48 + r * 8], [74, 48 + r * 8]], false);
  }
  c.drawRect(rect(x, y + h - 4, w, 4), fill('#24382F'));
}

function wall(c: SkCanvas, width: number, top: number) {
  c.drawRect(rect(0, 0, width, top), fill(WALL));
  for (let x = 0; x < width; x += 18) c.drawRect(rect(x, 0, 9, top - 44), fill('#FBE6C8'));
  c.drawRect(rect(0, top - 44, width, 44), fill(WAINSCOT));
  for (let x = 6; x < width; x += 30) {
    c.drawRect(rect(x, top - 38, 24, 28), stroke(darken(WAINSCOT, 0.12), 1.2));
  }
  ink(c, path.rrect(-4, top - 47, width + 8, 6, 2), RAIL, { depth: 1.2 });
  c.drawRect(rect(0, top - 7, width, 7), fill('#6E4330'));
  c.drawRect(rect(0, top, width, 6), fill('#3A1F18', 0.18));
}

function rug(c: SkCanvas, cx: number, cy: number, rx: number, ry: number) {
  c.drawOval(rect(cx - rx, cy - ry, rx * 2, ry * 2), blurred('#3A1F18', 0.12, 3));
  ink(c, path.oval(cx, cy, rx, ry), '#D9614C', { shade: false, light: false, line: 1.3 });
  c.drawOval(rect(cx - rx + 5, cy - ry + 3, (rx - 5) * 2, (ry - 3) * 2), stroke('#F2C14E', 2));
  c.drawOval(rect(cx - rx + 10, cy - ry + 6, (rx - 10) * 2, (ry - 6) * 2), stroke('#FBEAD2', 1.4));
}

export function recordBackground(scene: SceneDef): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(rect(0, 0, scene.width, scene.height));
  const { width, height, floorTop } = scene;
  if (scene.id === 'styleTest') {
    wall(c, width, floorTop);
    windowWithAwning(c, 132, 34, 96, 64);
    chalkboard(c, 16, 30, 84, 74);
    tiles(c, 0, floorTop, width, 112);
    c.drawRect(rect(0, floorTop + 112, width, 4), fill('#B07443'));
    planks(c, 0, floorTop + 116, width, height - floorTop - 116);
    // Warm window light spilling onto the floor.
    c.drawPath(
      path.poly([[132, floorTop], [228, floorTop], [270, floorTop + 90], [150, floorTop + 90]]),
      blurred('#FFF6D8', 0.3, 6),
    );
    rug(c, 120, 452, 62, 25);
    ink(c, path.rrect(170, 640, 60, 16, 4), '#8C6A4F', { light: false, depth: 1 });
    for (let x = 176; x < 226; x += 6) line(c, [[x, 643], [x, 653]], '#7A5B43', 0.9);
  } else {
    planks(c, 0, 0, width, height);
    for (const y of [118, 222]) {
      for (const x of [45, 130, 215]) c.drawOval(rect(x - 30, y - 9, 60, 18), fill('#FFF6D8', 0.35));
    }
  }
  return rec.finishRecordingAsPicture();
}

/** Soft dark edges; pulls the eye to the center and makes the scene feel lit. */
export function recordVignette(width: number, height: number): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(rect(0, 0, width, height));
  const p = Skia.Paint();
  p.setShader(
    Skia.Shader.MakeRadialGradient(
      vec(width / 2, height * 0.45),
      Math.max(width, height) * 0.75,
      [Skia.Color('rgba(58,31,24,0)'), Skia.Color('rgba(58,31,24,0)'), Skia.Color('rgba(58,31,24,0.28)')],
      [0, 0.6, 1],
      TileMode.Clamp,
    ),
  );
  c.drawRect(rect(0, 0, width, height), p);
  return rec.finishRecordingAsPicture();
}
