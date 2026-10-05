// Isometric projection shared by art, renderer and hit-testing. Floor coordinates are in tiles,
// height (z) in screen pixels. One tile is a 64 x 32 diamond.

export const HALF_W = 32;
export const HALF_H = 16;

export function isoX(x: number, y: number): number {
  'worklet';
  return (x - y) * HALF_W;
}

export function isoY(x: number, y: number, z = 0): number {
  'worklet';
  return (x + y) * HALF_H - z;
}

/** Screen-space bounds of a floor rectangle, used for camera limits. */
export function isoBounds(width: number, height: number, top = 0) {
  return {
    minX: isoX(0, height),
    maxX: isoX(width, 0),
    minY: isoY(0, 0, top),
    maxY: isoY(width, height),
  };
}
