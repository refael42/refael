import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { sprite, type SpriteDef } from '../sprite';
import { lighten } from './color';
import { box, cylinder, floorShadow, onFaceX, onFaceY, P, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';
import { GOLD } from './stationArt';

// The delivery hub (owner M30: "a grander delivery station that really grows"), piece by piece
// as the packing station's levels open them (src/data/delivery.ts HUB): two more packing
// counters (the second in black and gold), a wall of thermal bags, the live orders screen; out
// front a lit pylon sign, chargers for the scooters, pickup lockers. The renderer adds what moves
// (src/render/draw/drawHub.ts). The street is the +y side; the packers stand on the -y side.

const BRAND = '#E5483B';
const BAG = '#D8322A';
const KRAFT = '#C99A5B';
const STEEL = '#C9D1D9';

/** A round dot of `r` px on a face plane (its `a` runs in tiles, `b` in px). */
function dot(c: SkCanvas, a: number, b: number, r: number, color: string) {
  c.drawOval(Skia.XYWHRect(a - r / 32, b - r, (r * 2) / 32, r * 2), fill(color));
}

/** An insulated delivery bag: a red cube with a yellow band and a white handle. */
function bag(c: SkCanvas, x: number, y: number, z: number, s = 1, color = BAG) {
  box(c, { x, y, z, w: 0.26 * s, d: 0.3 * s, h: 9 * s, color, rim: true });
  onFaceY(c, y + 0.15 * s, x - 0.13 * s, () => rectIn(c, 0, z + 4 * s, 0.26 * s, 1.6 * s, '#F7D046'));
  onFaceX(c, x + 0.13 * s, 0.15 * s, () => rectIn(c, 0, z + 4 * s, 0.3 * s, 1.6 * s, '#F7D046'));
  box(c, { x, y, z: z + 9 * s, w: 0.05, d: 0.18 * s, h: 2 * s, color: '#F4EEE2' });
}

/** The scooter-and-bag mark of the delivery service, drawn on a face plane around (a, b). */
function mark(c: SkCanvas, a: number, b: number, k: number, color: string) {
  // Wheels, the body, the box on the back.
  dot(c, a - 0.12 * k, b, 2.4 * k, color);
  dot(c, a + 0.12 * k, b, 2.4 * k, color);
  rectIn(c, a - 0.12 * k, b + 1.5 * k, 0.24 * k, 2.2 * k, color);
  rectIn(c, a - 0.16 * k, b + 3.5 * k, 0.1 * k, 4 * k, color);
  rectIn(c, a + 0.08 * k, b + 3.5 * k, 0.04 * k, 4.5 * k, color);
}

// ---------- the packing counters: brand red (level 10), black and gold (level 75) ----------

function counter(c: SkCanvas, gold: boolean) {
  const body = gold ? '#1E1C24' : BRAND;
  const trim = gold ? GOLD : '#F4EEE2';
  floorShadow(c, 0.06, 0, 0.62, 0.3);
  box(c, { x: 0, y: 0, w: 0.9, d: 0.9, h: 3, color: '#3A3D46' });
  box(c, { x: 0, y: 0, z: 3, w: 0.92, d: 0.92, h: 17, color: body, rim: true });
  onFaceY(c, 0.46, -0.46, () => {
    rectIn(c, 0.04, 15.5, 0.84, 1.2, trim);
    mark(c, 0.46, 6, 1.4, trim);
  });
  onFaceX(c, 0.46, 0.46, () => {
    rectIn(c, 0.04, 15.5, 0.84, 1.2, trim);
    for (const a of [0.08, 0.5]) rectIn(c, a, 4.5, 0.36, 9.5, gold ? '#2B2833' : '#C8302A');
  });
  box(c, { x: 0, y: 0, z: 20, w: 0.96, d: 0.96, h: 2.4, color: gold ? '#3A3646' : '#E4E9EE', rim: true });
  const top = 22.4;
  // Flat boxes ready to fold, the tape gun, the receipt printer with its ticket, a bag waiting.
  for (let i = 0; i < 3; i++) box(c, { x: -0.22, y: -0.24, z: top + i * 1.1, w: 0.36, d: 0.34, h: 1.1, color: i % 2 ? KRAFT : lighten(KRAFT, 0.08) });
  box(c, { x: 0.22, y: -0.28, z: top, w: 0.22, d: 0.16, h: 4, color: '#2B2F38', rim: true });
  cylinder(c, 0.24, -0.18, 0.06, top + 3, 1.6, '#C99A5B', '#8A6A3A');
  box(c, { x: -0.2, y: 0.24, z: top, w: 0.24, d: 0.26, h: 4, color: '#F4EEE2', rim: true });
  box(c, { x: -0.06, y: 0.24, z: top + 2.5, w: 0.08, d: 0.14, h: 0.4, color: '#FFFFFF' });
  bag(c, 0.2, 0.18, top, 0.8, gold ? '#2B2833' : BAG);
  if (gold) for (const y of [-0.46, 0.46]) box(c, { x: 0, y, z: 22, w: 0.97, d: 0.03, h: 0.8, color: GOLD });
}

// ---------- the thermal bag wall: a tall rack of insulated bags under a heat lamp ----------

function bagWall(c: SkCanvas) {
  floorShadow(c, 0.04, 0, 0.56, 0.28);
  for (const [x, y] of [[-0.3, -0.44], [0.3, -0.44], [-0.3, 0.44], [0.3, 0.44]] as const) box(c, { x, y, w: 0.04, d: 0.04, h: 58, color: '#5E6878' });
  for (const z of [3, 20, 37, 54]) box(c, { x: 0, y: 0, z, w: 0.64, d: 0.92, h: 1.2, color: STEEL });
  for (const [z, n] of [[4.2, 3], [21.2, 3], [38.2, 2]] as const) {
    for (let i = 0; i < n; i++) bag(c, 0, -0.3 + i * (0.6 / Math.max(1, n - 1)), z, 0.95, i % 2 && z > 30 ? '#F28A12' : BAG);
  }
  // The heat lamp bar on top, warm.
  box(c, { x: 0, y: 0, z: 56, w: 0.2, d: 0.9, h: 3, color: '#2B2F38', rim: true });
  onFaceX(c, 0.1, 0.45, () => rectIn(c, 0.06, 56.4, 0.78, 1.2, '#FFB04A'));
}

// ---------- the live orders screen: a big monitor on a stand (the renderer fills the screen) ----------

/** The screen's face, in the piece's own pixels (the renderer draws the orders on it). */
export const SCREEN = { x: 0.06, z0: 34, z1: 58, y0: -0.42, y1: 0.42 } as const;

function orderScreen(c: SkCanvas) {
  floorShadow(c, 0.04, 0, 0.42, 0.26);
  box(c, { x: 0, y: 0, w: 0.5, d: 0.6, h: 2, color: '#2B2F38' });
  box(c, { x: 0, y: 0, z: 2, w: 0.12, d: 0.12, h: 32, color: '#5E6878' });
  // A small desk with the order tablet and a call bell at hand height.
  box(c, { x: 0.02, y: 0, z: 20, w: 0.44, d: 0.7, h: 2, color: '#E4E9EE', rim: true });
  box(c, { x: 0.06, y: -0.12, z: 22, w: 0.2, d: 0.28, h: 0.8, color: '#1E2026' });
  cylinder(c, 0.06, 0.2, 0.06, 22, 2, GOLD, lighten(GOLD, 0.2));
  // The monitor: a dark frame, the screen facing the room.
  box(c, { x: 0, y: 0, z: SCREEN.z0 - 2, w: 0.1, d: 0.92, h: SCREEN.z1 - SCREEN.z0 + 4, color: '#1A1B20', rim: true });
  onFaceX(c, 0.05, 0.46, () => {
    rectIn(c, 0.03, SCREEN.z0, 0.86, SCREEN.z1 - SCREEN.z0, '#0E1A33');
    rectIn(c, 0.03, SCREEN.z1 - 4, 0.86, 4, BRAND);
    mark(c, 0.12, SCREEN.z1 - 3.2, 0.5, '#FFFFFF');
  });
}

// ---------- out front: the pylon sign, a scooter charger, the pickup lockers ----------

function sign(c: SkCanvas) {
  floorShadow(c, 0, 0, 0.3, 0.3);
  box(c, { x: 0, y: 0, w: 0.4, d: 0.4, h: 4, color: '#3A3D46', rim: true });
  cylinder(c, 0, 0, 0.05, 4, 58, '#8F9AA8', '#C9D1D9');
  // The lightbox: red, the scooter mark in white, a ring of bulbs.
  box(c, { x: 0, y: 0, z: 56, w: 0.16, d: 1.1, h: 26, color: BRAND, rim: true });
  const face = () => {
    rectIn(c, 0.06, 58, 0.98, 22, '#F0574A');
    mark(c, 0.55, 64, 2.2, '#FFFFFF');
    for (let i = 0; i < 9; i++) dot(c, 0.08 + i * 0.118, 80.5, 0.9, '#FFE9A8');
    for (let i = 0; i < 9; i++) dot(c, 0.08 + i * 0.118, 57.5, 0.9, '#FFE9A8');
  };
  onFaceX(c, 0.08, 0.55, face);
  onFaceY(c, 0.55, -0.08, () => rectIn(c, 0, 58, 0.16, 22, '#C8302A'));
  box(c, { x: 0, y: 0, z: 82, w: 0.2, d: 1.14, h: 1.6, color: GOLD });
}

function charger(c: SkCanvas) {
  floorShadow(c, 0, 0, 0.18, 0.3);
  box(c, { x: 0, y: 0, w: 0.22, d: 0.22, h: 2, color: '#5E6878' });
  box(c, { x: 0, y: 0, z: 2, w: 0.14, d: 0.16, h: 22, color: '#F4F6F8', rim: true });
  onFaceY(c, 0.08, -0.07, () => {
    rectIn(c, 0.02, 17, 0.1, 4, '#1E2026');
    rectIn(c, 0.02, 4, 0.1, 1, '#35B957');
  });
  // The cable hanging in a loop to the plug.
  const [ax, ay] = P(0.07, 0.04, 12);
  const [bx, by] = P(0.07, 0.3, 3);
  c.drawPath(path.smooth([[ax, ay], [ax + 3, ay + 6], [bx, by]], false), stroke('#2B2F38', 1.2));
}

function lockers(c: SkCanvas) {
  floorShadow(c, 0, 0, 0.8, 0.26);
  box(c, { x: 0, y: 0, w: 1.6, d: 0.36, h: 2, color: '#2B2F38' });
  box(c, { x: 0, y: 0, z: 2, w: 1.6, d: 0.36, h: 42, color: '#E4E9EE', rim: true });
  onFaceY(c, 0.18, -0.8, () => {
    rectIn(c, 0, 38, 1.6, 6, BRAND);
    mark(c, 0.2, 39.5, 0.7, '#FFFFFF');
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 3; row++) {
        const a = 0.05 + col * 0.39;
        const b = 4 + row * 11.2;
        rectIn(c, a, b, 0.35, 10, row === 1 && col === 2 ? '#2FA7A0' : '#3FB9B1');
        rectIn(c, a + 0.27, b + 4, 0.03, 3, '#1E2026');
      }
    }
  });
  onFaceX(c, 0.8, 0.18, () => rectIn(c, 0, 38, 0.36, 6, '#C8302A'));
}

