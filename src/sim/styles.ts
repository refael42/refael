import { STYLE, STYLES } from '../data/styles';
import { emit, Ev } from './game/events';
import type { GameState } from './game/types';
import { hash01 } from './retention';
import { incomeRate } from './shop';

// Restaurant styles (src/data/styles.ts). The player picks one (from the bistro on); a change
// costs a few minutes of income, the first one is free. The style's dishes sell for more and draw
// a share of the orders by the guest's id (no dice: a classic game plays exactly as before). The
// player's: saved, and it goes along to a new branch (its building opens styles again later).

export interface StyleState {
  /** Index into STYLES (0 = classic). */
  id: number;
  /** Changes made so far (the first is free). */
  changes: number;
}

export const newStyle = (): StyleState => ({ id: 0, changes: 0 });

export const stylesOpen = (s: GameState): boolean => s.mods.building >= STYLE.minTier;

/** The style the restaurant shows now (classic until styles open). */
export const styleNow = (s: GameState): number => (stylesOpen(s) ? s.style.id : 0);

export const styleCost = (s: GameState) => (s.style.changes === 0 ? incomeRate(s).mul(0) : incomeRate(s).mul(STYLE.costMinutes * 60).floor().max(100));

export function setStyle(s: GameState, id: number): boolean {
  if (!stylesOpen(s) || !STYLES[id] || id === s.style.id) return false;
  const cost = styleCost(s);
  if (s.coins.lt(cost)) return false;
  s.coins = s.coins.sub(cost);
  s.style.id = id;
  s.style.changes += 1;
  emit(s, Ev.StyleChanged, 0, 0, id);
  return true;
}

/** A style dish sells for more. */
export const stylePrice = (s: GameState, dish: number): number => (STYLES[styleNow(s)]!.dishes.includes(dish) ? STYLE.dishPrice : 1);

/** Some guests come for the style's dishes (by their id): the dish, or -1. */
export function styleOrder(s: GameState, id: number): number {
  const on = STYLES[styleNow(s)]!.dishes.filter((d) => s.mods.menu[d]);
  if (on.length === 0 || hash01(id * 5.31 + 0.47) >= STYLE.dishChance) return -1;
  return on[Math.floor(hash01(id * 7.77 + 0.13) * on.length)]!;
}

export function cleanStyle(raw: unknown): StyleState {
  if (!raw || typeof raw !== 'object') return newStyle();
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'number' && STYLES[o.id] ? Math.floor(o.id) : 0;
  const changes = typeof o.changes === 'number' && Number.isFinite(o.changes) ? Math.max(0, Math.floor(o.changes)) : 0;
  return { id, changes };
}
