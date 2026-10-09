import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { darken, lighten } from './color';
import { P } from './iso3d';
import { fill, path, stroke, type Pt } from './kit';
import { looks, plateBase } from './stationArt';

// The dishes the bigger buildings open (owner request: "more dishes that open up"): pizza,
// sushi, steak, cake and lobster. Like the street food, each has a plated look per recipe
// milestone (a board from the third, gold from the fourth, more garnish along the way) and an
// icon for the order bubbles and tickets.

const GOLD = '#E2B13C';
const EDGE = '#2A1530';

function blob(c: SkCanvas, pts: readonly Pt[], base: string, tension = 0.9) {
  const p = path.smooth(pts, true, tension);
  c.drawPath(p, stroke(darken(base, 0.45), 0.9));
  c.drawPath(p, fill(base));
}

function ellipse(x: number, y: number, rx: number, ry: number, n = 12): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * rx, y + Math.sin(a) * ry] as Pt;
  });
}

// ---------- plated ----------

const pizzaPlates = looks('platePizza', [-16, -20, 16, 6], (c, t) => {
  const [x, y] = P(0, 0, plateBase(c, t));
  // A round pie seen from above at the iso angle, one slice pulled out.
  blob(c, ellipse(x, y - 3, 9, 4.6), '#E0A44E');
  c.drawPath(path.smooth(ellipse(x, y - 3.3, 7.4, 3.6), true, 1), fill('#D8452E'));
  c.drawPath(path.smooth(ellipse(x - 0.4, y - 3.5, 6.4, 3), true, 1), fill('#F6DB8A'));
  const toppings: [number, number][] = [[-3.5, -4], [0.5, -5.2], [3.6, -3.4], [-1, -2.2], [2.4, -1.8]];
  for (const [dx, dy] of toppings.slice(0, t >= 1 ? 5 : 3)) c.drawCircle(x + dx, y + dy, 1.1, fill('#B5242A'));
  if (t >= 1) for (const [dx, dy] of [[-2, -5], [2, -3.2]] as const) c.drawCircle(x + dx, y + dy, 0.7, fill('#3E8C3A'));
  // The pulled slice, lifted with its string of cheese.
  c.drawPath(path.poly([[x + 4, y - 7], [x + 9, y - 9.5], [x + 10, y - 6]]), fill('#F6DB8A'));
  c.drawPath(path.polyline([[x + 4, y - 7], [x + 9, y - 9.5]]), stroke('#E0A44E', 1.2));
  if (t >= 2) c.drawPath(path.polyline([[x + 5, y - 5], [x + 6.5, y - 7.6]]), stroke('#FFF1B8', 0.6));
  if (t === 3) c.drawCircle(x, y - 3.5, 1.4, fill(GOLD));
});

const sushiPlates = looks('plateSushi', [-17, -18, 17, 6], (c, t) => {
  const [x, y] = P(0, 0, plateBase(c, t));
  // A black board with maki rolls and nigiri; chopsticks across from the second look.
  c.drawPath(path.poly([[x - 11, y - 2], [x + 1, y - 7.5], [x + 11, y - 3], [x - 1, y + 2.5]]), fill('#2B2730'));
  const rolls: [number, number][] = [[-5.5, -2], [-2, -3.6], [1.5, -5.2]];
  for (const [dx, dy] of rolls) {
    c.drawPath(path.smooth(ellipse(x + dx, y + dy - 1.4, 2.2, 1.4), true, 1), fill('#1F3A2A'));
    c.drawPath(path.smooth(ellipse(x + dx, y + dy - 1.8, 1.6, 1), true, 1), fill('#FFFDF4'));
    c.drawCircle(x + dx, y + dy - 1.8, 0.6, fill('#F07A4A'));
  }
  const nigiri = (dx: number, dy: number, fish: string) => {
    blob(c, ellipse(x + dx, y + dy, 2.8, 1.5), '#FFFDF4');
    blob(c, ellipse(x + dx, y + dy - 1.4, 3, 1.3), fish);
    c.drawPath(path.polyline([[x + dx - 1.6, y + dy - 1.6], [x + dx + 1.6, y + dy - 1.4]]), stroke(lighten(fish, 0.35), 0.5));
  };
  nigiri(5, -1, '#F28A5A');
  if (t >= 1) nigiri(2, 0.6, '#E8484A');
  if (t >= 1) c.drawPath(path.smooth(ellipse(x + 7, y - 4.5, 1.3, 0.8), true, 1), fill('#9ACD52'));
  if (t >= 2) {
    c.drawLine(x - 9, y - 6, x + 3, y - 10.5, stroke(t === 3 ? GOLD : '#C9925A', 0.9));
    c.drawLine(x - 8, y - 4.8, x + 4, y - 9.6, stroke(t === 3 ? GOLD : '#C9925A', 0.9));
  }
});

