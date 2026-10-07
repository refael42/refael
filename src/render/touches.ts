// Turns raw finger positions into map gestures: one finger drags, two fingers pinch (and
// drag), a short touch that barely moves is a tap, a quick release is a flick. Pure TS on
// purpose: it runs on the JS thread from React Native's own touch events, and is unit tested.

export interface Finger {
  id: number;
  x: number;
  y: number;
}

export const TOUCH = {
  /** A tap may wander this far (px) and still count as a tap. */
  tapSlop: 12,
  /** ...and must end within this time. */
  tapMs: 600,
  /** The flick speed is measured over the last part of the drag. */
  flingWindowMs: 100,
};

interface Sample {
  t: number;
  x: number;
  y: number;
}

export interface TouchTracker {
  /** Fingers as of the last event (screen px, local to the map view). */
  fingers: Finger[];
  start: Sample;
  /** Went past the tap slop: no longer a tap. */
  moved: boolean;
  /** A second finger touched at some point: a pinch, never a tap or a flick. */
  multi: boolean;
  /** Recent finger-centroid positions, for the flick speed. */
  samples: Sample[];
}

/** Movement since the previous event: pan by (dx, dy) and zoom by `scale` around (cx, cy). */
export interface TouchDelta {
  dx: number;
  dy: number;
  scale: number;
  cx: number;
  cy: number;
}

function centroid(fingers: readonly Finger[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const f of fingers) {
    x += f.x;
    y += f.y;
  }
  return { x: x / fingers.length, y: y / fingers.length };
}

/** Average distance of the fingers from their centroid (0 for one finger). */
function spread(fingers: readonly Finger[], c: { x: number; y: number }): number {
  let d = 0;
  for (const f of fingers) d += Math.hypot(f.x - c.x, f.y - c.y);
  return d / fingers.length;
}

const sameFingers = (a: readonly Finger[], b: readonly Finger[]) => a.length === b.length && a.every((f) => b.some((g) => g.id === f.id));

export function touchStart(fingers: Finger[], t: number): TouchTracker {
  const c = centroid(fingers);
  return { fingers, start: { t, x: c.x, y: c.y }, moved: false, multi: fingers.length > 1, samples: [{ t, x: c.x, y: c.y }] };
}

/**
 * New finger positions (a move, or a finger added or lifted). When the set of fingers
 * changes we only re-anchor: measuring across the change would make the map jump.
 */
export function touchMove(tr: TouchTracker, fingers: Finger[], t: number): TouchDelta | null {
  if (fingers.length === 0) return null;
  const prev = tr.fingers;
  tr.fingers = fingers;
  if (fingers.length > 1) tr.multi = true;
  const c = centroid(fingers);
  if (!sameFingers(prev, fingers)) {
    tr.samples = [{ t, x: c.x, y: c.y }];
    return null;
  }
  const p = centroid(prev);
  if (!tr.moved && Math.hypot(c.x - tr.start.x, c.y - tr.start.y) > TOUCH.tapSlop) tr.moved = true;
  tr.samples.push({ t, x: c.x, y: c.y });
  while (tr.samples.length > 2 && tr.samples[0]!.t < t - TOUCH.flingWindowMs) tr.samples.shift();
  const before = spread(prev, p);
  const after = spread(fingers, c);
  return { dx: c.x - p.x, dy: c.y - p.y, scale: fingers.length > 1 && before > 0 && after > 0 ? after / before : 1, cx: c.x, cy: c.y };
}

/** All fingers lifted: was it a tap (where), or a flick (how fast, px/s)? */
export function touchEnd(tr: TouchTracker, t: number): { tap: { x: number; y: number } | null; fling: { x: number; y: number } | null } {
  const tap = !tr.moved && !tr.multi && t - tr.start.t <= TOUCH.tapMs ? { x: tr.start.x, y: tr.start.y } : null;
  let fling: { x: number; y: number } | null = null;
  const recent = tr.samples.filter((s) => s.t >= t - TOUCH.flingWindowMs);
  if (tr.moved && !tr.multi && recent.length >= 2) {
    const a = recent[0]!;
    const b = recent[recent.length - 1]!;
    const dt = (b.t - a.t) / 1000;
    if (dt > 0.01) fling = { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }
  return { tap, fling };
}
