import { FilterMode, MipmapMode, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';
import { F, P as PF, STRIDE, type Snapshot } from '../../sim/snapshot';
import { EntityType, PropKind } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { drawCharacter, drawCharacterOverlay } from './drawCharacter';
import { drawBadges, drawProp, type PropLooks } from './drawProp';
import { drawScreenFx, drawWorldFx, processEvents, type Camera, type FxState } from './fx';
import { drawHud, hudAnchors, type HudLayout } from './hud';
import { isoX, isoY } from '../iso';
import { sprFade } from './primitives';

/** 0 by day, 1 deep at night (the last part of each day), with soft dusk and dawn. */
export function nightOf(phase: number): number {
  'worklet';
  if (phase < 0.55) return 0;
  if (phase < 0.72) return (phase - 0.55) / 0.17;
  if (phase < 0.93) return 1;
  return 1 - (phase - 0.93) / 0.07;
}

/** The warm golden hour just before dark. */
function eveningOf(phase: number): number {
  'worklet';
  return Math.max(0, 1 - Math.abs(phase - 0.62) / 0.1);
}

/** After the night tint: lamp halos and the neon sign shine through the dark. */
function drawLights(c: SkCanvas, A: RenderAssets, snap: Snapshot, night: number, t: number): void {
  'worklet';
  const d = snap.data;
  for (let i = 0; i < snap.count; i++) {
    const o = i * STRIDE;
    if (d[o + F.type] !== EntityType.Prop) continue;
    const kind = d[o + PF.kind]!;
    if (kind !== PropKind.Lamp && kind !== PropKind.Neon) continue;
    const x = isoX(d[o + F.x]!, d[o + F.y]!);
    const y = isoY(d[o + F.x]!, d[o + F.y]!, d[o + PF.lift]!);
    if (kind === PropKind.Lamp) sprFade(c, A, A.S.glowHalo, x, y - 76, 1.8, night * (0.75 + Math.sin(t * 2 + i) * 0.15));
    else sprFade(c, A, A.L.look.neonLit[0]!, x, y, 1, night * 0.7);
  }
}

/**
 * Draws one frame. `alpha` (0..1) interpolates between the snapshot's previous and current
 * positions; `t` is the matching interpolated sim time used by every cosmetic animation.
 */
export function drawScene(
  c: SkCanvas, A: RenderAssets, snap: Snapshot, alpha: number, t: number, dt: number,
  cam: Camera, fx: FxState, hud: HudLayout | null, vignette: SkPaint | null, W: number, H: number, selected: number, selectedId: number,
): void {
  'worklet';
  if (hud) processEvents(fx, snap, hudAnchors(hud));
  c.drawColor(A.backdrop);
  const d = snap.data;
  const phase = snap.hud ? snap.hud.dayPhase : 0;
  const night = nightOf(phase);
  const looks: PropLooks = { tiers: snap.tiers, dishTiers: snap.dishTiers, bumps: snap.bumps, selected };
  // Big moments (milestones) give the camera a short, decaying shake.
  const shake = t - fx.shakeAt;
  const amp = shake >= 0 && shake < 0.35 ? (1 - shake / 0.35) * 4 : 0;
  c.save();
  c.translate(cam.x + Math.sin(t * 90) * amp, cam.y + Math.cos(t * 77) * amp);
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
    if (d[o + F.type] === EntityType.Character) drawCharacter(c, A, d, o, alpha, t, selectedId);
    else drawProp(c, A, d, o, t, looks);
  }
  for (let i = 0; i < snap.count; i++) {
    const o = i * STRIDE;
    if (d[o + F.type] === EntityType.Character) drawCharacterOverlay(c, A, d, o, alpha, t);
  }
  drawBadges(c, A, snap.badges, t);
  drawWorldFx(c, A, fx, t);
  c.restore();
  // Evening and night: tint the world, then let the lights glow through it.
  const evening = eveningOf(phase);
  if (evening > 0) {
    A.paints.evening.setAlphaf(evening * 0.13);
    c.drawRect({ x: 0, y: 0, width: W, height: H }, A.paints.evening);
  }
  if (night > 0) {
    A.paints.night.setAlphaf(night * 0.36);
    c.drawRect({ x: 0, y: 0, width: W, height: H }, A.paints.night);
    c.save();
    c.translate(cam.x, cam.y);
    c.scale(cam.zoom, cam.zoom);
    drawLights(c, A, snap, night, t);
    c.restore();
  }
  if (vignette) c.drawRect({ x: 0, y: 0, width: W, height: H }, vignette);
  if (hud && snap.hud) drawHud(c, A, snap.hud, fx, t, dt, hud);
  drawScreenFx(c, A, fx, t, cam);
}
