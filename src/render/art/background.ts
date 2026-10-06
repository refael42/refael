import { Skia, type SkCanvas, type SkPicture } from '@shopify/react-native-skia';
import type { DiningFloor } from '../../data/buildings';
import type { Area, FloorStyle, Furniture, MapDef } from '../../data/maps';
import { PropKind } from '../../sim/types';
import { isoBounds, isoX, isoY } from '../iso';
import { darken, lighten } from './color';
import { box, onFaceX, onFaceY, onTop, rectIn } from './iso3d';
import { fill, path, stroke } from './kit';
import { propSprites } from './propArt';
import { cityOf, type CityDef } from '../../data/franchise';

// The static world: floors, back walls and outdoor ground, recorded once as a vector picture
// (crisp at every zoom). Everything standing on the floor is a sorted prop instead.

export interface BackgroundDef {
  width: number;
  height: number;
  areas: readonly Area[];
  building?: { x0: number; y0: number; x1: number; y1: number };
  wallHeight?: number;
  /** Scenery behind the walls, painted before them (trees only for now). */
  backdrop?: readonly Furniture[];
  /** Wall color of this building tier. */
  wall?: string;
  /** The crosswalk lies in front of the door. */
  doorX?: number;
  /** Where the kitchen ends: the white tiles on the back wall run this far. */
  kitchenX?: number;
  /** Rugs under the groups of tables (owner request: a room with areas, not one long grid). */
  rugs?: readonly Rug[];
  /** The branch's city: the ground, the sidewalk and the trees outside. */
  city?: number;
}

export interface Rug {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  floor: DiningFloor;
  /** Alternates from one group to the next: colors and pattern. */
  style: number;
}

/** First table column (from the kitchen line) and block width of the map generator (src/data/maps.ts). */
const TABLE_COLUMN = 2.5;
const TABLE_BLOCK = 6;

/** One rug per block of tables, a little bigger than the tables and their chairs. */
function rugsOf(map: MapDef): Rug[] {
  const first = map.kitchenX + TABLE_COLUMN;
  const blocks = new Map<number, { x: number; y: number }[]>();
  for (const t of map.tables) {
    const b = Math.floor((t.x - first + 0.01) / TABLE_BLOCK);
    blocks.set(b, [...(blocks.get(b) ?? []), t]);
  }
  return [...blocks.entries()].map(([b, spots]) => {
    const c0 = first + b * TABLE_BLOCK;
    const ys = spots.map((p) => p.y);
    return {
      x0: c0 - 1.15,
      x1: c0 + 4.05,
      y0: Math.min(...ys) - 1,
      y1: Math.min(map.building.y1 - 0.35, Math.max(...ys) + 1.15),
      floor: map.theme.dining,
      style: b % 2,
    };
  });
}

/** What the game map looks like as a background. */
export function mapBackground(map: MapDef, city = 0): BackgroundDef {
  const { width, height, areas, building, wallHeight, backdrop } = map;
  return { width, height, areas, building, wallHeight, backdrop, wall: map.theme.wall, doorX: map.doors[0]?.inside.x, kitchenX: map.kitchenX, rugs: rugsOf(map), city };
}

const TREE_ART = { palm: propSprites.treePalm, round: propSprites.treeRound, olive: propSprites.treeOlive, cypress: propSprites.treeCypress } as const;

const GOLD = '#E2B13C';
const WALL = '#4A1F4E';
const WAINSCOT = '#3A1A1E';
/** The original building's right wall length: wider tiers repeat a window section past it. */
const FIRST_WALL_LENGTH = 12;

/** Carpet colors per building tier: base, pattern squares, border band. */
const CARPETS: Record<DiningFloor, [string, string, string]> = {
  dining: ['#B3202E', '#C9303C', '#6E1220'],
  emerald: ['#11684A', '#1B8560', '#08402C'],
  royal: ['#22408F', '#2F56B5', '#132657'],
  marble: ['#EDE6D8', '#D9CDB5', '#8A6A2E'],
  velvet: ['#4A1450', '#601B68', '#250828'],
  ocean: ['#0F7C8C', '#2BB3C0', '#0A4452'],
  starlight: ['#191750', '#26246E', '#0B0A2A'],
  gold: ['#B8862A', '#D9A63A', '#3A2608'],
};

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

