/**
 * Ground vehicles as stack models (they rotate with their heading).
 * Model space: u = forward, v = right, h = up, in tiles.
 */
import { mix, shade } from './color';
import { boxPart, prismPart, tubePart, type StackPart } from './stack';

const TIRE = '#23252b';
const GLASS = '#1e2a44';
const CHROME = '#cbd5e1';
const DARK = '#334155';

/** Window glass: dark at the bottom, a sky reflection toward the top. */
function glass(t: number): string {
  return t > 0.55 && t < 0.75 ? mix(GLASS, '#a5c8f0', 0.55) : mix(GLASS, '#5b7bb0', t * 0.6);
}

/** A tire (vertical disc along u) with a light hub on its outer face. */
function wheel(u: number, v: number, r: number, w: number, hub = CHROME): StackPart[] {
  const side = v >= 0 ? 1 : -1;
  const tire: StackPart = {
    cu: u,
    cv: v,
    ch: r,
    h0: 0,
    h1: 2 * r,
    outline: false,
    section: (h) => {
      const dh = h - r;
      if (Math.abs(dh) > r) return null;
      const hw = Math.sqrt(r * r - dh * dh);
      return [u - hw, v - w / 2, u + hw, v - w / 2, u + hw, v + w / 2, u - hw, v + w / 2];
    },
    color: (_h, t) => (t > 0.85 ? '#3a3d45' : TIRE),
  };
  const rr = r * 0.52;
  const vv = v + side * (w / 2 + 0.002);
  const cap: StackPart = {
    cu: u,
    cv: vv,
    ch: r,
    h0: r - rr,
    h1: r + rr,
    outline: false,
    bias: 2,
    section: (h) => {
      const dh = h - r;
      if (Math.abs(dh) > rr) return null;
      const hw = Math.sqrt(rr * rr - dh * dh);
      return [u - hw, vv - 0.002, u + hw, vv - 0.002, u + hw, vv + 0.002, u - hw, vv + 0.002];
    },
    color: (_h, t) => shade(hub, t > 0.5 ? 0.1 : -0.12),
  };
  return [tire, cap];
}

/** Box with cut corners (softer car bodies). */
function rbox(u0: number, v0: number, u1: number, v1: number, h0: number, h1: number, c: number, color: (t: number) => string, extra?: Partial<StackPart>): StackPart {
  const poly = [u0 + c, v0, u1 - c, v0, u1, v0 + c, u1, v1 - c, u1 - c, v1, u0 + c, v1, u0, v1 - c, u0, v0 + c];
  return prismPart(poly, h0, h1, color, extra);
}

/** Cabin whose front and back lean in with height (windshields), sides tuck in a little. */
function cabin(u0: number, v0: number, u1: number, v1: number, h0: number, h1: number, front: number, back: number, color: (t: number) => string, extra?: Partial<StackPart>): StackPart {
  return {
    cu: (u0 + u1) / 2,
    cv: (v0 + v1) / 2,
    ch: (h0 + h1) / 2,
    h0,
    h1,
    section: (h) => {
      const t = (h - h0) / Math.max(1e-6, h1 - h0);
      const a = u0 + back * t;
      const b = u1 - front * t;
      const tuck = 0.01 * t;
      return [a, v0 + tuck, b, v0 + tuck, b, v1 - tuck, a, v1 - tuck];
    },
    color: (_h, t) => color(t),
    ...extra,
  };
}

/** Body paint shaded from a darker sill to a lit top edge. */
function paint(color: string, t: number): string {
  return t > 0.88 ? shade(color, 0.28) : shade(color, -0.22 + t * 0.22);
}

function lights(u: number, w: number, h: number, color: string, r = 0.012): NonNullable<StackPart['dots']> {
  return [
    { u, v: -w, h, r, color },
    { u, v: w, h, r, color },
  ];
}

// ------------------------------------------------------------------ airport vehicles

function fuelTruck(): StackPart[] {
  const body = '#f7c548';
  const parts: StackPart[] = [];
  // three axles: steering in front, a tandem under the tank
  for (const u of [0.24, -0.15, -0.26]) for (const v of [-0.1, 0.1]) parts.push(...wheel(u, v, 0.045, 0.036));
  // chassis rail and hazard-striped side skirts
  parts.push(boxPart(-0.33, -0.09, 0.33, 0.09, 0.035, 0.07, (t) => shade('#2b2f38', -0.1 + t * 0.2)));
  for (let k = 0; k < 6; k++) {
    const u0 = -0.11 + k * 0.035;
    for (const v of [-0.115, 0.1]) parts.push(boxPart(u0, v, u0 + 0.035, v + 0.015, 0.05, 0.075, () => (k % 2 ? '#1f2937' : '#facc15'), { outline: false, bias: 1 }));
  }
  // cab: painted lower half, wraparound windows, a light roof
  parts.push(rbox(0.13, -0.11, 0.34, 0.11, 0.07, 0.17, 0.02, (t) => paint(body, t)));
  parts.push(cabin(0.13, -0.105, 0.335, 0.105, 0.17, 0.26, 0.05, 0.0, glass, { outline: false, bias: 1 }));
  parts.push(cabin(0.13, -0.105, 0.285, 0.105, 0.26, 0.278, 0.01, 0, (t) => shade(body, 0.2 + t * 0.15)));
  // grille, bumper and headlights
  parts.push(boxPart(0.335, -0.09, 0.35, 0.09, 0.045, 0.12, () => DARK, { outline: false, bias: 2, dots: lights(0.352, 0.065, 0.1, '#fff7d6', 0.014) }));
  // mirrors
  for (const v of [-1, 1]) parts.push(boxPart(0.27, v * 0.13 - 0.008, 0.29, v * 0.13 + 0.008, 0.18, 0.23, () => DARK, { outline: false, bias: 2 }));
  // roof beacon (its blink is drawn on top while driving)
  parts.push(boxPart(0.2, -0.02, 0.24, 0.02, 0.278, 0.305, (t) => (t > 0.6 ? '#ffb347' : '#f97316'), { outline: false, bias: 4 }));
  // tank: white, red band, two dark straps, a walkway with hatches on top
  parts.push(
    tubePart({
      u0: -0.31,
      u1: 0.11,
      v: 0,
      hc: 0.18,
      r: 0.1,
      tall: 0.9,
      profile: (s) => (s < 0.06 ? 0.8 + s * 3.3 : s > 0.94 ? 0.8 + (1 - s) * 3.3 : 1),
      color: (_h, rel) => {
        const c = rel > 0.4 && rel < 0.52 ? '#e8473f' : '#f4f6f9';
        return rel > 0.86 ? shade(c, 0.25) : shade(c, -0.28 * (1 - rel));
      },
      samples: 14,
    }),
  );
  for (const u of [-0.2, 0.0]) {
    parts.push(
      tubePart({ u0: u, u1: u + 0.022, v: 0, hc: 0.18, r: 0.104, tall: 0.9, profile: () => 1, color: (_h, rel) => shade('#64748b', -0.2 + rel * 0.3), samples: 2, outline: false, bias: 1 }),
    );
  }
  parts.push(
    boxPart(-0.26, -0.025, 0.07, 0.025, 0.268, 0.278, () => '#94a3b8', {
      outline: false,
      bias: 3,
      dots: [
        { u: -0.18, v: 0, h: 0.28, r: 0.016, color: '#475569' },
        { u: -0.06, v: 0, h: 0.28, r: 0.016, color: '#475569' },
      ],
    }),
  );
  // rear: hose reel cabinet and tail lights
  parts.push(boxPart(-0.355, -0.08, -0.31, 0.08, 0.06, 0.15, (t) => shade('#475569', -0.1 + t * 0.2), { dots: lights(-0.357, 0.06, 0.08, '#ef4444', 0.012) }));
  return parts;
}

