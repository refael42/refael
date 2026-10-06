import type { CharacterView, PropView } from './types';
import { EntityType } from './types';

/**
 * The render snapshot: a flat number array the UI thread can read cheaply. One fixed-size record
 * per entity, already sorted back-to-front, so the renderer just walks it in order.
 */
export const STRIDE = 25;

/** Fields shared by every record. */
export const F = { type: 0, x: 1, y: 2, px: 3, py: 4, id: 5 } as const;

/** Character record fields. */
export const C = {
  facing: 6,
  pose: 7,
  poseTime: 8,
  outfit: 9,
  hair: 10,
  hairColor: 11,
  skin: 12,
  shirt: 13,
  pants: 14,
  hat: 15,
  accessory: 16,
  held: 17,
  expression: 18,
  emote: 19,
  emoteTime: 20,
  patience: 21,
  bubble: 22,
  rank: 23,
  patienceKind: 24,
} as const;

/** Prop record fields. */
export const P = { kind: 6, variant: 7, level: 8, active: 9, lift: 10, since: 11, progress: 12, bubble: 13 } as const;

/** Sim events (coins earned, dish ready...) ride along so the UI thread can spawn effects. */
export const EVENT_STRIDE = 8;
export const E = { id: 0, time: 1, type: 2, x: 3, y: 4, a: 5, b: 6, c: 7 } as const;

/**
 * Every list in a snapshot is a typed array: the snapshot crosses to the UI thread every frame,
 * and the worklets library copies a plain array one number at a time (a native call each:
 * ten thousand a frame in a big restaurant) but a typed array in one block.
 */
export type Packed = Float64Array;

export interface Snapshot {
  /** Increments on every publish so the renderer can detect a new tick. */
  seq: number;
  /** Sim time (seconds) of the current state; "px/py" belong to one step earlier. */
  time: number;
  count: number;
  data: Packed;
  /** Recent events (a sliding window, so a skipped UI frame never loses one). */
  events: Packed;
  /** How far into the day we are (0..1): the evening and night light. */
  dayPhase: number;
  /** Look tier per prop kind and per dish (milestones change how things look). */
  tiers: Packed;
  dishTiers: Packed;
  /** Sim time of the last upgrade per prop kind (that station bounces). */
  bumps: Packed;
  /** "Upgrade available" arrows: packed (x, y, prop kind) triples. */
  badges: Packed;
  /** The best buy right now: (x, y, prop kind), or empty. A gold star instead of the arrow. */
  bestBadge: Packed;
  /** Big upgrades in progress, WORK_STRIDE numbers each (see W). */
  works: Packed;
  /** Today's weather (src/data/weather.ts). */
  weather: number;
  /** Which city the branch is in (its trees). */
  city: number;
}

/** Packed work sites: floor position, progress 0..1, seconds left, the station's prop kind. */
export const WORK_STRIDE = 5;
export const W = { x: 0, y: 1, progress: 2, left: 3, kind: 4 } as const;

export interface SnapshotExtra {
  events?: number[] | Packed;
  dayPhase?: number;
  tiers?: number[];
  dishTiers?: number[];
  bumps?: number[];
  badges?: number[];
  bestBadge?: number[];
  works?: number[];
  weather?: number;
  city?: number;
}

const NONE: Packed = new Float64Array(0);
export const EMPTY_SNAPSHOT: Snapshot = { seq: 0, time: 0, count: 0, data: NONE, events: NONE, dayPhase: 0, tiers: NONE, dishTiers: NONE, bumps: NONE, badges: NONE, bestBadge: NONE, works: NONE, weather: 0, city: 0 };

interface SortItem {
  depth: number;
  id: number;
  character?: CharacterView;
  prop?: PropView;
}

function writeCharacter(d: Packed, o: number, c: CharacterView): void {
  d[o + F.type] = EntityType.Character;
  d[o + F.x] = c.x;
  d[o + F.y] = c.y;
  d[o + F.px] = c.prevX;
  d[o + F.py] = c.prevY;
  d[o + F.id] = c.id;
  d[o + C.facing] = c.facing;
  d[o + C.pose] = c.pose;
  d[o + C.poseTime] = c.poseTime;
  d[o + C.outfit] = c.look.outfit;
  d[o + C.hair] = c.look.hair;
  d[o + C.hairColor] = c.look.hairColor;
  d[o + C.skin] = c.look.skin;
  d[o + C.shirt] = c.look.shirt;
  d[o + C.pants] = c.look.pants;
  d[o + C.hat] = c.look.hat;
  d[o + C.accessory] = c.look.accessory;
  d[o + C.held] = c.held;
  d[o + C.expression] = c.expression;
  d[o + C.emote] = c.emote;
  d[o + C.emoteTime] = c.emoteTime;
  d[o + C.patience] = c.patience;
  d[o + C.bubble] = c.bubble;
  d[o + C.rank] = c.rank ?? 0;
  d[o + C.patienceKind] = c.patienceKind ?? 0;
}

function writeProp(d: Packed, o: number, p: PropView): void {
  d[o + F.type] = EntityType.Prop;
  d[o + F.x] = p.x;
  d[o + F.y] = p.y;
  d[o + F.px] = p.x;
  d[o + F.py] = p.y;
  d[o + F.id] = p.id;
  d[o + P.kind] = p.kind;
  d[o + P.variant] = p.variant;
  d[o + P.level] = p.level;
  d[o + P.active] = p.active ? 1 : 0;
  d[o + P.lift] = p.lift;
  d[o + P.since] = p.since;
  d[o + P.progress] = p.progress;
  d[o + P.bubble] = p.bubble;
}

const packed = (v: readonly number[] | Packed | undefined): Packed => (v instanceof Float64Array ? v : v && v.length > 0 ? Float64Array.from(v) : NONE);

export function packSnapshot(
  characters: readonly CharacterView[],
  props: readonly PropView[],
  seq: number,
  time: number,
  extra: SnapshotExtra = {},
): Snapshot {
  const items: SortItem[] = [];
  // Isometric painter's order: farther from the camera = smaller x + y. Characters win ties so a
  // seated customer draws over the chair on the same tile.
  for (const c of characters) items.push({ depth: c.x + c.y + 0.05, id: c.id, character: c });
  for (const p of props) items.push({ depth: p.x + p.y + p.depthBias, id: p.id, prop: p });
  items.sort((a, b) => a.depth - b.depth || a.id - b.id);
  const data: Packed = new Float64Array(items.length * STRIDE);
  items.forEach((item, i) => {
    if (item.character) writeCharacter(data, i * STRIDE, item.character);
    else writeProp(data, i * STRIDE, item.prop!);
  });
  return {
    seq,
    time,
    count: items.length,
    data,
    events: packed(extra.events),
    dayPhase: extra.dayPhase ?? 0,
    tiers: packed(extra.tiers),
    dishTiers: packed(extra.dishTiers),
    bumps: packed(extra.bumps),
    badges: packed(extra.badges),
    bestBadge: packed(extra.bestBadge),
    works: packed(extra.works),
    weather: extra.weather ?? 0,
    city: extra.city ?? 0,
  };
}
