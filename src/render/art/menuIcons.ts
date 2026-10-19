import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { BLUE, CREAM, EDGE, GOLD, GREEN, inkLine, RED, shape, sparkle, STEEL, WOOD, type Look } from './iconKit';
import { fill, path, stroke, type Pt } from './kit';

// The menus' round-button and page icons in the house style (src/render/art/iconKit.ts): the
// guide, reviews, the deal, trophies, quests, the gift, and the ones that were emojis before
// (owner M41): the rush flame, the door sign, the padlock, the kitchen hint, the clock, mail...

const BOX = [-25, -25, 25, 28] as const;
const ORANGE: Look = { light: '#FFC27A', base: '#FF7A1A', dark: '#B8360A' };
const YELLOW: Look = { light: '#FFFFE6', base: '#FFE14A', dark: '#E8920E' };
const PARCH: Look = { light: '#FFFBEF', base: '#F4E2B8', dark: '#C9A46A' };
const PLUM: Look = { light: '#9B6AB8', base: '#5E2A86', dark: '#2E1048' };

export function starPts(cx: number, cy: number, outer: number, inner: number): Pt[] {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
  });
}

/** A gold star (rounded points), any size. */
export function goldStar(c: SkCanvas, x: number, y: number, r: number, outline = 2.2, shadow = false): void {
  shape(c, path.smooth(starPts(x, y, r, r * 0.46), true, 0.2), { ...GOLD, outline, shadow, gloss: 0.4 });
}

const ring = (c: SkCanvas, x: number, y: number, r: number, color: string, w: number) => {
  c.drawCircle(x, y, r, stroke(EDGE, w + 2.8));
  c.drawCircle(x, y, r, stroke(color, w));
};

/** Reviews: a cream speech bubble with three gold stars. */
const iconBubble = sprite(BOX, (c) => {
  shape(c, path.smooth([[-21, -6], [-15, -18], [0, -20], [15, -18], [21, -6], [17, 5], [5, 9], [-5, 19], [-4, 9], [-17, 5]], true, 0.35), CREAM);
  for (const [x, r] of [[-10, 5], [0, 6.2], [10, 5]] as const) goldStar(c, x, -6, r, 1.8);
});

/** The guide: a red book in gold, a rosette on the cover. */
const iconBook = sprite(BOX, (c) => {
  shape(c, path.rrect(11, -17, 6, 36, 2), PARCH);
  shape(c, path.rrect(-17, -21, 30, 41, 5), RED);
  c.drawPath(path.rrect(-13, -17, 22, 33, 3), stroke('#F2C14E', 1.4));
  c.drawPath(path.rrect(-17, -21, 6, 41, 3), fill(EDGE, 0.22));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    shape(c, path.circle(-2 + Math.cos(a) * 6.4, -1 + Math.sin(a) * 6.4, 2.6), { ...GOLD, outline: 1.4, shadow: false, gloss: 0 });
  }
  shape(c, path.circle(-2, -1, 5.6), { ...GOLD, outline: 1.8, shadow: false });
});

/** The flash deal: a yellow bolt on a hot orange disc. */
const iconBolt = sprite(BOX, (c) => {
  shape(c, path.circle(0, 0, 21), ORANGE);
  shape(c, path.poly([[4, -17], [-10, 2], [-1, 2], [-5, 17], [10, -3], [1, -3]]), { ...YELLOW, outline: 2.4, shadow: false });
});

/** Trophies: a gold cup with handles on a dark plinth, a star on it. */
const iconTrophy = sprite(BOX, (c) => {
  shape(c, path.rrect(-12, 13, 24, 8, 2.5), { light: '#8A5A3A', base: '#5A3420', dark: '#2E180C' });
  shape(c, path.rrect(-4, 4, 8, 10, 1.5), { ...GOLD, outline: 2, shadow: false });
  for (const sx of [-1, 1]) ring(c, sx * 13.5, -8, 6, '#F2B22A', 3.2);
  shape(c, path.smooth([[-14, -19], [14, -19], [12, -4], [0, 7], [-12, -4]], true, 0.3), GOLD);
  goldStar(c, 0, -8, 5.5, 1.6);
});

