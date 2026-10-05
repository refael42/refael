import { BlendMode, Skia, TileMode, vec, type SkColor, type SkImage, type SkPaint, type SkPicture } from '@shopify/react-native-skia';
import { HAIR_COLORS, PANTS_COLORS, SHIRT_COLORS, SKIN_TONES } from '../data/looks';
import { bakeAtlas, type Atlas, type Rect } from './atlas';
import { recordBackground, type BackgroundDef } from './art/background';
import { isoBounds } from './iso';
import { GLYPH_CHARS } from './art/glyphArt';
import { LAYERS, S, SPRITE_DEFS, type Layers, type SpriteName } from './sprites';

/** Everything the UI-thread renderer needs, as plain data + Skia host objects (worklet friendly). */
export interface RenderAssets {
  image: SkImage;
  src: Rect[];
  dst: Rect[];
  S: typeof S;
  L: Layers;
  /**
   * The same art as vector pictures, for the few sprites drawn big on screen (HUD icons and
   * digits): razor sharp on any screen. Indexed like the atlas; null = atlas only.
   */
  vec: (SkPicture | null)[];
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
    /** HUD pills: a vertical gradient (drawn in local coords, centered on y = 0) and rims. */
    hudFill: SkPaint;
    hudRim: SkPaint;
    hudShine: SkPaint;
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

/** Height of the HUD pills (px); the gradient is built for it. */
export const HUD_PILL_H = 40;

function gradientPaint(colors: [string, string], height: number): SkPaint {
  const p = plainPaint();
  p.setShader(Skia.Shader.MakeLinearGradient(vec(0, -height / 2), vec(0, height / 2), colors.map((c) => Skia.Color(c)), null, TileMode.Clamp));
  return p;
}

const VECTOR_SPRITES: readonly string[] = ['coin', 'star', 'starGray', ...GLYPH_CHARS.map((ch) => `glyph_${ch}`)];

let sharedVectors: (SkPicture | null)[] | null = null;

/** Records the chosen sprites once as pictures (vectors), shared by every scene. */
function getVectors(): (SkPicture | null)[] {
  if (sharedVectors) return sharedVectors;
  const out: (SkPicture | null)[] = SPRITE_DEFS.map(() => null);
  for (const name of VECTOR_SPRITES) {
    const i = S[name as SpriteName];
    const def = SPRITE_DEFS[i]!;
    const [l, t, r, b] = def.bounds;
    const rec = Skia.PictureRecorder();
    def.draw(rec.beginRecording(Skia.XYWHRect(l - 2, t - 2, r - l + 4, b - t + 4)));
    out[i] = rec.finishRecordingAsPicture();
  }
  sharedVectors = out;
  return out;
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
    vec: getVectors(),
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
      hudFill: gradientPaint(['#5A2A66', '#2E1238'], HUD_PILL_H),
      hudRim: strokePaint('#F2C14E', 2.4),
      hudShine: strokePaint('#FFFFFF', 1.2, 0.22),
    },
    background,
    backgroundImage: bakeBackground(background, world),
    pixelRatio,
    backdrop: Skia.Color('#1A1022'),
    world,
  };
}
