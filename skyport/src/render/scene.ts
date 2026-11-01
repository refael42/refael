/**
 * Snapshot format and the UI-thread renderer.
 *
 * The JS thread writes one flat Float32Array per frame (SnapWriter). The
 * worklet `renderScene` reads only that array plus the atlas resources and
 * records a Skia picture. Layout:
 *   header (HEADER floats) | shadows | sprites (depth sorted) | fx | overlay | bars
 */
import {
  BlendMode,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  type SkColor,
  type SkHostRect,
  type SkImage,
  type SkPaint,
  type SkPicture,
  type SkRSXform,
} from '@shopify/react-native-skia';

import { ATLAS_SCALE, RECT_STRIDE } from './atlas';
import type { GroundTile } from './ground';

export const HEADER = 12;
export const H_SHADOWS = 0;
export const H_SPRITES = 1;
export const H_OVERLAY = 2;
export const H_BARS = 3;
export const H_CAMX = 4;
export const H_CAMY = 5;
export const H_ZOOM = 6;
export const H_SKY = 7; // packed 0xRRGGBB background color
export const H_DARK = 8; // night darkness 0..1
export const H_FX = 9;

export const SHADOW_STRIDE = 5; // sprite, x, y, scale, alpha
export const SPRITE_STRIDE = 4; // sprite, x, y, scale
export const BAR_STRIDE = 6; // x, y, w, progress, rgb, kind

export const MAX_SHADOWS = 600;
export const MAX_SPRITES = 3000;
export const MAX_OVERLAY = 800;
export const MAX_BARS = 200;
export const MAX_FX = 300;
export const POOL = MAX_SHADOWS + MAX_SPRITES + MAX_OVERLAY + MAX_FX;

export class SnapWriter {
  private shadows = new Float32Array(MAX_SHADOWS * SHADOW_STRIDE);
  private sprites = new Float32Array(MAX_SPRITES * SPRITE_STRIDE);
  private keys = new Float64Array(MAX_SPRITES);
  private order = new Float64Array(MAX_SPRITES);
  private overlay = new Float32Array(MAX_OVERLAY * SPRITE_STRIDE);
  private bars = new Float32Array(MAX_BARS * BAR_STRIDE);
  private fxs = new Float32Array(MAX_FX * SHADOW_STRIDE);
  nFx = 0;
  nShadows = 0;
  nSprites = 0;
  nOverlay = 0;
  nBars = 0;
  camX = 0;
  camY = 0;
  zoom = 1;
  sky = 0x7cc36b;
  dark = 0;

  begin(camX: number, camY: number, zoom: number): void {
    this.nShadows = 0;
    this.nSprites = 0;
    this.nOverlay = 0;
    this.nBars = 0;
    this.nFx = 0;
    this.camX = camX;
    this.camY = camY;
    this.zoom = zoom;
  }

  shadow(sprite: number, x: number, y: number, scale: number, alpha: number): void {
    if (this.nShadows >= MAX_SHADOWS || sprite < 0) return;
    const o = this.nShadows++ * SHADOW_STRIDE;
    const a = this.shadows;
    a[o] = sprite;
    a[o + 1] = x;
    a[o + 2] = y;
    a[o + 3] = scale;
    a[o + 4] = alpha;
  }

  /** Ground decal in its own colors (drawn with the shadows, under everything). */
  decal(sprite: number, x: number, y: number, scale: number, alpha: number): void {
    // alpha above 1 tells the renderer "keep colors" (shadows are tinted black)
    this.shadow(sprite, x, y, scale, 1 + Math.max(0, Math.min(1, alpha)));
  }

  /** Sprite with its own colors and an alpha, drawn after the sorted sprites. */
  fx(sprite: number, x: number, y: number, scale: number, alpha: number): void {
    if (this.nFx >= MAX_FX || sprite < 0 || alpha <= 0.003) return;
    const o = this.nFx++ * SHADOW_STRIDE;
    const a = this.fxs;
    a[o] = sprite;
    a[o + 1] = x;
    a[o + 2] = y;
    a[o + 3] = scale;
    a[o + 4] = Math.min(1, alpha);
  }

  /** depth: larger = closer to the viewer (drawn later). */
  sprite(sprite: number, x: number, y: number, scale: number, depth: number): void {
    if (this.nSprites >= MAX_SPRITES || sprite < 0) return;
    const i = this.nSprites++;
    const o = i * SPRITE_STRIDE;
    const a = this.sprites;
    a[o] = sprite;
    a[o + 1] = x;
    a[o + 2] = y;
    a[o + 3] = scale;
    this.keys[i] = depth;
  }

