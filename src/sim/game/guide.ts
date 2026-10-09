import { DAY } from '../../data/staff';
import { DISHES } from '../../data/dishes';
import { GUIDE, verdictOf } from '../../data/guide';
import { UPGRADES } from '../../data/upgrades';
import { Accessory, Outfit } from '../../data/looks';
import { levelOf } from '../economy/upgrades';
import { hash01 } from '../retention';
import { Emote } from '../types';
import { emit, Ev } from './events';
import type { Customer, GameState, Order } from './types';
import { notify } from './workers';

// The restaurant guide (owner M29: "Michelin logic, stars you get like in real life"); the
// rules are in src/data/guide.ts. Rolls go by hash (the game's dice are left alone).

export interface GuideVisit {
  day: number;
  score: number;
}

export interface GuideState {
  /** Stars held (0-3), and the plate: "recommended" (no star yet). */
  stars: number;
  plate: boolean;
  /** Editions out so far. */
  edition: number;
  /** This edition's inspections so far. */
  visits: GuideVisit[];
  /** What the last edition said. `change`: stars won (+1) or lost (-1). */
  last: { edition: number; stars: number; plate: boolean; change: number; average: number; visits: number } | null;
  /** When today's inspector walks in (sim time; -1 none today). Not saved: a new day rolls again. */
  due: number;
  /** The kitchen's recent plates (their quality, 0-1): consistency. Not saved. */
  recent: number[];
}

export const newGuide = (): GuideState => ({ stars: 0, plate: false, edition: 0, visits: [], last: null, due: -1, recent: [] });

/** What the stars do to every bill, and to how many come. */
export const guidePrice = (s: GameState): number => GUIDE.price[s.guide.stars] ?? 1;
export const guideArrivals = (s: GameState): number => GUIDE.arrivals[s.guide.stars] ?? 1;

/** A level counts by its log, in full from `fullLevel` on: the first levels matter most. */
const norm = (level: number): number => Math.max(0, Math.min(1, Math.log10(1 + level) / Math.log10(1 + GUIDE.fullLevel)));
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** The recipe track of a dish (its menu row). */
const RECIPE_OF: Record<number, string> = Object.fromEntries(UPGRADES.filter((u) => u.category === 'menu' && u.effect.dish !== undefined).map((u) => [u.effect.dish!, u.id]));

/** The cook's hand on a plate (0-1): their quality, a little their experience. Set when they start the dish. */
export const chefTouch = (quality: number, level: number): number => clamp01(((quality - 1) / 9) * 0.8 + (Math.min(level, 10) / 10) * 0.2);

/** How good the kitchen makes this dish (0-1), without the service: the cook, the recipe. */
function plateQuality(s: GameState, o: Order): number {
  return (o.chef ?? 0.4) * 0.6 + norm(levelOf(s.levels, RECIPE_OF[o.dish] ?? '')) * 0.4;
}

/** Every plate served counts toward consistency. */
export function recordPlate(s: GameState, o: Order): void {
  s.guide.recent.push(plateQuality(s, o));
  if (s.guide.recent.length > GUIDE.recent) s.guide.recent.shift();
}

function consistency(s: GameState): number {
  const r = s.guide.recent;
  if (r.length < 3) return 0.8;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) * (b - mean), 0) / r.length);
  return clamp01(1 - sd * 3);
}

/** The parts of a plate's score (each 0-1), for the guide page and the inspector. */
export function scoreParts(s: GameState, o: Order | null, servedAt: number) {
  const wait = o && o.readyAt !== undefined ? servedAt - o.readyAt : GUIDE.hotSeconds;
  return {
    chef: o?.chef ?? avgChef(s),
    mastery: o ? norm(levelOf(s.levels, RECIPE_OF[o.dish] ?? '')) : avgMastery(s),
    equipment: norm(levelOf(s.levels, 'stove')),
    ingredients: norm(levelOf(s.levels, 'fridge')),
    temperature: 1 - clamp01((wait - GUIDE.hotSeconds) / (GUIDE.coldSeconds - GUIDE.hotSeconds)),
    consistency: consistency(s),
  };
}

const avgChef = (s: GameState): number => {
  const cooks = s.staff.filter((st) => st.role === 'cook' && !st.leaving);
  return cooks.length ? cooks.reduce((a, st) => a + chefTouch(st.stats.quality, st.level), 0) / cooks.length : 0;
};
const avgMastery = (s: GameState): number => {
  const menu = DISHES.filter((d) => s.mods.menu[d.id]);
  return menu.length ? menu.reduce((a, d) => a + norm(levelOf(s.levels, RECIPE_OF[d.id] ?? '')), 0) / menu.length : 0;
};

