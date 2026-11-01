/**
 * Sprite atlas: every sprite is drawn in code once at load time and packed
 * into a single image. Rects are stored flat: [x, y, w, h, ax, ay] per sprite,
 * where (ax, ay) is the anchor inside the rect (the entity's ground point).
 */
import { ClipOp, Skia, type SkCanvas, type SkImage } from '@shopify/react-native-skia';

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
    surface.flush();
    const snap = surface.makeImageSnapshot();
    const image = snap.makeNonTextureImage() ?? snap;
    return { image, rects, count: this.items.length, width: W, height: H, buildMs: Date.now() - started };
  }
}