/** Quests: a parchment scroll rolled at both ends, a red wax seal. */
const iconScroll = sprite(BOX, (c) => {
  shape(c, path.rrect(-16, -15, 30, 31, 3), PARCH);
  for (let i = 0; i < 4; i++) c.drawLine(-11, -7 + i * 5, 7 - (i % 2) * 6, -7 + i * 5, stroke('#A88A5A', 1.6));
  for (const y of [-19, 13]) shape(c, path.rrect(-20, y, 38, 7, 3.5), { ...WOOD, shadow: false, outline: 2.4 });
  shape(c, path.circle(10, 7, 5.6), { ...RED, outline: 2, shadow: false });
});

/** The gift: a red box, a gold ribbon and a big bow. */
const iconGift = sprite(BOX, (c) => {
  for (const sx of [-1, 1]) shape(c, path.smooth([[0, -12], [sx * 13, -23], [sx * 16, -14], [sx * 4, -11]], true, 0.6), { ...GOLD, shadow: false, outline: 2.2 });
  shape(c, path.rrect(-17, -5, 34, 23, 3), RED);
  shape(c, path.rrect(-20, -12, 40, 9, 2.5), { light: '#FF9A8A', base: '#EE4048', dark: '#A81E2A', shadow: false });
  shape(c, path.rrect(-3.5, -12, 7, 30, 1), { ...GOLD, outline: 1.6, shadow: false, gloss: 0 });
  shape(c, path.circle(0, -12, 4), { ...GOLD, outline: 1.8, shadow: false });
});

/** Rush hour: a flame, red outside to a white-hot core. */
const iconFlame = sprite(BOX, (c) => {
  const flame = (k: number, dy: number) => path.smooth([[0, -22 * k + dy], [9 * k, -8 * k + dy], [13 * k, 6 * k + dy], [8 * k, 17 * k + dy], [0, 20 * k + dy], [-8 * k, 17 * k + dy], [-13 * k, 6 * k + dy], [-7 * k, -4 * k + dy], [-4 * k, -12 * k + dy]], true, 0.9);
  shape(c, flame(1, 0), { light: '#FF9A4A', base: '#F2461A', dark: '#A8160E' });
  shape(c, flame(0.66, 5), { ...YELLOW, outline: 0, shadow: false });
  shape(c, flame(0.34, 11), { light: '#FFFFFF', base: '#FFFBE0', dark: '#FFE58A', outline: 0, shadow: false, gloss: 0 });
});

/** Open: an arched doorway, its wooden door swung half open onto warm light. */
const iconDoor = sprite(BOX, (c) => {
  const arch = (inset: number) => path.smooth([[-16 + inset, 22], [-16 + inset, -8], [-12 + inset, -18], [0, -22 + inset], [12 - inset, -18], [16 - inset, -8], [16 - inset, 22]], true, 0.45);
  shape(c, arch(0), { light: '#C9A0D8', base: '#7A4A96', dark: '#3A1A52' });
  shape(c, arch(4), { light: '#FFFBE0', base: '#FFD66A', dark: '#F2A02A', outline: 2, shadow: false, gloss: 0.15 });
  // The door, hinged on the left, swung in: narrower and a little taller at its open edge.
  shape(c, path.poly([[-12, 22], [-12, -12], [2, -18], [2, 25]]), { ...WOOD, shadow: false, outline: 2.4 });
  for (const [y0, y1] of [[-10, -1], [3, 15]] as const) c.drawPath(path.poly([[-9, y0 + 1], [-1, y0 - 2], [-1, y1 + 1], [-9, y1]]), stroke('#6E3E1A', 1.4));
  shape(c, path.circle(-2.5, 5, 2), { ...GOLD, outline: 1.4, shadow: false });
  c.drawRect(Skia.XYWHRect(-16, 21, 32, 3), fill(EDGE, 0.6));
});

