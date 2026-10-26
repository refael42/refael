import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box, floorShadow, onFaceX, onFaceY, P, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';

// Suppliers and the storeroom (owner M51): the supplier's van at the curb (green; red with a
// flashing light for an urgent order), the crates it unloads (one per ingredient: vegetables,
// meat and fish in a cooler, the pantry's sacks), and the pictures of the two new upgrades.
// Anchor = center of the footprint, like every prop.

const VAN_W = 2.4;
const VAN_D = 1.05;
const GLASS = '#2D4F86';

function wheel(c: SkCanvas, a: number) {
  c.drawOval(Skia.XYWHRect(a - 0.2, -1, 0.4, 12), fill('#24212B'));
  c.drawOval(Skia.XYWHRect(a - 0.1, 2.2, 0.2, 6), fill('#B9BEC8'));
}

/** A box van, its cargo box behind a lower cab (it drives toward +x). */
function van(color: string, urgent: boolean) {
  return sprite([-62, -78, 62, 34], (c) => {
    for (const x of [-0.8, 0, 0.8]) floorShadow(c, x, 0, 0.7, 0.2);
    // The cargo box, then the cab in front of it.
    box(c, { x: -0.3, y: 0, z: 5, w: 1.8, d: VAN_D, h: 40, color: '#F4F1E8', rim: true });
    box(c, { x: 0.9, y: 0, z: 5, w: 0.6, d: VAN_D, h: 28, color, rim: true });
    onFaceY(c, VAN_D / 2, -1.2, () => {
      // The company's stripe and a leaf on the box, the cab's door and window, the wheels.
      rectIn(c, 0, 14, 1.8, 7, color);
      rectIn(c, 0, 22, 1.8, 2, darken(color, 0.25));
      rectIn(c, 1.82, 16, 0.5, 12, GLASS);
      rectIn(c, 1.86, 24, 0.42, 3, lighten(GLASS, 0.35), 0.7);
      rectIn(c, 1.84, 6, 0.02, 22, darken(color, 0.3));
      wheel(c, 0.4);
      wheel(c, 1.95);
    });
    // The front: windshield and headlights.
    onFaceX(c, VAN_W / 2, VAN_D / 2, () => {
      rectIn(c, 0.08, 17, VAN_D - 0.16, 11, GLASS);
      rectIn(c, 0.1, 7, 0.2, 3.5, '#FFF3B0');
      rectIn(c, VAN_D - 0.3, 7, 0.2, 3.5, '#FFF3B0');
    });
    // A leaf on the box's side (fresh produce).
    const [lx, ly] = P(-0.3, VAN_D / 2, 33);
    c.drawPath(path.smooth([[lx - 7, ly + 3], [lx - 5, ly - 3], [lx + 1, ly - 6], [lx + 7, ly - 6], [lx + 5, ly], [lx - 1, ly + 3]], true, 0.8), fill(urgent ? '#FFFFFF' : '#43B04A'));
    c.drawPath(path.polyline([[lx - 7, ly + 3], [lx + 4, ly - 4]]), stroke(urgent ? color : '#D8F5C8', 0.9));
    if (urgent) {
      // A light bar on the cab's roof.
      box(c, { x: 0.9, y: 0, z: 33, w: 0.32, d: 0.5, h: 4, color: '#3A3A44' });
      const [bx, by] = P(0.9, -0.12, 38);
      c.drawCircle(bx, by, 3, fill('#FF4A3D'));
      const [bx2, by2] = P(0.9, 0.12, 38);
      c.drawCircle(bx2, by2, 3, fill('#4AA8FF'));
    }
  });
}

