import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { fill, path, stroke } from './kit';

// Rewarded ads (src/data/ads.ts): a small TV with a play button, the "free reward" picture.

const ICON = [-20, -24, 20, 16] as const;

const tvIcon = sprite(ICON, (c) => {
  // The antennas, the set, its screen, the play triangle, a sparkle for the reward.
  c.drawPath(path.polyline([[-6, -14], [-11, -22]]), stroke('#4A3A52', 1.8));
  c.drawPath(path.polyline([[4, -14], [10, -22]]), stroke('#4A3A52', 1.8));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-17, -14, 34, 26), 5, 5), fill('#6A2C8F'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-17, -14, 34, 26), 5, 5), stroke('#2E1240', 1.4));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-13, -10, 26, 18), 3, 3), fill('#3E7BC8'));
  c.drawPath(path.poly([[-4, -6], [6, -1], [-4, 4]]), fill('#FFFFFF'));
  for (const x of [-10, 10]) c.drawRect(Skia.XYWHRect(x - 2, 12, 4, 3), fill('#2E1240'));
  c.drawPath(path.poly([[14, -20], [15.5, -17], [19, -16], [15.5, -15], [14, -12], [12.5, -15], [9, -16], [12.5, -17]]), fill('#FFC93C'));
});

export const adSprites = { tvIcon };
