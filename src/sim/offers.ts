import { BASE_PACK, HERO, HERO_BY_ID, HERO_TURNS, HEROES, OFFER_BY_ID, OFFER_TIMES, type HeroDef, type OfferDef } from '../data/offers';
import { PURCHASE_LOG, SHOP_BY_ID } from '../data/shop';
import { STAT_IDS, type StatId } from '../data/staff';
import { ZERO } from './big';
import { computeMods } from './economy/upgrades';
import { emote } from './game/customers';
import { emit, Ev } from './game/events';
import { rankOf } from './game/people';
import { createStaff } from './game/staff';
import type { GameState, OffersState } from './game/types';
import { advanceWorks } from './game/works';
import { addGems, grantCoins, incomeRate } from './shop';
import { Emote } from './types';

// The paid offers' rules (src/data/offers.ts): which hero is on this turn, what is still there
// to take, paying a pack out, and the heroes joining the team (in every branch).

const HOUR = 3600 * 1000;
const TURN_MS = OFFER_TIMES.turnHours * HOUR;

export const newOffers = (): OffersState => ({ starterSeen: 0, bought: [], pick: null, shown: -1 });

export const heroPerk = (id: string): string => HERO.perkPrefix + id;
export const ownsHero = (s: Pick<GameState, 'perks'>, id: string): boolean => s.perks[heroPerk(id)] === 1;

/** The hero turn at this moment (the same on every phone). */
export const turnAt = (now: number): number => Math.floor((now - OFFER_TIMES.epoch) / TURN_MS);
export const turnEnds = (turn: number): number => OFFER_TIMES.epoch + (turn + 1) * TURN_MS;

/**
 * The hero of a turn: the one picked when the turn was first seen, else the turn's own place in
 * the rotation, skipping the heroes this player already has. Null once they have them all.
 */
export function heroOfTurn(s: Pick<GameState, 'perks' | 'offers'>, turn: number): HeroDef | null {
  const pick = s.offers.pick;
  if (pick && pick.turn === turn) return HERO_BY_ID[pick.hero] ?? null;
  const n = HERO_TURNS.length;
  const start = ((turn % n) + n) % n;
  for (let k = 0; k < n; k++) {
    const h = HERO_TURNS[(start + k) % n]!;
    if (!ownsHero(s, h.id)) return h;
  }
  return null;
}

/** The phone's clock reached the sim (the UI sends it now and then): starts the starter's clock, fixes the turn's hero. */
export function seeOffers(s: GameState, now: number): void {
  if (s.offers.starterSeen === 0) s.offers.starterSeen = now;
  const turn = turnAt(now);
  if (s.offers.pick?.turn === turn) return;
  const hero = heroOfTurn(s, turn);
  s.offers.pick = hero ? { turn, hero: hero.id } : null;
}

/** The big card popped up for this turn (it pops up by itself once a turn). */
export function markShown(s: GameState, turn: number): void {
  s.offers.shown = Math.max(s.offers.shown, turn);
}

export interface OfferView {
  offer: OfferDef;
  /** The hero in it (the starter's own, or the turn's); null: gems only. */
  hero: HeroDef | null;
  /** When it goes (phone clock, ms). */
  ends: number;
  bought: boolean;
  /** How many times more than the same money buys in plain gems (smallest pack). */
  worth: number;
}

/** The starter pack's own hero. */
const STARTER_HERO: HeroDef | null = HEROES.find((h) => h.starter) ?? null;

const boughtKey = (offer: OfferDef, turn: number): string => (offer.kind === 'starter' ? 'starter' : `${offer.kind}@${turn}`);

/** What a pack is worth next to plain gems bought at the smallest pack's rate. */
export function worthOf(offer: OfferDef, withHero: boolean): number {
  const shekels = Number(offer.price.replace(/[^\d.]/g, '')) || 1;
  const plain = (shekels / BASE_PACK.shekels) * BASE_PACK.gems;
  // An hour of income counts what the shop's one-hour warp costs in gems.
  const warp = offer.warpHours * ((SHOP_BY_ID.warp1 as { cost?: number } | undefined)?.cost ?? 0);
  return (offer.gems + (withHero ? HERO.gemWorth : 0) + warp) / plain;
}

/** The packs on offer right now (the starter only while its days last and it was not taken). */
export function offersAt(s: GameState, now: number): OfferView[] {
  const out: OfferView[] = [];
  const turn = turnAt(now);
  const hero = heroOfTurn(s, turn);
  const starter = OFFER_BY_ID.offer_starter!;
  const starterEnds = (s.offers.starterSeen || now) + OFFER_TIMES.starterHours * HOUR;
  if (!s.offers.bought.includes('starter') && now < starterEnds) {
    out.push({ offer: starter, hero: STARTER_HERO, ends: starterEnds, bought: false, worth: worthOf(starter, true) });
  }
  for (const id of ['offer_hero', 'offer_mega'] as const) {
    const offer = OFFER_BY_ID[id]!;
    // No hero left to get: the hero pack has nothing to sell; the mega pack still has its gems.
    if (!hero && offer.kind === 'hero') continue;
    out.push({ offer, hero, ends: turnEnds(turn), bought: s.offers.bought.includes(boughtKey(offer, turn)), worth: worthOf(offer, hero !== null) });
  }
  return out;
}


