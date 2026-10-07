import { PaintStyle, Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';
import { WHEEL_SEGMENTS, type WheelPrize } from '../../data/wheel';
import { sprite } from '../sprite';
import type { SpriteDef } from '../sprite';
import { lighten } from './color';
import { fxSprites } from './fxArt';
import { hudIcons } from './hudArt';
import { fill, path, stroke, type Pt } from './kit';

// The lucky wheel, in the casino style of the HUD: a glossy face of colored wedges with gold
// dividers and pegs, a thick gold frame, a pointer and a hub. Every piece shares the same
// bounds, so the screen stacks them as same-sized images and only the face turns.

/** Shared bounds: the face is radius 100, the frame reaches 118. */
export const WHEEL_BOUNDS = [-120, -120, 120, 120] as const;
/** The pointer is its own small square (so it can swing on its jewel): its middle is at y = -101. */
export const POINTER_BOUNDS = [-21, -122, 21, -80] as const;
/** Where things sit, in those units (the screen places the labels and bulbs from these). */
// The jackpot's word is long: it sits further out, where its wedge is wider.
export const WHEEL_ART = { face: 100, bulbs: 109, bulbCount: 16, icon: 74, label: 47, jackpotLabel: 53 } as const;

const SEG = 360 / WHEEL_SEGMENTS.length;

function radial(cx: number, cy: number, r: number, colors: string[], stops: number[]) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeRadialGradient(vec(cx, cy), r, colors.map((c) => Skia.Color(c)), stops, TileMode.Clamp));
  return p;
}

function linear(x0: number, y0: number, x1: number, y1: number, colors: string[]) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeLinearGradient(vec(x0, y0), vec(x1, y1), colors.map((c) => Skia.Color(c)), colors.map((_, i) => i / (colors.length - 1)), TileMode.Clamp));
  return p;
}

function wedge(r: number, from: number, sweep: number) {
  const b = Skia.PathBuilder.Make();
  b.moveTo(0, 0);
  b.arcToOval(Skia.XYWHRect(-r, -r, r * 2, r * 2), from, sweep, false);
  b.close();
  return b.build();
}

/** Draws a sprite def centered at (x, y), `size` units across its larger side. */
function stamp(c: SkCanvas, def: SpriteDef, x: number, y: number, size: number) {
  const [l, t, r, b] = def.bounds;
  const k = size / Math.max(r - l, b - t);
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.translate(-(l + r) / 2, -(t + b) / 2);
  def.draw(c);
  c.restore();
}

/** A lightning bolt (the income boost). */
function bolt(c: SkCanvas, size: number) {
  const k = size / 40;
  const pts: Pt[] = [[4, -20], [-12, 3], [-1, 3], [-6, 20], [12, -5], [1, -5], [7, -20]].map(([x, y]) => [x * k, y * k] as Pt);
  c.drawPath(path.poly(pts.map(([x, y]) => [x + 1.5, y + 2] as Pt)), fill('#5E2A8E'));
  c.drawPath(path.poly(pts), linear(0, -20 * k, 0, 20 * k, ['#FFF6B0', '#FFD23F', '#F29A12']));
  c.drawPath(path.poly(pts), stroke('#8A5206', 1.4));
}

function prizeIcon(c: SkCanvas, prize: WheelPrize) {
  if (prize.kind === 'coins') {
    // More coins for the bigger prizes: a stack grows from one to three.
    const n = prize.minutes >= 60 ? 3 : prize.minutes >= 15 ? 2 : 1;
    for (let k = n - 1; k >= 0; k--) stamp(c, hudIcons.hudCoin, (k - (n - 1) / 2) * 9, -k * 3, 24);
  } else if (prize.kind === 'gems') {
    const n = prize.gems >= 15 ? 2 : 1;
    for (let k = n - 1; k >= 0; k--) stamp(c, hudIcons.hudGem, (k - (n - 1) / 2) * 10, -k * 2, 22);
  } else if (prize.kind === 'boost') {
    bolt(c, 28);
  } else {
    stamp(c, hudIcons.hudCoin, -8, 4, 20);
    stamp(c, hudIcons.hudGem, 8, 4, 18);
    stamp(c, fxSprites.crown, 0, -10, 24);
  }
}

