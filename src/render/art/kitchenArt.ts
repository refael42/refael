import { Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';
import { sprite, type SpriteDef } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onFaceX, onFaceY, onTop, P, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';
import { GOLD, looks } from './stationArt';

// The kitchen (owner M29: "throw out that ugly kitchen, a huge one, Michelin level, an open
// kitchen; animations for everything"). Each kind of station is a one-tile module in four looks
// that follow the kitchen's upgrade: brushed steel, then chrome and brass, then racing-green
// enamel under copper, then black and gold. The cook stands on the -x side (facing the room),
// so the +x face is the side the guests see. The renderer adds what moves (src/render/draw/drawKitchen.ts).

const COPPER = '#C47A3A';

interface Finish {
  body: string;
  panel: string;
  trim: string | null;
  top: string;
  kick: string;
  knob: string;
  hood: string;
}

const FINISH: readonly Finish[] = [
  { body: '#B6BFC9', panel: '#C7CFD8', trim: null, top: '#DCE2E8', kick: '#5E6878', knob: '#2B2F38', hood: '#C4CDD8' },
  { body: '#C2CBD6', panel: '#D2D9E1', trim: GOLD, top: '#E6EBF0', kick: '#4A505C', knob: GOLD, hood: '#D2D9E1' },
  { body: '#1F5E4A', panel: '#256C56', trim: GOLD, top: '#E4E9EE', kick: '#163F33', knob: GOLD, hood: COPPER },
  { body: '#1E1C24', panel: '#2B2833', trim: GOLD, top: '#3A3646', kick: '#121016', knob: GOLD, hood: '#2B2833' },
];

/** A round dot of `r` px on a face plane (its `a` runs in tiles, `b` in px: a plain circle would come out 32 times too wide). */
function dot(c: SkCanvas, a: number, b: number, r: number, color: string) {
  c.drawOval(Skia.XYWHRect(a - r / 32, b - r, (r * 2) / 32, r * 2), fill(color));
}

/** Counter top height (px): where food and plates sit (the renderer uses the same). */
export const STATION_TOP = 22.5;

/** The cabinet every station stands on: plinth, doors facing the room, a rail, the top slab. */
function cabinet(c: SkCanvas, t: number, topColor?: string) {
  const f = FINISH[t]!;
  floorShadow(c, 0.06, 0, 0.62, 0.3);
  box(c, { x: 0, y: 0, w: 0.9, d: 0.92, h: 3, color: f.kick });
  box(c, { x: 0, y: 0, z: 3, w: 0.92, d: 0.94, h: 17, color: f.body, rim: true });
  onFaceX(c, 0.46, 0.47, () => {
    // Two doors with handles, a brass rail across them from the second look on.
    rectIn(c, 0.06, 5, 0.38, 12, f.panel);
    rectIn(c, 0.5, 5, 0.38, 12, f.panel);
    rectIn(c, 0.4, 9, 0.025, 4, f.knob);
    rectIn(c, 0.52, 9, 0.025, 4, f.knob);
    if (f.trim) rectIn(c, 0.02, 17.6, 0.9, 1, f.trim);
  });
  onFaceY(c, 0.47, -0.46, () => rectIn(c, 0.06, 5, 0.8, 12, darken(f.panel, 0.04)));
  if (f.trim) box(c, { x: 0, y: 0, z: 19.4, w: 0.95, d: 0.97, h: 0.8, color: f.trim });
  box(c, { x: 0, y: 0, z: 20.2, w: 0.94, d: 0.96, h: 2.3, color: topColor ?? f.top, rim: true });
}

/**
 * The extraction hood over a hot station: a slim brushed-steel canopy hanging on a thin duct,
 * high above the cooks' heads. It is see-through enough that the cooks on the line behind it
 * stay in view (an open kitchen is there to be watched); warm lamps under its lip.
 */
function hood(c: SkCanvas, t: number) {
  const f = FINISH[t]!;
  const z = 76;
  // Steel in every look (a copper or black box overhead read as furniture floating in the air); the look's trim on the lip.
  const steel = t === 3 ? '#4A4756' : '#B9C3CE';
  // The lamps' warm light falling on the station.
  const glow = Skia.Paint();
  glow.setAntiAlias(true);
  const [gx, gy] = P(0, 0, z);
  const [bx, by] = P(0, 0, STATION_TOP + 2);
  glow.setShader(Skia.Shader.MakeLinearGradient(vec(gx, gy), vec(bx, by), [Skia.Color('rgba(255,214,140,0.12)'), Skia.Color('rgba(255,214,140,0.02)')], null, TileMode.Clamp));
  c.drawPath(path.poly([P(0.3, -0.4, z), P(0.3, 0.4, z), P(0.42, 0.46, STATION_TOP + 2), P(0.42, -0.46, STATION_TOP + 2)]), glow);
  // The duct up to the ceiling, then the canopy (a short body over a wider lip).
  box(c, { x: -0.08, y: 0, z: z + 7, w: 0.14, d: 0.2, h: 26, color: darken(steel, 0.05), alpha: 0.7 });
  box(c, { x: -0.04, y: 0, z: z + 3, w: 0.56, d: 0.72, h: 4, color: steel, alpha: 0.62, rim: true });
  box(c, { x: -0.02, y: 0, z, w: 0.72, d: 0.94, h: 3, color: darken(steel, 0.1), alpha: 0.7, rim: true });
  // The trim as a band on the lip's faces (a box of it would lay its top over the whole canopy).
  const trim = f.trim ? (t === 2 ? COPPER : f.trim) : null;
  onFaceX(c, 0.34, 0.47, () => {
    if (trim) rectIn(c, 0, z + 2.2, 0.94, 0.8, trim);
    for (const a of [0.22, 0.48, 0.74]) dot(c, a, z + 1.2, 1.2, '#FFE9A8');
  });
  if (trim) onFaceY(c, 0.47, -0.38, () => rectIn(c, 0, z + 2.2, 0.72, 0.8, trim));
}

/** Knobs along the front (the guests' side). */
function knobs(c: SkCanvas, t: number, n: number, b = 14.5) {
  const f = FINISH[t]!;
  onFaceX(c, 0.46, 0.47, () => {
    for (let i = 0; i < n; i++) {
      const a = 0.12 + (i * 0.7) / Math.max(1, n - 1);
      dot(c, a, b, 1.5, f.knob);
      dot(c, a, b, 0.7, lighten(f.knob, 0.4));
    }
  });
}

// ---------- the deep fryer: two oil wells, baskets hanging, handles toward the cook ----------

function fryer(c: SkCanvas, t: number) {
  cabinet(c, t);
  onTop(c, STATION_TOP, () => {
    for (const y of [-0.42, 0.04]) {
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.36, y, 0.74, 0.38), 0.04, 0.04), fill('#2B2F38'));
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.32, y + 0.04, 0.66, 0.3), 0.03, 0.03), fill('#C98A2A'));
      c.drawRect(Skia.XYWHRect(-0.28, y + 0.08, 0.5, 0.06), fill('#E8B44A', 0.6));
    }
  });
  // The baskets rest on their hooks (the renderer lowers one into the oil while it cooks).
  for (const y of [-0.23, 0.23]) {
    box(c, { x: -0.1, y, z: STATION_TOP + 6, w: 0.42, d: 0.28, h: 5, color: '#9AA6B4', alpha: 0.85 });
    box(c, { x: -0.38, y, z: STATION_TOP + 9, w: 0.2, d: 0.04, h: 1.2, color: '#2B2F38' });
  }
  knobs(c, t, 2);
  hood(c, t);
}

