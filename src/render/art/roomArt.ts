import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import { sprite, type SpriteDef } from '../sprite';
import { darken, lighten } from './color';
import { box, cylinder, floorShadow, onFaceX, onFaceY, onTop, P, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';
import { GOLD } from './stationArt';

// The kitchen's rooms (owner M32: "everything divided into rooms... a fridge and freezer room
// with doors, and a small manager's office, very detailed"; layout in src/data/kitchenRooms.ts):
// the dish room's machine and drying racks, the walk-in's shelves, the freezer's frosted ones
// and its ice chest, the vegetable sink, the manager's desk, safe and notice board, coffee
// corner and bookcase; the walls (white tiles under glass, the cold rooms' insulated panels, the
// office's wood), the doors (swinging ones with round windows, the walk-in's heavy door with its
// strip curtain, the office's), and the signs over the doors. The renderer adds what moves
// (src/render/draw/drawRoom.ts). Each piece faces +x: it stands on its room's back wall and
// looks across the aisle toward the camera.

const STEEL = '#B6BFC9';
const STEEL_LIGHT = '#DCE2E8';
const POST = '#9AA6B4';
const WOOD = '#7A4E2C';
const WOOD_DARK = '#5A3820';
const GLASS = '#BFE6F5';
const TOP = 22.5;

/** A round dot of `r` px on a face plane (its `a` runs in tiles, `b` in px). */
function dot(c: SkCanvas, a: number, b: number, r: number, color: string, alpha = 1) {
  c.drawOval(Skia.XYWHRect(a - r / 32, b - r, (r * 2) / 32, r * 2), fill(color, alpha));
}

function shelfFrame(c: SkCanvas, h: number, levels: readonly number[], post = POST, shelf = '#C9D1D9', w = 0.5, d = 0.9) {
  floorShadow(c, 0.04, 0, 0.5, 0.26);
  for (const [x, y] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]] as const) box(c, { x, y, w: 0.04, d: 0.04, h, color: post });
  for (const z of levels) box(c, { x: 0, y: 0, z, w: w + 0.04, d: d + 0.04, h: 1, color: shelf });
}

/** A steel work table: legs, an undershelf, the top. */
function steelTable(c: SkCanvas, h = 20) {
  floorShadow(c, 0.06, 0, 0.62, 0.28);
  for (const [x, y] of [[-0.4, -0.42], [0.4, -0.42], [-0.4, 0.42], [0.4, 0.42]] as const) box(c, { x, y, w: 0.05, d: 0.05, h, color: POST });
  box(c, { x: 0, y: 0, z: 5, w: 0.88, d: 0.9, h: 1.2, color: '#AEB8C4' });
  box(c, { x: 0, y: 0, z: h, w: 0.94, d: 0.96, h: 2.5, color: STEEL_LIGHT, rim: true });
}

// ---------- the dish room ----------

/** A hood dish machine on its table, the pre-rinse sprayer on its spring beside it, a rack of dirty plates waiting. */
function dishMachine(c: SkCanvas) {
  steelTable(c);
  // The machine: a steel box with a lift-up hood, its handle, the control panel and its lights.
  box(c, { x: 0.04, y: 0.04, z: TOP, w: 0.66, d: 0.62, h: 6, color: '#AEB8C4' });
  box(c, { x: 0.04, y: 0.04, z: TOP + 6, w: 0.68, d: 0.64, h: 26, color: '#C9D1D9', rim: true });
  onFaceX(c, 0.38, 0.36, () => {
    rectIn(c, 0.04, 4, 0.56, 1, '#8F9AA8');
    rectIn(c, 0.1, 20, 0.44, 1.6, '#E4E9EE');
    rectIn(c, 0.1, 19.4, 0.44, 0.6, '#5E6878');
    // The panel: a dark strip, the temperature, a green light (on) and a red one.
    rectIn(c, 0.06, 26, 0.52, 4, '#2B2F38');
    rectIn(c, 0.1, 27, 0.14, 2, '#59E07A');
    dot(c, 0.42, 28, 0.9, '#3FD48A');
    dot(c, 0.5, 28, 0.9, '#8A2A2A');
  });
  onFaceY(c, 0.36, -0.3, () => {
    rectIn(c, 0.04, 6, 0.6, 22, darken('#C9D1D9', 0.05));
    for (let k = 0; k < 4; k++) rectIn(c, 0.08 + k * 0.14, 10, 0.06, 12, '#AEB8C4');
  });
  // A rack of dirty plates on the table's far end, waiting their turn.
  box(c, { x: 0.05, y: -0.38, z: TOP, w: 0.5, d: 0.16, h: 2, color: '#3A6EA8' });
  for (let k = 0; k < 5; k++) box(c, { x: -0.15 + k * 0.1, y: -0.38, z: TOP + 2, w: 0.02, d: 0.14, h: 6, color: '#F4EEE2' });
  // The pre-rinse sprayer: a pipe up the wall, a spring coil, the head hanging.
  box(c, { x: -0.38, y: 0.4, z: TOP, w: 0.04, d: 0.04, h: 48, color: '#C9D1D9' });
  const [tx, ty] = P(-0.38, 0.4, TOP + 48);
  const [hx, hy] = P(-0.1, 0.4, TOP + 24);
  const coil = path.polyline(Array.from({ length: 13 }, (_, k) => [tx + (hx - tx) * (k / 12) + (k === 0 ? 0 : k % 2 ? 2.4 : -2.4), ty + (hy - ty) * (k / 12)] as const));
  c.drawPath(coil, stroke('#8F9AA8', 0.9));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(hx - 2, hy - 1, 4, 7), 1.2, 1.2), fill('#5E6878'));
}

