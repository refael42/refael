/**
 * Flat, modern vector icons drawn in a 64 x 64 box (no outlines). Used in the
 * world (action bubbles over planes) and in the React Native UI (PNG sheet).
 */
import { BlurStyle, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';

import { shade } from './color';

export const ICON_NAMES = [
  'coin', 'diamond', 'star', 'starEmpty', 'land', 'takeoff', 'fuel', 'pax', 'wrench', 'clock', 'sun', 'cloud',
  'gear', 'check', 'warn', 'close', 'plus', 'bag', 'hold', 'bubble', 'plane', 'hourglass',
  'actLand', 'actFuel', 'actBoard', 'actTakeoff', 'actBags', 'team', 'wait', 'hand', 'build',
  'tail', 'board', 'handshake', 'up', 'wind', 'fog', 'arrow', 'actRepair', 'bell',
  'medic', 'camera', 'ticket', 'party', 'search', 'guide',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/** Accent colors shared with the UI. */
export const ACTION_COLORS = {
  land: '#10b981',
  fuel: '#f59e0b',
  board: '#3b82f6',
  takeoff: '#6366f1',
  bags: '#8b5cf6',
  repair: '#ef4444',
} as const;

const SLATE = '#334155';

function pens(): { f: SkPaint; s: SkPaint } {
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
function planePath() {
  return path([
    32, 5, 35.5, 9, 36, 24, 59, 36.5, 59, 41, 36, 35, 35.5, 49, 43.5, 55, 43.5, 58.5, 32, 56, 20.5, 58.5, 20.5, 55, 28.5, 49, 28, 35, 5, 41, 5, 36.5, 28, 24, 28.5, 9,
  ]);
}

function drawPlane(canvas: SkCanvas, f: SkPaint, color: string, rotateDeg: number) {
  canvas.save();
  canvas.translate(32, 32);
  canvas.rotate(rotateDeg, 0, 0);
  canvas.translate(-32, -32);
  f.setColor(Skia.Color(color));
  canvas.drawPath(planePath(), f);
  canvas.restore();
}

/** Glyph used inside a round action bubble (white on color). */
function actionGlyph(canvas: SkCanvas, kind: 'land' | 'fuel' | 'board' | 'takeoff' | 'bags' | 'repair', f: SkPaint) {
  canvas.save();
  canvas.translate(32, 28);
  canvas.scale(0.52, 0.52);
  canvas.translate(-32, -32);
  if (kind === 'repair') {
    // a wrench: handle and an open jaw
    const st = Skia.Paint();
    st.setAntiAlias(true);
    st.setStyle(PaintStyle.Stroke);
    st.setStrokeCap(StrokeCap.Round);
    st.setStrokeWidth(11);
    st.setColor(Skia.Color('#ffffff'));
    canvas.drawLine(14, 52, 38, 28, st);
    f.setColor(Skia.Color('#ffffff'));
    canvas.drawCircle(44, 21, 15, f);
    f.setColor(Skia.Color(ACTION_COLORS.repair));
    canvas.drawPath(path([44, 21, 62, 10, 62, 22, 52, 27]), f);
    canvas.drawCircle(44, 21, 5, f);
  } else if (kind === 'land') drawPlane(canvas, f, '#ffffff', 135);
  else if (kind === 'takeoff') drawPlane(canvas, f, '#ffffff', 45);
  else if (kind === 'bags') {
    f.setColor(Skia.Color('#ffffff'));
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(10, 18, 44, 38), 8, 8), f);
    const st = Skia.Paint();
    st.setAntiAlias(true);
    st.setStyle(PaintStyle.Stroke);
    st.setStrokeWidth(5);
    st.setColor(Skia.Color('#ffffff'));
    canvas.drawPath(path([24, 18, 24, 9, 40, 9, 40, 18], false), st);
  } else if (kind === 'fuel') {
    const b = Skia.PathBuilder.Make();
    b.moveTo(32, 4);
    b.cubicTo(43, 19, 54, 31, 54, 42);
    b.cubicTo(54, 54, 44, 61, 32, 61);
    b.cubicTo(20, 61, 10, 54, 10, 42);
    b.cubicTo(10, 31, 21, 19, 32, 4);
    b.close();
    f.setColor(Skia.Color('#ffffff'));
    canvas.drawPath(b.build(), f);
  } else {
    f.setColor(Skia.Color('#ffffff'));
    canvas.drawCircle(32, 17, 12, f);
    const b = Skia.PathBuilder.Make();
    b.moveTo(8, 60);
    b.cubicTo(8, 40, 18, 33, 32, 33);
    b.cubicTo(46, 33, 56, 40, 56, 60);
    b.close();
    canvas.drawPath(b.build(), f);
  }
  canvas.restore();
}

export function drawIcon(canvas: SkCanvas, name: IconName, x: number, y: number, size: number): void {
  const { f, s } = pens();
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(size / 64, size / 64);
  const circ = (cx: number, cy: number, r: number, color: string) => {
    f.setColor(Skia.Color(color));
    canvas.drawCircle(cx, cy, r, f);
  };
  const stroke = (pts: number[], color: string, w: number, close = false) => {
    s.setColor(Skia.Color(color));
    s.setStrokeWidth(w);
    canvas.drawPath(path(pts, close), s);
  };

  switch (name) {
    case 'coin': {
      circ(32, 33.5, 26, '#d48a0f');
      circ(32, 31, 26, '#fbbf24');
      circ(32, 31, 19, '#f59e0b');
      circ(32, 30, 18, '#fcd34d');
      f.setColor(Skia.Color('#f59e0b'));
      canvas.drawPath(path([18, 31, 32, 23, 46, 31, 38.5, 31, 32, 38, 25.5, 31]), f);
      f.setColor(Skia.Color('rgba(255,255,255,0.7)'));
      canvas.drawOval(Skia.XYWHRect(17, 13, 13, 6), f);
      break;
    }
    case 'diamond': {
      f.setColor(Skia.Color('#22d3ee'));
      canvas.drawPath(path([17, 11, 47, 11, 59, 25, 32, 57, 5, 25]), f);
      f.setColor(Skia.Color('#a5f3fc'));
      canvas.drawPath(path([17, 11, 32, 11, 24, 25, 5, 25]), f);
      f.setColor(Skia.Color('#0891b2'));
      canvas.drawPath(path([40, 25, 59, 25, 32, 57]), f);
      f.setColor(Skia.Color('#67e8f9'));
      canvas.drawPath(path([24, 25, 40, 25, 32, 57]), f);
      break;
    }
    case 'star':
    case 'starEmpty': {
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 27 : 12.5;
        pts.push(32 + Math.cos(a) * r, 34 + Math.sin(a) * r);
      }
      const p = path(pts);
      const col = name === 'star' ? '#fbbf24' : '#cbd5e1';
      s.setColor(Skia.Color(col));
      s.setStrokeWidth(5);
      canvas.drawPath(p, s);
      f.setColor(Skia.Color(col));
      canvas.drawPath(p, f);
      if (name === 'star') {
        f.setColor(Skia.Color('#fde68a'));
        canvas.drawPath(path([32, 9, 37, 27, 32, 34, 27, 27]), f);
      }
      break;
    }
    case 'plane':
      drawPlane(canvas, f, '#6366f1', 0);
      break;
    case 'land':
      drawPlane(canvas, f, ACTION_COLORS.land, 135);
      break;
    case 'takeoff':
      drawPlane(canvas, f, ACTION_COLORS.takeoff, 45);
      break;
    case 'fuel': {
      const b = Skia.PathBuilder.Make();
      b.moveTo(32, 5);
      b.cubicTo(43, 19, 53, 30, 53, 41);
      b.cubicTo(53, 53, 44, 60, 32, 60);
      b.cubicTo(20, 60, 11, 53, 11, 41);
      b.cubicTo(11, 30, 21, 19, 32, 5);
      b.close();
      f.setColor(Skia.Color(ACTION_COLORS.fuel));
      canvas.drawPath(b.build(), f);
      f.setColor(Skia.Color('rgba(255,255,255,0.55)'));
      canvas.drawOval(Skia.XYWHRect(19, 35, 7, 13), f);
      break;
    }
    case 'pax': {
      circ(32, 19, 11, ACTION_COLORS.board);
      const b = Skia.PathBuilder.Make();
      b.moveTo(11, 58);
      b.cubicTo(11, 40, 20, 34, 32, 34);
      b.cubicTo(44, 34, 53, 40, 53, 58);
      b.close();
      f.setColor(Skia.Color(ACTION_COLORS.board));
      canvas.drawPath(b.build(), f);
      break;
    }
    case 'wrench':
      stroke([18, 47, 40, 25], '#64748b', 9);
      circ(44, 20, 10, '#64748b');
      circ(48, 16, 4.5, '#ffffff');
      break;
    case 'clock':
      s.setColor(Skia.Color(SLATE));
      s.setStrokeWidth(5);
      canvas.drawCircle(32, 32, 23, s);
      stroke([32, 32, 32, 18], SLATE, 5);
      stroke([32, 32, 41, 37], SLATE, 5);
      break;
    case 'sun':
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        stroke([32 + Math.cos(a) * 21, 32 + Math.sin(a) * 21, 32 + Math.cos(a) * 27, 32 + Math.sin(a) * 27], '#f59e0b', 5);
      }
      circ(32, 32, 15, '#fbbf24');
      break;
    case 'cloud': {
      const b = Skia.PathBuilder.Make();
      b.addCircle(22, 38, 12);
      b.addCircle(36, 30, 15);
      b.addCircle(46, 40, 10);
      b.addRRect(Skia.RRectXY(Skia.XYWHRect(12, 36, 44, 14), 7, 7));
      f.setColor(Skia.Color('#94a3b8'));
      canvas.drawPath(b.build(), f);
      break;
    }
    case 'gear': {
      const pts: number[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        const r = i % 2 === 0 ? 27 : 21;
        pts.push(32 + Math.cos(a - 0.12) * r, 32 + Math.sin(a - 0.12) * r, 32 + Math.cos(a + 0.12) * r, 32 + Math.sin(a + 0.12) * r);
      }
      f.setColor(Skia.Color(SLATE));
      canvas.drawPath(path(pts), f);
      circ(32, 32, 8.5, '#ffffff');
      break;
    }
    case 'check':
      stroke([15, 34, 27, 46, 50, 20], '#10b981', 8);
      break;
    case 'warn': {
      const p = path([32, 8, 58, 54, 6, 54]);
      s.setColor(Skia.Color('#f59e0b'));
      s.setStrokeWidth(6);
      canvas.drawPath(p, s);
      f.setColor(Skia.Color('#f59e0b'));
      canvas.drawPath(p, f);
      stroke([32, 24, 32, 37], '#ffffff', 5);
      circ(32, 46, 3.2, '#ffffff');
      break;
    }
    case 'close':
      stroke([20, 20, 44, 44], '#64748b', 6);
      stroke([44, 20, 20, 44], '#64748b', 6);
      break;
    case 'plus':
      circ(32, 32, 24, '#10b981');
      stroke([32, 20, 32, 44], '#ffffff', 6);
      stroke([20, 32, 44, 32], '#ffffff', 6);
      break;
    case 'bag':
      stroke([24, 18, 24, 10, 40, 10, 40, 18], '#92400e', 4);
      f.setColor(Skia.Color('#d97706'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(10, 17, 44, 38), 7, 7), f);
      f.setColor(Skia.Color(shade('#d97706', -0.18)));
      canvas.drawRect(Skia.XYWHRect(19, 17, 5, 38), f);
      canvas.drawRect(Skia.XYWHRect(40, 17, 5, 38), f);
      break;
    case 'hold': {
      const b = Skia.PathBuilder.Make();
      b.addArc(Skia.XYWHRect(12, 12, 40, 40), 200, 290);
      s.setColor(Skia.Color('#6366f1'));
      s.setStrokeWidth(7);
      canvas.drawPath(b.build(), s);
      f.setColor(Skia.Color('#6366f1'));
      canvas.drawPath(path([6, 22, 22, 22, 13, 35]), f);
      break;
    }
    case 'hourglass':
      f.setColor(Skia.Color('#f59e0b'));
      canvas.drawPath(path([16, 8, 48, 8, 34, 32, 48, 56, 16, 56, 30, 32]), f);
      f.setColor(Skia.Color('#fde68a'));
      canvas.drawPath(path([22, 13, 42, 13, 32, 26]), f);
      break;
    case 'bubble': {
      f.setColor(Skia.Color('#ffffff'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(6, 6, 52, 44), 16, 16), f);
      canvas.drawPath(path([24, 48, 32, 59, 40, 48]), f);
      break;
    }
    case 'hand': {
      // a pointing hand (index finger up)
      f.setColor(Skia.Color('rgba(15,23,42,0.25)'));
      f.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 2.5, true));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(20, 30, 32, 30), 12, 12), f);
      f.setMaskFilter(null);
      const skin = '#fdd7b5';
      f.setColor(Skia.Color('#e9a77c'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(25.5, 3.5, 13, 34), 6.5, 6.5), f);
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(15.5, 25.5, 35, 33), 13, 13), f);
      f.setColor(Skia.Color(skin));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(27, 5, 10, 32), 5, 5), f);
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(17, 27, 32, 30), 12, 12), f);
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(10, 31, 12, 16), 6, 6), f);
      f.setColor(Skia.Color('#f8c79f'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(37, 28, 9, 12), 4, 4), f);
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(42, 33, 8, 12), 4, 4), f);
      break;
    }
    case 'build': {
      f.setColor(Skia.Color('#f59e0b'));
      canvas.drawPath(path([8, 56, 56, 56, 56, 48, 8, 48]), f);
      f.setColor(Skia.Color('#fbbf24'));
      canvas.drawRect(Skia.XYWHRect(26, 10, 6, 40), f);
      canvas.drawRect(Skia.XYWHRect(14, 10, 40, 5), f);
      f.setColor(Skia.Color('#64748b'));
      canvas.drawRect(Skia.XYWHRect(46, 15, 2, 14), f);
      canvas.drawRect(Skia.XYWHRect(42, 29, 10, 7), f);
      break;
    }
    case 'tail': {
      // an airline: a tail fin with a stripe
      f.setColor(Skia.Color('#6366f1'));
      canvas.drawPath(path([14, 56, 50, 56, 50, 46, 38, 8, 26, 8, 30, 46, 14, 46]), f);
      f.setColor(Skia.Color('#a5b4fc'));
      canvas.drawPath(path([33, 22, 42, 22, 45, 32, 35, 32]), f);
      f.setColor(Skia.Color('#f59e0b'));
      canvas.drawRect(Skia.XYWHRect(14, 46, 36, 4), f);
      break;
    }
    case 'board': {
      // a departures board: dark panel, amber rows
      f.setColor(Skia.Color('#1e293b'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(6, 10, 52, 40), 7, 7), f);
      f.setColor(Skia.Color('#64748b'));
      canvas.drawRect(Skia.XYWHRect(18, 50, 4, 8), f);
      canvas.drawRect(Skia.XYWHRect(42, 50, 4, 8), f);
      for (let r = 0; r < 3; r++) {
        f.setColor(Skia.Color('#fbbf24'));
        canvas.drawRect(Skia.XYWHRect(12, 17 + r * 10, 14, 5), f);
        f.setColor(Skia.Color(r === 1 ? '#34d399' : '#e2e8f0'));
        canvas.drawRect(Skia.XYWHRect(30, 17 + r * 10, 22, 5), f);
      }
      break;
    }
    case 'handshake': {
      // a signed deal: a document with a check
      f.setColor(Skia.Color('#e0e7ff'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(12, 6, 36, 48), 6, 6), f);
      stroke([20, 18, 40, 18], '#a5b4fc', 4);
      stroke([20, 27, 40, 27], '#a5b4fc', 4);
      circ(44, 46, 13, '#10b981');
      stroke([37, 46, 42, 51, 51, 41], '#ffffff', 4.5);
      break;
    }
    case 'bell': {
      // a bell with a clapper and a little motion line
      const b = Skia.PathBuilder.Make();
      b.moveTo(32, 10);
      b.cubicTo(20, 10, 16, 22, 16, 32);
      b.lineTo(16, 42);
      b.lineTo(10, 48);
      b.lineTo(54, 48);
      b.lineTo(48, 42);
      b.lineTo(48, 32);
      b.cubicTo(48, 22, 44, 10, 32, 10);
      b.close();
      f.setColor(Skia.Color('#f59e0b'));
      canvas.drawPath(b.build(), f);
      circ(32, 8, 4, '#f59e0b');
      circ(32, 53, 6, '#b45309');
      stroke([52, 14, 57, 20], '#fbbf24', 3.5);
      stroke([12, 14, 7, 20], '#fbbf24', 3.5);
      break;
    }
    case 'medic': {
      // a red disc with a white six-armed star (the ambulance emblem)
      circ(32, 32, 26, '#dc2626');
      circ(32, 32, 22, '#ef4444');
      f.setColor(Skia.Color('#ffffff'));
      for (let k = 0; k < 3; k++) {
        canvas.save();
        canvas.rotate(k * 60, 32, 32);
        canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(27, 13, 10, 38), 3, 3), f);
        canvas.restore();
      }
      circ(32, 32, 4, '#ef4444');
      break;
    }
    case 'camera': {
      // a press camera: body, big lens, flash on top with a burst
      f.setColor(Skia.Color('#334155'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(8, 22, 48, 30), 7, 7), f);
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(14, 16, 14, 8), 3, 3), f);
      circ(34, 37, 12, '#e2e8f0');
      circ(34, 37, 9, '#1e293b');
      circ(31, 34, 3, '#93c5fd');
      f.setColor(Skia.Color('#f8fafc'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(42, 12, 12, 9), 2, 2), f);
      stroke([48, 4, 48, 8], '#facc15', 3);
      stroke([56, 7, 53, 10], '#facc15', 3);
      stroke([40, 7, 43, 10], '#facc15', 3);
      break;
    }
    case 'ticket': {
      // an admission ticket with notches and a perforation
      f.setColor(Skia.Color('#f59e0b'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(6, 16, 52, 32), 5, 5), f);
      circ(6, 32, 6, '#ffffff');
      circ(58, 32, 6, '#ffffff');
      for (let y = 19; y < 46; y += 6) stroke([42, y, 42, y + 3], '#fff7ed', 2.5);
      f.setColor(Skia.Color('#fff7ed'));
      canvas.drawPath(path([24, 22, 26.5, 28, 33, 28.5, 28, 32.5, 29.8, 39, 24, 35.4, 18.2, 39, 20, 32.5, 15, 28.5, 21.5, 28]), f);
      break;
    }
    case 'search': {
      // a magnifying glass
      stroke([38, 38, 54, 54], '#78350f', 7);
      circ(26, 26, 18, '#334155');
      circ(26, 26, 13, '#bae6fd');
      circ(21, 20, 4, '#f0f9ff');
      break;
    }
    case 'guide': {
      // the Aviation Guide: a red book with a gold star on the cover
      f.setColor(Skia.Color('#b91c1c'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(12, 6, 40, 52), 4, 4), f);
      f.setColor(Skia.Color('#fef3c7'));
      canvas.drawRect(Skia.XYWHRect(46, 10, 4, 44), f);
      f.setColor(Skia.Color('#facc15'));
      canvas.drawPath(path([31, 16, 34, 25, 43, 25, 36, 31, 39, 40, 31, 34.5, 23, 40, 26, 31, 19, 25, 28, 25]), f);
      break;
    }
    case 'party': {
      // a party popper with confetti and streamers
      f.setColor(Skia.Color('#8b5cf6'));
      canvas.drawPath(path([8, 56, 22, 22, 42, 42]), f);
      f.setColor(Skia.Color('#facc15'));
      canvas.drawPath(path([12, 46, 16, 36, 26, 46, 20, 49]), f);
      stroke([30, 20, 36, 10, 44, 14], '#ec4899', 3.5);
      stroke([42, 30, 52, 26, 56, 32], '#22c55e', 3.5);
      circ(46, 8, 3.5, '#3b82f6');
      circ(56, 18, 3, '#f97316');
      circ(30, 8, 2.5, '#22c55e');
      circ(58, 42, 3, '#ec4899');
      break;
    }
    case 'wind': {
      // three gusts curling at the end
      const gust = (y: number, len: number, w: number) => {
        const b = Skia.PathBuilder.Make();
        b.moveTo(8, y);
        b.lineTo(8 + len, y);
        b.cubicTo(8 + len + 9, y, 8 + len + 9, y - 13, 8 + len, y - 12);
        s.setColor(Skia.Color('#38bdf8'));
        s.setStrokeWidth(w);
        canvas.drawPath(b.build(), s);
      };
      gust(26, 30, 5.5);
      gust(40, 40, 5.5);
      stroke([8, 52, 34, 52], '#7dd3fc', 5.5);
      break;
    }
    case 'fog': {
      const bars: [number, number, number, string][] = [
        [14, 18, 50, '#94a3b8'],
        [8, 30, 44, '#cbd5e1'],
        [16, 42, 56, '#94a3b8'],
        [10, 54, 40, '#cbd5e1'],
      ];
      for (const [x0, y, x1, c] of bars) stroke([x0, y, x1, y], c, 6);
      break;
    }
    case 'arrow': {
      // points up; rotated by the caller
      f.setColor(Skia.Color(SLATE));
      canvas.drawPath(path([32, 6, 50, 30, 38, 28, 38, 58, 26, 58, 26, 28, 14, 30]), f);
      break;
    }
    case 'up': {
      circ(32, 32, 24, '#10b981');
      stroke([20, 36, 32, 22, 44, 36], '#ffffff', 6);
      stroke([32, 23, 32, 46], '#ffffff', 6);
      break;
    }
    case 'team': {
      circ(22, 20, 9, '#93c5fd');
      circ(42, 20, 9, '#3b82f6');
      const b1 = Skia.PathBuilder.Make();
      b1.moveTo(6, 52);
      b1.cubicTo(6, 38, 13, 32, 22, 32);
      b1.cubicTo(31, 32, 36, 38, 36, 52);
      b1.close();
      f.setColor(Skia.Color('#93c5fd'));
      canvas.drawPath(b1.build(), f);
      const b2 = Skia.PathBuilder.Make();
      b2.moveTo(26, 56);
      b2.cubicTo(26, 40, 33, 33, 42, 33);
      b2.cubicTo(51, 33, 58, 40, 58, 56);
      b2.close();
      f.setColor(Skia.Color('#3b82f6'));
      canvas.drawPath(b2.build(), f);
      break;
    }
    case 'wait': {
      f.setColor(Skia.Color('rgba(15,23,42,0.3)'));
      f.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 3, true));
      canvas.drawCircle(32, 33, 20, f);
      f.setMaskFilter(null);
      circ(32, 31, 20, '#ffffff');
      f.setColor(Skia.Color('#f59e0b'));
      canvas.drawPath(path([22, 18, 42, 18, 34, 31, 42, 44, 22, 44, 30, 31]), f);
      break;
    }
    case 'actLand':
    case 'actFuel':
    case 'actBoard':
    case 'actTakeoff':
    case 'actBags':
    case 'actRepair': {
      const kind = name === 'actLand' ? 'land' : name === 'actFuel' ? 'fuel' : name === 'actBoard' ? 'board' : name === 'actBags' ? 'bags' : name === 'actRepair' ? 'repair' : 'takeoff';
      const col = ACTION_COLORS[kind];
      // soft drop shadow
      f.setColor(Skia.Color('rgba(15,23,42,0.35)'));
      f.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 3.5, true));
      canvas.drawCircle(32, 31, 22, f);
      f.setMaskFilter(null);
      // pin tail
      f.setColor(Skia.Color(col));
      canvas.drawPath(path([24, 44, 32, 58, 40, 44]), f);
      // white ring, colored disc, glossy top
      circ(32, 28, 24, '#ffffff');
      circ(32, 28, 20, col);
      f.setColor(Skia.Color('rgba(255,255,255,0.18)'));
      canvas.drawOval(Skia.XYWHRect(16, 10, 32, 16), f);
      actionGlyph(canvas, kind, f);
      break;
    }
  }
  canvas.restore();
}
