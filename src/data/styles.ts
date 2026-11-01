import { Dish } from './dishes';

// Restaurant styles (owner's idea 6: "Japanese, Italian, Mexican. Each style changes the look and
// the music, and has dishes of its own"). The dining room's floor and the walls change, the music
// changes, and the style's dishes sell for more and draw more of the orders (by the guest's id,
// like the holiday dish: no dice). Classic is the restaurant as it was.

export interface StyleDef {
  id: 'classic' | 'japanese' | 'italian' | 'mexican';
  /** The dining floor's look ('carpet' = the building's own). */
  floor: 'carpet' | 'tatami' | 'terracotta' | 'talavera';
  /** Floor colors: base, second, pattern, border. */
  colors: readonly [string, string, string, string];
  /** The walls (null = the building's own). */
  wall: string | null;
  /** The style's dishes. */
  dishes: readonly number[];
  /** The aisles' runner: base, middle, motif (classic: the red carpet). */
  runner?: readonly [string, string, string];
  /** Its music loop (src/audio/sound.ts). */
  music: 'music' | 'music_japanese' | 'music_italian' | 'music_mexican';
}

export const STYLES: readonly StyleDef[] = [
  { id: 'classic', floor: 'carpet', colors: ['#B3202E', '#C9303C', '#E2B13C', '#6E1220'], wall: null, dishes: [], music: 'music' },
  { id: 'japanese', floor: 'tatami', colors: ['#D9C98C', '#CDBB78', '#2F4A2A', '#3A1E14'], wall: '#3A1E14', dishes: [Dish.Sushi, Dish.PadThai, Dish.Salad], runner: ['#1E2E1A', '#2F4A2A', '#B8302A'], music: 'music_japanese' },
  { id: 'italian', floor: 'terracotta', colors: ['#C8643A', '#B4552F', '#EADCC0', '#2F7A3A'], wall: '#6E2E1C', dishes: [Dish.Pizza, Dish.IceCream, Dish.Cake], runner: ['#1F5A2A', '#2F7A3A', '#F4EFE4'], music: 'music_italian' },
  { id: 'mexican', floor: 'talavera', colors: ['#F4EFE4', '#1F5FAE', '#F2B33A', '#E06A1F'], wall: '#1E6E78', dishes: [Dish.Burger, Dish.Shakshuka, Dish.Steak], runner: ['#A8401A', '#E06A1F', '#F2B33A'], music: 'music_mexican' },
];

export const STYLE = {
  /** Styles open with this building (1 = the bistro). */
  minTier: 1,
  /** The style's dishes sell for this much more. */
  dishPrice: 1.15,
  /** This share of the guests asks for one of the style's dishes (when it is on the menu). */
  dishChance: 0.3,
  /** A change of style costs this many minutes of income (the first one is free). */
  costMinutes: 10,
} as const;