/** A wire rack of clean plates, bowls, cups and glasses drying upside down. */
function dryingRack(c: SkCanvas) {
  shelfFrame(c, 60, [4, 18, 32, 46, 58]);
  // Plates on edge in their slots, stacks of bowls, cups, glasses upside down.
  for (let k = 0; k < 7; k++) box(c, { x: 0, y: -0.36 + k * 0.12, z: 5, w: 0.36, d: 0.02, h: 11, color: '#F4EEE2' });
  for (const y of [-0.26, 0.04, 0.32]) {
    cylinder(c, 0, y, 0.13, 19, 3, '#E4E9EE', '#FFFFFF');
    cylinder(c, 0, y, 0.11, 22, 3, '#E4E9EE', '#FFFFFF');
  }
  for (let k = 0; k < 4; k++) cylinder(c, 0, -0.33 + k * 0.22, 0.06, 33, 5, '#F4EEE2', '#F4EEE2');
  for (let k = 0; k < 5; k++) cylinder(c, 0, -0.34 + k * 0.17, 0.05, 47, 7, GLASS, '#E8F7FC');
  // A clean tray on top.
  box(c, { x: 0, y: 0, z: 59, w: 0.42, d: 0.7, h: 1.4, color: '#8F9AA8' });
}

// ---------- the walk-in cold room and the freezer ----------

/** The walk-in's shelving: crates of milk, wheels of cheese, tubs with colored lids, a tray of eggs. */
function coolerShelf(c: SkCanvas) {
  shelfFrame(c, 58, [4, 20, 36, 52], '#B9C3CE', '#D2D9E1');
  // Bottom: a crate of milk bottles and a crate of cream.
  for (const [y, crate] of [[-0.22, '#3A6EA8'], [0.22, '#E5483B']] as const) {
    box(c, { x: 0, y, z: 5, w: 0.42, d: 0.38, h: 8, color: crate, rim: true });
    for (const dy of [-0.08, 0.08]) cylinder(c, 0, y + dy, 0.05, 13, 5, '#FFFFFF', '#3A6EA8');
  }
  // Cheese wheels and a block of butter.
  cylinder(c, 0, -0.24, 0.16, 21, 6, '#F2C14E', '#F8D880');
  cylinder(c, 0, 0.1, 0.13, 21, 5, '#E8B45A', '#F2D090');
  box(c, { x: 0, y: 0.34, z: 21, w: 0.2, d: 0.14, h: 4, color: '#FBEFC0', rim: true });
  // Tubs of prepped food, their lids by color, a label each.
  ['#E5483B', '#3FA65A', '#F2C14E', '#3A6EA8'].forEach((lid, k) => {
    box(c, { x: 0, y: -0.33 + k * 0.22, z: 37, w: 0.3, d: 0.18, h: 7, color: '#F2F0EA' });
    box(c, { x: 0, y: -0.33 + k * 0.22, z: 44, w: 0.32, d: 0.2, h: 1, color: lid });
  });
  // A tray of eggs on top.
  box(c, { x: 0, y: 0, z: 53, w: 0.4, d: 0.6, h: 1.4, color: '#C8B49A' });
  onTop(c, 54.4, () => {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) c.drawOval(Skia.XYWHRect(-0.15 + i * 0.12 - 0.04, -0.26 + j * 0.12 - 0.04, 0.08, 0.08), fill('#F8EEDC'));
  });
}

/** The freezer's shelving, rimed with frost: boxes, tubs of ice cream, frozen fish. */
function freezerShelf(c: SkCanvas) {
  shelfFrame(c, 58, [4, 20, 36, 52], '#D8E8F2', '#E8F2F8');
  // Frozen boxes with blue labels.
  for (const y of [-0.22, 0.22]) {
    box(c, { x: 0, y, z: 5, w: 0.42, d: 0.38, h: 12, color: '#C8A070', rim: true });
    onFaceX(c, 0.21, y + 0.19, () => rectIn(c, 0.06, 5, 0.26, 4, '#3A6EA8'));
  }
  // Tubs of ice cream.
  ['#F4A6C0', '#F8E8C8', '#8A5A34', '#B8E0A0'].forEach((col, k) => cylinder(c, 0, -0.33 + k * 0.22, 0.08, 21, 8, '#F2F0EA', col));
  // Frozen fish, silver, side by side.
  for (let k = 0; k < 3; k++) {
    const y = -0.26 + k * 0.26;
    box(c, { x: 0, y, z: 37, w: 0.36, d: 0.16, h: 3, color: '#9FB8C8', rim: true });
  }
  // Frost on the shelves and posts.
  for (const z of [20, 36, 52]) {
    onTop(c, z + 1, () => {
      for (let k = 0; k < 9; k++) c.drawCircle(-0.22 + (k % 3) * 0.2, -0.4 + k * 0.1, 0.025, fill('#FFFFFF', 0.85));
    });
  }
  box(c, { x: 0, y: 0, z: 53, w: 0.5, d: 0.88, h: 2, color: '#FFFFFF', alpha: 0.75 });
}

