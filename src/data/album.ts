import type { CustomerTypeId } from './customers';
import { Accessory, Hair, Hat, Outfit, PANTS, SHIRT, type Look } from './looks';

// The customer album (owner M52: "add idea 9, a customer album, and more customers"). Every kind
// of guest is a sticker: the first one served sticks it in, and the regulars earn it stars (10,
// 50 and 200 served). Three pages of six: the neighborhood, the city, and the stars (the special
// guests: VIPs, children, big parties, the guide's inspector). Each sticker and star pays a few
// gems; a full page gives a lasting bonus for the whole restaurant (in every branch), a page all
// in gold a big bag of gems. Rules in src/sim/album.ts.

export type StickerId = CustomerTypeId | 'vip' | 'kid' | 'banquet' | 'inspector';

export interface StickerDef {
  id: StickerId;
  /** Its picture: a guest of that kind, facing the viewer. */
  look: Look;
  /** Drawn as a child, or with the VIP's crown. */
  rank?: number;
}

const look = (outfit: Outfit, hair: Hair, hairColor: number, skin: number, shirt: number, pants: number, hat: Hat, accessory: Accessory): Look => ({ outfit, hair, hairColor, skin, shirt, pants, hat, accessory });

export interface AlbumPage {
  id: 'street' | 'city' | 'stars';
  stickers: readonly StickerDef[];
  /** A full page: this lifts for good (multiplier). */
  perk: { stat: 'patience' | 'tips' | 'arrivals'; mult: number };
  color: string;
}

export const ALBUM_PAGES: readonly AlbumPage[] = [
  {
    id: 'street',
    color: '#3E9B4F',
    perk: { stat: 'patience', mult: 1.05 },
    stickers: [
      { id: 'regular', look: look(Outfit.Tee, Hair.Short, 1, 1, SHIRT.tomato, PANTS.denim, Hat.None, Accessory.None) },
      { id: 'student', look: look(Outfit.Hoodie, Hair.Spiky, 0, 2, SHIRT.mint, PANTS.denim, Hat.None, Accessory.Backpack) },
      { id: 'rushed', look: look(Outfit.Suit, Hair.Short, 0, 0, SHIRT.navy, PANTS.black, Hat.None, Accessory.Glasses) },
      { id: 'relaxed', look: look(Outfit.Tee, Hair.Curly, 2, 3, SHIRT.orange, PANTS.khaki, Hat.Beanie, Accessory.Glasses) },
      { id: 'grandma', look: look(Outfit.Cardigan, Hair.Bun, 5, 1, SHIRT.lavender, PANTS.brown, Hat.None, Accessory.Cane) },
      { id: 'athlete', look: look(Outfit.Tracksuit, Hair.Ponytail, 3, 2, SHIRT.blue, PANTS.black, Hat.Headband, Accessory.Headphones) },
    ],
  },
  {
    id: 'city',
    color: '#3E7BC8',
    perk: { stat: 'tips', mult: 1.08 },
    stickers: [
      { id: 'tourist', look: look(Outfit.Hawaiian, Hair.Short, 3, 0, SHIRT.teal, PANTS.khaki, Hat.SunHat, Accessory.Camera) },
      { id: 'business', look: look(Outfit.Suit, Hair.Bun, 0, 4, SHIRT.charcoal, PANTS.black, Hat.None, Accessory.Briefcase) },
      { id: 'builder', look: look(Outfit.HiVis, Hair.Short, 1, 3, SHIRT.white, PANTS.denim, Hat.HardHat, Accessory.None) },
      { id: 'musician', look: look(Outfit.Hoodie, Hair.Curly, 4, 1, SHIRT.teal, PANTS.black, Hat.Beanie, Accessory.Guitar) },
      { id: 'foodie', look: look(Outfit.Tee, Hair.Bob, 0, 2, SHIRT.mustard, PANTS.olive, Hat.Beret, Accessory.Camera) },
      { id: 'party', look: look(Outfit.Hawaiian, Hair.Spiky, 6, 3, SHIRT.pink, PANTS.denim, Hat.PartyHat, Accessory.Sunglasses) },
    ],
  },
  {
    id: 'stars',
    color: '#B8862A',
    perk: { stat: 'arrivals', mult: 1.05 },
    stickers: [
      { id: 'influencer', look: look(Outfit.Sequin, Hair.Ponytail, 7, 1, SHIRT.pink, PANTS.black, Hat.None, Accessory.Sunglasses) },
      { id: 'tycoon', look: look(Outfit.Suit, Hair.Short, 5, 0, SHIRT.navy, PANTS.black, Hat.TopHat, Accessory.Monocle) },
      { id: 'vip', look: look(Outfit.Suit, Hair.Bob, 3, 2, SHIRT.lavender, PANTS.black, Hat.None, Accessory.Sunglasses), rank: 3 },
      { id: 'kid', look: look(Outfit.Tee, Hair.Spiky, 4, 1, SHIRT.mustard, PANTS.denim, Hat.Cap, Accessory.None), rank: 4 },
      { id: 'banquet', look: look(Outfit.Hawaiian, Hair.Curly, 1, 4, SHIRT.orange, PANTS.khaki, Hat.PartyHat, Accessory.None) },
      { id: 'inspector', look: look(Outfit.Suit, Hair.Short, 0, 1, SHIRT.charcoal, PANTS.black, Hat.None, Accessory.Glasses) },
    ],
  },
];

export const STICKERS: readonly StickerDef[] = ALBUM_PAGES.flatMap((p) => p.stickers);

export const ALBUM = {
  /** Guests of a kind served for each star: bronze, silver, gold. */
  stars: [10, 50, 200] as readonly number[],
  /** Gems for a new sticker, then for each star. */
  stickerGems: 3,
  starGems: [3, 6, 12] as readonly number[],
  /** A page with every sticker: its perk and these gems; a page all in gold: these. */
  pageGems: 40,
  goldGems: 100,
  /** A party this big at one table is a banquet. */
  banquetSize: 7,
  /** Perk ids in the saved perks (they carry over to every branch). */
  perkPrefix: 'album.',
} as const;
