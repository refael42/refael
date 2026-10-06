import { Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';
import { FESTIVAL_THEMES } from '../../data/events';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onFaceX, onFaceY, onTop, P, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';

// The limited-time events in the world (src/data/events.ts): the tourist bus on the road and
// the festival trophies by the door. Anchor = center of the footprint, like every prop.

// ---------- the tourist bus ----------

/** Body size: 4 tiles long (along x, the way the road runs), a little over a tile wide. */
const BUS_W = 4;
const BUS_D = 1.15;
const BODY_Z = 6;
const BODY_H = 44;
const GLASS = '#2D4F86';

/** A wheel on the side facing the camera, at `a` tiles from the back. */
function wheel(c: SkCanvas, a: number) {
  c.drawOval(Skia.XYWHRect(a - 0.23, -1, 0.46, 14), fill('#24212B'));
  c.drawOval(Skia.XYWHRect(a - 0.11, 2.6, 0.22, 7), fill('#B9BEC8'));
}

const bus = sprite([-92, -104, 92, 52], (c) => {
  for (const x of [-1.5, -0.5, 0.5, 1.5]) floorShadow(c, x, 0, 0.85, 0.2);
  box(c, { x: 0, y: 0, z: BODY_Z, w: BUS_W, d: BUS_D, h: BODY_H, color: '#F2B632', rim: true });
  // The long side: a row of windows, the door near the back, two stripes, the wheels.
  onFaceY(c, BUS_D / 2, -BUS_W / 2, () => {
    rectIn(c, 0, 18, BUS_W, 4, '#1FA3A0');
    rectIn(c, 0, 14, BUS_W, 2.2, '#E5483B');
    for (let i = 0; i < 5; i++) {
      const a = 1.35 + i * 0.52;
      rectIn(c, a, 27, 0.44, 15, GLASS);
      rectIn(c, a + 0.04, 36, 0.36, 4, lighten(GLASS, 0.35), 0.7);
    }
    // The door: tourists step off here (src/data/maps.ts busDoor).
    rectIn(c, 0.7, 7, 0.42, 36, darken(GLASS, 0.1));
    rectIn(c, 0.9, 7, 0.02, 36, '#F2B632');
    rectIn(c, 0.74, 32, 0.34, 9, lighten(GLASS, 0.3), 0.6);
    rectIn(c, 0.15, 27, 0.4, 15, GLASS);
    wheel(c, 0.45);
    wheel(c, 3.35);
  });
  // The front (it drives toward +x): a big windshield and headlights.
  onFaceX(c, BUS_W / 2, BUS_D / 2, () => {
    rectIn(c, 0.08, 24, BUS_D - 0.16, 19, GLASS);
    rectIn(c, 0.12, 36, 0.3, 5, lighten(GLASS, 0.4), 0.6);
    rectIn(c, 0.1, 9, 0.22, 4, '#FFF3B0');
    rectIn(c, BUS_D - 0.32, 9, 0.22, 4, '#FFF3B0');
    rectIn(c, 0.4, 8, 0.35, 6, '#3A3A44');
  });
  // On the roof: an air-conditioning box and a luggage rack with two cases.
  box(c, { x: -0.3, y: 0, z: BODY_Z + BODY_H, w: 1.4, d: 0.7, h: 5, color: '#DCD6C4', rim: true });
  onTop(c, BODY_Z + BODY_H + 0.5, () => {
    c.drawRect(Skia.XYWHRect(0.75, -0.42, 1.0, 0.84), stroke('#8A8F9A', 0.05));
  });
  box(c, { x: 1.05, y: -0.1, z: BODY_Z + BODY_H, w: 0.4, d: 0.3, h: 7, color: '#C8463A' });
  box(c, { x: 1.45, y: 0.12, z: BODY_Z + BODY_H, w: 0.32, d: 0.28, h: 6, color: '#3E7BC8' });
  // A little sign by the windshield: a camera, "tourists".
  const [sx, sy] = P(BUS_W / 2 - 0.05, -0.2, BODY_Z + BODY_H + 9);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(sx - 9, sy - 6, 18, 12), 3, 3), fill('#FFFFFF'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(sx - 9, sy - 6, 18, 12), 3, 3), stroke('#2A1530', 1.2));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(sx - 6, sy - 3, 12, 7.5), 1.5, 1.5), fill('#2A1530'));
  c.drawCircle(sx, sy + 0.7, 2.6, fill('#7FD3E8'));
  c.drawRect(Skia.XYWHRect(sx - 3, sy - 4.6, 3.5, 1.8), fill('#2A1530'));
});

// ---------- festival trophies ----------

/** A gold cup on a plum pedestal, with the festival's colors on the band and the jewel. */
function trophy(color: string, accent: string) {
  return sprite([-20, -74, 20, 10], (c) => {
    floorShadow(c, 0, 0, 0.3, 0.3);
    box(c, { x: 0, y: 0, w: 0.46, d: 0.46, h: 16, color: '#5A2A62', rim: true });
    onFaceY(c, 0.23, -0.23, () => rectIn(c, 0.05, 6, 0.36, 4, color));
    onFaceX(c, 0.23, 0.23, () => rectIn(c, 0.05, 6, 0.36, 4, accent));
    cylinder(c, 0, 0, 0.14, 16, 4, '#C9962A', '#E8B940');
    cylinder(c, 0, 0, 0.04, 20, 9, '#D9A631');
    const [cx, cy] = P(0, 0, 29);
    // The cup: a glossy bowl, two handles, the band and a jewel in the festival's colors.
    const bowl = path.smooth([[cx - 10, cy - 20], [cx + 10, cy - 20], [cx + 8, cy - 8], [cx + 3, cy], [cx - 3, cy], [cx - 8, cy - 8]], true, 0.6);
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setShader(Skia.Shader.MakeLinearGradient(vec(cx - 10, 0), vec(cx + 10, 0), [Skia.Color('#FFE58A'), Skia.Color('#F2C14E'), Skia.Color('#B07A12')], [0, 0.4, 1], TileMode.Clamp));
    c.drawPath(bowl, p);
    for (const side of [-1, 1]) c.drawPath(path.smooth([[cx + side * 9, cy - 17], [cx + side * 15, cy - 15], [cx + side * 13, cy - 8], [cx + side * 6, cy - 6]], false), stroke('#C9962A', 2.2));
    c.drawOval(Skia.XYWHRect(cx - 10, cy - 22.5, 20, 5), fill('#7A5410'));
    c.drawRect(Skia.XYWHRect(cx - 8.6, cy - 14, 17.2, 3.4), fill(color));
    c.drawCircle(cx, cy - 7, 2.6, fill(accent));
    c.drawCircle(cx - 0.8, cy - 7.8, 0.9, fill('#FFFFFF', 0.8));
    c.drawPath(path.smooth([[cx - 6, cy - 19], [cx - 4, cy - 10], [cx - 2, cy - 4]], false), stroke('#FFFFFF', 1.4, 0.55));
  });
}

const trophies = Object.fromEntries(FESTIVAL_THEMES.map((theme, i) => [`trophy${i}`, trophy(theme.color, theme.accent)]));

export const eventSprites = { bus, ...trophies };
