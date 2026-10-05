import { BlendMode, Skia, type SkColor, type SkImage, type SkPaint, type SkPicture } from '@shopify/react-native-skia';
import { HAIR_COLORS, PANTS_COLORS, SHIRT_COLORS, SKIN_TONES } from '../data/looks';
import { bakeAtlas, type Atlas, type Rect } from './atlas';
import { recordBackground, type BackgroundDef } from './art/background';
import { isoBounds } from './iso';
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
    gold: SkPaint;
    green: SkPaint;
    red: SkPaint;
    orange: SkPaint;
    barBack: SkPaint;
    barGood: SkPaint;
    barMid: SkPaint;
    barLow: SkPaint;
    ripple: SkPaint;
    ring: SkPaint;
    /** Sprite silhouettes: the selection outline (white) and the top-tier aura (gold). */
    outline: SkPaint;
    aura: SkPaint;
    /** Full-screen evening and night light (alpha set per frame). */
    evening: SkPaint;
    night: SkPaint;
    /** Red for money going out (payday). */
    redText: SkPaint;
    /** Building-site dust (alpha set per draw). */
    dust: SkPaint;
  };
  background: SkPicture;
  /** The same background pre-rendered once; drawn instead of the vectors when zoomed out. */
  backgroundImage: { image: SkImage; src: Rect; dst: Rect; scale: number };
  pixelRatio: number;
  /** Color around the map, past its edges. */
  backdrop: SkColor;
  /** World bounds in iso pixels (camera limits). */
  world: { minX: number; maxX: number; minY: number; maxY: number };
}

function plainPaint(): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  return p;
}

/** White sprite x tint = tinted sprite; the dark parts stay dark. One atlas, endless outfits. */
function tint(hex: string): SkPaint {
  const p = plainPaint();
  p.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color(hex), BlendMode.Modulate));
  return p;
}

/** Any sprite drawn with this becomes a flat shape of one color (outlines, glows). */
function silhouette(hex: string): SkPaint {
  const p = plainPaint();
  p.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color(hex), BlendMode.SrcIn));
  return p;
}

function solid(hex: string, alpha = 1): SkPaint {
  const p = plainPaint();
  p.setColor(Skia.Color(hex));
  p.setAlphaf(alpha);
  return p;
}

function strokePaint(hex: string, width: number, alpha = 1): SkPaint {
  const p = solid(hex, alpha);
  p.setStyle(1);
  p.setStrokeWidth(width);
  return p;
}

let sharedAtlas: Atlas | null = null;

/** The atlas is shared by every scene; it is baked once per app run (re-baked only if too soft). */
function getAtlas(scale: number): Atlas {
  if (!sharedAtlas || sharedAtlas.scale < scale * 0.85) sharedAtlas = bakeAtlas(SPRITE_DEFS, scale);
  return sharedAtlas;
}

/** Texture pixels per world pixel for the baked background (memory vs sharpness). */
const BG_BAKE_SCALE = 2;

function bakeBackground(picture: SkPicture, world: RenderAssets['world']): RenderAssets['backgroundImage'] {
  const w = world.maxX - world.minX;
  const h = world.maxY - world.minY;
  const scale = Math.min(BG_BAKE_SCALE, 4096 / Math.max(w, h));
  const surface = Skia.Surface.Make(Math.ceil(w * scale), Math.ceil(h * scale));
  if (!surface) throw new Error('Could not create background surface');
  const c = surface.getCanvas();
  c.scale(scale, scale);
  c.translate(-world.minX, -world.minY);
  c.drawPicture(picture);
  surface.flush();
  return {
    image: surface.makeImageSnapshot(),
    src: { x: 0, y: 0, width: Math.ceil(w * scale), height: Math.ceil(h * scale) },
    dst: { x: world.minX, y: world.minY, width: Math.ceil(w * scale) / scale, height: Math.ceil(h * scale) / scale },
    scale,
  };
}

export function buildRenderAssets(def: BackgroundDef, atlasScale: number, pixelRatio: number): RenderAssets {
  const atlas = getAtlas(atlasScale);
  const background = recordBackground(def);
  const world = isoBounds(def.width, def.height, def.building ? 90 : 20);
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
      gold: tint('#FFD23F'),
      green: tint('#7CF07A'),
      red: tint('#FF5A4E'),
      orange: tint('#FF9A2E'),
      barBack: solid('#1A0E22', 0.7),
      barGood: solid('#5CD66E'),
      barMid: solid('#F4C542'),
      barLow: solid('#F0443A'),
      ripple: strokePaint('#FFFFFF', 2.5),
      ring: strokePaint('#FFFFFF', 3),
      outline: silhouette('#FFFFFF'),
      aura: silhouette('#FFD23F'),
      evening: solid('#FF7A2A', 0),
      night: solid('#12123F', 0),
      redText: tint('#FF6A5E'),
      dust: tint('#FFF3DC'),
    },
    background,
    backgroundImage: bakeBackground(background, world),
    pixelRatio,
    backdrop: Skia.Color('#1A1022'),
    world,
  };
}