/** Closed: a gold padlock with a steel shackle. */
const iconLock = sprite(BOX, (c) => {
  ring(c, 0, -8, 10, '#C9D2DE', 4.6);
  c.drawCircle(0, -8, 10, stroke('#FFFFFF', 1.2, 0.6));
  shape(c, path.rrect(-17, -4, 34, 25, 5), GOLD);
  c.drawCircle(0, 5, 3.6, fill(EDGE));
  c.drawPath(path.poly([[-1.8, 6], [1.8, 6], [2.6, 14], [-2.6, 14]]), fill(EDGE));
});

/** The kitchen hint: a puffed white chef's hat. */
const iconChef = sprite(BOX, (c) => {
  shape(c, path.rrect(-13, 6, 26, 13, 3), { light: '#FFFFFF', base: '#F2EEF6', dark: '#B8B0C8' });
  shape(c, path.smooth([[-13, 8], [-19, -2], [-15, -12], [-7, -13], [-3, -20], [6, -20], [9, -13], [17, -11], [19, -1], [13, 8]], true, 0.75), { light: '#FFFFFF', base: '#FFFFFF', dark: '#C9C2D8' });
  for (const x of [-6, 0, 6]) c.drawLine(x, 9, x, 17, stroke('#C9C2D8', 1.4));
});

/** Timers: a stopwatch, gold rim, a red hand. */
const iconTimer = sprite(BOX, (c) => {
  shape(c, path.rrect(-4, -24, 8, 7, 2), { ...GOLD, shadow: false, outline: 2 });
  shape(c, path.rrect(9, -19, 7, 5, 2), { ...GOLD, shadow: false, outline: 2 });
  shape(c, path.circle(0, 2, 19), GOLD);
  shape(c, path.circle(0, 2, 14), { ...CREAM, outline: 2, shadow: false, gloss: 0.15 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.drawLine(Math.cos(a) * 11, 2 + Math.sin(a) * 11, Math.cos(a) * 13, 2 + Math.sin(a) * 13, stroke('#8A6A3A', i % 3 ? 1 : 1.8));
  }
  inkLine(c, path.polyline([[0, 2], [6, -6]]), '#E2333A', 1.8);
  c.drawCircle(0, 2, 2.2, fill(EDGE));
});

/** Mail: a cream envelope with a red heart seal. */
const iconMail = sprite(BOX, (c) => {
  shape(c, path.rrect(-20, -14, 40, 29, 4), CREAM);
  c.drawPath(path.polyline([[-18, -12], [0, 3], [18, -12]]), stroke('#C9A46A', 2));
  c.drawPath(path.polyline([[-18, 13], [-5, -1]]), stroke('#E2CFA8', 1.4));
  c.drawPath(path.polyline([[18, 13], [5, -1]]), stroke('#E2CFA8', 1.4));
  shape(c, path.smooth([[0, 9], [-6, 3], [-5, -2], [0, 0], [5, -2], [6, 3]], true, 0.7), { ...RED, outline: 1.8, shadow: false });
});

/** Stats: three rising bars and an arrow. */
const iconChart = sprite(BOX, (c) => {
  shape(c, path.rrect(-20, 18, 40, 4, 2), { light: '#8A6AA8', base: '#5E2A86', dark: '#2E1048', shadow: false, outline: 2 });
  shape(c, path.rrect(-17, 4, 9, 15, 2), BLUE);
  shape(c, path.rrect(-4, -4, 9, 23, 2), GREEN);
  shape(c, path.rrect(9, -13, 9, 32, 2), GOLD);
  inkLine(c, path.polyline([[-15, -6], [-3, -14], [6, -10], [17, -21]]), '#FFFFFF', 2);
  shape(c, path.poly([[19, -24], [19, -15], [11, -21]]), { light: '#FFFFFF', base: '#FFFFFF', dark: '#D8D0E8', outline: 1.6, shadow: false, gloss: 0 });
});

/** Forever: a gold crown with jewels. */
const iconCrown = sprite(BOX, (c) => {
  shape(c, path.poly([[-20, 14], [-22, -10], [-11, 0], [0, -17], [11, 0], [22, -10], [20, 14]]), GOLD);
  shape(c, path.rrect(-21, 10, 42, 9, 3), { ...GOLD, shadow: false });
  for (const [x, y, look] of [[-22, -12, RED], [0, -19, BLUE], [22, -12, RED]] as const) shape(c, path.circle(x, y, 3.6), { ...look, outline: 1.8, shadow: false });
  for (const [x, look] of [[-10, BLUE], [0, RED], [10, GREEN]] as const) shape(c, path.circle(x, 14.5, 2.8), { ...look, outline: 1.4, shadow: false });
});

/** Done: a green disc with a white tick. */
const iconCheck = sprite(BOX, (c) => {
  shape(c, path.circle(0, 0, 20), GREEN);
  inkLine(c, path.polyline([[-9, 0], [-2, 8], [10, -8]]), '#FFFFFF', 4.4);
});

/** Building works: a hammer, wooden handle, steel head. */
const iconHammer = sprite(BOX, (c) => {
  c.save();
  c.rotate(-35, 0, 0);
  shape(c, path.rrect(-3.5, -6, 7, 30, 3), WOOD);
  shape(c, path.smooth([[-16, -18], [12, -18], [17, -14], [12, -6], [-16, -6], [-19, -12]], true, 0.4), STEEL);
  c.restore();
  sparkle(c, -12, -16, 3.5);
});

/** Days: a calendar page, red top, two rings. */
const iconCalendar = sprite(BOX, (c) => {
  shape(c, path.rrect(-18, -15, 36, 35, 5), CREAM);
  shape(c, path.rrect(-18, -15, 36, 11, 4), { ...RED, shadow: false });
  for (const x of [-9, 9]) shape(c, path.rrect(x - 2.5, -21, 5, 10, 2.5), { ...STEEL, shadow: false, outline: 1.8 });
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) c.drawRect(Skia.XYWHRect(-13 + k * 7, 0 + r * 6, 4.4, 3.6), fill(r === 1 && k === 2 ? '#E2333A' : '#C9A46A'));
});