function carpet(c: SkCanvas, a: Area, [base, dot, border]: [string, string, string]) {
  const w = a.x1 - a.x0;
  const h = a.y1 - a.y0;
  c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, h), fill(base));
  for (let ty = a.y0; ty < a.y1; ty++) {
    for (let tx = a.x0; tx < a.x1; tx++) {
      const cx = tx + 0.5;
      const cy = ty + 0.5;
      c.drawRect(Skia.XYWHRect(cx - 0.12, cy - 0.12, 0.24, 0.24), fill(dot));
      c.drawRect(Skia.XYWHRect(cx - 0.05, cy - 0.05, 0.1, 0.1), fill(GOLD, 0.85));
    }
  }
  // Dark border band with a gold line: the room reads as a raised "plate".
  c.drawRect(Skia.XYWHRect(a.x0 + 0.25, a.y0 + 0.25, w - 0.5, h - 0.5), stroke(border, 0.5));
  c.drawRect(Skia.XYWHRect(a.x0 + 0.3, a.y0 + 0.3, w - 0.6, h - 0.6), stroke(GOLD, 0.05));
}

/** The palace floor: polished checkered marble with veins and a gold inlay at every corner. */
function marble(c: SkCanvas, a: Area) {
  const [light, dark, border] = CARPETS.marble;
  tiles(c, a, (x, y) => ((x + y) % 2 === 0 ? light : dark));
  for (let ty = a.y0; ty < a.y1; ty++) {
    for (let tx = a.x0; tx < a.x1; tx++) {
      const h = hash(tx, ty);
      c.drawLine(tx + h * 0.6, ty + 0.1, tx + 0.4 + h * 0.5, ty + 0.9, stroke('#B8A98C', 0.025, 0.6));
      c.drawRect(Skia.XYWHRect(tx - 0.06, ty - 0.06, 0.12, 0.12), fill(GOLD, 0.9));
    }
  }
  const w = a.x1 - a.x0;
  const h = a.y1 - a.y0;
  c.drawRect(Skia.XYWHRect(a.x0 + 0.25, a.y0 + 0.25, w - 0.5, h - 0.5), stroke(border, 0.5));
  c.drawRect(Skia.XYWHRect(a.x0 + 0.3, a.y0 + 0.3, w - 0.6, h - 0.6), stroke(GOLD, 0.05));
}

/** The border band and gold line every dining floor ends with. */
function floorBorder(c: SkCanvas, a: Area, border: string) {
  const w = a.x1 - a.x0;
  const h = a.y1 - a.y0;
  c.drawRect(Skia.XYWHRect(a.x0 + 0.25, a.y0 + 0.25, w - 0.5, h - 0.5), stroke(border, 0.5));
  c.drawRect(Skia.XYWHRect(a.x0 + 0.3, a.y0 + 0.3, w - 0.6, h - 0.6), stroke(GOLD, 0.05));
}

/** Sea glass blues for the resort's mosaic, now and then a white or a gold piece. */
const MOSAIC = ['#0F7C8C', '#168B9B', '#1F9DAC', '#2BB3C0', '#46C2CB'];

/** The resort floor: a mosaic of small glazed squares, and a white wave running round the edge. */
function ocean(c: SkCanvas, a: Area) {
  const [, , border] = CARPETS.ocean;
  c.drawRect(Skia.XYWHRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0), fill('#0B5E6C'));
  for (let ty = a.y0; ty < a.y1; ty++) {
    for (let tx = a.x0; tx < a.x1; tx++) {
      for (let k = 0; k < 4; k++) {
        const x = tx + (k % 2) * 0.5;
        const y = ty + Math.floor(k / 2) * 0.5;
        const h = hash(x * 2, y * 2);
        const color = h > 0.97 ? '#F2E6CC' : h > 0.95 ? GOLD : MOSAIC[Math.floor(h * MOSAIC.length * 0.999)]!;
        c.drawRect(Skia.XYWHRect(x + 0.03, y + 0.03, 0.44, 0.44), fill(color));
      }
    }
  }
  floorBorder(c, a, border);
  // The wave: a white line swinging in and out along the inside of the band.
  const wave = (from: number, to: number, at: (t: number, off: number) => [number, number]) => {
    const pts: [number, number][] = [];
    for (let t = from; t <= to; t += 0.25) pts.push(at(t, Math.sin(t * 2.4) * 0.12));
    c.drawPath(path.polyline(pts), stroke('#F2FBFA', 0.06, 0.85));
  };
  wave(a.x0 + 0.8, a.x1 - 0.8, (t, o) => [t, a.y0 + 0.75 + o]);
  wave(a.y0 + 0.8, a.y1 - 0.8, (t, o) => [a.x0 + 0.75 + o, t]);
}