const steakPlates = looks('plateSteak', [-16, -18, 16, 6], (c, t) => {
  const [x, y] = P(0, 0, plateBase(c, t));
  // A thick grilled steak with grill marks, potatoes, and rosemary.
  blob(c, [[x - 7, y - 3], [x - 4, y - 7], [x + 4, y - 7.5], [x + 7.5, y - 4], [x + 5, y - 0.5], [x - 4, y]], '#7A3418');
  c.drawPath(path.smooth([[x - 6, y - 3.5], [x - 3.5, y - 6.4], [x + 4, y - 6.8], [x + 6.5, y - 4]], false), stroke('#A85A30', 0.8));
  for (const dx of [-3, 0, 3]) c.drawLine(x + dx - 1.5, y - 1.5, x + dx + 1.5, y - 6, stroke('#3A160A', 0.9));
  for (const [dx, dy] of [[-8, 0.5], [-5.5, 1.6], ...(t >= 1 ? ([[7.5, 0.2]] as const) : [])] as const) {
    c.drawCircle(x + dx, y + dy, 1.7, fill('#C98A3A'));
    c.drawCircle(x + dx - 0.4, y + dy - 0.5, 0.7, fill('#F2C46A'));
  }
  if (t >= 1) c.drawPath(path.polyline([[x + 1, y - 8], [x + 4, y - 11]]), stroke('#3E7A3A', 1));
  if (t >= 2) c.drawCircle(x - 1, y - 4.8, 1.3, fill('#F6E7B0'));
  if (t === 3) c.drawPath(path.polyline([[x - 2.5, y - 5.5], [x + 2.5, y - 5.5]]), stroke(GOLD, 0.8));
});

const cakePlates = looks('plateCake', [-14, -32, 14, 6], (c, t) => {
  const [x, y] = P(0, 0, plateBase(c, t));
  // A tiered cake: pink layers, white cream, a cherry on top; a third tier and gold from the later looks.
  const tier = (cy: number, w: number, h: number, body: string) => {
    c.drawRect(Skia.XYWHRect(x - w, y + cy - h, w * 2, h), fill(body));
    c.drawPath(path.smooth(ellipse(x, y + cy, w, w * 0.4), true, 1), fill(darken(body, 0.15)));
    c.drawPath(path.smooth(ellipse(x, y + cy - h, w, w * 0.4), true, 1), fill('#FFF6EE'));
    for (let i = -2; i <= 2; i++) c.drawCircle(x + (i * w) / 2.6, y + cy - h + 0.8, 0.8, fill('#FFFFFF'));
  };
  tier(-1, 7, 6, '#F4A7C0');
  tier(-7, 5, 5, t === 3 ? '#F6E2A8' : '#F7C4D6');
  let top = -12;
  if (t >= 2) {
    tier(-12, 3, 4, '#F4A7C0');
    top = -16;
  }
  c.drawCircle(x, y + top - 1.2, 1.4, fill('#D8142A'));
  if (t >= 1) for (const dx of [-4.5, 4.5]) c.drawCircle(x + dx, y - 7.5, 0.8, fill('#D8142A'));
  if (t === 3) for (const [dx, dy] of [[-6, -3], [6, -2.5], [0, -9.5]] as const) c.drawCircle(x + dx, y + dy, 0.6, fill(GOLD));
});

const lobsterPlates = looks('plateLobster', [-18, -20, 18, 6], (c, t) => {
  const [x, y] = P(0, 0, plateBase(c, t));
  // A red lobster on a bed of greens, two claws, lemon; caviar and gold from the later looks.
  blob(c, ellipse(x, y - 1.5, 9, 3.2), '#5FA84A');
  const red = '#D8402A';
  for (let i = 0; i < 4; i++) blob(c, ellipse(x - 4 + i * 2.6, y - 3.5 - i * 0.6, 2.2, 1.6), i % 2 ? red : darken(red, 0.1));
  blob(c, [[x + 5, y - 6.5], [x + 9, y - 7.5], [x + 10, y - 4.5], [x + 7, y - 4]], red, 0.8);
  for (const [cx, cy] of [[-7, -7.5], [-5, -9.5]] as const) {
    blob(c, [[x + cx, y + cy], [x + cx - 3, y + cy - 2], [x + cx - 2.5, y + cy + 0.5], [x + cx + 1, y + cy + 2]], red, 0.8);
  }
  for (const [dx, dy] of [[1, -9], [3, -8.5]] as const) c.drawLine(x + dx, y + dy + 3, x + dx + 3, y + dy - 2, stroke('#B5321E', 0.5));
  if (t >= 1) {
    c.drawPath(path.smooth(ellipse(x + 8, y + 0.5, 2, 1.2), true, 1), fill('#F6D84A'));
    c.drawPath(path.smooth(ellipse(x + 8, y + 0.3, 1.4, 0.8), true, 1), fill('#FFF2A0'));
  }
  if (t >= 2) for (const [dx, dy] of [[-8, 0], [-7, 0.6], [-6.2, -0.2]] as const) c.drawCircle(x + dx, y + dy, 0.6, fill('#1A1A22'));
  if (t === 3) c.drawPath(path.polyline([[x - 3, y - 6.5], [x + 3, y - 7.5]]), stroke(GOLD, 0.9));
});