/** A crate of the storeroom: vegetables in a green crate, meat and fish in a cooler, the pantry's sacks. */
const crateVeg = sprite([-14, -24, 14, 6], (c) => {
  floorShadow(c, 0, 0, 0.32, 0.25);
  box(c, { x: 0, y: 0, w: 0.5, d: 0.4, h: 12, color: '#3E9B4F', rim: true });
  for (const [dx, dy, col] of [[-6, -15, '#F28C28'], [0, -17, '#E5372B'], [6, -15, '#7BC74D'], [-2, -13, '#F2D16B'], [4, -13, '#E5372B']] as const) c.drawCircle(dx, dy, 3.2, fill(col));
  c.drawPath(path.smooth([[-3, -18], [-1, -23], [2, -22], [0, -18]], true, 0.8), fill('#43B04A'));
});
const crateProtein = sprite([-14, -24, 14, 6], (c) => {
  floorShadow(c, 0, 0, 0.32, 0.25);
  box(c, { x: 0, y: 0, w: 0.5, d: 0.4, h: 13, color: '#F4F6FA', rim: true });
  box(c, { x: 0, y: 0, z: 13, w: 0.52, d: 0.42, h: 3, color: '#3E7BC8', rim: true });
  onFaceY(c, 0.2, -0.25, () => rectIn(c, 0.06, 4, 0.38, 3, '#E5483B'));
  const [hx, hy] = P(0, 0, 17);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(hx - 5, hy - 3, 10, 3), 1.5, 1.5), fill('#2A5A9A'));
});
const cratePantry = sprite([-14, -26, 14, 6], (c) => {
  floorShadow(c, 0, 0, 0.32, 0.25);
  for (const [dx, h, col] of [[-4, 18, '#D9B98A'], [5, 15, '#E8D2A6']] as const) {
    const sack = path.smooth([[dx - 6, 0], [dx - 7, -h * 0.6], [dx - 4, -h], [dx + 4, -h], [dx + 7, -h * 0.6], [dx + 6, 0]], true, 0.7);
    c.drawPath(sack, fill(col));
    c.drawPath(sack, stroke(darken(col, 0.35), 1));
    c.drawPath(path.polyline([[dx - 4, -h + 1], [dx + 4, -h + 1]]), stroke(darken(col, 0.45), 1.4));
  }
  c.drawCircle(-4, -8, 2.2, fill('#C8814A', 0.6));
});

const ICON = [-20, -24, 20, 14] as const;

/** The storeroom upgrade: steel shelves with the three crates. */
const storeroomIcon = sprite(ICON, (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-18, -22, 36, 34), 3, 3), fill('#C9D2DE'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-18, -22, 36, 34), 3, 3), stroke('#4A5462', 1.4));
  for (const y of [-6, 9]) c.drawRect(Skia.XYWHRect(-17, y, 34, 2.4), fill('#8A94A2'));
  const crate = (x: number, y: number, col: string, top: string) => {
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - 6, y - 9, 12, 9), 1.5, 1.5), fill(col));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - 6, y - 9, 12, 9), 1.5, 1.5), stroke(darken(col, 0.4), 0.9));
    c.drawCircle(x - 2, y - 10, 2.4, fill(top));
    c.drawCircle(x + 2.5, y - 10.5, 2.2, fill(lighten(top, 0.15)));
  };
  crate(-9, -6, '#3E9B4F', '#F28C28');
  crate(5, -6, '#F4F6FA', '#E5483B');
  crate(-3, 9, '#D9B98A', '#E8D2A6');
  crate(10, 9, '#3E9B4F', '#7BC74D');
});

/** The supply contract: a small van with a signed paper. */
const vanIcon = sprite(ICON, (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-18, -12, 24, 18), 2.5, 2.5), fill('#F4F1E8'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-18, -12, 24, 18), 2.5, 2.5), stroke('#4A5462', 1.3));
  c.drawRect(Skia.XYWHRect(-18, -2, 24, 5), fill('#3E9B4F'));
  c.drawPath(path.poly([[6, -6], [13, -6], [18, 0], [18, 6], [6, 6]]), fill('#3E9B4F'));
  c.drawPath(path.poly([[6, -6], [13, -6], [18, 0], [18, 6], [6, 6]]), stroke('#1E5A22', 1.2));
  c.drawPath(path.poly([[8, -4], [12.5, -4], [16, 0], [8, 0]]), fill(GLASS));
  for (const x of [-11, 11]) {
    c.drawCircle(x, 7, 4, fill('#24212B'));
    c.drawCircle(x, 7, 1.8, fill('#B9BEC8'));
  }
  // The contract, signed.
  c.save();
  c.rotate(-12, -8, -16);
  c.drawRect(Skia.XYWHRect(-16, -24, 13, 15), fill('#FFFFFF'));
  c.drawRect(Skia.XYWHRect(-16, -24, 13, 15), stroke('#8A94A2', 0.8));
  for (const y of [-21, -18, -15]) c.drawPath(path.polyline([[-14, y], [-5, y]]), stroke('#B9BEC8', 0.8));
  c.drawPath(path.smooth([[-14, -11.5], [-11, -13], [-9, -11], [-6, -12.5]], false), stroke('#2A6FD6', 1));
  c.restore();
});

export const supplySprites = { van: van('#3E9B4F', false), vanUrgent: van('#D8352B', true), crateVeg, crateProtein, cratePantry, storeroomIcon, vanIcon };

/** The crates by ingredient (src/data/supply.ts INGREDIENTS order). */
export const CRATES = ['crateVeg', 'crateProtein', 'cratePantry'] as const;