/** The galaxy floor: a night-blue carpet with a faint lattice and golden stars of every size. */
function starlight(c: SkCanvas, a: Area) {
  const [base, line, border] = CARPETS.starlight;
  c.drawRect(Skia.XYWHRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0), fill(base));
  for (let x = a.x0 + 1; x < a.x1; x++) c.drawLine(x, a.y0, x, a.y1, stroke(line, 0.04));
  for (let y = a.y0 + 1; y < a.y1; y++) c.drawLine(a.x0, y, a.x1, y, stroke(line, 0.04));
  for (let ty = a.y0; ty < a.y1; ty++) {
    for (let tx = a.x0; tx < a.x1; tx++) {
      const h = hash(tx, ty);
      const cx = tx + 0.2 + hash(ty, tx) * 0.6;
      const cy = ty + 0.2 + hash(tx + 3, ty) * 0.6;
      if (h > 0.62) {
        const r = 0.08 + (h - 0.62) * 0.45;
        c.drawPath(path.poly([[cx, cy - r], [cx + r * 0.28, cy - r * 0.28], [cx + r, cy], [cx + r * 0.28, cy + r * 0.28], [cx, cy + r], [cx - r * 0.28, cy + r * 0.28], [cx - r, cy], [cx - r * 0.28, cy - r * 0.28]]), fill(h > 0.9 ? '#FFF2B8' : GOLD, 0.9));
      } else if (h > 0.4) c.drawCircle(cx, cy, 0.03, fill('#C9D4FF', 0.7));
    }
  }
  floorBorder(c, a, border);
}

/** Rug colors per dining floor, two styles each: base, border band, pattern. */
const RUGS: Record<DiningFloor, readonly [string, string, string][]> = {
  dining: [['#EAD9B2', '#7E1E2A', '#C9A35A'], ['#2E3A6E', '#EAD9B2', '#E2B13C']],
  emerald: [['#E8DCC0', '#0E4A35', '#C9A35A'], ['#5A1E3A', '#E8DCC0', '#E2B13C']],
  royal: [['#EFE6D0', '#1A2D66', '#C9A35A'], ['#7A1F2E', '#EFE6D0', '#E2B13C']],
  marble: [['#7A1F2E', '#E2B13C', '#F2D48A'], ['#1A2D66', '#E2B13C', '#9FB4E8']],
  velvet: [['#1E1440', '#E2B13C', '#8E7BD6'], ['#0E3A3A', '#E2B13C', '#7FD6C2']],
  ocean: [['#F2E6CC', '#0A5A6A', '#E2B13C'], ['#E8714E', '#F6E9D2', '#FFFFFF']],
  starlight: [['#2C1F66', '#E2B13C', '#9FB4E8'], ['#0C0B2E', '#C9A35A', '#FFE27A']],
  gold: [['#1E1508', '#E2B13C', '#FFF1B8'], ['#7A1F2E', '#FFE27A', '#FFFFFF']],
};

/** The crown's floor: gold parquet in a checker of two tones, with a black diamond at every corner. */
function gold(c: SkCanvas, a: Area) {
  const [base, light, border] = CARPETS.gold;
  tiles(c, a, (x, y) => ((x + y) % 2 === 0 ? base : light));
  for (let ty = a.y0; ty <= a.y1; ty++) {
    for (let tx = a.x0; tx <= a.x1; tx++) {
      c.drawPath(path.poly([[tx, ty - 0.12], [tx + 0.12, ty], [tx, ty + 0.12], [tx - 0.12, ty]]), fill(border));
    }
  }
  for (let ty = a.y0; ty < a.y1; ty++) {
    for (let tx = a.x0; tx < a.x1; tx++) if (hash(tx, ty) > 0.8) c.drawCircle(tx + 0.5, ty + 0.5, 0.05, fill('#FFF1B8', 0.8));
  }
  floorBorder(c, a, border);
}

