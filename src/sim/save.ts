import { HAIR_COLORS, HAIR_STYLE_COUNT, SKIN_TONES, type Look } from '../data/looks';
import type { MapDef } from '../data/maps';
import { NAMES } from '../data/names';
import { ROLE_LIST, ROLES, STAFF, STAT_IDS, type Role } from '../data/staff';
import { TRAITS, type TraitId } from '../data/traits';
import { UPGRADE_BY_ID } from '../data/upgrades';
import { fromSave, toSave } from './big';
import { createGame, type SavedWorker } from './game/create';
import type { GameState } from './game/types';

// Versioned save format. The world itself (customers mid-meal, plates in hands) is not saved:
// a loaded game starts a fresh, empty day with all the progress (coins, rating, upgrades).
// Changing the format = bump SAVE_VERSION and add a migration from the previous version.

export const SAVE_VERSION = 2;

/** A worker in the save: everything about them, wage as a Big string. */
export interface WorkerData extends Omit<SavedWorker, 'wage'> {
  wage: string;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  /** Wall-clock ms when written (for offline progress). */
  savedAt: number;
  coins: string;
  earned: string;
  rating: number;
  served: number;
  hires: number;
  day: number;
  levels: Record<string, number>;
  team: WorkerData[];
}

/** Upgrades an object from version `n` to `n + 1`. */
export type Migration = (old: Record<string, unknown>) => Record<string, unknown>;

/** A plain level-1 worker, as everyone was before hiring existed. */
function plainWorker(role: Role, name: number): WorkerData {
  return {
    role,
    name,
    stats: { speed: 5, quality: 5, charm: 5, stamina: 5 },
    traits: [],
    level: 1,
    wage: toSave(fromSave(`${4 * ROLES[role].wageDishes}`)),
    xp: 0,
    morale: STAFF.morale.start,
    look: { ...ROLES[role].look },
    hiredDay: 1,
    lastRaiseDay: 1,
    trial: false,
  };
}

/** MIGRATIONS[n] turns a version-n save into version n + 1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v1 (M3) had no hiring: every restaurant came with a cook, a waiter and a dishwasher.
  1: (old) => ({ ...old, day: 1, hires: 0, team: (['cook', 'waiter', 'washer'] as const).map((r, i) => plainWorker(r, i)) }),
};

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
    hires: s.stats.hires,
    day: s.day,
    levels: { ...s.levels },
    team: s.staff
      .filter((st) => !st.leaving)
      .map((st) => ({
        role: st.role,
        name: st.name,
        stats: { ...st.stats },
        traits: [...st.traits],
        level: st.level,
        wage: toSave(st.wage),
        xp: st.xp,
        morale: st.morale,
        look: { ...st.look },
        hiredDay: st.hiredDay,
        lastRaiseDay: st.lastRaiseDay,
        trial: st.trial,
      })),
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

const bigText = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  try {
    fromSave(v);
    return true;
  } catch {
    return false;
  }
};

const index = (v: unknown, size: number, fallback: number) => (finite(v) && v >= 0 && v < size ? Math.floor(v) : fallback);

/** A worker from the save, repaired where possible (a bad look falls back to the uniform). */
function cleanWorker(raw: unknown): WorkerData | null {
  if (!isRecord(raw) || !ROLE_LIST.includes(raw.role as Role) || !bigText(raw.wage) || !isRecord(raw.stats)) return null;
  const role = raw.role as Role;
  const stats = {} as WorkerData['stats'];
  for (const k of STAT_IDS) stats[k] = Math.max(STAFF.stat.min, Math.min(STAFF.stat.max, finite(raw.stats[k]) ? Math.round(raw.stats[k]) : 5));
  const look: Look = { ...ROLES[role].look };
  if (isRecord(raw.look)) {
    look.skin = index(raw.look.skin, SKIN_TONES.length, look.skin);
    look.hair = index(raw.look.hair, HAIR_STYLE_COUNT, look.hair) as Look['hair'];
    look.hairColor = index(raw.look.hairColor, HAIR_COLORS.length, look.hairColor);
  }
  return {
    role,
    name: index(raw.name, NAMES.length, 0),
    stats,
    traits: (Array.isArray(raw.traits) ? raw.traits : []).filter((t): t is TraitId => typeof t === 'string' && t in TRAITS),
    level: finite(raw.level) && raw.level >= 1 ? Math.floor(raw.level) : 1,
    wage: raw.wage,
    xp: finite(raw.xp) && raw.xp >= 0 ? raw.xp : 0,
    morale: finite(raw.morale) ? Math.max(0, Math.min(1, raw.morale)) : STAFF.morale.start,
    look,
    hiredDay: finite(raw.hiredDay) ? raw.hiredDay : 1,
    lastRaiseDay: finite(raw.lastRaiseDay) ? raw.lastRaiseDay : 1,
    trial: raw.trial === true,
  };
}

function validate(o: Record<string, unknown>): SaveData | null {
  if (o.version !== SAVE_VERSION) return null;
  if (!finite(o.savedAt) || !finite(o.rating) || !finite(o.served) || !finite(o.hires) || !finite(o.day)) return null;
  if (!bigText(o.coins) || !bigText(o.earned) || !Array.isArray(o.team)) return null;
  const levels = cleanLevels(o.levels);
  if (!levels) return null;
  const team = o.team.map(cleanWorker).filter((w): w is WorkerData => w !== null);
  return {
    version: SAVE_VERSION,
    savedAt: o.savedAt,
    coins: o.coins,
    earned: o.earned,
    rating: o.rating,
    served: o.served,
    hires: o.hires,
    day: Math.max(1, Math.floor(o.day)),
    levels,
    team,
  };
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

export const savedTeam = (save: SaveData): SavedWorker[] => save.team.map((w) => ({ ...w, wage: fromSave(w.wage) }));

/** A fresh day in the saved restaurant, with the saved team. */
export function restoreGame(map: MapDef, save: SaveData, seed: number): GameState {
  return createGame(map, seed, {
    levels: save.levels,
    coins: fromSave(save.coins),
    earned: fromSave(save.earned),
    rating: save.rating,
    served: save.served,
    hires: save.hires,
    day: save.day,
    team: savedTeam(save),
  });
}
