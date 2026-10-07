import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onFaceX, P } from './iso3d';
import { fill, path, stroke } from './kit';
import { looks } from './stationArt';

// Decor placed in build mode, four looks each (base, lv 10, 25, 50), in the same chunky
// low-poly style as the stations: shading from box faces, gold for the fancy tiers.

const GOLD = '#E2B13C';

// ---------- flowers: clay pot -> white planter -> gold planter with roses -> marble urn ----------

const PLANTER = [
  { pot: '#C26A3D', rim: '#9A4E2A', bloom: ['#E5483B', '#F2C14E'], leaf: '#3FA65A' },
  { pot: '#EFEAE2', rim: '#C9C2B8', bloom: ['#F06FA0', '#FFFFFF', '#F2C14E'], leaf: '#3FA65A' },
  { pot: GOLD, rim: '#B8892A', bloom: ['#C8202E', '#E5483B', '#FF7A8A'], leaf: '#2E8B47' },
  { pot: '#F4F1EC', rim: GOLD, bloom: ['#B05FE0', '#FFFFFF', '#FF9AD5', '#F2C14E'], leaf: '#2E8B47' },
] as const;

const flowers = looks('flowers', [-26, -64, 26, 12], (c, t) => {
  const s = PLANTER[t]!;
  floorShadow(c, 0, 0, 0.32, 0.25);
  if (t < 3) box(c, { x: 0, y: 0, w: 0.56, d: 0.56, h: 18 + t * 2, color: s.pot, rim: true });
  else {
    cylinder(c, 0, 0, 0.18, 0, 8, '#D8D2C8');
    cylinder(c, 0, 0, 0.3, 8, 16, s.pot, '#5A3A1A');
    cylinder(c, 0, 0, 0.32, 24, 2, GOLD);
  }
  const top = t < 3 ? 18 + t * 2 : 26;
  box(c, { x: 0, y: 0, z: top, w: 0.5, d: 0.5, h: 2, color: '#5A3A1A' });
  // Leaves, then blooms on top: more of them on the fancier planters.
  const n = 5 + t * 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.12 + (i % 3) * 0.06;
    const [x, y] = P(Math.cos(a) * r, Math.sin(a) * r, top + 6 + (i % 4) * 4);
    c.drawCircle(x, y, 4.2, fill(s.leaf));
    c.drawCircle(x - 1, y - 1, 2.2, fill(lighten(s.leaf, 0.2)));
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const r = 0.08 + (i % 2) * 0.1;
    const [x, y] = P(Math.cos(a) * r, Math.sin(a) * r, top + 14 + (i % 3) * 5);
    const col = s.bloom[i % s.bloom.length]!;
    c.drawCircle(x, y, 3.2, fill(col));
    c.drawCircle(x, y, 1.1, fill(darken(col, 0.3)));
  }
});

// ---------- floor lamp: black & cream -> brass & red fringe -> gold tall -> crystal ----------

const LAMP = [
  { pole: '#2A2830', shade: '#F4E6C8', trim: '#C9B78F', h: 60 },
  { pole: '#B88A3A', shade: '#C8202E', trim: GOLD, h: 64 },
  { pole: GOLD, shade: '#2A1530', trim: GOLD, h: 70 },
  { pole: '#E8F4FF', shade: '#FFF6D8', trim: '#9FD8FF', h: 74 },
] as const;