/** A person sitting in a seat (driver), facing forward. */
function driver(u: number, v: number, h: number, shirt: string, skin = '#e0ac69'): StackPart[] {
  return [
    boxPart(u - 0.02, v - 0.025, u + 0.02, v + 0.025, h, h + 0.07, (t) => shade(shirt, -0.15 + t * 0.2), { outline: false, bias: 2 }),
    tubePart({ u0: u - 0.016, u1: u + 0.016, v, hc: h + 0.092, r: 0.018, tall: 1.2, profile: () => 1, color: () => skin, samples: 4, outline: false, bias: 3 }),
    boxPart(u - 0.018, v - 0.02, u + 0.024, v + 0.02, h + 0.106, h + 0.118, () => '#1e3a8a', { outline: false, bias: 4 }),
  ];
}

function bagTrain(): StackPart[] {
  const tug = '#2563eb';
  const parts: StackPart[] = [];
  // tug: low body, driver under a canopy on four posts
  for (const [u, v] of [[0.28, 0.075], [0.28, -0.075], [0.12, 0.075], [0.12, -0.075]]) parts.push(...wheel(u, v, 0.032, 0.026));
  parts.push(rbox(0.07, -0.085, 0.34, 0.085, 0.025, 0.1, 0.02, (t) => paint(tug, t), { dots: lights(0.343, 0.055, 0.075, '#fff7d6', 0.011) }));
  parts.push(boxPart(0.24, -0.07, 0.34, 0.07, 0.1, 0.13, (t) => paint(tug, t + 0.2)));
  parts.push(boxPart(0.09, -0.05, 0.15, 0.05, 0.1, 0.13, () => '#1f2937', { outline: false }));
  parts.push(...driver(0.14, 0, 0.12, '#a3e635'));
  for (const [u, v] of [[0.09, 0.07], [0.09, -0.07], [0.3, 0.07], [0.3, -0.07]]) parts.push(boxPart(u - 0.006, v - 0.006, u + 0.006, v + 0.006, 0.1, 0.27, () => '#475569', { outline: false, bias: 1 }));
  parts.push(boxPart(0.07, -0.085, 0.32, 0.085, 0.27, 0.285, (t) => (t > 0.5 ? '#f8fafc' : '#cbd5e1'), { bias: 5 }));
  parts.push(boxPart(0.19, -0.015, 0.22, 0.015, 0.285, 0.305, () => '#f97316', { outline: false, bias: 6 }));
  // hitch
  parts.push(boxPart(-0.03, -0.01, 0.08, 0.01, 0.04, 0.055, () => '#475569', { outline: false }));
  const bags = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b', '#f97316'];
  for (let c = 0; c < 2; c++) {
    const u0 = -0.3 - c * 0.31;
    const u1 = u0 + 0.27;
    for (const [u, v] of [[u0 + 0.05, 0.07], [u0 + 0.05, -0.07], [u1 - 0.05, 0.07], [u1 - 0.05, -0.07]]) parts.push(...wheel(u, v, 0.026, 0.02, '#94a3b8'));
    // deck and low side rails
    parts.push(boxPart(u0, -0.085, u1, 0.085, 0.045, 0.07, (t) => shade('#94a3b8', -0.15 + t * 0.25)));
    for (const v of [-0.085, 0.079]) parts.push(boxPart(u0, v, u1, v + 0.006, 0.07, 0.115, () => '#64748b', { outline: false, bias: 1 }));
    for (const u of [u0, u1 - 0.006]) parts.push(boxPart(u, -0.085, u + 0.006, 0.085, 0.07, 0.115, () => '#64748b', { outline: false, bias: 1 }));
    // suitcases with handles, stacked a little unevenly
    for (let k = 0; k < 3; k++) {
      for (let r = 0; r < 2; r++) {
        const bu = u0 + 0.02 + k * 0.08;
        const v0 = r === 0 ? -0.07 : 0.005;
        const col = bags[(c * 6 + k * 2 + r) % bags.length];
        const top = 0.13 + ((k + r + c) % 3) * 0.015;
        parts.push(boxPart(bu, v0, bu + 0.065, v0 + 0.065, 0.07, top, (t) => (t > 0.85 ? shade(col, 0.3) : shade(col, -0.18 + t * 0.1)), { bias: 3 }));
        parts.push(boxPart(bu + 0.022, v0 + 0.028, bu + 0.043, v0 + 0.037, top, top + 0.012, () => '#1f2937', { outline: false, bias: 4 }));
      }
    }
    if (c === 0) parts.push(boxPart(u1, -0.008, u1 + 0.05, 0.008, 0.045, 0.058, () => '#475569', { outline: false }));
  }
  return parts;
}

// ------------------------------------------------------------------ cars

export type CarKind = 'sedan' | 'hatch' | 'suv' | 'van' | 'taxi' | 'pickup' | 'bus';

