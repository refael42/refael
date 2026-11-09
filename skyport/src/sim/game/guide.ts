/**
 * The Aviation Guide (M12): like a restaurant guide, for airports. Every seven
 * game days a new edition gives the airport up to three stars, for how the
 * week went: safety, punctuality, infrastructure, service, cleanliness and
 * comfort. The day before an edition an undercover inspector flies out from
 * here: a rumor goes round, a few passengers look suspicious, and the one the
 * staff treats as a VIP may be the inspector (a better score if so). When the
 * inspector's flight leaves they are revealed, and their notebook says what
 * they saw. Pure and deterministic (hashes of the seed and the week).
 */
import { NOTES_BY } from '../../data/guideNotes';
import { tierDef } from '../../data/tiers';
import { Big } from '../big';
import { hash01 } from '../hash';
import { DAY_SECONDS } from './clock';
import { cleanliness } from './cleaning';
import { pushEvent } from './events';
import { layoutOf } from './layout';
import { effects } from './upgrades';
import { securityLevel } from './security';
import { PST, type GameState, type GuideBase, type GuideState, type Person } from './types';

/** Game days between editions. */
export const EDITION_DAYS = 7;
/** Score needed for each number of stars (index = stars). */
export const STAR_AT: readonly number[] = [0, 0.65, 0.8, 0.9];
/** The guide's second star is for a city airport (tier 3) on, the third for an international one (tier 5) on. */
export const STAR_TIER: readonly number[] = [1, 1, 3, 5];
export const GUIDE_PARTS = ['safety', 'punctuality', 'infrastructure', 'service', 'cleanliness', 'comfort'] as const;
export type GuidePart = (typeof GUIDE_PARTS)[number];
export type GuideParts = Record<GuidePart, number>;
/** How much each part counts. */
const WEIGHT: Readonly<GuideParts> = { safety: 0.15, punctuality: 0.2, infrastructure: 0.15, service: 0.2, cleanliness: 0.15, comfort: 0.15 };
/** Added to the score when the VIP care went to the real inspector. */
export const RIGHT_PICK = 0.05;
/** Passengers that look like the inspector. */
export const SUSPECTS = 4;
/** Seconds between the samples of cleanliness and mood. */
const SAMPLE_EVERY = 5;
/** Coins for each star of an edition (times the tier's pay), and diamonds for a star never had before. */
export const STAR_COINS = 300;
export const NEW_STAR_DIAMONDS = 5;
/** More people want to fly, for each star. */
export const STAR_TRAFFIC = 0.04;

/** Passenger states early on the way out (the inspector is among them: time enough to be found). */
const EARLY: readonly number[] = [PST.toEntrance, PST.inCheckin, PST.atCounter, PST.inSecurity, PST.atScanner, PST.inPassport, PST.atBooth, PST.toShop, PST.shopping, PST.toSpot, PST.waiting];

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function baseOf(s: GameState): GuideBase {
  const st = s.stats;
  return { served: st.served, diverted: st.diverted, goArounds: st.goArounds, onTime: st.onTime, late: st.late, queued: st.queued, queueSecs: st.queueSecs, pax: st.pax, lostBags: st.lostBags };
}

/** A guide with no edition yet (its week starts from these stats: a new game's are all zero). */
export function newGuide(base?: GuideBase): GuideState {
  const b = base ?? { served: 0, diverted: 0, goArounds: 0, onTime: 0, late: 0, queued: 0, queueSecs: 0, pax: 0, lostBags: 0 };
  return { stars: 0, best: 0, edition: 0, last: null, lastScore: 0, base: b, cleanSum: 0, moodSum: 0, samples: 0, bonus: 0, visit: null, notes: [], noteResult: -1 };
}

/** When edition n (1, 2, ...) comes out: 08:00 on the day after each seventh day. */
export function editionAt(n: number): number {
  // (day 1 starts at 07:00 at time 0)
  return n * EDITION_DAYS * DAY_SECONDS + DAY_SECONDS / 24;
}

/** When the rumor of edition n's inspector goes round: between 09:00 and 14:00 the day before. */
export function rumorAt(s: GameState, n: number): number {
  return (n * EDITION_DAYS - 1) * DAY_SECONDS + (2 + hash01(s.seed * 31 + n * 7) * 5) * (DAY_SECONDS / 24);
}