// ---------- the plancha: a polished steel griddle ----------

function plancha(c: SkCanvas, t: number) {
  cabinet(c, t);
  box(c, { x: 0.02, y: 0, z: STATION_TOP, w: 0.84, d: 0.88, h: 1.4, color: '#4F555E', rim: true });
  onTop(c, STATION_TOP + 1.4, () => {
    c.drawRect(Skia.XYWHRect(-0.38, -0.4, 0.78, 0.82), fill('#5C626C'));
    // The sheen of a seasoned plate, and the grease trough on the cook's side.
    c.drawRect(Skia.XYWHRect(-0.1, -0.36, 0.06, 0.74), fill('#8A929C', 0.35));
    c.drawRect(Skia.XYWHRect(0.12, -0.36, 0.03, 0.74), fill('#8A929C', 0.25));
    c.drawRect(Skia.XYWHRect(-0.42, -0.4, 0.05, 0.82), fill('#2B2F38'));
  });
  // A low guard on the guests' side.
  box(c, { x: 0.44, y: 0, z: STATION_TOP, w: 0.04, d: 0.9, h: 5, color: t >= 1 ? GOLD : '#C9D1D9' });
  knobs(c, t, 3);
  hood(c, t);
}

// ---------- the cold line: a chilled rail of ingredients under a sneeze guard ----------

const MISE = ['#E5483B', '#7BC67E', '#F2C14E', '#F4EEE2', '#3A3646', '#F28A12'] as const;

function coldLine(c: SkCanvas, t: number) {
  cabinet(c, t);
  onTop(c, STATION_TOP, () => {
    c.drawRect(Skia.XYWHRect(-0.4, -0.42, 0.62, 0.84), fill('#8FA3B4'));
    MISE.forEach((col, i) => {
      const x = -0.37 + (i % 2) * 0.3;
      const y = -0.39 + Math.floor(i / 2) * 0.27;
      c.drawRect(Skia.XYWHRect(x, y, 0.26, 0.24), fill('#DDE3E8'));
      c.drawRect(Skia.XYWHRect(x + 0.025, y + 0.025, 0.21, 0.19), fill(col));
      // A few highlights so the bins read as food, not paint.
      c.drawCircle(x + 0.08, y + 0.08, 0.025, fill(lighten(col, 0.35)));
      c.drawCircle(x + 0.16, y + 0.14, 0.02, fill(darken(col, 0.2)));
    });
    // The cutting board on the cook's side.
    c.drawRect(Skia.XYWHRect(0.25, -0.38, 0.17, 0.76), fill('#E8C99A'));
  });
  // The sneeze guard: glass on two posts on the guests' side.
  for (const y of [-0.42, 0.42]) box(c, { x: 0.42, y, z: STATION_TOP, w: 0.03, d: 0.03, h: 15, color: t >= 1 ? GOLD : '#C9D1D9' });
  box(c, { x: 0.36, y: 0, z: STATION_TOP + 14, w: 0.2, d: 0.88, h: 1.2, color: '#BFE3FF', alpha: 0.45, rim: true });
}

// ---------- the range: four burners, a stock pot and a pan; an oven below ----------

function range(c: SkCanvas, t: number) {
  cabinet(c, t);
  onFaceX(c, 0.46, 0.47, () => {
    const f = FINISH[t]!;
    rectIn(c, 0.12, 4.5, 0.7, 8.5, '#2B2F38');
    rectIn(c, 0.2, 6, 0.54, 5.5, '#3D4452');
    rectIn(c, 0.14, 13.2, 0.66, 0.8, f.trim ?? '#E9EEF3');
  });
  onTop(c, STATION_TOP, () => {
    for (const [x, y] of [[-0.2, -0.22], [0.2, -0.22], [-0.2, 0.22], [0.2, 0.22]] as const) {
      c.drawCircle(x, y, 0.15, fill('#2B2F38'));
      c.drawCircle(x, y, 0.1, stroke('#5E6878', 0.02));
      c.drawCircle(x, y, 0.04, fill('#5E6878'));
    }
  });
  // A copper or steel stock pot, its lid on, and a sauté pan.
  const potColor = t >= 2 ? COPPER : '#C9D1D9';
  cylinder(c, 0.2, -0.22, 0.15, STATION_TOP + 1, 13, potColor, lighten(potColor, 0.25));
  cylinder(c, 0.2, -0.22, 0.13, STATION_TOP + 14, 1.2, '#AEB8C4', '#DCE2E8');
  box(c, { x: 0.2, y: -0.22, z: STATION_TOP + 15, w: 0.04, d: 0.04, h: 2, color: '#2B2F38' });
  knobs(c, t, 4, 17.5);
  hood(c, t);
}

// ---------- the wok station: a roaring ring burner, the wok resting on it, a tap ----------

function wokStation(c: SkCanvas, t: number) {
  cabinet(c, t, '#C9D1D9');
  onTop(c, STATION_TOP, () => {
    c.drawCircle(0, 0.02, 0.36, fill('#2B2F38'));
    c.drawCircle(0, 0.02, 0.3, fill('#1A1C22'));
    c.drawCircle(0, 0.02, 0.12, stroke('#5E6878', 0.03));
    // The water trough behind (on the guests' side).
    c.drawRect(Skia.XYWHRect(0.3, -0.42, 0.12, 0.84), fill('#8FD0F0', 0.7));
  });
  // A gooseneck tap to rinse the wok between dishes.
  box(c, { x: 0.38, y: -0.38, z: STATION_TOP, w: 0.04, d: 0.04, h: 12, color: '#C9D1D9' });
  box(c, { x: 0.3, y: -0.38, z: STATION_TOP + 12, w: 0.18, d: 0.04, h: 1.4, color: '#C9D1D9' });
  knobs(c, t, 2);
  hood(c, t);
}

