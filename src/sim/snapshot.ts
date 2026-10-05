import type { World } from './types';
import { EntityType } from './types';

/**
 * The render snapshot: a flat number array the UI thread can read cheaply. One fixed-size record
 * per entity, already sorted back-to-front (by y), so the renderer just walks it in order.
 */
export const STRIDE = 22;

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
} as const;

/** Prop record fields. */
export const P = { kind: 6, variant: 7, level: 8, active: 9, lift: 10 } as const;

export interface Snapshot {
  /** Increments on every publish so the renderer can detect a new tick. */
  seq: number;
  /** Sim time (seconds) of the current state; "px/py" belong to one step earlier. */
  time: number;
  count: number;
  data: number[];
}

export const EMPTY_SNAPSHOT: Snapshot = { seq: 0, time: 0, count: 0, data: [] };

interface SortItem {
  y: number;
  id: number;
  write: (out: number[], o: number) => void;
}

export function packSnapshot(world: World, seq: number): Snapshot {
  const items: SortItem[] = [];
  for (const c of world.characters) {
    items.push({
      y: c.y,
      id: c.id,
      write: (d, o) => {
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
      },
    });
  }
  for (const p of world.props) {
    items.push({
      y: p.y,
      id: p.id,
      write: (d, o) => {
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
      },
    });
  }
  items.sort((a, b) => a.y - b.y || a.id - b.id);
  const data = new Array<number>(items.length * STRIDE).fill(0);
  items.forEach((item, i) => item.write(data, i * STRIDE));
  return { seq, time: world.time, count: items.length, data };
}
