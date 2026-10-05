import { create } from 'zustand';

type Lang = 'he' | 'en';
export type View = 'game' | 'cast';

interface SettingsState {
  lang: Lang;
  showPerf: boolean;
  stress: number;
  view: View;
  setLang: (lang: Lang) => void;
  togglePerf: () => void;
  toggleStress: () => void;
  setView: (view: View) => void;
}

/** Number of extra walkers the stress toggle adds (target: 60 fps with ~60 animated entities). */
export const STRESS_WALKERS = 60;

export const useSettings = create<SettingsState>((set) => ({
  lang: 'en',
  showPerf: true,
  stress: 0,
  view: 'game',
  setLang: (lang) => set({ lang }),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
  toggleStress: () => set((s) => ({ stress: s.stress > 0 ? 0 : STRESS_WALKERS })),
  setView: (view) => set({ view }),
}));