/** The airport's infrastructure (0..1): the tier, the stands built of the tier's, comfort upgrades. */
function infrastructure(s: GameState): number {
  const stands = layoutOf(s.tier).stands.length;
  const built = stands > 0 ? Math.min(1, s.standsBuilt / stands) : 1;
  return clamp(0.3 + (s.tier / 8) * 0.45 + built * 0.25);
}

/** The week so far (since the last edition), each part 0 (bad) .. 1 (great). */
export function guideParts(s: GameState): GuideParts {
  const g = s.guide;
  const st = s.stats;
  const b = g.base;
  const landed = st.served - b.served + (st.diverted - b.diverted);
  const bad = st.diverted - b.diverted + (st.goArounds - b.goArounds) * 0.4;
  const flown = st.onTime - b.onTime + (st.late - b.late);
  const queued = st.queued - b.queued;
  const wait = queued > 0 ? (st.queueSecs - b.queueSecs) / queued : 0;
  const pax = st.pax - b.pax;
  // (the inspector is stricter than the passengers: 5 s in a line is fine, 40 s as bad as it gets)
  const queues = clamp(1 - (wait - 5) / 35);
  const bags = pax > 0 ? clamp(1 - ((st.lostBags - b.lostBags) / pax) * 50) : 1;
  const clean = g.samples > 0 ? g.cleanSum / g.samples : cleanliness(s);
  const mood = g.samples > 0 ? g.moodSum / g.samples : clamp((s.rating - 1) / 4);
  return {
    // (flights kept safe, and the airport kept secure)
    safety: clamp(1 - (bad / Math.max(8, landed)) * 4) * 0.75 + securityLevel(s) * 0.25,
    punctuality: flown > 0 ? (st.onTime - b.onTime) / flown : 1,
    infrastructure: infrastructure(s),
    service: (queues + bags) / 2,
    cleanliness: clean,
    comfort: clamp(mood * 0.7 + Math.min(1, effects(s).comfort * 2.5) * 0.3),
  };
}

/** The score of these parts (0..1), with the bonus for spotting the inspector. */
export function guideScore(p: GuideParts, bonus = 0): number {
  let v = 0;
  for (const k of GUIDE_PARTS) v += p[k] * WEIGHT[k];
  return clamp(v + bonus);
}

/** Stars for this score (at this tier: the higher stars need a bigger airport). */
export function starsFor(score: number, tier = 8): number {
  let n = 0;
  for (let k = 1; k < STAR_AT.length; k++) if (score >= STAR_AT[k] && tier >= STAR_TIER[k]) n = k;
  return n;
}

/** The parts that lose the most points first (what is missing for the next star). */
export function weakParts(p: GuideParts, n = 2): GuidePart[] {
  const lost = (k: GuidePart) => (1 - p[k]) * WEIGHT[k];
  return [...GUIDE_PARTS].filter((k) => p[k] < 0.9).sort((a, b) => lost(b) - lost(a) || GUIDE_PARTS.indexOf(a) - GUIDE_PARTS.indexOf(b)).slice(0, n);
}

/** Passengers who could be the inspector (early on their way out), best first. */
function candidates(s: GameState): Person[] {
  const out: Person[] = [];
  // (a figure that stands for a group on a big plane counts too: the inspector is one of them)
  for (const p of s.people) if (EARLY.includes(p.state)) out.push(p);
  // the ones furthest from their plane first, then by hash
  out.sort((a, b) => EARLY.indexOf(a.state) - EARLY.indexOf(b.state) || hash01(a.id * 97 + s.guide.edition) - hash01(b.id * 97 + s.guide.edition));
  return out;
}

/** The notebook: a line for each part (good, fair or poor), and one for the VIP care. */
function writeNotes(s: GameState, result: number): number[] {
  const p = guideParts(s);
  const n = s.guide.edition + 1;
  const out: number[] = [];
  for (const k of GUIDE_PARTS) {
    const lvl = p[k] >= 0.8 ? 'good' : p[k] >= 0.55 ? 'fair' : 'poor';
    const lines = NOTES_BY[`${k}.${lvl}`];
    out.push(lines[Math.floor(hash01(s.seed * 41 + n * 13 + GUIDE_PARTS.indexOf(k)) * lines.length)]);
  }
  const end = NOTES_BY[result === 1 ? 'pick.right' : result === 2 ? 'pick.wrong' : 'pick.none'];
  out.push(end[Math.floor(hash01(s.seed * 43 + n) * end.length)]);
  return out;
}

