import { Accessory, Hair, Hat, Outfit, PANTS, SHIRT, type Look } from './looks';
import type { Role } from './staff';

// Paid offers (owner request M34: "deals worth paying for that create FOMO, e.g. a rare character
// with gems"). Three store products, bought with real money like the gem packs:
// - the starter pack: once, for the first three days of play, with a hero of its own;
// - the hero pack: a hero of the week and gems. Heroes take turns, two days each; one that
//   leaves comes back only after every other hero had a turn;
// - the mega pack: the same hero, many more gems and a time warp.
// Every clock is real and every value is computed from the gem packs' own prices: the pressure
// comes from what really leaves, never from made-up stock or fake timers.

export type HeroStat = 'price' | 'arrivals' | 'cookSpeed' | 'tips' | 'washSpeed' | 'drinkPrice' | 'patience';

export interface HeroDef {
  id: string;
  role: Role;
  look: Look;
  /** The whole restaurant gets this while the hero is on the team (in every branch). */
  bonus: { stat: HeroStat; mult: number };
  /** Card color. */
  color: string;
  /** Only in the starter pack (never in the weekly turns). */
  starter?: boolean;
}

const look = (outfit: Outfit, hair: Hair, hairColor: number, skin: number, shirt: number, pants: number, hat: Hat, accessory: Accessory): Look => ({ outfit, hair, hairColor, skin, shirt, pants, hat, accessory });

export const HEROES: readonly HeroDef[] = [
  { id: 'sunny', role: 'waiter', look: look(Outfit.Waiter, Hair.Ponytail, 3, 1, SHIRT.white, PANTS.black, Hat.None, Accessory.Sunglasses), bonus: { stat: 'tips', mult: 1.5 }, color: '#FFB53D', starter: true },
  { id: 'goldie', role: 'cook', look: look(Outfit.Chef, Hair.Short, 3, 2, SHIRT.white, PANTS.black, Hat.Toque, Accessory.Sunglasses), bonus: { stat: 'cookSpeed', mult: 1.3 }, color: '#F2C14E' },
  { id: 'nonna', role: 'cook', look: look(Outfit.Chef, Hair.Bun, 5, 0, SHIRT.white, PANTS.olive, Hat.Bandana, Accessory.Glasses), bonus: { stat: 'price', mult: 1.15 }, color: '#E2649B' },
  { id: 'maestro', role: 'host', look: look(Outfit.Suit, Hair.Curly, 0, 4, SHIRT.charcoal, PANTS.black, Hat.None, Accessory.Glasses), bonus: { stat: 'arrivals', mult: 1.15 }, color: '#B45CFF' },
  { id: 'foam', role: 'washer', look: look(Outfit.Washer, Hair.Spiky, 7, 3, SHIRT.teal, PANTS.denim, Hat.Cap, Accessory.Sunglasses), bonus: { stat: 'washSpeed', mult: 1.5 }, color: '#47B2BE' },
  { id: 'mixer', role: 'bartender', look: look(Outfit.Hawaiian, Hair.Spiky, 4, 2, SHIRT.pink, PANTS.khaki, Hat.None, Accessory.Sunglasses), bonus: { stat: 'drinkPrice', mult: 1.4 }, color: '#FF7A59' },
  { id: 'zen', role: 'manager', look: look(Outfit.Suit, Hair.None, 0, 5, SHIRT.navy, PANTS.black, Hat.None, Accessory.Glasses), bonus: { stat: 'patience', mult: 1.3 }, color: '#5B8EDB' },
];

export const HERO_BY_ID: Readonly<Record<string, HeroDef>> = Object.fromEntries(HEROES.map((h) => [h.id, h]));

/** The heroes that take turns in the hero pack. */
export const HERO_TURNS = HEROES.filter((h) => !h.starter);

/** How a hero joins: top skills, a high level, two good traits; no wage ever. */
export const HERO = {
  level: 8,
  stat: 10,
  traits: ['charmer', 'workaholic'] as const,
  /** Perk ids that mark a hero as owned (perks carry over to every branch). */
  perkPrefix: 'hero.',
  /**
   * What a hero counts for in the "worth" sums, in gems. The shop's star workers cost 120-300
   * gems and its forever perks 300-600: a hero is both, and works for free in every branch.
   */
  gemWorth: 1000,
  /** A hero you already have, bought again (a second pack in the same turn): gems instead. */
  dupGems: 1000,
} as const;

export type OfferKind = 'starter' | 'hero' | 'mega';

export interface OfferDef {
  /** The store product id (consumable, in both store consoles: store/products.md). */
  id: string;
  kind: OfferKind;
  gems: number;
  /** Hours of the restaurant's income, paid at once. */
  warpHours: number;
  /** Shown only in the demo store; the real price is the store's own. */
  price: string;
}

export const OFFERS: readonly OfferDef[] = [
  { id: 'offer_starter', kind: 'starter', gems: 300, warpHours: 0, price: '₪9.90' },
  { id: 'offer_hero', kind: 'hero', gems: 800, warpHours: 0, price: '₪24.90' },
  { id: 'offer_mega', kind: 'mega', gems: 4000, warpHours: 12, price: '₪79.90' },
];

export const OFFER_BY_ID: Readonly<Record<string, OfferDef>> = Object.fromEntries(OFFERS.map((o) => [o.id, o]));

export const OFFER_TIMES = {
  /** The starter pack stays this long after the player first sees it. */
  starterHours: 72,
  /** Each hero's turn. */
  turnHours: 48,
  /**
   * Turn number 0 started here (a Monday, 00:00 UTC): every phone has the same hero on the same
   * days (src/data/events.ts FESTIVAL.epoch).
   */
  epoch: Date.UTC(2026, 0, 5),
  /** The last hours of a turn: the button turns red and says so. */
  hurryHours: 6,
  /** The big card pops up by itself at most once a turn, and not before this much play. */
  popupAfterSeconds: 240,
} as const;

/** The plain rate the "worth" sums compare with: the smallest gem pack (gems per shekel). */
export const BASE_PACK = { gems: 80, shekels: 4.9 } as const;
