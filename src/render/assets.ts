import { BlendMode, Skia, type SkImage, type SkPaint, type SkPicture } from '@shopify/react-native-skia';
import { HAIR_COLORS, PANTS_COLORS, SHIRT_COLORS, SKIN_TONES } from '../data/looks';
import type { SceneDef } from '../data/scenes';
import { bakeAtlas, type Atlas, type Rect } from './atlas';
import { recordBackground, recordVignette } from './art/background';
import { LAYERS, S, SPRITE_DEFS, type Layers } from './sprites';

/** Everything the UI-thread renderer needs, as plain data + Skia host objects (worklet friendly). */
export interface RenderAssets {
  image: SkImage;
  src: Rect[];
  dst: Rect[];
  S: typeof S;
  L: Layers;
  paints: {
    plain: SkPaint;
    /** Reused for anything that fades; its alpha is set right before each draw. */
    fade: SkPaint;
    skin: SkPaint[];
    hair: SkPaint[];
    shirt: SkPaint[];
    pants: SkPaint[];
    white: SkPaint;
    glove: SkPaint;
    barBack: SkPaint;
    barGood: SkPaint;
    barMid: SkPaint;
    barLow: SkPaint;
  };
  background: BakedLayer;
  vignette: BakedLayer;
  scene: { width: number; height: number };
}

/** A static layer pre-rendered to an image: one textured quad per frame instead of vector replay. */
export interface BakedLayer {
  image: SkImage;
  src: Rect;
  dst: Rect;
}

function bake(picture: SkPicture, width: number, height: number, scale: number): BakedLayer {
  const w = Math.ceil(width * scale);
  const h = Math.ceil(height * scale);
  const surface = Skia.Surface.Make(w, h);
  if (!surface) throw new Error(`Could not create ${w}x${h} layer surface`);
  const c = surface.getCanvas();
  c.scale(scale, scale);
  c.drawPicture(picture);
  surface.flush();
  return {
    image: surface.makeImageSnapshot(),
    src: { x: 0, y: 0, width: w, height: h },
    dst: { x: 0, y: 0, width, height },
  };
}

function plainPaint(): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  return p;
}

/** White sprite x tint = tinted sprite; the dark outline stays dark. One atlas, endless outfits. */
function tint(hex: string): SkPaint {
  const p = plainPaint();
  p.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color(hex), BlendMode.Modulate));
  return p;
}

function solid(hex: string, alpha = 1): SkPaint {
  const p = plainPaint();
  p.setColor(Skia.Color(hex));
  p.setAlphaf(alpha);
  return p;
}

let sharedAtlas: Atlas | null = null;

/** The atlas is shared by every scene; it is baked once per app run. */
function getAtlas(scale: number): Atlas {
  if (!sharedAtlas || sharedAtlas.scale < scale * 0.85) sharedAtlas = bakeAtlas(SPRITE_DEFS, scale);
  return sharedAtlas;
}

export function buildRenderAssets(scene: SceneDef, atlasScale: number): RenderAssets {
  const atlas = getAtlas(atlasScale);
  return {
    image: atlas.image,
    src: atlas.src,
    dst: atlas.dst,
    S,
    L: LAYERS,
    paints: {
      plain: plainPaint(),
      fade: plainPaint(),
      skin: SKIN_TONES.map(tint),
      hair: HAIR_COLORS.map(tint),
      shirt: SHIRT_COLORS.map(tint),
      pants: PANTS_COLORS.map(tint),
      white: tint('#FFFFFF'),
      glove: tint('#F7D046'),
      barBack: solid('#3A1F18', 0.55),
      barGood: solid('#5CC86E'),
      barMid: solid('#F4C542'),
      barLow: solid('#F0443A'),
    },
    background: bake(recordBackground(scene), scene.width, scene.height, Math.min(atlasScale, 4096 / scene.height)),
    // A smooth gradient survives heavy downscaling, so a quarter-resolution bake is plenty.
    vignette: bake(recordVignette(scene.width, scene.height), scene.width, scene.height, 0.25),
    scene: { width: scene.width, height: scene.height },
  };
}