/** The wok resting on its burner when nobody cooks there (the cook takes it up while they do). */
const wokRest = sprite([-18, -14, 18, 6], (c) => {
  c.drawPath(path.smooth([[-14, -6], [-9, 2], [0, 4], [9, 2], [14, -6]], false), fill('#24262C'));
  c.drawOval(Skia.XYWHRect(-14, -9, 28, 7), fill('#3A3D46'));
  c.drawOval(Skia.XYWHRect(-11, -8, 22, 5), fill('#2B2D33'));
  c.drawRect(Skia.XYWHRect(-26, -9, 13, 2.4), fill('#5A3A24'));
});

// ---------- the pizza oven: a tiled dome on a stand, wood stacked beneath ----------

const DOME = ['#C4632E', '#EDE8E2', COPPER, '#24222C'] as const;

function oven(c: SkCanvas, t: number) {
  const f = FINISH[t]!;
  floorShadow(c, 0.06, 0, 0.66, 0.3);
  box(c, { x: 0, y: 0, w: 0.9, d: 0.92, h: 3, color: f.kick });
  box(c, { x: 0, y: 0, z: 3, w: 0.92, d: 0.94, h: 15, color: f.body, rim: true });
  onFaceX(c, 0.46, 0.47, () => {
    // Firewood stacked in the stand.
    rectIn(c, 0.08, 4.5, 0.76, 10, '#2A1A14');
    for (let i = 0; i < 9; i++) dot(c, 0.16 + (i % 3) * 0.26, 7 + Math.floor(i / 3) * 3, 1.6, i % 2 ? '#8A5A34' : '#A06A3C');
  });
  if (f.trim) box(c, { x: 0, y: 0, z: 17.4, w: 0.95, d: 0.97, h: 0.8, color: f.trim });
  box(c, { x: 0, y: 0, z: 18.2, w: 0.94, d: 0.96, h: 2.3, color: '#D9D2C6', rim: true });
  // The dome: a short drum and a cap, in brick, white tiles, copper or black mosaic.
  const dome = DOME[t]!;
  cylinder(c, 0, 0, 0.42, 20.5, 8, dome, dome);
  const [cx, cy] = P(0, 0, 28.5);
  const rx = Math.SQRT2 * 0.42 * 32;
  c.drawPath(path.smooth([[cx - rx, cy], [cx - rx * 0.7, cy - 11], [cx, cy - 16], [cx + rx * 0.7, cy - 11], [cx + rx, cy]], false), fill(lighten(dome, 0.06)));
  c.drawOval(Skia.XYWHRect(cx - rx, cy - 6, rx * 2, 12), fill(lighten(dome, 0.06)));
  // Mosaic dots on the fancier domes.
  if (t >= 1) for (let i = 0; i < 9; i++) c.drawCircle(cx - rx * 0.7 + (i % 5) * rx * 0.35, cy - 9 + Math.floor(i / 5) * 5 + (i % 2) * 1.5, 1.1, fill(t === 3 ? GOLD : darken(dome, 0.15)));
  // The mouth, toward the room (the renderer lights the fire inside).
  const [mx, my] = P(0.05, 0.4, 21.5);
  c.drawPath(path.smooth([[mx - 9, my], [mx - 8, my - 7], [mx - 1, my - 10.5], [mx + 6, my - 8], [mx + 7, my - 0.5]], true), fill('#1A0E0A'));
  c.drawPath(path.smooth([[mx - 10.5, my + 0.5], [mx - 9.5, my - 8], [mx - 1, my - 12.5], [mx + 7.5, my - 9], [mx + 8.5, my]], false), stroke(t === 3 ? GOLD : darken(dome, 0.3), 1.6));
  // The flue.
  cylinder(c, -0.1, 0, 0.07, 40, 30, t >= 2 ? COPPER : '#8F9AA8', '#2B2F38');
  cylinder(c, -0.1, 0, 0.1, 70, 2.4, f.trim ?? '#5E6878', f.trim ?? '#7E8A98');
}

// ---------- the sushi counter: hinoki wood, a glass case of fish toward the guests ----------

const NETA = ['#F28A5A', '#C8283A', '#F4E3B8', '#F2F0EA', '#F28A5A', '#C8283A'] as const;

function sushiBar(c: SkCanvas, t: number) {
  const f = FINISH[t]!;
  floorShadow(c, 0.06, 0, 0.62, 0.3);
  box(c, { x: 0, y: 0, w: 0.9, d: 0.92, h: 3, color: f.kick });
  // Pale wood all round (dark-stained in the last look).
  const wood = t === 3 ? '#3A2618' : '#D9B57E';
  box(c, { x: 0, y: 0, z: 3, w: 0.92, d: 0.94, h: 17, color: wood, rim: true });
  onFaceX(c, 0.46, 0.47, () => {
    for (let a = 0.08; a < 0.9; a += 0.15) rectIn(c, a, 4, 0.012, 14, darken(wood, 0.15));
    if (f.trim) rectIn(c, 0.02, 17.6, 0.9, 1, f.trim);
  });
  box(c, { x: 0, y: 0, z: 20.2, w: 0.96, d: 0.98, h: 2.3, color: lighten(wood, 0.25), rim: true });
  onTop(c, STATION_TOP, () => {
    // The big board, a bamboo mat and a finished roll.
    c.drawRect(Skia.XYWHRect(-0.42, -0.36, 0.4, 0.72), fill('#F2E2C4'));
    c.drawRect(Skia.XYWHRect(-0.38, 0.06, 0.26, 0.24), fill('#C8B07A'));
    for (let i = 0; i < 6; i++) c.drawRect(Skia.XYWHRect(-0.38 + i * 0.045, 0.06, 0.012, 0.24), fill('#A88E5A'));
  });
  // The glass case of neta on the guests' side.
  box(c, { x: 0.24, y: 0, z: STATION_TOP, w: 0.4, d: 0.9, h: 2, color: '#E4E9EE' });
  onTop(c, STATION_TOP + 2, () => {
    NETA.forEach((col, i) => {
      const y = -0.38 + i * 0.13;
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(0.08, y, 0.3, 0.1), 0.03, 0.03), fill(col));
      c.drawRect(Skia.XYWHRect(0.1, y + 0.03, 0.26, 0.012), fill(lighten(col, 0.45)));
    });
  });
  box(c, { x: 0.24, y: 0, z: STATION_TOP + 2, w: 0.42, d: 0.92, h: 9, color: '#BFE3FF', alpha: 0.3, rim: true });
  if (f.trim) box(c, { x: 0.24, y: 0, z: STATION_TOP + 11, w: 0.43, d: 0.93, h: 0.8, color: f.trim });
  // Soy and a sprig of green.
  cylinder(c, -0.3, -0.3, 0.035, STATION_TOP, 6, '#3A1A10', '#E5483B');
}

