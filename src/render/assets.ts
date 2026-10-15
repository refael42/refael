import { RARITY } from '../data/rarity';
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
    /** The finishes over the top looks, by finish (see `finish`). */
    finish: SkPaint[];
    /** Background tiles: no edge smoothing (smoothed edges let a hairline show between tiles). */
    tile: SkPaint;
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
    /** Rarity rings at a worker's feet: rare, epic, legendary, mythic (src/data/rarity.ts). */
    rarity: SkPaint[];
    /** Sprite silhouette: the selection outline (white). */
    outline: SkPaint;
    /** Full-screen evening and night light (alpha set per frame). */
    evening: SkPaint;
    night: SkPaint;
    /** Red for money going out (payday). */
    redText: SkPaint;
    /** Building-site dust (alpha set per draw). */
    dust: SkPaint;
    /** Weather: rain streaks, the grey of a rainy or cloudy day (alpha set per frame). */
    rain: SkPaint;
    overcast: SkPaint;
  };
  /**
   * The background (floors, walls, street) baked once into image tiles, drawn at every zoom:
   * replaying its ~1000 vector shapes every frame was the biggest cost when zoomed in.
   */
  backgroundTiles: { image: SkImage; src: Rect; dst: Rect }[];
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

/**
 * A finish over a look (owner M30: "more design levels"): the colors pulled toward a two-tone
 * ramp (`dark` in the shadows, `light` in the highlights) by `mix`, so the shapes and details of
 * the look stay and its material changes. No new sprites: the atlas is full.
 */
function finish(dark: string, light: string, mix: number): SkPaint {
  const p = plainPaint();
  const d = Skia.Color(dark);
  const l = Skia.Color(light);
  const lum = [0.3, 0.59, 0.11];
  const row = (ch: number) => [0, 1, 2].map((k) => (k === ch ? 1 - mix : 0) + mix * (l[ch]! - d[ch]!) * lum[k]!).concat([0, mix * d[ch]!]);
  p.setColorFilter(Skia.ColorFilter.MakeMatrix([...row(0), ...row(1), ...row(2), 0, 0, 0, 1, 0]));
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

/**
 * Background sharpness: texture pixels per world pixel, at most `maxScale`, and never more than
 * `budget` pixels in all (memory: 4 bytes each), in tiles of at most `tile` px a side.
 */
const BG_BAKE = { maxScale: 2.5, budget: 10_000_000, tile: 2040, bleed: 4 } as const;

function bakeBackground(picture: SkPicture, world: RenderAssets['world']): RenderAssets['backgroundTiles'] {
  const w = world.maxX - world.minX;
  const h = world.maxY - world.minY;
  const scale = Math.min(BG_BAKE.maxScale, Math.sqrt(BG_BAKE.budget / (w * h)));
  const pw = Math.ceil(w * scale);
  const ph = Math.ceil(h * scale);
  const tiles: RenderAssets['backgroundTiles'] = [];
  for (let ty = 0; ty < ph; ty += BG_BAKE.tile) {
    for (let tx = 0; tx < pw; tx += BG_BAKE.tile) {
      const tw = Math.min(BG_BAKE.tile, pw - tx);
      const th = Math.min(BG_BAKE.tile, ph - ty);
      // Each tile also bakes a few px of its neighbours and is drawn with them: neighbouring
      // tiles overlap with identical pixels, so no hairline of the backdrop shows between them.
      const m = BG_BAKE.bleed;
      const surface = Skia.Surface.Make(tw + m * 2, th + m * 2);
      if (!surface) throw new Error('Could not create background surface');
      const c = surface.getCanvas();
      c.translate(-tx + m, -ty + m);
      c.scale(scale, scale);
      c.translate(-world.minX, -world.minY);
      c.drawPicture(picture);
      surface.flush();
      tiles.push({
        image: surface.makeImageSnapshot(),
        src: { x: 0, y: 0, width: tw + m * 2, height: th + m * 2 },
        dst: { x: world.minX + (tx - m) / scale, y: world.minY + (ty - m) / scale, width: (tw + m * 2) / scale, height: (th + m * 2) / scale },
      });
      surface.dispose();
    }
  }
  return tiles;
}

/** Every paint the drawing code uses (tints, rings, the night light...). */
function makePaints(): RenderAssets['paints'] {
  return {
    plain: plainPaint(),
    // Pearl and rose gold (level 75), royal purple and gold (150), diamond (200): src/render/draw/drawProp.ts.
    finish: [finish('#C29A8C', '#FFFAF4', 0.6), finish('#4A1A6A', '#FFE07A', 0.6), finish('#6FA8E8', '#FFFFFF', 0.62)],
    tile: (() => {
      const p = Skia.Paint();
      p.setAntiAlias(false);
      return p;
    })(),
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
    rarity: [RARITY.rare.color, RARITY.epic.color, RARITY.legendary.color, RARITY.mythic.color].map((hex) => strokePaint(hex, 2.4, 0.9)),
    outline: silhouette('#FFFFFF'),
    evening: solid('#FF7A2A', 0),
    night: solid('#12123F', 0),
    redText: tint('#FF6A5E'),
    dust: tint('#FFF3DC'),
    rain: strokePaint('#E2F0FF', 1.7, 0.55),
    overcast: solid('#3A4A6A', 0),
  };
}

let portraits: RenderAssets | null = null;

/**
 * Enough of the assets to draw a single character off screen (the offers' hero portraits,
 * src/render/icons.ts): the shared atlas and the paints, no background.
 */
export function portraitAssets(): RenderAssets {
  if (portraits) return portraits;
  const atlas = getAtlas(sharedAtlas?.scale ?? 1);
  portraits = { image: atlas.image, src: atlas.src, dst: atlas.dst, S, L: LAYERS, paints: makePaints(), backgroundTiles: [], pixelRatio: 1, backdrop: Skia.Color('#1A1022'), world: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
  return portraits;
}

export function buildRenderAssets(def: BackgroundDef, atlasScale: number, pixelRatio: number): RenderAssets {
  const atlas = getAtlas(atlasScale);
  const background = recordBackground(def);
  const world = isoBounds(def.width, def.height, def.building ? 90 : 20);
  const backgroundTiles = bakeBackground(background, world);
  // Baked: the vectors are not needed any more. They never left this thread (only the baked
  // tiles go to the UI thread), so they are freed on phones too.
  background.dispose();
  return {
    image: atlas.image,
    src: atlas.src,
    dst: atlas.dst,
    S,
    L: LAYERS,
    paints: makePaints(),
    backgroundTiles,
    pixelRatio,
    backdrop: Skia.Color('#1A1022'),
    world,
  };
}