/** An ice machine on its bin, the scoop hanging, and a bucket of ice. */
function iceChest(c: SkCanvas) {
  floorShadow(c, 0.06, 0, 0.6, 0.3);
  box(c, { x: 0, y: 0, w: 0.82, d: 0.86, h: 3, color: '#4A505C' });
  box(c, { x: 0, y: 0, z: 3, w: 0.84, d: 0.88, h: 24, color: '#E9EEF2', rim: true });
  onFaceX(c, 0.42, 0.44, () => {
    // The bin's sloped door and its handle.
    rectIn(c, 0.06, 10, 0.76, 13, '#D2D9E1');
    rectIn(c, 0.2, 21, 0.48, 1.4, '#8F9AA8');
  });
  // The ice maker on top: a steel head with its blue display.
  box(c, { x: 0, y: 0, z: 27, w: 0.8, d: 0.84, h: 20, color: '#C9D1D9', rim: true });
  onFaceX(c, 0.4, 0.42, () => {
    rectIn(c, 0.06, 4, 0.72, 13, '#AEB8C4');
    for (let k = 0; k < 6; k++) rectIn(c, 0.1 + k * 0.11, 6, 0.06, 9, '#8F9AA8');
    rectIn(c, 0.28, 17, 0.28, 2.4, '#163A5A');
    rectIn(c, 0.3, 17.5, 0.12, 1.4, '#5FE6FF');
  });
  // The scoop on a hook, a bucket of ice cubes.
  box(c, { x: 0.44, y: -0.3, z: 34, w: 0.02, d: 0.1, h: 6, color: '#E4E9EE' });
  cylinder(c, 0.1, -0.5, 0.1, 0, 7, '#3A6EA8', '#F4FBFF');
  onTop(c, 7, () => {
    for (let k = 0; k < 5; k++) c.drawRect(Skia.XYWHRect(0.04 + (k % 3) * 0.04, -0.55 + Math.floor(k / 3) * 0.05, 0.035, 0.035), fill('#FFFFFF'));
  });
}

// ---------- the vegetable room ----------

/** A deep double sink: lettuce soaking, a colander of tomatoes, the gooseneck tap; crates of vegetables under it. */
function vegSink(c: SkCanvas) {
  floorShadow(c, 0.06, 0, 0.62, 0.28);
  for (const [x, y] of [[-0.4, -0.42], [0.4, -0.42], [-0.4, 0.42], [0.4, 0.42]] as const) box(c, { x, y, w: 0.05, d: 0.05, h: 12, color: POST });
  // Crates under the basins: carrots, aubergines.
  for (const [y, col] of [[-0.2, '#F28A12'], [0.22, '#6A3B7A']] as const) {
    box(c, { x: 0.02, y, z: 1, w: 0.5, d: 0.36, h: 6, color: '#B88A52' });
    for (const dy of [-0.08, 0.08]) cylinder(c, 0.02, y + dy, 0.06, 7, 2.4, col, lighten(col, 0.2));
  }
  box(c, { x: 0, y: 0, z: 12, w: 0.9, d: 0.94, h: 12, color: STEEL, rim: true });
  onTop(c, 24, () => {
    for (const y of [-0.22, 0.22]) {
      c.drawRect(Skia.XYWHRect(-0.34, y - 0.19, 0.66, 0.38), fill('#6E7A88'));
      c.drawRect(Skia.XYWHRect(-0.3, y - 0.15, 0.58, 0.3), fill('#9FD4EA', 0.85));
    }
    // Lettuce floating in one basin, tomatoes in a colander in the other.
    for (const [x, y] of [[-0.12, -0.26], [0.06, -0.18], [-0.02, -0.12]] as const) c.drawCircle(x, y, 0.07, fill('#5CB85C'));
    c.drawCircle(0, 0.22, 0.13, fill('#C9D1D9'));
    for (const [x, y] of [[-0.04, 0.18], [0.05, 0.24], [-0.02, 0.28]] as const) c.drawCircle(x, y, 0.045, fill('#E5483B'));
  });
  // The tap: up from the back, a gooseneck over the basins.
  box(c, { x: -0.4, y: 0, z: 24, w: 0.05, d: 0.05, h: 22, color: '#E4E9EE' });
  const [ax, ay] = P(-0.4, 0, TOP + 24);
  const [bx, by] = P(-0.08, -0.04, TOP + 16);
  c.drawPath(path.smooth([[ax, ay], [ax + 4, ay - 8], [bx, by - 6], [bx, by]], false), stroke('#E4E9EE', 1.6));
}

// ---------- the manager's office ----------

/**
 * The manager's desk: dark wood, a monitor with the day's chart, a keyboard, a green banker's
 * lamp, a stack of invoices, a mug, a framed photo, the phone, a gold name plate; the office
 * chair in front of it (the manager sits there with their back to us, src/sim/game/crew.ts).
 */
