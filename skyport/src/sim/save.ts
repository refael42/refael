/**
 * Saving and loading. The save is JSON with a version; loading never trusts
 * a value: every field is checked and clamped, and anything that can be
 * recomputed is recomputed. Transient things (planes, passengers, vehicle
 * trips, reservations) are not restored: the airfield resumes with empty
 * stands and fresh traffic, and offline earnings cover the time away.
 * A save from a newer game version is never loaded or overwritten.
 */
import { CV_LINES, FIRST_NAMES, LAST_NAMES, RARITIES, STAFF_ROLES, TALENT_MAX, TALENTS, TRAITS } from '../data/staff';
import { TIERS } from '../data/tiers';
import { UPGRADES, upgradeDef } from '../data/upgrades';
import { Big } from './big';
import { DT, SAVE_VERSION } from './game/constants';
import { ensureHoldArrays } from './game/graph';
import { BUCKETS, makeIncome, type IncomeState } from './game/income';
import { pushEvent } from './game/events';
import { incomeRate } from './game/income';
import { APPLICANT_LIFETIME, MAX_LEVEL, MAX_PER_ROLE, MAX_APPLICANTS, marketWage, refreshApplicants, wagesPerDay, xpForLevel } from './game/staff';
import { createGame } from './game/state';
import type { Applicant, Build, GameState, Person0, StaffMember } from './game/types';
import { applyStructural, effects } from './game/upgrades';
import { DAY_SECONDS } from './game/clock';
import { normalizeSeed } from './rng';

export const SAVE_KEY = 'skyport.save.v1';

export interface SaveFile {
  v: number;
  /** Wall clock (ms) when saved; only used to measure time away. */
  savedAt: number;
  game: unknown;
}

export type LoadResult =
  | { ok: true; state: GameState; awaySeconds: number }
  | { ok: false; reason: 'empty' | 'corrupt' | 'future' };

/** What goes into the file: the durable part of the state. */
export function serializeGame(s: GameState, savedAt: number): string {
  const durable = {
    version: s.version,
    seed: s.seed,
    rng: s.rng,
    tick: s.tick,
    tier: s.tier,
    money: s.money,
    diamonds: s.diamonds,
    rating: s.rating,
    traffic: s.traffic,
    staff: s.staff,
    applicants: s.applicants,
    wageDay: s.wageDay,
    nextApplicantAt: s.nextApplicantAt,
    upg: s.upg,
    builds: s.builds,
    priceMul: s.priceMul,
    income: s.income,
    stats: s.stats,
    nextId: s.nextId,
    spotCursor: s.spotCursor,
  };
  const file: SaveFile = { v: SAVE_VERSION, savedAt, game: durable };
  return JSON.stringify(file);
}

// ---------------------------------------------------------------- cleaners

type Raw = Record<string, unknown>;

function isObj(v: unknown): v is Raw {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function num(v: unknown, def: number, lo = -Infinity, hi = Infinity): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
}

function int(v: unknown, def: number, lo = -Infinity, hi = Infinity): number {
  return Math.round(num(v, def, lo, hi));
}

function big(v: unknown): Big {
  const b = Big.from(v as never);
  return b.isNeg() ? Big.ZERO : b;
}

export function cleanUpgrades(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(raw)) return out;
  for (const def of UPGRADES) {
    const l = int(raw[def.id], 0, 0, def.maxLevel);
    if (l > 0) out[def.id] = l;
  }
  return out;
}

export function cleanBuilds(raw: unknown, upg: Record<string, number>): Build[] {
  if (!Array.isArray(raw)) return [];
  const out: Build[] = [];
  for (const b of raw) {
    if (!isObj(b)) continue;
    const def = upgradeDef(String(b.id));
    if (!def || !def.buildSeconds) continue;
    const lvl = int(b.level, 0, 1, def.maxLevel);
    if (lvl <= (upg[def.id] ?? 0)) continue;
    const total = def.buildSeconds[Math.min(lvl - 1, def.buildSeconds.length - 1)];
    out.push({ id: def.id, level: lvl, remaining: num(b.remaining, total, 0, total), total });
    break; // one crew
  }
  return out;
}