/** Car variants drawn into the atlas: kind and paint. */
export const CAR_VARIANTS: readonly { kind: CarKind; color: string }[] = [
  { kind: 'sedan', color: '#dc2626' },
  { kind: 'sedan', color: '#f8fafc' },
  { kind: 'sedan', color: '#334155' },
  { kind: 'hatch', color: '#2563eb' },
  { kind: 'hatch', color: '#16a34a' },
  { kind: 'hatch', color: '#fbbf24' },
  { kind: 'suv', color: '#111827' },
  { kind: 'suv', color: '#9ca3af' },
  { kind: 'van', color: '#f1f5f9' },
  { kind: 'taxi', color: '#facc15' },
  { kind: 'pickup', color: '#b91c1c' },
  { kind: 'bus', color: '#f8fafc' },
];

export function buildCar(kind: CarKind, color: string): StackPart[] {
  const parts: StackPart[] = [];
  const dims: Record<CarKind, { len: number; wid: number; body: number; roof: number; front: number; back: number; nose: number; tail: number }> = {
    sedan: { len: 0.36, wid: 0.075, body: 0.09, roof: 0.15, front: 0.05, back: 0.04, nose: 0.1, tail: 0.07 },
    hatch: { len: 0.3, wid: 0.072, body: 0.09, roof: 0.155, front: 0.05, back: 0.015, nose: 0.08, tail: 0.02 },
    suv: { len: 0.37, wid: 0.082, body: 0.11, roof: 0.18, front: 0.04, back: 0.01, nose: 0.08, tail: 0.02 },
    van: { len: 0.4, wid: 0.082, body: 0.12, roof: 0.21, front: 0.06, back: 0.0, nose: 0.05, tail: 0.0 },
    taxi: { len: 0.36, wid: 0.075, body: 0.09, roof: 0.15, front: 0.05, back: 0.04, nose: 0.1, tail: 0.07 },
    pickup: { len: 0.4, wid: 0.08, body: 0.1, roof: 0.165, front: 0.04, back: 0.01, nose: 0.09, tail: 0.17 },
    bus: { len: 0.72, wid: 0.09, body: 0.14, roof: 0.25, front: 0.02, back: 0.0, nose: 0.01, tail: 0.0 },
  };
  const d = dims[kind];
  const L = d.len / 2;
  const W = d.wid;
  const r = kind === 'bus' ? 0.04 : 0.032;
  const axle = kind === 'bus' ? L * 0.68 : L * 0.62;
  for (const u of [axle, -axle]) for (const v of [-W + 0.012, W - 0.012]) parts.push(...wheel(u, v, r, 0.026));
  // lower body with bumpers and lights
  parts.push(
    rbox(-L, -W, L, W, 0.025, d.body, kind === 'bus' ? 0.01 : 0.03, (t) => (kind === 'taxi' && t > 0.45 && t < 0.62 ? '#111827' : paint(color, t)), {
      dots: [...lights(L + 0.002, W * 0.68, d.body * 0.72, '#fff7d6', 0.011), ...lights(-L - 0.002, W * 0.68, d.body * 0.72, '#ef4444', 0.01)],
    }),
  );
  parts.push(boxPart(L - 0.012, -W + 0.01, L + 0.006, W - 0.01, 0.03, 0.05, () => '#1f2937', { outline: false, bias: 1 }));
  parts.push(boxPart(-L - 0.006, -W + 0.01, -L + 0.012, W - 0.01, 0.03, 0.05, () => '#1f2937', { outline: false, bias: 1 }));
  // greenhouse: windows and roof
  const cu0 = -L + d.tail;
  const cu1 = L - d.nose;
  const glassTop = d.roof - 0.012;
  parts.push(cabin(cu0, -W + 0.006, cu1, W - 0.006, d.body, glassTop, d.front, d.back, glass, { outline: false, bias: 1 }));
  const rf0 = cu0 + d.back;
  const rf1 = cu1 - d.front;
  parts.push(cabin(rf0, -W + 0.016, rf1, W - 0.016, glassTop, d.roof, 0.004, 0.004, (t) => shade(color, 0.12 + t * 0.18)));
  if (kind === 'bus') {
    // a band of livery under the windows and a door
    parts.push(boxPart(-L + 0.01, -W - 0.002, L - 0.01, W + 0.002, d.body - 0.025, d.body - 0.008, () => '#2563eb', { outline: false, bias: 2 }));
    parts.push(boxPart(L - 0.17, W - 0.004, L - 0.11, W + 0.003, 0.03, d.roof - 0.02, () => mix(GLASS, '#5b7bb0', 0.4), { outline: false, bias: 3 }));
  }
  if (kind === 'pickup') {
    // open bed behind the cab
    parts.push(boxPart(-L + 0.015, -W + 0.012, cu0 - 0.005, W - 0.012, d.body - 0.02, d.body - 0.005, () => shade(color, -0.4), { outline: false, bias: 2 }));
  }
  if (kind === 'taxi') {
    parts.push(boxPart(-0.025, -0.03, 0.025, 0.03, d.roof, d.roof + 0.025, (t) => (t > 0.6 ? '#fde68a' : '#1f2937'), { outline: false, bias: 4 }));
  }
  if (kind === 'suv' || kind === 'van') {
    // roof rails
    for (const v of [-W + 0.02, W - 0.026]) parts.push(boxPart(rf0 + 0.02, v, rf1 - 0.02, v + 0.006, d.roof, d.roof + 0.01, () => '#475569', { outline: false, bias: 3 }));
  }
  // side mirrors
  for (const v of [-1, 1]) parts.push(boxPart(cu1 - 0.03, v * (W + 0.008) - 0.006, cu1 - 0.012, v * (W + 0.008) + 0.006, d.body + 0.01, d.body + 0.03, () => shade(color, -0.2), { outline: false, bias: 2 }));
  return parts;
}