function desk(c: SkCanvas) {
  floorShadow(c, 0.1, 0, 0.66, 0.28);
  // Pedestal drawers on the near side, a leg on the far one.
  box(c, { x: -0.05, y: 0.28, w: 0.62, d: 0.32, h: 18, color: WOOD_DARK, rim: true });
  onFaceX(c, 0.26, 0.44, () => {
    for (let k = 0; k < 3; k++) {
      rectIn(c, 0.03, 2 + k * 5.4, 0.26, 4.6, WOOD);
      rectIn(c, 0.12, 4 + k * 5.4, 0.08, 0.9, GOLD);
    }
  });
  box(c, { x: -0.05, y: -0.4, w: 0.6, d: 0.06, h: 18, color: WOOD_DARK });
  // The top, with a leather blotter.
  box(c, { x: -0.05, y: 0, z: 18, w: 0.72, d: 0.98, h: 2.4, color: WOOD, rim: true });
  onTop(c, 20.4, () => c.drawRect(Skia.XYWHRect(-0.24, -0.26, 0.38, 0.46), fill('#2E4A3A')));
  // The monitor facing the chair: its stand, the screen with a rising chart and the numbers.
  box(c, { x: -0.28, y: -0.06, z: 20.4, w: 0.12, d: 0.16, h: 1, color: '#2B2F38' });
  box(c, { x: -0.3, y: -0.06, z: 21.4, w: 0.03, d: 0.04, h: 5, color: '#2B2F38' });
  box(c, { x: -0.28, y: -0.06, z: 25, w: 0.04, d: 0.5, h: 16, color: '#1A1B20', rim: true });
  onFaceX(c, -0.26, 0.19, () => {
    rectIn(c, 0.02, 1, 0.46, 14, '#163A5A');
    c.drawPath(path.polyline([[0.05, 3], [0.14, 5], [0.22, 4.4], [0.3, 8], [0.38, 7.4], [0.46, 12]]), stroke('#59E07A', 0.9));
    for (let k = 0; k < 3; k++) rectIn(c, 0.05 + k * 0.08, 11 + (k % 2), 0.05, 1.2, '#FFFFFF', 0.7);
  });
  // The keyboard and the mouse.
  box(c, { x: 0.04, y: -0.04, z: 20.4, w: 0.12, d: 0.34, h: 0.8, color: '#2B2F38' });
  box(c, { x: 0.06, y: 0.2, z: 20.4, w: 0.06, d: 0.05, h: 0.8, color: '#2B2F38' });
  // A stack of invoices, a coffee mug.
  for (let k = 0; k < 4; k++) box(c, { x: -0.08 + (k % 2) * 0.02, y: -0.36, z: 20.4 + k * 0.8, w: 0.24, d: 0.18, h: 0.8, color: k % 2 ? '#F4EEE2' : '#FFFFFF' });
  cylinder(c, 0.1, -0.32, 0.045, 20.4, 3.6, '#E5483B', '#3A2418');
  // The banker's lamp: brass stand, green glass shade.
  box(c, { x: -0.3, y: 0.38, z: 20.4, w: 0.1, d: 0.1, h: 1, color: GOLD });
  box(c, { x: -0.3, y: 0.38, z: 21.4, w: 0.02, d: 0.02, h: 7, color: GOLD });
  box(c, { x: -0.24, y: 0.38, z: 27, w: 0.12, d: 0.22, h: 2.4, color: '#1F7A4A', rim: true });
  // A framed photo and the desk phone.
  box(c, { x: -0.3, y: 0.18, z: 20.4, w: 0.03, d: 0.1, h: 5, color: GOLD });
  box(c, { x: 0.04, y: 0.36, z: 20.4, w: 0.16, d: 0.14, h: 1.6, color: '#2B2F38', rim: true });
  // The name plate on the front edge.
  box(c, { x: 0.22, y: 0.08, z: 20.4, w: 0.05, d: 0.28, h: 2, color: '#2B2F38' });
  onFaceX(c, 0.245, 0.22, () => rectIn(c, 0.03, 0.4, 0.22, 1.2, GOLD));
  // The office chair, turned to the desk: its five-star base, the seat, a low backrest.
  const cx = 0.62;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    box(c, { x: cx + Math.cos(a) * 0.12, y: Math.sin(a) * 0.12, w: 0.06, d: 0.06, h: 1.2, color: '#2B2F38' });
  }
  box(c, { x: cx, y: 0, z: 1, w: 0.04, d: 0.04, h: 10, color: '#5E6878' });
  box(c, { x: cx, y: 0, z: 11, w: 0.36, d: 0.38, h: 3, color: '#2B2F38', rim: true });
  box(c, { x: cx + 0.17, y: 0, z: 14, w: 0.05, d: 0.34, h: 12, color: '#1E1C24', rim: true });
}

/** A filing cabinet with the safe on it (a gold dial), and the notice board on the wall above: the week's rota, notes, the clock. */
function safe(c: SkCanvas) {
  // The notice board on the wall: cork in a wooden frame, the rota, pinned notes, the clock.
  onFaceX(c, -0.47, 0.42, () => {
    rectIn(c, 0.06, 40, 0.74, 26, WOOD_DARK);
    rectIn(c, 0.09, 41.5, 0.68, 23, '#C8955A');
    rectIn(c, 0.13, 46, 0.3, 16, '#FFFFFF');
    for (let k = 0; k < 6; k++) rectIn(c, 0.15, 48 + k * 2.4, 0.26, 0.5, k % 2 ? '#3A6EA8' : '#2B2F38');
    for (const [a, b, col] of [[0.5, 54, '#FFE07A'], [0.6, 46, '#F4A6C0'], [0.52, 46, '#B8E0A0']] as const) {
      rectIn(c, a, b, 0.12, 6, col);
      dot(c, a + 0.06, b + 5, 0.6, '#C8283A');
    }
  });
  onFaceX(c, -0.47, 0.42, () => {
    dot(c, 0.78, 72, 4, '#FFFFFF');
    dot(c, 0.78, 72, 3.4, '#F4EEE2');
  });
  const [kx, ky] = P(-0.47, -0.36, 72);
  c.drawLine(kx, ky, kx, ky - 2.6, stroke('#2B2F38', 0.6));
  c.drawLine(kx, ky, kx + 1.8, ky, stroke('#2B2F38', 0.6));
  // The cabinet: three drawers with handles and label slots.
  floorShadow(c, 0.04, 0, 0.5, 0.26);
  box(c, { x: -0.1, y: 0, w: 0.56, d: 0.8, h: 34, color: '#8F9AA8', rim: true });
  onFaceX(c, 0.18, 0.4, () => {
    for (let k = 0; k < 3; k++) {
      rectIn(c, 0.05, 2 + k * 10.6, 0.7, 9.6, '#A8B2BE');
      rectIn(c, 0.3, 7 + k * 10.6, 0.2, 1.2, '#5E6878');
      rectIn(c, 0.32, 9 + k * 10.6, 0.16, 1.4, '#F4EEE2');
    }
  });
  // The safe: heavy and black, a gold dial and handle.
  box(c, { x: -0.1, y: 0.04, z: 34, w: 0.48, d: 0.5, h: 16, color: '#24222C', rim: true });
  onFaceX(c, 0.14, 0.29, () => {
    rectIn(c, 0.04, 1.5, 0.42, 13, '#2E2B38');
    dot(c, 0.2, 9, 3, GOLD);
    dot(c, 0.2, 9, 1.8, '#8A6A2E');
    rectIn(c, 0.32, 5, 0.04, 7, GOLD);
  });
}