/** A rug on the floor plane: a soft edge, a border band, a diamond or dotted field, fringes. */
function rug(c: SkCanvas, r: Rug) {
  const [base, border, accent] = RUGS[r.floor][r.style % 2]!;
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const rr = (inset: number) => Skia.RRectXY(Skia.XYWHRect(r.x0 + inset, r.y0 + inset, w - inset * 2, h - inset * 2), 0.12, 0.12);
  c.drawRRect(rr(-0.04), fill(darken(base, 0.35), 0.6));
  c.drawRRect(rr(0), fill(base));
  c.drawRRect(rr(0.32), stroke(border, 0.3));
  c.drawRRect(rr(0.14), stroke(accent, 0.05));
  c.drawRRect(rr(0.52), stroke(accent, 0.05));
  // The field: a diamond lattice, or rows of dots.
  for (let y = r.y0 + 1; y < r.y1 - 0.8; y += 1) {
    for (let x = r.x0 + 1; x < r.x1 - 0.8; x += 1) {
      if (r.style % 2 === 0) {
        c.drawPath(path.poly([[x, y - 0.22], [x + 0.22, y], [x, y + 0.22], [x - 0.22, y]]), fill(accent, 0.45));
      } else c.drawCircle(x, y, 0.09, fill(accent, 0.6));
    }
  }
  // Fringes on the two short ends.
  for (let y = r.y0 + 0.1; y < r.y1 - 0.05; y += 0.16) {
    c.drawRect(Skia.XYWHRect(r.x0 - 0.12, y, 0.12, 0.05), fill(lighten(base, 0.2)));
    c.drawRect(Skia.XYWHRect(r.x1, y, 0.12, 0.05), fill(lighten(base, 0.2)));
  }
}