// ---------- icons (order bubbles, tickets) ----------

const ICON = [-9, -9, 9, 9] as const;

function glossy(c: SkCanvas, p: ReturnType<typeof path.smooth>, base: string) {
  c.drawPath(p, stroke(EDGE, 1.4));
  c.drawPath(p, fill(base));
  c.drawPath(p, fill('#FFFFFF', 0.12));
}

const iconPizza = sprite(ICON, (c) => {
  glossy(c, path.poly([[-6, -6], [7, -3], [-2, 7]]), '#F6DB8A');
  c.drawPath(path.polyline([[-6, -6], [7, -3]]), stroke('#C9822E', 2.4));
  for (const [x, y] of [[-1, -2], [2.4, -0.6], [-1.6, 2.4]] as const) c.drawCircle(x, y, 1.3, fill('#B5242A'));
});

const iconSushi = sprite(ICON, (c) => {
  glossy(c, path.smooth(ellipse(0, 2, 7, 3.6), true, 1), '#FFFDF4');
  glossy(c, path.smooth([[-7, 0], [-3, -4], [4, -4.5], [7.5, -1], [3, 1], [-4, 1.4]], true, 0.9), '#F28A5A');
  for (const x of [-3, 0.5, 4]) c.drawLine(x - 1, -3, x + 1, 0.4, stroke('#FFD0B4', 0.8));
});

const iconSteak = sprite(ICON, (c) => {
  glossy(c, path.smooth([[-7, 0], [-4, -5], [4, -5.5], [7.5, -1], [4.5, 4], [-4, 4.5]], true, 0.9), '#8A3A1C');
  for (const x of [-3, 0, 3]) c.drawLine(x - 1.6, 3, x + 1.6, -3.5, stroke('#3A160A', 1.1));
  c.drawCircle(-4.4, 2, 1.3, fill('#F6E7B0'));
});

const iconCake = sprite(ICON, (c) => {
  glossy(c, path.rrect(-6.5, -1, 13, 7.5, 1.5), '#F4A7C0');
  glossy(c, path.rrect(-4, -6, 8, 5.5, 1.5), '#F7C4D6');
  c.drawRect(Skia.XYWHRect(-6.5, -1, 13, 1.6), fill('#FFF6EE'));
  c.drawRect(Skia.XYWHRect(-4, -6, 8, 1.4), fill('#FFF6EE'));
  c.drawCircle(0, -7.6, 1.6, fill('#D8142A'));
});

const iconLobster = sprite(ICON, (c) => {
  glossy(c, path.smooth([[-2, -6], [2, -6], [3, 0], [1.6, 6], [-1.6, 6], [-3, 0]], true, 0.9), '#D8402A');
  for (const s of [-1, 1]) glossy(c, path.smooth([[s * 3, -3], [s * 7.5, -7], [s * 8, -3], [s * 4.5, -1]], true, 0.8), '#E2502E');
  for (const y of [-1, 2]) c.drawLine(-2.6, y, 2.6, y, stroke('#9A2A16', 0.7));
});


// ---------- the new stations' dishes (owner M29): a salad off the cold line, pad thai off the wok ----------