/** The coffee corner: an espresso machine with cups warming on top, a grinder, a jug of milk; a water cooler. */
function coffee(c: SkCanvas) {
  floorShadow(c, 0.06, 0, 0.62, 0.28);
  box(c, { x: -0.1, y: 0.14, w: 0.66, d: 0.64, h: 20, color: WOOD, rim: true });
  onFaceX(c, 0.23, 0.46, () => {
    rectIn(c, 0.04, 3, 0.26, 14, WOOD_DARK);
    rectIn(c, 0.34, 3, 0.26, 14, WOOD_DARK);
  });
  box(c, { x: -0.1, y: 0.14, z: 20, w: 0.7, d: 0.68, h: 2, color: '#2B2830', rim: true });
  // The machine: chrome, two group heads, a gauge.
  box(c, { x: -0.18, y: 0.18, z: 22, w: 0.36, d: 0.46, h: 16, color: '#D2D9E1', rim: true });
  onFaceX(c, 0, 0.41, () => {
    rectIn(c, 0.05, 1, 0.36, 3, '#8F9AA8');
    for (const a of [0.1, 0.28]) {
      rectIn(c, a, 6, 0.08, 3, '#2B2F38');
      rectIn(c, a - 0.02, 9, 0.12, 1.2, '#5E6878');
    }
    dot(c, 0.22, 13, 1.6, '#FFFFFF');
    dot(c, 0.22, 13, 1.1, '#2B2F38');
  });
  for (let k = 0; k < 4; k++) cylinder(c, -0.2, 0.02 + k * 0.1, 0.035, 38, 2.4, '#FFFFFF', '#F4EEE2');
  // An espresso just made, the grinder, the milk jug.
  cylinder(c, 0.12, 0.14, 0.035, 22, 2.4, '#FFFFFF', '#6A3B2A');
  box(c, { x: -0.18, y: -0.18, z: 22, w: 0.16, d: 0.14, h: 9, color: '#2B2F38', rim: true });
  cylinder(c, -0.18, -0.18, 0.06, 31, 4, '#5E6878', '#8A5A34');
  cylinder(c, 0.1, 0.36, 0.04, 22, 4, '#E4E9EE', '#FFFFFF');
  // The water cooler on the far side: its bottle, blue.
  box(c, { x: 0, y: -0.38, w: 0.26, d: 0.22, h: 30, color: '#F2F0EA', rim: true });
  cylinder(c, 0, -0.38, 0.1, 30, 14, '#9FD4EA', '#C8EAF8');
  onFaceX(c, 0.13, -0.27, () => {
    rectIn(c, 0.04, 20, 0.04, 2, '#3A6EA8');
    rectIn(c, 0.12, 20, 0.04, 2, '#C8283A');
  });
}

/** A tall wooden bookcase: binders by color, cookbooks, the guide's plates and a gold cup, a little plant. */
function bookshelf(c: SkCanvas) {
  floorShadow(c, 0.04, 0, 0.5, 0.26);
  box(c, { x: -0.2, y: 0, w: 0.42, d: 0.9, h: 72, color: WOOD, rim: true });
  onFaceX(c, 0.01, 0.45, () => {
    // Four shelves, dark inside.
    for (let k = 0; k < 4; k++) rectIn(c, 0.04, 4 + k * 17, 0.82, 14.5, '#3A2418');
    // Binders, by color, their labels.
    const BINDERS = ['#C8283A', '#3A6EA8', '#3FA65A', '#F2C14E', '#3A6EA8', '#C8283A', '#2B2F38'];
    BINDERS.forEach((col, i) => {
      rectIn(c, 0.06 + i * 0.1, 4, 0.08, 13, col);
      rectIn(c, 0.075 + i * 0.1, 9, 0.05, 3, '#F4EEE2');
    });
    // Cookbooks, leaning, and a box file.
    ['#8A5A34', '#E5483B', '#F4EEE2', '#2E4A3A', '#6A3B7A'].forEach((col, i) => rectIn(c, 0.06 + i * 0.07, 21, 0.06, 11 - (i % 3), col));
    rectIn(c, 0.5, 21, 0.3, 9, '#C8A070');
    // The guide's plates, framed, and a gold cup.
    rectIn(c, 0.08, 39, 0.3, 11, GOLD);
    rectIn(c, 0.1, 40, 0.26, 9, '#F4EEE2');
    dot(c, 0.23, 44.5, 3, '#C8283A');
    rectIn(c, 0.48, 39, 0.3, 11, GOLD);
    rectIn(c, 0.5, 40, 0.26, 9, '#1E1C24');
    dot(c, 0.63, 44.5, 2.6, GOLD);
  });
  cylinder(c, -0.2, 0.18, 0.08, 55, 3, GOLD, lighten(GOLD, 0.2));
  cylinder(c, -0.2, 0.18, 0.12, 58, 7, GOLD, darken(GOLD, 0.2));
  cylinder(c, -0.2, -0.24, 0.07, 55, 5, '#C4632E', '#5A3A24');
  box(c, { x: -0.2, y: -0.24, z: 60, w: 0.14, d: 0.14, h: 6, color: '#3FA65A' });
  box(c, { x: -0.18, y: -0.22, z: 65, w: 0.08, d: 0.08, h: 4, color: '#4CBB66' });
}

