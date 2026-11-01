import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { lighten } from './color';
import { box, floorShadow, onFaceX, onFaceY, rectIn } from './iso3d';
import { fill, path } from './kit';

// Celebrities (src/data/celebs.ts): the stretch limo at the curb (black, long, tinted windows,
// a silver line) and the cameras' flash (a white starburst the renderer pops around the star).

const W = 3.2;
const D = 1.05;
const GLASS = '#1A2233';

const limo = sprite([-82, -66, 82, 34], (c) => {
  for (const x of [-1.2, -0.4, 0.4, 1.2]) floorShadow(c, x, 0, 0.7, 0.22);
  box(c, { x: 0, y: 0, z: 5, w: W, d: D, h: 18, color: '#1E1E26', rim: true });
  box(c, { x: -0.2, y: 0, z: 23, w: 2.4, d: D * 0.92, h: 11, color: '#26262F', rim: true });
  onFaceY(c, D / 2, -W / 2, () => {
    for (let i = 0; i < 4; i++) rectIn(c, 0.55 + i * 0.52, 24, 0.44, 9, GLASS);
    rectIn(c, 0.55, 30.5, 2.1, 1.4, lighten(GLASS, 0.3), 0.6);
    rectIn(c, 0.1, 15, W - 0.2, 1.2, '#C9D3E0');
    for (const a of [0.55, W - 0.55]) {
      c.drawOval(Skia.XYWHRect(a - 0.2, -1, 0.4, 12), fill('#0E0E12'));
      c.drawOval(Skia.XYWHRect(a - 0.1, 2.2, 0.2, 6), fill('#C9D3E0'));
    }
  });
  onFaceX(c, W / 2, D / 2, () => {
    rectIn(c, 0.12, 7, 0.2, 3.5, '#FFF3B0');
    rectIn(c, D - 0.32, 7, 0.2, 3.5, '#FFF3B0');
    rectIn(c, 0.3, 9, D - 0.6, 3, '#C9D3E0');
  });
});

/** A camera's flash: a white starburst. */
const flash = sprite([-12, -12, 12, 12], (c) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 === 0 ? 11 : 3.5;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  c.drawPath(path.poly(pts), fill('#FFFFFF', 0.95));
  c.drawCircle(0, 0, 4, fill('#FFFDE8'));
});

export const celebSprites = { limo, cameraFlash: flash };