/** The player picks a suspect for the VIP care (once a visit). False when not possible. */
export function pickSuspect(s: GameState, person: number): boolean {
  const v = s.guide.visit;
  if (!v || v.done || v.picked !== 0 || !v.suspects.includes(person)) return false;
  const p = s.people.find((q) => q.id === person);
  if (!p) return false;
  v.picked = person;
  pushEvent(s, 'vipCare', p.x, p.y, person);
  return true;
}

/** The rumor goes round now if enough passengers are on their way out (false if not). Debug and screenshots force it any time. */
export function startRumor(s: GameState): boolean {
  const g = s.guide;
  const n = g.edition + 1;
  const c = candidates(s);
  if (c.length < 3) return false;
  const sus = c.slice(0, SUSPECTS);
  const inspector = sus[Math.floor(hash01(s.seed * 37 + n * 11) * sus.length)].id;
  // (listed in a shuffled order, so the first is not always the one closest to the door)
  const ids = sus.map((p) => p.id).sort((a, b) => hash01(a * 61 + n) - hash01(b * 61 + n));
  g.visit = { at: s.time, suspects: ids, inspector, picked: 0, done: false, result: 0 };
  pushEvent(s, 'rumor', sus[0].x, sus[0].y, ids.length);
  return true;
}

/** The edition is out: stars, rewards, and a new week (screenshots call it any time). */
export function publishEdition(s: GameState): void {
  const g = s.guide;
  const parts = guideParts(s);
  const score = guideScore(parts, g.bonus);
  const stars = starsFor(score, s.tier);
  const prev = g.stars;
  g.edition++;
  g.stars = stars;
  g.last = parts;
  g.lastScore = score;
  const coins = Math.round(stars * STAR_COINS * tierDef(s.tier).pay);
  if (coins > 0) {
    s.money = s.money.add(Big.fromNumber(coins));
    s.stats.earned = s.stats.earned.add(Big.fromNumber(coins));
  }
  const gems = Math.max(0, stars - g.best) * NEW_STAR_DIAMONDS;
  s.diamonds += gems;
  g.best = Math.max(g.best, stars);
  // (no place for this one: x and y carry the coins and the diamonds)
  pushEvent(s, 'guideEdition', coins, gems, stars, prev, g.edition);
  // a new week
  g.base = baseOf(s);
  g.cleanSum = 0;
  g.moodSum = 0;
  g.samples = 0;
  g.bonus = 0;
  g.visit = null;
}

export function updateGuide(s: GameState): void {
  const g = s.guide;
  const n = g.edition + 1;
  // (a game loaded long after its edition was due: it comes out now)
  if (s.time >= editionAt(n)) {
    publishEdition(s);
    return;
  }
  if (s.tick % Math.round(SAMPLE_EVERY * 30) === 0) {
    g.cleanSum += cleanliness(s);
    g.moodSum += clamp((s.rating - 1) / 4);
    g.samples++;
  }
  const v = g.visit;
  if (!v) {
    // the inspector's day: once enough passengers are on their way out, the rumor goes round
    const at = rumorAt(s, n);
    if (s.time < at || s.time > editionAt(n) - DAY_SECONDS / 4 || s.tick % 30 !== 0) return;
    startRumor(s);
    return;
  }
  if (v.done || s.tick % 15 !== 0) return;
  // the inspector boarded (or went home): revealed, and the notebook is out
  if (s.people.some((p) => p.id === v.inspector)) return;
  v.done = true;
  v.result = v.picked === 0 ? 0 : v.picked === v.inspector ? 1 : 2;
  if (v.result === 1) g.bonus = RIGHT_PICK;
  g.notes = writeNotes(s, v.result);
  g.noteResult = v.result;
  pushEvent(s, 'inspectorLeft', 0, 0, v.result, v.inspector, v.picked);
}

/** The guide's stars make more people want to fly here. */
export function guideTraffic(s: GameState): number {
  return 1 + s.guide.stars * STAR_TRAFFIC;
}

