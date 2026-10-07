// Map camera math, kept free of React Native so it can be unit tested. The camera lives on
// the JS thread (touches arrive there) and is handed to the UI thread only for drawing.

/** Screen = world × zoom + (x, y). */
export interface Cam {
  x: number;
  y: number;
  zoom: number;
}

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const CAMERA = {
  maxZoom: 2.8,
  /** Never zoom out further than this, even on a huge screen. */
  minZoom: 0.45,
  /** How far (px) the map may be pulled past its edge. */
  edge: 60,
  /** Velocity kept per millisecond of a glide after a flick (same feel as Reanimated's decay). */
  deceleration: 0.998,
  /** A glide stops below this speed (px/s). */
  stopSpeed: 8,
};

/** Smallest zoom that still fills the screen with map (or the hard minimum). */
export function minZoomFor(world: WorldBounds, w: number, h: number): number {
  return Math.max(CAMERA.minZoom, Math.min(w / (world.maxX - world.minX), h / (world.maxY - world.minY)));
}

/** Keeps the map covering the screen, or centered on an axis where it is smaller than the screen. */
export function clampCam(cam: Cam, world: WorldBounds, w: number, h: number): void {
  const z = cam.zoom;
  const ww = (world.maxX - world.minX) * z;
  const wh = (world.maxY - world.minY) * z;
  const e = CAMERA.edge;
  cam.x = ww <= w ? (w - ww) / 2 - world.minX * z : Math.min(-world.minX * z + e, Math.max(w - world.maxX * z - e, cam.x));
  cam.y = wh <= h ? (h - wh) / 2 - world.minY * z : Math.min(-world.minY * z + e, Math.max(h - world.maxY * z - e, cam.y));
}

/** Zooms by `factor` around a screen point, so the spot under the fingers stays under them. */
export function zoomAt(cam: Cam, factor: number, px: number, py: number, world: WorldBounds, w: number, h: number): void {
  const nz = Math.min(CAMERA.maxZoom, Math.max(minZoomFor(world, w, h), cam.zoom * factor));
  const k = nz / cam.zoom;
  cam.x = px - (px - cam.x) * k;
  cam.y = py - (py - cam.y) * k;
  cam.zoom = nz;
  clampCam(cam, world, w, h);
}

/** Puts world point (wx, wy) in the middle of the screen. */
export function centerOn(cam: Cam, wx: number, wy: number, zoom: number, w: number, h: number): void {
  cam.zoom = zoom;
  cam.x = w / 2 - wx * zoom;
  cam.y = h / 2 - wy * zoom;
}

/**
 * One step of the glide after a flick: moves by the velocity (px/s) and slows it down.
 * An axis that hits the map edge stops. Returns false once the glide is over.
 */
export function glide(cam: Cam, vel: { x: number; y: number }, dtMs: number, world: WorldBounds, w: number, h: number): boolean {
  const bx = cam.x + vel.x * (dtMs / 1000);
  const by = cam.y + vel.y * (dtMs / 1000);
  cam.x = bx;
  cam.y = by;
  clampCam(cam, world, w, h);
  if (cam.x !== bx) vel.x = 0;
  if (cam.y !== by) vel.y = 0;
  const keep = CAMERA.deceleration ** dtMs;
  vel.x *= keep;
  vel.y *= keep;
  return Math.hypot(vel.x, vel.y) > CAMERA.stopSpeed;
}
