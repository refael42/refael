import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { sprite, type SpriteDef } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, onFaceX, onFaceY, P, rectIn } from './iso3d';
import { fill, path, stroke, type Pt } from './kit';

// The host's stand by the door (owner M47: "a stand for the hostess, upgradable, with at least
// five or six designs that change with the upgrade"). One design per milestone of its upgrade
// (src/data/upgrades.ts hostStand): a plain wooden lectern, a bistro podium with brass, a black
// and marble desk, a maître d's panelled stand with a banker's lamp and a velvet rope, cream
// and gold with a velvet front, a modern glass desk lit along its edges, and the palace's own.

const GOLD = '#E2B13C';
const VELVET = '#B8202E';
const MENU = '#C8342A';

/** A few menus stacked on the top, the top one with its gold stripe. */
function menus(c: SkCanvas, z: number, color = MENU) {
  for (let i = 0; i < 3; i++) box(c, { x: 0.03 - i * 0.012, y: 0.01 * i, z: z + i * 1.1, w: 0.26, d: 0.2, h: 1, color: i === 2 ? color : darken(color, 0.15 * (2 - i)) });
  box(c, { x: 0.02, y: 0.012, z: z + 3.4, w: 0.06, d: 0.12, h: 0.3, color: '#F2C14E' });
}

/** The reservations book, open, with a pen. */
function book(c: SkCanvas, z: number) {
  const [bx, by] = P(-0.08, 0.02, z);
  c.drawPath(path.poly([[bx - 9, by], [bx, by - 4], [bx + 9, by], [bx, by + 4]]), fill('#3A2A22'));
  c.drawPath(path.poly([[bx - 8, by - 0.6], [bx - 0.4, by - 4], [bx - 0.4, by + 2.8]]), fill('#FBF6E8'));
  c.drawPath(path.poly([[bx + 8, by - 0.6], [bx + 0.4, by - 4], [bx + 0.4, by + 2.8]]), fill('#F3ECD8'));
  for (const k of [0.3, 0.55, 0.8]) c.drawPath(path.polyline([[bx - 7 * k - 1, by - 0.6 - 2.8 * (1 - k)], [bx - 1.4, by - 3.2 + 2 * k]]), stroke('#B8AE96', 0.5));
  c.drawPath(path.polyline([[bx + 3, by - 1], [bx + 8, by + 1.6]]), stroke('#1E1E26', 1.1));
}

/** A small lamp on an arm (the renderer adds its glow while a host is at work). */
function armLamp(c: SkCanvas, z: number, shade: string) {
  box(c, { x: -0.17, y: -0.12, z, w: 0.025, d: 0.025, h: 9, color: '#B8892A' });
  const [lx, ly] = P(-0.17, -0.12, z + 10);
  c.drawCircle(lx, ly, 3.2, fill(lighten(shade, 0.25), 0.5));
  c.drawCircle(lx, ly, 1.8, fill('#FFF3B0'));
}

/** A brass post with a velvet rope to the stand: the line starts here. */
function stanchion(c: SkCanvas, x: number, y: number, rope: string, post = GOLD) {
  cylinder(c, x, y, 0.08, 0, 2, darken(post, 0.2), post);
  cylinder(c, x, y, 0.025, 2, 24, post, lighten(post, 0.3));
  cylinder(c, x, y, 0.045, 26, 3, post, lighten(post, 0.4));
  const [ax, ay] = P(x, y, 24);
  const [bx, by] = P(0, 0.16, 22);
  c.drawPath(path.smooth([[ax, ay], [(ax + bx) / 2, Math.max(ay, by) + 6], [bx, by]], false, 0.9), stroke(darken(rope, 0.3), 3.2));
  c.drawPath(path.smooth([[ax, ay], [(ax + bx) / 2, Math.max(ay, by) + 6], [bx, by]], false, 0.9), stroke(rope, 2.2));
}

function shadow(c: SkCanvas, w: number) {
  c.drawOval(Skia.XYWHRect(-w, -3, w * 2, 7), fill('#000000', 0.22));
}

