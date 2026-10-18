import { type SkCanvas } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { BLUE, CREAM, EDGE, GOLD, GREEN, inkLine, PURPLE, RED, shape, sparkle, STEEL, WOOD, linear, type Look } from './iconKit';
import { fill, path, stroke, type Pt } from './kit';
import { goldStar } from './menuIcons';

// The shop's goods in the house style (owner M41: emojis looked cheap): gems from a handful to a
// treasure, coins from a pile to a pot of gold, the boosts, the time warps, the perks and crews.

const BOX = [-25, -25, 25, 28] as const;
const GEM: Look = { light: '#E6FBFF', base: '#5FD6FF', dark: '#5A2AD0' };

/** A cut gem, its top `w` wide at (x, y). */
export function gem(c: SkCanvas, x: number, y: number, w: number, shadow = true): void {
  const h = w * 0.95;
  const pts: Pt[] = [[x - w / 2, y - h * 0.18], [x - w * 0.28, y - h / 2], [x + w * 0.28, y - h / 2], [x + w / 2, y - h * 0.18], [x, y + h / 2]];
  shape(c, path.poly(pts), { ...GEM, outline: Math.max(1.6, w * 0.1), shadow, gloss: 0.2 });
  c.drawPath(path.poly([[x - w * 0.28, y - h / 2], [x + w * 0.28, y - h / 2], [x + w * 0.16, y - h * 0.18], [x - w * 0.16, y - h * 0.18]]), fill('#FFFFFF', 0.5));
  c.drawPath(path.poly([[x + w * 0.16, y - h * 0.18], [x + w / 2, y - h * 0.18], [x, y + h / 2]]), fill('#2A1060', 0.22));
  c.drawPath(path.poly([[x - w / 2, y - h * 0.18], [x - w * 0.16, y - h * 0.18], [x, y + h / 2]]), fill('#FFFFFF', 0.18));
}

/** A gold coin seen from the front (r) or lying flat (flat < 1 squashes it). */
export function coin(c: SkCanvas, x: number, y: number, r: number, flat = 1): void {
  if (flat < 1) {
    c.drawOval(SkRect(x - r, y - r * flat + 2.2, r * 2, r * flat * 2), fill('#8A4A06'));
    shape(c, path.oval(x, y, r, r * flat), { ...GOLD, outline: Math.max(1.4, r * 0.18), shadow: false, gloss: 0.3 });
    c.drawOval(SkRect(x - r * 0.62, y - r * flat * 0.62, r * 1.24, r * flat * 1.24), stroke('#C77A0C', Math.max(0.8, r * 0.1)));
    return;
  }
  shape(c, path.circle(x, y, r), { ...GOLD, outline: Math.max(1.6, r * 0.16) });
  c.drawCircle(x, y, r * 0.68, stroke('#C77A0C', Math.max(1, r * 0.1)));
  goldStar(c, x, y + r * 0.04, r * 0.44, 0, false);
}

const SkRect = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h });

// ---------- gems ----------

const shopGems1 = sprite(BOX, (c) => {
  gem(c, 0, 1, 36);
  sparkle(c, -12, -14, 5);
  sparkle(c, 15, 9, 3);
});

/** A purple pouch, gems spilling from its mouth. */
const shopGems2 = sprite(BOX, (c) => {
  shape(c, path.smooth([[-15, -6], [-20, 8], [-14, 20], [14, 20], [20, 8], [15, -6], [6, -10], [-6, -10]], true, 0.8), PURPLE);
  shape(c, path.rrect(-12, -12, 24, 5, 2.5), { light: '#F2C14E', base: '#E2A11C', dark: '#9A5A0C', shadow: false, outline: 1.8 });
  gem(c, -6, -15, 13, false);
  gem(c, 6, -17, 15, false);
  sparkle(c, 15, -20, 3.5);
});