// ---------- walls ----------

/** A wall unit's face along x (the +y face is the one we see) or along y (the +x face). */
function face(c: SkCanvas, along: 'x' | 'y', draw: () => void) {
  if (along === 'x') onFaceY(c, 0.045, -0.5, draw);
  else onFaceX(c, 0.045, 0.5, draw);
}

function slab(c: SkCanvas, along: 'x' | 'y', z: number, h: number, color: string, thick: number, alpha = 1, rim = false) {
  box(c, along === 'x' ? { x: 0, y: 0, z, w: 1, d: thick, h, color, alpha, rim } : { x: 0, y: 0, z, w: thick, d: 1, h, color, alpha, rim });
}

/** A post at the unit's near end: every tile of a wall has one, so a run of wall reads as panels. */
function post(c: SkCanvas, along: 'x' | 'y', h: number, color: string) {
  box(c, along === 'x' ? { x: -0.49, y: 0, w: 0.05, d: 0.11, h, color } : { x: 0, y: 0.49, w: 0.11, d: 0.05, h, color });
}

/** Kitchen walls: a steel kick plate, white subway tiles, a steel ledge, clear glass, the top rail. */
function tileWall(c: SkCanvas, along: 'x' | 'y') {
  slab(c, along, 0, 4, '#5E6878', 0.1);
  slab(c, along, 4, 20, '#F2F0EA', 0.09);
  face(c, along, () => {
    for (let b = 8; b < 24; b += 4) rectIn(c, 0, b, 1, 0.4, '#C9C4BC');
    for (let row = 0; row < 5; row++) for (let a = row % 2 ? 0.125 : 0; a < 1; a += 0.25) rectIn(c, a, 4 + row * 4, 0.012, 4, '#C9C4BC');
  });
  slab(c, along, 24, 2, '#C9D1D9', 0.14, 1, true);
  slab(c, along, 26, 18, GLASS, 0.03, 0.26);
  face(c, along, () => c.drawPath(path.poly([[0.2, 28], [0.32, 28], [0.12, 42], [0, 42]]), fill('#FFFFFF', 0.28)));
  slab(c, along, 44, 2, '#C9D1D9', 0.08, 1, true);
  post(c, along, 46, POST);
}

/** The cold rooms: insulated white panels, ribbed, a strip of frosted glass, a steel cap. */
function coldWall(c: SkCanvas, along: 'x' | 'y') {
  slab(c, along, 0, 4, '#4A505C', 0.12);
  slab(c, along, 4, 24, '#E9EEF2', 0.12);
  face(c, along, () => {
    for (let a = 0.1; a < 1; a += 0.2) rectIn(c, a, 6, 0.02, 20, '#CDD6DE');
    rectIn(c, 0, 18, 1, 1.4, '#5BC0EB');
  });
  slab(c, along, 28, 12, '#D8EEF8', 0.04, 0.55);
  face(c, along, () => {
    for (let k = 0; k < 6; k++) c.drawCircle(0.1 + k * 0.16, 30 + (k % 3) * 3, 0.6, fill('#FFFFFF', 0.7));
  });
  slab(c, along, 40, 6, '#C9D1D9', 0.12, 1, true);
  post(c, along, 46, '#B9C3CE');
}

/** The office: dark wood panelling with its moulding, clear glass, a wooden rail. */
function officeWall(c: SkCanvas, along: 'x' | 'y') {
  slab(c, along, 0, 3, WOOD_DARK, 0.1);
  slab(c, along, 3, 21, WOOD, 0.09);
  face(c, along, () => {
    for (const a of [0.06, 0.54]) {
      rectIn(c, a, 6, 0.4, 14, darken(WOOD, 0.12));
      rectIn(c, a + 0.03, 7.4, 0.34, 11.2, WOOD);
    }
  });
  slab(c, along, 24, 2, WOOD_DARK, 0.13, 1, true);
  slab(c, along, 26, 18, GLASS, 0.03, 0.22);
  face(c, along, () => rectIn(c, 0.48, 26, 0.04, 18, WOOD_DARK));
  slab(c, along, 44, 2, WOOD_DARK, 0.09, 1, true);
  post(c, along, 46, WOOD_DARK);
}

// ---------- doors (along x; the renderer mirrors them for along y) ----------

function frame(c: SkCanvas, color: string) {
  for (const x of [-0.47, 0.47]) box(c, { x, y: 0, w: 0.06, d: 0.13, h: 48, color, rim: true });
  box(c, { x: 0, y: 0, z: 46, w: 1, d: 0.13, h: 4, color, rim: true });
}

/** A swinging leaf: closed across the opening, or swung back against the jamb into the room. */
function leaf(c: SkCanvas, hinge: number, width: number, open: boolean, h: number, color: string, thick: number, onFace: (a: number) => void) {
  if (!open) {
    const x = hinge + (hinge < 0 ? width / 2 : -width / 2);
    box(c, { x, y: 0, z: 2, w: width, d: thick, h, color, rim: true });
    onFaceY(c, thick / 2, x - width / 2, () => onFace(width));
  } else {
    box(c, { x: hinge + (hinge < 0 ? 0.03 : -0.03), y: width / 2 + 0.06, z: 2, w: thick, d: width, h, color, rim: true });
    onFaceX(c, hinge + (hinge < 0 ? 0.03 : -0.03) + thick / 2, 0.06 + width, () => onFace(width));
  }
}