const lamps = looks('floorLamp', [-24, -100, 24, 10], (c, t) => {
  const s = LAMP[t]!;
  floorShadow(c, 0, 0, 0.22, 0.25);
  cylinder(c, 0, 0, 0.16, 0, 3, darken(s.pole, 0.2), s.pole);
  box(c, { x: 0, y: 0, z: 3, w: 0.05, d: 0.05, h: s.h - 14, color: s.pole });
  // The shade: a truncated cone made of two cylinders, the glowing bulb under it.
  cylinder(c, 0, 0, 0.2, s.h - 16, 10, s.shade, lighten(s.shade, 0.15));
  cylinder(c, 0, 0, 0.14, s.h - 6, 4, lighten(s.shade, 0.1), lighten(s.shade, 0.25));
  cylinder(c, 0, 0, 0.21, s.h - 17, 2, s.trim);
  if (t === 1) for (let i = 0; i < 9; i++) {
    const [x, y] = P(Math.cos(i * 0.7) * 0.2, Math.sin(i * 0.7) * 0.2, s.h - 18);
    c.drawRect(Skia.XYWHRect(x - 0.4, y, 0.8, 4), fill(GOLD));
  }
  if (t === 3) {
    // Crystal drops catching the light.
    for (let i = 0; i < 8; i++) {
      const [x, y] = P(Math.cos(i * 0.8) * 0.19, Math.sin(i * 0.8) * 0.19, s.h - 20);
      c.drawPath(path.poly([[x, y], [x + 1.4, y + 2.6], [x, y + 5], [x - 1.4, y + 2.6]]), fill('#CFEFFF'));
    }
  }
  const [bx, by] = P(0, 0, s.h - 18);
  c.drawCircle(bx, by, 3, fill('#FFE9A8'));
});

// ---------- aquarium: wood cabinet -> black & gold -> planted tank -> gold frame with coral ----------

const TANK = [
  { cab: '#8A5A34', frame: '#3A2A1E', water: '#5EC8F0', h: 24 },
  { cab: '#22202A', frame: GOLD, water: '#4FB8EC', h: 26 },
  { cab: '#22202A', frame: GOLD, water: '#3FAEE0', h: 30 },
  { cab: '#F4F1EC', frame: '#FFD54A', water: '#36A4E8', h: 32 },
] as const;

const aquariums = looks('aquarium', [-34, -78, 34, 14], (c, t) => {
  const s = TANK[t]!;
  floorShadow(c, 0, 0, 0.4, 0.25);
  box(c, { x: 0, y: 0, w: 0.86, d: 0.5, h: 18, color: s.cab, rim: true });
  box(c, { x: 0, y: 0, z: 18, w: 0.84, d: 0.48, h: s.h, color: s.water, alpha: 0.82, shade: { top: lighten(s.water, 0.25) } });
  // Sand, plants and (from lv 50) coral inside; the fish swim in front (drawn live).
  box(c, { x: 0, y: 0, z: 18, w: 0.8, d: 0.44, h: 4, color: '#E8D29A' });
  for (let i = 0; i < 2 + t; i++) {
    const x = -0.32 + i * (0.64 / (1 + t));
    box(c, { x, y: -0.12, z: 22, w: 0.04, d: 0.04, h: 8 + (i % 2) * 6 + t * 2, color: i % 2 ? '#2E8B47' : '#3FAE5A' });
  }
  if (t === 3) for (const [x, col] of [[-0.2, '#FF7A6A'], [0.18, '#FF9AD5']] as const) {
    const [cx, cy] = P(x, -0.1, 28);
    c.drawCircle(cx, cy, 4, fill(col));
    c.drawCircle(cx + 3, cy - 2, 3, fill(col));
  }
  box(c, { x: 0, y: 0, z: 18 + s.h, w: 0.88, d: 0.52, h: 3, color: s.frame, rim: true });
  for (const [x, y] of [[-0.42, 0.24], [0.42, 0.24], [0.42, -0.24]] as const) box(c, { x, y, z: 18, w: 0.04, d: 0.04, h: s.h, color: s.frame });
  // Bubbles.
  onFaceX(c, 0.43, 0.24, () => {
    for (let i = 0; i < 4; i++) c.drawCircle(0.12 + i * 0.03, 26 + i * 5, 0.9, stroke('#E8F8FF', 0.4));
  });
});