function floor(c: SkCanvas, a: Area, doorX: number, city: CityDef) {
  const w = a.x1 - a.x0;
  const h = a.y1 - a.y0;
  const painters: Record<FloorStyle, () => void> = {
    // The outdoors take the city's colors (Jerusalem stone, Eilat sand...).
    grass: () => {
      const [g0, g1, speck] = city.ground;
      tiles(c, a, (x, y) => ((x + y) % 2 === 0 ? g0 : g1));
      for (let ty = a.y0; ty < a.y1; ty++) {
        for (let tx = a.x0; tx < a.x1; tx++) {
          if (hash(tx, ty) > 0.7) c.drawCircle(tx + hash(ty, tx), ty + hash(tx + 1, ty), 0.06, fill(speck));
        }
      }
    },
    sidewalk: () => {
      const [s0, s1, joint] = city.sidewalk;
      tiles(c, a, (x, y) => ((x + y) % 2 === 0 ? s0 : s1));
      for (let tx = a.x0; tx <= a.x1; tx++) c.drawRect(Skia.XYWHRect(tx - 0.01, a.y0, 0.02, h), fill(joint));
    },
    road: () => {
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, h), fill('#3A3E4B'));
      const mid = a.y0 + h / 2;
      for (let x = a.x0 + 0.2; x < a.x1; x += 1.2) c.drawRect(Skia.XYWHRect(x, mid - 0.04, 0.6, 0.08), fill('#F2C14E'));
      // Crosswalk in front of the entrance.
      for (let y = a.y0 + 0.25; y < a.y1 - 0.2; y += 0.5) c.drawRect(Skia.XYWHRect(doorX - 0.9, y, 1.8, 0.25), fill('#E9E6E0'));
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, 0.12), fill('#8F8880'));
      // The far curb, across the road.
      c.drawRect(Skia.XYWHRect(a.x0, a.y1 - 0.12, w, 0.12), fill('#8F8880'));
    },
    // The park across the street: a lusher green, little flowers in the grass.
    park: () => {
      const [g0, g1] = city.ground;
      tiles(c, a, (x, y) => ((x + y) % 2 === 0 ? lighten(g0, 0.06) : lighten(g1, 0.1)));
      const blooms = ['#FFFFFF', '#FFD23F', '#F38DB3', '#B9A3FF'];
      for (let ty = a.y0; ty < a.y1; ty++) {
        for (let tx = a.x0; tx < a.x1; tx++) {
          const h = hash(tx, ty);
          if (h > 0.55) c.drawCircle(tx + hash(ty, tx), ty + hash(tx + 1, ty), 0.05, fill(darken(g0, 0.18)));
          if (h > 0.82) c.drawCircle(tx + hash(ty + 2, tx), ty + hash(tx, ty + 2), 0.07, fill(blooms[Math.floor(h * 97) % blooms.length]!));
        }
      }
    },
    // The plaza: pale stone pavers in a herringbone of two tones, with a darker border.
    plaza: () => {
      for (let ty = a.y0; ty < a.y1; ty += 0.5) {
        for (let tx = a.x0; tx < a.x1; tx += 0.5) {
          const odd = (Math.round(tx * 2) + Math.round(ty * 2)) % 2 === 0;
          c.drawRect(Skia.XYWHRect(tx, ty, 0.5, 0.5), fill(odd ? '#E7DDCB' : '#D9CCB4'));
        }
      }
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, h), stroke('#A8987C', 0.1));
      c.drawRect(Skia.XYWHRect(a.x0 + 0.35, a.y0 + 0.35, w - 0.7, h - 0.7), stroke('#C3B396', 0.05));
    },
    // Gravel paths in the park.
    gravel: () => {
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, h), fill('#D8C9A3'));
      for (let ty = a.y0; ty < a.y1; ty++) {
        for (let tx = a.x0; tx < a.x1; tx++) {
          for (let k = 0; k < 4; k++) c.drawCircle(tx + hash(tx + k, ty), ty + hash(ty, tx + k), 0.03, fill('#B9A77E'));
        }
      }
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, 0.05), fill('#B9A77E'));
      c.drawRect(Skia.XYWHRect(a.x0, a.y1 - 0.05, w, 0.05), fill('#B9A77E'));
    },
    kitchen: () => tiles(c, a, (x, y) => ((x + y) % 2 === 0 ? '#EDEAE4' : '#37333F')),
    dining: () => carpet(c, a, CARPETS.dining),
    emerald: () => carpet(c, a, CARPETS.emerald),
    royal: () => carpet(c, a, CARPETS.royal),
    marble: () => marble(c, a),
    velvet: () => carpet(c, a, CARPETS.velvet),
    ocean: () => ocean(c, a),
    starlight: () => starlight(c, a),
    gold: () => gold(c, a),
    // Land for a later building: the city's grass, dimmed, with a faint diagonal hatch.
    locked: () => {
      const [g0, g1] = city.ground;
      tiles(c, a, (x, y) => ((x + y) % 2 === 0 ? darken(g0, 0.32) : darken(g1, 0.32)));
      for (let k = a.x0 - (a.y1 - a.y0); k < a.x1; k += 0.9) {
        c.drawLine(Math.max(a.x0, k), Math.max(a.y0, a.y0 + (a.x0 - k)), Math.min(a.x1, k + (a.y1 - a.y0)), Math.min(a.y1, a.y0 + (a.x1 - k)), stroke('#1C1424', 0.05, 0.25));
      }
    },
    // Stepping stones from the sidewalk to the door.
    path: () => {
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, h), fill(city.sidewalk[1]));
      for (let y = a.y0 + 0.08; y < a.y1 - 0.05; y += 0.5) {
        const off = Math.round((y - a.y0) * 2) % 2 === 0 ? 0 : 0.25;
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(a.x0 + 0.1 + off, y, 0.55, 0.38), 0.08, 0.08), fill(city.sidewalk[0]));
      }
      c.drawRect(Skia.XYWHRect(a.x0, a.y0, w, h), stroke(city.sidewalk[2], 0.04));
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

function wallFace(c: SkCanvas, length: number, H: number, tiledUntil: number, wall: string) {
  rectIn(c, 0, 0, length, H, wall);
  rectIn(c, 0, 0, length, 18, WAINSCOT);
  rectIn(c, 0, 18, length, 1.6, GOLD);
  rectIn(c, 0, H - 5, length, 2, GOLD);
  for (let a = 0.5; a < length; a += 1) rectIn(c, a - 0.01, 22, 0.02, H - 30, lighten(wall, 0.06));
  if (tiledUntil > 0) {
    // White tiles behind the cooking line.
    rectIn(c, 0, 18, tiledUntil, 26, '#F1EEE8');
    for (let b = 22; b < 44; b += 4) rectIn(c, 0, b, tiledUntil, 0.5, '#CFD8DE');
    for (let a = 0.25; a < tiledUntil; a += 0.25) rectIn(c, a, 18, 0.01, 26, '#CFD8DE');
  }
}

