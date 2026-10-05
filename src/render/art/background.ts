import { Skia, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';
import type { Area, FloorStyle } from '../../data/maps';
import { isoBounds } from '../iso';
import { darken, lighten } from './color';
import { box, onFaceX, onFaceY, onTop, rectIn } from './iso3d';
import { fill, stroke } from './kit';

// The static world: floors, back walls and outdoor ground, recorded once as a vector picture
// (crisp at every zoom). Everything standing on the floor is a sorted prop instead.

export interface BackgroundDef {
  width: number;
  height: number;
  areas: readonly Area[];
  building?: { x0: number; y0: number; x1: number; y1: number };
  wallHeight?: number;
}

const GOLD = '#E2B13C';
const WALL = '#4A1F4E';
const WAINSCOT = '#3A1A1E';

/** Cheap deterministic per-tile noise for natural variation. */
const hash = (x: number, y: number) => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

function tiles(c: SkCanvas, a: Area, colorAt: (tx: number, ty: number) => string) {
  for (let ty = a.y0; ty < a.y1; ty++) {
    for (let tx = a.x0; tx < a.x1; tx++) c.drawRect(Skia.XYWHRect(tx, ty, 1, 1), fill(colorAt(tx, ty)));
  }
}

function floor(c: SkCanvas, a: Area) {
  const w = a.x1 - a.x0;
  const h = a.y1 - a.y0;
  const painters: Record<FloorStyle, () => void> = {
    grass: () => {
      tiles(c, a, (x, y) => ((x + y) % 2 === 0 ? '#3E9150' : '#43994F'));
      for (let ty = a.y0; ty < a.y1; ty++) {
        for (let tx = a.x0; tx < a.x1; tx++) {
          if (hash(tx, ty) > 0.7) c.drawCircle(tx + hash(ty, tx), ty + hash(tx + 1, ty), 0.06, fill('#2F7A3E'));
        }
      }
    },
    sidewalk: () => {
      tiles(c, a, (x, y) => ((x + y) % 2 === 0 ? '#D8D2CA' : '#CBC4BB'));
      for (let tx = a.x0; tx <= a.x1; tx++) c.drawRect(Skia.XYWHRect(tx - 0.01, a.y0, 0.02, h), fill('#B2AAA0'));
    },
    road: () => {
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, h), fill('#3A3E4B'));
      const mid = a.y0 + h / 2;
      for (let x = a.x0 + 0.2; x < a.x1; x += 1.2) c.drawRect(Skia.XYWHRect(x, mid - 0.04, 0.6, 0.08), fill('#F2C14E'));
      // Crosswalk in front of the entrance.
      for (let y = a.y0 + 0.25; y < a.y1 - 0.2; y += 0.5) c.drawRect(Skia.XYWHRect(11.6, y, 1.8, 0.25), fill('#E9E6E0'));
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, 0.12), fill('#8F8880'));
    },
    kitchen: () => tiles(c, a, (x, y) => ((x + y) % 2 === 0 ? '#EDEAE4' : '#37333F')),
    dining: () => {
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, h), fill('#B3202E'));
      for (let ty = a.y0; ty < a.y1; ty++) {
        for (let tx = a.x0; tx < a.x1; tx++) {
          const cx = tx + 0.5;
          const cy = ty + 0.5;
          c.drawRect(Skia.XYWHRect(cx - 0.12, cy - 0.12, 0.24, 0.24), fill('#C9303C'));
          c.drawRect(Skia.XYWHRect(cx - 0.05, cy - 0.05, 0.1, 0.1), fill(GOLD, 0.85));
        }
      }
      // Dark border band with a gold line: the room reads as a raised "plate".
      c.drawRect(Skia.XYWHRect(a.x0 + 0.25, a.y0 + 0.25, w - 0.5, h - 0.5), stroke('#6E1220', 0.5));
      c.drawRect(Skia.XYWHRect(a.x0 + 0.3, a.y0 + 0.3, w - 0.6, h - 0.6), stroke(GOLD, 0.05));
    },
    lot: () => {
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, h), fill('#C9A36B'));
      for (let ty = a.y0; ty < a.y1; ty++) {
        for (let tx = a.x0; tx < a.x1; tx++) {
          for (let k = 0; k < 3; k++) c.drawCircle(tx + hash(tx + k, ty), ty + hash(ty, tx + k), 0.035, fill('#A88654'));
        }
      }
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, h), stroke('#8C6A3E', 0.08));
    },
  };
  painters[a.floor]();
}

function lotFence(c: SkCanvas, a: Area) {
  for (let x = a.x0; x <= a.x1; x += 0.5) box(c, { x, y: a.y0, w: 0.06, d: 0.06, h: 14, color: '#E8E2D6' });
  for (let y = a.y0 + 0.5; y <= a.y1; y += 0.5) box(c, { x: a.x0, y, w: 0.06, d: 0.06, h: 14, color: '#E8E2D6' });
  box(c, { x: (a.x0 + a.x1) / 2, y: a.y0, z: 10, w: a.x1 - a.x0, d: 0.04, h: 2, color: '#F4F0E8' });
  box(c, { x: a.x0, y: (a.y0 + a.y1) / 2, z: 10, w: 0.04, d: a.y1 - a.y0, h: 2, color: '#F4F0E8' });
}