/** An open wooden chest, gold-banded, full of gems. */
const shopGems3 = sprite(BOX, (c) => {
  shape(c, path.smooth([[-20, -6], [-18, -20], [18, -20], [20, -6]], true, 0.3), WOOD);
  for (const [x, w] of [[-9, 12], [3, 14], [12, 10], [-2, 11]] as const) gem(c, x, -6 + (x % 4), w, false);
  shape(c, path.rrect(-21, -4, 42, 24, 3), WOOD);
  for (const x of [-15, 11]) shape(c, path.rrect(x, -4, 4, 24, 1), { ...GOLD, shadow: false, outline: 1.6, gloss: 0 });
  shape(c, path.rrect(-5, 2, 10, 9, 2), { ...GOLD, shadow: false, outline: 1.8 });
  c.drawCircle(0, 6, 1.6, fill(EDGE));
  sparkle(c, -16, -18, 3.5);
});

/** The treasure: a heap of gems with gold coins in it. */
const shopGems4 = sprite(BOX, (c) => {
  shape(c, path.smooth([[-22, 20], [-16, 8], [-6, 2], [6, 2], [16, 8], [22, 20]], true, 0.6), { light: '#B98AF0', base: '#6A3AC0', dark: '#2E1068' });
  coin(c, -14, 13, 6, 0.55);
  coin(c, 13, 15, 6, 0.55);
  gem(c, -8, -1, 15, false);
  gem(c, 9, 0, 15, false);
  gem(c, 0, -11, 20, false);
  sparkle(c, -16, -12, 4);
  sparkle(c, 17, -14, 3);
});

// ---------- coins ----------

/** A pile of coins: a little stack and one standing in front. */
const shopCoins1 = sprite(BOX, (c) => {
  for (let i = 0; i < 4; i++) coin(c, 8, 14 - i * 5, 11, 0.42);
  coin(c, -7, 6, 14);
});

/** A tied sack with a coin badge, coins at its foot. */
const shopCoins2 = sprite(BOX, (c) => {
  shape(c, path.smooth([[-8, -10], [-19, 4], [-16, 20], [16, 20], [19, 4], [8, -10]], true, 0.9), { light: '#F2D49A', base: '#C99A58', dark: '#7A5228' });
  shape(c, path.smooth([[-8, -12], [-12, -21], [0, -17], [12, -21], [8, -12]], true, 0.7), { light: '#F2D49A', base: '#C99A58', dark: '#7A5228', shadow: false });
  shape(c, path.rrect(-9, -13, 18, 4, 2), { ...RED, shadow: false, outline: 1.6, gloss: 0 });
  coin(c, 0, 6, 9);
  coin(c, -16, 20, 6, 0.5);
  coin(c, 15, 21, 6, 0.5);
});

/** A black pot brimming with gold. */
const shopCoins3 = sprite(BOX, (c) => {
  shape(c, path.smooth([[-17, -6], [-11, -10], [11, -10], [17, -6], [12, -3], [-12, -3]], true, 0.7), GOLD);
  for (const [x, y] of [[-10, -9], [-2, -12], [7, -10], [1, -7]] as const) coin(c, x, y, 5.5, 0.5);
  shape(c, path.smooth([[-21, -4], [-23, 8], [-14, 20], [14, 20], [23, 8], [21, -4]], true, 0.8), { light: '#6A6078', base: '#2E2838', dark: '#120E18' });
  shape(c, path.rrect(-22, -6, 44, 6, 3), { light: '#6A6078', base: '#3A3446', dark: '#18141E', shadow: false });
  sparkle(c, -12, -16, 4);
  sparkle(c, 14, -14, 3);
});

// ---------- boosts and warps ----------

/** Double income: two bolts on a purple disc. */
const shopBoost2 = sprite(BOX, (c) => {
  shape(c, path.circle(0, 0, 21), PURPLE);
  for (const dx of [-6, 6]) shape(c, path.poly([[dx + 3, -14], [dx - 7, 2], [dx - 1, 2], [dx - 4, 14], [dx + 7, -3], [dx + 1, -3]]), { light: '#FFFFE6', base: '#FFE14A', dark: '#E8920E', outline: 2, shadow: false });
});

