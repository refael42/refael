import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

type Lang = 'he' | 'en';
export type View = 'game' | 'cast';

interface SettingsState {
  lang: Lang;
  showPerf: boolean;
  stress: number;
  view: View;
  /** Bumped to start the restaurant over from scratch (after a progress reset). */
  gameEpoch: number;
  setLang: (lang: Lang) => void;
  togglePerf: () => void;
  toggleStress: () => void;
  setView: (view: View) => void;
  restartGame: () => void;
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
  setLang: (lang) => set({ lang }),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
  toggleStress: () => set((s) => ({ stress: s.stress > 0 ? 0 : STRESS_WALKERS })),
  setView: (view) => set({ view }),
  restartGame: () => set((s) => ({ gameEpoch: s.gameEpoch + 1, stress: 0, view: 'game' })),
}));

/** Restores the player's choices (language, FPS counter); the device language is the default. */
export async function loadSettings(deviceLang: Lang): Promise<void> {
  let saved: Partial<Pick<SettingsState, 'lang' | 'showPerf'>> = {};
  try {
    saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as typeof saved;
  } catch {
    // Unreadable settings are not worth a crash: fall back to defaults.
  }
  useSettings.setState({ lang: saved.lang === 'he' || saved.lang === 'en' ? saved.lang : deviceLang, showPerf: saved.showPerf === true });
  useSettings.subscribe((s, prev) => {
    if (s.lang !== prev.lang || s.showPerf !== prev.showPerf) void AsyncStorage.setItem(KEY, JSON.stringify({ lang: s.lang, showPerf: s.showPerf }));
  });
}
