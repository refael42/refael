import { DECOR } from '../../data/decor';
import type { MapDef } from '../../data/maps';
import { SHOP } from '../../data/shop';
import { RANK, type UpgradeDef } from '../../data/upgrades';
import { WORKS, type BulkStep } from '../../data/works';
import { ZERO, type Big } from '../big';
import { capOf, costOf, isMaxed, isUnlocked, levelOf, milestonesReached, type Levels, type Perks } from './upgrades';

// Which levels take a crew and how long, and what one tap on a buy button gets you (one level,
// ten, a hundred or as many as you can pay for). Pure: the sim, the bot and the screens agree.

/** A job in progress, as the shop sees it. */
export interface WorkView {
  id: number;
  item: string;
  /** Seconds the whole job takes, and what is left of it. */
  total: number;
  left: number;
}

/** Seconds a crew needs for level `level + 1` of this track; 0 = it counts at once. */
export function workSeconds(def: UpgradeDef, level: number): number {
  const last = <T,>(list: readonly T[]) => list[list.length - 1]!;
  if (def.id === 'building') return WORKS.building[level + 1] ?? last(WORKS.building);
  if (def.id === RANK.id) return Math.min(WORKS.rank.max, WORKS.rank.base + WORKS.rank.per * level);
  if (def.unlocksDish !== undefined && level === 0) return WORKS.recipe[def.unlocksDish] ?? last(WORKS.recipe);
  if (def.build) {
    const decor = DECOR.find((d) => d.kind === def.anchor);
    return (decor && WORKS.place[decor.id]) || 0;
  }
  if (def.spots === 'stoves') return WORKS.stove;
  // A milestone gives the station a new look (or a new multiplier): it is rebuilt.
  if (!def.milestone && !def.restyle) return 0;
  const reached = milestonesReached(level + 1);
  if (reached === milestonesReached(level)) return 0;
  return WORKS.milestone[reached - 1] ?? WORKS.laterMilestone;
}

/** Gems to finish a job right now. */
export const gemsToFinish = (left: number): number => Math.max(1, Math.ceil(left / WORKS.gemSeconds));

/** Crews working at the same time: the starting ones plus any bought in the shop. */
export function crewCount(perks: Perks): number {
  return WORKS.crews + SHOP.filter((i) => i.kind === 'crew' && perks[i.id]).length;
}

/** What the crews are doing: jobs in progress and how many crews there are. */
export interface Crews {
  works: readonly WorkView[];
  crews: number;
}

export type BuyStatus =
  /** Tap and it happens. */
  | 'ok'
  /** Not enough coins yet: the button still shows, greyed. */
  | 'poor'
  | 'locked'
  | 'max'
  /** A crew is on this one: wait (or tap the site, or pay gems). */
  | 'working'
  /** The next level needs a crew and all of them are busy. */
  | 'noCrew';

export interface BuyPlan {
  status: BuyStatus;
  /** Levels this tap buys, and what they cost together. */
  count: number;
  cost: Big;
  /** The batch's last level needs a crew this long (0 = everything counts at once). */
  seconds: number;
}

/** Bulk "max" never looks further than this (prices grow fast, so it is never reached in play). */
const MAX_BATCH = 1000;

/**
 * What one tap on the buy button does now. A batch stops at a level that needs a crew: that
 * level starts the job and the rest waits for it, so bulk buying can't skip the build times.
 */
export function planBuy(def: UpgradeDef, levels: Levels, coins: Big, map: MapDef, crews: Crews, step: BulkStep): BuyPlan {
  const level = levelOf(levels, def.id);
  const none = (status: BuyStatus): BuyPlan => ({ status, count: 0, cost: ZERO, seconds: 0 });
  if (!isUnlocked(def, levels)) return none('locked');
  if (isMaxed(def, levels, map)) return none('max');
  if (crews.works.some((w) => w.item === def.id)) return none('working');
  const crewFree = crews.works.length < crews.crews;
  const want = step === 'max' ? MAX_BATCH : step;
  const cap = capOf(def, map, levels) ?? Infinity;
  let count = 0;
  let cost = ZERO;
  let seconds = 0;
  while (count < want && level + count < cap) {
    const price = costOf(def, level + count);
    if (step === 'max' && count > 0 && cost.add(price).gt(coins)) break;
    const needs = workSeconds(def, level + count);
    // With every crew busy the batch ends just before the level that needs one.
    if (needs > 0 && !crewFree) {
      if (count === 0) return { status: 'noCrew', count: 1, cost: price, seconds: needs };
      break;
    }
    cost = cost.add(price);
    count += 1;
    if (needs > 0) {
      seconds = needs;
      break;
    }
  }
  return { status: coins.gte(cost) ? 'ok' : 'poor', count, cost, seconds };
}