  over(sprite: number, x: number, y: number, scale: number): void {
    if (this.nOverlay >= MAX_OVERLAY || sprite < 0) return;
    const o = this.nOverlay++ * SPRITE_STRIDE;
    const a = this.overlay;
    a[o] = sprite;
    a[o + 1] = x;
    a[o + 2] = y;
    a[o + 3] = scale;
  }

  bar(x: number, y: number, w: number, progress: number, rgb: number, kind = 0): void {
    if (this.nBars >= MAX_BARS) return;
    const o = this.nBars++ * BAR_STRIDE;
    const a = this.bars;
    a[o] = x;
    a[o + 1] = y;
    a[o + 2] = w;
    a[o + 3] = progress;
    a[o + 4] = rgb;
    a[o + 5] = kind;
  }

  /** Packs everything into a fresh array (the only per-frame allocation). */
  finish(): Float32Array {
    const n = this.nSprites;
    // Stable depth sort without allocations: sort (quantized depth, index) pairs.
    const ord = this.order.subarray(0, n);
    for (let i = 0; i < n; i++) ord[i] = Math.round(this.keys[i] * 256) * 8192 + i;
    ord.sort();
    const total = HEADER + this.nShadows * SHADOW_STRIDE + n * SPRITE_STRIDE + this.nFx * SHADOW_STRIDE + this.nOverlay * SPRITE_STRIDE + this.nBars * BAR_STRIDE;
    const out = new Float32Array(total);
    out[H_SHADOWS] = this.nShadows;
    out[H_SPRITES] = n;
    out[H_OVERLAY] = this.nOverlay;
    out[H_BARS] = this.nBars;
    out[H_CAMX] = this.camX;
    out[H_CAMY] = this.camY;
    out[H_ZOOM] = this.zoom;
    out[H_SKY] = this.sky;
    out[H_DARK] = this.dark;
    out[H_FX] = this.nFx;
    let p = HEADER;
    out.set(this.shadows.subarray(0, this.nShadows * SHADOW_STRIDE), p);
    p += this.nShadows * SHADOW_STRIDE;
    for (let k = 0; k < n; k++) {
      const v = ord[k];
      const i = v - Math.floor(v / 8192) * 8192;
      const o = i * SPRITE_STRIDE;
      out[p++] = this.sprites[o];
      out[p++] = this.sprites[o + 1];
      out[p++] = this.sprites[o + 2];
      out[p++] = this.sprites[o + 3];
    }
    out.set(this.fxs.subarray(0, this.nFx * SHADOW_STRIDE), p);
    p += this.nFx * SHADOW_STRIDE;
    out.set(this.overlay.subarray(0, this.nOverlay * SPRITE_STRIDE), p);
    p += this.nOverlay * SPRITE_STRIDE;
    out.set(this.bars.subarray(0, this.nBars * BAR_STRIDE), p);
    return out;
  }
}

/** Skia resources the worklet draws with. Lives in a shared value. */
export interface RenderRes {
  image: SkImage;
  rects: Float32Array;
  bg: SkPicture | null;
  /** Baked ground tiles (preferred over bg when present). */
  tiles: GroundTile[];
  tileSrc: SkHostRect;
  tileDst: SkHostRect;
  srcPool: SkHostRect[];
  xfPool: SkRSXform[];
  colPool: SkColor[];
  paint: SkPaint;
  shadowPaint: SkPaint;
  barPaint: SkPaint;
}

export function makeRenderRes(image: SkImage, rects: Float32Array, bg: SkPicture | null, tiles: GroundTile[] = []): RenderRes {
  const srcPool: SkHostRect[] = [];
  const xfPool: SkRSXform[] = [];
  const colPool: SkColor[] = [];
  for (let i = 0; i < POOL; i++) {
    srcPool.push(Skia.XYWHRect(0, 0, 1, 1));
    xfPool.push(Skia.RSXform(1, 0, 0, 0));
  }
  for (let i = 0; i < MAX_SHADOWS + MAX_FX; i++) colPool.push(Skia.Color('black'));
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const shadowPaint = Skia.Paint();
  shadowPaint.setAntiAlias(true);
  const barPaint = Skia.Paint();
  barPaint.setAntiAlias(true);
  barPaint.setStyle(PaintStyle.Fill);
  return { image, rects, bg, tiles, tileSrc: Skia.XYWHRect(0, 0, 1, 1), tileDst: Skia.XYWHRect(0, 0, 1, 1), srcPool, xfPool, colPool, paint, shadowPaint, barPaint };
}

const INV_ATLAS = 1 / ATLAS_SCALE;
const SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear };

