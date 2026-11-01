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

export type VehicleKind = 'fuel';

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
  }
  return [];
}