/** Station looks, `k<Kind><look>` (src/data/kitchen.ts order: fryer, plancha, cold line, range, wok, oven, sushi). */
export const STATION_SPRITES = ['kFryer', 'kPlancha', 'kCold', 'kRange', 'kWok', 'kOven', 'kSushi'] as const;
const TALL: readonly [number, number, number, number] = [-40, -128, 40, 18];
const LOW: readonly [number, number, number, number] = [-40, -64, 40, 18];
const stations = {
  ...looks('kFryer', TALL, fryer),
  ...looks('kPlancha', TALL, plancha),
  ...looks('kCold', LOW, coldLine),
  ...looks('kRange', TALL, range),
  ...looks('kWok', TALL, wokStation),
  ...looks('kOven', [-40, -112, 40, 18], oven),
  ...looks('kSushi', LOW, sushiBar),
};

// ---------- prep tables: the kitchen's busy steel (a board of vegetables, bowls, plates being dressed...) ----------

function prepBase(c: SkCanvas) {
  floorShadow(c, 0.06, 0, 0.62, 0.28);
  for (const [x, y] of [[-0.4, -0.42], [0.4, -0.42], [-0.4, 0.42], [0.4, 0.42]] as const) box(c, { x, y, w: 0.05, d: 0.05, h: 20, color: '#9AA6B4' });
  // The undershelf: bins and a stack of pans.
  box(c, { x: 0, y: 0, z: 5, w: 0.88, d: 0.9, h: 1.2, color: '#AEB8C4' });
  box(c, { x: -0.15, y: -0.2, z: 6.2, w: 0.34, d: 0.3, h: 6, color: '#E4E9EE' });
  box(c, { x: 0.18, y: 0.2, z: 6.2, w: 0.3, d: 0.36, h: 4, color: '#C9D1D9' });
  box(c, { x: 0, y: 0, z: 20, w: 0.94, d: 0.96, h: 2.5, color: '#DCE2E8', rim: true });
}

const PREPS: ((c: SkCanvas) => void)[] = [
  // A board of vegetables and a knife.
  (c) => {
    box(c, { x: 0, y: 0, z: STATION_TOP, w: 0.5, d: 0.7, h: 1.2, color: '#E8C99A' });
    for (const [x, y, col] of [[-0.1, -0.2, '#E5483B'], [0.08, -0.12, '#E5483B'], [-0.05, 0.12, '#7BC67E'], [0.1, 0.2, '#F28A12']] as const) cylinder(c, x, y, 0.06, STATION_TOP + 1.2, 3, col, lighten(col, 0.2));
    box(c, { x: 0.1, y: -0.32, z: STATION_TOP + 1.2, w: 0.04, d: 0.28, h: 0.6, color: '#E4E9EE' });
  },
  // Steel bowls and a whisk.
  (c) => {
    cylinder(c, -0.15, -0.15, 0.17, STATION_TOP, 5, '#C9D1D9', '#F4EEE2');
    cylinder(c, 0.18, 0.15, 0.13, STATION_TOP, 4, '#C9D1D9', '#F2C14E');
    box(c, { x: 0.18, y: -0.25, z: STATION_TOP, w: 0.04, d: 0.25, h: 1, color: '#9AA6B4' });
  },
  // Plates being dressed, squeeze bottles.
  (c) => {
    for (const [x, y] of [[-0.18, -0.2], [0.15, -0.15], [-0.05, 0.2]] as const) {
      cylinder(c, x, y, 0.15, STATION_TOP, 1.4, '#E4E9EE', '#FFFFFF');
      onTop(c, STATION_TOP + 1.4, () => {
        c.drawCircle(x, y, 0.05, fill('#C8283A'));
        c.drawCircle(x + 0.06, y - 0.03, 0.02, fill('#7BC67E'));
      });
    }
    for (const [y, col] of [[0.38, '#C8283A'], [0.28, '#F2C14E']] as const) cylinder(c, 0.32, y, 0.04, STATION_TOP, 8, col, '#F4EEE2');
  },
  // Herbs in pots.
  (c) => {
    for (const [x, y, col] of [[-0.18, -0.2, '#3FA65A'], [0.15, -0.05, '#2E8B47'], [-0.05, 0.22, '#4CBB66']] as const) {
      cylinder(c, x, y, 0.09, STATION_TOP, 5, '#C4632E', '#5A3A24');
      box(c, { x, y, z: STATION_TOP + 5, w: 0.16, d: 0.16, h: 6, color: col });
      box(c, { x: x + 0.02, y, z: STATION_TOP + 10, w: 0.08, d: 0.08, h: 3, color: lighten(col, 0.15) });
    }
  },
  // Dough, a rolling pin, flour.
  (c) => {
    onTop(c, STATION_TOP, () => c.drawOval(Skia.XYWHRect(-0.35, -0.3, 0.6, 0.55), fill('#FFFFFF', 0.55)));
    cylinder(c, -0.05, -0.02, 0.16, STATION_TOP, 4, '#F2E2C4', '#FBF2E0');
    box(c, { x: 0.22, y: 0.1, z: STATION_TOP, w: 0.1, d: 0.6, h: 2.2, color: '#C8914F' });
  },
  // Spice jars and a mortar.
  (c) => {
    ['#E5483B', '#F2C14E', '#7BC67E', '#8A5A34', '#F28A12'].forEach((col, i) => cylinder(c, -0.3 + i * 0.13, -0.3 + (i % 2) * 0.08, 0.05, STATION_TOP, 7, '#E4E9EE', col));
    cylinder(c, 0.12, 0.2, 0.12, STATION_TOP, 5, '#8F9AA8', '#5E6878');
    box(c, { x: 0.18, y: 0.2, z: STATION_TOP + 4, w: 0.04, d: 0.04, h: 7, color: '#6A4A2A' });
  },
];
const preps = Object.fromEntries(
  PREPS.map((draw, i) => [
    `prep${i}`,
    sprite([-40, -60, 40, 18], (c) => {
      prepBase(c);
      draw(c);
    }),
  ]),
) as Record<string, SpriteDef>;

