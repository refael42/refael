/**
 * Geometry of the generated demo floor plan (public/demo/plan-floor-4.pdf).
 * Shared by the PDF generator script and the seed, so the seeded pins land
 * exactly on the drawn apartments. Units: PDF points, origin top-left.
 */
export const PLAN_PAGE = { width: 1190, height: 842 };

export const PLAN_APARTMENTS = [16, 17, 18, 19, 20].map((n, i) => ({
  number: n,
  x: 80 + i * 210,
  y: 150,
  w: 190,
  h: 300,
}));

export const PLAN_CORRIDOR = { x: 80, y: 470, w: 1030, h: 90 };
export const PLAN_STAIRS = { x: 900, y: 580, w: 210, h: 170 };
export const PLAN_BALCONIES = { x: 80, y: 90, w: 1030, h: 50 };

/** Centre of a rectangle, normalised to 0..1 page coordinates. */
export function normCentre(r: { x: number; y: number; w: number; h: number }) {
  return { x: (r.x + r.w / 2) / PLAN_PAGE.width, y: (r.y + r.h / 2) / PLAN_PAGE.height };
}
