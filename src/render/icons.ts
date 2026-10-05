import { Skia } from '@shopify/react-native-skia';
import { spriteDef, type SpriteName } from './sprites';

// Menu icons are the game's own sprites, rendered once to small PNGs for <Image>: the menus
// match the world exactly, with no extra Skia canvases (web caps WebGL contexts at ~16).

const cache = new Map<string, string>();

/** A sprite rendered into a square `px` icon (device pixels), as a data URI. */
export function spriteIcon(name: SpriteName, px: number): string {
  const key = `${name}@${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [l, t, r, b] = spriteDef(name).bounds;
  const scale = (px * 0.92) / Math.max(r - l, b - t);
  const surface = Skia.Surface.Make(px, px);
  if (!surface) return '';
  const c = surface.getCanvas();
  c.translate(px / 2 - ((l + r) / 2) * scale, px / 2 - ((t + b) / 2) * scale);
  c.scale(scale, scale);
  spriteDef(name).draw(c);
  surface.flush();
  const image = surface.makeImageSnapshot();
  const uri = `data:image/png;base64,${image.encodeToBase64()}`;
  image.dispose();
  surface.dispose();
  cache.set(key, uri);
  return uri;
}