/** A plate's score out of 100 (what an inspector would give it). */
export function scoreOf(s: GameState, o: Order | null, servedAt: number): number {
  const p = scoreParts(s, o, servedAt);
  const w = GUIDE.weights;
  const raw = w.chef * p.chef + w.mastery * p.mastery + w.equipment * p.equipment + w.ingredients * p.ingredients + w.temperature * p.temperature + w.consistency * p.consistency;
  return Math.round(Math.max(0, Math.min(100, raw * 100 + (o?.checked ? GUIDE.checkedBonus : 0))));
}

/** A new day: maybe an inspector comes today (some time during it); every seventh day the guide comes out. */
export function guideNewDay(s: GameState): void {
  if (s.day % GUIDE.everyDays === 0) publish(s);
  s.guide.due = -1;
  if (s.day < GUIDE.firstDay) return;
  const roll = hash01(s.day * 7.31 + s.city * 3.7 + 0.19);
  if (roll < (GUIDE.visitChance[s.guide.stars] ?? 0.3)) s.guide.due = s.time + hash01(s.day * 2.17 + 0.71) * DAY.seconds * 0.7;
}

/** Is today's inspector about to walk in? */
export const inspectorDue = (s: GameState): boolean => s.guide.due >= 0 && s.time >= s.guide.due;

/**
 * This guest, alone, is the inspector (nobody knows yet): a quiet diner in a grey suit and
 * glasses, who orders one of the house's best dishes.
 */
export function makeInspector(s: GameState, c: Customer): void {
  s.guide.due = -1;
  c.inspector = true;
  c.look = { ...c.look, outfit: Outfit.Suit, accessory: Accessory.Glasses, shirt: 1 };
}

/** The dish an inspector orders: one of the three priciest on the menu (by hash). */
export function inspectorDish(s: GameState, c: Customer, menu: readonly number[], price: (dish: number) => number): number {
  const best = [...menu].sort((a, b) => price(b) - price(a)).slice(0, 3);
  return best[Math.floor(hash01(c.id * 1.37 + 0.4) * best.length)] ?? menu[0]!;
}

/** The inspector's plate reached the table: how it scored. */
export function inspectPlate(s: GameState, c: Customer, o: Order): void {
  if (c.inspector) c.inspectScore = scoreOf(s, o, s.time);
}

/** The inspector paid (or walked out): the visit counts, and they say who they were and what they thought. */
export function inspectorLeaves(s: GameState, c: Customer, walkedOut: boolean): void {
  if (!c.inspector) return;
  const score = walkedOut ? GUIDE.walkoutScore : (c.inspectScore ?? GUIDE.walkoutScore);
  s.guide.visits.push({ day: s.day, score });
  c.inspector = false;
  emit(s, Ev.Inspector, c.x, c.y, score);
  notify(s, { kind: 'inspector', score, verdict: verdictOf(score) });
}

/** The new edition: the visits since the last one decide. One star at a time, up or down. */
export function publish(s: GameState): void {
  const g = s.guide;
  const v = g.visits;
  const avg = v.length ? v.reduce((a, x) => a + x.score, 0) / v.length : 0;
  const worst = v.length ? Math.min(...v.map((x) => x.score)) : 0;
  const before = g.stars;
  let stars = g.stars;
  if (v.length > 0) {
    // A starred place that slipped loses a star.
    if (stars > 0 && avg < GUIDE.starScore[stars - 1]! - GUIDE.loseMargin) stars -= 1;
    // The next star: enough visits, a high enough average, and no bad night among them.
    else if (stars < 3 && v.length >= GUIDE.visitsFor.stars[stars]! && avg >= GUIDE.starScore[stars]! && worst >= GUIDE.starWorst[stars]!) stars += 1;
  }
  g.plate = stars > 0 || g.plate || (v.length >= GUIDE.visitsFor.plate && avg >= GUIDE.plateScore);
  if (stars === 0 && v.length > 0 && avg < GUIDE.plateScore - GUIDE.loseMargin) g.plate = false;
  g.stars = stars;
  g.edition += 1;
  g.last = { edition: g.edition, stars, plate: g.plate, change: stars - before, average: Math.round(avg), visits: v.length };
  g.visits = [];
  emit(s, Ev.Guide, 0, 0, stars, stars - before, g.plate ? 1 : 0);
  notify(s, { kind: 'guide', stars, change: stars - before, plate: g.plate, visits: v.length });
}

/** The inspector's reveal on the way out: a happy chef, a wave. */
export const INSPECTOR_EMOTE = Emote.Star;
