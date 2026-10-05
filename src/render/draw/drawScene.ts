import { FilterMode, MipmapMode, type SkCanvas } from '@shopify/react-native-skia';
import { F, STRIDE, type Snapshot } from '../../sim/snapshot';
import { EntityType } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { drawCharacter, drawCharacterOverlay } from './drawCharacter';
import { drawProp } from './drawProp';

export interface Camera {
  zoom: number;
  x: number;
  y: number;
}

/**
 * Draws one frame. `alpha` (0..1) interpolates between the snapshot's previous and current
 * positions; `t` is the matching interpolated sim time used by cosmetic animations.
 */
export function drawScene(c: SkCanvas, A: RenderAssets, snap: Snapshot, alpha: number, t: number, cam: Camera): void {
  'worklet';
  const d = snap.data;
  c.save();
  c.translate(cam.x, cam.y);
  c.scale(cam.zoom, cam.zoom);
  const bg = A.background;
  c.drawImageRectOptions(bg.image, bg.src, bg.dst, FilterMode.Linear, MipmapMode.None, A.paints.plain);
  for (let i = 0; i < snap.count; i++) {
    const o = i * STRIDE;
    if (d[o + F.type] === EntityType.Character) drawCharacter(c, A, d, o, alpha, t);
    else drawProp(c, A, d, o, t);
  }
  for (let i = 0; i < snap.count; i++) {
    const o = i * STRIDE;
    if (d[o + F.type] === EntityType.Character) drawCharacterOverlay(c, A, d, o, alpha, t);
  }
  const v = A.vignette;
  c.drawImageRectOptions(v.image, v.src, v.dst, FilterMode.Linear, MipmapMode.None, A.paints.plain);
  c.restore();
}
