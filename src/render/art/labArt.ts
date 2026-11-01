import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { fill, path, stroke } from './kit';

// The recipe lab (src/data/lab.ts): its button, a test flask bubbling over a little pan, with a
// sparkle for the new idea.

const ICON = [-20, -24, 20, 16] as const;

const labIcon = sprite(ICON, (c) => {
  // The pan with its handle.
  c.drawPath(path.smooth([[-17, 4], [-15, 13], [3, 13], [5, 4]], true, 0.4), fill('#3A3A46'));
  c.drawPath(path.smooth([[-17, 4], [-15, 13], [3, 13], [5, 4]], true, 0.4), stroke('#14141C', 1.3));
  c.drawOval(Skia.XYWHRect(-17, 1.5, 22, 5), fill('#E8B04A'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(4, 5.5, 13, 3.4), 1.7, 1.7), fill('#5A3A2A'));
  // The flask: a round body, a neck, the green brew.
  const flask = path.smooth([[6, -21], [12, -21], [12, -13], [18, -3], [16, 4], [2, 4], [0, -3], [6, -13]], true, 0.35);
  c.drawPath(flask, fill('#DDF3FF', 0.9));
  c.drawPath(path.smooth([[1.2, -4], [16.8, -4], [16, 3.6], [2, 3.6]], true, 0.4), fill('#5CC25A'));
  c.drawPath(flask, stroke('#2E4A6A', 1.4));
  c.drawRect(Skia.XYWHRect(5, -23, 8, 2.6), fill('#B8862A'));
  for (const [x, y, r] of [[7, -8, 1.6], [11, -11, 1.1], [9, -15, 0.9]] as const) c.drawCircle(x, y, r, fill('#FFFFFF', 0.85));
  c.drawCircle(6, -1, 1.3, fill('#E8FFE0', 0.9));
  // A sparkle.
  c.drawPath(path.poly([[-11, -20], [-9.5, -16.5], [-6, -15], [-9.5, -13.5], [-11, -10], [-12.5, -13.5], [-16, -15], [-12.5, -16.5]]), fill('#FFC93C'));
  c.drawPath(path.poly([[-11, -20], [-9.5, -16.5], [-6, -15], [-9.5, -13.5], [-11, -10], [-12.5, -13.5], [-16, -15], [-12.5, -16.5]]), stroke('#8A5A10', 0.8));
});

export const labSprites = { labIcon };
