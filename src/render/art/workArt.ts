import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken } from './color';
import { box, floorShadow, P } from './iso3d';
import { fill, path, stroke } from './kit';

// A big upgrade in progress (src/data/works.ts): a striped barrier on the floor, a crate of
// parts where a showpiece is going in, and a hammer that swings over the station.

const YELLOW = '#F6C33A';
const BLACK = '#2A2230';

/** Sawhorse barrier with yellow and black stripes, standing in front of the station. */
const workBarrier = sprite([-30, -40, 30, 10], (c) => {
  floorShadow(c, 0, 0, 0.42, 0.22);
  for (const x of [-0.32, 0.32]) {
    box(c, { x, y: -0.05, w: 0.05, d: 0.05, h: 16, color: '#8A8F98' });
    box(c, { x, y: 0.05, w: 0.05, d: 0.05, h: 16, color: '#8A8F98' });
  }
  box(c, { x: 0, y: 0, z: 14, w: 0.82, d: 0.06, h: 7, color: YELLOW, rim: true });
  // Stripes on the face toward the camera.
  for (let i = 0; i < 4; i++) {
    const a = -0.41 + i * 0.22;
    c.drawPath(path.poly([P(a, 0.03, 14), P(a + 0.1, 0.03, 14), P(a + 0.18, 0.03, 21), P(a + 0.08, 0.03, 21)]), fill(BLACK));
  }
  // A blinking lamp on top (the renderer pulses its halo).
  const [lx, ly] = P(0.36, 0, 24);
  c.drawCircle(lx, ly, 2.4, fill('#FF8A2A'));
  c.drawCircle(lx - 0.7, ly - 0.7, 0.9, fill('#FFE3B0'));
});

/** A wooden crate of parts with a hard hat on top: where a showpiece is being put together. */
const workCrate = sprite([-30, -46, 30, 12], (c) => {
  floorShadow(c, 0, 0, 0.4, 0.25);
  box(c, { x: 0, y: 0, w: 0.62, d: 0.62, h: 22, color: '#C08A4E', rim: true });
  // Slats on the two faces we see.
  for (const z of [6, 14]) {
    c.drawPath(path.polyline([P(-0.31, 0.31, z), P(0.31, 0.31, z)]), stroke(darken('#C08A4E', 0.35), 1.2));
    c.drawPath(path.polyline([P(0.31, 0.31, z), P(0.31, -0.31, z)]), stroke(darken('#C08A4E', 0.45), 1.2));
  }
  const [hx, hy] = P(0, 0, 22);
  c.drawPath(path.smooth([[hx - 8, hy - 1], [hx - 6, hy - 7], [hx, hy - 9], [hx + 6, hy - 7], [hx + 8, hy - 1]], true, 0.8), fill(YELLOW));
  c.drawPath(path.smooth([[hx - 8, hy - 1], [hx - 6, hy - 7], [hx, hy - 9], [hx + 6, hy - 7], [hx + 8, hy - 1]], true, 0.8), stroke(darken(YELLOW, 0.4), 1));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(hx - 10, hy - 2, 20, 3), 1.4, 1.4), fill(darken(YELLOW, 0.1)));
});

/** The hammer, drawn upright around its grip (the renderer swings it). */
const workHammer = sprite([-12, -26, 12, 4], (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-1.8, -20, 3.6, 22), 1.6, 1.6), fill('#B07A4A'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-1.8, -20, 3.6, 22), 1.6, 1.6), stroke('#5A3A20', 1));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-9, -25, 18, 7), 2, 2), fill('#8F98A8'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-9, -25, 18, 7), 2, 2), stroke('#3A4050', 1.2));
  c.drawRect(Skia.XYWHRect(-8, -24, 16, 1.6), fill('#D8E0EC'));
});

/** Round dial behind the timer: makes the countdown readable over any floor. */
const workDial = sprite([-26, -11, 26, 11], (c) => {
  const p = Skia.Path.RRect(Skia.RRectXY(Skia.XYWHRect(-24, -9, 48, 18), 9, 9));
  c.drawPath(p, fill('#2A1530', 0.92));
  c.drawPath(p, stroke(YELLOW, 1.6));
});

export const workSprites = { workBarrier, workCrate, workHammer, workDial };
