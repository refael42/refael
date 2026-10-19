import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken } from './color';
import { box, floorShadow, P } from './iso3d';
import { fill, path, stroke } from './kit';

// A big upgrade in progress (src/data/works.ts): a hammer that swings over the station and the
// timer's dial (the work zone itself is in src/render/art/siteArt.ts).

const YELLOW = '#F6C33A';
const BLACK = '#2A2230';

/** The hammer, drawn upright around its grip (the renderer swings it). */
const workHammer = sprite([-12, -26, 12, 4], (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-1.8, -20, 3.6, 22), 1.6, 1.6), fill('#B07A4A'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-1.8, -20, 3.6, 22), 1.6, 1.6), stroke('#5A3A20', 1));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-9, -25, 18, 7), 2, 2), fill('#8F98A8'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-9, -25, 18, 7), 2, 2), stroke('#3A4050', 1.2));
  c.drawRect(Skia.XYWHRect(-8, -24, 16, 1.6), fill('#D8E0EC'));
});

/** Round dial behind the timer: makes the countdown readable over any floor. */
const workDial = sprite([-26, -11, 26, 11], (c) => {
  const p = Skia.Path.RRect(Skia.RRectXY(Skia.XYWHRect(-24, -9, 48, 18), 9, 9));
  c.drawPath(p, fill('#2A1530', 0.92));
  c.drawPath(p, stroke(YELLOW, 1.6));
});

export const workSprites = { workHammer, workDial };
