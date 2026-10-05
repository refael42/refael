import { UPGRADE_BY_ID } from '../data/upgrades';
import type { MapDef } from '../data/maps';
import { fromSave, toSave } from './big';
import { createGame } from './game/create';
import type { GameState } from './game/types';

// Versioned save format. The world itself (customers mid-meal, plates in hands) is not saved:
// a loaded game starts a fresh, empty day with all the progress (coins, rating, upgrades).
// Changing the format = bump SAVE_VERSION and add a migration from the previous version.

export const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  /** Wall-clock ms when written (for offline progress). */
  savedAt: number;
  coins: string;
  earned: string;
  rating: number;
  served: number;
  levels: Record<string, number>;
}

/** Upgrades an object from version `n` to `n + 1`. */
export type Migration = (old: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[n] turns a version-n save into version n + 1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export type LoadResult =
  | { ok: true; save: SaveData }
  /** `future` = written by a newer app version: never overwrite it. */
  | { ok: false; reason: 'empty' | 'corrupt' | 'future' };

export function makeSave(s: GameState, now: number): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: now,
    coins: toSave(s.coins),
    earned: toSave(s.stats.earned),
    rating: s.rating,
    served: s.stats.served,
    levels: { ...s.levels },
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Keeps only upgrades that still exist, as whole levels within their caps. */
function cleanLevels(raw: unknown): Record<string, number> | null {
  if (!isRecord(raw)) return null;
  const out: Record<string, number> = {};
  for (const [id, level] of Object.entries(raw)) {
    const def = UPGRADE_BY_ID[id];
    if (!def || !finite(level) || level <= 0) continue;
    out[id] = Math.min(Math.floor(level), def.max ?? Infinity);
  }
  return out;
}

function validate(o: Record<string, unknown>): SaveData | null {
  if (o.version !== SAVE_VERSION) return null;
  if (!finite(o.savedAt) || !finite(o.rating) || !finite(o.served)) return null;
  if (typeof o.coins !== 'string' || typeof o.earned !== 'string') return null;
  const levels = cleanLevels(o.levels);
  if (!levels) return null;
  try {
    fromSave(o.coins);
    fromSave(o.earned);
  } catch {
    return null;
  }
  return { version: SAVE_VERSION, savedAt: o.savedAt, coins: o.coins, earned: o.earned, rating: o.rating, served: o.served, levels };
}

export function parseSave(text: string | null, migrations: Readonly<Record<number, Migration>> = MIGRATIONS): LoadResult {
  if (text === null || text === '') return { ok: false, reason: 'empty' };
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (!isRecord(o) || !finite(o.version)) return { ok: false, reason: 'corrupt' };
  if (o.version > SAVE_VERSION) return { ok: false, reason: 'future' };
  let current: Record<string, unknown> = o;
  for (let v = o.version; v < SAVE_VERSION; v++) {
    const migrate = migrations[v];
    if (!migrate) return { ok: false, reason: 'corrupt' };
    current = { ...migrate(current), version: v + 1 };
  }
  const save = validate(current);
  return save ? { ok: true, save } : { ok: false, reason: 'corrupt' };
}

/** A fresh day in the saved restaurant. */
export function restoreGame(map: MapDef, save: SaveData, seed: number): GameState {
  return createGame(map, seed, {
    levels: save.levels,
    coins: fromSave(save.coins),
    earned: fromSave(save.earned),
    rating: save.rating,
    served: save.served,
  });
}
