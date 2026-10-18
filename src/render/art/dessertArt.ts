import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { DESSERTS } from '../../data/desserts';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { box } from './iso3d';
import { fill, path, stroke, type Pt } from './kit';

// The desserts (owner: "a dessert menu that opens, each dessert by the player's level"): each
// is drawn once as a flat picture (the order bubble, the menus, the level card) and once on a
// small plate for the table. Also the menus: open in the hands, the small pink dessert card,
// and the host's menu stand by the door.

const EDGE = '#2A1530';
const ICON = [-9, -9, 9, 9] as const;

function glossy(c: SkCanvas, p: ReturnType<typeof path.smooth>, base: string) {
  c.drawPath(p, stroke(EDGE, 1.3));
  c.drawPath(p, fill(base));
  c.drawPath(p, fill('#FFFFFF', 0.12));
}

function ellipse(x: number, y: number, rx: number, ry: number, n = 14): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * rx, y + Math.sin(a) * ry] as Pt;
  });
}

/** A glass cup (malabi, mousse): its outline and what fills it. */
function cup(c: SkCanvas, top: string, body: string) {
  const glass = path.poly([[-6, -4], [6, -4], [4.5, 6], [-4.5, 6]]);
  c.drawPath(glass, stroke(EDGE, 1.3));
  c.drawPath(glass, fill('#E8F4FF', 0.55));
  c.drawPath(path.poly([[-5.5, -1.5], [5.5, -1.5], [4.4, 5.4], [-4.4, 5.4]]), fill(body));
  c.drawPath(path.smooth(ellipse(0, -2, 5.6, 1.6), true, 1), fill(top));
  c.drawLine(-4.6, -3, -3.6, 4, stroke('#FFFFFF', 0.9, 0.7));
}

