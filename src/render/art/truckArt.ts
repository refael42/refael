import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box, floorShadow, onFaceX, onFaceY, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';

// The food truck (src/data/truck.ts), parked across the road while it is home: a boxy truck in
// the restaurant's red, a serving hatch on its side with a striped awning, a menu board, a
// burger on the roof. The gold one is for a truck upgraded far (level 5 and up). Its side faces
// the restaurant. Anchor = the middle of its footprint.

const W = 2.2;
const D = 1.1;
const GLASS = '#2D4F86';

function wheel(c: Parameters<Parameters<typeof sprite>[1]>[0], a: number) {
  c.drawOval(Skia.XYWHRect(a - 0.2, -1, 0.4, 12), fill('#24212B'));
  c.drawOval(Skia.XYWHRect(a - 0.1, 2.2, 0.2, 6), fill('#B9BEC8'));
}

function truck(body: string, trim: string) {
  return sprite([-62, -96, 62, 34], (c) => {
    for (const x of [-0.7, 0.1, 0.8]) floorShadow(c, x, 0, 0.7, 0.2);
    box(c, { x: -0.2, y: 0, z: 5, w: 1.8, d: D, h: 42, color: body, rim: true });
    box(c, { x: 0.9, y: 0, z: 5, w: 0.5, d: D, h: 28, color: darken(body, 0.08), rim: true });
    // The side toward the camera: the serving hatch with its awning and counter, the cab's door, the wheels.
    onFaceY(c, D / 2, -W / 2, () => {
      rectIn(c, 0.25, 18, 1.3, 16, '#3A2A30');
      rectIn(c, 0.3, 19, 1.2, 14, '#FFE9B8', 0.9);
      // Someone at the hatch: a white hat over the counter.
      rectIn(c, 0.75, 22, 0.25, 6, '#F4F1E8');
      rectIn(c, 0.2, 17, 1.4, 2.2, trim);
      for (let i = 0; i < 6; i++) rectIn(c, 0.2 + i * 0.233, 34, 0.117, 5, i % 2 === 0 ? '#FFFFFF' : trim);
      rectIn(c, 1.9, 16, 0.42, 11, GLASS);
      wheel(c, 0.35);
      wheel(c, 1.85);
    });
    onFaceX(c, W / 2, D / 2, () => {
      rectIn(c, 0.08, 16, D - 0.16, 10, GLASS);
      rectIn(c, 0.1, 7, 0.2, 3.5, '#FFF3B0');
      rectIn(c, D - 0.3, 7, 0.2, 3.5, '#FFF3B0');
    });
    // A burger sign on the roof.
    box(c, { x: -0.2, y: 0, z: 47, w: 0.18, d: 0.18, h: 6, color: '#4A4A54' });
    const [bx, by] = [(-0.2 - 0) * 32, -60];
    c.drawOval(Skia.XYWHRect(bx - 11, by - 7, 22, 8), fill('#E8A21A'));
    c.drawRect(Skia.XYWHRect(bx - 11, by - 1, 22, 3), fill('#5E9C3A'));
    c.drawRect(Skia.XYWHRect(bx - 11, by + 2, 22, 3.5), fill('#7A3A1A'));
    c.drawOval(Skia.XYWHRect(bx - 11, by + 4, 22, 5), fill('#E8A21A'));
    c.drawPath(path.polyline([[bx - 7, by - 4], [bx - 5, by - 5]]), stroke(lighten('#E8A21A', 0.5), 1));
  });
}

/** The food truck's picture for the button and the panel. */
const truckIcon = sprite([-20, -24, 20, 16], (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-18, -14, 26, 20), 3, 3), fill('#D8352B'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-18, -14, 26, 20), 3, 3), stroke('#6A1410', 1.2));
  c.drawRect(Skia.XYWHRect(-15, -9, 18, 8), fill('#FFE9B8'));
  for (let i = 0; i < 6; i++) c.drawRect(Skia.XYWHRect(-16 + i * 3.6, -13, 1.8, 3), fill('#FFFFFF'));
  c.drawPath(path.poly([[8, -8], [14, -8], [18, -2], [18, 6], [8, 6]]), fill('#B82A22'));
  c.drawPath(path.poly([[10, -6], [13.5, -6], [16.5, -1], [10, -1]]), fill(GLASS));
  for (const x of [-11, 11]) {
    c.drawCircle(x, 7, 4, fill('#24212B'));
    c.drawCircle(x, 7, 1.8, fill('#B9BEC8'));
  }
  c.drawOval(Skia.XYWHRect(-12, -23, 14, 6), fill('#E8A21A'));
  c.drawRect(Skia.XYWHRect(-12, -19, 14, 2.4), fill('#7A3A1A'));
});

export const truckSprites = { foodTruck: truck('#D8352B', '#F2C14E'), foodTruckGold: truck('#E2B13C', '#D8352B'), truckIcon };
