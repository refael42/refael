import { HAIR_COLORS, HAIR_STYLE_COUNT, SKIN_TONES, type Look } from '../data/looks';
import { mapForTier, SAVE_SHIFT, STAND_MAP, type MapDef } from '../data/maps';
import { NAMES } from '../data/names';
import { ROLE_LIST, ROLES, STAFF, STAT_IDS, type Role } from '../data/staff';
import { DECOR_BY_ID } from '../data/decor';
import { TRAITS, type TraitId } from '../data/traits';
import { RANK, UPGRADE_BY_ID } from '../data/upgrades';
import { fromSave, toSave } from './big';
import { capOf, isCappedTrack, levelOf } from './economy/upgrades';
import { createGame, workerOf, type SavedWork, type SavedWorker } from './game/create';
import type { GameState, PlacedDecor, QuestState } from './game/types';
import { questLevel } from './quests';
import { GEMS, SHOP_BY_ID } from '../data/shop';
import { WHEEL, WHEEL_SEGMENTS } from '../data/wheel';
import { newWheel } from './wheel';
import { FESTIVAL, FESTIVAL_THEMES } from '../data/events';
import { newFestival } from './festival';

// Versioned save format. The world itself (customers mid-meal, plates in hands) is not saved:
// a loaded game starts a fresh, empty day with all the progress (coins, rating, upgrades).
// Changing the format = bump SAVE_VERSION and add a migration from the previous version.

export const SAVE_VERSION = 10;

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
  /** Decor placed in build mode (tile centers). */
  placed: PlacedDecor[];
  /** Restaurant level and its claimed quests; the all-time counters quests use. */
  quests: QuestState;
  fiveStars: number;
  rushes: number;
  bestCombo: number;
  /** Deliveries brought out (saves from before deliveries have none: 0). */
  delivered: number;
  /** Item shop: gems, perks owned, an income boost still running (seconds left). */
  gems: number;
  perks: Record<string, number>;
  boost: { mult: number; seconds: number };
  /** Big upgrades in progress (seconds left when saved; the time away counts too). */
  works: SavedWork[];
  /** Branches: the city this one is in, chef trophies won in the branches before. */
  city: number;
  trophies: number;
  /** The daily gift streak (older v7 saves have none: a fresh streak). */
  daily: { last: string | null; streak: number };
  /** The lucky wheel (older v7 saves have none: a new wheel, its free spin ready). */
  wheel: { nextFree: number; tokens: number; spins: number; prize: number };
  /** The food festival on, its points and rewards taken, trophies won; the flash deal last bought. */
  festival: { id: number; points: number; claimed: number; trophies: number[] };
  flash: { slot: number; bought: boolean };
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
  // v2 (M4) had no build mode.
  2: (old) => ({ ...old, placed: [] }),
  // v3 (M5) had no quests: start at restaurant level 1 (goals already met are just done).
  3: (old) => ({ ...old, quests: { level: 1, claimed: [] }, fiveStars: 0, rushes: 0, bestCombo: 0 }),
  // v4 (M7) had no item shop: everyone gets the starting gems.
  4: (old) => ({ ...old, gems: GEMS.start, perks: {}, boost: { mult: 1, seconds: 0 } }),
  // v5 (M8) had no build times (nothing in progress) and no restaurant level capping the
  // tracks: the restaurant starts at the level its highest track already needs.
  5: (old) => ({ ...old, works: [], levels: withRankFor(old.levels) }),
  // v6 (M11) had no branches: the first city, no trophies yet.
  6: (old) => ({ ...old, city: 0, trophies: 0 }),
  // v7 (M16) maps started at the world's corner; v8 (M18) puts every building in one big site
  // with land around it: placed decor and work sites move with the room (a piece that no longer
  // lands on the dining floor goes to the nearest free tile when the game is built).
  // (The shift of that day: the land added round the site in v10 moves them again.)
  7: (old) => shiftPlaces(old, SAVE_SHIFT.v8),
  // v8 (M19) had no events: no festival seen yet, no deal bought.
  8: (old) => ({ ...old, festival: newFestival(), flash: { slot: -1, bought: false } }),
  // v9 (M22) had less land round the site and no crown: the whole site moved right and back.
  9: (old) => shiftPlaces(old, SAVE_SHIFT.v10),
};

