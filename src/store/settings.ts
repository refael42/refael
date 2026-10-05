import { create } from 'zustand';
import type { SceneId } from '../data/scenes';

type Lang = 'he' | 'en';

interface SettingsState {
  lang: Lang;
  showPerf: boolean;
  stress: number;
  view: SceneId;
  setLang: (lang: Lang) => void;
  togglePerf: () => void;
  toggleStress: () => void;
  setView: (view: SceneId) => void;
}

/** Number of extra walkers the stress toggle adds (target: 60 fps with ~60 animated entities). */
export const STRESS_WALKERS = 60;

export const useSettings = create<SettingsState>((set) => ({
  lang: 'en',
  showPerf: true,
  stress: 0,
  view: 'styleTest',
  setLang: (lang) => set({ lang }),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
  toggleStress: () => set((s) => ({ stress: s.stress > 0 ? 0 : STRESS_WALKERS })),
  setView: (view) => set({ view }),
}));