/** x5 income: a rocket taking off. */
const shopBoost5 = sprite(BOX, (c) => {
  c.save();
  c.rotate(35, 0, 0);
  shape(c, path.smooth([[0, 18], [-8, 26], [0, 23], [8, 26]], true, 0.6), { light: '#FFFFE6', base: '#FFB020', dark: '#E2401A', outline: 1.8, shadow: false });
  for (const sx of [-1, 1]) shape(c, path.poly([[sx * 6, 4], [sx * 13, 16], [sx * 6, 14]]), { ...RED, shadow: false, outline: 2 });
  shape(c, path.smooth([[0, -24], [8, -10], [8, 14], [-8, 14], [-8, -10]], true, 0.5), { light: '#FFFFFF', base: '#E8ECF4', dark: '#9AA6BA' });
  shape(c, path.smooth([[0, -24], [6, -14], [-6, -14]], true, 0.6), { ...RED, shadow: false, outline: 2 });
  shape(c, path.circle(0, -3, 4.4), { ...BLUE, outline: 2, shadow: false });
  c.restore();
});

/** A time warp: an hourglass, gold sand running. */
const shopWarp1 = sprite(BOX, (c) => {
  shape(c, path.smooth([[-12, -17], [12, -17], [10, -8], [2, 0], [10, 8], [12, 17], [-12, 17], [-10, 8], [-2, 0], [-10, -8]], true, 0.35), { light: '#FFFFFF', base: '#D8F2FF', dark: '#8AB8D8', gloss: 0.4 });
  shape(c, path.smooth([[-8, -10], [8, -10], [2, -3], [-2, -3]], true, 0.4), { ...GOLD, outline: 0, shadow: false, gloss: 0 });
  shape(c, path.smooth([[-9, 15], [-6, 8], [0, 5], [6, 8], [9, 15]], true, 0.5), { ...GOLD, outline: 0, shadow: false, gloss: 0 });
  c.drawLine(0, -2, 0, 7, stroke('#E2A11C', 1.4));
  for (const y of [-21, 17]) shape(c, path.rrect(-16, y, 32, 5, 2.5), WOOD);
});

/** A bigger warp: a clock face with fast-forward arrows. */
const shopWarp4 = sprite(BOX, (c) => {
  shape(c, path.circle(-3, 0, 19), BLUE);
  shape(c, path.circle(-3, 0, 14), { ...CREAM, outline: 2, shadow: false, gloss: 0.15 });
  inkLine(c, path.polyline([[-3, 0], [-3, -9]]), '#2A1530', 1.6);
  inkLine(c, path.polyline([[-3, 0], [4, 4]]), '#E2333A', 1.6);
  for (const dx of [10, 18]) shape(c, path.poly([[dx - 6, -8], [dx + 3, 0], [dx - 6, 8]]), { ...GREEN, outline: 2, shadow: false });
});

// ---------- perks and crews ----------

/** The golden menu: a cream card in a gold frame. */
const shopMenu = sprite(BOX, (c) => {
  shape(c, path.rrect(-15, -21, 30, 42, 4), GOLD);
  shape(c, path.rrect(-11, -17, 22, 34, 2.5), { ...CREAM, outline: 1.6, shadow: false, gloss: 0.1 });
  goldStar(c, 0, -10, 4.6, 1.4);
  for (let i = 0; i < 4; i++) c.drawLine(-7, -1 + i * 5, 7 - (i % 2) * 4, -1 + i * 5, stroke('#B8905A', 1.6));
});

/** The VIP sign: a gold star on a red rosette with tails. */
const shopVip = sprite(BOX, (c) => {
  for (const sx of [-1, 1]) shape(c, path.poly([[sx * 3, 4], [sx * 13, 22], [sx * 7, 18], [sx * 4, 24], [sx * -2, 6]]), { ...RED, shadow: false, outline: 2 });
  const petals: Pt[] = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 ? 15 : 18;
    return [Math.cos(a) * r, -4 + Math.sin(a) * r] as Pt;
  });
  shape(c, path.poly(petals), RED);
  goldStar(c, 0, -4, 10, 2);
});