/** Placed decor and work sites, moved with the site by `d` tiles. */
function shiftPlaces(old: Record<string, unknown>, d: { x: number; y: number }): Record<string, unknown> {
  return {
    ...old,
    placed: Array.isArray(old.placed) ? old.placed.map((p) => (isRecord(p) && finite(p.x) && finite(p.y) ? { ...p, x: p.x + d.x, y: p.y + d.y } : p)) : old.placed,
    works: Array.isArray(old.works) ? old.works.map((w) => (isRecord(w) && isRecord(w.at) && finite(w.at.x) && finite(w.at.y) ? { ...w, at: { x: w.at.x + d.x, y: w.at.y + d.y } } : w)) : old.works,
  };
}

/** Old levels plus the restaurant level that keeps every one of them (nothing is taken away). */
function withRankFor(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  let top = 0;
  for (const [id, level] of Object.entries(raw)) {
    const def = UPGRADE_BY_ID[id];
    if (def && isCappedTrack(def) && finite(level)) top = Math.max(top, level);
  }
  const rank = Math.max(0, Math.ceil(top / RANK.levels) - 1);
  const had = raw[RANK.id];
  return rank > 0 ? { ...raw, [RANK.id]: Math.max(rank, finite(had) ? had : 0) } : raw;
}

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
    team: s.staff.filter((st) => !st.leaving).map((st) => ({ ...workerOf(st), wage: toSave(st.wage) })),
    placed: s.placed.map((p) => ({ ...p })),
    quests: { level: s.quests.level, claimed: [...s.quests.claimed] },
    fiveStars: s.stats.fiveStars,
    rushes: s.stats.rushes,
    bestCombo: s.stats.bestCombo,
    delivered: s.stats.delivered,
    gems: s.gems,
    perks: { ...s.perks },
    boost: { mult: s.boost.mult, seconds: Math.max(0, s.boost.until - s.time) },
    works: s.works.map((w) => ({ item: w.item, level: w.level, total: w.total, left: Math.max(0, w.left), at: w.at ? { ...w.at } : null })),
    city: s.city,
    trophies: s.trophies,
    daily: { ...s.daily },
    wheel: { ...s.wheel },
    festival: { ...s.festival, trophies: [...s.festival.trophies] },
    flash: { ...s.flash },
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
    out[id] = Math.floor(level);
  }
  // Caps depend on the building (free table spots...), so the building level is settled first.
  const building = UPGRADE_BY_ID.building!;
  if (out.building) out.building = Math.min(out.building, capOf(building, STAND_MAP, out) ?? Infinity);
  const map = mapForTier(levelOf(out, 'building'));
  // Twice: second chairs are capped by the tables, which the first pass may have cut down.
  for (let pass = 0; pass < 2; pass++) {
    for (const id of Object.keys(out)) out[id] = Math.min(out[id]!, capOf(UPGRADE_BY_ID[id]!, map, out) ?? Infinity);
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
  if (!bigText(o.coins) || !bigText(o.earned) || !Array.isArray(o.team) || !Array.isArray(o.placed)) return null;
  const levels = cleanLevels(o.levels);
  if (!levels) return null;
  const quests = cleanQuests(o.quests);
  if (!quests) return null;
  const count = (v: unknown) => (finite(v) && v >= 0 ? Math.floor(v) : 0);
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
    // Only known decor on real coordinates; whether a spot is still free is checked when the game is built.
    placed: o.placed.filter((p): p is PlacedDecor => isRecord(p) && typeof p.item === 'string' && p.item in DECOR_BY_ID && finite(p.x) && finite(p.y)).map((p) => ({ item: p.item, x: p.x, y: p.y })),
    quests,
    fiveStars: count(o.fiveStars),
    rushes: count(o.rushes),
    bestCombo: count(o.bestCombo),
    delivered: count(o.delivered),
    gems: count(o.gems),
    // Only perks the shop still sells.
    perks: Object.fromEntries(Object.keys(isRecord(o.perks) ? o.perks : {}).filter((id) => SHOP_BY_ID[id]?.kind === 'perk' || SHOP_BY_ID[id]?.kind === 'crew').map((id) => [id, 1])),
    works: cleanWorks(o.works, levels),
    city: count(o.city),
    trophies: count(o.trophies),
    daily: isRecord(o.daily) && (typeof o.daily.last === 'string' || o.daily.last === null) && finite(o.daily.streak)
      ? { last: o.daily.last as string | null, streak: Math.max(0, Math.min(7, Math.floor(o.daily.streak))) }
      : { last: null, streak: 0 },
    wheel: cleanWheel(o.wheel),
    festival: cleanFestival(o.festival),
    flash: isRecord(o.flash) && finite(o.flash.slot) ? { slot: Math.floor(o.flash.slot), bought: o.flash.bought === true } : { slot: -1, bought: false },
    boost: isRecord(o.boost) && finite(o.boost.mult) && finite(o.boost.seconds) && o.boost.mult >= 1 ? { mult: o.boost.mult, seconds: Math.max(0, o.boost.seconds) } : { mult: 1, seconds: 0 },
  };
}