// ---------- the back of the house (owner M29: "everything looks the same"): corners of a big kitchen ----------
// A big kitchen is more than a line: the stores, the walk-in fridges, the stock pots that
// simmer all day, the butchery, the pastry corner, the racks of trays. src/data/maps.ts lays
// them out by corner (four pieces that belong together); prep variants PREP_KINDS.. are these.

const POST = '#9AA6B4';

function shelfFrame(c: SkCanvas, h: number, levels: readonly number[], w = 0.5, d = 0.9) {
  floorShadow(c, 0.04, 0, 0.5, 0.26);
  for (const [x, y] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]] as const) box(c, { x, y, w: 0.04, d: 0.04, h, color: POST });
  for (const z of levels) box(c, { x: 0, y: 0, z, w: w + 0.04, d: d + 0.04, h: 1, color: '#C9D1D9' });
}

const BACK: { bounds: [number, number, number, number]; draw: (c: SkCanvas) => void }[] = [
  // Dry stores: a tall rack of crates, jars, tins and sacks of flour.
  {
    bounds: [-36, -88, 36, 16],
    draw: (c) => {
      shelfFrame(c, 54, [4, 20, 36, 52]);
      // Bottom: sacks of flour and rice.
      for (const [y, col] of [[-0.24, '#EFE6D2'], [0.2, '#E2D2B0']] as const) box(c, { x: 0, y, z: 5, w: 0.4, d: 0.36, h: 12, color: col, rim: true });
      // Crates of tomatoes, lemons, aubergines.
      [['#E5483B', -0.26], ['#F2D33B', 0.02], ['#6A3B7A', 0.3]].forEach(([col, y]) => {
        box(c, { x: 0, y: y as number, z: 21, w: 0.42, d: 0.26, h: 6, color: '#B88A52' });
        for (const dy of [-0.06, 0.06]) cylinder(c, 0, (y as number) + dy, 0.06, 27, 2.4, col as string, lighten(col as string, 0.2));
      });
      // Jars of pickles and preserves.
      ['#7BC67E', '#F28A12', '#C8283A', '#F2C14E', '#7BC67E'].forEach((col, i) => cylinder(c, 0, -0.34 + i * 0.17, 0.06, 37, 8, '#E4E9EE', col));
      // Tins on top.
      for (let i = 0; i < 4; i++) cylinder(c, 0, -0.3 + i * 0.2, 0.07, 53, 6, i % 2 ? '#C8283A' : '#3A6EA8', '#C9D1D9');
    },
  },
  // A reach-in fridge: double glass doors, the shelves of produce behind them.
  {
    bounds: [-38, -98, 38, 16],
    draw: (c) => {
      floorShadow(c, 0.04, 0, 0.56, 0.3);
      box(c, { x: 0, y: 0, w: 0.72, d: 0.9, h: 3, color: '#4A505C' });
      box(c, { x: 0, y: 0, z: 3, w: 0.72, d: 0.9, h: 58, color: '#C2CBD6', rim: true });
      onFaceX(c, 0.36, 0.45, () => {
        for (const a of [0.04, 0.46]) {
          rectIn(c, a, 6, 0.4, 50, '#2B3A48');
          // Shelves of produce and bottles behind the glass.
          for (const [b, cols] of [[10, ['#7BC67E', '#E5483B', '#F2D33B']], [22, ['#F4EEE2', '#C8283A', '#7BC67E']], [34, ['#F28A12', '#F4EEE2', '#3FA65A']], [46, ['#E5483B', '#F2C14E', '#F4EEE2']]] as const) {
            rectIn(c, a + 0.02, b - 1, 0.36, 0.8, '#8F9AA8');
            cols.forEach((col, i) => rectIn(c, a + 0.04 + i * 0.12, b, 0.09, 5, col));
          }
          rectIn(c, a, 6, 0.4, 50, '#BFE6F5', 0.22);
          rectIn(c, a + 0.03, 8, 0.03, 46, '#FFFFFF', 0.35);
        }
        rectIn(c, 0.42, 26, 0.02, 12, '#2B2F38');
        rectIn(c, 0.48, 26, 0.02, 12, '#2B2F38');
        // The temperature display, in green.
        rectIn(c, 0.7, 57.2, 0.14, 2.6, '#14231A');
        rectIn(c, 0.72, 57.8, 0.08, 1.4, '#59E07A');
      });
      // The compressor grille on top.
      box(c, { x: 0, y: 0, z: 61, w: 0.6, d: 0.82, h: 3, color: '#8F9AA8' });
    },
  },
  // Stock pots: a low burner with a huge pot simmering all day (the renderer adds the steam), its lid ajar, a ladle in it.
  {
    bounds: [-38, -64, 38, 16],
    draw: (c) => {
      floorShadow(c, 0.06, 0, 0.6, 0.3);
      box(c, { x: 0, y: 0, w: 0.86, d: 0.9, h: 12, color: '#3A3D46', rim: true });
      onFaceX(c, 0.43, 0.45, () => {
        dot(c, 0.25, 6, 1.6, '#C9D1D9');
        dot(c, 0.65, 6, 1.6, '#C9D1D9');
      });
      onTop(c, 12, () => c.drawCircle(0, 0, 0.36, fill('#1A1B20')));
      cylinder(c, 0, 0, 0.34, 13, 26, '#B9C3CE', '#6B4A2A');
      cylinder(c, 0, 0, 0.35, 34, 1.4, '#9AA6B4', '#6B4A2A');
      // The lid leaning against the pot, the ladle's handle over the rim.
      box(c, { x: 0.2, y: 0.3, z: 39, w: 0.04, d: 0.04, h: 10, color: '#8F9AA8' });
      cylinder(c, 0.2, 0.3, 0.05, 48, 2, '#8F9AA8', '#C9D1D9');
    },
  },
  // The butchery: an end-grain block, a cleaver, a side of meat; hams on a rail above.
  {
    bounds: [-38, -92, 38, 16],
    draw: (c) => {
      floorShadow(c, 0.06, 0, 0.6, 0.3);
      for (const [x, y] of [[-0.36, -0.38], [0.36, -0.38], [-0.36, 0.38], [0.36, 0.38]] as const) box(c, { x, y, w: 0.08, d: 0.08, h: 12, color: '#6A4A2A' });
      box(c, { x: 0, y: 0, z: 12, w: 0.86, d: 0.9, h: 10, color: '#B07A44', rim: true });
      onTop(c, 22, () => {
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) c.drawRect(Skia.XYWHRect(-0.42 + i * 0.14, -0.44 + j * 0.147, 0.14, 0.147), fill('#9E6A38', 0.6));
        // A side of meat with its fat cap, the cleaver beside it.
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.3, -0.3, 0.4, 0.34), 0.1, 0.1), fill('#B8323A'));
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-0.3, -0.3, 0.4, 0.07), 0.04, 0.04), fill('#F4E3D0'));
        c.drawRect(Skia.XYWHRect(0.1, 0.12, 0.22, 0.14), fill('#D9DEE4'));
        c.drawRect(Skia.XYWHRect(0.32, 0.17, 0.12, 0.04), fill('#2B2F38'));
      });
      // The rail above, with hams hanging from it.
      for (const y of [-0.42, 0.42]) box(c, { x: -0.4, y, w: 0.04, d: 0.04, h: 64, color: POST });
      box(c, { x: -0.4, y: 0, z: 62, w: 0.04, d: 0.9, h: 1.4, color: '#C9D1D9' });
      for (const y of [-0.24, 0.02, 0.26]) {
        box(c, { x: -0.4, y, z: 56, w: 0.01, d: 0.01, h: 6, color: '#5E6878' });
        cylinder(c, -0.4, y, 0.07, 42, 14, '#9A4A2A', '#B8603A');
      }
    },
  },
  // Pastry: a marble table, a stand mixer at work (the renderer spins it), a cake on its stand.
  {
    bounds: [-40, -66, 40, 18],
    draw: (c) => {
      floorShadow(c, 0.06, 0, 0.62, 0.28);
      for (const [x, y] of [[-0.4, -0.42], [0.4, -0.42], [-0.4, 0.42], [0.4, 0.42]] as const) box(c, { x, y, w: 0.05, d: 0.05, h: 20, color: '#9AA6B4' });
      box(c, { x: 0, y: 0, z: 5, w: 0.88, d: 0.9, h: 1.2, color: '#AEB8C4' });
      box(c, { x: 0, y: 0, z: 20, w: 0.94, d: 0.96, h: 2.5, color: '#F2F0EA', rim: true });
      onTop(c, STATION_TOP, () => {
        c.drawLine(-0.4, -0.3, 0.1, 0.2, stroke('#C9C4BC', 0.02));
        c.drawLine(-0.1, -0.44, 0.4, 0.1, stroke('#C9C4BC', 0.015));
      });
      // The mixer: base, column, head, the bowl.
      box(c, { x: -0.18, y: -0.2, z: STATION_TOP, w: 0.34, d: 0.24, h: 2, color: '#E85A8A', rim: true });
      box(c, { x: -0.3, y: -0.2, z: STATION_TOP + 2, w: 0.1, d: 0.14, h: 14, color: '#E85A8A' });
      box(c, { x: -0.18, y: -0.2, z: STATION_TOP + 14, w: 0.34, d: 0.16, h: 5, color: '#F07AA0', rim: true });
      cylinder(c, -0.12, -0.2, 0.12, STATION_TOP + 2, 7, '#C9D1D9', '#FBF2E0');
      // The cake.
      cylinder(c, 0.18, 0.2, 0.04, STATION_TOP, 4, '#E4E9EE', '#E4E9EE');
      cylinder(c, 0.18, 0.2, 0.16, STATION_TOP + 4, 1, '#E4E9EE', '#FFFFFF');
      cylinder(c, 0.18, 0.2, 0.13, STATION_TOP + 5, 7, '#6A3B2A', '#F4EEE2');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        cylinder(c, 0.18 + Math.cos(a) * 0.08, 0.2 + Math.sin(a) * 0.08, 0.02, STATION_TOP + 12, 1.4, '#C8283A', '#E5483B');
      }
    },
  },
  // A speed rack on wheels: trays of bread, croissants and macarons cooling.
  {
    bounds: [-34, -92, 34, 16],
    draw: (c) => {
      const levels = [6, 14, 22, 30, 38, 46, 54];
      shelfFrame(c, 58, [], 0.56, 0.86);
      levels.forEach((z, i) => {
        box(c, { x: 0, y: 0, z, w: 0.58, d: 0.82, h: 0.8, color: '#B9C3CE' });
        if (i === 6) return;
        const kind = i % 3;
        for (let k = 0; k < 4; k++) {
          const y = -0.3 + k * 0.2;
          if (kind === 0) box(c, { x: 0, y, z: z + 0.8, w: 0.3, d: 0.14, h: 3, color: '#C98A3A', rim: true });
          else if (kind === 1) cylinder(c, 0, y, 0.07, z + 0.8, 2.6, '#D99A4A', '#E8B45A');
          else cylinder(c, 0, y, 0.06, z + 0.8, 2.6, ['#F4A6C0', '#B8E0A0', '#C8B0F0', '#F8D880'][k]!, ['#F4A6C0', '#B8E0A0', '#C8B0F0', '#F8D880'][k]!);
        }
      });
      for (const [x, y] of [[-0.28, -0.43], [0.28, -0.43], [-0.28, 0.43], [0.28, 0.43]] as const) cylinder(c, x, y, 0.04, 0, 2, '#2B2F38', '#5E6878');
    },
  },
];
const backs = Object.fromEntries(BACK.map((b, i) => [`back${i}`, sprite(b.bounds, b.draw)])) as Record<string, SpriteDef>;