/** The CV part shared by staff and applicants; prices and wages are bounded by the tables. */
function cleanPerson(m: Raw, role: number, id: number): Person0 {
  const rarity = int(m.rarity, 0, 0, RARITIES.length - 1);
  const R = RARITIES[rarity];
  const level = int(m.level, R.levels[0], 1, MAX_LEVEL);
  const traits: number[] = [];
  if (Array.isArray(m.traits)) for (const t of m.traits) {
    const k = int(t, -1);
    if (k >= 0 && k < TRAITS.length && !traits.includes(k) && traits.length < 2) traits.push(k);
  }
  const rawTal = Array.isArray(m.talents) ? m.talents : [];
  const talents = TALENTS.map((_, i) => int(rawTal[i], 0, 0, TALENT_MAX));
  const fair = marketWage(role, rarity, level);
  return {
    id,
    role,
    first: int(m.first, 0, 0, FIRST_NAMES.length - 1),
    last: int(m.last, 0, 0, LAST_NAMES.length - 1),
    speed: num(m.speed, 1, 0.8, 1.3 * R.statMul),
    rarity,
    traits,
    level,
    talents,
    cv: int(m.cv, 0, 0, CV_LINES - 1),
    wage: int(m.wage, Math.round(fair), Math.max(1, Math.floor(fair * 0.5)), Math.ceil(fair * 3)),
  };
}

export function cleanStaff(raw: unknown, time: number): StaffMember[] {
  if (!Array.isArray(raw)) return [];
  const out: StaffMember[] = [];
  const perRole = new Array(STAFF_ROLES.length).fill(0);
  const ids = new Set<number>();
  let trial = false;
  for (const m of raw) {
    if (!isObj(m)) continue;
    const role = int(m.role, -1);
    const id = int(m.id, -1, 1);
    if (role < 0 || role >= STAFF_ROLES.length || id < 1 || ids.has(id) || perRole[role] >= MAX_PER_ROLE) continue;
    ids.add(id);
    perRole[role]++;
    const p = cleanPerson(m, role, id);
    const onTrial = !trial && num(m.trialUntil, 0) > 0;
    if (onTrial) trial = true;
    out.push({
      ...p,
      hiredAt: num(m.hiredAt, 0, 0, time),
      busyUntil: time,
      xp: int(m.xp, 0, 0, xpForLevel(p.level) - 1),
      points: int(m.points, 0, 0, MAX_LEVEL),
      mood: num(m.mood, 0.75, 0.05, 1),
      energy: num(m.energy, 1, 0, 1),
      breakUntil: 0,
      // a trial keeps its remaining time (sim time continues across loads)
      trialUntil: onTrial ? Math.max(1, num(m.trialUntil, 1, 1, time + 600)) : 0,
      trialCost: onTrial ? int(m.trialCost, 0, 0, 1e9) : 0,
      raise: int(m.raise, 0, 0, Math.ceil(p.wage * 0.5)),
      raiseAt: num(m.raiseAt, time, 0, time),
    });
  }
  return out;
}

export function cleanApplicants(raw: unknown, time: number): Applicant[] {
  if (!Array.isArray(raw)) return [];
  const out: Applicant[] = [];
  for (const a of raw) {
    if (!isObj(a) || out.length >= MAX_APPLICANTS) continue;
    const role = int(a.role, -1);
    const id = int(a.id, 0, 1);
    if (role < 0 || role >= STAFF_ROLES.length || out.some((x) => x.id === id)) continue;
    const p = cleanPerson(a, role, id);
    const R = RARITIES[p.rarity];
    // the fee is recomputed from the table, never trusted
    const cost = Math.round(STAFF_ROLES[role].hireCost * R.wageMul * (1 + 0.1 * (p.level - 1)));
    out.push({
      ...p,
      cost: int(a.cost, cost, Math.floor(cost * 0.5), Math.ceil(cost * 1.3)),
      arrivedAt: num(a.arrivedAt, time, 0, time),
      expiresAt: num(a.expiresAt, time + APPLICANT_LIFETIME, time, time + APPLICANT_LIFETIME),
      negotiated: a.negotiated === true,
    });
  }
  return out;
}

export function cleanIncome(raw: unknown, time: number): IncomeState {
  const inc = makeIncome();
  inc.curStart = time;
  if (!isObj(raw)) return inc;
  const hist = Array.isArray(raw.hist) ? raw.hist : [];
  const comp = Array.isArray(raw.histComp) ? raw.histComp : [];
  for (let i = Math.max(0, hist.length - BUCKETS); i < hist.length; i++) {
    inc.hist.push(num(hist[i], 0, 0));
    const c = Array.isArray(comp[i]) ? (comp[i] as unknown[]) : [];
    inc.histComp.push([0, 1, 2, 3, 4].map((k) => num(c[k], 0, 0)));
  }
  return inc;
}

