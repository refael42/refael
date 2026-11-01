/**
 * "Sprite stacking": a 3D model is a set of parts; each part is a stack of
 * horizontal cross-sections. Drawing every section from bottom to top, each
 * lifted by its height, gives a solid-looking object from any heading. Used
 * at load time only (results go into the sprite atlas).
 */
import { PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';

import { HALF_H, HALF_W, Z_PX } from '../iso';
import { edge } from './color';

export interface StackPart {
  /** Anchor in model space, used for painter ordering between parts. */
  cu: number;
  cv: number;
  ch: number;
  h0: number;
  h1: number;
  /** Cross-section at height h as flat [u0, v0, u1, v1, ...], or null when empty. */
  section: (h: number) => number[] | null;
  /** Fill color at height h. t is 0 at the bottom of the part and 1 at the top. */
  color: (h: number, t: number) => string;
  outline?: boolean;
  /** Extra layers drawn after the fill (windows, decals): returns dots in model space. */
  dots?: { u: number; v: number; h: number; r: number; color: string }[];
  alpha?: number;
  /** Larger value = drawn later when anchors tie. */
  bias?: number;
}

export interface StackOptions {
  /** Atlas pixels per world-screen pixel (2 = retina atlas). */
  scale: number;
  outlineWidth?: number;
  outlineColor?: string;
  /** Draw only the ground silhouette in one color (for shadows). */
  silhouette?: string;
}

const fill: { p: SkPaint | null } = { p: null };
const stroke: { p: SkPaint | null } = { p: null };

function paints() {
  if (!fill.p) {
    fill.p = Skia.Paint();
    fill.p.setAntiAlias(true);
    fill.p.setStyle(PaintStyle.Fill);
  }
  if (!stroke.p) {
    stroke.p = Skia.Paint();
    stroke.p.setAntiAlias(true);
    stroke.p.setStyle(PaintStyle.Stroke);
    stroke.p.setStrokeJoin(StrokeJoin.Round);
    stroke.p.setStrokeCap(StrokeCap.Round);
  }
  return { f: fill.p, s: stroke.p };
}

/** Draws a model at a heading (radians, world frame) with its ground origin at (ox, oy). */
export function drawStack(
  canvas: SkCanvas,
  parts: readonly StackPart[],
  heading: number,
  ox: number,
  oy: number,
  opts: StackOptions,
): void {
  const { f, s } = paints();
  const sc = opts.scale;
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const px = (u: number, v: number) => {
    const dx = u * cos - v * sin;
    const dy = u * sin + v * cos;
    return ox + (dx - dy) * HALF_W * sc;
  };
  const py = (u: number, v: number, h: number) => {
    const dx = u * cos - v * sin;
    const dy = u * sin + v * cos;
    return oy + (dx + dy) * HALF_H * sc - h * Z_PX * sc;
  };
  const depth = (p: StackPart) => {
    const dx = p.cu * cos - p.cv * sin;
    const dy = p.cu * sin + p.cv * cos;
    return dx + dy + p.ch + (p.bias ?? 0) * 0.001;
  };

  const order = parts.map((p, i) => ({ p, d: depth(p), i }));
  order.sort((a, b) => a.d - b.d || a.i - b.i);

  const step = 1 / (Z_PX * sc); // one atlas pixel of height
  const ow = opts.outlineWidth ?? 1.7;
  s.setStrokeWidth(ow);

  const sectionPath = (sec: number[], h: number) => {
    const b = Skia.PathBuilder.Make();
    for (let k = 0; k < sec.length; k += 2) {
      const x = px(sec[k], sec[k + 1]);
      const y = py(sec[k], sec[k + 1], h);
      if (k === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    b.close();
    return b.build();
  };

  if (opts.silhouette) {
    f.setColor(Skia.Color(opts.silhouette));
    for (const { p } of order) {
      const n = Math.max(1, Math.ceil((p.h1 - p.h0) / (step * 3)));
      for (let k = 0; k <= n; k++) {
        const h = p.h0 + ((p.h1 - p.h0) * k) / n;
        const sec = p.section(h);
        if (sec && sec.length >= 6) canvas.drawPath(sectionPath(sec, 0), f);
      }
    }
    return;
  }

  for (const { p } of order) {
    const n = Math.max(1, Math.round((p.h1 - p.h0) / step));
    const hs: number[] = [];
    for (let k = 0; k <= n; k++) hs.push(p.h0 + ((p.h1 - p.h0) * k) / n);
    const paths: { path: ReturnType<typeof sectionPath>; color: string }[] = [];
    for (let k = 0; k < hs.length; k++) {
      const sec = p.section(hs[k]);
      if (!sec || sec.length < 6) continue;
      paths.push({ path: sectionPath(sec, hs[k]), color: p.color(hs[k], n === 0 ? 1 : k / n) });
    }
    const alpha = p.alpha ?? 1;
    if (p.outline !== false && paths.length > 0) {
      // hue-matched edge from the part's middle color
      s.setColor(Skia.Color(opts.outlineColor ?? edge(paths[Math.floor(paths.length / 2)].color)));
      s.setAlphaf(alpha);
      for (const it of paths) canvas.drawPath(it.path, s);
      s.setAlphaf(1);
    }
    for (const it of paths) {
      f.setColor(Skia.Color(it.color));
      f.setAlphaf(alpha);
      canvas.drawPath(it.path, f);
    }
    f.setAlphaf(1);
    if (p.dots) {
      for (const d of p.dots) {
        f.setColor(Skia.Color(d.color));
        canvas.drawCircle(px(d.u, d.v), py(d.u, d.v, d.h), d.r * sc, f);
      }
    }
  }
}

// ---------------------------------------------------------------- primitives

/** Axis-aligned box part in model space. */
export function boxPart(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  h0: number,
  h1: number,
  color: (t: number) => string,
  extra?: Partial<StackPart>,
): StackPart {
  const sec = [u0, v0, u1, v0, u1, v1, u0, v1];
  return {
    cu: (u0 + u1) / 2,
    cv: (v0 + v1) / 2,
    ch: (h0 + h1) / 2,
    h0,
    h1,
    section: () => sec,
    color: (_h, t) => color(t),
    ...extra,
  };
}

/** Prism with a fixed polygon cross-section. */
export function prismPart(
  poly: number[],
  h0: number,
  h1: number,
  color: (t: number) => string,
  extra?: Partial<StackPart>,
): StackPart {
  let cu = 0;
  let cv = 0;
  for (let i = 0; i < poly.length; i += 2) {
    cu += poly[i];
    cv += poly[i + 1];
  }
  const n = poly.length / 2;
  return {
    cu: cu / n,
    cv: cv / n,
    ch: (h0 + h1) / 2,
    h0,
    h1,
    section: () => poly,
    color: (_h, t) => color(t),
    ...extra,
  };
}

/**
 * A rounded tube along u (fuselage, nacelle, tank). profile(s) scales the
 * radius along the length (s = 0 at the back, 1 at the front); lift(s) moves
 * the centerline up.
 */
export function tubePart(opts: {
  u0: number;
  u1: number;
  v: number;
  hc: number;
  r: number;
  tall?: number;
  profile: (s: number) => number;
  lift?: (s: number) => number;
  color: (h: number, rel: number) => string;
  samples?: number;
  dots?: StackPart['dots'];
  bias?: number;
  outline?: boolean;
}): StackPart {
  const samples = opts.samples ?? 18;
  const tall = opts.tall ?? 1;
  const us: number[] = [];
  const prof: number[] = [];
  const lifts: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const s = i / samples;
    us.push(opts.u0 + (opts.u1 - opts.u0) * s);
    prof.push(Math.max(0, opts.profile(s)));
    lifts.push(opts.lift ? opts.lift(s) : 0);
  }
  let maxLift = 0;
  for (const l of lifts) maxLift = Math.max(maxLift, l);
  const rv = opts.r * tall;
  return {
    cu: (opts.u0 + opts.u1) / 2,
    cv: opts.v,
    ch: opts.hc,
    h0: opts.hc - rv,
    h1: opts.hc + rv + maxLift,
    bias: opts.bias,
    outline: opts.outline,
    dots: opts.dots,
    section: (h) => {
      const left: number[] = [];
      const right: number[] = [];
      for (let i = 0; i <= samples; i++) {
        const rr = rv * prof[i];
        const dh = h - (opts.hc + lifts[i]);
        if (rr <= 0 || Math.abs(dh) > rr) continue;
        const w = (opts.r * prof[i]) * Math.sqrt(1 - (dh / rr) * (dh / rr));
        left.push(us[i], opts.v + w);
        right.push(us[i], opts.v - w);
      }
      if (left.length < 4) return null;
      const out = left.slice();
      for (let k = right.length - 2; k >= 0; k -= 2) out.push(right[k], right[k + 1]);
      return out;
    },
    color: (h) => {
      const rel = (h - (opts.hc - rv)) / (2 * rv + maxLift); // 0 bottom .. 1 top
      return opts.color(h, Math.max(0, Math.min(1, rel)));
    },
  };
}

/** Vertical disc (propeller blur) facing along u. */
export function discPart(u: number, v: number, hc: number, r: number, color: string, alpha: number): StackPart {
  return {
    cu: u,
    cv: v,
    ch: hc,
    h0: hc - r,
    h1: hc + r,
    outline: false,
    alpha,
    bias: 5,
    section: (h) => {
      const dh = h - hc;
      if (Math.abs(dh) > r) return null;
      const w = Math.sqrt(r * r - dh * dh);
      const t = 0.004;
      return [u - t, v - w, u + t, v - w, u + t, v + w, u - t, v + w];
    },
    color: () => color,
  };
}

/** Ground-plane ellipse used for soft shadows under static objects. */
export function ellipsePoly(cu: number, cv: number, ru: number, rv: number, n = 20): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(cu + Math.cos(a) * ru, cv + Math.sin(a) * rv);
  }
  return out;
}

/** Pixel bounds of a model drawn at the origin (before the outline). */
export function measureStack(parts: readonly StackPart[], heading: number, scale: number): { x0: number; y0: number; x1: number; y1: number } {
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of parts) {
    const n = 6;
    for (let k = 0; k <= n; k++) {
      const h = p.h0 + ((p.h1 - p.h0) * k) / n;
      const sec = p.section(h);
      if (!sec) continue;
      for (let i = 0; i < sec.length; i += 2) {
        const dx = sec[i] * cos - sec[i + 1] * sin;
        const dy = sec[i] * sin + sec[i + 1] * cos;
        const x = (dx - dy) * HALF_W * scale;
        const y = (dx + dy) * HALF_H * scale - h * Z_PX * scale;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 1, y1: 1 };
  return { x0, y0, x1, y1 };
}