/** Double swinging doors: steel, kick plates, a round window each. */
function swingDoor(c: SkCanvas, open: boolean) {
  frame(c, '#9AA6B4');
  for (const hinge of [-0.44, 0.44]) {
    leaf(c, hinge, 0.43, open, 40, '#C9D1D9', 0.04, (w) => {
      rectIn(c, 0.02, 1, w - 0.04, 9, '#8F9AA8');
      dot(c, w / 2, 28, 4.4, '#5E6878');
      dot(c, w / 2, 28, 3.6, '#9FD4EA');
      dot(c, w / 2 - 0.03, 29.4, 1.2, '#FFFFFF', 0.8);
    });
  }
}

/** The walk-in's door: thick, white, a heavy chrome handle, a little window; open, its strip curtain hangs in the doorway. */
function coldDoor(c: SkCanvas, open: boolean) {
  frame(c, '#C9D1D9');
  leaf(c, -0.44, 0.88, open, 42, '#EEF2F5', 0.09, (w) => {
    rectIn(c, 0.02, 1, w - 0.04, 6, '#AEB8C4');
    rectIn(c, w * 0.32, 26, w * 0.36, 9, '#9FD4EA');
    rectIn(c, w - 0.2, 16, 0.12, 2.2, '#E4E9EE');
    rectIn(c, w - 0.2, 15, 0.03, 4.2, '#8F9AA8');
  });
  if (open) for (let k = 0; k < 6; k++) box(c, { x: -0.36 + k * 0.145, y: 0, z: 4, w: 0.13, d: 0.01, h: 42, color: '#CFEAF6', alpha: 0.4 });
  // The thermometer over the door: green digits.
  box(c, { x: 0.2, y: 0.07, z: 47, w: 0.22, d: 0.01, h: 2.6, color: '#14231A' });
  const [tx, ty] = P(0.2, 0.08, 48.3);
  c.drawRect(Skia.XYWHRect(tx - 2.2, ty - 0.7, 4.4, 1.4), fill('#59E07A'));
}

/** The office's wooden door: a frosted glass pane, a brass handle and a name plate. */
function officeDoor(c: SkCanvas, open: boolean) {
  frame(c, WOOD_DARK);
  leaf(c, -0.44, 0.88, open, 42, WOOD, 0.05, (w) => {
    rectIn(c, 0.06, 4, w - 0.12, 14, darken(WOOD, 0.1));
    rectIn(c, 0.06, 22, w - 0.12, 17, '#E8F2F8', 0.8);
    rectIn(c, w * 0.35, 33, w * 0.3, 2.4, GOLD);
    rectIn(c, w - 0.14, 19, 0.08, 1.4, GOLD);
  });
}

// ---------- signs ----------

/** A plaque by room: its color and pictogram (src/data/kitchenRooms.ts ROOM_KINDS order, then the hot line and the cold line). */
const SIGNS: { color: string; draw: (c: SkCanvas) => void }[] = [
  // The dish room: a plate and bubbles.
  { color: '#2F7FD0', draw: (c) => {
    c.drawCircle(0, -6, 3.6, fill('#FFFFFF'));
    c.drawCircle(0, -6, 2.2, stroke('#9FD4EA', 0.6));
    for (const [x, y, r] of [[4.6, -9, 1.2], [5.6, -6, 0.8], [-4.8, -8.4, 1]] as const) c.drawCircle(x, y, r, stroke('#FFFFFF', 0.5));
  } },
  // The walk-in: a snowflake and a thermometer.
  { color: '#3AA8D8', draw: (c) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      c.drawLine(-2 - Math.cos(a) * 3.4, -6 - Math.sin(a) * 3.4, -2 + Math.cos(a) * 3.4, -6 + Math.sin(a) * 3.4, stroke('#FFFFFF', 0.9));
    }
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(3.6, -10, 1.6, 6), 0.8, 0.8), fill('#FFFFFF'));
    c.drawCircle(4.4, -3.6, 1.4, fill('#E5483B'));
  } },
  // Vegetables: a carrot and a leaf.
  { color: '#3A9A4E', draw: (c) => {
    c.drawPath(path.poly([[-3.4, -9], [0.6, -8], [-2.6, -2.6]]), fill('#F28A12'));
    c.drawPath(path.smooth([[-3.4, -9], [-4.6, -11], [-2.4, -10], [-1.6, -11.6]], false), stroke('#B8E0A0', 0.9));
    c.drawPath(path.smooth([[2.4, -3], [3, -8], [5.6, -9.6], [4.8, -5], [2.4, -3]], true), fill('#B8E0A0'));
  } },
  // The office: a briefcase, gold-edged.
  { color: '#2B3A68', draw: (c) => {
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-4.4, -8.6, 8.8, 5.6), 0.8, 0.8), fill('#C8914F'));
    c.drawRect(Skia.XYWHRect(-1.6, -10, 3.2, 1.6), stroke('#C8914F', 0.8));
    c.drawLine(-4.4, -6.4, 4.4, -6.4, stroke('#8A5A34', 0.6));
    c.drawRect(Skia.XYWHRect(-0.7, -7, 1.4, 1.2), fill(GOLD));
  } },
  // Prep: a bowl and a whisk.
  { color: '#E0902A', draw: (c) => {
    c.drawPath(path.poly([[-4.6, -6.4], [4.6, -6.4], [2.6, -2.6], [-2.6, -2.6]]), fill('#FFFFFF'));
    c.drawOval(Skia.XYWHRect(-1, -12, 2.6, 5), stroke('#FFFFFF', 0.7));
    c.drawLine(0.6, -7.2, 2.6, -10.6, stroke('#FFFFFF', 0.8));
  } },
  // The stores: a crate.
  { color: '#8A5A34', draw: (c) => {
    c.drawRect(Skia.XYWHRect(-4, -9.4, 8, 6.4), fill('#E8C99A'));
    c.drawLine(-4, -6.2, 4, -6.2, stroke('#8A5A34', 0.7));
    c.drawLine(-4, -9.4, 4, -3, stroke('#B88A52', 0.7));
  } },
  // Pastry: a cupcake.
  { color: '#D85A8A', draw: (c) => {
    c.drawPath(path.poly([[-3.2, -6], [3.2, -6], [2.2, -2.6], [-2.2, -2.6]]), fill('#F4E3B8'));
    c.drawPath(path.smooth([[-3.6, -6], [-2.4, -9.6], [0, -11], [2.4, -9.6], [3.6, -6]], true), fill('#FFFFFF'));
    c.drawCircle(0, -11.2, 1, fill('#C8283A'));
  } },
  // The butchery: a cleaver.
  { color: '#A8323A', draw: (c) => {
    c.drawRect(Skia.XYWHRect(-4, -10, 5.6, 5), fill('#E4E9EE'));
    c.drawCircle(-2.8, -8.8, 0.7, fill('#A8323A'));
    c.drawRect(Skia.XYWHRect(1.6, -8.2, 3.2, 1.4), fill('#5A3820'));
  } },
  // The hot line: a flame.
  { color: '#8C1C1C', draw: (c) => {
    c.drawPath(path.smooth([[0, -2.4], [-3.6, -5], [-2.2, -9], [0, -12], [0.6, -8.4], [2.6, -10.4], [3.4, -5.6], [0, -2.4]], true), fill('#F28A12'));
    c.drawPath(path.smooth([[0, -3.2], [-1.6, -5.4], [0, -8.6], [1.6, -5.4], [0, -3.2]], true), fill('#FFE07A'));
  } },
  // The cold line: a snowflake and a leaf.
  { color: '#1E8C9C', draw: (c) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI + 0.3;
      c.drawLine(-Math.cos(a) * 4.4, -6.6 - Math.sin(a) * 4.4, Math.cos(a) * 4.4, -6.6 + Math.sin(a) * 4.4, stroke('#FFFFFF', 1));
    }
    c.drawCircle(0, -6.6, 1.2, fill('#B8E0A0'));
  } },
];
/** The line signs hang from the ceiling on two chains; the rooms' sit on their door's header. */
const LINE_SIGNS = 2;

