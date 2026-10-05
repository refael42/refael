import type { Point } from '../../data/maps';
import { canBuy, computeMods, costOf, levelOf, milestonesReached, upgradeDef } from '../economy/upgrades';
import { PropKind } from '../types';
import { startConstruction } from './construction';
import { addSeat, addStove, addTable } from './create';
import { chairOf, route } from './customers';
import { emit, Ev } from './events';
import type { GameState } from './types';

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

/** Buys one level if allowed and affordable. Returns whether it happened. */
export function buyUpgrade(s: GameState, id: string): boolean {
  const def = upgradeDef(id);
  if (!canBuy(def, s.levels, s.coins, s.map)) return false;
  const level = levelOf(s.levels, id);
  s.coins = s.coins.sub(costOf(def, level));
  const before = s.mods;
  s.levels = { ...s.levels, [id]: level + 1 };
  s.mods = computeMods(s.levels);
  // Bought plates go straight onto the clean stack.
  s.cleanPlates += s.mods.plates - before.plates;
  // A new building is a show of its own (and rebuilds the whole place when it is done).
  if (s.mods.building > before.building) {
    startConstruction(s);
    return true;
  }

  let at = anchorPoints(s, def.anchor);
  if (s.mods.tables > before.tables) {
    const table = addTable(s);
    rerouteWalkers(s);
    at = table ? [table] : [];
  }
  if (s.mods.stoves > before.stoves) {
    const stove = addStove(s);
    rerouteWalkers(s);
    at = stove ? [stove] : [];
  }
  if (s.mods.seats > before.seats) {
    const table = addSeat(s);
    rerouteWalkers(s);
    at = table ? [chairOf(table, 1)] : [];
  }
  const milestone = milestonesReached(level + 1) > milestonesReached(level) ? 1 : 0;
  for (const p of at) emit(s, Ev.Upgrade, p.x, p.y, level + 1, milestone, def.anchor);
  s.bumpAt[def.anchor] = s.time;
  return true;
}
