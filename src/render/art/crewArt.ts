import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { box, cylinder, floorShadow, onFaceX, onFaceY, P, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';
import { looks } from './stationArt';

// The kitchen's newer jobs (src/data/staff.ts): the packing counter with its takeaway window,
// where the packers work and the couriers take the bags from outside, the checker's green tick
// on a dish they passed, and the packer's icon for the staff screen.

const PAPER = '#C99A5B';
const BRAND = '#E5483B';
const WOOD = '#6A4A2A';

/** The packing station's looks by its upgrade milestones: the awning, the counter, the trim. */
const STATION = [
  { awning: BRAND, counter: '#AEB8C4', frame: WOOD, sign: false, gold: false },
  { awning: '#3E7BC8', counter: '#C4CDD8', frame: '#3A3A44', sign: false, gold: false },
  { awning: '#35B957', counter: '#D8DEE5', frame: '#2A2830', sign: true, gold: false },
  { awning: '#26232E', counter: '#2E2836', frame: '#E2B13C', sign: true, gold: true },
] as const;

/**
 * A steel packing counter in the kitchen's front row, flat boxes and tape on it, the tablet the
 * online orders come in on; at its front edge the takeaway window: a frame in the front wall,
 * a striped awning over the street side and the sill the packed bags wait on. Upgrading it
 * (owner: "the delivery station can be upgraded") changes the awning, then adds a neon
 * TAKEAWAY sign, then goes black and gold.
 */
const packTables = looks('packTable', [-42, -96, 42, 28], (c, t) => {
  const s = STATION[t]!;
  const stripe = s.gold ? '#E2B13C' : '#FFF4E3';
  floorShadow(c, 0, 0.05, 0.55, 0.3);
  box(c, { x: 0, y: -0.04, w: 0.9, d: 0.8, h: 18, color: s.counter, rim: true });
  if (s.gold) box(c, { x: 0, y: -0.04, z: 16, w: 0.92, d: 0.82, h: 1.4, color: '#E2B13C' });
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
  for (const x of [-0.46, 0.46]) box(c, { x, y: 0.47, w: 0.06, d: 0.06, h: 54, color: s.frame, rim: true });
  box(c, { x: 0, y: 0.47, z: 52, w: 0.98, d: 0.08, h: 5, color: s.frame, rim: true });
  onFaceY(c, 0.51, -0.3, () => {
    rectIn(c, 0, 53, 0.6, 3.6, stripe);
    rectIn(c, 0.27, 53.6, 0.06, 2.4, s.awning);
  });
  // The striped awning, sloping out over the street side.
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = -0.49 + (i * 0.98) / n;
    const b = a + 0.98 / n;
    c.drawPath(path.poly([P(a, 0.44, 64), P(b, 0.44, 64), P(b, 0.86, 50), P(a, 0.86, 50)]), fill(i % 2 ? stripe : s.awning));
  }
  c.drawPath(path.polyline([P(-0.49, 0.86, 50), P(0.49, 0.86, 50)]), stroke(s.gold ? '#E2B13C' : '#2A1530', 1.2));
  // The sill the bags wait on.
  box(c, { x: 0, y: 0.5, z: 17, w: 0.96, d: 0.2, h: 2.4, color: s.gold ? '#E2B13C' : '#B07A4A', rim: true });
  if (s.sign) {
    // A neon TAKEAWAY board on top of the frame: a glowing bag and arrow.
    box(c, { x: 0, y: 0.47, z: 66, w: 0.7, d: 0.06, h: 14, color: '#1E1A24', rim: true });
    onFaceY(c, 0.51, -0.32, () => {
      // Tubes as thin bars (this face is stretched: strokes would smear): a bag and an arrow.
      const glow = s.gold ? '#FFE08A' : '#7FF0E8';
      rectIn(c, 0.06, 68.5, 0.14, 1.2, glow);
      rectIn(c, 0.06, 75.3, 0.14, 1.2, glow);
      rectIn(c, 0.06, 68.5, 0.02, 8, glow);
      rectIn(c, 0.18, 68.5, 0.02, 8, glow);
      rectIn(c, 0.3, 72, 0.26, 1.2, glow);
      rectIn(c, 0.5, 70.5, 0.03, 4.2, glow);
    });
  }
});

/**
 * The deliveries' own pass (owner: "their own pass and fridge"): a two-tile steel counter in
 * the kitchen's front row, heat lamps over it and a red DELIVERY board. The cooks put the
 * delivery food here; the packers take it from behind.
 */
