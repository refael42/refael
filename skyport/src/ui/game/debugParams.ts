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
}

export function readDebugParams(): DebugParams {
  const out: DebugParams = { seed: null, warp: 0, auto: false, speed: 1, screen: null, select: false, hook: false, noBg: false, noStatics: false };
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
  out.noStatics = q.get('nostatics') === '1';
  return out;
}
