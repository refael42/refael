import { Platform } from 'react-native';

/** Web-only URL switches for testing: ?seed=1&warp=60&auto=1&speed=2&screen=gallery&select=1 */
export interface DebugParams {
  seed: number | null;
  warp: number;
  auto: boolean;
  speed: number;
  screen: string | null;
  select: boolean;
  /** Expose window.__skyport for browser tests. */
  hook: boolean;
  /** Perf experiments: skip the ground picture / static sprites. */
  noBg: boolean;
  noStatics: boolean;
  /** Performance checks: no vector sprites / no crisp ground when zoomed in. */
  noVec: boolean;
  noCrisp: boolean;
  /** Start with this many stands built, all staff hired (screenshots). */
  stands: number;
  crew: boolean;
  money: number;
  panel: string | null;
  /** Load/save even though test switches are present. */
  save: boolean;
  /** Start at this airport tier (screenshots). */
  tier: number;
  build: boolean;
  /** Camera override: world x, y and zoom. */
  cam: [number, number, number] | null;
  /** Tab to open a panel on (airlines: 1 = offers; board: 1 = arrivals). */
  tab: number;
  /** Camera keeps the oldest flight in view (screenshots of planes up close). */
  follow: boolean;
  /** Everything of the tier built and its airlines signed (screenshots of big airports). */
  full: boolean;
  /** Fixed weather (screenshots): fog, cross(wind), west(erly: the runway turns), calm. */
  wx: string | null;
  /** Ground one parked plane with a fault after the warp (screenshots). */
  fault: boolean;
  /** A tanker (and parts van) unloading at the supply area (screenshots). */
  tanker: boolean;
  /** Start this incident after the warp, already under way (screenshots). */
  inc: string | null;
  /** Pretend it is this holiday (HOLIDAYS id) and this day of it (0 = a travel day before). */
  hol: string | null;
  holDay: number;

  /** Any test switch in the URL (then no loading/saving by default). */
  isTest: boolean;
}

export function readDebugParams(): DebugParams {
  const out: DebugParams = { seed: null, warp: 0, auto: false, speed: 1, screen: null, select: false, hook: false, noBg: false, noStatics: false, noVec: false, noCrisp: false, stands: 0, crew: false, money: 0, panel: null, save: false, isTest: false, tier: 1, build: false, cam: null, tab: 0, follow: false, full: false, wx: null, fault: false, tanker: false, inc: null, hol: null, holDay: 1 };
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location) return out;
  const q = new URLSearchParams(window.location.search);
  const num = (k: string) => {
    const v = Number(q.get(k));
    return Number.isFinite(v) ? v : 0;
  };
  if (q.has('seed')) out.seed = num('seed');
  out.warp = Math.max(0, Math.min(3600, num('warp')));
  out.auto = q.get('auto') === '1';
  out.speed = q.has('speed') ? Math.max(0.25, Math.min(8, num('speed'))) : 1;
  out.screen = q.get('screen');
  out.select = q.get('select') === '1';
  out.hook = q.get('hook') === '1';
  out.noBg = q.get('nobg') === '1';
  out.noVec = q.get('novec') === '1';
  out.noCrisp = q.get('nocrisp') === '1';
  out.noStatics = q.get('nostatics') === '1';
  out.stands = Math.max(0, Math.min(9, num('stands')));
  out.crew = q.get('crew') === '1';
  out.money = Math.max(0, num('money'));
  out.panel = q.get('panel');
  out.save = q.get('save') === '1';
  out.tier = Math.max(1, Math.min(8, num('tier') || 1));
  out.build = q.get('build') === '1';
  out.tab = Math.max(0, Math.min(1, Number(q.get('tab') ?? 0) || 0));
  out.follow = q.get('follow') === '1';
  out.full = q.get('full') === '1';
  out.wx = q.get('wx');
  out.fault = q.get('fault') === '1';
  out.tanker = q.get('tanker') === '1';
  out.inc = q.get('inc');
  out.hol = q.get('hol');
  out.holDay = q.has('holday') ? Math.max(0, Math.min(8, num('holday'))) : 1;
  const cam = (q.get('cam') ?? '').split(',').map(Number);
  if (cam.length === 3 && cam.every((v) => Number.isFinite(v))) out.cam = [cam[0], cam[1], cam[2]];
  out.isTest = ['seed', 'warp', 'auto', 'stands', 'crew', 'money', 'panel', 'hook', 'select', 'speed', 'tier', 'build', 'full', 'wx', 'fault', 'tanker', 'inc', 'hol'].some((k) => q.has(k));
  return out;
}