/** A small gold padlock over a piece still to come. */
const hubLock = sprite([-8, -12, 8, 4], (c) => {
  c.drawPath(path.smooth([[-3.5, -4], [-3.5, -8], [0, -10.5], [3.5, -8], [3.5, -4]], false), stroke('#9A7A2A', 2));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-5, -5, 10, 8), 2, 2), fill(GOLD));
  c.drawCircle(0, -1.5, 1.3, fill('#5A3A10'));
});

/**
 * One order on the screen, a row of the screen's face in a ticket's color: the dish's slot, a
 * name line and a timer bar (the renderer stacks them, src/render/draw/drawHub.ts).
 */
export const SCREEN_ROWS = ['#F7D046', '#5CD66E', '#4FA3F7', '#F28A12'] as const;
const screenRows = Object.fromEntries(
  SCREEN_ROWS.map((col, i) => [
    `hubRow${i}`,
    sprite([-20, -14, 20, 12], (c) =>
      onFaceX(c, SCREEN.x, 0.4, () => {
        rectIn(c, 0.02, 0, 0.12, 3.2, col);
        rectIn(c, 0.18, 1.8, 0.4, 1, '#E4E9EE');
        rectIn(c, 0.18, 0.2, 0.26, 1, lighten(col, 0.2));
        rectIn(c, 0.64, 0.4, 0.14, 2.4, '#1E2A44');
      }),
    ),
  ]),
) as Record<string, SpriteDef>;

/** By piece (src/data/delivery.ts HubPiece order). */
export const HUB_SPRITES = ['hubCounter', 'hubBagWall', 'hubScreen', 'hubGoldCounter', 'hubSign', 'hubCharger', 'hubLockers'] as const;

export const hubSprites = {
  hubCounter: sprite([-40, -60, 40, 18], (c) => counter(c, false)),
  hubBagWall: sprite([-34, -90, 34, 18], bagWall),
  hubScreen: sprite([-36, -92, 36, 14], orderScreen),
  hubGoldCounter: sprite([-40, -60, 40, 18], (c) => counter(c, true)),
  hubSign: sprite([-44, -130, 44, 12], sign),
  hubCharger: sprite([-12, -40, 14, 10], charger),
  hubLockers: sprite([-60, -84, 60, 20], lockers),
  hubLock,
  ...screenRows,
};
