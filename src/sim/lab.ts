import { DISH_TASTE, LAB, PLATES, SAUCES, TOPPINGS, type Flavor } from '../data/lab';
import { dishPrice } from './game/customers';
import { emit, Ev } from './game/events';
import { hash01 } from './retention';
import type { GameState } from './game/types';

// The recipe lab (src/data/lab.ts). A test runs in sim time and costs coins; what it scores is
// fixed by the ingredients (no dice), and the notes say why. A finished creation goes in the
// notebook; the player puts some on the menu (a slot per building step). A signature dish sells
// for more and some guests come for it, by their id like the holiday dish (the dice are left
// alone, so a game without the lab plays exactly as before). The player's: saved, and it goes along
// to a new branch.

export interface Creation {
  base: number;
  sauce: number;
  topping: number;
  plate: number;
  name: string;
  stars: number;
  /** On the menu now. */
  on: boolean;
}

export interface LabState {
  book: Creation[];
  test: (Creation & { ends: number }) | null;
  /** Dishes whose first five-star creation already paid gems. */
  perfect: number[];
  tests: number;
}

export const newLab = (): LabState => ({ book: [], test: null, perfect: [], tests: 0 });
export const copyLab = (l: LabState): LabState => ({ book: l.book.map((c) => ({ ...c })), test: l.test ? { ...l.test } : null, perfect: [...l.perfect], tests: l.tests });

/** For a save or a new branch: the test's end as seconds left (a new game's clock starts at 0). */
export const labForLater = (s: GameState): LabState => {
  const l = copyLab(s.lab);
  if (l.test) l.test.ends = Math.max(0, l.test.ends - s.time);
  return l;
};

export const labOpen = (s: GameState): boolean => s.stats.served >= LAB.minServed || s.lab.tests > 0;

export const labSlots = (s: GameState): number => LAB.slots[Math.min(LAB.slots.length - 1, s.mods.building)] ?? 1;

export interface Taste {
  stars: number;
  /** Wanted flavors that nothing brought. */
  missing: Flavor[];
  /** The flavor that spoils it, if something brought it. */
  clash: Flavor | null;
  /** Both wanted flavors there, but not one from each (sauce and topping): four stars, not five. */
  lopsided: boolean;
}

/** How a combination tastes: one star, +1.5 a wanted flavor, +1 when the sauce brings one and the topping the other, -2 for the hated one. */
export function taste(base: number, sauce: number, topping: number): Taste {
  const want = DISH_TASTE[base];
  const sf = SAUCES[sauce]?.flavors ?? [];
  const tf = TOPPINGS[topping]?.flavors ?? [];
  if (!want) return { stars: 1, missing: [], clash: null, lopsided: false };
  const has = (f: Flavor) => sf.includes(f) || tf.includes(f);
  const missing = want.wants.filter((f) => !has(f));
  const balanced = missing.length === 0 && ((sf.includes(want.wants[0]) && tf.includes(want.wants[1])) || (sf.includes(want.wants[1]) && tf.includes(want.wants[0])));
  const clash = has(want.hates) ? want.hates : null;
  const score = 1 + 1.5 * (2 - missing.length) + (balanced ? 1 : 0) - (clash ? 2 : 0);
  return { stars: Math.max(1, Math.min(5, Math.round(score))), missing, clash, lopsided: missing.length === 0 && !balanced };
}

/** A test costs a few of the dish's own price. */
export const testCost = (s: GameState, base: number) => dishPrice(s, base).mul(LAB.testPrices).max(20).floor();

export const cleanName = (name: unknown): string => (typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, LAB.nameMax) : '');

/** Into the test kitchen. */
export function startTest(s: GameState, base: number, sauce: number, topping: number, plate: number, name: string): boolean {
  if (s.lab.test || !labOpen(s) || !s.mods.menu[base] || !DISH_TASTE[base] || !SAUCES[sauce] || !TOPPINGS[topping] || !PLATES[plate]) return false;
  const clean = cleanName(name);
  if (!clean) return false;
  const cost = testCost(s, base);
  if (s.coins.lt(cost)) return false;
  s.coins = s.coins.sub(cost);
  s.lab.test = { base, sauce, topping, plate, name: clean, stars: taste(base, sauce, topping).stars, on: false, ends: s.time + LAB.testSeconds };
  s.lab.tests += 1;
  return true;
}

