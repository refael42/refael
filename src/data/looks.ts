// Character appearance tables. The sim only stores indices into these; the renderer turns them
// into tinted sprite layers. Adding a hair style or color is adding a row here plus its art.

export const SKIN_TONES = ['#FFE1C9', '#F7CBA6', '#E5A97F', '#C98D62', '#9C6847', '#6F4A35'] as const;

export const HAIR_COLORS = [
  '#3A2A24', // espresso
  '#6B4129', // brown
  '#9A5B2E', // chestnut
  '#E3B25E', // blond
  '#CF5C33', // ginger
  '#E9E3DA', // silver
  '#8A5BB8', // grape (fun)
  '#3F86C2', // blue (fun)
] as const;

export const SHIRT_COLORS = [
  '#EA5A4C', // tomato
  '#F4A23B', // orange
  '#F4D04D', // mustard
  '#7CC77F', // mint green
  '#47B2BE', // teal
  '#5B8EDB', // blue
  '#9E7DDB', // lavender
  '#F38DB3', // pink
  '#FFFFFF', // white
  '#454556', // charcoal
  '#2F4166', // navy
] as const;

export const PANTS_COLORS = ['#3D4E73', '#30303C', '#8A6A50', '#5F7F52', '#CDB99E'] as const;

/** Named indices used by presets, so presets stay readable. */
export const SHIRT = { tomato: 0, orange: 1, mustard: 2, mint: 3, teal: 4, blue: 5, lavender: 6, pink: 7, white: 8, charcoal: 9, navy: 10 } as const;
export const PANTS = { denim: 0, black: 1, brown: 2, olive: 3, khaki: 4 } as const;

export const Outfit = { Tee: 0, Suit: 1, Hawaiian: 2, Hoodie: 3, Chef: 4, Waiter: 5, Washer: 6 } as const;
export type Outfit = (typeof Outfit)[keyof typeof Outfit];

export const Hair = { None: 0, Short: 1, Bob: 2, Ponytail: 3, Curly: 4, Spiky: 5, Bun: 6 } as const;
export type Hair = (typeof Hair)[keyof typeof Hair];
export const HAIR_STYLE_COUNT = 7;

export const Hat = { None: 0, Toque: 1, Cap: 2, SunHat: 3, Beanie: 4, Bandana: 5 } as const;
export type Hat = (typeof Hat)[keyof typeof Hat];

export const Accessory = { None: 0, Sunglasses: 1, Glasses: 2, Camera: 3, Backpack: 4 } as const;
export type Accessory = (typeof Accessory)[keyof typeof Accessory];

export interface Look {
  outfit: Outfit;
  hair: Hair;
  hairColor: number;
  skin: number;
  shirt: number;
  pants: number;
  hat: Hat;
  accessory: Accessory;
}

/** Outfits whose sleeves are always white regardless of the shirt tint. */
export const WHITE_SLEEVE_OUTFITS: readonly Outfit[] = [Outfit.Chef, Outfit.Waiter];
/** Outfits that come with yellow rubber gloves instead of bare hands. */
export const GLOVED_OUTFITS: readonly Outfit[] = [Outfit.Washer];

/** Casual outfits a random customer/applicant may wear (uniforms come from the job). */
export const CASUAL_OUTFITS: readonly Outfit[] = [Outfit.Tee, Outfit.Hoodie, Outfit.Hawaiian, Outfit.Suit];
export const CASUAL_HATS: readonly Hat[] = [Hat.None, Hat.None, Hat.None, Hat.Cap, Hat.Beanie, Hat.SunHat];
export const CASUAL_ACCESSORIES: readonly Accessory[] = [
  Accessory.None,
  Accessory.None,
  Accessory.None,
  Accessory.Glasses,
  Accessory.Sunglasses,
  Accessory.Backpack,
];