const DRAW: Record<string, (c: SkCanvas) => void> = {
  // Malabi: white milk pudding, pink rose syrup, crushed pistachios.
  malabi: (c) => {
    cup(c, '#F58AA8', '#FFF8EE');
    for (const [x, y] of [[-2, -2.4], [1.5, -1.6], [3, -2.6], [-3.4, -1.7]] as const) c.drawCircle(x, y, 0.7, fill('#6FBF4A'));
  },
  // Sufganiya: a round doughnut, powdered sugar, a red jam drop on top.
  sufganiya: (c) => {
    glossy(c, path.smooth(ellipse(0, 1.5, 7, 5.6), true, 1), '#D9893A');
    c.drawPath(path.smooth([[-6, -0.5], [-3, -3.4], [0, -3.8], [3.4, -3.2], [6, -0.6], [3, -1.6], [0, -1.2], [-3, -1.8]], true, 0.8), fill('#FFFDF4'));
    glossy(c, path.smooth(ellipse(0, -3.8, 2.4, 1.6), true, 1), '#D8142A');
  },
  // Baklava: golden diamonds of layered pastry, green pistachio in the middle.
  baklava: (c) => {
    for (const [x, y] of [[-3.5, 1.5], [3.5, 1.5], [0, -2.5]] as const) {
      const d = path.poly([[x, y - 4], [x + 4, y], [x, y + 4], [x - 4, y]]);
      glossy(c, d, '#E3A63E');
      c.drawLine(x - 2.5, y, x + 2.5, y, stroke('#B5761E', 0.6));
      c.drawCircle(x, y - 1.2, 1, fill('#6FBF4A'));
    }
  },
  // Chocolate mousse: dark mousse in a glass, a swirl of cream, a curl of chocolate.
  chocMousse: (c) => {
    cup(c, '#5A2E1C', '#6B3A22');
    glossy(c, path.smooth([[-2.6, -2.4], [0, -5.6], [2.6, -2.4], [0, -1.6]], true, 0.9), '#FFF6EE');
    c.drawPath(path.smooth([[-0.6, -6.4], [1, -7.6], [2.2, -6.2]], false, 1), stroke('#3A1A0E', 1.1));
  },
  // Cheesecake: a cream wedge on a biscuit base, red berry sauce on top.
  cheesecake: (c) => {
    glossy(c, path.poly([[-7, 3], [7, -1], [7, 3.6], [-7, 6.4]]), '#C58A4A');
    glossy(c, path.poly([[-7, -2], [7, -6], [7, -1], [-7, 3]]), '#FFF1CF');
    c.drawPath(path.poly([[-7, -2], [7, -6], [5, -6.4], [-7.4, -2.8]]), fill('#C8102E'));
    for (const [x, y] of [[-2, -4.6], [2.6, -5.6]] as const) c.drawCircle(x, y, 1.1, fill('#A80F2A'));
  },
  // Tiramisu: a square of coffee sponge and cream in layers, cocoa on top.
  tiramisu: (c) => {
    glossy(c, path.rrect(-6.5, -5, 13, 11, 1.4), '#FFF1DE');
    for (const y of [-1.6, 2.4]) c.drawRect(Skia.XYWHRect(-6.5, y, 13, 1.6), fill('#7A4A2A'));
    c.drawRect(Skia.XYWHRect(-6.5, -5, 13, 2), fill('#5A3420'));
    for (const [x, y] of [[-3, -4.2], [0.5, -3.6], [3.5, -4.4]] as const) c.drawCircle(x, y, 0.6, fill('#3A1E10'));
  },
  // Crème brûlée: a white ramekin, a golden burnt sugar top, a crack and a spoon.
  cremeBrulee: (c) => {
    glossy(c, path.poly([[-7, -1], [7, -1], [6, 5.5], [-6, 5.5]]), '#FFFFFF');
    for (let x = -5; x <= 5; x += 2.5) c.drawLine(x, -0.4, x * 0.9, 5, stroke('#D8DEE6', 0.6));
    glossy(c, path.smooth(ellipse(0, -1.4, 7, 2.6), true, 1), '#E0A030');
    c.drawPath(path.polyline([[-2, -2.4], [0, -1], [1.8, -2.2]]), stroke('#8A5410', 0.8));
    c.drawPath(path.polyline([[3, -2.8], [8, -7.6]]), stroke('#B9C2CF', 1.6));
  },
  // Lava cake: a dark round cake, molten chocolate running out, a raspberry and sugar.
  lavaCake: (c) => {
    glossy(c, path.smooth(ellipse(0, 0.5, 6.4, 5.4), true, 1), '#3A1E12');
    glossy(c, path.smooth([[-1.5, 2], [1.5, 2], [4, 5.6], [-3.8, 6.2]], true, 0.8), '#6B3410');
    c.drawPath(path.smooth(ellipse(0, -3.4, 4, 1.2), true, 1), fill('#FFFFFF', 0.85));
    glossy(c, path.smooth(ellipse(0.6, -5.2, 1.7, 1.5), true, 1), '#D8142A');
  },
  // Belgian waffle: a golden grid, a scoop of cream and a strawberry.
  waffle: (c) => {
    glossy(c, path.rrect(-7, -4, 14, 10, 2), '#E8B04A');
    for (let x = -4.5; x <= 4.5; x += 3) c.drawLine(x, -3.5, x, 5.5, stroke('#B57A1E', 0.8));
    for (let y = -1.5; y <= 4; y += 2.8) c.drawLine(-6.5, y, 6.5, y, stroke('#B57A1E', 0.8));
    glossy(c, path.smooth(ellipse(-1, -4.2, 3, 2.2), true, 1), '#FFF8EE');
    glossy(c, path.smooth([[2.4, -5], [5, -6.4], [6.6, -4], [4.4, -2.2]], true, 0.9), '#E5333B');
  },
  // Knafeh: a round tray of orange pastry strands, white cheese showing, pistachios.
  knafeh: (c) => {
    glossy(c, path.smooth(ellipse(0, 1, 7.6, 5.4), true, 1), '#E8742A');
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      c.drawLine(Math.cos(a) * 2, 1 + Math.sin(a) * 1.4, Math.cos(a) * 6.6, 1 + Math.sin(a) * 4.6, stroke('#C4541A', 0.7));
    }
    c.drawPath(path.smooth(ellipse(0, 1, 2.6, 1.6), true, 1), fill('#FFF8EE'));
    for (const [x, y] of [[-3, -1.4], [2.4, -1.8], [0, 3.6], [4, 2.4]] as const) c.drawCircle(x, y, 0.8, fill('#6FBF4A'));
  },
};

const icons = Object.fromEntries(DESSERTS.map((d) => [`dessert_${d.id}`, sprite(ICON, (c) => DRAW[d.id]!(c))]));

/** On the table: a small plate, the dessert on it. */
const plates = Object.fromEntries(
  DESSERTS.map((d) => [
    `dessertPlate_${d.id}`,
    sprite([-11, -17, 11, 4], (c) => {
      c.drawPath(path.smooth(ellipse(0, 0, 8, 3.4), true, 1), stroke('#9AA3AD', 1.1));
      c.drawPath(path.smooth(ellipse(0, 0, 8, 3.4), true, 1), fill('#FFFFFF'));
      c.drawPath(path.smooth(ellipse(0, -0.2, 5.4, 2.2), true, 1), fill('#E8EDF3'));
      c.save();
      c.translate(0, -6);
      c.scale(0.68, 0.68);
      DRAW[d.id]!(c);
      c.restore();
    }),
  ]),
);