function design(c: SkCanvas, k: number) {
  if (k === 0) {
    // The wooden lectern on its post (the first stand, from M45).
    shadow(c, 10);
    box(c, { x: 0, y: 0, w: 0.34, d: 0.34, h: 2, color: '#6B4226' });
    box(c, { x: 0, y: 0, z: 2, w: 0.14, d: 0.14, h: 22, color: '#8E5A3C' });
    box(c, { x: 0, y: 0, z: 24, w: 0.46, d: 0.36, h: 4, color: '#A8703E', rim: true });
    menus(c, 28);
    armLamp(c, 28, '#FFE58A');
  } else if (k === 1) {
    // The bistro podium: a solid stained box, a brass band and a brass foot.
    shadow(c, 13);
    box(c, { x: 0, y: 0, w: 0.5, d: 0.42, h: 3, color: '#B8892A', rim: true });
    box(c, { x: 0, y: 0, z: 3, w: 0.44, d: 0.36, h: 22, color: '#5A3420' });
    onFaceY(c, 0.18, -0.22, () => {
      rectIn(c, 0.05, 6, 0.34, 15, '#6E4428');
      rectIn(c, 0, 17, 0.44, 1.6, GOLD);
    });
    onFaceX(c, 0.22, 0.18, () => rectIn(c, 0, 17, 0.36, 1.6, darken(GOLD, 0.2)));
    box(c, { x: 0, y: 0, z: 25, w: 0.52, d: 0.42, h: 3, color: '#7A4A2C', rim: true });
    menus(c, 28);
    armLamp(c, 28, '#FFE58A');
  } else if (k === 2) {
    // Black lacquer and marble: a slim desk, a gold edge, the reservations book.
    shadow(c, 14);
    box(c, { x: 0, y: 0, w: 0.48, d: 0.4, h: 25, color: '#23202A' });
    onFaceY(c, 0.2, -0.24, () => {
      rectIn(c, 0.04, 3, 0.4, 0.8, GOLD);
      rectIn(c, 0.04, 21, 0.4, 0.8, GOLD);
    });
    box(c, { x: 0, y: 0, z: 25, w: 0.56, d: 0.46, h: 3, color: '#ECEAE6', rim: true });
    const [mx, my] = P(0.05, 0, 28);
    c.drawPath(path.polyline([[mx - 10, my + 1], [mx - 3, my - 1.5], [mx + 6, my + 1.5]]), stroke('#B8B2AC', 0.7));
    line(c, P(-0.28, 0.23, 25), P(0.28, 0.23, 25), GOLD, 1.2);
    book(c, 28);
    armLamp(c, 28, '#FFE8B0');
  } else if (k === 3) {
    // The maître d's stand: carved mahogany panels, a green banker's lamp, a bell, a velvet rope.
    shadow(c, 18);
    stanchion(c, 0.55, 0.32, VELVET);
    box(c, { x: 0, y: 0, w: 0.56, d: 0.44, h: 3, color: '#3E1A12', rim: true });
    box(c, { x: 0, y: 0, z: 3, w: 0.5, d: 0.4, h: 24, color: '#6A2A1C' });
    onFaceY(c, 0.2, -0.25, () => {
      rectIn(c, 0.05, 5, 0.18, 17, '#7E3624');
      rectIn(c, 0.27, 5, 0.18, 17, '#7E3624');
      rectIn(c, 0.07, 7, 0.14, 13, '#5A2216');
      rectIn(c, 0.29, 7, 0.14, 13, '#5A2216');
    });
    box(c, { x: 0, y: 0, z: 27, w: 0.58, d: 0.48, h: 3, color: '#4E1E14', rim: true });
    book(c, 30);
    // The banker's lamp: a brass stem, the green glass shade.
    box(c, { x: -0.18, y: -0.12, z: 30, w: 0.03, d: 0.03, h: 8, color: GOLD });
    const [gx, gy] = P(-0.18, -0.12, 38);
    c.drawPath(path.poly([[gx - 6, gy + 1], [gx - 4, gy - 3], [gx + 4, gy - 3], [gx + 6, gy + 1]]), fill('#1E7A4A'));
    c.drawPath(path.poly([[gx - 6, gy + 1], [gx + 6, gy + 1], [gx + 5, gy + 2.2], [gx - 5, gy + 2.2]]), fill('#FFF1B8'));
    cylinder(c, 0.2, -0.1, 0.05, 30, 2, GOLD, '#FFE08A');
  } else if (k === 4) {
    // Cream lacquer with gold, a red velvet front with the house star, a crystal lamp, two ropes.
    shadow(c, 22);
    stanchion(c, 0.6, 0.34, VELVET);
    stanchion(c, -0.5, 0.42, VELVET);
    box(c, { x: 0, y: 0, w: 0.6, d: 0.46, h: 3, color: GOLD, rim: true });
    box(c, { x: 0, y: 0, z: 3, w: 0.54, d: 0.42, h: 25, color: '#F2E8D4' });
    onFaceY(c, 0.21, -0.27, () => {
      rectIn(c, 0.06, 5, 0.42, 18, darken(GOLD, 0.15));
      rectIn(c, 0.08, 6, 0.38, 16, VELVET);
    });
    onFaceX(c, 0.27, 0.21, () => rectIn(c, 0.06, 5, 0.3, 18, darken('#F2E8D4', 0.12)));
    starOn(c, P(0, 0.22, 15), 4.6, '#FFD23F');
    box(c, { x: 0, y: 0, z: 28, w: 0.62, d: 0.5, h: 3, color: GOLD, rim: true });
    book(c, 31);
    const [cx, cy] = P(-0.2, -0.13, 40);
    box(c, { x: -0.2, y: -0.13, z: 31, w: 0.03, d: 0.03, h: 9, color: GOLD });
    c.drawPath(path.poly([[cx, cy - 5], [cx + 4, cy], [cx, cy + 4], [cx - 4, cy]]), fill('#DDF4FF', 0.9));
    c.drawCircle(cx, cy, 1.6, fill('#FFFFFF'));
  } else if (k === 5) {
    // Modern: a glass front lit along its edges, a dark stone top, the bookings on a tablet, an orchid.
    shadow(c, 20);
    stanchion(c, 0.58, 0.36, '#2A6FD6', '#C9D1D9');
    box(c, { x: 0, y: 0, w: 0.6, d: 0.44, h: 2, color: '#2B2F38' });
    box(c, { x: 0, y: 0, z: 2, w: 0.56, d: 0.4, h: 26, color: '#9FD8F0', alpha: 0.55 });
    for (const [a, b] of [[P(-0.28, 0.2, 2), P(-0.28, 0.2, 28)], [P(0.28, 0.2, 2), P(0.28, 0.2, 28)], [P(0.28, -0.2, 2), P(0.28, -0.2, 28)], [P(-0.28, 0.2, 2), P(0.28, 0.2, 2)]] as const) line(c, a, b, '#5FF0FF', 1.6);
    box(c, { x: 0, y: 0, z: 28, w: 0.62, d: 0.46, h: 3, color: '#2B2F38', rim: true });
    const [tx, ty] = P(-0.05, 0.04, 31);
    c.drawPath(path.poly([[tx - 7, ty], [tx, ty - 3.6], [tx + 7, ty], [tx, ty + 3.6]]), fill('#14161C'));
    c.drawPath(path.poly([[tx - 5.6, ty], [tx, ty - 2.8], [tx + 5.6, ty], [tx, ty + 2.8]]), fill('#3E8BFF'));
    // The orchid in its white pot.
    cylinder(c, 0.2, -0.12, 0.05, 31, 5, '#F4F4F4', '#FFFFFF');
    const [ox, oy] = P(0.2, -0.12, 36);
    line(c, [ox, oy], [ox + 1, oy - 10], '#3E7A3A', 1);
    for (const [dx, dy] of [[1, -10], [3, -8], [-1, -7]] as const) c.drawCircle(ox + dx, oy + dy, 1.8, fill('#E07AD6'));
  } else {
    // The palace's own: a tall gold-trimmed marble stand with the crown, flowers, ropes both sides, a red carpet.
    const [r0, r1, r2, r3] = [P(-0.7, -0.45), P(0.7, -0.45), P(0.7, 0.55), P(-0.7, 0.55)];
    c.drawPath(path.poly([r0, r1, r2, r3]), fill(VELVET, 0.85));
    c.drawPath(path.poly([r0, r1, r2, r3]), stroke(GOLD, 1.2));
    shadow(c, 22);
    stanchion(c, 0.62, 0.38, VELVET);
    stanchion(c, -0.54, 0.44, VELVET);
    box(c, { x: 0, y: 0, w: 0.64, d: 0.5, h: 4, color: GOLD, rim: true });
    box(c, { x: 0, y: 0, z: 4, w: 0.56, d: 0.44, h: 28, color: '#F4F0EA' });
    onFaceY(c, 0.22, -0.28, () => {
      rectIn(c, 0.03, 4, 0.5, 1.4, GOLD);
      rectIn(c, 0.03, 29, 0.5, 1.4, GOLD);
      rectIn(c, 0.08, 8, 0.4, 18, darken(GOLD, 0.05));
      rectIn(c, 0.1, 9, 0.36, 16, '#2A1530');
    });
    onFaceX(c, 0.28, 0.22, () => {
      rectIn(c, 0.03, 4, 0.38, 1.4, darken(GOLD, 0.2));
      rectIn(c, 0.03, 29, 0.38, 1.4, darken(GOLD, 0.2));
    });
    crownOn(c, P(0, 0.23, 18));
    box(c, { x: 0, y: 0, z: 32, w: 0.66, d: 0.54, h: 3, color: GOLD, rim: true });
    book(c, 35);
    // A low bouquet in a gold bowl, and the crystal lamp.
    cylinder(c, 0.2, -0.14, 0.07, 35, 3, GOLD, '#FFE08A');
    const [fx, fy] = P(0.2, -0.14, 38);
    for (const [dx, dy, col] of [[-3, -1, '#FF5A6E'], [0, -3, '#FFFFFF'], [3, -1, '#FF8FB0'], [-1, 1, '#E2B13C']] as const) c.drawCircle(fx + dx, fy + dy, 2.2, fill(col));
    box(c, { x: -0.2, y: -0.14, z: 35, w: 0.03, d: 0.03, h: 11, color: GOLD });
    const [cx, cy] = P(-0.2, -0.14, 47);
    c.drawPath(path.poly([[cx, cy - 6], [cx + 5, cy], [cx, cy + 5], [cx - 5, cy]]), fill('#E8F8FF', 0.92));
    c.drawCircle(cx, cy, 2, fill('#FFFFFF'));
  }
}