/** The mechanics' van: white with orange stripes, roof ladder, side lockers, a beacon. */
function mechVan(): StackPart[] {
  const body = '#f8fafc';
  const parts: StackPart[] = [];
  for (const u of [0.15, -0.15]) for (const v of [-0.082, 0.082]) parts.push(...wheel(u, v, 0.036, 0.028));
  // body: a tall box with a sloped nose
  parts.push(rbox(-0.24, -0.095, 0.2, 0.095, 0.03, 0.2, 0.02, (t) => paint(body, t)));
  parts.push(cabin(0.12, -0.093, 0.26, 0.093, 0.03, 0.15, 0.06, 0, (t) => paint(body, t * 0.8)));
  parts.push(cabin(0.12, -0.09, 0.235, 0.09, 0.13, 0.2, 0.06, 0, glass, { outline: false, bias: 1 }));
  // orange and navy stripes along the sides
  for (const v of [-0.097, 0.095]) {
    parts.push(boxPart(-0.235, v, 0.17, v + 0.002, 0.085, 0.105, () => '#f97316', { outline: false, bias: 2 }));
    parts.push(boxPart(-0.235, v, 0.17, v + 0.002, 0.075, 0.085, () => '#1e3a8a', { outline: false, bias: 2 }));
    // locker doors with handles
    for (const u0 of [-0.2, -0.11, -0.02]) {
      parts.push(boxPart(u0, v, u0 + 0.08, v + 0.002, 0.115, 0.185, () => '#e2e8f0', { outline: false, bias: 2, dots: [{ u: u0 + 0.065, v: v < 0 ? v - 0.002 : v + 0.004, h: 0.15, r: 0.006, color: '#475569' }] }));
    }
  }
  // roof: ladder rack, a ladder, a beacon bar
  for (const v of [-0.07, 0.064]) parts.push(boxPart(-0.22, v, 0.1, v + 0.006, 0.2, 0.215, () => '#64748b', { outline: false, bias: 3 }));
  parts.push(boxPart(-0.21, -0.03, 0.09, -0.018, 0.215, 0.225, () => '#cbd5e1', { outline: false, bias: 4 }));
  parts.push(boxPart(-0.21, 0.018, 0.09, 0.03, 0.215, 0.225, () => '#cbd5e1', { outline: false, bias: 4 }));
  for (let k = 0; k < 7; k++) parts.push(boxPart(-0.2 + k * 0.045, -0.02, -0.192 + k * 0.045, 0.02, 0.217, 0.224, () => '#94a3b8', { outline: false, bias: 4 }));
  parts.push(boxPart(0.11, -0.055, 0.14, 0.055, 0.2, 0.222, (t) => (t > 0.5 ? '#fdba74' : '#f97316'), { outline: false, bias: 5 }));
  // bumper, grille, lights
  parts.push(boxPart(0.255, -0.08, 0.27, 0.08, 0.03, 0.075, () => DARK, { outline: false, bias: 2, dots: lights(0.272, 0.06, 0.07, '#fff7d6', 0.012) }));
  parts.push(boxPart(-0.25, -0.085, -0.238, 0.085, 0.03, 0.06, () => DARK, { outline: false, bias: 2, dots: lights(-0.252, 0.07, 0.12, '#ef4444', 0.01) }));
  for (const v of [-1, 1]) parts.push(boxPart(0.16, v * 0.103 - 0.006, 0.18, v * 0.103 + 0.006, 0.13, 0.165, () => DARK, { outline: false, bias: 2 }));
  return parts;
}

/** Fuel tanker semi: a red tractor and a long polished tank trailer on five axles. */
function tankerTruck(): StackPart[] {
  const cab = '#b91c1c';
  const parts: StackPart[] = [];
  // tractor wheels and trailer bogies
  for (const u of [0.42, 0.25, 0.18]) for (const v of [-0.1, 0.1]) parts.push(...wheel(u, v, 0.045, 0.036));
  for (const u of [-0.38, -0.46, -0.54]) for (const v of [-0.1, 0.1]) parts.push(...wheel(u, v, 0.045, 0.036));
  parts.push(boxPart(0.12, -0.08, 0.5, 0.08, 0.04, 0.075, (t) => shade('#1f2937', -0.1 + t * 0.2)));
  // cab with sleeper, sun visor, chrome stacks
  parts.push(rbox(0.3, -0.115, 0.54, 0.115, 0.075, 0.2, 0.02, (t) => paint(cab, t)));
  parts.push(cabin(0.36, -0.11, 0.535, 0.11, 0.2, 0.3, 0.05, 0, glass, { outline: false, bias: 1 }));
  parts.push(rbox(0.25, -0.11, 0.38, 0.11, 0.075, 0.33, 0.015, (t) => paint(cab, t)));
  parts.push(boxPart(0.36, -0.1, 0.52, 0.1, 0.3, 0.315, (t) => shade(cab, 0.15 + t * 0.15)));
  parts.push(boxPart(0.49, -0.105, 0.545, 0.105, 0.29, 0.305, () => '#111827', { outline: false, bias: 2 }));
  for (const v of [-0.12, 0.12]) parts.push(tubePart({ u0: 0.26, u1: 0.28, v, hc: 0.3, r: 0.012, tall: 8, profile: () => 1, color: (_h, rel) => shade(CHROME, rel * 0.2), samples: 3, outline: false, bias: 2 }));
  parts.push(boxPart(0.54, -0.1, 0.56, 0.1, 0.05, 0.14, () => CHROME, { outline: false, bias: 2, dots: lights(0.562, 0.075, 0.11, '#fff7d6', 0.014) }));
  for (const v of [-1, 1]) parts.push(boxPart(0.46, v * 0.13 - 0.008, 0.48, v * 0.13 + 0.008, 0.2, 0.26, () => DARK, { outline: false, bias: 2 }));
  // fifth wheel, landing legs
  parts.push(boxPart(0.14, -0.06, 0.24, 0.06, 0.075, 0.09, () => '#111827', { outline: false }));
  for (const v of [-0.07, 0.07]) parts.push(boxPart(-0.02, v - 0.008, 0.0, v + 0.008, 0.02, 0.1, () => '#475569', { outline: false, bias: 1 }));
  // the tank: polished aluminium, ribs, a walkway with hatches, a red diamond placard
  parts.push(
    tubePart({
      u0: -0.6,
      u1: 0.24,
      v: 0,
      hc: 0.21,
      r: 0.12,
      tall: 0.95,
      profile: (s) => (s < 0.04 ? 0.82 + s * 4.5 : s > 0.96 ? 0.82 + (1 - s) * 4.5 : 1),
      color: (_h, rel) => (rel > 0.82 ? '#f8fafc' : rel > 0.55 ? '#dfe5ec' : shade('#b8c2ce', -0.25 * (1 - rel))),
      samples: 16,
    }),
  );
  for (const u of [-0.42, -0.2, 0.02]) {
    parts.push(tubePart({ u0: u, u1: u + 0.02, v: 0, hc: 0.21, r: 0.124, tall: 0.95, profile: () => 1, color: (_h, rel) => shade('#94a3b8', -0.2 + rel * 0.3), samples: 2, outline: false, bias: 1 }));
  }
  parts.push(
    boxPart(-0.52, -0.03, 0.16, 0.03, 0.32, 0.33, () => '#94a3b8', {
      outline: false,
      bias: 3,
      dots: [
        { u: -0.4, v: 0, h: 0.335, r: 0.018, color: '#475569' },
        { u: -0.2, v: 0, h: 0.335, r: 0.018, color: '#475569' },
        { u: 0.0, v: 0, h: 0.335, r: 0.018, color: '#475569' },
      ],
    }),
  );
  for (const v of [-0.123, 0.12]) parts.push(boxPart(-0.12, v, -0.07, v + 0.003, 0.18, 0.23, () => '#dc2626', { outline: false, bias: 3 }));
  // rear bumper with lights, valve cabinet underneath
  parts.push(boxPart(-0.62, -0.1, -0.6, 0.1, 0.04, 0.09, () => '#1f2937', { outline: false, bias: 2, dots: lights(-0.622, 0.08, 0.07, '#ef4444', 0.012) }));
  parts.push(boxPart(-0.3, -0.07, -0.12, 0.07, 0.05, 0.1, (t) => shade('#475569', -0.1 + t * 0.2), { outline: false, bias: 1 }));
  return parts;
}

