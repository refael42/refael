import { Skia } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { box, cylinder, floorShadow, onFaceX, onFaceY, P, rectIn } from './iso3d';
import { fill } from './kit';

// Deliveries (src/data/delivery.ts): the takeaway bag and the couriers' scooters.

const PAPER = '#C99A5B';
const BRAND = '#E5483B';

/** A paper takeaway bag with a folded top and the red burger logo (in hand, and on the pass). */
const bag = sprite([-10, -22, 10, 4], (c) => {
  box(c, { x: 0, y: 0, w: 0.16, d: 0.11, h: 13, color: PAPER, rim: true });
  box(c, { x: 0, y: 0, z: 13, w: 0.16, d: 0.04, h: 3, color: '#B58646' });
  onFaceY(c, 0.055, -0.08, () => {
    rectIn(c, 0.04, 5, 0.08, 4.5, BRAND);
    rectIn(c, 0.055, 6.2, 0.05, 1.6, '#F2C14E');
  });
});

/** Scooter colors per parking spot (the courier's slot). */
export const SCOOTER_COLORS = ['#E5483B', '#3E7BC8', '#35B957', '#F2A62C', '#9B59D0', '#E2649B', '#1FA3A0', '#F5F5F0'] as const;

/** A delivery scooter along x (front at -x, the way it rides off), its box on the back; `rider` sits on it. */
function scooter(color: string, rider: boolean) {
  return sprite([-36, -64, 36, 14], (c) => {
    floorShadow(c, 0, 0, 0.42, 0.26);
    // Wheels: dark discs on the side facing the camera.
    onFaceY(c, 0.13, -0.5, () => {
      for (const a of [0.12, 0.88]) {
        c.drawOval(Skia.XYWHRect(a - 0.1, -1, 0.2, 9), fill('#22202A'));
        c.drawOval(Skia.XYWHRect(a - 0.045, 2, 0.09, 3.5), fill('#B9BEC8'));
      }
    });
    // Footboard, body, the front shield and handlebars, the seat.
    box(c, { x: 0, y: 0, z: 3, w: 0.62, d: 0.2, h: 3, color: '#3A3A44' });
    box(c, { x: 0.18, y: 0, z: 4, w: 0.34, d: 0.24, h: 10, color, rim: true });
    box(c, { x: -0.3, y: 0, z: 3, w: 0.08, d: 0.22, h: 16, color, rim: true });
    box(c, { x: -0.3, y: 0, z: 19, w: 0.05, d: 0.36, h: 1.6, color: '#2A2830' });
    box(c, { x: 0.16, y: 0, z: 14, w: 0.28, d: 0.18, h: 2.5, color: '#2A2830' });
    cylinder(c, -0.34, 0, 0.035, 12, 2, '#FFF3B0');
    // The delivery box on the back, in the restaurant's red with the logo.
    box(c, { x: 0.36, y: 0, z: 14, w: 0.26, d: 0.28, h: 12, color: BRAND, rim: true });
    onFaceX(c, 0.49, 0.14, () => rectIn(c, 0.07, 18, 0.14, 4, '#F2C14E'));
    if (!rider) return;
    // The courier on board: red jacket, jeans, a helmet with a visor.
    box(c, { x: 0.02, y: 0, z: 16.5, w: 0.2, d: 0.22, h: 4, color: '#2F4E8A' });
    box(c, { x: -0.12, y: 0, z: 7, w: 0.08, d: 0.2, h: 10, color: '#2F4E8A' });
    box(c, { x: 0.04, y: 0, z: 20, w: 0.17, d: 0.24, h: 14, color: '#EA5A4C', rim: true });
    box(c, { x: -0.13, y: 0, z: 27, w: 0.2, d: 0.08, h: 3, color: '#EA5A4C' });
    box(c, { x: 0.03, y: 0, z: 34, w: 0.15, d: 0.16, h: 8, color: '#E8B48A' });
    const [hx, hy] = P(0.03, 0, 44);
    c.drawOval(Skia.XYWHRect(hx - 6.5, hy - 5, 13, 10), fill('#E5483B'));
    c.drawOval(Skia.XYWHRect(hx - 6.5, hy - 1, 7, 4), fill('#2D4F86'));
    c.drawOval(Skia.XYWHRect(hx - 4, hy - 4.5, 5, 2.4), fill('#FFFFFF', 0.45));
  });
}

const scooters = Object.fromEntries(SCOOTER_COLORS.flatMap((color, i) => [[`scooter${i}`, scooter(color, false)], [`scooterRide${i}`, scooter(color, true)]]));

export const deliverySprites = { bag, ...scooters };
