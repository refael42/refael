import { MISSION_BY_KIND, MISSIONS, SEASON, SEASON_TIERS, type MissionDef, type MissionKind, type SeasonReward } from '../data/season';
import { PURCHASE_LOG } from '../data/shop';
import { REQUEST } from '../data/service';
import { big, type Big } from './big';
import { emit, Ev } from './game/events';
import { openDesserts } from './game/desserts';
import { grantTalentPoints } from './game/talents';
import type { GameState } from './game/types';
import { hash01 } from './retention';
import { boostNow, grantCoins, incomeRate } from './shop';

// The season pass (src/data/season.ts). Like the festival, the sim has no clock: the phone's time
// comes in with a command now and then and picks the season, the day and the week. Missions
// count what happens while you play (never while away), from the moment they came up.

const DAY_MS = 24 * 3600 * 1000;
const SEASON_MS = SEASON.days * DAY_MS;
const WEEKS = Math.ceil(SEASON.days / 7);

export interface Mission {
  kind: MissionKind;
  /** How many it asks for, and the season count it started from. */
  need: number;
  base: number;
  xp: number;
  claimed: boolean;
  /** Weekly missions: the season's week (0-3) they came in. */
  week?: number;
}

export interface SeasonState {
  /** The season on (-1: no clock reading yet). */
  id: number;
  xp: number;
  gold: boolean;
  /** Tiers whose prize was taken, on each track; prizes past the last tier taken. */
  free: number;
  goldTaken: number;
  extra: number;
  /** What happened this season, by mission kind (missions count from here). */
  counts: Partial<Record<MissionKind, number>>;
  /** The local day the daily missions are for, and the weeks whose missions came in. */
  day: number;
  daily: Mission[];
  weeks: number;
  weekly: Mission[];
  /** Medals won in the seasons so far (kept for good, in every branch). */
  medals: { free: number; gold: number };
}

export const newSeason = (): SeasonState => ({ id: -1, xp: 0, gold: false, free: 0, goldTaken: 0, extra: 0, counts: {}, day: -1, daily: [], weeks: 0, weekly: [], medals: { free: 0, gold: 0 } });

/** Which season is on at this moment (the same number on every phone). */
export const seasonAt = (now: number): number => Math.floor((now - SEASON.epoch) / SEASON_MS);
export const seasonStarts = (id: number): number => SEASON.epoch + id * SEASON_MS;
export const seasonEnds = (id: number): number => seasonStarts(id + 1);
/** The phone's local day (its midnight, `tzMin` = Date#getTimezoneOffset). */
export const localDay = (now: number, tzMin: number): number => Math.floor((now - tzMin * 60000) / DAY_MS);
/** The season's week at this moment (0 = its first). */
export const weekAt = (id: number, now: number): number => Math.max(0, Math.min(WEEKS - 1, Math.floor((now - seasonStarts(id)) / (7 * DAY_MS))));

/** Tiers the XP has reached (up to the last), and prizes past the last tier. */
export const tiersReached = (ss: SeasonState): number => Math.min(SEASON_TIERS, Math.floor(ss.xp / SEASON.tierXp));
export const extrasReached = (ss: SeasonState): number => Math.max(0, Math.floor(ss.xp / SEASON.tierXp) - SEASON_TIERS);

/** Every bill is this much higher for the medals won (1 = none). */
export const seasonBonus = (s: GameState): number => 1 + SEASON.medal.free * s.season.medals.free + SEASON.medal.gold * s.season.medals.gold;

/** Can this kind of mission come up in this restaurant now? */
export function missionOpen(s: GameState, def: MissionDef): boolean {
  const on = (role: string) => s.staff.some((st) => st.role === role && !st.leaving);
  switch (def.needs) {
    case 'desserts':
      return openDesserts(s).length > 0;
    case 'bartender':
      return on('bartender');
    case 'courier':
      return on('courier');
    case 'checker':
      return on('checker');
    case 'requests':
      return s.stats.served >= REQUEST.afterServed;
    default:
      return true;
  }
}

/** How far along a mission is (capped at what it asks for). */
export const missionHave = (ss: SeasonState, m: Mission): number => Math.max(0, Math.min(m.need, (ss.counts[m.kind] ?? 0) - m.base));
export const missionDone = (ss: SeasonState, m: Mission): boolean => missionHave(ss, m) >= m.need;

/** Something counted for the season's missions (a guest served, a plate hot...). */
export function seasonCount(s: GameState, kind: MissionKind, n = 1): void {
  if (s.season.id < 0 || n <= 0) return;
  s.season.counts[kind] = (s.season.counts[kind] ?? 0) + n;
}