// ---------- the cooks' tools (held) ----------

const basket = sprite([-12, -12, 14, 6], (c) => {
  c.drawRect(Skia.XYWHRect(-3, -8, 13, 9), fill('#9AA6B4', 0.85));
  for (let x = -2; x < 10; x += 2.4) c.drawLine(x, -8, x, 1, stroke('#5E6878', 0.5));
  for (let y = -6; y < 1; y += 2.4) c.drawLine(-3, y, 10, y, stroke('#5E6878', 0.5));
  c.drawRect(Skia.XYWHRect(-12, -7, 10, 2), fill('#2B2F38'));
});
const wokHeld = sprite([-22, -12, 16, 8], (c) => {
  c.drawPath(path.smooth([[-10, -5], [-6, 3], [2, 5], [10, 3], [14, -5]], false), fill('#24262C'));
  c.drawOval(Skia.XYWHRect(-10, -8, 24, 6.5), fill('#3A3D46'));
  c.drawOval(Skia.XYWHRect(-7.5, -7, 19, 4.5), fill('#1E2026'));
  c.drawRect(Skia.XYWHRect(-21, -7, 12, 2.4), fill('#5A3A24'));
});
const knife = sprite([-14, -6, 12, 4], (c) => {
  c.drawPath(path.poly([[-2, -1.2], [11, -1.8], [11.5, -0.6], [-2, 0.8]]), fill('#E4E9EE'));
  c.drawLine(-2, -1.1, 11, -1.7, stroke('#FFFFFF', 0.5));
  c.drawRect(Skia.XYWHRect(-10, -1.6, 8, 2.6), fill('#6A4A2A'));
});
const bowl = sprite([-10, -12, 10, 4], (c) => {
  c.drawPath(path.smooth([[-9, -5], [-6, 2], [0, 3.5], [6, 2], [9, -5]], false), fill('#C9D1D9'));
  c.drawOval(Skia.XYWHRect(-9, -7, 18, 4), fill('#AEB8C4'));
  for (const [x, col] of [[-5, '#7BC67E'], [-1, '#3FA65A'], [3, '#E5483B'], [6, '#7BC67E']] as const) c.drawCircle(x, -6, 2.2, fill(col));
});
const ladle = sprite([-8, -18, 8, 4], (c) => {
  c.drawLine(-1, -16, 0, -2, stroke('#AEB8C4', 1.4));
  c.drawOval(Skia.XYWHRect(-4, -3, 8, 4.5), fill('#C9D1D9'));
});
const peel = sprite([-22, -8, 18, 6], (c) => {
  c.drawRect(Skia.XYWHRect(-21, -2.4, 18, 2.4), fill('#A87A4A'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-4, -5.5, 18, 9), 3, 3), fill('#C8914F'));
  c.drawOval(Skia.XYWHRect(-2, -4.6, 14, 7), fill('#E9B04A'));
  c.drawOval(Skia.XYWHRect(-0.5, -3.8, 11, 5.4), fill('#D8402C'));
  for (const [x, y] of [[2, -2], [6, -0.5], [8, -2.5]] as const) c.drawCircle(x, y, 1, fill('#F4EEE2'));
});
const tweezers = sprite([-8, -10, 8, 3], (c) => {
  c.drawLine(-1, -9, 1.4, 1, stroke(GOLD, 0.9));
  c.drawLine(1, -9, 1.8, 1, stroke(GOLD, 0.9));
});