/** The guest's mood, owner's kitchen: a plum tag (the deal's discount, a price). */
const iconTag = sprite(BOX, (c) => {
  shape(c, path.poly([[-6, -20], [20, -20], [20, 6], [-4, 22], [-22, 4]]), PLUM);
  c.drawCircle(12, -12, 3.6, fill(EDGE));
  c.drawCircle(12, -12, 2, fill('#FFFFFF', 0.6));
});

/** A new city: three towers with lit windows. */
const iconCity = sprite(BOX, (c) => {
  const tower = (x: number, y: number, w: number, look: Look) => {
    shape(c, path.rrect(x, y, w, 22 - y, 2), { ...look, shadow: false });
    for (let r = y + 4; r < 18; r += 6) for (let k = x + 3; k < x + w - 3; k += 5) c.drawRect(Skia.XYWHRect(k, r, 2.6, 3), fill('#FFE58A'));
  };
  c.drawRect(Skia.XYWHRect(-22, 20, 44, 4), fill(EDGE, 0.5));
  tower(-21, -6, 13, PLUM);
  tower(8, -10, 13, PLUM);
  tower(-9, -21, 17, BLUE);
  shape(c, path.poly([[-1, -27], [2, -21], [-4, -21]]), { ...GOLD, outline: 1.6, shadow: false });
});

/** A white die (random names). */
const iconDice = sprite(BOX, (c) => {
  shape(c, path.rrect(-17, -17, 34, 34, 8), { light: '#FFFFFF', base: '#F4F0FA', dark: '#B8B0C8' });
  for (const [x, y] of [[-8, -8], [8, -8], [0, 0], [-8, 8], [8, 8]] as const) shape(c, path.circle(x, y, 3.2), { ...RED, outline: 1.2, shadow: false, gloss: 0.2 });
});