/** Picks `count` different kinds of mission, the same for this season, day and slot on every phone with the same restaurant. */
function pickMissions(s: GameState, count: number, salt: number, weekly: boolean): Mission[] {
  const ss = s.season;
  const pool = MISSIONS.filter((m) => (weekly ? m.weekly : m.daily) && missionOpen(s, m));
  const out: Mission[] = [];
  const tier = s.mods.building;
  for (let i = 0; i < count && pool.length > 0; i++) {
    const def = pool.splice(Math.floor(hash01(ss.id * 7.31 + salt * 1.97 + i * 0.613) * pool.length) % pool.length, 1)[0]!;
    const [base, per] = (weekly ? def.weekly : def.daily)!;
    out.push({ kind: def.kind, need: Math.max(1, Math.round(base + per * tier)), base: ss.counts[def.kind] ?? 0, xp: weekly ? SEASON.weeklyXp : SEASON.dailyXp, claimed: false });
  }
  return out;
}

/** XP in, tier by tier (a new tier says so). */
function addXp(s: GameState, xp: number): void {
  const before = Math.floor(s.season.xp / SEASON.tierXp);
  s.season.xp += xp;
  const after = Math.floor(s.season.xp / SEASON.tierXp);
  if (after > before) emit(s, Ev.SeasonTier, 0, 0, Math.min(after, SEASON_TIERS));
}

/** Takes a finished mission's XP (`weekly`: from the weekly list). */
export function claimMission(s: GameState, weekly: boolean, index: number): boolean {
  const ss = s.season;
  const m = (weekly ? ss.weekly : ss.daily)[index];
  if (ss.id < 0 || !m || m.claimed || !missionDone(ss, m)) return false;
  m.claimed = true;
  addXp(s, m.xp);
  emit(s, Ev.SeasonMission, 0, 0, m.xp);
  return true;
}

/** Done but not taken: missions about to go away pay their XP anyway (nothing earned is lost). */
function settleMissions(s: GameState, list: Mission[]): void {
  for (let i = 0; i < list.length; i++) if (!list[i]!.claimed && missionDone(s.season, list[i]!)) claimMissionFrom(s, list, i);
}
function claimMissionFrom(s: GameState, list: Mission[], i: number): void {
  list[i]!.claimed = true;
  addXp(s, list[i]!.xp);
}

/**
 * The phone's clock (and its time zone) reached the sim: a new season pays out what was reached
 * and starts from zero; a new day brings new daily missions; a new week, more weekly ones. A
 * clock that went back changes nothing.
 */
export function syncSeason(s: GameState, now: number, tzMin: number): void {
  const id = seasonAt(now);
  let ss = s.season;
  if (id > ss.id) {
    const first = ss.id < 0;
    let paid = 0;
    if (!first) {
      settleMissions(s, ss.daily);
      settleMissions(s, ss.weekly);
      while (claimSeason(s, 'free')) paid++;
      while (ss.gold && claimSeason(s, 'gold')) paid++;
    }
    s.season = { ...newSeason(), id, medals: ss.medals };
    ss = s.season;
    if (!first) emit(s, Ev.SeasonStart, 0, 0, id, paid);
  }
  if (id < ss.id) return;
  const day = localDay(now, tzMin);
  if (day > ss.day) {
    settleMissions(s, ss.daily);
    ss.day = day;
    ss.daily = pickMissions(s, SEASON.dailyCount, day * 3.7, false);
  }
  const weeks = weekAt(id, now) + 1;
  while (ss.weeks < weeks) {
    const fresh = pickMissions(s, SEASON.weeklyCount, 1000 + ss.weeks * 13.1, true).map((m) => ({ ...m, week: ss.weeks }));
    ss.weekly = [...ss.weekly, ...fresh];
    ss.weeks += 1;
  }
}

/** Coins a coin prize is worth right now (also shown on the track before it is taken). */
export function seasonCoins(s: GameState, r: SeasonReward): Big {
  if (r.kind !== 'coins') return big(0);
  return incomeRate(s).mul(r.minutes * 60).floor().max(r.minutes * SEASON.minPerMinute);
}

function give(s: GameState, r: SeasonReward, gold: boolean): { coins: Big; gems: number } {
  const coins = seasonCoins(s, r);
  grantCoins(s, coins);
  let gems = 0;
  if (r.kind === 'gems' || r.kind === 'medal') gems = r.gems;
  s.gems += gems;
  if (r.kind === 'spins') s.wheel.tokens += r.spins;
  if (r.kind === 'talent') grantTalentPoints(s, r.points, true);
  if (r.kind === 'boost') {
    // Like the festival's boost: a stronger one running goes on, a weaker one is replaced.
    const running = boostNow(s);
    const left = running >= r.mult ? s.boost.until - s.time : 0;
    s.boost = { mult: Math.max(running, r.mult), until: s.time + left + r.minutes * 60 };
  }
  if (r.kind === 'medal') s.season.medals = gold ? { ...s.season.medals, gold: s.season.medals.gold + 1 } : { ...s.season.medals, free: s.season.medals.free + 1 };
  return { coins, gems };
}

/**
 * Takes the next prize the XP reached on a track (the gold one only with the gold pass); past
 * the last tier, the extra prizes go on the free track. Returns whether there was one.
 */
