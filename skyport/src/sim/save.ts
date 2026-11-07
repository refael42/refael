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
import { cleanName, DECOR_IDS, decorSpotOk } from './game/tiers';
import { levelCap, UPGRADES, upgradeDef } from '../data/upgrades';
import { Big } from './big';
import { DT, SAVE_VERSION } from './game/constants';
import { ensureHoldArrays } from './game/graph';
import { BUCKETS, makeIncome, type IncomeState } from './game/income';
import { pushEvent } from './game/events';
import { incomeRate } from './game/income';
import { APPLICANT_LIFETIME, MAX_LEVEL, maxPerRole, MAX_APPLICANTS, marketWage, refreshApplicants, wagesPerDay, xpForLevel } from './game/staff';
import { createGame } from './game/state';
import type { AirlineOffer, Applicant, Build, CareerState, Contract, DailyState, GameState, GuideState, Person0, StaffMember } from './game/types';
import { AIRLINE_KINDS, AIRLINES } from '../data/airlines';
import { RECENT, REP_START, STRIKES_TO_LEAVE } from './game/airlines';
import { applyStructural, effects } from './game/upgrades';
import { DAY_SECONDS, gameClock } from './game/clock';
import { normalizeSeed } from './rng';
import { STORES } from '../data/supplies';
import { capacity, incoming, STORE_KINDS } from './game/supplies';
import { GOALS, skipDoneGoals } from './game/goals';

import { REVIEWS } from '../data/reviews';
import { PAX_TYPES } from '../data/paxTypes';
import { MAX_REVIEWS } from './game/reviews';
import { baseOf, editionAt, GUIDE_PARTS, newGuide, RIGHT_PICK, SUSPECTS } from './game/guide';
import { BOOST_SECONDS, newCareer, xpToNext } from './game/career';
import { newDaily } from './game/daily';
import { ACHIEVEMENTS } from '../data/achievements';
import { GUIDE_NOTES } from '../data/guideNotes';

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
    tierBuild: s.tierBuild,
    tierSwitch: s.tierSwitch,
    profile: s.profile,
    decor: s.decor,
    contracts: s.contracts.map((c) => ({ ...c, al: AIRLINES[c.al]?.id })),
    offers: s.offers.map((o) => ({ ...o, al: AIRLINES[o.al]?.id })),
    rep: Object.fromEntries(AIRLINES.map((a, i) => [a.id, s.rep[i] ?? REP_START])),
    nextOfferAt: s.nextOfferAt,
    goal: s.goal,
    // what is still on its way was paid for: it is saved as if it had arrived
    stores: Object.fromEntries(STORE_KINDS.map((k) => [k, { stock: s.stores[k].stock + incoming(s, k), supplier: s.stores[k].supplier }])),
    upg: s.upg,
    builds: s.builds,
    reviews: s.reviews,
    reviewBonus: s.reviewBonus,
    guide: s.guide,
    career: { ...s.career, seen: undefined },
    daily: { ...s.daily, now: undefined },
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

export function cleanUpgrades(raw: unknown, tier = 1): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(raw)) return out;
  for (const def of UPGRADES) {
    if (def.unlockTier > tier) continue;
    const l = int(raw[def.id], 0, 0, levelCap(def, tier));
    if (l > 0) out[def.id] = l;
  }
  return out;
}