function wallFace(c: SkCanvas, length: number, H: number, tiledUntil: number) {
  rectIn(c, 0, 0, length, H, WALL);
  rectIn(c, 0, 0, length, 18, WAINSCOT);
  rectIn(c, 0, 18, length, 1.6, GOLD);
  rectIn(c, 0, H - 5, length, 2, GOLD);
  for (let a = 0.5; a < length; a += 1) rectIn(c, a - 0.01, 22, 0.02, H - 30, lighten(WALL, 0.06));
  if (tiledUntil > 0) {
    // White tiles behind the cooking line.
    rectIn(c, 0, 18, tiledUntil, 26, '#F1EEE8');
    for (let b = 22; b < 44; b += 4) rectIn(c, 0, b, tiledUntil, 0.5, '#CFD8DE');
    for (let a = 0.25; a < tiledUntil; a += 0.25) rectIn(c, a, 18, 0.01, 26, '#CFD8DE');
  }
}

function painting(c: SkCanvas, a: number, b: number, w: number, h: number, colors: string[]) {
  rectIn(c, a - 0.05, b - 2, w + 0.1, h + 4, GOLD);
  rectIn(c, a, b, w, h, '#1C1424');
  colors.forEach((col, i) => rectIn(c, a + (w / colors.length) * i, b + 2 + (i % 2) * 4, w / colors.length, h - 8, col));
}

function windowPane(c: SkCanvas, a: number, b: number, w: number, h: number) {
  rectIn(c, a - 0.05, b - 2, w + 0.1, h + 4, GOLD);
  rectIn(c, a, b, w, h, '#8FD3FF');
  rectIn(c, a, b + h * 0.55, w, h * 0.45, '#BDE6FF');
  for (const [x, bh, col] of [[0.05, 10, '#5C4A7A'], [0.3, 16, '#6E5A8C'], [0.55, 8, '#4E3E6A'], [0.75, 13, '#6E5A8C']] as const) {
    rectIn(c, a + w * x, b, w * 0.2, bh, col);
  }
  rectIn(c, a + w / 2 - 0.015, b, 0.03, h, GOLD);
  rectIn(c, a, b + h / 2 - 0.6, w, 1.2, GOLD);
}

function sconce(c: SkCanvas, a: number, b: number) {
  rectIn(c, a - 0.04, b, 0.08, 6, GOLD);
  rectIn(c, a - 0.07, b + 6, 0.14, 4, '#FFE9A8');
}

function walls(c: SkCanvas, b: NonNullable<BackgroundDef['building']>, H: number) {
  const lenY = b.y1 - b.y0;
  const lenX = b.x1 - b.x0;
  // Left wall (along x = x0, faces +x). Face coords: a = 0 at the front end (y1).
  box(c, { x: b.x0 - 0.07, y: (b.y0 + b.y1) / 2, w: 0.14, d: lenY, h: H, color: darken(WALL, 0.2), rim: true });
  onFaceX(c, b.x0, b.y1, () => {
    wallFace(c, lenY, H, lenY);
    windowPane(c, 4.4, 26, 1.2, 16);
  });
  // Right wall (along y = y0, faces +y). Face coords: a = 0 at the back corner (x0).
  box(c, { x: (b.x0 + b.x1) / 2, y: b.y0 - 0.07, w: lenX + 0.14, d: 0.14, h: H, color: darken(WALL, 0.2), rim: true });
  onFaceY(c, b.y0, b.x0, () => {
    wallFace(c, lenX, H, 4);
    painting(c, 5.2, 28, 1.3, 18, ['#E5483B', '#F2C14E', '#47B2BE']);
    windowPane(c, 10.6, 24, 1.8, 22);
    for (const a of [4.6, 7, 10.2, 12.8]) sconce(c, a, 44);
  });
  for (const [x, y] of [[b.x0, b.y0], [b.x0, b.y1], [b.x1, b.y0]] as const) {
    box(c, { x, y, w: 0.3, d: 0.3, h: H + 6, color: '#2A1530', rim: true });
    box(c, { x, y, z: H + 6, w: 0.36, d: 0.36, h: 3, color: GOLD, rim: true });
  }
}

export function recordBackground(def: BackgroundDef): SkPicture {
  const bounds = isoBounds(def.width, def.height, 140);
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(bounds.minX - 20, bounds.minY - 20, bounds.maxX - bounds.minX + 40, bounds.maxY - bounds.minY + 40));
  onTop(c, 0, () => {
    for (const a of def.areas) floor(c, a);
  });
  for (const a of def.areas) if (a.floor === 'lot') lotFence(c, a);
  if (def.building) walls(c, def.building, def.wallHeight ?? 64);
  return rec.finishRecordingAsPicture();
}
