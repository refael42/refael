/** Tiny color helpers working on "#rrggbb" strings. */
export type RGB = [number, number, number];

export function parseHex(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: RGB): string {
  const c = (v: number) => {
    const x = Math.max(0, Math.min(255, Math.round(v)));
    return (x < 16 ? '0' : '') + x.toString(16);
  };
  return '#' + c(r) + c(g) + c(b);
}

/** k > 0 lightens toward white, k < 0 darkens toward black. */
export function shade(hex: string, k: number): string {
  const [r, g, b] = parseHex(hex);
  if (k >= 0) return toHex([r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k]);
  const f = 1 + k;
  return toHex([r * f, g * f, b * f]);
}

export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Adds alpha to a hex color: "#rrggbbaa" isn't universal, so return rgba(). */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export const OUTLINE = '#1f2433';
