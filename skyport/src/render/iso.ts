/**
 * Isometric projection (2:1). World units are tiles; z is height in tiles.
 * World-screen pixels are at zoom 1, before the camera transform.
 */
export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;
/** Screen pixels per tile of height. */
export const Z_PX = 32;

export function isoX(x: number, y: number): number {
  return (x - y) * HALF_W;
}

export function isoY(x: number, y: number, z = 0): number {
  return (x + y) * HALF_H - z * Z_PX;
}

/** Inverse projection onto the ground plane (z = 0). */
export function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  const a = sx / HALF_W; // x - y
  const b = sy / HALF_H; // x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Painter's depth: larger is closer to the viewer. */
export function depthOf(x: number, y: number, z = 0): number {
  return x + y + z;
}
