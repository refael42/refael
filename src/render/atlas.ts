import { ClipOp, Skia, type SkImage } from '@shopify/react-native-skia';
import type { SpriteDef } from './sprite';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** All sprites baked into one texture: one image, one draw path, no per-sprite shaders. */
export interface Atlas {
  image: SkImage;
  /** Source rect in atlas pixels, per sprite index. */
  src: Rect[];
  /** Destination rect around the sprite anchor in world units, per sprite index. */
  dst: Rect[];
  scale: number;
  width: number;
  height: number;
}

const PAD_UNITS = 1.5;
const GAP_PX = 2;
const MAX_WIDTH = 2048;
const MAX_HEIGHT = 4096;

interface Placement {
  x: number;
  y: number;
}

function pack(defs: readonly SpriteDef[], scale: number): { places: Placement[]; height: number } {
  const size = defs.map(({ bounds: [l, t, r, b] }) => ({
    w: Math.ceil((r - l + PAD_UNITS * 2) * scale) + GAP_PX,
    h: Math.ceil((b - t + PAD_UNITS * 2) * scale) + GAP_PX,
  }));
  const order = defs.map((_, i) => i).sort((a, b) => size[b]!.h - size[a]!.h);
  const places: Placement[] = new Array(defs.length);
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const i of order) {
    const { w, h } = size[i]!;
    if (x + w > MAX_WIDTH) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    places[i] = { x, y };
    x += w;
    rowH = Math.max(rowH, h);
  }
  return { places, height: y + rowH };
}

/**
 * Draws every sprite once into a CPU raster surface. Raster (not GPU offscreen) on purpose:
 * on web an offscreen GPU surface costs a WebGL context, and browsers cap those at ~16.
 */
export function bakeAtlas(defs: readonly SpriteDef[], requestedScale: number): Atlas {
  let scale = requestedScale;
  let layout = pack(defs, scale);
  while (layout.height > MAX_HEIGHT && scale > 1) {
    scale *= 0.85;
    layout = pack(defs, scale);
  }
  const height = Math.max(1, layout.height);
  const surface = Skia.Surface.Make(MAX_WIDTH, height);
  if (!surface) throw new Error(`Could not create ${MAX_WIDTH}x${height} atlas surface`);
  const c = surface.getCanvas();
  const src: Rect[] = [];
  const dst: Rect[] = [];
  defs.forEach((def, i) => {
    const [l, t, r, b] = def.bounds;
    const wU = r - l + PAD_UNITS * 2;
    const hU = b - t + PAD_UNITS * 2;
    const { x, y } = layout.places[i]!;
    c.save();
    c.clipRect(Skia.XYWHRect(x, y, wU * scale, hU * scale), ClipOp.Intersect, true);
    c.translate(x - (l - PAD_UNITS) * scale, y - (t - PAD_UNITS) * scale);
    c.scale(scale, scale);
    def.draw(c);
    c.restore();
    src.push({ x, y, width: wU * scale, height: hU * scale });
    dst.push({ x: l - PAD_UNITS, y: t - PAD_UNITS, width: wU, height: hU });
  });
  surface.flush();
  const image = surface.makeImageSnapshot();
  return { image, src, dst, scale, width: MAX_WIDTH, height };
}
