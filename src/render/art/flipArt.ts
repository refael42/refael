import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { fill, path, stroke } from './kit';

// The golden pan (src/data/flip.ts): a frying pan in gold, its handle out to the right, a shine
// on the rim. The renderer bobs it over the stove with sparkles until it is tapped.

const goldPan = sprite([-24, -18, 26, 10], (c) => {
  c.drawPath(path.polyline([[10, -2], [24, -8]]), stroke('#8A5A10', 4));
  c.drawPath(path.polyline([[10, -2], [24, -8]]), stroke('#E5A800', 2.4));
  c.drawOval(Skia.XYWHRect(-16, -9, 30, 15), fill('#B8862A'));
  c.drawOval(Skia.XYWHRect(-14, -8, 26, 11), fill('#F2C14E'));
  c.drawOval(Skia.XYWHRect(-11, -6.5, 20, 8), fill('#FFE27A'));
  c.drawOval(Skia.XYWHRect(-9, -5.5, 7, 3), fill('#FFFFFF', 0.7));
});

export const flipSprites = { goldPan };
