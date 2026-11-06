/**
 * Sprite atlas: every sprite is drawn in code once at load time and packed
 * into a single image. Rects are stored flat: [x, y, w, h, ax, ay] per sprite,
 * where (ax, ay) is the anchor inside the rect (the entity's ground point).
 */
import { ClipOp, Skia, type SkCanvas, type SkImage, type SkSurface } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

export const ATLAS_SCALE = 2;
export const RECT_STRIDE = 6;

interface Pending {
  w: number;
  h: number;
  ax: number;
  ay: number;
  draw: (canvas: SkCanvas, ox: number, oy: number) => void;
}

export interface Atlas {
  image: SkImage;
  /** Flat [x, y, w, h, ax, ay] per sprite. */
  rects: Float32Array;
  count: number;
  width: number;
  height: number;
  buildMs: number;
  /** How each sprite was drawn, kept so it can be recorded as vectors for a close zoom. */
  draws: ((canvas: SkCanvas, ox: number, oy: number) => void)[];
}

/**
 * An offscreen surface of this size, or null when there is no memory for it
 * (on the web the wrapper is made even when CanvasKit returns nothing).
 */
export function makeSurface(w: number, h: number): SkSurface | null {
  try {
    const surface = Skia.Surface.Make(w, h);
    if (!surface) return null;
    surface.getCanvas();
    return surface;
  } catch {
    return null;
  }
}

/**
 * What was drawn on the surface as an image, and the surface freed. Raster
 * surfaces hand their pixels to the snapshot, so nothing is copied; on the web
 * a copy (makeNonTextureImage reads the pixels out) would only cost memory.
 * Surfaces that are never freed fill the canvas memory within seconds.
 */
export function takeImage(surface: SkSurface): SkImage {
  surface.flush();
  const snap = surface.makeImageSnapshot();
  let image = snap;
  if (Platform.OS !== 'web') {
    image = snap.makeNonTextureImage() ?? snap;
    if (image !== snap) snap.dispose();
  }
  surface.dispose();
  return image;
}

/** A sprite drawn again at a higher resolution (f times the atlas), for a close zoom. */
export interface HiSprite {
  image: SkImage;
  f: number;
}

/**
 * Draws a sprite again from its vectors at f times the atlas resolution: used
 * instead of the atlas image when zoomed in close, so nothing looks pixelated
 * (and it is as quick to draw as the atlas).
 */
export function renderSprite(atlas: Atlas, i: number, f: number): HiSprite | null {
  const o = i * RECT_STRIDE;
  const w = atlas.rects[o + 2];
  const h = atlas.rects[o + 3];
  const surface = makeSurface(Math.ceil(w * f), Math.ceil(h * f));
  if (!surface) return null;
  const c = surface.getCanvas();
  c.clear(Skia.Color('transparent'));
  c.scale(f, f);
  c.clipRect(Skia.XYWHRect(0, 0, w, h), ClipOp.Intersect, true);
  atlas.draws[i](c, atlas.rects[o + 4], atlas.rects[o + 5]);
  return { image: takeImage(surface), f };
}

export class AtlasBuilder {
  private items: Pending[] = [];

  /**
   * Registers a sprite. Bounds are relative to the anchor (left/top negative).
   * The draw callback receives the anchor position inside the atlas.
   */
  add(left: number, top: number, right: number, bottom: number, draw: Pending['draw']): number {
    const pad = 3;
    const l = Math.floor(left) - pad;
    const t = Math.floor(top) - pad;
    const w = Math.ceil(right) + pad - l;
    const h = Math.ceil(bottom) + pad - t;
    this.items.push({ w, h, ax: -l, ay: -t, draw });
    return this.items.length - 1;
  }

  get size(): number {
    return this.items.length;
  }

  build(maxWidth = 2048): Atlas {
    const started = Date.now();
    const order = this.items.map((_, i) => i).sort((a, b) => this.items[b].h - this.items[a].h || a - b);
    const pos = new Array<{ x: number; y: number }>(this.items.length);
    let x = 0;
    let y = 0;
    let shelf = 0;
    let width = 0;
    for (const i of order) {
      const it = this.items[i];
      if (x + it.w > maxWidth) {
        x = 0;
        y += shelf;
        shelf = 0;
      }
      pos[i] = { x, y };
      x += it.w;
      width = Math.max(width, x);
      shelf = Math.max(shelf, it.h);
    }
    const height = y + shelf;
    const W = Math.max(4, width);
    const H = Math.max(4, height);
    const surface = Skia.Surface.Make(W, H);
    if (!surface) throw new Error('Could not create the atlas surface');
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    const rects = new Float32Array(this.items.length * RECT_STRIDE);
    this.items.forEach((it, i) => {
      const p = pos[i];
      canvas.save();
      canvas.clipRect(Skia.XYWHRect(p.x, p.y, it.w, it.h), ClipOp.Intersect, true);
      it.draw(canvas, p.x + it.ax, p.y + it.ay);
      canvas.restore();
      const o = i * RECT_STRIDE;
      rects[o] = p.x;
      rects[o + 1] = p.y;
      rects[o + 2] = it.w;
      rects[o + 3] = it.h;
      rects[o + 4] = it.ax;
      rects[o + 5] = it.ay;
    });
    const image = takeImage(surface);
    return { image, rects, count: this.items.length, width: W, height: H, buildMs: Date.now() - started, draws: this.items.map((it) => it.draw) };
  }
}
