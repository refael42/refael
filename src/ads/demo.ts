import { create } from 'zustand';
import type { AdProvider, AdResult } from './types';

// A test ad (the web build and test builds): a card over the game that counts down a few
// seconds, as a real rewarded ad would play. src/ui/DemoAd.tsx draws it from this store.

export const DEMO_AD_SECONDS = 5;

interface DemoAdState {
  /** The ad on screen (null: none), and how it ends. */
  playing: { done: (r: AdResult) => void } | null;
  finish: (r: AdResult) => void;
}

export const useDemoAd = create<DemoAdState>((set, get) => ({
  playing: null,
  finish: (r) => {
    const p = get().playing;
    set({ playing: null });
    p?.done(r);
  },
}));

export function demoAds(): AdProvider {
  return {
    mode: 'demo',
    load() {},
    ready: () => useDemoAd.getState().playing === null,
    show: () =>
      new Promise<AdResult>((resolve) => {
        if (useDemoAd.getState().playing) return resolve('failed');
        useDemoAd.setState({ playing: { done: resolve } });
      }),
  };
}