// ---------- what cooks on the stations (by dish, src/data/dishes.ts order) and what flies ----------

const fryBits = (c: SkCanvas, col: string, n: number) => {
  for (let i = 0; i < n; i++) c.drawRect(Skia.XYWHRect(-6 + (i % 5) * 2.6, -6 - (i % 3) * 1.4, 1.4, 6), fill(i % 2 ? col : lighten(col, 0.15)));
};
const COOKING: ((c: SkCanvas) => void)[] = [
  // Fries.
  (c) => fryBits(c, '#F2C14E', 10),
  // Burger patty.
  (c) => cylinder(c, 0, 0, 0.11, 0, 2.4, '#7A4128', '#94552F'),
  // Falafel balls.
  (c) => {
    for (const [x, y] of [[-4, 0], [0, -2], [4, 0], [-2, 2], [2, 2]] as const) c.drawCircle(x, y - 3, 2.4, fill('#8A5A24'));
  },
  // Shawarma: strips of meat and onion.
  (c) => {
    for (let i = 0; i < 6; i++) c.drawRect(Skia.XYWHRect(-7 + i * 2.2, -3 - (i % 2), 2, 4), fill(i % 3 === 2 ? '#F4EEE2' : '#A0582A'));
  },
  // Hummus: a bowl, swirled, with oil.
  (c) => {
    cylinder(c, 0, 0, 0.15, 0, 2.5, '#E4E9EE', '#E8D4A2');
    c.drawCircle(0, -3.2, 1.6, fill('#C8A040'));
  },
  // Schnitzel: a golden cutlet.
  (c) => c.drawOval(Skia.XYWHRect(-8, -5, 16, 7), fill('#D9962E')),
  // Shakshuka: a red pan with eggs.
  (c) => {
    cylinder(c, 0, 0, 0.17, 0, 2.5, '#2A2730', '#C8381E');
    for (const [x, y] of [[-3, -3], [3, -2.5], [0, -4.5]] as const) {
      c.drawCircle(x, y, 2, fill('#FFFFFF'));
      c.drawCircle(x, y, 0.9, fill('#F2B02A'));
    }
  },
  // Ice cream: scoops in a coupe.
  (c) => {
    cylinder(c, 0, 0, 0.1, 0, 2, '#BFE3FF', '#E4F4FF');
    c.drawCircle(-2, -5, 2.6, fill('#F6B4C8'));
    c.drawCircle(2, -5, 2.6, fill('#FFF4D8'));
    c.drawCircle(0, -7.5, 2.6, fill('#7A4A2A'));
  },
  // Pizza.
  (c) => {
    c.drawOval(Skia.XYWHRect(-9, -5, 18, 9), fill('#E9B04A'));
    c.drawOval(Skia.XYWHRect(-7.5, -4.2, 15, 7.4), fill('#D8402C'));
    for (const [x, y] of [[-3, -1], [2, -2], [3, 1]] as const) c.drawCircle(x, y, 1.2, fill('#F4EEE2'));
  },
  // Sushi: a roll being cut.
  (c) => {
    for (let i = 0; i < 4; i++) {
      c.drawCircle(-6 + i * 4, -2, 2.2, fill('#1E2A20'));
      c.drawCircle(-6 + i * 4, -2.4, 1.6, fill('#F4F0E8'));
      c.drawCircle(-6 + i * 4, -2.4, 0.7, fill('#F28A5A'));
    }
  },
  // Steak.
  (c) => {
    c.drawOval(Skia.XYWHRect(-8, -5, 16, 8), fill('#6A2A1A'));
    for (let i = 0; i < 3; i++) c.drawLine(-5 + i * 4, -4, -2 + i * 4, 2, stroke('#2A1008', 1));
  },
  // Cake, rising.
  (c) => {
    cylinder(c, 0, 0, 0.14, 0, 5, '#E8B47A', '#F4DCA8');
  },
  // Lobster in its pot.
  (c) => {
    cylinder(c, 0, 0, 0.16, 0, 7, '#C9D1D9', '#8FD0F0');
    c.drawOval(Skia.XYWHRect(-5, -11, 10, 5), fill('#E5483B'));
    c.drawCircle(-6, -12, 1.6, fill('#E5483B'));
    c.drawCircle(6, -12, 1.6, fill('#E5483B'));
  },
  // Salad, being tossed.
  (c) => {
    cylinder(c, 0, 0, 0.15, 0, 3, '#E4E9EE', '#7BC67E');
    for (const [x, col] of [[-3, '#E5483B'], [2, '#F2C14E'], [0, '#3FA65A']] as const) c.drawCircle(x, -4, 1.6, fill(col));
  },
  // Pad thai: noodles, prawns, peanuts.
  (c) => {
    for (let i = 0; i < 5; i++) c.drawPath(path.smooth([[-7, -3 + i], [-3, -5 + i], [1, -2 + i], [6, -4 + i]], false), stroke('#E8C26A', 1.3));
    c.drawCircle(-2, -5, 1.6, fill('#F28A5A'));
    c.drawCircle(3, -4, 1.6, fill('#F28A5A'));
  },
];
const cooking = Object.fromEntries(COOKING.map((draw, i) => [`cook${i}`, sprite([-14, -16, 14, 8], draw)])) as Record<string, SpriteDef>;

