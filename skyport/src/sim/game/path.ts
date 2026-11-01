/** Polyline paths stored flat as [x, y, z, x, y, z, ...]. */
export type Path = number[];

/** Chaikin corner cutting that keeps both endpoints. */
export function chaikin(p: Path, iterations = 2): Path {
  let cur = p;
  for (let it = 0; it < iterations; it++) {
    const n = cur.length / 3;
    if (n < 3) return cur.slice();
    const out: Path = [cur[0], cur[1], cur[2]];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 3;
      const b = a + 3;
      const q = [0.75 * cur[a] + 0.25 * cur[b], 0.75 * cur[a + 1] + 0.25 * cur[b + 1], 0.75 * cur[a + 2] + 0.25 * cur[b + 2]];
      const r = [0.25 * cur[a] + 0.75 * cur[b], 0.25 * cur[a + 1] + 0.75 * cur[b + 1], 0.25 * cur[a + 2] + 0.75 * cur[b + 2]];
      if (i > 0) out.push(q[0], q[1], q[2]);
      if (i < n - 2) out.push(r[0], r[1], r[2]);
    }
    const l = (n - 1) * 3;
    out.push(cur[l], cur[l + 1], cur[l + 2]);
    cur = out;
  }
  return cur;
}

/** Horizontal length (z ignored, so climbing does not slow planes down). */
export function pathLength(p: Path): number {
  let len = 0;
  for (let i = 3; i < p.length; i += 3) len += Math.hypot(p[i] - p[i - 3], p[i + 1] - p[i - 2]);
  return len;
}

export interface PathSample {
  x: number;
  y: number;
  z: number;
  /** Direction of travel (radians, world frame). */
  heading: number;
  /** Distance left to the end. */
  left: number;
}

/** Position at distance d along the path. */
export function samplePath(p: Path, d: number, out: PathSample): PathSample {
  const n = p.length / 3;
  if (n === 0) {
    out.x = out.y = out.z = out.left = 0;
    return out;
  }
  if (n === 1 || d <= 0) {
    out.x = p[0];
    out.y = p[1];
    out.z = p[2];
    if (n > 1) out.heading = Math.atan2(p[4] - p[1], p[3] - p[0]);
    out.left = pathLength(p) - Math.max(0, d);
    return out;
  }
  let acc = 0;
  for (let i = 3; i < p.length; i += 3) {
    const dx = p[i] - p[i - 3];
    const dy = p[i + 1] - p[i - 2];
    const seg = Math.hypot(dx, dy);
    if (seg > 1e-9 && acc + seg >= d) {
      const t = (d - acc) / seg;
      out.x = p[i - 3] + dx * t;
      out.y = p[i - 2] + dy * t;
      out.z = p[i - 1] + (p[i + 2] - p[i - 1]) * t;
      out.heading = Math.atan2(dy, dx);
      // remaining length
      let rest = seg - (d - acc);
      for (let j = i + 3; j < p.length; j += 3) rest += Math.hypot(p[j] - p[j - 3], p[j + 1] - p[j - 2]);
      out.left = rest;
      return out;
    }
    acc += seg;
  }
  const l = p.length - 3;
  out.x = p[l];
  out.y = p[l + 1];
  out.z = p[l + 2];
  if (n > 1) {
    const dx = p[l] - p[l - 3];
    const dy = p[l + 1] - p[l - 2];
    if (Math.hypot(dx, dy) > 1e-9) out.heading = Math.atan2(dy, dx);
  }
  out.left = 0;
  return out;
}

export function makeSample(): PathSample {
  return { x: 0, y: 0, z: 0, heading: 0, left: 0 };
}

/** Shortest signed angle from a to b. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
