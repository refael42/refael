/** Ground vehicles as stack models (they rotate with their heading). */
import { mix, shade } from './color';
import { boxPart, prismPart, tubePart, type StackPart } from './stack';

const TIRE = '#25262c';
const GLASS = '#22304d';

function wheels(len: number, wid: number, r = 0.045): StackPart[] {
  const out: StackPart[] = [];
  for (const u of [-len * 0.32, len * 0.3]) {
    for (const v of [-wid, wid]) {
      out.push(prismPart([u - r, v - 0.018, u + r, v - 0.018, u + r, v + 0.018, u - r, v + 0.018], 0, r * 1.5, () => TIRE, { outline: false, cu: u, cv: v }));
    }
  }
  return out;
}

export type VehicleKind = 'fuel' | 'bags';

export function buildVehicle(kind: VehicleKind): StackPart[] {
  switch (kind) {
    case 'fuel': {
      const body = '#f7c548';
      const parts: StackPart[] = [
        ...wheels(0.62, 0.11),
        boxPart(-0.31, -0.11, 0.31, 0.11, 0.035, 0.075, (t) => shade('#3a3f4a', -0.2 + t * 0.3)),
        // cab
        boxPart(0.14, -0.11, 0.31, 0.11, 0.075, 0.27, (t) => (t > 0.9 ? shade(body, 0.3) : shade(body, -0.18 * (1 - t)))),
        boxPart(0.27, -0.1, 0.315, 0.1, 0.17, 0.255, (t) => mix(GLASS, '#7fa7d9', t * 0.5), { outline: false, bias: 3 }),
        // tank
        tubePart({
          u0: -0.3,
          u1: 0.12,
          v: 0,
          hc: 0.17,
          r: 0.1,
          tall: 0.95,
          profile: (s) => (s < 0.08 ? 0.75 + s * 3 : s > 0.92 ? 0.75 + (1 - s) * 3 : 1),
          color: (_h, rel) => {
            const c = rel > 0.42 && rel < 0.55 ? '#e8473f' : '#eef1f5';
            return rel > 0.85 ? shade(c, 0.3) : shade(c, -0.25 * (1 - rel));
          },
          samples: 12,
        }),
        // beacon
        boxPart(0.2, -0.015, 0.23, 0.015, 0.27, 0.3, () => '#ff8a1f', { outline: false, bias: 4 }),
      ];
      return parts;
    }
    case 'bags': {
      // a little tug pulling two open carts with colorful suitcases
      const tug = '#3b82f6';
      const parts: StackPart[] = [
        // tug
        ...[[0.26, 0.07], [0.26, -0.07], [0.12, 0.07], [0.12, -0.07]].map(([u, v]) =>
          prismPart([u - 0.03, v - 0.015, u + 0.03, v - 0.015, u + 0.03, v + 0.015, u - 0.03, v + 0.015], 0, 0.05, () => TIRE, { outline: false, cu: u, cv: v }),
        ),
        boxPart(0.08, -0.08, 0.32, 0.08, 0.03, 0.12, (t) => shade(tug, -0.2 + t * 0.3)),
        boxPart(0.08, -0.07, 0.17, 0.07, 0.12, 0.24, (t) => (t > 0.85 ? shade(tug, 0.35) : shade(tug, -0.1)), { bias: 2 }),
        // tow bar
        boxPart(-0.02, -0.01, 0.09, 0.01, 0.04, 0.055, () => '#475569', { outline: false }),
      ];
      const bagColors = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9', '#ec4899'];
      for (let c = 0; c < 2; c++) {
        const u0 = -0.3 - c * 0.3;
        const u1 = u0 + 0.26;
        for (const [u, v] of [[u0 + 0.05, 0.07], [u0 + 0.05, -0.07], [u1 - 0.05, 0.07], [u1 - 0.05, -0.07]]) {
          parts.push(prismPart([u - 0.025, v - 0.012, u + 0.025, v - 0.012, u + 0.025, v + 0.012, u - 0.025, v + 0.012], 0, 0.045, () => TIRE, { outline: false, cu: u, cv: v }));
        }
        parts.push(boxPart(u0, -0.085, u1, 0.085, 0.04, 0.075, (t) => shade('#94a3b8', -0.15 + t * 0.25)));
        // suitcases
        for (let k = 0; k < 3; k++) {
          const bu = u0 + 0.03 + k * 0.075;
          const col = bagColors[(c * 3 + k) % bagColors.length];
          parts.push(boxPart(bu, -0.06, bu + 0.06, 0.06, 0.075, 0.15 + (k % 2) * 0.02, (t) => (t > 0.85 ? shade(col, 0.3) : shade(col, -0.15)), { bias: 3 }));
        }
        if (c === 0) parts.push(boxPart(u1, -0.01, u1 + 0.05, 0.01, 0.04, 0.05, () => '#475569', { outline: false }));
      }
      return parts;
    }
  }
  return [];
}