/** Deliveries: a red scooter with a delivery box. */
const iconScooter = sprite(BOX, (c) => {
  for (const x of [-13, 13]) {
    shape(c, path.circle(x, 13, 7), { light: '#6A6078', base: '#2E2838', dark: '#120E18', shadow: false });
    c.drawCircle(x, 13, 3, fill('#C9D2DE'));
  }
  shape(c, path.smooth([[-19, 8], [-14, -2], [4, -2], [10, 10], [-4, 12]], true, 0.6), RED);
  shape(c, path.rrect(-21, -18, 16, 15, 3), { light: '#FFE6A8', base: '#F2B21C', dark: '#B8700A' });
  inkLine(c, path.polyline([[8, 6], [14, -14], [19, -15]]), '#C9D2DE', 2.4);
  shape(c, path.circle(15, -8, 3), { ...YELLOW, outline: 1.6, shadow: false });
});

/** Happy guests: a yellow smiling face. */
const iconSmile = sprite(BOX, (c) => {
  shape(c, path.circle(0, 0, 20), { light: '#FFF6B0', base: '#FFD23F', dark: '#E8920E' });
  for (const x of [-7, 7]) c.drawOval(Skia.XYWHRect(x - 2.4, -9, 4.8, 7), fill(EDGE));
  inkLine(c, path.smooth([[-10, 4], [0, 12], [10, 4]], false, 0.8), '#B8240E', 2);
  for (const x of [-12, 12]) c.drawCircle(x, 4, 3.4, fill('#FF7A7A', 0.5));
});

/** Ingredients: a fresh green leaf. */
const iconLeaf = sprite(BOX, (c) => {
  shape(c, path.smooth([[-18, 18], [-16, -4], [-4, -18], [18, -20], [14, 2], [2, 16]], true, 0.75), GREEN);
  c.drawPath(path.smooth([[-18, 18], [-4, 2], [12, -14]], false, 0.6), stroke('#16702A', 2));
  for (const [x0, y0, x1, y1] of [[-6, 0, -12, -6], [0, -6, 2, 4], [6, -11, 0, -16], [4, -9, 10, -2]] as const) c.drawLine(x0, y0, x1, y1, stroke('#16702A', 1.2));
});

/** The bar: a cocktail glass with an orange slice. */
const iconCocktail = sprite(BOX, (c) => {
  shape(c, path.rrect(-10, 18, 20, 4, 2), STEEL);
  c.drawLine(0, 2, 0, 19, stroke(EDGE, 4));
  c.drawLine(0, 2, 0, 19, stroke('#E8ECF4', 2));
  shape(c, path.poly([[-19, -17], [19, -17], [0, 4]]), { light: '#FFC6E6', base: '#FF5AA0', dark: '#B81E64' });
  c.drawPath(path.poly([[-19, -17], [19, -17], [15, -12], [-15, -12]]), fill('#FFFFFF', 0.35));
  shape(c, path.circle(15, -18, 6), { light: '#FFE6A8', base: '#FFA21A', dark: '#C8600A', outline: 2, shadow: false });
  inkLine(c, path.polyline([[-12, -24], [-2, -10]]), '#2EA84A', 1.6);
});

