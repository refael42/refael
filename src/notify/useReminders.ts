import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { translate } from '../i18n';
import type { GameState } from '../sim/game/types';
import { planReminders } from '../sim/reminders';
import { useSettings } from '../store/settings';
import { nativeNotifier } from './native';
import { noteFor } from './text';

// Plans the phone reminders as the game goes to the background, and clears them when it comes
// back (the player is here: nothing to remind them of). Asks for permission once the first
// screens and the tutorial are done, not at the very first launch.

export function useReminders(gameRef: { current: GameState | null }, ready: boolean): void {
  const [notifier] = useState(nativeNotifier);
  const on = useSettings((s) => s.reminders);
  useEffect(() => {
    if (!notifier.available || !on || !ready) return;
    void notifier.ask().catch((e: unknown) => console.warn('Reminders: permission failed', e));
  }, [notifier, on, ready]);
  useEffect(() => {
    if (!notifier.available) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void notifier.clear().catch((e: unknown) => console.warn('Reminders: clear failed', e));
        return;
      }
      if (state !== 'background') return;
      const game = gameRef.current;
      const { lang, profile, reminders, offerAlerts } = useSettings.getState();
      if (!game || !reminders || !ready) return;
      const notes = planReminders(game, Date.now(), new Date().getTimezoneOffset(), offerAlerts).map((r) => noteFor(r, (k) => translate(lang, k), profile?.restaurant || translate(lang, 'notify.place')));
      void notifier.plan(notes).catch((e: unknown) => console.warn('Reminders: plan failed', e));
    });
    return () => sub.remove();
  }, [notifier, gameRef, ready]);
  // Switched off in the settings: nothing stays planned.
  useEffect(() => {
    if (notifier.available && !on) void notifier.clear().catch(() => {});
  }, [notifier, on]);
}
