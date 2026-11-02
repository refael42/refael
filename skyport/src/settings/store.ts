import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isLang, type Lang } from '../i18n/strings';

export interface SettingsState {
  /** Null until the first launch picks the device language. */
  langChosen: boolean;
  lang: Lang;
  showFps: boolean;
  sound: boolean;
  music: boolean;
  haptics: boolean;
  /** First-launch screens done. */
  onboarded: boolean;
  /** Tutorial step (0 = off or finished). */
  tutorial: number;
  setOnboarded: (v: boolean) => void;
  setTutorial: (n: number) => void;
  setLang: (lang: Lang) => void;
  setShowFps: (v: boolean) => void;
  initLang: (lang: Lang) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      langChosen: false,
      lang: 'he',
      showFps: false,
      sound: true,
      music: true,
      haptics: true,
      onboarded: false,
      tutorial: 0,
      setOnboarded: (onboarded) => set({ onboarded }),
      setTutorial: (tutorial) => set({ tutorial }),
      setLang: (lang) => set({ lang, langChosen: true }),
      setShowFps: (showFps) => set({ showFps }),
      initLang: (lang) => {
        if (!get().langChosen) set({ lang, langChosen: true });
      },
    }),
    {
      name: 'skyport.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      merge: (persisted, current) => {
        // Never trust stored values: keep only well-formed fields.
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          langChosen: p.langChosen === true,
          lang: isLang(p.lang) ? p.lang : current.lang,
          showFps: typeof p.showFps === 'boolean' ? p.showFps : current.showFps,
          sound: typeof p.sound === 'boolean' ? p.sound : current.sound,
          music: typeof p.music === 'boolean' ? p.music : current.music,
          haptics: typeof p.haptics === 'boolean' ? p.haptics : current.haptics,
          onboarded: p.onboarded === true,
          tutorial: typeof p.tutorial === 'number' && p.tutorial >= 0 && p.tutorial <= 7 ? Math.floor(p.tutorial) : 0,
        };
      },
    },
  ),
);
