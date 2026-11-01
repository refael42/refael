/** Helpers to paint the static ground into a recorded SkPicture. */
import { PaintStyle, Skia, type SkCanvas, type SkPaint, type SkPicture } from '@shopify/react-native-skia';

import { isoX, isoY } from './iso';

export class GroundPainter {
  readonly f: SkPaint;
  readonly s: SkPaint;

  constructor(readonly c: SkCanvas) {
    this.f = Skia.Paint();
    this.f.setAntiAlias(true);
    this.f.setStyle(PaintStyle.Fill);
    this.s = Skia.Paint();
    this.s.setAntiAlias(true);
    this.s.setStyle(PaintStyle.Stroke);
  }

  /** Polygon on the ground from world points [x, y, ...]. */
  poly(pts: number[], color: string, z = 0): void {
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