/** The guide's star: a red rosette of six round petals, a cream heart (drawn, so it reads like the guide's own mark). */
const iconRosette = sprite(BOX, (c) => {
  const R: Look = { light: '#FF7A7A', base: '#D7192E', dark: '#7E0A18' };
  // The outline of six round petals round a middle (sampled by angle: the web's Skia has no path union).
  const pts: Pt[] = [];
  for (let k = 0; k < 144; k++) {
    const th = (k / 144) * Math.PI * 2;
    let r = 12;
    for (let i = 0; i < 6; i++) {
      const d = th - (-Math.PI / 2 + (i / 6) * Math.PI * 2);
      const side = 11 * Math.sin(d);
      if (Math.abs(side) <= 10) r = Math.max(r, 11 * Math.cos(d) + Math.sqrt(100 - side * side));
    }
    pts.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
  const p = path.poly(pts);
  shape(c, p, R);
  shape(c, path.circle(0, 0, 7), { light: '#FFFFFF', base: '#FFF4DC', dark: '#E9C9A0', outline: 2.2, shadow: false, gloss: 0.2 });
  shape(c, path.circle(0, 0, 3.2), { ...R, outline: 1.4, shadow: false, gloss: 0 });
});

/** The guide's plate ("recommended"): a white plate with a fork and a knife. */
const iconPlate = sprite(BOX, (c) => {
  shape(c, path.circle(0, 2, 17), { light: '#FFFFFF', base: '#EEF1F6', dark: '#B9C2CF' });
  c.drawCircle(0, 2, 11, stroke('#B9C2CF', 1.6));
  shape(c, path.rrect(-23.5, -16, 4, 36, 2), STEEL);
  for (const x of [-24.5, -21.5, -18.5]) c.drawLine(x, -20, x, -12, stroke(EDGE, 2.4));
  shape(c, path.smooth([[19.5, 20], [19.5, -20], [24, -12], [23.5, 2], [21.5, 3]], true, 0.4), STEEL);
});

/** Spot the inspector: a gold-rimmed magnifier on a wooden handle. */
const iconMagnifier = sprite(BOX, (c) => {
  shape(c, path.poly([[6, 9], [10, 5], [22, 17], [18, 21]]), WOOD);
  shape(c, path.circle(-4, -4, 17), GOLD);
  shape(c, path.circle(-4, -4, 12.5), { light: '#FFFFFF', base: '#BFE6FF', dark: '#6FB3E8', outline: 2, shadow: false, gloss: 0.5 });
  sparkle(c, -10, -10, 4.5);
});

/** The inspector's notebook: red covers, a cream page with notes, a pencil. */
const iconNotebook = sprite(BOX, (c) => {
  shape(c, path.rrect(-17, -20, 30, 40, 4), RED);
  shape(c, path.rrect(-12, -16, 22, 32, 2), { ...PARCH, outline: 1.8, shadow: false });
  for (let i = 0; i < 4; i++) c.drawLine(-8, -9 + i * 6, 6, -9 + i * 6, stroke('#9AA3AD', 1.4));
  shape(c, path.poly([[10, 18], [22, -14], [25, -12.6], [13, 19.6], [9, 23]]), YELLOW);
  shape(c, path.poly([[22, -14], [24, -19], [27, -17.6], [25, -12.6]]), { light: '#FFD0E2', base: '#F38DB3', dark: '#B8487A', outline: 1.8, shadow: false });
});

/** A talent point (owner M46): a four-pointed magenta star with a white glint. */
const iconTalent = sprite(BOX, (c) => {
  const MAGENTA: Look = { light: '#FFC6F2', base: '#E04FD0', dark: '#7A1E8E' };
  const pts: Pt[] = Array.from({ length: 8 }, (_, i) => {
    const r = i % 2 === 0 ? 22 : 8;
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    return [Math.cos(a) * r, Math.sin(a) * r + 2] as Pt;
  });
  shape(c, path.smooth(pts, true, 0.18), { ...MAGENTA, outline: 2.4, gloss: 0.45 });
  shape(c, path.circle(0, 2, 5.5), { light: '#FFFFFF', base: '#FFE6FA', dark: '#E9A6DA', outline: 1.4, shadow: false, gloss: 0.3 });
  sparkle(c, 13, -13, 4.2);
});

/** Loyalty: a red heart. */
const iconHeart = sprite(BOX, (c) => {
  shape(c, path.smooth([[0, 19], [-19, 0], [-17, -13], [-8, -18], [0, -10], [8, -18], [17, -13], [19, 0]], true, 0.45), RED);
  c.drawOval(Skia.XYWHRect(-13, -12, 7, 5), fill('#FFFFFF', 0.5));
});

export const menuIcons = {
  iconTalent,
  iconHeart,
  iconRosette,
  iconPlate,
  iconMagnifier,
  iconNotebook,
  iconScooter,
  iconSmile,
  iconLeaf,
  iconCocktail,
  iconCity,
  iconDice,
  iconBubble,
  iconBook,
  iconBolt,
  iconTrophy,
  iconScroll,
  iconGift,
  iconFlame,
  iconDoor,
  iconLock,
  iconChef,
  iconTimer,
  iconMail,
  iconChart,
  iconCrown,
  iconCheck,
  iconHammer,
  iconCalendar,
  iconTag,
};