const deliveryPass = sprite([-50, -78, 50, 30], (c) => {
  floorShadow(c, 0, 0, 0.9, 0.28);
  box(c, { x: 0, y: 0, w: 1.9, d: 0.8, h: 20, color: '#AEB8C4', rim: true });
  box(c, { x: 0, y: 0, z: 20, w: 1.94, d: 0.84, h: 2, color: '#D8DEE5', rim: true });
  onFaceY(c, 0.4, -0.95, () => {
    rectIn(c, 0.1, 6, 1.7, 6, BRAND);
    for (let i = 0; i < 5; i++) rectIn(c, 0.22 + i * 0.32, 8, 0.14, 2, '#FFF4E3');
  });
  // Heat lamps on two poles.
  for (const x of [-0.6, 0.6]) {
    box(c, { x, y: -0.32, z: 22, w: 0.04, d: 0.04, h: 26, color: '#3A3A44' });
    box(c, { x, y: -0.1, z: 46, w: 0.04, d: 0.44, h: 2, color: '#3A3A44' });
    cylinder(c, x, 0.08, 0.09, 40, 6, '#2A2830', '#E5483B');
    const [lx, ly] = P(x, 0.08, 39);
    c.drawCircle(lx, ly, 3.2, fill('#FFB42A', 0.55));
  }
});

/** The deliveries' drinks fridge: a glass door full of colored cans (open while someone takes one). */
function drinksFridge(open: boolean) {
  return sprite([-24, -74, 30, 16], (c) => {
    floorShadow(c, 0, 0, 0.45, 0.28);
    box(c, { x: 0, y: 0, w: 0.8, d: 0.78, h: 46, color: '#E5483B', rim: true });
    box(c, { x: 0, y: 0, z: 46, w: 0.82, d: 0.8, h: 4, color: '#B5321E', rim: true });
    onFaceY(c, 0.39, -0.36, () => {
      rectIn(c, 0.04, 4, 0.64, 38, '#1E2A3A');
      const cans = ['#35B957', '#F2A62C', '#3E7BC8', '#E2649B'];
      for (let row = 0; row < 4; row++) {
        rectIn(c, 0.06, 6 + row * 9, 0.6, 1.2, '#AEB8C4');
        for (let k = 0; k < 4; k++) rectIn(c, 0.09 + k * 0.145, 7.5 + row * 9, 0.09, 6, cans[(row + k) % cans.length]!);
      }
      if (!open) rectIn(c, 0.04, 4, 0.64, 38, '#BFE3FF', 0.28);
    });
    if (open) {
      // The door swung out toward the room, glass catching the light.
      c.drawPath(path.poly([P(0.4, 0.39, 4), P(0.4, 0.39, 42), P(0.62, 0.95, 42), P(0.62, 0.95, 4)]), fill('#BFE3FF', 0.45));
      c.drawPath(path.polyline([P(0.4, 0.39, 4), P(0.4, 0.39, 42), P(0.62, 0.95, 42), P(0.62, 0.95, 4), P(0.4, 0.39, 4)]), stroke('#E5483B', 1.4));
    }
  });
}

/** A soda can (on the counter and in the box). */
const sodaCan = sprite([-4, -9, 4, 2], (c) => {
  cylinder(c, 0, 0, 0.035, 0, 6, '#E5483B', '#D8DEE5');
  const [x, y] = P(0, 0, 3);
  c.drawRect(Skia.XYWHRect(x - 1.6, y - 0.7, 3.2, 1.3), fill('#FFF4E3'));
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

/** The food box with a cold can on it, on the way from the fridge to the counter. */
const foodDrink = sprite([-11, -22, 11, 4], (c) => {
  box(c, { x: 0, y: 0, w: 0.17, d: 0.13, h: 5, color: '#E9D6A8', rim: true });
  const [fx, fy] = P(0, 0, 5);
  c.drawCircle(fx - 2, fy - 1, 2.6, fill('#C8642A'));
  c.drawCircle(fx - 2, fy - 2, 2.2, fill('#E9A55B'));
  cylinder(c, 0.05, 0.02, 0.035, 5, 6, '#3E7BC8', '#D8DEE5');
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

/** The scooter's delivery box by the scooters' upgrade milestones: insulated, sport, gold (drawn over the base one). */
function scooterBox(t: number) {
  const look = [null, { box: '#3E7BC8', trim: '#FFFFFF' }, { box: '#1E1A24', trim: '#7FF0E8' }, { box: '#E2B13C', trim: '#FFF1C2' }][t]!;
  return sprite([-36, -64, 36, 14], (c) => {
    box(c, { x: 0.36, y: 0, z: 14, w: 0.3, d: 0.32, h: 14, color: look.box, rim: true });
    onFaceX(c, 0.51, 0.16, () => {
      rectIn(c, 0.04, 17, 0.24, 2, look.trim);
      rectIn(c, 0.12, 21, 0.08, 4, look.trim);
    });
    if (t >= 2) box(c, { x: -0.34, y: 0, z: 19, w: 0.04, d: 0.3, h: 7, color: '#BFE3FF', alpha: 0.7 });
  });
}

export const crewSprites = {
  ...packTables,
  checkBadge,
  packBox,
  foodBox,
  foodDrink,
  bagOpen,
  sodaCan,
  deliveryPass,
  drinksFridge: drinksFridge(false),
  drinksFridgeOpen: drinksFridge(true),
  scooterBox1: scooterBox(1),
  scooterBox2: scooterBox(2),
  scooterBox3: scooterBox(3),
};
