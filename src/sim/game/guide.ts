import { DAY } from '../../data/staff';
import { DISHES } from '../../data/dishes';
import { GUIDE, verdictOf } from '../../data/guide';
import { UPGRADES } from '../../data/upgrades';
import { Accessory, Outfit } from '../../data/looks';
import { levelOf } from '../economy/upgrades';
import { hash01 } from '../retention';
import { Emote } from '../types';
import { emit, Ev } from './events';
import { OrderState, type Customer, type GameState, type Order } from './types';
import { notify } from './workers';
import { gainXp as chefXp } from '../chef';
import { TALENT } from '../../data/talents';
import { grantTalentPoints } from './talents';

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
  last: { edition: number; stars: number; plate: boolean; change: number; average: number; visits: number; gems?: number; talent?: number } | null;
  /** When today's inspector walks in (sim time; -1 none today). Not saved: a new day rolls again. */
  due: number;
  /** The kitchen's recent plates (their quality, 0-1): consistency. Not saved. */
  recent: number[];
  /** Today the staff heard an inspector is in town; look-alikes still to come (their times). Not saved. */
  rumor: boolean;
  decoyAt: number[];
  /** Who got the head chef's attention today (a customer id; -1: nobody yet). Not saved. */
  attention: number;
  /** The best mark this restaurant ever won (-1 none, 0 the plate, 1-3 stars): its gems come once. */
  best: number;
}

export const newGuide = (): GuideState => ({ stars: 0, plate: false, edition: 0, visits: [], last: null, due: -1, recent: [], rumor: false, decoyAt: [], attention: -1, best: -1 });

/** Above a guest's head: a suspect on a rumor day (a magnifier), the one the chef cooks for (a toque). Rides in `rank`. */
export const SUSPECT_RANK = 5;
export const ATTENDED_RANK = 6;

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
  const g = s.guide;
  g.due = -1;
  g.rumor = false;
  g.decoyAt = [];
  g.attention = -1;
  // Yesterday's suspects are just guests again.
  for (const c of s.customers) if (c.rank === SUSPECT_RANK) c.rank = 0;
  if (s.day < GUIDE.firstDay) return;
  const roll = hash01(s.day * 7.31 + s.city * 3.7 + 0.19);
  if (roll >= (GUIDE.visitChance[g.stars] ?? 0.3)) return;
  g.due = s.time + hash01(s.day * 2.17 + 0.71) * DAY.seconds * 0.7;
  // Word gets around the kitchen (most days): look-alikes come a little before and after.
  if (hash01(s.day * 3.91 + s.city * 1.3 + 0.37) >= GUIDE.rumorChance) return;
  g.rumor = true;
  g.decoyAt = [Math.max(s.time + 4, g.due - 18), g.due + 12].slice(0, GUIDE.decoys);
}

/** Is a look-alike due (a lone guest on a rumor day)? */
export const lookalikeDue = (s: GameState): boolean => s.guide.rumor && s.guide.decoyAt.length > 0 && s.time >= s.guide.decoyAt[0]!;

/** This lone guest dresses like an inspector, but is not one: the first wears the glasses too. */
export function makeLookalike(s: GameState, c: Customer): void {
  const first = s.guide.decoyAt.length === GUIDE.decoys;
  s.guide.decoyAt.shift();
  c.suspect = true;
  c.look = { ...c.look, outfit: Outfit.Suit, accessory: first ? Accessory.Glasses : c.look.accessory === Accessory.Glasses ? Accessory.None : c.look.accessory, shirt: first ? 1 : c.look.shirt };
  if (s.guide.attention < 0) c.rank = SUSPECT_RANK;
}

/** A suspect can still get the chef's attention: the rumor is on, nobody chosen yet, their plate not on the table. */
export const canAttend = (s: GameState, c: Customer): boolean => s.guide.rumor && s.guide.attention < 0 && c.rank === SUSPECT_RANK;

/**
 * The manager picks this guest: the head chef cooks for them. Their ticket goes to the front;
 * when the plate lands, the best cook's hand and the chef's tasting count (src/sim/game/guide.ts
 * inspectPlate). Everyone else is just a guest again.
 */
export function giveAttention(s: GameState, c: Customer): boolean {
  if (!canAttend(s, c)) return false;
  s.guide.attention = c.id;
  c.attention = true;
  c.rank = ATTENDED_RANK;
  for (const o of s.customers) if (o.rank === SUSPECT_RANK) o.rank = 0;
  const i = s.orders.findIndex((o) => o.customer === c.id && o.state === OrderState.Queued);
  if (i > 0) s.orders.unshift(...s.orders.splice(i, 1));
  // A guest waiting is calmer at once: the chef came out to say hello.
  c.patienceLeft = c.patienceMax;
  c.patience = 1;
  emit(s, Ev.Attention, c.x, c.y, c.inspector ? 1 : 0);
  return true;
}

/** The head chef's hand: the best cook on the team. */
const bestTouch = (s: GameState): number => s.staff.reduce((m, st) => (st.role === 'cook' && !st.leaving ? Math.max(m, chefTouch(st.stats.quality, st.level)) : m), 0);

/** A look-alike given the chef's attention leaves a big thank-you: part of the bill again. */
export const attentionTip = (c: Customer): number => (c.attention && !c.inspector ? GUIDE.attentionTip : 0);

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
  // On a rumor day they are one of the suspects.
  if (s.guide.rumor && s.guide.attention < 0) c.rank = SUSPECT_RANK;
}

