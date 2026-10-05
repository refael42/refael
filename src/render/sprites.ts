import { Accessory, Hair, Hat, Outfit } from '../data/looks';
import { Bubble, Emote, Expression, Held } from '../sim/types';
import { characterSprites } from './art/charArt';
import { fxSprites } from './art/fxArt';
import { GLYPH_ADVANCE, GLYPH_CHARS, glyphSprites } from './art/glyphArt';
import { propSprites } from './art/propArt';
import type { SpriteDef } from './sprite';

const ALL = { ...characterSprites, ...propSprites, ...fxSprites, ...glyphSprites };
export type SpriteName = keyof typeof characterSprites | keyof typeof propSprites | keyof typeof fxSprites;

export const SPRITE_DEFS: SpriteDef[] = Object.values(ALL);

const INDEX = Object.fromEntries(Object.keys(ALL).map((name, i) => [name, i])) as Record<string, number>;
/** Sprite name -> atlas index. Worklets use these plain numbers. */
export const S = INDEX as Record<SpriteName, number>;

const NONE = -1;
const size = (e: object) => Object.keys(e).length;

/** Dense lookup array indexed by enum value; missing entries draw nothing. */
function byEnum(n: number, entries: [number, string][]): number[] {
  const out = new Array<number>(n).fill(NONE);
  for (const [i, name] of entries) {
    const idx = INDEX[name];
    if (idx === undefined) throw new Error(`Unknown sprite ${name}`);
    out[i] = idx;
  }
  return out;
}

/** Front (F) and back (B) variants for an enum-driven layer. */
function views(n: number, entries: [number, string][]): { F: number[]; B: number[] } {
  return {
    F: byEnum(n, entries.map(([i, base]) => [i, `${base}F`])),
    B: byEnum(n, entries.map(([i, base]) => [i, `${base}B`])),
  };
}

/** Every enum-driven layer the renderer needs, as plain arrays (worklet friendly). */
export const LAYERS = {
  hair: views(size(Hair), [[Hair.Short, 'hairShort'], [Hair.Bob, 'hairBob'], [Hair.Ponytail, 'hairPonytail'], [Hair.Curly, 'hairCurly'], [Hair.Spiky, 'hairSpiky'], [Hair.Bun, 'hairBun']]),
  hat: views(size(Hat), [[Hat.Toque, 'hatToque'], [Hat.Cap, 'hatCap'], [Hat.SunHat, 'hatSun'], [Hat.Beanie, 'hatBeanie'], [Hat.Bandana, 'hatBandana']]),
  outfit: views(size(Outfit), [[Outfit.Tee, 'tee'], [Outfit.Suit, 'suit'], [Outfit.Hawaiian, 'hawaiian'], [Outfit.Hoodie, 'hoodie'], [Outfit.Chef, 'chef'], [Outfit.Waiter, 'waiter'], [Outfit.Washer, 'washer']]),
  face: byEnum(size(Expression), [[Expression.Happy, 'faceHappy'], [Expression.Neutral, 'faceNeutral'], [Expression.Angry, 'faceAngry'], [Expression.Sleepy, 'faceSleepy'], [Expression.Eating, 'faceEating']]),
  faceAccessory: byEnum(size(Accessory), [[Accessory.Sunglasses, 'sunglasses'], [Accessory.Glasses, 'glasses']]),
  emote: byEnum(size(Emote), [[Emote.Heart, 'heart'], [Emote.Anger, 'anger'], [Emote.Clock, 'clock'], [Emote.Coin, 'coin'], [Emote.Star, 'star'], [Emote.Exclaim, 'exclaim'], [Emote.Zzz, 'zzz'], [Emote.Music, 'music']]),
  held: byEnum(size(Held), [[Held.TrayFull, 'trayFull'], [Held.TrayEmpty, 'trayEmpty'], [Held.Phone, 'phone'], [Held.Spatula, 'spatula'], [Held.Menu, 'menu']]),
  bubble: byEnum(Bubble.DishBase + 2, [[Bubble.Seat, 'seat'], [Bubble.Clean, 'clean'], [Bubble.DishBase, 'fries'], [Bubble.DishBase + 1, 'burger']]),
  plate: byEnum(2, [[0, 'plateFries'], [1, 'plateBurger']]),
  /** Char code -> glyph sprite, and its advance width. */
  glyph: (() => {
    const out = new Array<number>(128).fill(NONE);
    for (const ch of GLYPH_CHARS) out[ch.charCodeAt(0)] = INDEX[`glyph_${ch}`]!;
    return out;
  })(),
  advance: (() => {
    const out = new Array<number>(128).fill(6);
    for (const ch of GLYPH_CHARS) out[ch.charCodeAt(0)] = GLYPH_ADVANCE[ch]!;
    return out;
  })(),
};
export type Layers = typeof LAYERS;