/** The turbo kitchen: a pan over a big flame. */
const shopTurbo = sprite(BOX, (c) => {
  // Flames licking the pan's bottom, the middle one tallest.
  for (const [dx, h] of [[-11, 13], [0, 18], [11, 13]] as const) shape(c, path.smooth([[dx, 4 - h * 0.2], [dx + 6, 10], [dx + 4, 20], [dx - 4, 20], [dx - 6, 10]], true, 0.9), { light: '#FFE14A', base: '#FF7A1A', dark: '#C8280A', outline: 1.8, shadow: false });
  inkLine(c, path.polyline([[12, -4], [24, -12]]), '#3A3446', 3.4);
  shape(c, path.smooth([[-20, -8], [16, -8], [13, 3], [-17, 3]], true, 0.6), { light: '#8A8698', base: '#3A3446', dark: '#18141E' });
  shape(c, path.oval(-2, -8, 18, 4), { light: '#6A6078', base: '#2E2838', dark: '#18141E', shadow: false, outline: 2 });
  sparkle(c, -12, -9, 2.6);
});

/** Charm school: a bouquet of three flowers in a paper wrap. */
const shopBouquet = sprite(BOX, (c) => {
  for (const [x, y, r] of [[-9, -10, 3], [9, -11, 3], [0, -4, 3]] as const) c.drawLine(x, y, 0, 12, stroke('#2E7A2A', 2.4));
  shape(c, path.poly([[-14, 2], [14, 2], [5, 23], [-5, 23]]), { light: '#FFFFFF', base: '#FCE4EC', dark: '#C9A0B8' });
  const flower = (x: number, y: number, look: Look) => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      shape(c, path.circle(x + Math.cos(a) * 4.6, y + Math.sin(a) * 4.6, 4), { ...look, outline: 1.6, shadow: false, gloss: 0.2 });
    }
    shape(c, path.circle(x, y, 3), { ...GOLD, outline: 1.4, shadow: false });
  };
  flower(-9, -12, { light: '#FFC6D8', base: '#FF6A9A', dark: '#B8245A' });
  flower(9, -13, { light: '#FFE6A8', base: '#FFC23A', dark: '#C87A0C' });
  flower(0, -4, RED);
});

/** Another crew: a yellow hard hat. */
const shopHardhat = sprite(BOX, (c) => {
  shape(c, path.rrect(-22, 6, 44, 7, 3.5), { light: '#FFF4A0', base: '#FFC21A', dark: '#C87A0C' });
  shape(c, path.smooth([[-17, 8], [-16, -6], [-7, -15], [7, -15], [16, -6], [17, 8]], true, 0.6), { light: '#FFF6B0', base: '#FFC93A', dark: '#C77A0C' });
  shape(c, path.rrect(-3, -16, 6, 23, 2), { light: '#FFF4A0', base: '#F2B21C', dark: '#B8700A', outline: 1.6, shadow: false, gloss: 0 });
});

/** Two crews more: a crane's hook on its cable. */
const shopCrane = sprite(BOX, (c) => {
  shape(c, path.rrect(-22, -21, 44, 7, 2), { light: '#FFF4A0', base: '#FFC21A', dark: '#C87A0C' });
  for (let x = -18; x < 20; x += 7) c.drawLine(x, -20, x + 5, -15, stroke('#8A5A0C', 1.4));
  c.drawLine(4, -14, 4, 0, stroke(EDGE, 3.4));
  c.drawLine(4, -14, 4, 0, stroke('#9AA6BA', 1.6));
  shape(c, path.rrect(-2, -2, 12, 8, 2), STEEL);
  inkLine(c, path.smooth([[4, 6], [4, 14], [0, 21], [-7, 19], [-8, 13]], false, 0.8), '#C9D2DE', 3.4);
});

/** A star worker: a gold star on a blue badge. */
const shopStaff = sprite(BOX, (c) => {
  shape(c, path.circle(0, 0, 20), BLUE);
  goldStar(c, 0, 1, 14, 2.2);
});

/** The shop's coins tab: a few coins. */
const shopCoinsTab = sprite(BOX, (c) => {
  coin(c, -7, 4, 12);
  coin(c, 8, -3, 12);
});

export const shopIcons = {
  shopGems1,
  shopGems2,
  shopGems3,
  shopGems4,
  shopCoins1,
  shopCoins2,
  shopCoins3,
  shopBoost2,
  shopBoost5,
  shopWarp1,
  shopWarp4,
  shopMenu,
  shopVip,
  shopTurbo,
  shopBouquet,
  shopHardhat,
  shopCrane,
  shopStaff,
  shopCoinsTab,
};

export { linear };