export function claimSeason(s: GameState, track: 'free' | 'gold'): boolean {
  const ss = s.season;
  if (ss.id < 0) return false;
  const reached = tiersReached(ss);
  let r: SeasonReward;
  let tier: number;
  if (track === 'gold') {
    if (!ss.gold || ss.goldTaken >= reached) return false;
    tier = ss.goldTaken;
    r = SEASON.gold[tier]!;
    ss.goldTaken += 1;
  } else if (ss.free < reached) {
    tier = ss.free;
    r = SEASON.free[tier]!;
    ss.free += 1;
  } else if (ss.free >= SEASON_TIERS && ss.extra < extrasReached(ss)) {
    tier = SEASON_TIERS + ss.extra;
    r = SEASON.extra;
    ss.extra += 1;
  } else return false;
  const { coins, gems } = give(s, r, track === 'gold');
  emit(s, Ev.SeasonClaim, 0, 0, coins.toNumber(), gems, tier);
  return true;
}

/** Prizes waiting on both tracks. */
export function seasonPrizes(ss: SeasonState): number {
  if (ss.id < 0) return 0;
  const reached = tiersReached(ss);
  return Math.max(0, reached - ss.free) + (ss.gold ? Math.max(0, reached - ss.goldTaken) : 0) + (ss.free >= SEASON_TIERS ? Math.max(0, extrasReached(ss) - ss.extra) : 0);
}

/** Missions done and not taken yet. */
export const missionsReady = (ss: SeasonState): number => [...ss.daily, ...ss.weekly].filter((m) => !m.claimed && missionDone(ss, m)).length;

function unlockGold(s: GameState): void {
  s.season.gold = true;
  emit(s, Ev.SeasonGold, 0, 0, tiersReached(s.season));
}

/** The gold pass for gems (once a season). */
export function buyGoldWithGems(s: GameState): boolean {
  if (s.season.id < 0 || s.season.gold || s.gems < SEASON.goldGems) return false;
  s.gems -= SEASON.goldGems;
  unlockGold(s);
  return true;
}

/**
 * The gold pass bought in the store, paid out once per transaction. One bought for a season
 * that already ended (the store approved it late) or while gold is already on comes as its
 * gems instead, so nothing paid for is lost.
 */
export function grantSeasonGold(s: GameState, transaction: string, time: number): boolean {
  if (!transaction || s.purchases.includes(transaction)) return false;
  s.purchases = [...s.purchases.slice(-(PURCHASE_LOG - 1)), transaction];
  const forNow = s.season.id >= 0 && (time <= 0 || seasonAt(time) === s.season.id);
  if (forNow && !s.season.gold) unlockGold(s);
  else s.gems += SEASON.goldGems;
  return true;
}

/** A copy for saving or a new branch (the season is the player's, like the chef's level). */
export function copySeason(ss: SeasonState): SeasonState {
  return { ...ss, counts: { ...ss.counts }, daily: ss.daily.map((m) => ({ ...m })), weekly: ss.weekly.map((m) => ({ ...m })), medals: { ...ss.medals } };
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const nat = (n: unknown, max = Number.MAX_SAFE_INTEGER): number => (finite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0);

function cleanMission(raw: unknown): Mission | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.kind !== 'string' || !(m.kind in MISSION_BY_KIND)) return null;
  const out: Mission = { kind: m.kind as MissionKind, need: Math.max(1, nat(m.need)), base: nat(m.base), xp: nat(m.xp, 10000), claimed: m.claimed === true };
  if (finite(m.week)) out.week = nat(m.week, WEEKS - 1);
  return out;
}

/** The season as saved (anything odd: a fresh one, the medals kept when they read right). */
export function cleanSeason(raw: unknown): SeasonState {
  if (!raw || typeof raw !== 'object') return newSeason();
  const o = raw as Record<string, unknown>;
  const medalsRaw = (o.medals ?? {}) as Record<string, unknown>;
  const medals = { free: nat(medalsRaw.free, 1000), gold: nat(medalsRaw.gold, 1000) };
  if (!finite(o.id) || o.id < 0) return { ...newSeason(), medals };
  const counts: SeasonState['counts'] = {};
  if (o.counts && typeof o.counts === 'object') for (const [k, v] of Object.entries(o.counts)) if (k in MISSION_BY_KIND && finite(v)) counts[k as MissionKind] = nat(v);
  const list = (v: unknown) => (Array.isArray(v) ? v.map(cleanMission).filter((m): m is Mission => m !== null) : []);
  return {
    id: Math.floor(o.id),
    xp: nat(o.xp),
    gold: o.gold === true,
    free: nat(o.free, SEASON_TIERS),
    goldTaken: nat(o.goldTaken, SEASON_TIERS),
    extra: nat(o.extra),
    counts,
    day: finite(o.day) ? Math.floor(o.day) : -1,
    daily: list(o.daily),
    weeks: nat(o.weeks, WEEKS),
    weekly: list(o.weekly),
    medals,
  };
}