/** The lucky wheel, or a new one (a prize waiting on a segment that no longer exists is dropped). */
function cleanWheel(raw: unknown): SaveData['wheel'] {
  if (!isRecord(raw) || !finite(raw.nextFree)) return newWheel();
  const count = (v: unknown) => (finite(v) && v >= 0 ? Math.floor(v) : 0);
  const prize = finite(raw.prize) && Number.isInteger(raw.prize) && raw.prize >= 0 && raw.prize < WHEEL_SEGMENTS.length ? raw.prize : -1;
  return { nextFree: raw.nextFree, tokens: Math.min(WHEEL.maxStored, count(raw.tokens)), spins: count(raw.spins), prize };
}

/** The festival (rewards taken within the track, one trophy per theme), or a fresh one. */
function cleanFestival(raw: unknown): SaveData['festival'] {
  if (!isRecord(raw) || !finite(raw.id)) return newFestival();
  const count = (v: unknown) => (finite(v) && v >= 0 ? Math.floor(v) : 0);
  const trophies = Array.isArray(raw.trophies) ? [...new Set(raw.trophies.filter((t): t is number => finite(t) && Number.isInteger(t) && t >= 0 && t < FESTIVAL_THEMES.length))] : [];
  return { id: Math.floor(raw.id), points: count(raw.points), claimed: Math.min(FESTIVAL.track.length, count(raw.claimed)), trophies };
}

/** Jobs on upgrades that still exist, one per item, each bringing the next level. */
function cleanWorks(raw: unknown, levels: Record<string, number>): SavedWork[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedWork[] = [];
  for (const w of raw) {
    if (!isRecord(w) || typeof w.item !== 'string' || !UPGRADE_BY_ID[w.item] || out.some((x) => x.item === w.item)) continue;
    if (!finite(w.level) || w.level !== (levels[w.item] ?? 0) + 1 || !finite(w.total) || w.total <= 0 || !finite(w.left)) continue;
    const at = isRecord(w.at) && finite(w.at.x) && finite(w.at.y) ? { x: w.at.x, y: w.at.y } : null;
    out.push({ item: w.item, level: w.level, total: w.total, left: Math.max(0, Math.min(w.total, w.left)), at });
  }
  return out;
}

/** A level of 1 or more and the claimed goals of it (valid indices, no repeats). */
function cleanQuests(raw: unknown): QuestState | null {
  if (!isRecord(raw) || !finite(raw.level) || raw.level < 1 || !Array.isArray(raw.claimed)) return null;
  const level = Math.floor(raw.level);
  const goals = questLevel(level).goals.length;
  const claimed = [...new Set(raw.claimed.filter((i): i is number => finite(i) && i >= 0 && i < goals).map(Math.floor))];
  return { level, claimed };
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

/** The building the save was in. */
export const mapOfSave = (save: SaveData): MapDef => mapForTier(levelOf(save.levels, 'building'));

/** A fresh day in the saved restaurant, with the saved team (`now`: the crews kept working meanwhile). */
export function restoreGame(save: SaveData, seed: number, now: number = save.savedAt): GameState {
  const away = Math.max(0, (now - save.savedAt) / 1000);
  return createGame(mapOfSave(save), seed, {
    levels: save.levels,
    coins: fromSave(save.coins),
    earned: fromSave(save.earned),
    rating: save.rating,
    served: save.served,
    hires: save.hires,
    day: save.day,
    team: savedTeam(save),
    placed: save.placed,
    quests: save.quests,
    fiveStars: save.fiveStars,
    rushes: save.rushes,
    bestCombo: save.bestCombo,
    delivered: save.delivered,
    gems: save.gems,
    perks: save.perks,
    boost: save.boost,
    works: save.works.map((w) => ({ ...w, left: Math.max(0, w.left - away) })),
    city: save.city,
    trophies: save.trophies,
    daily: save.daily,
    wheel: save.wheel,
    festival: save.festival,
    flash: save.flash,
  });
}