/** Spare-parts box truck: white cab, a tall box with a roller door and the supplier's blue band. */
function partsTruck(): StackPart[] {
  const parts: StackPart[] = [];
  for (const u of [0.2, -0.17, -0.25]) for (const v of [-0.09, 0.09]) parts.push(...wheel(u, v, 0.04, 0.03));
  parts.push(boxPart(-0.3, -0.07, 0.28, 0.07, 0.035, 0.07, (t) => shade('#1f2937', -0.1 + t * 0.2)));
  parts.push(rbox(0.12, -0.1, 0.32, 0.1, 0.06, 0.16, 0.02, (t) => paint('#f1f5f9', t)));
  parts.push(cabin(0.12, -0.096, 0.315, 0.096, 0.16, 0.25, 0.06, 0, glass, { outline: false, bias: 1 }));
  parts.push(boxPart(0.12, -0.096, 0.25, 0.096, 0.25, 0.265, (t) => shade('#f1f5f9', 0.1 + t * 0.15)));
  parts.push(boxPart(0.315, -0.085, 0.33, 0.085, 0.05, 0.11, () => DARK, { outline: false, bias: 2, dots: lights(0.332, 0.065, 0.095, '#fff7d6', 0.012) }));
  // the box
  parts.push(rbox(-0.33, -0.11, 0.11, 0.11, 0.07, 0.34, 0.01, (t) => (t > 0.94 ? '#ffffff' : shade('#eef2f7', -0.12 + t * 0.12))));
  for (const v of [-0.112, 0.11]) {
    parts.push(boxPart(-0.32, v, 0.1, v + 0.002, 0.2, 0.25, () => '#2563eb', { outline: false, bias: 2 }));
    parts.push(boxPart(-0.32, v, 0.1, v + 0.002, 0.25, 0.258, () => '#facc15', { outline: false, bias: 2 }));
  }
  // roller door at the back (ribbed), tail lights
  for (let k = 0; k < 6; k++) parts.push(boxPart(-0.334, -0.09, -0.33, 0.09, 0.09 + k * 0.04, 0.12 + k * 0.04, () => (k % 2 ? '#cbd5e1' : '#e2e8f0'), { outline: false, bias: 2 }));
  parts.push(boxPart(-0.34, -0.1, -0.33, 0.1, 0.045, 0.075, () => '#1f2937', { outline: false, bias: 2, dots: lights(-0.342, 0.085, 0.06, '#ef4444', 0.011) }));
  return parts;
}

/** Airport crash tender: a big red truck on three axles, lime stripes, a roof water cannon, light bar. */
function fireTruck(): StackPart[] {
  const red = '#dc2626';
  const parts: StackPart[] = [];
  for (const u of [0.24, -0.1, -0.24]) for (const v of [-0.115, 0.115]) parts.push(...wheel(u, v, 0.055, 0.04));
  parts.push(boxPart(-0.32, -0.1, 0.34, 0.1, 0.04, 0.08, (t) => shade('#1f2937', -0.1 + t * 0.2)));
  // body: low cab in front, tall tank and pump body behind
  parts.push(rbox(0.12, -0.125, 0.38, 0.125, 0.07, 0.2, 0.025, (t) => paint(red, t)));
  parts.push(cabin(0.14, -0.12, 0.375, 0.12, 0.2, 0.29, 0.07, 0, glass, { outline: false, bias: 1 }));
  parts.push(boxPart(0.14, -0.12, 0.3, 0.12, 0.29, 0.305, (t) => shade(red, 0.15 + t * 0.15)));
  parts.push(rbox(-0.34, -0.13, 0.13, 0.13, 0.07, 0.31, 0.02, (t) => paint(red, t)));
  // lime-yellow reflective band and roller shutters for the hoses
  for (const v of [-0.133, 0.13]) {
    parts.push(boxPart(-0.33, v, 0.37, v + 0.003, 0.12, 0.145, () => '#d9f99d', { outline: false, bias: 2 }));
    for (const u0 of [-0.3, -0.18, -0.06]) parts.push(boxPart(u0, v, u0 + 0.1, v + 0.003, 0.16, 0.28, (t) => (Math.floor(t * 8) % 2 ? '#cbd5e1' : '#e2e8f0'), { outline: false, bias: 2 }));
  }
  // roof: water cannon on a turret, walkway, the light bar over the cab
  parts.push(boxPart(-0.06, -0.04, 0.04, 0.04, 0.31, 0.35, () => '#475569', { outline: false, bias: 3 }));
  parts.push(tubePart({ u0: 0.0, u1: 0.16, v: 0, hc: 0.36, r: 0.016, tall: 1, profile: (s) => 1 - s * 0.4, color: (_h, rel) => shade(CHROME, rel * 0.2), samples: 4, outline: false, bias: 4 }));
  parts.push(boxPart(-0.3, -0.03, -0.1, 0.03, 0.31, 0.318, () => '#94a3b8', { outline: false, bias: 3 }));
  parts.push(boxPart(0.2, -0.08, 0.24, 0.08, 0.305, 0.33, (t) => (t > 0.5 ? '#fca5a5' : '#ef4444'), { outline: false, bias: 5 }));
  parts.push(boxPart(0.375, -0.1, 0.39, 0.1, 0.05, 0.13, () => '#e5e7eb', { outline: false, bias: 2, dots: lights(0.392, 0.08, 0.11, '#fff7d6', 0.014) }));
  parts.push(boxPart(-0.355, -0.1, -0.34, 0.1, 0.05, 0.1, () => '#1f2937', { outline: false, bias: 2, dots: lights(-0.357, 0.08, 0.09, '#ef4444', 0.012) }));
  for (const v of [-1, 1]) parts.push(boxPart(0.3, v * 0.14 - 0.008, 0.32, v * 0.14 + 0.008, 0.2, 0.26, () => DARK, { outline: false, bias: 2 }));
  return parts;
}

