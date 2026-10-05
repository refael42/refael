import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { BulkStep } from '../data/works';

type Lang = 'he' | 'en';
export type View = 'game' | 'cast';

/** Who runs the place: shown on banners and greetings. Local only, no account. */
export interface Profile {
  manager: string;
  restaurant: string;
}

interface SettingsState {
  lang: Lang;
  showPerf: boolean;
  stress: number;
  view: View;
  /** Bumped to start the restaurant over from scratch (after a progress reset). */
  gameEpoch: number;
  /** Saved choices are read (first-run screens wait for this). */
  loaded: boolean;
  /** Null until the welcome screens are done. */
  profile: Profile | null;
  /** Index into TUTORIAL_STEPS; the length of it = finished (or skipped). */
  tutorial: number;
  /** Taps on the "test money" button (testing only); the game grants coins on each new one. */
  moneyTaps: number;
  /** Levels per tap on a buy or train button (x1, x10, x100, max). */
  bulk: BulkStep;
  setBulk: (bulk: BulkStep) => void;
  setLang: (lang: Lang) => void;
  togglePerf: () => void;
  toggleStress: () => void;
  setView: (view: View) => void;
  restartGame: () => void;
  setProfile: (profile: Profile) => void;
  setTutorial: (step: number) => void;
  addTestMoney: () => void;
}

/** Number of extra walkers the stress toggle adds (target: 60 fps with ~60 animated entities). */
export const STRESS_WALKERS = 60;

const KEY = 'restaurant.settings';

export const useSettings = create<SettingsState>((set) => ({
  lang: 'en',
  showPerf: false,
  stress: 0,
  view: 'game',
  gameEpoch: 0,
  loaded: false,
  profile: null,
  tutorial: 0,
  moneyTaps: 0,
  bulk: 1,
  setBulk: (bulk) => set({ bulk }),
  setLang: (lang) => set({ lang }),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
  toggleStress: () => set((s) => ({ stress: s.stress > 0 ? 0 : STRESS_WALKERS })),
  setView: (view) => set({ view }),
  // A fresh start is a first run again: welcome screens and tutorial included.
  restartGame: () => set((s) => ({ gameEpoch: s.gameEpoch + 1, stress: 0, view: 'game', profile: null, tutorial: 0 })),
  setProfile: (profile) => set({ profile }),
  setTutorial: (tutorial) => set({ tutorial }),
  addTestMoney: () => set((s) => ({ moneyTaps: s.moneyTaps + 1 })),
}));

/** What is kept between launches. */
const persisted = (s: SettingsState) => ({ lang: s.lang, showPerf: s.showPerf, profile: s.profile, tutorial: s.tutorial });

function readProfile(v: unknown): Profile | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Partial<Profile>;
  return typeof p.manager === 'string' && typeof p.restaurant === 'string' ? { manager: p.manager, restaurant: p.restaurant } : null;
}

/** Restores the player's choices (language, FPS counter, profile); the device language is the default. */
export async function loadSettings(deviceLang: Lang): Promise<void> {
  let saved: Partial<Record<keyof ReturnType<typeof persisted>, unknown>> = {};
  try {
    saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as typeof saved;
  } catch {
    // Unreadable settings are not worth a crash: fall back to defaults.
  }
  useSettings.setState({
    lang: saved.lang === 'he' || saved.lang === 'en' ? saved.lang : deviceLang,
    showPerf: saved.showPerf === true,
    profile: readProfile(saved.profile),
    tutorial: typeof saved.tutorial === 'number' && saved.tutorial >= 0 ? Math.floor(saved.tutorial) : 0,
    loaded: true,
  });
  useSettings.subscribe((s, prev) => {
    const now = persisted(s);
    const before = persisted(prev);
    if ((Object.keys(now) as (keyof typeof now)[]).some((k) => now[k] !== before[k])) void AsyncStorage.setItem(KEY, JSON.stringify(now));
  });
}