/** The dish an inspector orders: one of the three priciest on the menu (by hash). */
export function inspectorDish(s: GameState, c: Customer, menu: readonly number[], price: (dish: number) => number): number {
  const best = [...menu].sort((a, b) => price(b) - price(a)).slice(0, 3);
  return best[Math.floor(hash01(c.id * 1.37 + 0.4) * best.length)] ?? menu[0]!;
}

/** The inspector's plate reached the table: how it scored (with the head chef's hand and tasting, if they were picked). */
export function inspectPlate(s: GameState, c: Customer, o: Order): void {
  // Too late to pick them now.
  if (c.rank === SUSPECT_RANK) c.rank = 0;
  if (!c.inspector) return;
  const plate = c.attention ? { ...o, chef: Math.max(o.chef ?? 0, bestTouch(s)), checked: true } : o;
  c.inspectScore = scoreOf(s, plate, s.time);
  c.inspectParts = scoreParts(s, plate, s.time);
}

/** The inspector paid (or walked out): the visit counts, and they say who they were and what they thought. */
export function inspectorLeaves(s: GameState, c: Customer, walkedOut: boolean): void {
  if (!c.inspector) return;
  const score = walkedOut ? GUIDE.walkoutScore : (c.inspectScore ?? GUIDE.walkoutScore);
  s.guide.visits.push({ day: s.day, score });
  c.inspector = false;
  if (c.rank === SUSPECT_RANK || c.rank === ATTENDED_RANK) c.rank = 0;
  // The rumor is over: the look-alikes are just guests again.
  s.guide.rumor = false;
  s.guide.decoyAt = [];
  for (const o of s.customers) if (o.rank === SUSPECT_RANK) o.rank = 0;
  emit(s, Ev.Inspector, c.x, c.y, score);
  if (!walkedOut) chefXp(s, 'inspector');
  // What they noted: the best and the weakest part of the plate (none if they walked out).
  const parts = walkedOut ? null : c.inspectParts;
  const ranked = parts ? (Object.keys(GUIDE.weights) as (keyof typeof GUIDE.weights)[]).sort((a, b) => parts[b] - parts[a]) : [];
  notify(s, { kind: 'inspector', score, verdict: verdictOf(score), dish: c.dish, best: ranked[0] ?? '', worst: ranked[ranked.length - 1] ?? '', spotted: !!c.attention, walkedOut });
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
  // A mark won for the first time: its gems (the plate counts as mark 0).
  const mark = stars > 0 ? stars : g.plate ? 0 : -1;
  let gems = 0;
  let talent = 0;
  for (let m = g.best + 1; m <= mark; m++) {
    gems += GUIDE.rewardGems[m] ?? 0;
    talent += TALENT.points.guide[m] ?? 0;
  }
  g.best = Math.max(g.best, mark);
  s.gems += gems;
  grantTalentPoints(s, talent, true);
  g.last = { edition: g.edition, stars, plate: g.plate, change: stars - before, average: Math.round(avg), visits: v.length, gems, ...(talent > 0 ? { talent } : {}) };
  g.visits = [];
  emit(s, Ev.Guide, 0, 0, stars, stars - before, g.plate ? 1 : 0);
  if (stars > before) chefXp(s, 'star', stars - before);
  notify(s, { kind: 'guide', stars, change: stars - before, plate: g.plate, visits: v.length });
}

/** The inspector's reveal on the way out: a happy chef, a wave. */
export const INSPECTOR_EMOTE = Emote.Star;

export type GuideStatus = 'noVisits' | 'badNight' | 'avgLow' | 'moreVisits' | 'onTrack' | 'top';

/**
 * How this edition stands for the next star (the guide page): the visits it needs and has,
 * the average it needs and has, the worst night allowed, what is missing, a star at risk, and
 * the gems the next mark brings the first time.
 */
export function guideProgress(s: GameState) {
  const g = s.guide;
  const scores = g.visits.map((v) => v.score);
  const have = scores.length;
  const avg = have ? Math.round(scores.reduce((a, b) => a + b, 0) / have) : 0;
  const worst = have ? Math.min(...scores) : 0;
  const k = g.stars;
  const top = k >= 3;
  const needVisits = top ? 0 : GUIDE.visitsFor.stars[k]!;
  const needAvg = top ? GUIDE.starScore[2]! : GUIDE.starScore[k]!;
  const needWorst = top ? GUIDE.starWorst[2]! : GUIDE.starWorst[k]!;
  let status: GuideStatus;
  if (top) status = 'top';
  else if (have === 0) status = 'noVisits';
  else if (worst < needWorst) status = 'badNight';
  else if (avg < needAvg) status = 'avgLow';
  else if (have < needVisits) status = 'moreVisits';
  else status = 'onTrack';
  // A starred place averaging well under its mark this edition loses a star when it comes out.
  const risk = k > 0 && have > 0 && avg < GUIDE.starScore[k - 1]! - GUIDE.loseMargin;
  const nextMark = top ? -1 : k + 1;
  const gems = nextMark > g.best ? (GUIDE.rewardGems[nextMark] ?? 0) : 0;
  return { scores, have, avg, worst, needVisits, needAvg, needWorst, status, risk, gems, plateNeeded: !g.plate && k === 0 };
}