/** Bits that fly: noodles and vegetables out of the wok, salad leaves, a slice of fish, an oil bubble, a pizza. */
const tossNoodle = sprite([-6, -4, 6, 4], (c) => c.drawPath(path.smooth([[-5, 0], [-2, -2.4], [1, 0.4], [4.5, -1.6]], false), stroke('#E8C26A', 1.4)));
const tossVeg = sprite([-3, -3, 3, 3], (c) => {
  c.drawRect(Skia.XYWHRect(-1.6, -1.6, 3.2, 3.2), fill('#7BC67E'));
  c.drawRect(Skia.XYWHRect(-0.4, -1.8, 1.8, 1.8), fill('#E5483B'));
});
const tossLeaf = sprite([-4, -3, 4, 3], (c) => c.drawPath(path.smooth([[-3.4, 0], [0, -2.2], [3.4, 0], [0, 2.2]]), fill('#7BC67E')));
const fishSlice = sprite([-4, -3, 4, 3], (c) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-3.5, -1.6, 7, 3.2), 1.4, 1.4), fill('#F28A5A'));
  c.drawLine(-2.4, -0.6, 2.4, -0.6, stroke('#FFD2B8', 0.6));
});
const oilBubble = sprite([-2, -2, 2, 2], (c) => {
  c.drawCircle(0, 0, 1.2, stroke('#FFE7A0', 0.5));
});
const fireBurst = sprite([-10, -22, 10, 2], (c) => {
  c.drawPath(path.smooth([[0, -20], [6, -9], [5, 0], [-5, 0], [-6, -9]]), fill('#FF6A1A', 0.9));
  c.drawPath(path.smooth([[0, -13], [3.4, -5], [2.6, 0], [-2.6, 0], [-3.4, -5]]), fill('#FFD24A'));
});

// ---------- the Michelin pass: stainless and brass under heat lamps ----------

/** Heat lamps over the pass (drawn over the plates, under the tickets). `len` tiles along y. */
function heatLamps(c: SkCanvas, len: number) {
  const z = 58;
  const d = len - 0.2;
  for (let y = -d / 2 + 0.5; y <= d / 2 - 0.4; y += 1) {
    // Its warm light spilling down over the plates.
    const glow = Skia.Paint();
    glow.setAntiAlias(true);
    const [gx, gy] = P(0.05, y, z);
    const [bx, by] = P(0.05, y, 24);
    glow.setShader(Skia.Shader.MakeLinearGradient(vec(gx, gy), vec(bx, by), [Skia.Color('rgba(255,186,90,0.26)'), Skia.Color('rgba(255,186,90,0.03)')], null, TileMode.Clamp));
    c.drawPath(path.poly([P(0.05, y - 0.1, z), P(0.05, y + 0.1, z), P(0.38, y + 0.38, 24), P(-0.28, y + 0.38, 24), P(-0.28, y - 0.38, 24)]), glow);
    // A cord from the ceiling, a round brass shade, the glowing bulb under it.
    box(c, { x: 0.05, y, z: z + 6, w: 0.015, d: 0.015, h: 30, color: '#2B2F38' });
    cylinder(c, 0.05, y, 0.06, z + 5, 2, GOLD, '#FFE08A');
    cylinder(c, 0.05, y, 0.13, z, 5, '#B8892A', GOLD);
    const [lx, ly] = P(0.05, y, z);
    c.drawOval(Skia.XYWHRect(lx - 4.5, ly - 1.6, 9, 3.6), fill('#FFF2C4'));
  }
}
const passLamps = sprite([-50, -110, 50, 30], (c) => heatLamps(c, 3));
const passLampsLong = sprite([-80, -126, 80, 46], (c) => heatLamps(c, 5));

// ---------- the guide's plaque out front: red enamel, white rosettes (or the plate) ----------

function rosette(c: SkCanvas, x: number, y: number, r: number, color: string) {
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    c.drawCircle(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, fill(color));
  }
  c.drawCircle(x, y, r * 0.38, fill('#C8102E'));
  c.drawCircle(x, y, r * 0.2, fill(color));
}

const plaques = Object.fromEntries(
  [0, 1, 2, 3].map((stars) => [
    `guidePlaque${stars}`,
    sprite([-26, -78, 26, 10], (c) => {
      floorShadow(c, 0, 0, 0.2, 0.25);
      box(c, { x: 0, y: 0, w: 0.05, d: 0.05, h: 34, color: '#B8892A' });
      box(c, { x: 0, y: 0, z: 30, w: 0.05, d: 0.7, h: 26, color: GOLD, rim: true });
      onFaceX(c, 0.026, 0.35, () => rectIn(c, 0.04, 31.5, 0.62, 23, '#C8102E'));
      const [cx, cy] = P(0.03, 0, 43);
      if (stars === 0) {
        c.drawOval(Skia.XYWHRect(cx - 7, cy - 5, 14, 10), fill('#FFFFFF'));
        c.drawOval(Skia.XYWHRect(cx - 4.5, cy - 3.2, 9, 6.4), stroke('#C8102E', 1));
      } else {
        for (let i = 0; i < stars; i++) rosette(c, cx + (i - (stars - 1) / 2) * 7.5, cy + (i - (stars - 1) / 2) * 3.7, 3.4, '#FFFFFF');
      }
    }),
  ]),
) as Record<string, SpriteDef>;

export const kitchenSprites = {
  ...plaques,
  ...stations,
  ...preps,
  ...backs,
  ...cooking,
  wokRest,
  basket,
  wokHeld,
  knife,
  bowl,
  ladle,
  peel,
  tweezers,
  tossNoodle,
  tossVeg,
  tossLeaf,
  fishSlice,
  oilBubble,
  fireBurst,
  passLamps,
  passLampsLong,
};
