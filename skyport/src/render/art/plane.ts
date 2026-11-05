/** Aircraft models built from the data table (art + livery) for the stack renderer. */
import type { AircraftArt } from '../../data/aircraft';
import type { Livery } from '../../data/airlines';
import { mix, shade } from './color';
import { discPart, prismPart, tubePart, type StackPart } from './stack';

const GLASS = '#22304d';
const TIRE = '#2a2a30';

function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

interface Body {
  u0: number;
  u1: number;
  r: number;
  rv: number;
  hc: number;
  profile: (s: number) => number;
  lift: (s: number) => number;
}

function bodyOf(a: AircraftArt): Body {
  const L = a.length;
  const r = a.radius;
  const rv = r * a.tall;
  const hc = a.gear + rv;
  const propNose = a.engines === 'nose';
  const quad = a.engines === 'quad';
  const heli = a.engines === 'rotor' || quad;
  const profile = (s: number) => {
    // an air taxi: a short rounded capsule
    if (quad) return Math.max(0.15, Math.sqrt(Math.max(0, 1 - Math.pow((s - 0.5) / 0.5, 4))));
    if (heli) {
      if (s < 0.5) return 0.22 + 0.1 * smooth(s / 0.5);
      if (s < 0.62) return 0.32 + 0.68 * smooth((s - 0.5) / 0.12);
      const x = (s - 0.62) / 0.38;
      return Math.sqrt(Math.max(0, 1 - x * x * x * x));
    }
    if (s < 0.3) return 0.26 + 0.74 * smooth(s / 0.3);
    const noseStart = propNose ? 0.86 : 0.8;
    if (s <= noseStart) return 1;
    const x = (s - noseStart) / (1 - noseStart);
    const round = Math.sqrt(Math.max(0, 1 - x * x));
    return propNose ? 0.55 + 0.45 * round : Math.max(0.12, round);
  };
  const lift = (s: number) => {
    if (quad) return 0;
    if (heli) return s < 0.5 ? (0.5 - s) * rv * 0.6 : 0;
    return s < 0.32 ? ((0.32 - s) / 0.32) * rv * 0.55 : 0;
  };
  return { u0: -L / 2, u1: L / 2, r, rv, hc, profile, lift };
}

/** Half-width of the fuselage at body position s and height h (0 when outside). */
function halfWidth(b: Body, s: number, h: number): number {
  const p = b.profile(s);
  const rr = b.rv * p;
  const dh = h - (b.hc + b.lift(s));
  if (rr <= 0 || Math.abs(dh) > rr) return 0;
  return b.r * p * Math.sqrt(1 - (dh / rr) * (dh / rr));
}

/** Fuselage cross-section restricted to [sFrom, sTo], scaled in width. */
function bodySection(b: Body, h: number, sFrom: number, sTo: number, widen: number, samples = 22): number[] | null {
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const s = sFrom + ((sTo - sFrom) * i) / samples;
    const w = halfWidth(b, s, h);
    if (w <= 0) continue;
    const u = b.u0 + (b.u1 - b.u0) * s;
    left.push(u, w * widen);
    right.push(u, -w * widen);
  }
  if (left.length < 4) return null;
  const out = left.slice();
  for (let k = right.length - 2; k >= 0; k -= 2) out.push(right[k], right[k + 1]);
  return out;
}