/** Runway inspection car: a yellow pickup, an orange light bar and a checkered flag on a whip. */
function opsCar(): StackPart[] {
  const body = '#facc15';
  const parts: StackPart[] = [];
  for (const u of [0.13, -0.13]) for (const v of [-0.075, 0.075]) parts.push(...wheel(u, v, 0.034, 0.026));
  parts.push(rbox(-0.21, -0.085, 0.21, 0.085, 0.03, 0.105, 0.025, (t) => paint(body, t), { dots: [...lights(0.212, 0.06, 0.08, '#fff7d6', 0.011), ...lights(-0.212, 0.06, 0.08, '#ef4444', 0.01)] }));
  parts.push(cabin(-0.02, -0.08, 0.15, 0.08, 0.105, 0.18, 0.04, 0.01, glass, { outline: false, bias: 1 }));
  parts.push(boxPart(0.0, -0.075, 0.11, 0.075, 0.18, 0.192, (t) => shade(body, 0.15 + t * 0.15)));
  // open bed with a toolbox, the light bar, black-and-white checks on the doors
  parts.push(boxPart(-0.2, -0.07, -0.03, 0.07, 0.09, 0.1, () => shade(body, -0.45), { outline: false, bias: 2 }));
  parts.push(boxPart(-0.17, -0.06, -0.08, 0.06, 0.1, 0.14, () => '#334155', { outline: false, bias: 3 }));
  parts.push(boxPart(0.03, -0.06, 0.08, 0.06, 0.192, 0.21, (t) => (t > 0.5 ? '#fdba74' : '#f97316'), { outline: false, bias: 4 }));
  for (const v of [-0.087, 0.085]) for (let k = 0; k < 4; k++) parts.push(boxPart(0.0 + k * 0.03, v, 0.03 + k * 0.03, v + 0.002, 0.05 + (k % 2) * 0.025, 0.075 + (k % 2) * 0.025, () => '#111827', { outline: false, bias: 2 }));
  parts.push(boxPart(-0.19, 0.055, -0.185, 0.06, 0.1, 0.36, () => '#64748b', { outline: false, bias: 3 }));
  for (let k = 0; k < 4; k++) parts.push(boxPart(-0.185 - (k % 2) * 0.03, 0.058, -0.155 - (k % 2) * 0.03, 0.06, 0.3 + Math.floor(k / 2) * 0.03, 0.33 + Math.floor(k / 2) * 0.03, () => (k % 3 === 0 ? '#111827' : '#f8fafc'), { outline: false, bias: 4 }));
  return parts;
}

/**
 * Security patrol car: a white sedan with a blue and yellow checked band on
 * the doors, a "security" bar on the roof (blue lights) and a push bar.
 */
function patrolCar(): StackPart[] {
  const body = '#f8fafc';
  const parts: StackPart[] = [];
  for (const u of [0.14, -0.14]) for (const v of [-0.078, 0.078]) parts.push(...wheel(u, v, 0.035, 0.027));
  parts.push(rbox(-0.23, -0.088, 0.23, 0.088, 0.03, 0.1, 0.03, (t) => paint(body, t), { dots: [...lights(0.232, 0.062, 0.085, '#fff7d6', 0.011), ...lights(-0.232, 0.062, 0.085, '#ef4444', 0.01)] }));
  parts.push(cabin(-0.1, -0.082, 0.12, 0.082, 0.1, 0.175, 0.05, 0.04, glass, { outline: false, bias: 1 }));
  parts.push(boxPart(-0.08, -0.075, 0.08, 0.075, 0.175, 0.185, (t) => shade(body, 0.1 + t * 0.15)));
  // the checked band on the doors
  for (const v of [-0.09, 0.088]) for (let k = 0; k < 10; k++) {
    const u0 = -0.2 + k * 0.04;
    parts.push(boxPart(u0, v, u0 + 0.04, v + 0.002, 0.055, 0.075, () => (k % 2 ? '#facc15' : '#1d4ed8'), { outline: false, bias: 2 }));
  }
  // the light bar (blue at the ends) and the push bar in front
  parts.push(boxPart(-0.03, -0.065, 0.04, 0.065, 0.185, 0.205, (t) => (t > 0.5 ? '#93c5fd' : '#1e293b'), { outline: false, bias: 4 }));
  parts.push(boxPart(-0.025, -0.07, 0.035, -0.04, 0.186, 0.207, () => '#2563eb', { outline: false, bias: 5 }));
  parts.push(boxPart(-0.025, 0.04, 0.035, 0.07, 0.186, 0.207, () => '#2563eb', { outline: false, bias: 5 }));
  parts.push(boxPart(0.23, -0.07, 0.25, 0.07, 0.03, 0.08, () => '#1f2937', { outline: false, bias: 2 }));
  return parts;
}

/**
 * Ambulance: a white box body on a van cab, a red band and a yellow-and-green
 * checkered stripe, a blue light bar, a rear door with a step, and a white
 * star (six arms) in a red disc on the sides and the roof.
 */
