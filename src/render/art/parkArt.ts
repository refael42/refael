import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onFaceX, onFaceY, onTop, P, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';

// Across the street (owner: "make the map bigger past the road, prettier"): the park, the plaza
// and the parked cars. Anchor = center of the footprint, like every prop.

const WOOD = '#A8743F';
const IRON = '#3A3A44';
const STONE = '#CFC6B4';

/** A park bench along x; variant 1 has its back to the camera side (it faces away). */
function bench(away: boolean) {
  return sprite([-34, -36, 34, 14], (c) => {
    floorShadow(c, 0, 0, 0.5, 0.2);
    for (const x of [-0.5, 0.5]) box(c, { x, y: 0, w: 0.06, d: 0.32, h: 8, color: IRON });
    box(c, { x: 0, y: 0, z: 8, w: 1.25, d: 0.34, h: 2, color: WOOD, rim: true });
    const by = away ? 0.15 : -0.15;
    for (const x of [-0.5, 0.5]) box(c, { x, y: by, z: 8, w: 0.06, d: 0.05, h: 10, color: IRON });
    box(c, { x: 0, y: by, z: 13, w: 1.25, d: 0.06, h: 4.5, color: lighten(WOOD, 0.08), rim: true });
  });
}

/** A stone planter full of flowers (two color mixes). */
function planter(mix: number) {
  const colors = mix === 0 ? ['#E5483B', '#FFD23F', '#F38DB3'] : ['#B9A3FF', '#FFFFFF', '#FF8A2A'];
  return sprite([-24, -34, 24, 12], (c) => {
    floorShadow(c, 0, 0, 0.42, 0.22);
    box(c, { x: 0, y: 0, w: 0.75, d: 0.75, h: 9, color: STONE, rim: true });
    box(c, { x: 0, y: 0, z: 9, w: 0.65, d: 0.65, h: 1, color: '#5B3B23' });
    for (let i = 0; i < 9; i++) {
      const fx = -0.24 + (i % 3) * 0.24;
      const fy = -0.24 + Math.floor(i / 3) * 0.24;
      cylinder(c, fx, fy, 0.09, 10, 4 + (i % 2) * 2, '#3E8F44', '#56B25A');
      const [px, py] = P(fx, fy, 16 + (i % 2) * 2);
      c.drawCircle(px, py, 2.6, fill(colors[i % colors.length]!));
      c.drawCircle(px, py, 0.9, fill('#FFF3B0'));
    }
  });
}

/** A parked car along x (front at +x). */
function car(color: string) {
  return sprite([-60, -56, 60, 22], (c) => {
    for (const x of [-0.5, 0.5]) floorShadow(c, x, 0, 0.6, 0.22);
    onFaceY(c, 0.38, -0.8, () => {
      for (const a of [0.35, 1.25]) {
        c.drawOval(Skia.XYWHRect(a - 0.16, -1, 0.32, 11), fill('#1E1C24'));
        c.drawOval(Skia.XYWHRect(a - 0.07, 2.2, 0.14, 5), fill('#B9BEC8'));
      }
    });
    box(c, { x: 0, y: 0, z: 3, w: 1.6, d: 0.76, h: 10, color, rim: true });
    box(c, { x: -0.1, y: 0, z: 13, w: 0.9, d: 0.66, h: 9, color: lighten(color, 0.05), rim: true });
    // Windows on the side and the windscreen.
    onFaceY(c, 0.33, -0.55, () => {
      rectIn(c, 0.06, 14.5, 0.36, 6, '#2D4F86');
      rectIn(c, 0.48, 14.5, 0.36, 6, '#2D4F86');
      rectIn(c, 0.1, 18.5, 0.25, 1.4, '#FFFFFF', 0.35);
    });
    onFaceX(c, 0.35, 0.33, () => rectIn(c, 0.06, 14.5, 0.54, 6.5, '#2D4F86'));
    onFaceX(c, 0.8, 0.38, () => {
      rectIn(c, 0.06, 7, 0.14, 2.5, '#FFF3B0');
      rectIn(c, 0.56, 7, 0.14, 2.5, '#FFF3B0');
      rectIn(c, 0.22, 4.5, 0.32, 2.5, darken(color, 0.35));
    });
  });
}

