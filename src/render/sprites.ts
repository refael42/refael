import { Accessory, Hair, Hat, Outfit } from '../data/looks';
import { Emote, Expression, Held } from '../sim/types';
import { characterSprites } from './art/characterArt';
import { fxSprites } from './art/fxArt';
import { propSprites } from './art/propArt';
import type { SpriteDef } from './sprite';

const ALL = { ...characterSprites, ...propSprites, ...fxSprites };
export type SpriteName = keyof typeof ALL;

export const SPRITE_DEFS: SpriteDef[] = Object.values(ALL);

/** Sprite name -> atlas index. Worklets use these plain numbers. */
export const S = Object.fromEntries(Object.keys(ALL).map((name, i) => [name, i])) as Record<SpriteName, number>;

const NONE = -1;

/** Builds a dense lookup array indexed by enum value; missing entries draw nothing. */
function byEnum(size: number, entries: [number, SpriteName][]): number[] {
  const out = new Array<number>(size).fill(NONE);
  for (const [index, name] of entries) out[index] = S[name];
  return out;
}

const HAIRS = Object.keys(Hair).length;
const HATS = Object.keys(Hat).length;
const OUTFITS = Object.keys(Outfit).length;

/** Every enum-driven layer the character renderer needs, as plain arrays (worklet friendly). */
export const LAYERS = {
  hairFront: byEnum(HAIRS, [[Hair.Short, 'hairShortF'], [Hair.Bob, 'hairBobF'], [Hair.Ponytail, 'hairShortF'], [Hair.Curly, 'hairCurlyF'], [Hair.Spiky, 'hairSpikyF'], [Hair.Bun, 'hairShortF']]),
  hairBehind: byEnum(HAIRS, [[Hair.Bob, 'hairBobBehind'], [Hair.Ponytail, 'hairPonytailBehind'], [Hair.Curly, 'hairCurlyBehind'], [Hair.Bun, 'hairBunBehind']]),
  hairBack: byEnum(HAIRS, [[Hair.Short, 'hairShortB'], [Hair.Bob, 'hairBobB'], [Hair.Ponytail, 'hairPonytailB'], [Hair.Curly, 'hairCurlyB'], [Hair.Spiky, 'hairSpikyB'], [Hair.Bun, 'hairBunB']]),
  hatFront: byEnum(HATS, [[Hat.Toque, 'hatToque'], [Hat.Cap, 'hatCap'], [Hat.SunHat, 'hatSun'], [Hat.Beanie, 'hatBeanie'], [Hat.Bandana, 'hatBandana']]),
  hatBack: byEnum(HATS, [[Hat.Toque, 'hatToque'], [Hat.Cap, 'hatCapBack'], [Hat.SunHat, 'hatSun'], [Hat.Beanie, 'hatBeanie'], [Hat.Bandana, 'hatBandana']]),
  bodyFront: byEnum(OUTFITS, [[Outfit.Tee, 'body'], [Outfit.Suit, 'body'], [Outfit.Hawaiian, 'body'], [Outfit.Hoodie, 'bodyHoodie'], [Outfit.Chef, 'body'], [Outfit.Waiter, 'body'], [Outfit.Washer, 'body']]),
  bodyBack: byEnum(OUTFITS, [[Outfit.Tee, 'body'], [Outfit.Suit, 'body'], [Outfit.Hawaiian, 'body'], [Outfit.Hoodie, 'bodyHoodieBack'], [Outfit.Chef, 'body'], [Outfit.Waiter, 'body'], [Outfit.Washer, 'body']]),
  overFront: byEnum(OUTFITS, [[Outfit.Tee, 'tee'], [Outfit.Suit, 'suit'], [Outfit.Hawaiian, 'hawaiian'], [Outfit.Hoodie, 'hoodie'], [Outfit.Chef, 'chef'], [Outfit.Waiter, 'waiter'], [Outfit.Washer, 'washer']]),
  overBack: byEnum(OUTFITS, [[Outfit.Suit, 'suitBack'], [Outfit.Hawaiian, 'hawaiianBack'], [Outfit.Waiter, 'waiterBack'], [Outfit.Washer, 'washerBack']]),
  face: byEnum(Object.keys(Expression).length, [[Expression.Happy, 'faceHappy'], [Expression.Neutral, 'faceNeutral'], [Expression.Angry, 'faceAngry'], [Expression.Sleepy, 'faceSleepy'], [Expression.Eating, 'faceEating']]),
  faceAccessory: byEnum(Object.keys(Accessory).length, [[Accessory.Sunglasses, 'sunglasses'], [Accessory.Glasses, 'glasses']]),
  emote: byEnum(Object.keys(Emote).length, [[Emote.Heart, 'heart'], [Emote.Anger, 'anger'], [Emote.Clock, 'clock'], [Emote.Coin, 'coin'], [Emote.Star, 'star'], [Emote.Exclaim, 'exclaim'], [Emote.Zzz, 'zzz'], [Emote.Music, 'music']]),
  held: byEnum(Object.keys(Held).length, [[Held.TrayFull, 'trayFull'], [Held.TrayEmpty, 'trayEmpty'], [Held.Phone, 'phone'], [Held.Spatula, 'spatula']]),
};
export type Layers = typeof LAYERS;