/** Carried by a waiter: a small plate with a slice of pink cake. */
const dessertHeld = sprite([-9, -12, 9, 4], (c) => {
  c.drawPath(path.smooth(ellipse(0, 0, 7, 2.8), true, 1), stroke('#9AA3AD', 1));
  c.drawPath(path.smooth(ellipse(0, 0, 7, 2.8), true, 1), fill('#FFFFFF'));
  glossy(c, path.poly([[-4, -1], [4, -3], [4, -6], [-4, -4]]), '#F4A7C0');
  c.drawPath(path.poly([[-4, -4], [4, -6], [4, -7.2], [-4, -5.2]]), fill('#FFF6EE'));
  c.drawCircle(1.5, -7.4, 1.2, fill('#D8142A'));
});

/** A menu open in the guest's hands: two cream pages in a red cover, lines of dishes. */
const menuOpen = sprite([-12, -12, 12, 4], (c) => {
  const left = path.poly([[-10, -9], [0, -7], [0, 2], [-10, 0]]);
  const right = path.poly([[0, -7], [10, -9], [10, 0], [0, 2]]);
  for (const p of [left, right]) {
    c.drawPath(p, stroke('#8A1E1A', 2.2));
    c.drawPath(p, fill('#FFF8EC'));
  }
  for (let i = 0; i < 3; i++) {
    c.drawLine(-8, -6 + i * 2.4, -2, -4.8 + i * 2.4, stroke('#9AA3AD', 0.8));
    c.drawLine(2, -4.8 + i * 2.4, 8, -6 + i * 2.4, stroke('#9AA3AD', 0.8));
  }
  c.drawCircle(-5, -7, 0.9, fill('#E2B13C'));
  c.drawLine(0, -7, 0, 2, stroke('#C9A46A', 0.8));
});

/** The dessert menu: a small pink card with a cake on it. */
const dessertMenu = sprite([-7, -12, 7, 4], (c) => {
  const card = path.rrect(-5, -10, 10, 12, 1.5);
  c.drawPath(card, stroke('#B8487A', 1.6));
  c.drawPath(card, fill('#FFE3EE'));
  c.drawPath(path.poly([[-2.4, -3], [2.4, -4], [2.4, -6], [-2.4, -5]]), fill('#F4A7C0'));
  c.drawCircle(1, -6.6, 0.9, fill('#D8142A'));
  for (const y of [-1, 0.6]) c.drawLine(-3, y, 3, y, stroke('#C98AA6', 0.7));
});

/** The host's stand by the door: a wooden lectern, a stack of red menus, a little brass lamp. */
const menuStand = sprite([-16, -46, 16, 8], (c) => {
  c.drawOval(Skia.XYWHRect(-10, -3, 20, 7), fill('#000000', 0.22));
  box(c, { x: 0, y: 0, w: 0.34, d: 0.34, h: 2, color: '#6B4226' });
  box(c, { x: 0, y: 0, z: 2, w: 0.14, d: 0.14, h: 22, color: '#8E5A3C' });
  box(c, { x: 0, y: 0, z: 24, w: 0.46, d: 0.36, h: 4, color: '#A8703E', rim: true });
  for (let i = 0; i < 3; i++) box(c, { x: 0.02 - i * 0.01, y: 0.01 * i, z: 28 + i * 1.1, w: 0.26, d: 0.2, h: 1, color: i === 2 ? '#C8342A' : darken('#C8342A', 0.15 * (2 - i)) });
  box(c, { x: 0.02, y: 0.012, z: 31.4, w: 0.06, d: 0.12, h: 0.3, color: '#F2C14E' });
  // The lamp on its arm, glowing a little.
  box(c, { x: -0.17, y: -0.12, z: 28, w: 0.025, d: 0.025, h: 9, color: '#B8892A' });
  c.drawCircle(-6.2, -36.5, 3.2, fill(lighten('#FFE58A', 0.2), 0.45));
  c.drawCircle(-6.2, -36.5, 1.8, fill('#FFF3B0'));
});

export const dessertSprites = { ...icons, ...plates, dessertHeld, menuOpen, dessertMenu, menuStand };