export function buildPlane(a: AircraftArt, liv: Livery, heading: number): StackPart[] {
  const b = bodyOf(a);
  const L = a.length;
  const parts: StackPart[] = [];
  const quad = a.engines === 'quad';
  const heli = a.engines === 'rotor' || quad;

  // Which side faces the viewer (world direction +x+y)?
  const nearSide = Math.cos(heading) - Math.sin(heading) >= 0 ? 1 : -1;

  // --- fuselage
  const topH = b.hc + b.rv + b.lift(0);
  const bodyColor = (_h: number, rel: number) => {
    let c: string;
    if (rel < 0.3) c = liv.belly;
    else if (rel > 0.4 && rel < 0.5) c = liv.stripe;
    else c = liv.body;
    if (rel > 0.86) return shade(c, 0.28);
    if (rel > 0.72) return shade(c, 0.1);
    return shade(c, -0.22 * (1 - rel));
  };
  const windowDots: NonNullable<StackPart['dots']> = [];
  const rows = a.windowRows;
  for (let row = 0; row < rows; row++) {
    const hw = b.hc + b.rv * (rows === 2 ? (row === 0 ? -0.05 : 0.5) : 0.18);
    const n = a.windows;
    const sA = quad ? 0.32 : heli ? 0.66 : a.engines === 'nose' ? 0.52 : 0.3;
    const sB = quad ? 0.72 : heli ? 0.86 : a.engines === 'nose' ? 0.72 : 0.78;
    for (let i = 0; i < n; i++) {
      const s = n === 1 ? (sA + sB) / 2 : sA + ((sB - sA) * i) / (n - 1);
      const w = halfWidth(b, s, hw);
      if (w <= 0) continue;
      windowDots.push({
        u: b.u0 + L * s,
        v: nearSide * (w + 0.002),
        h: hw,
        r: Math.max(0.011, Math.min(0.03, b.r * (heli ? 0.3 : 0.16))),
        color: GLASS,
      });
    }
  }
  const fuselage: StackPart = {
    cu: 0,
    cv: 0,
    ch: b.hc,
    h0: b.hc - b.rv,
    h1: topH,
    section: (h) => bodySection(b, h, 0, 1, 1),
    color: (h) => bodyColor(h, (h - (b.hc - b.rv)) / (topH - (b.hc - b.rv))),
    dots: windowDots,
  };
  parts.push(fuselage);

  // --- cockpit glass
  const sGlassA = heli ? 0.8 : a.engines === 'nose' ? 0.66 : 0.86;
  const sGlassB = heli ? 0.99 : a.engines === 'nose' ? 0.8 : 0.95;
  parts.push({
    cu: b.u0 + L * ((sGlassA + sGlassB) / 2),
    cv: 0,
    ch: b.hc + b.rv * 0.5,
    h0: b.hc + b.rv * (heli ? -0.1 : 0.2),
    h1: b.hc + b.rv * 0.94,
    bias: 2,
    outline: false,
    section: (h) => bodySection(b, h, sGlassA, sGlassB, 1.05, 8),
    color: (_h, t) => mix(GLASS, '#7fa7d9', t * 0.6),
  });

  // --- wings
  const wingCol = (t: number) => (t > 0.6 ? shade(liv.wing, 0.18) : shade(liv.wing, -0.25));
  if (!heli && a.chord > 0) {
    const c = a.chord;
    const uw = a.wing === 'high' ? b.u0 + L * 0.6 : b.u0 + L * 0.52;
    const tipChord = c * (a.sweep > 0.1 ? 0.4 : 0.75);
    const root = b.r * 0.6;
    const half = a.span / 2;
    const hWing = a.wing === 'high' ? b.hc + b.rv * 0.86 : a.gear + b.rv * 0.5;
    const thick = Math.max(0.028, c * 0.12);
    for (const side of [1, -1]) {
      const le0 = uw + c / 2;
      const te0 = uw - c / 2;
      const leT = le0 - a.sweep;
      const teT = leT - tipChord;
      const poly = [le0, side * root, leT, side * half, teT, side * half, te0, side * root];
      parts.push(prismPart(poly, hWing, hWing + thick, wingCol, { cv: side * half * 0.5, bias: a.wing === 'high' ? 3 : 0 }));
      // stripe-colored wing tip
      const tipPoly = [leT + 0.004, side * (half - 0.04), leT, side * half, teT, side * half, teT - 0.004, side * (half - 0.04)];
      parts.push(prismPart(tipPoly, hWing + 0.002, hWing + thick + 0.004, () => liv.accent, { cv: side * half, bias: a.wing === 'high' ? 4 : 1, outline: false }));
    }

    // --- engines
    const es = a.engineSize;
    const nacelle = (u: number, v: number, h: number, len: number, prop: boolean) => {
      parts.push(
        tubePart({
          u0: u - len / 2,
          u1: u + len / 2,
          v,
          hc: h,
          r: es,
          profile: (s) => (prop ? (s > 0.75 ? 0.55 + 0.45 * Math.sqrt(1 - ((s - 0.75) / 0.25) ** 2) : 0.75 + 0.25 * smooth(s / 0.4)) : s > 0.9 ? 0.92 : 0.85 + 0.15 * smooth(s / 0.5)),
          color: (_h, rel) => (rel > 0.8 ? shade(liv.engine, 0.25) : shade(liv.engine, -0.3 * (1 - rel))),
          samples: 10,
          bias: 1,
        }),
      );
      if (prop) {
        parts.push(discPart(u + len / 2 + 0.01, v, h, es * 2.1, '#5b6170', 0.38));
      } else {
        // dark intake ring at the front
        parts.push(
          tubePart({
            u0: u + len / 2 - 0.012,
            u1: u + len / 2,
            v,
            hc: h,
            r: es * 0.94,
            profile: () => 1,
            color: () => '#2b2f3a',
            samples: 2,
            bias: 2,
            outline: false,
          }),
        );
      }
    };
    if (a.engines === 'wingProps') {
      const v = a.span * 0.17;
      const h = a.wing === 'high' ? hWing - es * 0.2 : hWing + es * 0.6;
      for (const side of [1, -1]) nacelle(uw + c * 0.15, side * v, h, es * 4.2, true);
    } else if (a.engines === 'wingJets2' || a.engines === 'wingJets4') {
      const vs = a.engines === 'wingJets2' ? [a.span * 0.17] : [a.span * 0.15, a.span * 0.29];
      for (const vv of vs) {
        const back = a.sweep * (vv / (a.span / 2));
        for (const side of [1, -1]) nacelle(uw + c * 0.45 - back, side * vv, hWing - es * 0.85, es * 3.4, false);
      }
    } else if (a.engines === 'tailJets') {
      for (const side of [1, -1]) nacelle(b.u0 + L * 0.24, side * (b.r + es * 1.05), b.hc + b.rv * 0.45, es * 3.6, false);
    }
  }

  // --- tail: fin + stabilizer
  const finBase = b.hc + b.lift(0.08) + b.rv * 0.3;
  const finH = heli ? b.rv * 1.3 : Math.max(0.2, b.rv * 2.3);
  const finTop = finBase + finH;
  const finRootA = b.u0 + L * 0.0;
  const finRootB = b.u0 + L * (heli ? 0.1 : 0.24);
  const finTipA = b.u0 - L * 0.04;
  const finTipB = b.u0 + L * 0.08;
  const finThick = Math.max(0.012, b.r * 0.1);
  parts.push({
    cu: (finRootA + finRootB) / 2,
    cv: 0,
    ch: (finBase + finTop) / 2,
    h0: finBase,
    h1: finTop,
    bias: 6,
    section: (h) => {
      const t = (h - finBase) / (finTop - finBase);
      const ua = finRootA + (finTipA - finRootA) * t;
      const ub = finRootB + (finTipB - finRootB) * t;
      return [ua, -finThick, ub, -finThick * 0.6, ub, finThick * 0.6, ua, finThick];
    },
    color: (_h, t) => {
      const base = t > 0.55 && t < 0.78 ? liv.accent : liv.tail;
      return t > 0.95 ? shade(base, 0.25) : shade(base, -0.15 * (1 - t));
    },
  });
  if (!heli) {
    const stabSpan = a.span * (a.tail === 'T' ? 0.28 : 0.34);
    const stabChord = a.chord * 0.6 + 0.04;
    const stabH = a.tail === 'T' ? finTop - 0.02 : b.hc + b.lift(0.06) + b.rv * 0.1;
    const su = b.u0 + L * 0.06;
    const sweep = a.sweep * 0.45;
    for (const side of [1, -1]) {
      const poly = [su + stabChord / 2, side * b.r * 0.3, su + stabChord / 2 - sweep - 0.02, side * (stabSpan / 2), su - sweep - 0.02, side * (stabSpan / 2), su - stabChord / 2, side * b.r * 0.3];
      parts.push(prismPart(poly, stabH, stabH + 0.024, wingCol, { cv: side * stabSpan * 0.3, bias: a.tail === 'T' ? 7 : 2 }));
    }
  }

  // --- nose propeller
  if (a.engines === 'nose') {
    parts.push(discPart(b.u1 + 0.012, 0, b.hc + b.rv * 0.05, b.rv * 1.25, '#5b6170', 0.4));
  }

  // --- four rotors on arms (air taxi): light discs over the corners
  if (quad) {
    const rh = b.hc + b.rv * 1.6;
    const R = a.span * 0.17;
    for (const su of [-1, 1])
      for (const sv of [-1, 1]) {
        const cu = su * L * 0.44;
        const cv = sv * a.span * 0.33;
        // the arm from the cabin roof out to the motor
        parts.push(prismPart([0, -0.012, cu, cv - 0.012, cu, cv + 0.012, 0, 0.012], rh - 0.03, rh - 0.01, () => '#334155', { cu: cu / 2, cv: cv / 2, outline: false, bias: 8 }));
        parts.push(prismPart([cu - 0.03, cv - 0.03, cu + 0.03, cv - 0.03, cu + 0.03, cv + 0.03, cu - 0.03, cv + 0.03], rh - 0.04, rh, () => liv.accent, { cu, cv, outline: false, bias: 8 }));
        parts.push({
          cu,
          cv,
          ch: rh + 0.01,
          h0: rh + 0.005,
          h1: rh + 0.012,
          alpha: 0.5,
          outline: false,
          bias: 9,
          section: () => {
            const out: number[] = [];
            for (let i = 0; i < 18; i++) {
              const ang = (i / 18) * Math.PI * 2;
              out.push(cu + Math.cos(ang) * R, cv + Math.sin(ang) * R);
            }
            return out;
          },
          color: () => '#94a3b8',
        });
      }
  }

  // --- rotor (helicopter)
  if (heli && !quad) {
    const rh = b.hc + b.rv + 0.05;
    const R = a.span / 2;
    parts.push({
      cu: b.u0 + L * 0.7,
      cv: 0,
      ch: rh,
      h0: rh,
      h1: rh + 0.01,
      alpha: 0.3,
      outline: false,
      bias: 9,
      section: () => {
        const out: number[] = [];
        for (let i = 0; i < 24; i++) {
          const ang = (i / 24) * Math.PI * 2;
          out.push(b.u0 + L * 0.7 + Math.cos(ang) * R, Math.sin(ang) * R);
        }
        return out;
      },
      color: () => '#4a4f5c',
    });
  }

  // --- landing gear (wheels)
  const wheel = (u: number, v: number) =>
    prismPart([u - 0.028, v - 0.014, u + 0.028, v - 0.014, u + 0.028, v + 0.014, u - 0.028, v + 0.014], 0, Math.max(0.03, a.gear * 0.75), () => TIRE, { cu: u, cv: v, outline: false });
  if (!heli) {
    const mainU = b.u0 + L * 0.5;
    parts.push(wheel(mainU, b.r * 1.1), wheel(mainU, -b.r * 1.1), wheel(b.u0 + L * 0.88, 0));
  } else {
    // skids
    for (const side of [1, -1]) {
      parts.push(
        prismPart([b.u0 + L * 0.5, side * b.r * 1.0 - 0.01, b.u0 + L * 0.95, side * b.r * 1.0 - 0.01, b.u0 + L * 0.95, side * b.r * 1.0 + 0.01, b.u0 + L * 0.5, side * b.r * 1.0 + 0.01], 0, 0.02, () => '#3a3f4a', { outline: false }),
      );
    }
  }
  return parts;
}