/** The turning face: the wedges, their icons, gold dividers and pegs. */
const wheelFace = sprite(WHEEL_BOUNDS, (c) => {
  const R = WHEEL_ART.face;
  WHEEL_SEGMENTS.forEach((seg, i) => {
    const mid = -90 + i * SEG;
    const jackpot = seg.prize.kind === 'jackpot';
    c.drawPath(wedge(R, mid - SEG / 2, SEG), radial(0, 0, R, [lighten(seg.color, 0.45), seg.color, seg.edge], [0.12, 0.62, 1]));
    if (jackpot) {
      // The jackpot glitters: a golden glow and a few sparkles on the dark wedge.
      c.drawPath(wedge(R, mid - SEG / 2, SEG), radial(0, 0, R, ['rgba(255,210,63,0)', 'rgba(255,210,63,0.15)', 'rgba(255,210,63,0.45)'], [0.2, 0.6, 1]));
    }
    c.save();
    c.rotate(mid + 90, 0, 0);
    if (jackpot) for (const [x, y, r] of [[-9, -88, 1.8], [10, -84, 1.4], [-3, -58, 1.2], [6, -30, 1.1]] as const) c.drawCircle(x, y, r, fill('#FFF6C8', 0.9));
    c.translate(0, -WHEEL_ART.icon);
    prizeIcon(c, seg.prize);
    c.restore();
  });
  // A gloss over the top half, as if the light came from above.
  c.drawPath(wedge(R, 180, 180), linear(0, -R, 0, 0, ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']));
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    const a = ((-90 + (i - 0.5) * SEG) * Math.PI) / 180;
    const [cx, cy] = [Math.cos(a), Math.sin(a)];
    c.drawLine(cx * 20, cy * 20 + 1, cx * R, cy * R + 1, stroke('#120818', 3.4, 0.45));
    c.drawLine(cx * 20, cy * 20, cx * R, cy * R, stroke('#F4C542', 2.6));
    // The peg that flicks the pointer.
    c.drawCircle(cx * 92, cy * 92 + 1.2, 3.8, fill('#7A4A06'));
    c.drawCircle(cx * 92, cy * 92, 3.8, radial(cx * 92 - 1.2, cy * 92 - 1.4, 5, ['#FFF6C8', '#F4C542', '#B8741A'], [0, 0.5, 1]));
  }
  c.drawCircle(0, 0, R, stroke('#F4C542', 3));
});

/** The fixed gold frame around it, with sockets for the bulbs (the screen lights them). */
const wheelFrame = sprite(WHEEL_BOUNDS, (c) => {
  c.drawCircle(0, 4, 119, fill('#120818', 0.5));
  c.drawCircle(0, 0, 118, fill('#5A2E08'));
  const ring = linear(-110, -110, 110, 110, ['#FFF2A8', '#F4C542', '#C8860F', '#F4C542', '#8A5206']);
  ring.setStyle(PaintStyle.Stroke);
  ring.setStrokeWidth(15);
  c.drawCircle(0, 0, 109, ring);
  c.drawCircle(0, 0, 116.5, stroke('#FFF2A8', 1.2, 0.7));
  c.drawCircle(0, 0, 101.5, stroke('#5A2E08', 2.4));
  for (let i = 0; i < WHEEL_ART.bulbCount; i++) {
    const a = (i / WHEEL_ART.bulbCount) * Math.PI * 2;
    c.drawCircle(Math.cos(a) * WHEEL_ART.bulbs, Math.sin(a) * WHEEL_ART.bulbs, 5, fill('#5A2E08'));
  }
});

/** The pointer at the top: a gold drop with a red jewel, pointing down at the winning wedge. */
const wheelPointer = sprite(POINTER_BOUNDS, (c) => {
  const pts: Pt[] = [[-15, -118], [15, -118], [17, -108], [0, -84], [-17, -108]];
  const shape = path.smooth(pts, true, 0.35);
  c.save();
  c.translate(1.5, 3);
  c.drawPath(shape, fill('#120818', 0.45));
  c.restore();
  c.drawPath(shape, linear(-15, -118, 15, -86, ['#FFF2A8', '#F4C542', '#B8741A']));
  c.drawPath(shape, stroke('#7A4A06', 2));
  c.drawCircle(0, -108, 6.5, radial(-2, -110, 8, ['#FFC2C2', '#E5483B', '#8A1A14'], [0, 0.5, 1]));
  c.drawCircle(-2, -110.5, 1.8, fill('#FFFFFF', 0.85));
});

/** The hub in the middle (also the spin button). */
const wheelHub = sprite(WHEEL_BOUNDS, (c) => {
  c.drawCircle(0, 3, 27, fill('#120818', 0.45));
  c.drawCircle(0, 0, 27, linear(-27, -27, 27, 27, ['#FFF2A8', '#F4C542', '#B8741A']));
  c.drawCircle(0, 0, 21, radial(-6, -8, 30, ['#FF8A7A', '#E5483B', '#9A2420'], [0, 0.55, 1]));
  c.drawCircle(0, 0, 21, stroke('#7A4A06', 1.6));
  c.drawOval(Skia.XYWHRect(-14, -18, 28, 13), fill('#FFFFFF', 0.28));
});

/** A soft golden glow behind the whole wheel. */
const wheelGlow = sprite(WHEEL_BOUNDS, (c) => {
  c.drawCircle(0, 0, 120, radial(0, 0, 120, ['rgba(255,210,63,0.55)', 'rgba(255,210,63,0.18)', 'rgba(255,210,63,0)'], [0.6, 0.85, 1]));
});

export const wheelIcons = { wheelFace, wheelFrame, wheelPointer, wheelHub, wheelGlow };
export type WheelIcon = keyof typeof wheelIcons;
