/**
 * Vector icons drawn in a 64 x 64 box. Used both in the world (bubbles over
 * planes) and in the React Native UI (through an exported PNG sheet).
 */
import { PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';

import { OUTLINE, shade } from './color';

export const ICON_NAMES = [
  'coin', 'diamond', 'star', 'starEmpty', 'land', 'takeoff', 'fuel', 'pax', 'wrench', 'clock', 'sun', 'cloud',
  'gear', 'check', 'warn', 'close', 'plus', 'bag', 'hold', 'bubble', 'plane', 'hourglass',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

interface Pens {
  f: SkPaint;
  s: SkPaint;
}

function pens(): Pens {
  const f = Skia.Paint();
  f.setAntiAlias(true);
  f.setStyle(PaintStyle.Fill);
  const s = Skia.Paint();
  s.setAntiAlias(true);
  s.setStyle(PaintStyle.Stroke);
  s.setStrokeJoin(StrokeJoin.Round);
  s.setStrokeCap(StrokeCap.Round);
  return { f, s };
}

function path(pts: number[], close = true) {
  const b = Skia.PathBuilder.Make();
  for (let i = 0; i < pts.length; i += 2) {
    if (i === 0) b.moveTo(pts[i], pts[i + 1]);
    else b.lineTo(pts[i], pts[i + 1]);
  }
  if (close) b.close();
  return b.build();
}

/** Top-view airplane silhouette pointing up, centered at (32, 32). */
function planePts(): number[] {
  return [
    32, 6, 35, 10, 35.5, 24, 58, 36, 58, 40, 35.5, 34, 35, 49, 43, 55, 43, 58, 32, 55.5, 21, 58, 21, 55, 29, 49, 28.5, 34, 6, 40, 6, 36, 28.5, 24, 29, 10,
  ];
}

export function drawIcon(canvas: SkCanvas, name: IconName, x: number, y: number, size: number): void {
  const { f, s } = pens();
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(size / 64, size / 64);
  const ol = Skia.Color(OUTLINE);
  const filled = (p: ReturnType<typeof path>, color: string, ow = 5) => {
    s.setColor(ol);
    s.setStrokeWidth(ow);
    canvas.drawPath(p, s);
    f.setColor(Skia.Color(color));
    canvas.drawPath(p, f);
  };
  const circ = (cx: number, cy: number, r: number, color: string, ow = 5) => {
    f.setColor(ol);
    canvas.drawCircle(cx, cy, r + ow / 2, f);
    f.setColor(Skia.Color(color));
    canvas.drawCircle(cx, cy, r, f);
  };
  const stroke = (pts: number[], color: string, w: number, close = false) => {
    const p = path(pts, close);
    s.setColor(ol);
    s.setStrokeWidth(w + 5);
    canvas.drawPath(p, s);
    s.setColor(Skia.Color(color));
    s.setStrokeWidth(w);
    canvas.drawPath(p, s);
  };

  switch (name) {
    case 'coin': {
      circ(32, 32, 25, '#e9a92b');
      f.setColor(Skia.Color('#ffd23f'));
      canvas.drawCircle(32, 30, 23, f);
      f.setColor(Skia.Color('#f2b632'));
      canvas.drawCircle(32, 31, 16, f);
      // small wing emblem
      f.setColor(Skia.Color('#fff2b0'));
      canvas.drawPath(path([18, 31, 32, 24, 46, 31, 38, 31, 32, 37, 26, 31]), f);
      f.setColor(Skia.Color('rgba(255,255,255,0.75)'));
      canvas.drawOval(Skia.XYWHRect(16, 13, 14, 7), f);
      break;
    }
    case 'diamond': {
      const outer = path([18, 12, 46, 12, 58, 26, 32, 56, 6, 26]);
      filled(outer, '#4fd8f0');
      f.setColor(Skia.Color('#b8f3ff'));
      canvas.drawPath(path([18, 12, 32, 12, 24, 26, 6, 26]), f);
      f.setColor(Skia.Color('#2bb5d6'));
      canvas.drawPath(path([40, 26, 58, 26, 32, 56]), f);
      f.setColor(Skia.Color('#8ae9fb'));
      canvas.drawPath(path([24, 26, 40, 26, 32, 56]), f);
      break;
    }
    case 'star':
    case 'starEmpty': {
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 27 : 12;
        pts.push(32 + Math.cos(a) * r, 34 + Math.sin(a) * r);
      }
      filled(path(pts), name === 'star' ? '#ffd23f' : '#c5cad3');
      if (name === 'star') {
        f.setColor(Skia.Color('rgba(255,255,255,0.6)'));
        canvas.drawCircle(26, 26, 4, f);
      }
      break;
    }
    case 'plane':
    case 'land':
    case 'takeoff': {
      canvas.save();
      if (name === 'land') {
        canvas.translate(32, 30);
        canvas.rotate(135, 0, 0);
        canvas.translate(-32, -32);
      } else if (name === 'takeoff') {
        canvas.translate(32, 30);
        canvas.rotate(45, 0, 0);
        canvas.translate(-32, -32);
      }
      filled(path(planePts()), '#ffffff', 5);
      canvas.restore();
      if (name !== 'plane') {
        s.setColor(Skia.Color(name === 'land' ? '#2f9e6b' : '#1f6fd1'));
        s.setStrokeWidth(6);
        canvas.drawLine(8, 58, 56, 58, s);
      }
      break;
    }
    case 'fuel': {
      const b = Skia.PathBuilder.Make();
      b.moveTo(32, 6);
      b.cubicTo(42, 20, 52, 30, 52, 40);
      b.cubicTo(52, 52, 43, 59, 32, 59);
      b.cubicTo(21, 59, 12, 52, 12, 40);
      b.cubicTo(12, 30, 22, 20, 32, 6);
      b.close();
      filled(b.build(), '#ff9f1c');
      f.setColor(Skia.Color('rgba(255,255,255,0.65)'));
      canvas.drawOval(Skia.XYWHRect(19, 34, 8, 14), f);
      break;
    }
    case 'pax': {
      circ(32, 19, 11, '#f2c7a5');
      const b = Skia.PathBuilder.Make();
      b.moveTo(12, 58);
      b.cubicTo(12, 40, 20, 33, 32, 33);
      b.cubicTo(44, 33, 52, 40, 52, 58);
      b.close();
      filled(b.build(), '#3d8bfd');
      break;
    }
    case 'wrench': {
      stroke([18, 48, 40, 26], '#c5cad3', 9);
      circ(44, 21, 10, '#c5cad3');
      f.setColor(Skia.Color(OUTLINE));
      canvas.drawRect(Skia.XYWHRect(44, 12, 7, 9), f);
      break;
    }
    case 'clock': {
      circ(32, 32, 24, '#ffffff');
      stroke([32, 32, 32, 18], OUTLINE, 3);
      stroke([32, 32, 42, 37], OUTLINE, 3);
      break;
    }
    case 'sun': {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        stroke([32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 32 + Math.cos(a) * 27, 32 + Math.sin(a) * 27], '#ffd23f', 4);
      }
      circ(32, 32, 15, '#ffc93c');
      f.setColor(Skia.Color('rgba(255,255,255,0.6)'));
      canvas.drawCircle(27, 27, 4, f);
      break;
    }
    case 'cloud': {
      const b = Skia.PathBuilder.Make();
      b.addCircle(22, 38, 12);
      b.addCircle(36, 30, 15);
      b.addCircle(46, 40, 10);
      b.addRRect(Skia.RRectXY(Skia.XYWHRect(12, 36, 44, 14), 7, 7));
      const p = b.build();
      s.setColor(ol);
      s.setStrokeWidth(5);
      canvas.drawPath(p, s);
      f.setColor(Skia.Color('#f4f7fb'));
      canvas.drawPath(p, f);
      break;
    }
    case 'gear': {
      const pts: number[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        const r = i % 2 === 0 ? 26 : 20;
        pts.push(32 + Math.cos(a - 0.1) * r, 32 + Math.sin(a - 0.1) * r, 32 + Math.cos(a + 0.1) * r, 32 + Math.sin(a + 0.1) * r);
      }
      filled(path(pts), '#c5cad3');
      circ(32, 32, 8, '#6b7280', 4);
      break;
    }
    case 'check': {
      stroke([14, 34, 27, 47, 51, 19], '#3fcf6e', 8);
      break;
    }
    case 'warn': {
      filled(path([32, 8, 58, 54, 6, 54]), '#ffc93c');
      stroke([32, 24, 32, 38], OUTLINE, 3);
      f.setColor(ol);
      canvas.drawCircle(32, 46, 3.5, f);
      break;
    }
    case 'close': {
      stroke([18, 18, 46, 46], '#ffffff', 7);
      stroke([46, 18, 18, 46], '#ffffff', 7);
      break;
    }
    case 'plus': {
      circ(32, 32, 24, '#3fcf6e');
      s.setColor(Skia.Color('#ffffff'));
      s.setStrokeWidth(7);
      canvas.drawLine(32, 19, 32, 45, s);
      canvas.drawLine(19, 32, 45, 32, s);
      break;
    }
    case 'bag': {
      stroke([24, 18, 24, 10, 40, 10, 40, 18], '#6b4a2a', 4);
      filled(path([10, 18, 54, 18, 54, 54, 10, 54]), '#c4793a');
      f.setColor(Skia.Color(shade('#c4793a', -0.25)));
      canvas.drawRect(Skia.XYWHRect(18, 18, 5, 36), f);
      canvas.drawRect(Skia.XYWHRect(41, 18, 5, 36), f);
      break;
    }
    case 'hold': {
      const b = Skia.PathBuilder.Make();
      b.addArc(Skia.XYWHRect(12, 12, 40, 40), 200, 290);
      const p = b.build();
      s.setColor(ol);
      s.setStrokeWidth(12);
      canvas.drawPath(p, s);
      s.setColor(Skia.Color('#ffffff'));
      s.setStrokeWidth(6);
      canvas.drawPath(p, s);
      filled(path([8, 22, 22, 22, 12, 34]), '#ffffff', 4);
      break;
    }
    case 'hourglass': {
      filled(path([16, 8, 48, 8, 34, 32, 48, 56, 16, 56, 30, 32]), '#ffe7a3');
      f.setColor(Skia.Color('#e9a92b'));
      canvas.drawPath(path([22, 50, 42, 50, 32, 40]), f);
      break;
    }
    case 'bubble': {
      const b = Skia.PathBuilder.Make();
      b.addRRect(Skia.RRectXY(Skia.XYWHRect(4, 4, 56, 46), 16, 16));
      b.moveTo(24, 48);
      b.lineTo(32, 60);
      b.lineTo(40, 48);
      b.close();
      const p = b.build();
      s.setColor(ol);
      s.setStrokeWidth(5);
      canvas.drawPath(p, s);
      f.setColor(Skia.Color('#ffffff'));
      canvas.drawPath(p, f);
      f.setColor(Skia.Color('#e8eef7'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(8, 38, 48, 10), 5, 5), f);
      break;
    }
  }
  canvas.restore();
}