/** Records the frame. Runs on the UI thread. */
export function renderScene(snap: Float32Array, res: RenderRes, width: number, height: number): SkPicture {
  'worklet';
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
  const sky = snap.length > H_SKY ? snap[H_SKY] : 0x7cc36b;
  const sr = (sky >> 16) & 255;
  const sg = (sky >> 8) & 255;
  const sb = sky & 255;
  c.drawColor(Skia.Color(`rgb(${sr},${sg},${sb})`));
  if (snap.length < HEADER) return rec.finishRecordingAsPicture();

  const zoom = snap[H_ZOOM] || 1;
  c.save();
  c.translate(width / 2 - snap[H_CAMX] * zoom, height / 2 - snap[H_CAMY] * zoom);
  c.scale(zoom, zoom);
  if (res.tiles.length > 0) {
    // visible part of the world in world-screen px
    const vx0 = snap[H_CAMX] - width / 2 / zoom;
    const vy0 = snap[H_CAMY] - height / 2 / zoom;
    const vx1 = snap[H_CAMX] + width / 2 / zoom;
    const vy1 = snap[H_CAMY] + height / 2 / zoom;
    for (let i = 0; i < res.tiles.length; i++) {
      const t = res.tiles[i];
      if (t.x + t.w < vx0 || t.x > vx1 || t.y + t.h < vy0 || t.y > vy1) continue;
      res.tileSrc.setXYWH(0, 0, t.image.width(), t.image.height());
      // a hair of overlap hides seams between tiles
      res.tileDst.setXYWH(t.x, t.y, t.w + 0.6 / zoom, t.h + 0.6 / zoom);
      c.drawImageRect(t.image, res.tileSrc, res.tileDst, res.paint);
    }
  } else if (res.bg) c.drawPicture(res.bg);

  const R = res.rects;
  let p = HEADER;
  let pool = 0;

  // shadows (black), sorted sprites, fx (own colors, alpha), overlay
  for (let pass = 0; pass < 4; pass++) {
    const n = snap[pass === 0 ? H_SHADOWS : pass === 1 ? H_SPRITES : pass === 2 ? H_FX : H_OVERLAY];
    const tinted = pass === 0 || pass === 2;
    const stride = tinted ? SHADOW_STRIDE : SPRITE_STRIDE;
    if (n > 0) {
      for (let i = 0; i < n; i++) {
        const s = snap[p];
        const ro = s * RECT_STRIDE;
        const sc = snap[p + 3] * INV_ATLAS;
        res.srcPool[pool + i].setXYWH(R[ro], R[ro + 1], R[ro + 2], R[ro + 3]);
        res.xfPool[pool + i].set(sc, 0, snap[p + 1] - R[ro + 4] * sc, snap[p + 2] - R[ro + 5] * sc);
        if (tinted) {
          const col = res.colPool[i];
          let al = snap[p + 4];
          let v = pass === 0 ? 0 : 1;
          if (al > 1) {
            v = 1;
            al -= 1;
          }
          col[0] = v;
          col[1] = v;
          col[2] = v;
          col[3] = al;
        }
        p += stride;
      }
      const srcs = res.srcPool.slice(pool, pool + n);
      const dsts = res.xfPool.slice(pool, pool + n);
      if (tinted) c.drawAtlas(res.image, srcs, dsts, res.shadowPaint, BlendMode.Modulate, res.colPool.slice(0, n), SAMPLING);
      else c.drawAtlas(res.image, srcs, dsts, res.paint, BlendMode.SrcOver, undefined, SAMPLING);
      pool += n;
    }
  }

  // progress bars (constant screen size: w is in screen px)
  const nb = snap[H_BARS];
  const bp = res.barPaint;
  for (let i = 0; i < nb; i++) {
    const x = snap[p];
    const y = snap[p + 1];
    const w = snap[p + 2] / zoom;
    const prog = Math.max(0, Math.min(1, snap[p + 3]));
    const rgb = snap[p + 4];
    const h = 5 / zoom;
    const r = h / 2;
    bp.setColor(Skia.Color('rgba(20,26,40,0.78)'));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - w / 2 - 1.5 / zoom, y - 1.5 / zoom, w + 3 / zoom, h + 3 / zoom), r + 1, r + 1), bp);
    if (prog > 0) {
      bp.setColor(Skia.Color(`rgb(${(rgb >> 16) & 255},${(rgb >> 8) & 255},${rgb & 255})`));
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - w / 2, y, Math.max(h, w * prog), h), r, r), bp);
    }
    p += BAR_STRIDE;
  }
  c.restore();

  const dark = snap[H_DARK];
  if (dark > 0.01) {
    bp.setColor(Skia.Color(`rgba(16,24,58,${Math.min(0.6, dark)})`));
    c.drawRect(Skia.XYWHRect(0, 0, width, height), bp);
  }
  return rec.finishRecordingAsPicture();
}
