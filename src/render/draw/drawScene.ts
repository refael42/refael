import { FilterMode, MipmapMode, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';
import { F, P as PF, STRIDE, type Snapshot } from '../../sim/snapshot';
import { EntityType, PropKind } from '../../sim/types';
import type { RenderAssets } from '../assets';
import { drawCharacter, drawCharacterOverlay } from './drawCharacter';
import { drawBadges, drawProp, drawWorks, type PropLooks } from './drawProp';
import { drawScreenFx, drawWorldFx, processEvents, type Camera, type FxState } from './fx';
import { hudAnchors, type HudLayout } from './hud';
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

/** Build mode on screen: free tiles (x, y pairs) and the picked one with the piece previewed there. */
export interface BuildOverlay {
  tiles: number[];
  /** [x, y, prop kind] of the picked tile, or empty. */
  pick: number[];
  /** [x, y] of a placed piece being moved, or empty: its tile glows under it. */
  from: number[];
}

function decorLook(A: RenderAssets, kind: number): number {
  'worklet';
  const L = A.L.look;
  if (kind === PropKind.Flowers) return L.flowers[0]!;
  if (kind === PropKind.FloorLamp) return L.floorLamp[0]!;
  if (kind === PropKind.Aquarium) return L.aquarium[0]!;
  if (kind === PropKind.Statue) return L.statue[0]!;
  if (kind === PropKind.Fountain) return L.fountain[0]!;
  if (kind === PropKind.Piano) return L.piano[0]!;
  return -1;
}

/** After the night tint: lamp halos and the neon sign shine through the dark. */
function drawLights(c: SkCanvas, A: RenderAssets, snap: Snapshot, night: number, t: number): void {
  'worklet';
  const d = snap.data;
  for (let i = 0; i < snap.count; i++) {
    const o = i * STRIDE;
    if (d[o + F.type] !== EntityType.Prop) continue;
    const kind = d[o + PF.kind]!;
    if (kind !== PropKind.Lamp && kind !== PropKind.Neon && kind !== PropKind.FloorLamp) continue;
    const x = isoX(d[o + F.x]!, d[o + F.y]!);
    const y = isoY(d[o + F.x]!, d[o + F.y]!, d[o + PF.lift]!);
    if (kind === PropKind.Lamp) sprFade(c, A, A.S.glowHalo, x, y - 76, 1.8, night * (0.75 + Math.sin(t * 2 + i) * 0.15));
    else if (kind === PropKind.FloorLamp) sprFade(c, A, A.S.glowHalo, x, y - 52, 1.4, night * 0.85);
    else sprFade(c, A, A.L.look.neonLit[0]!, x, y, 1, night * 0.7);
  }
}

/**
 * Draws one frame. `alpha` (0..1) interpolates between the snapshot's previous and current
 * positions; `t` is the matching interpolated sim time used by every cosmetic animation.
 */
export function drawScene(
  c: SkCanvas, A: RenderAssets, snap: Snapshot, alpha: number, t: number,
  cam: Camera, fx: FxState, hud: HudLayout | null, vignette: SkPaint | null, W: number, H: number, selected: number, selectedId: number,
  build: BuildOverlay | null,
): void {
  'worklet';
  if (hud) processEvents(fx, snap, hudAnchors(hud));
  c.drawColor(A.backdrop);
  const d = snap.data;
  const phase = snap.dayPhase;
  const night = nightOf(phase);
  const looks: PropLooks = { tiers: snap.tiers, dishTiers: snap.dishTiers, bumps: snap.bumps, selected };
  // Big moments (milestones) give the camera a short, decaying shake.
  const shake = t - fx.shakeAt;
  const amp = shake >= 0 && shake < 0.35 ? (1 - shake / 0.35) * 4 : 0;
  c.save();
  c.translate(cam.x + Math.sin(t * 90) * amp, cam.y + Math.cos(t * 77) * amp);
  c.scale(cam.zoom, cam.zoom);
  // The baked background, only the tiles on screen.
  const viewX0 = -cam.x / cam.zoom;
  const viewY0 = -cam.y / cam.zoom;
  const viewX1 = viewX0 + W / cam.zoom;
  const viewY1 = viewY0 + H / cam.zoom;
  for (const tile of A.backgroundTiles) {
    const r = tile.dst;
    if (r.x > viewX1 || r.y > viewY1 || r.x + r.width < viewX0 || r.y + r.height < viewY0) continue;
    c.drawImageRectOptions(tile.image, tile.src, r, FilterMode.Linear, MipmapMode.None, A.paints.tile);
  }
  // Build mode: every free tile glows softly on the floor, under everything standing on it.
  if (build) {
    const glow = 0.65 + Math.sin(t * 3) * 0.2;
    for (let i = 0; i < build.tiles.length; i += 2) sprFade(c, A, A.S.tileFree, isoX(build.tiles[i]!, build.tiles[i + 1]!), isoY(build.tiles[i]!, build.tiles[i + 1]!), 1, glow);
    if (build.from.length === 2) sprFade(c, A, A.S.tilePicked, isoX(build.from[0]!, build.from[1]!), isoY(build.from[0]!, build.from[1]!), 1.05 + Math.sin(t * 6) * 0.05, 0.95);
  }
  for (let i = 0; i < snap.count; i++) {
    const o = i * STRIDE;
    if (d[o + F.type] === EntityType.Character) drawCharacter(c, A, d, o, alpha, t, selectedId);
    else drawProp(c, A, d, o, t, looks);
  }
  // ...and the picked tile with a see-through preview of the piece, bobbing a little.
  if (build && build.pick.length === 3) {
    const px = isoX(build.pick[0]!, build.pick[1]!);
    const py = isoY(build.pick[0]!, build.pick[1]!);
    sprFade(c, A, A.S.tilePicked, px, py, 1, 0.9);
    const look = decorLook(A, build.pick[2]!);
    if (look >= 0) sprFade(c, A, look, px, py - 4 - Math.abs(Math.sin(t * 3)) * 4, 1, 0.75);
  }
  for (let i = 0; i < snap.count; i++) {
    const o = i * STRIDE;
    if (d[o + F.type] === EntityType.Character) drawCharacterOverlay(c, A, d, o, alpha, t);
  }
  drawBadges(c, A, snap.badges, snap.bestBadge, t);
  drawWorks(c, A, snap.works, t);
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
  drawScreenFx(c, A, fx, t, cam);
}
