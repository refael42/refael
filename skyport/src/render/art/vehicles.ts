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

// ------------------------------------------------------------------ entry points

export type VehicleKind = 'fuel' | 'bags';

export function buildVehicle(kind: VehicleKind): StackPart[] {
  return kind === 'fuel' ? fuelTruck() : bagTrain();
}

/** Where the roof beacon sits on each service vehicle (model space), for the blinking light. */
export const BEACON: Record<VehicleKind, { u: number; v: number; h: number }> = {
  fuel: { u: 0.22, v: 0, h: 0.31 },
  bags: { u: 0.205, v: 0, h: 0.31 },
};
