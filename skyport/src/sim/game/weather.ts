/**
 * Weather: wind and visibility as a pure function of the game seed and the
 * clock (keyframes every KEY seconds, eased in between), so it never needs
 * saving and every game has its own. Air traffic control reads it: crosswind
 * keeps light planes waiting, fog closes the runway to anyone the ILS can't
 * bring in, and on the bigger airports the runway in use turns into the wind.
 */
import { AIRCRAFT } from '../../data/aircraft';
import { layoutFor } from '../../data/tiers';
import { hash01, hashU32 } from '../hash';
import { pushEvent } from './events';
import type { FlightPhase, GameState } from './types';
import { effectValue } from './upgrades';

/** Seconds between weather keyframes. */
export const WX_KEY = 150;

export interface Weather {
  /** Direction the air moves toward (radians, world frame). */
  windTo: number;
  /** Knots. */
  speed: number;
  /** 0 (thick fog) .. 1 (clear). */
  vis: number;
}

interface Key {
  windTo: number;
  speed: number;
  vis: number;
}

function wh(seed: number, n: number): number {
  return hash01(hashU32(seed ^ 0x77e1) + n);
}

/** Keyframes per wind regime: the prevailing direction changes only every few game hours. */
const REGIME = 8;

function keyAt(seed: number, k: number, tier: number): Key {
  // mostly an easterly (planes land and take off toward the east, into it); now and then,
  // for a while, it sets in from the west
  const regime = Math.floor(k / REGIME);
  const west = regime > 0 && wh(seed, regime * 13 + 9) < 0.3;
  const windTo = (west ? 0 : Math.PI) + (wh(seed, k * 7 + 2) - 0.5) * 1.4;
  const u = wh(seed, k * 7 + 3);
  const speed = 4 + 22 * u * u;
  // fog banks now and then (never in the first few minutes of a game)
  // (the dirt strip has no ILS to buy yet: its fog stays light)
  const fog = tier >= 2 && k >= 3 && wh(seed, k * 7 + 4) < 0.12;
  // never thicker than the best ILS this tier can buy handles: fog is a problem you can solve
  const floor = tier <= 2 ? 0.31 : tier === 3 ? 0.16 : 0.06;
  const vis = fog ? floor + (0.37 - floor) * wh(seed, k * 7 + 5) : 1;
  return { windTo, speed, vis };
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** The weather at a moment (pure). */
export function weatherAt(seed: number, time: number, tier = 2): Weather {
  const k = Math.floor(Math.max(0, time) / WX_KEY);
  const t = smooth((Math.max(0, time) - k * WX_KEY) / WX_KEY);
  const a = keyAt(seed, k, tier);
  const b = keyAt(seed, k + 1, tier);
  // fog rolls in and lifts over the last third of a keyframe
  const tv = smooth(Math.max(0, (t - 0.66) / 0.34));
  return { windTo: lerpAngle(a.windTo, b.windTo, t), speed: a.speed + (b.speed - a.speed) * t, vis: a.vis + (b.vis - a.vis) * tv };
}

const cache = new WeakMap<GameState, { tick: number; tier: number; w: Weather; minVis: number; rev: number }>();

/** The weather now (computed once per step). */
export function weather(s: GameState): Weather {
  const hit = cache.get(s);
  if (hit && hit.tick === s.tick && hit.tier === s.tier && hit.rev === s.upgRev && !s.wxForce) return hit.w;
  const w = s.wxForce ?? weatherAt(s.seed, s.time, s.tier);
  cache.set(s, { tick: s.tick, tier: s.tier, w, minVis: minVisibilityRaw(s), rev: s.upgRev });
  return w;
}

/** Headwind for a plane moving along +x (negative = tailwind), knots. */
export function headwindForward(w: Weather): number {
  return -w.speed * Math.cos(w.windTo);
}

/** Crosswind on the (east-west) runways, knots. */
export function crosswind(w: Weather): number {
  return Math.abs(w.speed * Math.sin(w.windTo));
}

/** Crosswind each wake class can still land in (light planes give up first). */
export const CROSSWIND_LIMIT: readonly number[] = [13, 20, 26, 30];

/** Lowest visibility the airport can land in: better ILS, thicker fog. */
function minVisibilityRaw(s: GameState): number {
  const ils = Math.round(effectValue(s, 'ils'));
  return [0.5, 0.3, 0.15, 0][Math.max(0, Math.min(3, ils))];
}

export function minVisibility(s: GameState): number {
  weather(s);
  return cache.get(s)!.minVis;
}

export function foggedIn(s: GameState): boolean {
  return weather(s).vis < minVisibility(s);
}

/** Does this tier's layout have an opposite-direction setup? */
export function canReverse(tier: number): boolean {
  return !!layoutFor(tier).rev;
}

/** Phases in which a plane is committed to the runway direction it started with. */
const COMMITTED: ReadonlySet<FlightPhase> = new Set<FlightPhase>(['final', 'landing', 'rollout', 'taxiIn', 'taxiOut', 'holdShort', 'lineUp']);

/** Nobody on the runway or the taxiways in the old direction: the runway can turn. */
export function readyToTurn(s: GameState): boolean {
  for (const f of s.flights) {
    if (AIRCRAFT[f.aircraft]?.stand === 'heli') continue;
    if (COMMITTED.has(f.phase)) return false;
    if (f.phase === 'takeoff' && f.z < 0.8) return false;
  }
  return true;
}

/**
 * Picks the runway direction from the wind (with some slack so it does not
 * flip back and forth) and announces fog and wind changes. A runway change is
 * done like at a real airport: arrivals hold, the planes already on their way
 * out leave the old way, and once the ground is clear the runway turns.
 */
export function updateWeather(s: GameState): void {
  const w = weather(s);
  if (canReverse(s.tier)) {
    const hw = headwindForward(w);
    const want = s.forceDir ? s.forceDir : hw < -3 ? -1 : hw > 3 ? 1 : s.rwyDir;
    if (want === s.rwyDir) s.turning = 0;
    else if (readyToTurn(s)) {
      s.rwyDir = want;
      s.turning = 0;
      pushEvent(s, 'runwayFlip', 0, 0, want);
    } else s.turning = want;
  } else {
    s.rwyDir = 1;
    s.turning = 0;
  }
  const fog = foggedIn(s);
  if (fog !== s.wxFog) {
    s.wxFog = fog;
    pushEvent(s, fog ? 'fogIn' : 'fogOut', 0, 0, Math.round(w.vis * 100));
  }
  const strong = crosswind(w) > CROSSWIND_LIMIT[0];
  if (strong !== s.wxCross) {
    s.wxCross = strong;
    if (strong) pushEvent(s, 'crosswind', 0, 0, Math.round(crosswind(w)));
  }
}