/** Turns raw JSON into a valid GameState (or null when hopeless). */
export function cleanGame(raw: unknown): GameState | null {
  if (!isObj(raw)) return null;
  const seed = normalizeSeed(num(raw.seed, 1));
  const s = createGame(seed);
  s.rng = int(raw.rng, seed) >>> 0 || seed;
  s.tick = int(raw.tick, 0, 0, 30 * 3600 * 24 * 365);
  s.time = s.tick * DT;
  s.tier = TIERS.some((t) => t.id === raw.tier) ? (raw.tier as number) : 1;
  s.money = big(raw.money);
  s.diamonds = int(raw.diamonds, 0, 0, 1e9);
  s.rating = num(raw.rating, 3, 1, 5);
  s.traffic = num(raw.traffic, 1, 0.2, 5);
  s.priceMul = num(raw.priceMul, 1, 0.01, 10);
  s.upg = cleanUpgrades(raw.upg);
  s.builds = cleanBuilds(raw.builds, s.upg);
  s.staff = cleanStaff(raw.staff, s.time);
  s.applicants = cleanApplicants(raw.applicants, s.time);
  s.nextApplicantAt = num(raw.nextApplicantAt, s.time + 60, s.time, s.time + 300);
  s.income = cleanIncome(raw.income, s.time);
  const st = isObj(raw.stats) ? raw.stats : {};
  s.stats = {
    served: int(st.served, 0, 0),
    pax: int(st.pax, 0, 0),
    onTime: int(st.onTime, 0, 0),
    late: int(st.late, 0, 0),
    diverted: int(st.diverted, 0, 0),
    earned: big(st.earned),
    wages: big(st.wages),
    spent: big(st.spent),
  };
  const day = 1 + Math.floor((7 * 60 + (s.time * 1440) / DAY_SECONDS) / 1440);
  s.wageDay = int(raw.wageDay, day, 1, day);
  // ids must stay unique: never go below what is already used
  let maxId = 2 + s.vehicles.length;
  for (const m of s.staff) maxId = Math.max(maxId, m.id);
  for (const a of s.applicants) maxId = Math.max(maxId, a.id);
  s.nextId = Math.max(int(raw.nextId, maxId + 1, 1), maxId + 1);
  s.spotCursor = int(raw.spotCursor, 0, 0, 1e9);
  // recomputed, not loaded
  s.upgRev = 1;
  applyStructural(s);
  ensureHoldArrays(s);
  if (s.applicants.length === 0) refreshApplicants(s);
  s.nextArrival = s.time + 3;
  s.flights = [];
  s.people = [];
  s.fuelQueue = [];
  s.bagQueue = [];
  s.events = [];
  s.queue = [];
  return s;
}

/** Migrations from older save versions (each step adds optional fields). */
export function migrate(file: SaveFile): SaveFile {
  const out = { ...file };
  // v1 (M1) had no upgrades, staff or income: cleanGame fills the defaults.
  if (out.v < 2) out.v = 2;
  // v2 (M3) staff had no rarity/level/talents/mood: cleanPerson fills them.
  if (out.v < 3) out.v = 3;
  return out;
}

export function parseSave(text: string | null, now: number): LoadResult {
  if (!text) return { ok: false, reason: 'empty' };
  let file: SaveFile;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isObj(parsed) || typeof parsed.v !== 'number') return { ok: false, reason: 'corrupt' };
    file = parsed as unknown as SaveFile;
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (file.v > SAVE_VERSION) return { ok: false, reason: 'future' };
  file = migrate(file);
  const state = cleanGame(file.game);
  if (!state) return { ok: false, reason: 'corrupt' };
  const savedAt = num(file.savedAt, now);
  // a clock that went backwards gives no time away
  const away = savedAt <= now ? (now - savedAt) / 1000 : 0;
  return { ok: true, state, awaySeconds: away };
}

// ----------------------------------------------------------------- offline

export interface OfflineResult {
  seconds: number;
  amount: Big;
  capped: boolean;
}

/** Floor for the income rate right after a fresh start (rate can be 0). */
export const OFFLINE_MIN_RATE = 0.15;

/**
 * Earnings while away: recent net income rate (with a floor) times the time
 * away, scaled by how much of the work your staff covers, up to the cap.
 * Construction keeps going too.
 */
export function applyOffline(s: GameState, awaySeconds: number): OfflineResult {
  const capSec = effects(s).offlineCapHours * 3600;
  const secs = Math.max(0, Math.min(awaySeconds, capSec));
  const roles = new Set(s.staff.map((m) => m.role)).size;
  const coverage = 0.15 + 0.85 * (roles / STAFF_ROLES.length);
  const net = Math.max(OFFLINE_MIN_RATE, incomeRate(s) - wagesPerDay(s) / DAY_SECONDS);
  const amount = Big.fromNumber(Math.floor(net * secs * 0.5 * coverage));
  if (secs > 0) {
    s.money = s.money.add(amount);
    s.stats.earned = s.stats.earned.add(amount);
    for (const b of s.builds) b.remaining = Math.max(0.01, b.remaining - secs);
    if (secs >= 60) pushEvent(s, 'offline', 0, 0, amount.m, amount.e, secs);
  }
  return { seconds: secs, amount, capped: awaySeconds > capSec };
}
