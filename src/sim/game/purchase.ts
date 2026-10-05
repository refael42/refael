import type { Point } from '../../data/maps';
import { canBuy, computeMods, costOf, levelOf, milestonesReached, upgradeDef } from '../economy/upgrades';
import { PropKind } from '../types';
import { startConstruction } from './construction';
import { DECOR } from '../../data/decor';
import { autoTile, canPlaceAt } from './build';
import { addSeat, addStove, addTable, placeDecor } from './create';
import { chairOf, route } from './customers';
import { emit, Ev } from './events';
import type { GameState } from './types';

/** An upgrade's effect plays on at most this many of its pieces (each one costs frame time). */
const UPGRADE_FX_SPOTS = 4;
/** Added to the event's milestone flag: play the effect without the "LV n" text. */
export const UPGRADE_QUIET = 2;

/** Where an upgrade "lives" on the map right now (every table for tablecloths, etc.). */
export function anchorPoints(s: GameState, kind: PropKind): Point[] {
  if (kind === PropKind.Table) return s.tables.map((t) => ({ x: t.x, y: t.y }));
  if (kind === PropKind.TableSlot) {
    const next = s.map.tables[s.tables.length];
    return next ? [next] : [];
  }
  if (kind === PropKind.StoveSlot) {
    const next = s.map.stoves[s.stoves.length];
    return next ? [next.stove] : [];
  }
  if (kind === PropKind.PlatesClean) return [s.map.cleanStack];
  return s.props.filter((p) => p.kind === kind).map((p) => ({ x: p.x, y: p.y }));
}

/** New furniture blocks tiles: everyone already walking re-plans around it. */
function rerouteWalkers(s: GameState): void {
  for (const c of [...s.customers, ...s.staff]) {
    const goal = c.path[c.path.length - 1];
    if (goal) c.path = route(s, c, goal);
  }
}

/**
 * Buys one level if allowed and affordable. Decor goes on tile `at` (it must be free), or on the
 * nearest free tile when no spot was chosen. Returns whether it happened.
 */
export function buyUpgrade(s: GameState, id: string, at?: Point): boolean {
  const def = upgradeDef(id);
  if (!canBuy(def, s.levels, s.coins, s.map)) return false;
  const decor = def.build ? DECOR.find((d) => d.kind === def.anchor) : undefined;
  const tile = decor ? (at ? (canPlaceAt(s, at.x, at.y) ? at : null) : autoTile(s)) : null;
  if (decor && !tile) return false;
  const level = levelOf(s.levels, id);
  s.coins = s.coins.sub(costOf(def, level));
  const before = s.mods;
  s.levels = { ...s.levels, [id]: level + 1 };
  s.mods = computeMods(s.levels, s.perks);
  // Bought plates go straight onto the clean stack.
  s.cleanPlates += s.mods.plates - before.plates;
  // A new building is a show of its own (and rebuilds the whole place when it is done).
  if (s.mods.building > before.building) {
    startConstruction(s);
    return true;
  }

  let fx = anchorPoints(s, def.anchor);
  if (decor && tile) {
    fx = [placeDecor(s, decor.id, tile)];
    rerouteWalkers(s);
  }
  if (s.mods.tables > before.tables) {
    const table = addTable(s);
    rerouteWalkers(s);
    fx = table ? [table] : [];
  }
  if (s.mods.stoves > before.stoves) {
    const stove = addStove(s);
    rerouteWalkers(s);
    fx = stove ? [stove] : [];
  }
  if (s.mods.seats > before.seats) {
    const table = addSeat(s);
    rerouteWalkers(s);
    fx = table ? [chairOf(table, 1)] : [];
  }
  const milestone = milestonesReached(level + 1) > milestonesReached(level) ? 1 : 0;
  // Dozens of tables or chairs: the effect plays on a few of them, the level shows on one.
  const shown = fx.length <= UPGRADE_FX_SPOTS ? fx : Array.from({ length: UPGRADE_FX_SPOTS }, (_, i) => fx[Math.floor((i * fx.length) / UPGRADE_FX_SPOTS)]!);
  shown.forEach((p, i) => emit(s, Ev.Upgrade, p.x, p.y, level + 1, milestone + (i > 0 ? UPGRADE_QUIET : 0), def.anchor));
  s.bumpAt[def.anchor] = s.time;
  return true;
}