const saladPlates = looks('plateSalad', [-16, -18, 16, 6], (c, t) => {
  const [x, y] = P(0, 0, plateBase(c, t));
  // A tumble of leaves, tomato, cucumber; feta and a drizzle from the second look on.
  blob(c, ellipse(x, y - 2.6, 8.6, 4.2), '#5FAE4E');
  const bits: [number, number, string][] = [[-4, -3.6, '#7BC67E'], [3, -4.2, '#3FA65A'], [-1, -5.2, '#8FD07E'], [4.5, -2, '#7BC67E'], [-4.6, -1.4, '#3FA65A']];
  for (const [dx, dy, col] of bits) blob(c, ellipse(x + dx, y + dy, 2.6, 1.4), col);
  for (const [dx, dy] of [[-2, -2.6], [2.4, -3], [0.4, -1.4]] as const) c.drawCircle(x + dx, y + dy, 1.2, fill('#E5483B'));
  for (const [dx, dy] of [[1, -4.4], [-3, -4.2]] as const) c.drawCircle(x + dx, y + dy, 1, fill('#CDEBB0'));
  if (t >= 1) for (const [dx, dy] of [[-1.2, -3.6], [3.4, -1.6], [-3.6, -2.4]] as const) c.drawRect(Skia.XYWHRect(x + dx - 0.9, y + dy - 0.9, 1.8, 1.8), fill('#FFFDF4'));
  if (t >= 2) c.drawPath(path.smooth([[x - 5, y - 4], [x - 1, y - 5.6], [x + 3, y - 3], [x + 6, y - 4.4]], false), stroke('#F2C14E', 0.6));
  if (t === 3) c.drawCircle(x + 0.5, y - 5.8, 1.1, fill(GOLD));
});

const padThaiPlates = looks('platePadThai', [-16, -19, 16, 6], (c, t) => {
  const [x, y] = P(0, 0, plateBase(c, t));
  // A nest of noodles, prawns, a lime wedge; peanuts and bean sprouts as it gets finer.
  blob(c, ellipse(x, y - 3, 8.4, 4.2), '#E2B65A');
  for (let i = 0; i < 6; i++) c.drawPath(path.smooth([[x - 7, y - 4 + i * 0.9], [x - 3, y - 5.6 + i * 0.9], [x + 1, y - 3 + i * 0.9], [x + 6, y - 4.6 + i * 0.9]], false), stroke('#F2D088', 0.8));
  for (const [dx, dy] of [[-3, -5.4], [2.6, -4.8]] as const) {
    c.drawPath(path.smooth([[x + dx - 2, y + dy], [x + dx, y + dy - 1.8], [x + dx + 2, y + dy], [x + dx, y + dy + 0.6]], true, 0.8), fill('#F28A5A'));
  }
  c.drawPath(path.poly([[x + 6, y - 1], [x + 9, y - 2.4], [x + 8.6, y + 0.4]]), fill('#9BD86A'));
  if (t >= 1) for (const [dx, dy] of [[-1, -2], [1.5, -2.6], [-4, -2.4], [4, -3.2]] as const) c.drawCircle(x + dx, y + dy, 0.6, fill('#B07A3A'));
  if (t >= 2) for (const dx of [-5, -4, 3.5]) c.drawLine(x + dx, y - 6, x + dx + 0.8, y - 3.4, stroke('#F4F0E0', 0.6));
  if (t === 3) c.drawCircle(x, y - 6.4, 1.1, fill(GOLD));
});

const iconSalad = sprite(ICON, (c) => {
  glossy(c, path.smooth([[-7, -1], [-6, 4], [0, 6.5], [6, 4], [7, -1]], true, 0.9), '#DCE2E8');
  for (const [x, y, col] of [[-3.4, -2.4, '#3FA65A'], [1.6, -3.6, '#7BC67E'], [4.2, -1.4, '#3FA65A'], [-0.6, -0.8, '#8FD07E']] as const) glossy(c, path.smooth(ellipse(x, y, 3, 2), true, 1), col);
  c.drawCircle(-1, -3.6, 1.4, fill('#E5483B'));
  c.drawCircle(2.6, -0.6, 1.2, fill('#E5483B'));
});

const iconPadThai = sprite(ICON, (c) => {
  glossy(c, path.smooth(ellipse(0, 1.5, 7.4, 4.6), true, 1), '#E2B65A');
  for (let i = 0; i < 4; i++) c.drawPath(path.smooth([[-6, -1 + i * 1.6], [-2, -3 + i * 1.6], [2, -0.6 + i * 1.6], [6, -2.4 + i * 1.6]], false), stroke('#F6DC9A', 0.9));
  glossy(c, path.smooth([[-3, -4], [0, -6], [3, -4], [0, -3]], true, 0.8), '#F28A5A');
});

export const moreDishSprites = {
  ...pizzaPlates,
  ...sushiPlates,
  ...steakPlates,
  ...cakePlates,
  ...lobsterPlates,
  iconPizza,
  iconSushi,
  iconSteak,
  iconCake,
  iconLobster,
  ...saladPlates,
  ...padThaiPlates,
  iconSalad,
  iconPadThai,
};
