import { FilterMode, MipmapMode, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';
import { F, STRIDE, type Snapshot } from '../../sim/snapshot';
import { EntityType } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { drawCharacter, drawCharacterOverlay } from './drawCharacter';
import { drawProp } from './drawProp';
import { drawScreenFx, drawWorldFx, processEvents, type Camera, type FxState } from './fx';
import { drawHud, hudAnchors, type HudLayout } from './hud';

/**
 * Draws one frame. `alpha` (0..1) interpolates between the snapshot's previous and current
 * positions; `t` is the matching interpolated sim time used by every cosmetic animation.
 */
export function drawScene(
  c: SkCanvas, A: RenderAssets, snap: Snapshot, alpha: number, t: number, dt: number,
  cam: Camera, fx: FxState, hud: HudLayout | null, vignette: SkPaint | null, W: number, H: number,
): void {
  'worklet';
  if (hud) processEvents(fx, snap, hudAnchors(hud));
  c.drawColor(A.backdrop);
  const d = snap.data;
  c.save();
  c.translate(cam.x, cam.y);
  c.scale(cam.zoom, cam.zoom);
  // Level of detail: zoomed out, one pre-baked image is far cheaper than ~1000 vector shapes;
  // zoomed in, vectors stay sharp and off-screen shapes are culled.
  const bg = A.backgroundImage;
  if (cam.zoom * A.pixelRatio <= bg.scale * 1.15) {
    c.drawImageRectOptions(bg.image, bg.src, bg.dst, FilterMode.Linear, MipmapMode.None, A.paints.plain);
  } else {
    c.drawPicture(A.background);
  }
  for (let i = 0; i < snap.count; i++) {
    const o = i * STRIDE;
    if (d[o + F.type] === EntityType.Character) drawCharacter(c, A, d, o, alpha, t);
    else drawProp(c, A, d, o, t);
  }
  for (let i = 0; i < snap.count; i++) {
    const o = i * STRIDE;
    if (d[o + F.type] === EntityType.Character) drawCharacterOverlay(c, A, d, o, alpha, t);
  }
  drawWorldFx(c, A, fx, t);
  c.restore();
  if (vignette) c.drawRect({ x: 0, y: 0, width: W, height: H }, vignette);
  if (hud && snap.hud) drawHud(c, A, snap.hud, fx, t, dt, hud);
  drawScreenFx(c, A, fx, t, cam);
}