function plaque(c: SkCanvas, i: number) {
  const s = SIGNS[i]!;
  const big = i >= SIGNS.length - LINE_SIGNS;
  const w = big ? 18 : 14;
  if (big) for (const x of [-w / 2 + 3, w / 2 - 3]) c.drawLine(x, -14, x, -40, stroke('#5E6878', 0.6));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-w / 2 - 0.8, -14.8, w + 1.6, 13.6), 2.4, 2.4), fill('#1A1020', 0.5));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-w / 2, -14, w, 12), 2, 2), fill(s.color));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-w / 2 + 0.8, -13.2, w - 1.6, 10.4), 1.6, 1.6), stroke('#FFFFFF', 0.5, 0.55));
  s.draw(c);
}

/** The rooms' own pieces (src/data/kitchenRooms.ts RoomItem from ROOM_OWN on; the plant is the dining room's). */
export const ROOM_PIECE_SPRITES = ['roomDishMachine', 'roomDryingRack', 'roomCoolerShelf', 'roomFreezerShelf', 'roomIceChest', 'roomDesk', 'roomSafe', 'roomCoffee', 'roomBookshelf', 'roomVegSink'] as const;
export const WALL_STYLES = 3;
export const SIGN_COUNT = SIGNS.length;

const TALL: [number, number, number, number] = [-38, -106, 38, 18];
export const roomSprites: Record<string, SpriteDef> = {
  roomDishMachine: sprite([-40, -100, 40, 18], dishMachine),
  roomDryingRack: sprite([-36, -92, 36, 16], dryingRack),
  roomCoolerShelf: sprite([-36, -90, 36, 16], coolerShelf),
  roomFreezerShelf: sprite([-36, -90, 36, 16], freezerShelf),
  roomIceChest: sprite([-40, -70, 40, 18], iceChest),
  roomDesk: sprite([-46, -70, 52, 22], desk),
  roomSafe: sprite([-44, -112, 40, 16], safe),
  roomCoffee: sprite([-42, -70, 40, 18], coffee),
  roomBookshelf: sprite(TALL, bookshelf),
  roomVegSink: sprite([-40, -78, 40, 18], vegSink),
  ...Object.fromEntries(
    (['x', 'y'] as const).flatMap((along) =>
      [tileWall, coldWall, officeWall].map((draw, i) => [`wall${along.toUpperCase()}${i}`, sprite([-22, -60, 22, 12], (c) => draw(c, along))]),
    ),
  ),
  ...Object.fromEntries(
    [swingDoor, coldDoor, officeDoor].flatMap((draw, i) => [
      [`door${i}`, sprite([-22, -64, 22, 14], (c) => draw(c, false))],
      [`door${i}Open`, sprite([-48, -64, 24, 18], (c) => draw(c, true))],
    ]),
  ),
  ...Object.fromEntries(SIGNS.map((_, i) => [`roomSign${i}`, sprite([-12, -42, 12, 0], (c) => plaque(c, i))])),
};
