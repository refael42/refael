import { seasonCount } from '../season';
import { HEAT, PREP, REQUEST, REQUESTS } from '../../data/service';
import { chance, next } from '../rng';
import { Emote } from '../types';
import { emote } from './customers';
import { emit, Ev } from './events';
import { qualityOf } from './people';
import { OrderState, type Customer, type GameState, type Order, type Staff } from './types';

// Service and kitchen logic (owner M49, numbers in src/data/service.ts): plates cool on the
// pass, idle cooks stock mise en place that speeds up the next dishes, and some guests ask for
// their dish a special way (which a cook can get wrong, and the checker can catch).

// ---------- hot plates ----------

/** How hot a plate on the pass is now: 1 just set down, 0 cold. */
export function heatOf(s: GameState, o: Order): number {
  if (o.readyAt === undefined) return 1;
  const waited = s.time - o.readyAt;
  const hot = HEAT.hotSeconds * s.mods.heat;
  if (waited <= hot) return 1;
  return Math.max(0, 1 - (waited - hot) / (HEAT.coolSeconds * s.mods.heat));
}

/** Taken off the pass (by a waiter, or sent flying): the heat it reaches the guest with. */
export function takeOffPass(s: GameState, o: Order): void {
  o.heat = heatOf(s, o);
}

/**
 * The plate lands in front of its guest: what it does to the bill (a multiplier on the dish's
 * quality) and to the guest's mood. Hot sells for more; cold, or a special request made wrong,
 * leaves a sour note in their mood (and something to write about).
 */
export function servedPlate(s: GameState, c: Customer, o: Order): number {
  let mult = 1;
  const heat = o.heat ?? 1;
  if (!o.delivery && heat >= HEAT.hotAt) {
    mult *= HEAT.hotBonus;
    c.hot = true;
    seasonCount(s, 'hot');
  } else if (!o.delivery && heat < HEAT.coldBelow) {
    mult *= HEAT.coldPrice;
    c.cold = true;
    moodNote(c, HEAT.coldMood);
  }
  if (o.request !== undefined) {
    if (o.wrong) {
      c.wrong = true;
      moodNote(c, REQUEST.wrongMood);
      emote(c, Emote.Anger);
    } else {
      c.requestMet = true;
      emote(c, Emote.Heart);
      seasonCount(s, 'request');
    }
  }
  return mult;
}

/** One more thing the guest felt about the visit (0 furious .. 1 delighted), averaged with the waits. */
function moodNote(c: Customer, mood: number): void {
  c.moodSum += mood;
  c.moodCount += 1;
}

// ---------- mise en place ----------

/** How many units of prep the kitchen can keep ready. */
export const prepCap = (s: GameState): number => Math.min(PREP.maxCap, Math.round(PREP.cap * s.mods.prep));

/** An idle cook chops at their station: `rate` = their work rate. True when a unit is ready. */
export function prepWork(s: GameState, dt: number, rate: number): boolean {
  if (s.prep >= prepCap(s)) return false;
  s.prepWork += (dt * rate * s.mods.prep) / PREP.seconds;
  if (s.prepWork < 1) return false;
  s.prepWork -= 1;
  s.prep += 1;
  return true;
}

/** A cook takes a ticket: a unit of prep from the stock makes it quicker, if there is one. */
export function usePrep(s: GameState, o: Order): void {
  if (s.prep < 1) return;
  s.prep -= 1;
  o.prepped = true;
  seasonCount(s, 'prep');
}

/** How much longer than the dish's own time this ticket takes (prep makes it quicker, a request slower). */
export function cookTimeMult(o: Order): number {
  return (o.prepped ? 1 - PREP.cut : 1) * (o.request !== undefined ? 1 + REQUEST.extraCook : 1);
}

// ---------- special requests ----------

/** Share of diners who ask for their dish a special way, in this building. */
export const requestChance = (s: GameState): number => Math.min(REQUEST.maxChance, REQUEST.chance + REQUEST.perTier * s.mods.building);

/** A guest ordering: maybe they want it spicy, vegan or gluten-free (index into REQUESTS). */
export function rollRequest(s: GameState, c: Customer): number | undefined {
  if (c.inspector || s.stats.served < REQUEST.afterServed || !chance(s.rng, requestChance(s))) return undefined;
  const request = Math.floor(next(s.rng) * REQUESTS.length) % REQUESTS.length;
  c.request = request;
  return request;
}

/** The chance a cook gets a special request wrong (better cooks and the requests board: less often). */
export const mistakeChance = (s: GameState, st: Staff): number => Math.min(0.6, REQUEST.mistake / (qualityOf(st) * s.mods.requests));

/** A cook starts a ticket with a request: did they get it right? (A dish made again after the checker caught it is.) */
export function cookRequest(s: GameState, st: Staff, o: Order): void {
  if (o.request === undefined) return;
  o.wrong = !o.remade && chance(s.rng, mistakeChance(s, st));
}

/**
 * The checker found the dish made the wrong way: back to the kitchen to be made again (the
 * plate goes to the dirty pile). True when it was sent back.
 */
export function sendBack(s: GameState, st: Staff, o: Order, at: { x: number; y: number }): boolean {
  if (!o.wrong) return false;
  emote(st, Emote.Exclaim);
  seasonCount(s, 'caught');
  emit(s, Ev.Poof, at.x, at.y);
  s.dirtyPlates += 1;
  o.state = OrderState.Queued;
  o.progress = 0;
  o.slot = -1;
  o.waiter = -1;
  o.since = s.time;
  o.wrong = false;
  o.remade = true;
  delete o.checked;
  delete o.readyAt;
  delete o.from;
  delete o.prepped;
  return true;
}

/** The share of the bill a guest whose request was made right leaves on top of the tip. */
export const requestTip = (s: GameState, c: Customer): number => (c.requestMet ? REQUEST.tip * s.mods.requests : 0);
