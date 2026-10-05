import type { Point } from '../../data/maps';
import { computeMods, costOf, levelOf, milestonesReached, upgradeDef } from '../economy/upgrades';
import { planBuy, workSeconds } from '../economy/works';
import type { BulkStep } from '../../data/works';
import { crewsOf, startWork } from './works';
import { PropKind } from '../types';
import { startConstruction } from './construction';
import { DECOR } from '../../data/decor';
import { autoTile, canPlaceAt } from './build';
import { addSeat, addStove, addTable, placeDecor } from './create';
import { chairOf, route } from './customers';
import { emit, Ev } from './events';
import type { GameState, Work } from './types';

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

/** Where a big upgrade is being built: the tile picked for decor, else the station it upgrades. */
export function siteOf(s: GameState, w: Work): Point {
  if (w.at) return w.at;
  const def = upgradeDef(w.item);
  return anchorPoints(s, def.anchor)[0] ?? s.map.pass;
}

/**
 * Buys one level, or a batch of them (bulk buying), if allowed and affordable. Decor goes on
 * tile `at` (it must be free), or on the nearest free tile when no spot was chosen. A level that
 * needs a crew starts its job and ends the batch. Returns whether anything was bought.
 */
export function buyUpgrade(s: GameState, id: string, at?: Point, step: BulkStep = 1): boolean {
  const def = upgradeDef(id);
  const plan = planBuy(def, s.levels, s.coins, s.map, crewsOf(s), def.build ? 1 : step);
  if (plan.status !== 'ok') return false;
  const decor = def.build ? DECOR.find((d) => d.kind === def.anchor) : undefined;
  const tile = decor ? (at ? (canPlaceAt(s, at.x, at.y) ? at : null) : autoTile(s)) : null;
  if (decor && !tile) return false;
  for (let i = 0; i < plan.count; i++) {
    const level = levelOf(s.levels, id);
    s.coins = s.coins.sub(costOf(def, level));
    if (workSeconds(def, level) > 0) {
      const site = tile ?? anchorPoints(s, def.anchor)[0] ?? s.map.pass;
      startWork(s, id, level, tile ? { x: Math.floor(tile.x) + 0.5, y: Math.floor(tile.y) + 0.5 } : null, site);
      s.bumpAt[def.anchor] = s.time;
      break;
    }
    applyLevel(s, id, tile, i === plan.count - 1);
  }
  return true;
}

/** A crew is done: the level counts now (decor goes on its tile, or the nearest free one). */
export function finishWork(s: GameState, w: Work): void {
  const def = upgradeDef(w.item);
  if (levelOf(s.levels, w.item) !== w.level - 1) return;
  const tile = def.build ? (w.at && canPlaceAt(s, w.at.x, w.at.y) ? w.at : autoTile(s, w.at ?? undefined)) : null;
  // No room left for the piece (a rare corner case): the crew hands the money back.
  if (def.build && !tile) {
    s.coins = s.coins.add(costOf(def, w.level - 1));
    return;
  }
  applyLevel(s, w.item, tile, true);
  const site = siteOf(s, w);
  emit(s, Ev.WorkDone, site.x, site.y, w.level);
}

/** One more level of `id` counts now: effects, new furniture, the level-up show (`show`: on the last of a batch). */
function applyLevel(s: GameState, id: string, tile: Point | null, show: boolean): void {
  const def = upgradeDef(id);
  const decor = def.build ? DECOR.find((d) => d.kind === def.anchor) : undefined;
  const level = levelOf(s.levels, id);
  const before = s.mods;
  s.levels = { ...s.levels, [id]: level + 1 };
  s.mods = computeMods(s.levels, s.perks);
  // Bought plates go straight onto the clean stack.
  s.cleanPlates += s.mods.plates - before.plates;
  // A new building is a show of its own (and rebuilds the whole place when it is done).
  if (s.mods.building > before.building) {
    startConstruction(s);
    return;
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
  s.bumpAt[def.anchor] = s.time;
  if (!show) return;
  const milestone = milestonesReached(level + 1) > milestonesReached(level) ? 1 : 0;
  // Dozens of tables or chairs: the effect plays on a few of them, the level shows on one.
  const shown = fx.length <= UPGRADE_FX_SPOTS ? fx : Array.from({ length: UPGRADE_FX_SPOTS }, (_, i) => fx[Math.floor((i * fx.length) / UPGRADE_FX_SPOTS)]!);
  shown.forEach((p, i) => emit(s, Ev.Upgrade, p.x, p.y, level + 1, milestone + (i > 0 ? UPGRADE_QUIET : 0), def.anchor));
}