/** A finished test goes into the notebook (once a tick: cheap while none runs). */
export function updateLab(s: GameState): void {
  const t = s.lab.test;
  if (!t || s.time < t.ends) return;
  s.lab.test = null;
  const { ends: _ends, ...made } = t;
  s.lab.book.unshift(made);
  // A full notebook drops its oldest creation that is not on the menu.
  while (s.lab.book.length > LAB.keep) {
    const i = s.lab.book.map((c) => c.on).lastIndexOf(false);
    s.lab.book.splice(i < 0 ? s.lab.book.length - 1 : i, 1);
  }
  let gems = 0;
  if (made.stars === 5 && !s.lab.perfect.includes(made.base)) {
    s.lab.perfect.push(made.base);
    gems = LAB.perfectGems;
    s.gems += gems;
  }
  emit(s, Ev.LabDone, 0, 0, made.stars, gems, made.base);
}

/** On (or off) the menu. One signature per dish: putting one on takes the dish's other off; a full menu says no. */
export function setSignature(s: GameState, index: number, on: boolean): boolean {
  const c = s.lab.book[index];
  if (!c) return false;
  if (!on) {
    c.on = false;
    return true;
  }
  if (c.on) return true;
  const others = s.lab.book.filter((o) => o.on && o.base !== c.base).length;
  if (others >= labSlots(s)) return false;
  for (const o of s.lab.book) if (o.base === c.base) o.on = false;
  c.on = true;
  return true;
}

/** The signature dish made from `dish`, when one is on the menu. */
export function signatureFor(s: GameState, dish: number): Creation | undefined {
  for (const c of s.lab.book) if (c.on && c.base === dish) return c;
  return undefined;
}

/** A signature sells for more, by its stars. */
export function signaturePrice(s: GameState, dish: number): number {
  const c = signatureFor(s, dish);
  return c ? 1 + LAB.pricePerStar * (c.stars - 1) : 1;
}

/** Some guests come for a signature dish (by their id, like the holiday dish): the dish, or -1. */
export function signatureOrder(s: GameState, id: number): number {
  let on = 0;
  for (const c of s.lab.book) if (c.on && s.mods.menu[c.base]) on++;
  if (on === 0) return -1;
  let roll = hash01(id * 4.17 + 0.29);
  for (const c of s.lab.book) {
    if (!c.on || !s.mods.menu[c.base]) continue;
    const chance = (LAB.orderChance * c.stars) / 5 / on;
    if (roll < chance) return c.base;
    roll -= chance;
  }
  return -1;
}

const nat = (n: unknown, max = Infinity): number => (typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0);

function cleanCreation(raw: unknown): Creation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const base = nat(o.base);
  const name = cleanName(o.name);
  if (!DISH_TASTE[base] || !name) return null;
  const sauce = nat(o.sauce, SAUCES.length - 1);
  const topping = nat(o.topping, TOPPINGS.length - 1);
  return { base, sauce, topping, plate: nat(o.plate, PLATES.length - 1), name, stars: taste(base, sauce, topping).stars, on: o.on === true };
}

/** As saved (the stars are worked out again, so a save cannot claim more). */
export function cleanLab(raw: unknown): LabState {
  if (!raw || typeof raw !== 'object') return newLab();
  const o = raw as Record<string, unknown>;
  const book = (Array.isArray(o.book) ? o.book : []).map(cleanCreation).filter((c): c is Creation => c !== null).slice(0, LAB.keep);
  // One signature per dish.
  const seen = new Set<number>();
  for (const c of book) {
    if (c.on && seen.has(c.base)) c.on = false;
    if (c.on) seen.add(c.base);
  }
  const t = cleanCreation(o.test);
  const ends = o.test && typeof o.test === 'object' ? (o.test as Record<string, unknown>).ends : 0;
  return {
    book,
    test: t ? { ...t, on: false, ends: typeof ends === 'number' && Number.isFinite(ends) ? ends : 0 } : null,
    perfect: Array.isArray(o.perfect) ? [...new Set(o.perfect.map((n) => nat(n)).filter((n) => DISH_TASTE[n]))] : [],
    tests: nat(o.tests),
  };
}