/** A market stall: a counter with fruit and juice, poles and a striped awning. */
function stall(awning: string) {
  return sprite([-40, -72, 40, 16], (c) => {
    floorShadow(c, 0, 0, 0.7, 0.24);
    box(c, { x: 0, y: 0, w: 1.4, d: 0.6, h: 14, color: '#B7834E', rim: true });
    onFaceY(c, 0.3, -0.7, () => rectIn(c, 0.1, 3, 1.2, 8, '#8E5F33'));
    // The goods: oranges, apples, lemons.
    const goods = ['#FF8A2A', '#E5483B', '#FFD23F', '#7BC043'];
    for (let i = 0; i < 8; i++) {
      const [gx, gy] = P(-0.5 + (i % 4) * 0.33, -0.12 + Math.floor(i / 4) * 0.22, 16);
      c.drawCircle(gx, gy, 2.6, fill(goods[i % goods.length]!));
      c.drawCircle(gx - 0.8, gy - 0.8, 0.8, fill('#FFFFFF', 0.5));
    }
    for (const [x, y] of [[-0.66, -0.26], [0.66, -0.26], [-0.66, 0.26], [0.66, 0.26]] as const) box(c, { x, y, z: 14, w: 0.05, d: 0.05, h: 20, color: '#E9E6E0' });
    // The awning, in stripes.
    box(c, { x: 0, y: 0, z: 34, w: 1.6, d: 0.8, h: 2, color: awning });
    onTop(c, 36, () => {
      for (let k = 0; k < 8; k++) if (k % 2 === 0) rectIn(c, -0.8 + k * 0.2, -0.4, 0.2, 0.8, '#FFFFFF');
    });
    onFaceY(c, 0.4, -0.8, () => {
      for (let k = 0; k < 8; k++) rectIn(c, k * 0.2, 30, 0.2, 4, k % 2 === 0 ? '#FFFFFF' : awning);
    });
  });
}

/** The plaza's fountain: a round stone basin, a column and a bowl on top (the water sparkles in the renderer). */
const parkFountain = sprite([-60, -96, 60, 34], (c) => {
  floorShadow(c, 0, 0, 1.5, 0.22);
  cylinder(c, 0, 0, 1.35, 0, 9, STONE, '#E3DACA');
  cylinder(c, 0, 0, 1.18, 7, 1.6, '#4FA9D8', '#6CC3EA');
  // Ripples on the water.
  onTop(c, 8.7, () => {
    for (const r of [0.45, 0.8]) c.drawCircle(0, 0, r, stroke('#BFE8F7', 0.04, 0.8));
  });
  cylinder(c, 0, 0, 0.18, 8, 22, '#D9D0BE');
  cylinder(c, 0, 0, 0.55, 30, 4, STONE, '#E3DACA');
  cylinder(c, 0, 0, 0.45, 33, 1.2, '#4FA9D8', '#6CC3EA');
  cylinder(c, 0, 0, 0.08, 33, 9, '#D9D0BE');
  // Water spilling over the top bowl.
  const [tx, ty] = P(0, 0, 33);
  for (const dx of [-11, -5, 5, 11]) c.drawPath(path.smooth([[tx + dx * 0.9, ty - 1], [tx + dx * 1.1, ty + 5], [tx + dx * 1.2, ty + 16]], false), stroke('#9ED8F0', 1.6, 0.8));
});

/** A playground slide: a ladder up the back, a red slide down the front. */
const slide = sprite([-40, -70, 40, 18], (c) => {
  floorShadow(c, 0, 0, 0.8, 0.2);
  for (const y of [-0.3, 0.3]) box(c, { x: -0.6, y, w: 0.07, d: 0.07, h: 32, color: '#3E7BC8' });
  for (let z = 6; z <= 30; z += 6) box(c, { x: -0.6, y: 0, z, w: 0.04, d: 0.62, h: 1.5, color: '#E9E6E0' });
  box(c, { x: -0.45, y: 0, z: 30, w: 0.3, d: 0.66, h: 2, color: '#F2C14E', rim: true });
  // The slide itself: a ramp from the platform to the ground.
  const ramp = (x0: number, z0: number, x1: number, z1: number, d: number, color: string) => {
    c.drawPath(path.poly([P(x0, -d, z0), P(x0, d, z0), P(x1, d, z1), P(x1, -d, z1)]), fill(color));
    c.drawPath(path.poly([P(x0, d, z0), P(x1, d, z1), P(x1, d, z1 - 3), P(x0, d, z0 - 3)]), fill(darken(color, 0.2)));
  };
  ramp(-0.3, 31, 0.95, 2, 0.24, '#E5483B');
});

const BENCHES = [bench(false), bench(true)];
const PLANTERS = [planter(0), planter(1)];
export const CAR_COLORS = ['#E5483B', '#3E7BC8', '#F5F5F0', '#35B957'] as const;
export const STALL_COLORS = ['#E5483B', '#35B957', '#3E7BC8'] as const;

export const parkSprites = {
  bench0: BENCHES[0]!, bench1: BENCHES[1]!,
  planter0: PLANTERS[0]!, planter1: PLANTERS[1]!,
  ...Object.fromEntries(CAR_COLORS.map((color, i) => [`car${i}`, car(color)])),
  ...Object.fromEntries(STALL_COLORS.map((color, i) => [`stall${i}`, stall(color)])),
  parkFountain, slide,
};