function line(c: SkCanvas, a: Pt, b: Pt, color: string, w: number) {
  c.drawPath(path.polyline([a, b]), stroke(color, w));
}

function starOn(c: SkCanvas, [cx, cy]: Pt, r: number, color: string) {
  const pts: Pt[] = Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  c.drawPath(path.poly(pts), fill(color));
}

function crownOn(c: SkCanvas, [cx, cy]: Pt) {
  c.drawPath(path.poly([[cx - 6, cy + 3], [cx - 6, cy - 2], [cx - 3, cy + 0.5], [cx, cy - 4], [cx + 3, cy + 0.5], [cx + 6, cy - 2], [cx + 6, cy + 3]]), fill('#FFD23F'));
  c.drawPath(path.poly([[cx - 6, cy + 3], [cx + 6, cy + 3], [cx + 6, cy + 4.4], [cx - 6, cy + 4.4]]), fill(darken('#FFD23F', 0.2)));
  for (const x of [-6, 0, 6]) c.drawCircle(cx + x, cy + (x === 0 ? -4.6 : -2.6), 1.1, fill('#FF5A6E'));
}

/** How many designs the stand has (one per milestone tier, the last one from then on). */
export const HOST_STAND_LOOKS = 7;

export const hostSprites = Object.fromEntries(
  Array.from({ length: HOST_STAND_LOOKS }, (_, k) => [`hostStand${k}`, sprite(k >= 3 ? [-44, -60, 44, 18] : [-22, -50, 22, 10], (c) => design(c, k))]),
) as Record<`hostStand${0 | 1 | 2 | 3 | 4 | 5 | 6}`, SpriteDef>;
