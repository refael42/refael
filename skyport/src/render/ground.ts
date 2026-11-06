/** Helpers to paint the static ground into a recorded SkPicture. */
import { PaintStyle, Skia, type SkCanvas, type SkImage, type SkPaint, type SkPicture } from '@shopify/react-native-skia';

import { makeSurface, takeImage } from './atlas';
import { isoX, isoY } from './iso';

export class GroundPainter {
  readonly f: SkPaint;
  readonly s: SkPaint;
  /** While a soft (blurred) shape is being drawn in the crisp layer: skip it. */
  skip = false;

  /**
   * crisp: the sharp layer drawn as vectors when zoomed in close, over the baked
   * tiles. Soft things (the base grass, blurred patches and shadows) stay in the
   * tiles only: blurs are slow to redraw every frame, and soft looks fine scaled up.
   */
  constructor(
    readonly c: SkCanvas,
    readonly crisp = false,
  ) {
    this.f = Skia.Paint();
    this.f.setAntiAlias(true);
    this.f.setStyle(PaintStyle.Fill);
    this.s = Skia.Paint();
    this.s.setAntiAlias(true);
    this.s.setStyle(PaintStyle.Stroke);
  }

  /** A blur for the shapes that follow (null ends it); the crisp layer skips them instead. */
  mask(filter: ReturnType<typeof Skia.MaskFilter.MakeBlur> | null): void {
    if (this.crisp) this.skip = filter !== null;
    else this.f.setMaskFilter(filter);
  }

  /** Polygon on the ground from world points [x, y, ...]. */
  poly(pts: number[], color: string, z = 0): void {
    if (this.skip) return;
    const b = Skia.PathBuilder.Make();
    for (let i = 0; i < pts.length; i += 2) {
      const x = isoX(pts[i], pts[i + 1]);
      const y = isoY(pts[i], pts[i + 1], z);
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    b.close();
    this.f.setColor(Skia.Color(color));
    this.c.drawPath(b.build(), this.f);
  }

  rect(x0: number, y0: number, x1: number, y1: number, color: string): void {
    this.poly([x0, y0, x1, y0, x1, y1, x0, y1], color);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, width: number, z = 0): void {
    if (this.skip) return;
    this.s.setColor(Skia.Color(color));
    this.s.setStrokeWidth(width);
    this.c.drawLine(isoX(x0, y0), isoY(x0, y0, z), isoX(x1, y1), isoY(x1, y1, z), this.s);
  }

  /** Ellipse on the ground (center x, y; radii in tiles along x and y). */
  ellipse(x: number, y: number, rx: number, ry: number, color: string, n = 24): void {
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(x + Math.cos(a) * rx, y + Math.sin(a) * ry);
    }
    this.poly(pts, color);
  }
}

export function recordPicture(x0: number, y0: number, w: number, h: number, draw: (c: SkCanvas) => void): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(x0, y0, w, h));
  draw(c);
  return rec.finishRecordingAsPicture();
}

/** A raster piece of the static ground, in world-screen px. */
export interface GroundTile {
  image: SkImage;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A tile of the sharp ground layer drawn at f times its size (for a close zoom). */
export interface CrispTile extends GroundTile {
  f: number;
  key: number;
}

/** World-screen px of a crisp tile. */
export const CRISP_TILE = 256;

/** Draws one tile of the crisp ground layer at f times its size (the corner at tx, ty). */
export function renderCrispTile(picture: SkPicture, tx: number, ty: number, f: number, key: number): CrispTile | null {
  const px = Math.ceil(CRISP_TILE * f);
  const surf = makeSurface(px, px);
  if (!surf) return null;
  const c = surf.getCanvas();
  c.clear(Skia.Color('transparent'));
  c.scale(f, f);
  c.translate(-tx, -ty);
  c.drawPicture(picture);
  return { image: takeImage(surf), x: tx, y: ty, w: CRISP_TILE, h: CRISP_TILE, f, key };
}

/**
 * Bakes a recorded picture into image tiles once at load. Drawing a few
 * images per frame is much cheaper than replaying thousands of paths.
 * `scale` > 1 keeps the ground sharp when zoomed in (costs memory).
 */
export function rasterizeGround(
  picture: SkPicture,
  x0: number,
  y0: number,
  w: number,
  h: number,
  tile = 512,
  scale = 1,
  keep: (tx: number, ty: number, size: number) => boolean = () => true,
): GroundTile[] {
  const out: GroundTile[] = [];
  const px = Math.round(tile * scale);
  for (let ty = y0; ty < y0 + h; ty += tile) {
    for (let tx = x0; tx < x0 + w; tx += tile) {
      if (!keep(tx, ty, tile)) continue;
      const surf = makeSurface(px, px);
      if (!surf) continue;
      const c = surf.getCanvas();
      c.clear(Skia.Color('transparent'));
      c.scale(scale, scale);
      c.translate(-tx, -ty);
      c.drawPicture(picture);
      out.push({ image: takeImage(surf), x: tx, y: ty, w: tile, h: tile });
    }
  }
  return out;
}
