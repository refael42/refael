import { sprite } from '../sprite';
import { box, floorShadow, onFaceX, onFaceY, P, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';

// The kitchen's newer jobs (src/data/staff.ts): the packing counter with its takeaway window,
// where the packers work and the couriers take the bags from outside, the checker's green tick
// on a dish they passed, and the packer's icon for the staff screen.

const PAPER = '#C99A5B';
const BRAND = '#E5483B';
const WOOD = '#6A4A2A';

/**
 * A steel packing counter in the kitchen's front row, flat boxes and tape on it, the tablet the
 * online orders come in on; at its front edge the takeaway window: a frame in the front wall,
 * a striped awning over the street side and the sill the packed bags wait on.
 */
const packTable = sprite([-42, -80, 42, 28], (c) => {
  floorShadow(c, 0, 0.05, 0.55, 0.3);
  box(c, { x: 0, y: -0.04, w: 0.9, d: 0.8, h: 18, color: '#AEB8C4', rim: true });
  // Flat-pack boxes, the tape, and the order tablet on its stand.
  for (let i = 0; i < 3; i++) box(c, { x: -0.22, y: -0.2, z: 18 + i * 2.2, w: 0.34, d: 0.3, h: 2, color: i % 2 ? PAPER : '#B58646', rim: true });
  box(c, { x: 0.1, y: -0.3, z: 18, w: 0.14, d: 0.08, h: 3, color: BRAND, rim: true });
  box(c, { x: 0.3, y: -0.1, z: 18, w: 0.04, d: 0.04, h: 5, color: '#3A3A44' });
  box(c, { x: 0.3, y: -0.1, z: 23, w: 0.04, d: 0.26, h: 11, color: '#2A2830', rim: true });
  onFaceX(c, 0.32, 0.03, () => {
    rectIn(c, 0.02, 24, 0.22, 9, '#3FC7C0');
    rectIn(c, 0.05, 30, 0.12, 1.4, '#FFFFFF');
    rectIn(c, 0.05, 27, 0.08, 1.4, '#FFFFFF');
  });
  // The window frame in the front wall.
  for (const x of [-0.46, 0.46]) box(c, { x, y: 0.47, w: 0.06, d: 0.06, h: 54, color: WOOD, rim: true });
  box(c, { x: 0, y: 0.47, z: 52, w: 0.98, d: 0.08, h: 5, color: WOOD, rim: true });
  onFaceY(c, 0.51, -0.3, () => {
    rectIn(c, 0, 53, 0.6, 3.6, '#FFF4E3');
    rectIn(c, 0.27, 53.6, 0.06, 2.4, BRAND);
  });
  // The striped awning, sloping out over the street side.
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = -0.49 + (i * 0.98) / n;
    const b = a + 0.98 / n;
    c.drawPath(path.poly([P(a, 0.44, 64), P(b, 0.44, 64), P(b, 0.86, 50), P(a, 0.86, 50)]), fill(i % 2 ? '#FFF4E3' : BRAND));
  }
  c.drawPath(path.polyline([P(-0.49, 0.86, 50), P(0.49, 0.86, 50)]), stroke('#9A2A20', 1.2));
  // The sill the bags wait on.
  box(c, { x: 0, y: 0.5, z: 17, w: 0.96, d: 0.2, h: 2.4, color: '#B07A4A', rim: true });
});

/** A takeaway food box, lid open: fries and a burger inside (on the pass, in the packer's hands). */
const foodBox = sprite([-11, -17, 11, 4], (c) => {
  box(c, { x: 0, y: 0, w: 0.17, d: 0.13, h: 5, color: '#E9D6A8', rim: true });
  // The food peeking out.
  const [fx, fy] = P(0, 0, 5);
  c.drawCircle(fx - 2, fy - 1, 2.6, fill('#C8642A'));
  c.drawCircle(fx - 2, fy - 2, 2.2, fill('#E9A55B'));
  for (const dx of [1.5, 2.6, 3.6]) c.drawLine(fx + dx, fy, fx + dx + 0.4, fy - 4.5, stroke('#F6C945', 1));
  // The lid, folded open toward the back.
  c.drawPath(path.poly([P(-0.085, -0.065, 5), P(0.085, -0.065, 5), P(0.085, -0.13, 13), P(-0.085, -0.13, 13)]), fill('#D8C08A'));
  c.drawPath(path.polyline([P(-0.085, -0.13, 13), P(0.085, -0.13, 13)]), stroke('#B59A5E', 0.8));
});

/** A paper bag standing open on the counter, waiting for the food box. */
const bagOpen = sprite([-10, -22, 10, 4], (c) => {
  box(c, { x: 0, y: 0, w: 0.16, d: 0.11, h: 14, color: PAPER, rim: true });
  // The dark opening at the top.
  c.drawPath(path.poly([P(-0.07, -0.045, 14), P(0.07, -0.045, 14), P(0.07, 0.045, 14), P(-0.07, 0.045, 14)]), fill('#7A5A30'));
  onFaceY(c, 0.055, -0.08, () => rectIn(c, 0.04, 5, 0.08, 4.5, BRAND));
});

/** The checker's mark on a dish they passed: a green disc with a white tick. */
const checkBadge = sprite([-7, -7, 7, 7], (c) => {
  c.drawCircle(0, 0, 5.6, fill('#2A1530'));
  c.drawCircle(0, 0, 4.6, fill('#35B957'));
  c.drawPath(path.polyline([[-2.4, 0.2], [-0.6, 2], [2.6, -1.8]]), stroke('#FFFFFF', 1.6));
});

/** The packer's icon: a taped cardboard box with the brand sticker. */
const packBox = sprite([-14, -20, 14, 6], (c) => {
  box(c, { x: 0, y: 0, w: 0.36, d: 0.3, h: 12, color: PAPER, rim: true });
  box(c, { x: 0, y: 0, z: 12, w: 0.06, d: 0.31, h: 0.6, color: '#E8D9B0' });
  onFaceY(c, 0.15, -0.12, () => rectIn(c, 0.05, 4, 0.14, 4.5, BRAND));
});

export const crewSprites = { packTable, checkBadge, packBox, foodBox, bagOpen };