/** Fish that swim in the tank (drawn on top of the aquarium every frame). */
const fishOrange = sprite([-5, -4, 5, 4], (c) => {
  c.drawOval(Skia.XYWHRect(-3.4, -2, 6, 4), fill('#FF8A2A'));
  c.drawPath(path.poly([[2.2, 0], [4.6, -2.2], [4.6, 2.2]]), fill('#FF6A1A'));
  c.drawCircle(-1.8, -0.4, 0.6, fill('#1A1022'));
});
const fishBlue = sprite([-5, -4, 5, 4], (c) => {
  c.drawOval(Skia.XYWHRect(-3, -1.6, 5.4, 3.2), fill('#FFD54A'));
  c.drawRect(Skia.XYWHRect(-0.6, -1.6, 1.2, 3.2), fill('#2A6AE0'));
  c.drawPath(path.poly([[2, 0], [4.2, -1.8], [4.2, 1.8]]), fill('#2A6AE0'));
  c.drawCircle(-1.6, -0.3, 0.55, fill('#1A1022'));
});

// ---------- statue: stone bust -> marble & bronze -> gold figure -> golden chef ----------

const STATUE = [
  { base: '#B9B4AC', body: '#9A958C', h: 30 },
  { base: '#F4F1EC', body: '#B07A3A', h: 34 },
  { base: '#2A1530', body: GOLD, h: 38 },
  { base: '#F4F1EC', body: '#FFD54A', h: 42 },
] as const;

const statues = looks('statue', [-26, -100, 26, 12], (c, t) => {
  const s = STATUE[t]!;
  floorShadow(c, 0, 0, 0.32, 0.25);
  box(c, { x: 0, y: 0, w: 0.5, d: 0.5, h: 6, color: darken(s.base, 0.1), rim: true });
  box(c, { x: 0, y: 0, z: 6, w: 0.38, d: 0.38, h: 20, color: s.base, rim: true });
  box(c, { x: 0, y: 0, z: 26, w: 0.46, d: 0.46, h: 4, color: t >= 2 ? GOLD : darken(s.base, 0.1), rim: true });
  // The figure: a blocky bust (shoulders, head), with a chef's hat on the top look.
  box(c, { x: 0, y: 0, z: 30, w: 0.3, d: 0.22, h: s.h - 22, color: s.body });
  box(c, { x: 0, y: 0, z: 30 + s.h - 22, w: 0.2, d: 0.2, h: 14, color: lighten(s.body, 0.08) });
  if (t === 3) {
    box(c, { x: 0, y: 0, z: 30 + s.h - 8, w: 0.22, d: 0.22, h: 4, color: '#FFFFFF' });
    cylinder(c, 0, 0, 0.13, 30 + s.h - 4, 8, '#FFFFFF', '#F4F1EC');
  }
  if (t >= 2) {
    const [x, y] = P(0, 0, 40 + s.h);
    c.drawCircle(x + 7, y + 6, 1.4, fill('#FFF6C8'));
    c.drawCircle(x - 6, y + 12, 1.1, fill('#FFF6C8'));
  }
});

// ---------- fountain: stone basin -> white marble -> gold trim -> gold three-tier fountain ----------

const FOUNTAIN = [
  { stone: '#B9B4AC', trim: '#9A958C' },
  { stone: '#F4F1EC', trim: '#C9C2B8' },
  { stone: '#F4F1EC', trim: GOLD },
  { stone: GOLD, trim: '#FFF1C2' },
] as const;

const fountains = looks('fountain', [-40, -92, 40, 16], (c, t) => {
  const f = FOUNTAIN[t]!;
  floorShadow(c, 0, 0, 0.5, 0.25);
  // The basin: a wide low ring with water inside.
  cylinder(c, 0, 0, 0.46, 0, 10, f.stone, f.trim);
  cylinder(c, 0, 0, 0.4, 9, 1, '#3E9BD6', '#5BB8EA');
  // The column and the bowls the water falls from.
  cylinder(c, 0, 0, 0.08, 10, 22, f.stone);
  cylinder(c, 0, 0, 0.24, 30, 4, f.trim, '#5BB8EA');
  if (t >= 2) {
    cylinder(c, 0, 0, 0.05, 34, 12, f.stone);
    cylinder(c, 0, 0, 0.14, 44, 3, f.trim, '#5BB8EA');
  }
  // Water falling from the top bowl into the basin.
  const top = t >= 2 ? 47 : 34;
  const [x, y] = P(0, 0, top);
  for (const dx of [-1, 1]) {
    const r = t >= 2 ? 9 : 14;
    c.drawPath(path.smooth([[x, y - 4], [x + dx * r * 0.6, y - 4], [x + dx * r, y + (top - 10) * 0.5], [x + dx * r * 1.1, y + top - 10]], false), stroke('#BFE6FF', 1.6, 0.85));
  }
  c.drawPath(path.smooth([[x, y], [x, y - 8], [x + 0.6, y - 10]], false), stroke('#E8F7FF', 2, 0.9));
  if (t === 3) c.drawCircle(x, y - 12, 2, fill('#FFF6C8'));
});