function ambulance(): StackPart[] {
  const body = '#fbfdff';
  const parts: StackPart[] = [];
  for (const u of [0.16, -0.16]) for (const v of [-0.085, 0.085]) parts.push(...wheel(u, v, 0.037, 0.028));
  parts.push(boxPart(-0.25, -0.08, 0.27, 0.08, 0.03, 0.06, (t) => shade('#1f2937', t * 0.2)));
  // the box (taller than the cab) and the cab with its sloped nose
  parts.push(rbox(-0.27, -0.102, 0.12, 0.102, 0.05, 0.255, 0.015, (t) => paint(body, t)));
  parts.push(cabin(0.11, -0.092, 0.28, 0.092, 0.04, 0.165, 0.07, 0, (t) => paint(body, t * 0.8)));
  parts.push(cabin(0.115, -0.088, 0.255, 0.088, 0.14, 0.205, 0.06, 0, glass, { outline: false, bias: 1 }));
  for (const v of [-0.104, 0.102]) {
    // red band, then the checkered stripe (yellow and green) under the windows
    parts.push(boxPart(-0.265, v, 0.27, v + 0.002, 0.135, 0.155, () => '#dc2626', { outline: false, bias: 2 }));
    for (let k = 0; k < 9; k++) {
      const u0 = -0.265 + k * 0.042;
      parts.push(boxPart(u0, v, u0 + 0.042, v + 0.002, 0.09, 0.112, () => (k % 2 ? '#22c55e' : '#facc15'), { outline: false, bias: 2 }));
      parts.push(boxPart(u0, v, u0 + 0.042, v + 0.002, 0.112, 0.134, () => (k % 2 ? '#facc15' : '#22c55e'), { outline: false, bias: 2 }));
    }
    // the emblem: a red disc with a white six-armed star
    parts.push(boxPart(-0.12, v, -0.04, v + 0.002, 0.165, 0.245, () => '#dc2626', { outline: false, bias: 3, dots: [{ u: -0.08, v: v < 0 ? v - 0.003 : v + 0.005, h: 0.205, r: 0.022, color: '#ffffff' }] }));
    // a small side window in the box
    parts.push(boxPart(0.03, v, 0.1, v + 0.002, 0.175, 0.225, () => GLASS, { outline: false, bias: 2 }));
  }
  // roof: the light bar over the cab (blue and red), a big emblem, an air vent
  parts.push(boxPart(0.06, -0.075, 0.105, 0.075, 0.255, 0.278, (t) => (t > 0.5 ? '#93c5fd' : '#2563eb'), { outline: false, bias: 5, dots: [{ u: 0.083, v: -0.06, h: 0.28, r: 0.012, color: '#ef4444' }, { u: 0.083, v: 0.06, h: 0.28, r: 0.012, color: '#ef4444' }] }));
  parts.push(boxPart(-0.2, -0.055, -0.08, 0.055, 0.255, 0.26, () => '#dc2626', { outline: false, bias: 4, dots: [{ u: -0.14, v: 0, h: 0.262, r: 0.026, color: '#ffffff' }] }));
  parts.push(boxPart(-0.25, -0.03, -0.22, 0.03, 0.255, 0.275, () => '#cbd5e1', { outline: false, bias: 4 }));
  // rear doors with a split and a step; tail lights; front bumper and lights
  parts.push(boxPart(-0.278, -0.095, -0.27, 0.095, 0.06, 0.245, () => '#eef2f7', { outline: false, bias: 2, dots: lights(-0.28, 0.07, 0.22, '#ef4444', 0.011) }));
  parts.push(boxPart(-0.281, -0.003, -0.278, 0.003, 0.07, 0.24, () => '#94a3b8', { outline: false, bias: 3 }));
  parts.push(boxPart(-0.3, -0.07, -0.27, 0.07, 0.035, 0.05, () => '#475569', { outline: false, bias: 2 }));
  parts.push(boxPart(0.275, -0.08, 0.29, 0.08, 0.035, 0.08, () => DARK, { outline: false, bias: 2, dots: lights(0.292, 0.06, 0.07, '#fff7d6', 0.012) }));
  for (const v of [-1, 1]) parts.push(boxPart(0.17, v * 0.1 - 0.006, 0.19, v * 0.1 + 0.006, 0.13, 0.165, () => DARK, { outline: false, bias: 2 }));
  return parts;
}

/**
 * Apron bus: long and low, white with a blue band, a glass band of windows
 * all along, two double doors on the curb side, air conditioning on the roof.
 */
function apronBus(): StackPart[] {
  const body = '#f8fafc';
  const parts: StackPart[] = [];
  for (const u of [0.36, -0.36]) for (const v of [-0.12, 0.12]) parts.push(...wheel(u, v, 0.045, 0.03));
  parts.push(rbox(-0.5, -0.135, 0.5, 0.135, 0.035, 0.29, 0.04, (t) => paint(body, t), { dots: [...lights(0.502, 0.1, 0.07, '#fff7d6', 0.012), ...lights(-0.502, 0.1, 0.07, '#ef4444', 0.011)] }));
  for (const v of [-0.137, 0.135]) {
    // the window band, the blue stripe under it, the doors
    parts.push(boxPart(-0.46, v, 0.46, v + 0.002, 0.15, 0.26, () => GLASS, { outline: false, bias: 2 }));
    parts.push(boxPart(-0.48, v, 0.48, v + 0.002, 0.1, 0.13, () => '#2563eb', { outline: false, bias: 2 }));
    for (const u0 of [-0.22, 0.18]) parts.push(boxPart(u0, v, u0 + 0.12, v + 0.002, 0.04, 0.26, () => '#cbd5e1', { outline: false, bias: 3 }));
  }
  // front and back glass, roof units
  parts.push(boxPart(0.495, -0.11, 0.505, 0.11, 0.14, 0.27, () => GLASS, { outline: false, bias: 2 }));
  parts.push(boxPart(-0.2, -0.08, 0.1, 0.08, 0.29, 0.33, () => '#cbd5e1', { outline: false, bias: 3 }));
  parts.push(boxPart(0.25, -0.05, 0.35, 0.05, 0.29, 0.31, () => '#facc15', { outline: false, bias: 4 }));
  return parts;
}

/** A long black limousine for the celebrity: chrome trim and dark glass all round. */
function limo(): StackPart[] {
  const body = '#111827';
  const parts: StackPart[] = [];
  for (const u of [0.2, -0.2]) for (const v of [-0.07, 0.07]) parts.push(...wheel(u, v, 0.032, 0.024, '#e5e7eb'));
  parts.push(rbox(-0.3, -0.08, 0.3, 0.08, 0.03, 0.095, 0.03, (t) => paint(body, t), { dots: [...lights(0.302, 0.055, 0.07, '#fff7d6', 0.011), ...lights(-0.302, 0.055, 0.07, '#ef4444', 0.01)] }));
  parts.push(cabin(-0.2, -0.072, 0.16, 0.072, 0.095, 0.16, 0.05, 0.04, (t) => (t > 0.9 ? '#374151' : '#0b1220'), { outline: false, bias: 1 }));
  for (const v of [-0.082, 0.08]) parts.push(boxPart(-0.29, v, 0.29, v + 0.002, 0.07, 0.076, () => '#e5e7eb', { outline: false, bias: 2 }));
  return parts;
}