/** The hero turn is in its last hours (the button turns red). */
export const hurry = (ends: number, now: number): boolean => ends - now < OFFER_TIMES.hurryHours * HOUR;

/**
 * A pack paid for in the store, paid out once per transaction. `time`: when it was bought (the
 * store's own date): a purchase approved later still gives the hero of the turn it was bought
 * in. A hero already on the team (a second pack in one turn) comes as gems instead. Returns
 * whether anything was paid out.
 */
export function grantOffer(s: GameState, product: string, transaction: string, time: number): boolean {
  const offer = OFFER_BY_ID[product];
  if (!offer || !transaction || s.purchases.includes(transaction)) return false;
  s.purchases = [...s.purchases.slice(-(PURCHASE_LOG - 1)), transaction];
  const turn = turnAt(time);
  const hero = offer.kind === 'starter' ? STARTER_HERO : heroOfTurn(s, turn);
  addGems(s, offer.gems);
  if (hero) {
    if (ownsHero(s, hero.id)) addGems(s, HERO.dupGems);
    else {
      s.perks = { ...s.perks, [heroPerk(hero.id)]: 1 };
      s.mods = computeMods(s.levels, s.perks, s.trophies);
      joinHero(s, hero);
    }
  }
  if (offer.warpHours > 0) {
    const coins = incomeRate(s).mul(offer.warpHours * 3600).floor();
    grantCoins(s, coins);
    emit(s, Ev.Bonus, 0, 0, coins.toNumber());
    advanceWorks(s, offer.warpHours * 3600);
  }
  const key = boughtKey(offer, turn);
  if (!s.offers.bought.includes(key)) s.offers.bought = [...s.offers.bought.slice(-30), key];
  return true;
}

/**
 * "Restore purchases" (App Review 3.1.1): the store's history of paid packs gives back what is
 * meant to last, the heroes; gems are consumables and are not paid twice. The packs are replayed
 * in the order they were bought, each one's hero picked the way it was then (the turn's place in
 * the rotation, skipping heroes already on the team), so a reinstall gets back the same heroes.
 * Returns the heroes that came back.
 */
export function restoreHeroes(s: GameState, paid: readonly { product: string; time: number }[]): HeroDef[] {
  const back: HeroDef[] = [];
  const owned = new Set(heroesOwned(s).map((h) => h.id));
  for (const p of [...paid].sort((a, b) => a.time - b.time)) {
    const offer = OFFER_BY_ID[p.product];
    if (!offer) continue;
    let hero: HeroDef | null = null;
    if (offer.kind === 'starter') hero = STARTER_HERO;
    else {
      const n = HERO_TURNS.length;
      const start = ((turnAt(p.time) % n) + n) % n;
      for (let k = 0; k < n && !hero; k++) {
        const h = HERO_TURNS[(start + k) % n]!;
        if (!owned.has(h.id)) hero = h;
      }
    }
    if (!hero || owned.has(hero.id)) continue;
    owned.add(hero.id);
    s.perks = { ...s.perks, [heroPerk(hero.id)]: 1 };
    joinHero(s, hero);
    back.push(hero);
  }
  if (back.length) s.mods = computeMods(s.levels, s.perks, s.trophies);
  return back;
}

/** The heroes the player has, by id. */
export const heroesOwned = (s: Pick<GameState, 'perks'>): HeroDef[] => Object.values(HERO_BY_ID).filter((h) => ownsHero(s, h.id));

/** A hero walks in through the front door: top skills, mythic, no wage. */
export function joinHero(s: GameState, hero: HeroDef): void {
  if (s.staff.some((st) => st.hero === hero.id)) return;
  const stats = Object.fromEntries(STAT_IDS.map((k) => [k, HERO.stat])) as Record<StatId, number>;
  const door = s.map.doors[0]!.inside;
  const st = createStaff(s, hero.role, { name: 0, stats, traits: [...HERO.traits], level: HERO.level, rarity: 'mythic', wage: ZERO, hero: hero.id }, { ...hero.look }, door);
  st.rank = rankOf(HERO.level);
  st.morale = 1;
  emote(st, Emote.Star);
  emit(s, Ev.Hired, door.x, door.y);
  s.staff.push(st);
}

/** Every hero the player has is on this restaurant's team (a new branch, a new building, an old save). */
export function heroesJoin(s: GameState): void {
  if (s.construction) return;
  for (const h of heroesOwned(s)) if (!s.staff.some((st) => st.hero === h.id)) joinHero(s, h);
}
