/**
 * Little people: passengers and staff. Drawn flat (2D cartoon) in two views,
 * front (walking toward the viewer) and back, mirrored for the other side.
 * Origin is the point between the feet.
 */
import { PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';

import { edge, shade } from './color';

export interface Outfit {
  id: string;
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'bun' | 'bald';
  shirt: string;
  pants: string;
  shoes: string;
  hat?: { kind: 'cap' | 'headset' | 'beanie'; color: string };
  vest?: string;
  bag?: { kind: 'roller' | 'backpack' | 'briefcase'; color: string };
  /** 1 = adult; kids are smaller. */
  size: number;
}

export const OUTFITS: readonly Outfit[] = [
  { id: 'tourist', skin: '#f2c7a5', hair: '#6b4226', hairStyle: 'short', shirt: '#ff7a59', pants: '#3d6fb6', shoes: '#f4f4f4', hat: { kind: 'cap', color: '#ffd23f' }, bag: { kind: 'roller', color: '#2bb3a3' }, size: 1 },
  { id: 'business', skin: '#d9a07a', hair: '#2b2b2b', hairStyle: 'short', shirt: '#38465e', pants: '#2c3446', shoes: '#1d1d22', bag: { kind: 'briefcase', color: '#7a4a2a' }, size: 1 },
  { id: 'businessW', skin: '#f0c9a8', hair: '#b5652e', hairStyle: 'bun', shirt: '#6c4f8f', pants: '#2c3446', shoes: '#1d1d22', bag: { kind: 'roller', color: '#3a3f4a' }, size: 1 },
  { id: 'family', skin: '#a8714f', hair: '#1f1a17', hairStyle: 'long', shirt: '#59c27a', pants: '#e9e1cf', shoes: '#c45b3c', bag: { kind: 'roller', color: '#e85d75' }, size: 1 },
  { id: 'kid', skin: '#f6d2b8', hair: '#e0b04c', hairStyle: 'short', shirt: '#ffcd3c', pants: '#e85d75', shoes: '#ffffff', size: 0.68 },
  { id: 'student', skin: '#c58c63', hair: '#3b2a20', hairStyle: 'short', shirt: '#27a4d8', pants: '#4a4f5c', shoes: '#ffffff', hat: { kind: 'beanie', color: '#e8473f' }, bag: { kind: 'backpack', color: '#f2a43a' }, size: 1 },
  { id: 'vip', skin: '#e8b996', hair: '#d9d9d9', hairStyle: 'short', shirt: '#1d1d22', pants: '#1d1d22', shoes: '#111111', bag: { kind: 'briefcase', color: '#c9a646' }, size: 1 },
  { id: 'elder', skin: '#f0cfb5', hair: '#e8e8e8', hairStyle: 'bun', shirt: '#9fc5e8', pants: '#8a7a6a', shoes: '#5a4a3a', bag: { kind: 'roller', color: '#8e5bb5' }, size: 0.95 },
  // staff
  { id: 'fueler', skin: '#d9a07a', hair: '#2b2b2b', hairStyle: 'short', shirt: '#3a4a5e', pants: '#3a4a5e', shoes: '#1d1d22', vest: '#ff8a1f', hat: { kind: 'cap', color: '#ff8a1f' }, size: 1 },
  { id: 'crew', skin: '#f2c7a5', hair: '#6b4226', hairStyle: 'short', shirt: '#2f3b52', pants: '#2f3b52', shoes: '#1d1d22', vest: '#d7f23a', hat: { kind: 'headset', color: '#30343c' }, size: 1 },
  { id: 'pilot', skin: '#e8b996', hair: '#4a3020', hairStyle: 'short', shirt: '#ffffff', pants: '#1d2a4d', shoes: '#111111', hat: { kind: 'cap', color: '#1d2a4d' }, size: 1 },
  { id: 'agent', skin: '#f0c9a8', hair: '#3b2a20', hairStyle: 'bun', shirt: '#6366f1', pants: '#1e293b', shoes: '#111111', size: 1 },
  // navy coveralls, a red cap and a red toolbox
  { id: 'mechanic', skin: '#c99272', hair: '#3b2a20', hairStyle: 'short', shirt: '#1e3a5f', pants: '#1e3a5f', shoes: '#1d1d22', hat: { kind: 'cap', color: '#dc2626' }, bag: { kind: 'briefcase', color: '#dc2626' }, size: 1 },
  { id: 'atc', skin: '#c58c63', hair: '#2b2b2b', hairStyle: 'bun', shirt: '#e0e7ff', pants: '#1e293b', shoes: '#111111', hat: { kind: 'headset', color: '#334155' }, size: 1 },
  // events (M11): paramedic, press photographer, bodyguard, the celebrity
  { id: 'medic', skin: '#e0ac69', hair: '#3b2a20', hairStyle: 'short', shirt: '#f8fafc', pants: '#1f2937', shoes: '#111111', vest: '#f97316', size: 1 },
  { id: 'press', skin: '#f2c7a5', hair: '#6b4226', hairStyle: 'short', shirt: '#64748b', pants: '#a8a29e', shoes: '#44403c', hat: { kind: 'cap', color: '#111827' }, bag: { kind: 'backpack', color: '#1f2937' }, size: 1 },
  { id: 'guard', skin: '#a8714f', hair: '#1f1a17', hairStyle: 'bald', shirt: '#111827', pants: '#111827', shoes: '#0b0b0b', hat: { kind: 'headset', color: '#0b0b0b' }, size: 1.05 },
  { id: 'star', skin: '#f0c9a8', hair: '#fde68a', hairStyle: 'long', shirt: '#f0abfc', pants: '#f8fafc', shoes: '#c026d3', bag: { kind: 'briefcase', color: '#facc15' }, size: 1 },
];

export const PAX_OUTFITS = ['tourist', 'business', 'businessW', 'family', 'kid', 'student', 'vip', 'elder'] as const;

/** Frames: 0..3 walk cycle, 4 idle. */
export const PERSON_FRAMES = 5;

let fp: SkPaint | null = null;
let sp: SkPaint | null = null;

function paints() {
  if (!fp) {
    fp = Skia.Paint();
    fp.setAntiAlias(true);
    fp.setStyle(PaintStyle.Fill);
  }
  if (!sp) {
    sp = Skia.Paint();
    sp.setAntiAlias(true);
    sp.setStyle(PaintStyle.Stroke);
    sp.setStrokeCap(StrokeCap.Round);
    sp.setStrokeJoin(StrokeJoin.Round);
  }
  return { f: fp, s: sp };
}

/** Size in world-screen pixels of the sprite cell around the origin. */
export const PERSON_BOX = { left: -9, right: 9, top: -24, bottom: 3 };

export function drawPerson(
  canvas: SkCanvas,
  ox: number,
  oy: number,
  scale: number,
  o: Outfit,
  view: 'front' | 'back',
  mirror: boolean,
  frame: number,
): void {
  const { f, s } = paints();
  const k = scale * o.size;
  canvas.save();
  canvas.translate(ox, oy);
  canvas.scale(mirror ? -k : k, k);

  const walking = frame < 4;
  const ph = (frame / 4) * Math.PI * 2;
  const swing = walking ? Math.sin(ph) : 0;
  const bob = walking ? -Math.abs(Math.cos(ph)) * 0.6 : 0;
  const ol = 0.7;

  const line = (x0: number, y0: number, x1: number, y1: number, w: number, color: string) => {
    s.setColor(Skia.Color(edge(color, -0.45)));
    s.setStrokeWidth(w + ol * 2);
    canvas.drawLine(x0, y0, x1, y1, s);
    s.setColor(Skia.Color(color));
    s.setStrokeWidth(w);
    canvas.drawLine(x0, y0, x1, y1, s);
  };
  const rrect = (x: number, y: number, w: number, h: number, r: number, color: string) => {
    f.setColor(Skia.Color(edge(color, -0.45)));
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - ol, y - ol, w + ol * 2, h + ol * 2), r + ol, r + ol), f);
    f.setColor(Skia.Color(color));
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), f);
  };
  const circle = (x: number, y: number, r: number, color: string) => {
    f.setColor(Skia.Color(edge(color, -0.45)));
    canvas.drawCircle(x, y, r + ol, f);
    f.setColor(Skia.Color(color));
    canvas.drawCircle(x, y, r, f);
  };

  // soft ground shadow
  f.setColor(Skia.Color('rgba(20,45,30,0.2)'));
  canvas.drawOval(Skia.XYWHRect(-4.6, -1.5, 9.2, 3), f);

  const hipY = -7 + bob;
  const bag = o.bag;
  const front = view === 'front';

  // roller bag trails behind (drawn first when walking toward the viewer)
  const drawRoller = () => {
    if (!bag || bag.kind !== 'roller') return;
    const bx = front ? -6.5 : 4.2;
    line(bx + 1.2, -4.8, front ? -2.6 : 2.6, -9.5 + bob, 0.8, '#5a5f6a');
    rrect(bx - 1.6, -6.4, 4, 6, 1, bag.color);
    f.setColor(Skia.Color(shade(bag.color, 0.35)));
    canvas.drawRect(Skia.XYWHRect(bx - 1.0, -5.6, 1.0, 4.2), f);
  };
  if (front) drawRoller();

  // legs
  line(-1.4, hipY, -1.4 + swing * 1.8, -0.8, 2.1, o.pants);
  line(1.4, hipY, 1.4 - swing * 1.8, -0.8, 2.1, o.pants);
  // shoes
  circle(-1.4 + swing * 1.8, -0.6, 1.0, o.shoes);
  circle(1.4 - swing * 1.8, -0.6, 1.0, o.shoes);

  // backpack seen from the back
  if (bag && bag.kind === 'backpack' && !front) rrect(-3.1, -13.6 + bob, 6.2, 6.2, 1.6, bag.color);

  // arm behind
  line(-2.9, -12.4 + bob, -3.5 - swing * 1.3, -8.4 + bob, 1.6, o.shirt);

  // torso
  rrect(-3.2, -13.6 + bob, 6.4, 7.2, 2.2, o.shirt);
  if (o.vest) {
    f.setColor(Skia.Color(o.vest));
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(-3.2, -13.2 + bob, 6.4, 6.6), 1.8, 1.8), f);
    f.setColor(Skia.Color('#f4f4f4'));
    canvas.drawRect(Skia.XYWHRect(-3.2, -9.8 + bob, 6.4, 0.9), f);
  }
  if (o.id === 'business' || o.id === 'vip') {
    // shirt collar and tie
    f.setColor(Skia.Color('#f4f4f4'));
    if (front) canvas.drawRect(Skia.XYWHRect(-0.9, -13.4 + bob, 1.8, 2.2), f);
    f.setColor(Skia.Color(o.id === 'vip' ? '#c9a646' : '#c4302b'));
    if (front) canvas.drawRect(Skia.XYWHRect(-0.4, -12.8 + bob, 0.8, 3.4), f);
  }
  // backpack straps from the front
  if (bag && bag.kind === 'backpack' && front) {
    f.setColor(Skia.Color(shade(bag.color, -0.2)));
    canvas.drawRect(Skia.XYWHRect(-2.6, -13.4 + bob, 0.9, 6), f);
    canvas.drawRect(Skia.XYWHRect(1.7, -13.4 + bob, 0.9, 6), f);
  }

  // head
  const hy = -16.4 + bob;
  circle(0.3, hy, 2.9, o.skin);
  // hair
  f.setColor(Skia.Color(o.hair));
  if (o.hairStyle !== 'bald') {
    if (front) {
      const b = Skia.PathBuilder.Make();
      b.addArc(Skia.XYWHRect(-2.6, hy - 2.9, 5.8, 5.2), 180, 180);
      b.close();
      canvas.drawPath(b.build(), f);
      if (o.hairStyle === 'long') canvas.drawRect(Skia.XYWHRect(-2.7, hy - 0.6, 1.5, 3.4), f);
    } else {
      canvas.drawCircle(0.3, hy - 0.2, 2.75, f);
      if (o.hairStyle === 'long') canvas.drawRect(Skia.XYWHRect(-2.4, hy, 5.4, 3.2), f);
    }
    if (o.hairStyle === 'bun') canvas.drawCircle(front ? -1.6 : 0.3, hy - 3, 1.3, f);
  }
  if (front) {
    // eyes, looking to the right (3/4 view)
    f.setColor(Skia.Color('#1d1d22'));
    canvas.drawCircle(1.2, hy + 0.2, 0.42, f);
    canvas.drawCircle(2.4, hy + 0.2, 0.42, f);
    f.setColor(Skia.Color('rgba(230,110,110,0.55)'));
    canvas.drawCircle(2.2, hy + 1.3, 0.6, f);
  }
  // hats
  if (o.hat) {
    if (o.hat.kind === 'cap') {
      f.setColor(Skia.Color(o.hat.color));
      const b = Skia.PathBuilder.Make();
      b.addArc(Skia.XYWHRect(-2.6, hy - 3.2, 5.8, 4.6), 180, 180);
      b.close();
      canvas.drawPath(b.build(), f);
      if (front) canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(1.2, hy - 1.2, 3.2, 0.9), 0.4, 0.4), f);
    } else if (o.hat.kind === 'beanie') {
      f.setColor(Skia.Color(o.hat.color));
      const b = Skia.PathBuilder.Make();
      b.addArc(Skia.XYWHRect(-2.7, hy - 3.6, 6, 5.6), 180, 180);
      b.close();
      canvas.drawPath(b.build(), f);
      canvas.drawCircle(0.3, hy - 3.6, 0.9, f);
    } else {
      // headset: band and ear cups
      s.setColor(Skia.Color(o.hat.color));
      s.setStrokeWidth(0.8);
      const b = Skia.PathBuilder.Make();
      b.addArc(Skia.XYWHRect(-2.8, hy - 3.3, 6.2, 6), 180, 180);
      canvas.drawPath(b.build(), s);
      circle(front ? -2.3 : 2.9, hy + 0.3, 1.05, o.hat.color);
    }
  }

  // front arm
  line(2.9, -12.4 + bob, 3.5 + swing * 1.3, -8.4 + bob, 1.6, o.shirt);
  circle(3.5 + swing * 1.3, -8.1 + bob, 0.85, o.skin);
  // briefcase in the front hand
  if (bag && bag.kind === 'briefcase') rrect(2.4 + swing * 1.3, -7.6 + bob, 3.6, 2.8, 0.6, bag.color);
  if (!front) drawRoller();

  canvas.restore();
}