/**
 * People-mover car: a white capsule on a dark running gear, a band of tall
 * windows all round, a sky-blue stripe, two pairs of sliding doors on each
 * side, glass ends with lights at both (it runs both ways).
 */
function apmCar(): StackPart[] {
  const body = '#f8fafc';
  const parts: StackPart[] = [];
  parts.push(boxPart(-0.28, -0.1, 0.28, 0.1, 0.0, 0.04, () => '#334155', { outline: false }));
  parts.push(rbox(-0.327, -0.138, 0.327, 0.138, 0.04, 0.27, 0.07, (t) => paint(body, t), { dots: [...lights(0.329, 0.08, 0.075, '#fff7d6', 0.012), ...lights(-0.329, 0.08, 0.075, '#fff7d6', 0.012)] }));
  for (const v of [-0.14, 0.138]) {
    parts.push(boxPart(-0.28, v, 0.28, v + 0.002, 0.125, 0.235, () => GLASS, { outline: false, bias: 2 }));
    parts.push(boxPart(-0.3, v, 0.3, v + 0.002, 0.08, 0.105, () => '#0ea5e9', { outline: false, bias: 2 }));
    for (const u0 of [-0.17, 0.07]) parts.push(boxPart(u0, v, u0 + 0.1, v + 0.002, 0.045, 0.24, () => '#cbd5e1', { outline: false, bias: 3 }));
  }
  for (const u of [0.3, -0.31]) parts.push(boxPart(u, -0.1, u + 0.01, 0.1, 0.125, 0.245, () => GLASS, { outline: false, bias: 2 }));
  parts.push(boxPart(-0.12, -0.07, 0.12, 0.07, 0.27, 0.295, () => '#e2e8f0', { outline: false, bias: 3 }));
  return parts;
}

/**
 * Double-deck commuter coach: white, two rows of windows, a red band, a blue
 * skirt, two doors a side, a grey roof. The cab car has a sloped driver's
 * end with a big windscreen and lights (the train runs east, cab first).
 */
function railCar(cab: boolean): StackPart[] {
  const body = '#f1f5f9';
  const parts: StackPart[] = [];
  for (const u of [0.45, -0.45]) for (const v of [-0.12, 0.12]) parts.push(...wheel(u, v, 0.05, 0.03, '#475569'));
  const u1 = cab ? 0.48 : 0.6;
  parts.push(rbox(-0.6, -0.16, u1, 0.16, 0.05, 0.42, 0.03, (t) => paint(body, t)));
  if (cab) {
    parts.push(cabin(0.46, -0.16, 0.615, 0.16, 0.05, 0.4, 0.1, 0, (t) => paint(body, t), { dots: lights(0.62, 0.11, 0.1, '#fff7d6', 0.016) }));
    parts.push(cabin(0.5, -0.13, 0.6, 0.13, 0.22, 0.37, 0.08, 0, glass, { outline: false, bias: 1 }));
    parts.push(boxPart(0.47, -0.162, 0.6, 0.162, 0.215, 0.25, () => '#dc2626', { outline: false, bias: 2 }));
    // the pantograph
    parts.push(boxPart(0.1, -0.06, 0.3, 0.06, 0.42, 0.47, () => '#475569', { outline: false, bias: 4 }));
  }
  for (const v of [-0.162, 0.16]) {
    parts.push(boxPart(-0.56, v, u1 - 0.04, v + 0.002, 0.13, 0.2, () => GLASS, { outline: false, bias: 2 }));
    parts.push(boxPart(-0.56, v, u1 - 0.04, v + 0.002, 0.27, 0.35, () => GLASS, { outline: false, bias: 2 }));
    parts.push(boxPart(-0.58, v, u1, v + 0.002, 0.215, 0.25, () => '#dc2626', { outline: false, bias: 2 }));
    parts.push(boxPart(-0.58, v, u1, v + 0.002, 0.055, 0.1, () => '#1d4ed8', { outline: false, bias: 2 }));
    for (const u0 of [-0.42, 0.22]) parts.push(boxPart(u0, v, u0 + 0.11, v + 0.002, 0.07, 0.36, () => '#94a3b8', { outline: false, bias: 3 }));
  }
  parts.push(boxPart(-0.58, -0.13, u1 - 0.02, 0.13, 0.42, 0.44, () => '#cbd5e1', { outline: false, bias: 3 }));
  return parts;
}

// ------------------------------------------------------------------ entry points

export type VehicleKind = 'fuel' | 'bags' | 'mech' | 'tanker' | 'partsTruck' | 'fire' | 'opsCar' | 'ambulance' | 'limo' | 'apronBus' | 'apmCar' | 'railCar' | 'railCab' | 'patrol';

export function buildVehicle(kind: VehicleKind): StackPart[] {
  switch (kind) {
    case 'fuel':
      return fuelTruck();
    case 'bags':
      return bagTrain();
    case 'mech':
      return mechVan();
    case 'tanker':
      return tankerTruck();
    case 'partsTruck':
      return partsTruck();
    case 'fire':
      return fireTruck();
    case 'opsCar':
      return opsCar();
    case 'ambulance':
      return ambulance();
    case 'limo':
      return limo();
    case 'apronBus':
      return apronBus();
    case 'apmCar':
      return apmCar();
    case 'railCar':
      return railCar(false);
    case 'railCab':
      return railCar(true);
    case 'patrol':
      return patrolCar();
  }
}

/** Where the roof beacon sits on each service vehicle (model space), for the blinking light. */
export const BEACON: Record<VehicleKind, { u: number; v: number; h: number }> = {
  fuel: { u: 0.22, v: 0, h: 0.31 },
  bags: { u: 0.205, v: 0, h: 0.31 },
  mech: { u: 0.125, v: 0, h: 0.225 },
  tanker: { u: 0.4, v: 0, h: 0.33 },
  partsTruck: { u: 0.2, v: 0, h: 0.27 },
  fire: { u: 0.22, v: 0, h: 0.34 },
  opsCar: { u: 0.055, v: 0, h: 0.215 },
  ambulance: { u: 0.083, v: 0, h: 0.285 },
  limo: { u: 0, v: 0, h: 0 },
  apronBus: { u: 0.3, v: 0, h: 0.32 },
  apmCar: { u: 0, v: 0, h: 0 },
  railCar: { u: 0, v: 0, h: 0 },
  railCab: { u: 0, v: 0, h: 0 },
  patrol: { u: 0.005, v: 0, h: 0.21 },
};