export function cleanBuilds(raw: unknown, upg: Record<string, number>, tier = 1): Build[] {
  if (!Array.isArray(raw)) return [];
  const out: Build[] = [];
  for (const b of raw) {
    if (!isObj(b)) continue;
    const def = upgradeDef(String(b.id));
    if (!def || !def.buildSeconds) continue;
    const lvl = int(b.level, 0, 1, def.maxLevel);
    // only the very next level, and only if this tier allows it
    if (lvl !== (upg[def.id] ?? 0) + 1 || lvl > levelCap(def, tier)) continue;
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
    if (role < 0 || role >= STAFF_ROLES.length || id < 1 || ids.has(id) || perRole[role] >= maxPerRole(role)) continue;
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

function airlineIdx(v: unknown): number {
  return typeof v === 'string' ? AIRLINES.findIndex((a) => a.id === v) : -1;
}

/** Contracts: known airlines, once each, terms within what that kind of airline would sign. */
export function cleanContracts(raw: unknown, time: number, tier: number): Contract[] {
  if (!Array.isArray(raw)) return [];
  const out: Contract[] = [];
  for (const c of raw) {
    if (!isObj(c)) continue;
    const al = airlineIdx(c.al);
    if (al < 0 || out.some((x) => x.al === al) || AIRLINES[al].unlockTier > tier) continue;
    const k = AIRLINE_KINDS[AIRLINES[al].kind];
    const endsAt = num(c.endsAt, 0, 0, time + k.days * DAY_SECONDS);
    if (k.days > 0 && endsAt <= 0) continue;
    const last = Array.isArray(c.last) ? c.last.slice(-RECENT).map((v) => (v === 1 ? 1 : 0)) : [];
    out.push({
      al,
      perDay: int(c.perDay, k.perDay, 1, k.maxPerDay),
      pay: num(c.pay, k.pay, k.pay * 0.5, k.pay * 2),
      goal: num(c.goal, k.goal, 0.3, 1),
      signedAt: num(c.signedAt, time, 0, time),
      endsAt: k.days > 0 ? endsAt : 0,
      flights: int(c.flights, 0, 0),
      onTime: int(c.onTime, 0, 0),
      last,
      earned: num(c.earned, 0, 0),
      warned: c.warned === true,
      strikes: int(c.strikes, 0, 0, STRIKES_TO_LEAVE - 1),
      expandedAt: num(c.expandedAt, time, 0, time),
      nextAt: 0,
    });
  }
  return out.slice(0, TIERS.find((t) => t.id === tier)?.contracts ?? 2);
}

export function cleanOffers(raw: unknown, time: number, tier: number, contracts: Contract[]): AirlineOffer[] {
  if (!Array.isArray(raw)) return [];
  const out: AirlineOffer[] = [];
  for (const o of raw) {
    if (!isObj(o) || out.length >= 2) continue;
    const al = airlineIdx(o.al);
    if (al < 0 || AIRLINES[al].unlockTier > tier || contracts.some((c) => c.al === al) || out.some((x) => x.al === al)) continue;
    const k = AIRLINE_KINDS[AIRLINES[al].kind];
    out.push({
      id: int(o.id, 0, 1),
      al,
      perDay: int(o.perDay, k.perDay, 1, k.maxPerDay),
      pay: num(o.pay, k.pay, k.pay * 0.5, k.pay * 2),
      goal: num(o.goal, k.goal, 0.3, 1),
      days: k.days,
      expiresAt: num(o.expiresAt, time + 120, time + 10, time + 600),
      negotiated: o.negotiated === true,
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
  s.tier = TIERS.some((t) => t.id === raw.tier && t.layout) ? (raw.tier as number) : 1;
  s.money = big(raw.money);
  s.diamonds = int(raw.diamonds, 0, 0, 1e9);
  s.rating = num(raw.rating, 3, 1, 5);
  s.traffic = num(raw.traffic, 1, 0.2, 5);
  s.priceMul = num(raw.priceMul, 1, 0.01, 10);
  s.upg = cleanUpgrades(raw.upg, s.tier);
  s.builds = cleanBuilds(raw.builds, s.upg, s.tier);
  // passenger reviews: only lines that exist, the newest MAX_REVIEWS
  s.reviews = Array.isArray(raw.reviews)
    ? raw.reviews
        .filter(isObj)
        .map((r) => {
          const line = int(r.line, -1, -1, REVIEWS.length - 1);
          return {
            id: int(r.id, 0, 0),
            line,
            stars: REVIEWS[line]?.stars ?? 3,
            name: int(r.name, 0, 0, FIRST_NAMES.length - 1),
            pax: int(r.pax, 0, 0, PAX_TYPES.length - 1),
            flight: typeof r.flight === 'string' ? r.flight.slice(0, 12) : '',
            at: num(r.at, 0, 0),
          };
        })
        .filter((r) => r.line >= 0)
        .slice(0, MAX_REVIEWS)
    : [];
  s.reviewBonus = num(raw.reviewBonus, 0, 0, 1e15);
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
    lostBags: int(st.lostBags, 0, 0),
    sales: big(st.sales),
    queueSecs: num(st.queueSecs, 0, 0),
    queued: int(st.queued, 0, 0),
    goArounds: int(st.goArounds, 0, 0),
    guests: int(st.guests, 0, 0),
    checks: int(st.checks, 0, 0),
  };
  s.guide = cleanGuide(raw.guide, s);
  s.career = cleanCareer(raw.career, s);
  s.daily = cleanDaily(raw.daily);
  const day = 1 + Math.floor((7 * 60 + (s.time * 1440) / DAY_SECONDS) / 1440);
  s.wageDay = int(raw.wageDay, day, 1, day);
  // airlines: v4 saves had no contracts, so they keep the starter one (and gain a tier-2 airline)
  if (Array.isArray(raw.contracts)) {
    const cs = cleanContracts(raw.contracts, s.time, s.tier);
    if (cs.length > 0) s.contracts = cs;
  } else if (s.tier >= 2) {
    const bf = AIRLINES.findIndex((a) => a.id === 'bluefin');
    const k = AIRLINE_KINDS.lowcost;
    s.contracts.push({ ...s.contracts[0], al: bf, perDay: k.perDay, pay: k.pay, goal: k.goal, last: [] });
  }
  s.offers = cleanOffers(raw.offers, s.time, s.tier, s.contracts);
  const rp = isObj(raw.rep) ? raw.rep : {};
  s.rep = AIRLINES.map((a) => num(rp[a.id], REP_START, 0, 100));
  s.nextOfferAt = num(raw.nextOfferAt, s.time + 60, s.time, s.time + 300);
  s.contracts.forEach((c, i) => {
    c.nextAt = s.time + 3 + i * 7;
    if (c.signedAt > s.time) c.signedAt = s.time;
  });
  s.schedule = [];
  s.departed = [];
  s.nextGuestAt = s.time + 600;
  s.nextCheckAt = s.time + 240;
  s.nextIncidentAt = s.time + 300;
  s.weekendDay = gameClock(s.time).day;
  const rs = isObj(raw.stores) ? raw.stores : {};
  for (const k of STORE_KINDS) {
    const r = isObj(rs[k]) ? rs[k] : {};
    s.stores[k].supplier = int(r.supplier, STORES[k].defaultSupplier, 0, STORES[k].suppliers.length - 1);
    s.stores[k].stock = num(r.stock, capacity(s, k), 0, capacity(s, k));
  }
  // ids must stay unique: never go below what is already used
  let maxId = 2 + s.vehicles.length;
  for (const m of s.staff) maxId = Math.max(maxId, m.id);
  for (const a of s.applicants) maxId = Math.max(maxId, a.id);
  for (const o of s.offers) maxId = Math.max(maxId, o.id);
  // (the inspector and the suspects were people: new people must not take their ids)
  for (const id of s.guide.visit?.suspects ?? []) maxId = Math.max(maxId, id);
  s.nextId = Math.max(int(raw.nextId, maxId + 1, 1), maxId + 1);
  s.spotCursor = int(raw.spotCursor, 0, 0, 1e9);
  const pr = isObj(raw.profile) ? raw.profile : {};
  s.profile = { manager: cleanName(pr.manager), airport: cleanName(pr.airport) };
  const tb = isObj(raw.tierBuild) ? raw.tierBuild : null;
  const next = TIERS.find((t) => t.id === s.tier + 1 && t.layout);
  if (tb && next && int(tb.to, 0) === next.id) {
    s.tierBuild = { to: next.id, remaining: num(tb.remaining, next.buildSeconds, 0, next.buildSeconds), total: next.buildSeconds };
    s.tierSwitch = s.tierBuild.remaining <= 0;
  }
  // recomputed, not loaded
  s.upgRev = 1;
  applyStructural(s);
  // goals: a save from before them skips what is already done (no back pay)
  if (typeof raw.goal === 'number') s.goal = int(raw.goal, 0, 0, GOALS.length);
  else skipDoneGoals(s);
  ensureHoldArrays(s);
  if (s.applicants.length === 0) refreshApplicants(s);
  s.nextArrival = s.time + 3;
  // decorations: only valid spots survive
  if (isObj(raw.decor)) {
    for (const id of DECOR_IDS) {
      const p = raw.decor[id];
      if (Array.isArray(p) && p.length === 2) {
        const x = num(p[0], NaN);
        const y = num(p[1], NaN);
        if (decorSpotOk(s, id, x, y)) s.decor[id] = [x, y];
      }
    }
  }
  s.flights = [];
  s.people = [];
  s.fuelQueue = [];
  s.bagQueue = [];
  s.events = [];
  s.queue = [];
  return s;
}

/** The daily gift and the wheel: what was claimed when (the clock itself comes from the phone again). */
function cleanDaily(raw: unknown): DailyState {
  const d = newDaily();
  if (!isObj(raw)) return d;
  d.giftDay = int(raw.giftDay, -1, -1, 1e7);
  d.streak = int(raw.streak, 0, 0, 7);
  d.spinAt = num(raw.spinAt, -1e9, -1e9, 1e10);
  d.spins = int(raw.spins, 0, 0, 1e9);
  return d;
}

/** The manager's career: a save from before it starts at level 1 (the stats' achievements count at once). */
function cleanCareer(raw: unknown, s: GameState): CareerState {
  const c = newCareer();
  if (!isObj(raw)) return c;
  c.level = int(raw.level, 1, 1, 999);
  c.xp = num(raw.xp, 0, 0, xpToNext(c.level));
  c.chests = int(raw.chests, 0, 0, 999);
  c.boostUntil = num(raw.boostUntil, 0, 0, s.time + BOOST_SECONDS * 1000);
  const counts = isObj(raw.counts) ? raw.counts : {};
  for (const [k, v] of Object.entries(counts)) if (/^[a-zA-Z]{1,24}$/.test(k)) c.counts[k] = num(v, 0, 0, 1e15);
  const medals = Array.isArray(raw.medals) ? raw.medals : [];
  c.medals = ACHIEVEMENTS.map((_, i) => int(medals[i], 0, 0, 4));
  return c;
}

/** The Aviation Guide: a save from before it starts its first week now (no edition already due). */
function cleanGuide(raw: unknown, s: GameState): GuideState {
  // (editions that would have come out already: the next one is still ahead)
  let due = 0;
  while (editionAt(due + 1) <= s.time) due++;
  if (!isObj(raw)) {
    const g = newGuide(baseOf(s));
    g.edition = due;
    return g;
  }
  const st = s.stats;
  const b = isObj(raw.base) ? raw.base : {};
  const g = newGuide({
    served: int(b.served, st.served, 0, st.served),
    diverted: int(b.diverted, st.diverted, 0, st.diverted),
    goArounds: int(b.goArounds, st.goArounds, 0, st.goArounds),
    onTime: int(b.onTime, st.onTime, 0, st.onTime),
    late: int(b.late, st.late, 0, st.late),
    queued: int(b.queued, st.queued, 0, st.queued),
    queueSecs: num(b.queueSecs, st.queueSecs, 0, st.queueSecs),
    pax: int(b.pax, st.pax, 0, st.pax),
    lostBags: int(b.lostBags, st.lostBags, 0, st.lostBags),
  });
  g.stars = int(raw.stars, 0, 0, 3);
  g.best = Math.max(g.stars, int(raw.best, 0, 0, 3));
  // (never more editions than the time allows, never so few that several are due at once)
  g.edition = Math.max(due - 1, Math.min(due, int(raw.edition, due, 0)));
  const last = isObj(raw.last) ? raw.last : null;
  g.last = last ? Object.fromEntries(GUIDE_PARTS.map((k) => [k, num(last[k], 0, 0, 1)])) : null;
  g.lastScore = num(raw.lastScore, 0, 0, 1);
  g.samples = int(raw.samples, 0, 0, 1e6);
  g.cleanSum = num(raw.cleanSum, 0, 0, g.samples);
  g.moodSum = num(raw.moodSum, 0, 0, g.samples);
  g.bonus = num(raw.bonus, 0, 0, RIGHT_PICK);
  g.notes = Array.isArray(raw.notes) ? raw.notes.map((v) => int(v, -1, -1, GUIDE_NOTES.length - 1)).filter((v) => v >= 0).slice(0, 8) : [];
  g.noteResult = g.notes.length ? int(raw.noteResult, 0, 0, 2) : -1;
  const v = isObj(raw.visit) ? raw.visit : null;
  if (v && Array.isArray(v.suspects)) {
    const sus = v.suspects.map((x) => int(x, 0, 0)).filter((x) => x > 0).slice(0, SUSPECTS);
    const inspector = int(v.inspector, 0, 0);
    if (sus.includes(inspector)) {
      const picked = int(v.picked, 0, 0);
      g.visit = {
        at: num(v.at, 0, 0, s.time),
        suspects: sus,
        inspector,
        picked: sus.includes(picked) ? picked : 0,
        done: v.done === true,
        result: int(v.result, 0, 0, 2),
      };
    }
  }
  return g;
}

/** Migrations from older save versions (each step adds optional fields). */
export function migrate(file: SaveFile): SaveFile {
  const out = { ...file };
  // v1 (M1) had no upgrades, staff or income: cleanGame fills the defaults.
  if (out.v < 2) out.v = 2;
  // v2 (M3) staff had no rarity/level/talents/mood: cleanPerson fills them.
  if (out.v < 3) out.v = 3;
  // v3 (M4) had no tier build, profile names or moved decorations: defaults apply.
  if (out.v < 4) out.v = 4;
  // v4 (M6) had no airline contracts: cleanGame gives the starter contract (+ one at tier 2).
  if (out.v < 5) out.v = 5;
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