/** Color sets for the paintings along a long wall. */
const ART: readonly string[][] = [
  ['#47B2BE', '#F2C14E', '#E5483B'],
  ['#8E7BD6', '#F06FA0', '#FFE9A8'],
  ['#3FA65A', '#F2C14E', '#2A6AE0'],
  ['#E5483B', '#FFFFFF', '#47B2BE'],
];

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

function walls(c: SkCanvas, b: NonNullable<BackgroundDef['building']>, H: number, wall: string, kitchen: number) {
  const lenY = b.y1 - b.y0;
  const lenX = b.x1 - b.x0;
  // A wider kitchen pushes the dining room's paintings and windows along by as much.
  const k = kitchen - 4;
  // Left wall (along x = x0, faces +x). Face coords: a = 0 at the front end (y1).
  box(c, { x: b.x0 - 0.07, y: (b.y0 + b.y1) / 2, w: 0.14, d: lenY, h: H, color: darken(wall, 0.2), rim: true });
  onFaceX(c, b.x0, b.y1, () => {
    wallFace(c, lenY, H, lenY, wall);
    windowPane(c, 4.4, 26, 1.2, 16);
  });
  // Right wall (along y = y0, faces +y). Face coords: a = 0 at the back corner (x0).
  box(c, { x: (b.x0 + b.x1) / 2, y: b.y0 - 0.07, w: lenX + 0.14, d: 0.14, h: H, color: darken(wall, 0.2), rim: true });
  onFaceY(c, b.y0, b.x0, () => {
    wallFace(c, lenX, H, kitchen, wall);
    painting(c, k + 5.2, 28, 1.3, 18, ['#E5483B', '#F2C14E', '#47B2BE']);
    windowPane(c, k + 10.6, 24, 1.8, 22);
    for (const a of [4.6, 7, 10.2, 12.8]) sconce(c, k + a, 44);
    // Each added section (6 tiles) gets its own neon sign (a prop), a window and lights.
    for (let s = k + FIRST_WALL_LENGTH, n = 0; s + 6 <= lenX; s += 6, n++) {
      windowPane(c, s + 3.4, 24, 1.8, 22);
      for (const a of [s + 3.0, s + 5.6]) sconce(c, a, 44);
      // A painting of its own in every section, so the long wall is not the same thing again and again.
      painting(c, s + 0.9, 28, 1.2, 18, ART[n % ART.length]!);
    }
  });
  for (const [x, y] of [[b.x0, b.y0], [b.x0, b.y1], [b.x1, b.y0]] as const) {
    box(c, { x, y, w: 0.3, d: 0.3, h: H + 6, color: '#2A1530', rim: true });
    box(c, { x, y, z: H + 6, w: 0.36, d: 0.36, h: 3, color: GOLD, rim: true });
  }
}

export function recordBackground(def: BackgroundDef): SkPicture {
  const city = cityOf(def.city ?? 0);
  const bounds = isoBounds(def.width, def.height, 140);
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(bounds.minX - 20, bounds.minY - 20, bounds.maxX - bounds.minX + 40, bounds.maxY - bounds.minY + 40));
  onTop(c, 0, () => {
    for (const a of def.areas) floor(c, a, def.doorX ?? 12.5, city);
    for (const r of def.rugs ?? []) rug(c, r);
  });
  for (const a of def.areas) if (a.floor === 'lot' || a.floor === 'locked') lotFence(c, a);
  // Back to front, so nearer trees overlap farther ones.
  for (const f of [...(def.backdrop ?? [])].sort((p, q) => p.x + p.y - (q.x + q.y))) {
    if (f.kind !== PropKind.Tree) continue;
    c.save();
    c.translate(isoX(f.x, f.y), isoY(f.x, f.y, 0));
    TREE_ART[city.trees[f.variant === 1 ? 1 : 0]].draw(c);
    c.restore();
  }
  if (def.building) walls(c, def.building, def.wallHeight ?? 64, def.wall ?? WALL, (def.kitchenX ?? def.building.x0 + 4) - def.building.x0);
  return rec.finishRecordingAsPicture();
}