// ---------- piano: upright black -> white grand -> black & gold grand -> gold grand ----------

const PIANO = [
  { body: '#1E1A24', trim: '#3A3444' },
  { body: '#F4F1EC', trim: '#C9C2B8' },
  { body: '#1E1A24', trim: GOLD },
  { body: GOLD, trim: '#FFF1C2' },
] as const;

const pianos = looks('piano', [-44, -84, 44, 16], (c, t) => {
  const p = PIANO[t]!;
  floorShadow(c, 0, 0, 0.5, 0.25);
  // Legs, then the body on top of them.
  for (const [x, y] of [[-0.3, -0.25], [0.3, -0.25], [0, 0.3]] as const) box(c, { x, y, w: 0.08, d: 0.08, h: 14, color: p.trim });
  box(c, { x: 0, y: 0, z: 14, w: 0.8, d: 0.7, h: 12, color: p.body, rim: true });
  // Keys along the +y face (toward the camera on the left).
  box(c, { x: 0, y: 0.42, z: 22, w: 0.72, d: 0.16, h: 3, color: '#FAF7F0' });
  for (let k = 0; k < 7; k++) box(c, { x: -0.3 + k * 0.1, y: 0.4, z: 25, w: 0.04, d: 0.08, h: 1.2, color: '#1A1620' });
  // The lid, propped open on the grand pianos.
  if (t === 0) box(c, { x: 0, y: -0.2, z: 26, w: 0.8, d: 0.3, h: 26, color: p.body, rim: true });
  else {
    const hinge = P(-0.4, -0.35, 26);
    const tip = P(0.2, -0.35, 60);
    const back = P(0.4, -0.35, 26);
    c.drawPath(path.poly([hinge, tip, back]), fill(darken(p.body, 0.15)));
    c.drawPath(path.poly([hinge, tip, back]), stroke(p.trim, 1.2));
    c.drawLine(...P(0.1, 0, 26), ...P(0.15, -0.3, 46), stroke(p.trim, 1));
  }
  if (t >= 2) {
    const [x, y] = P(0, 0, 70);
    c.drawCircle(x + 8, y + 10, 1.3, fill('#FFF6C8'));
    c.drawCircle(x - 10, y + 18, 1, fill('#FFF6C8'));
  }
});

// ---------- build mode marks ----------

const diamond = (inset = 0.04) => path.poly([P(-0.5 + inset, -0.5 + inset), P(0.5 - inset, -0.5 + inset), P(0.5 - inset, 0.5 - inset), P(-0.5 + inset, 0.5 - inset)]);
/** A free tile you can build on. */
const tileFree = sprite([-34, -18, 34, 18], (c) => {
  c.drawPath(diamond(), fill('#7CF07A', 0.42));
  c.drawPath(diamond(0.08), stroke('#D8FFD0', 1.6, 0.95));
});
/** The tile you picked (yellow), or one that does not work (red). */
const tilePicked = sprite([-36, -20, 36, 20], (c) => {
  c.drawPath(diamond(), fill('#FFD23F', 0.35));
  c.drawPath(diamond(0.02), stroke('#FFE9A8', 2.4));
});

export const decorSprites = { ...flowers, ...lamps, ...aquariums, ...statues, ...fountains, ...pianos, fishOrange, fishBlue, tileFree, tilePicked };
