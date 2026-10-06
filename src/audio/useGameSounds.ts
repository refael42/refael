import { useEffect } from 'react';
import { Ev } from '../sim/game/events';
import type { GameState } from '../sim/game/types';
import { UPGRADE_QUIET } from '../sim/game/purchase';
import { useSettings } from '../store/settings';
import { buzz, initAudio, playSound, setAudioPrefs, unlockAudio } from './sound';
import type { SoundId } from '../data/audio';

// Plays the restaurant's sounds: the sim's events (the same ones the canvas turns into effects)
// are read on the JS thread a few times a second and each kind gets its sound and, for the big
// moments, a vibration.

const READS_PER_SECOND = 20;

/** The sound for one event, or null (and whether it is a big moment worth a vibration). */
function soundOf(type: number, a: number, b: number): [SoundId | null, boolean] {
  switch (type) {
    case Ev.Coins:
      return ['coin', false];
    case Ev.DishFly:
      return ['serve', false];
    case Ev.Upgrade:
      // A batch of tables plays its effect a few times: only the first copy sounds.
      if (b >= UPGRADE_QUIET) return [null, false];
      return b % 2 === 1 ? ['fanfare', true] : ['upgrade', false];
    case Ev.LevelUp:
      return ['levelup', false];
    case Ev.Hired:
      return ['hire', true];
    case Ev.Payday:
    case Ev.Bonus:
      return ['cash', false];
    case Ev.Build:
    case Ev.WorkStart:
    case Ev.WorkTap:
      return ['hammer', false];
    case Ev.WorkDone:
      return ['done', true];
    case Ev.Built:
    case Ev.Branch:
    case Ev.LevelUpRestaurant:
      return ['fanfare', true];
    case Ev.Review:
      return a >= 5 ? ['sparkle', false] : [null, false];
    case Ev.Rush:
      return ['rush', false];
    case Ev.VipArrives:
      return ['sparkle', true];
    case Ev.Vip:
    case Ev.Gift:
      return ['cash', true];
    case Ev.GiftAppears:
      return ['tap', false];
    case Ev.Daily:
      return ['fanfare', true];
    case Ev.Wheel:
      return ['cash', true];
    case Ev.Crash:
      return ['crash', false];
    default:
      return [null, false];
  }
}

export function useGameSounds(gameRef: { current: GameState | null }, paused: { current: boolean }): void {
  const { sound, music, haptics } = useSettings();
  useEffect(() => {
    initAudio();
    setAudioPrefs({ sound, music, haptics });
  }, [sound, music, haptics]);
  useEffect(() => {
    // Only what happens from now on (not what was already in the window when the game loaded).
    let last = Math.max(0, ...(gameRef.current?.events.map((e) => e.id) ?? [0]));
    const timer = setInterval(() => {
      const s = gameRef.current;
      if (!s) return;
      for (const e of s.events) {
        if (e.id <= last) continue;
        last = e.id;
        if (paused.current) continue;
        const [id, big] = soundOf(e.type, e.a, e.b);
        if (id) playSound(id);
        if (big) buzz('success');
        else if (e.type === Ev.WorkTap) buzz('light');
      }
    }, 1000 / READS_PER_SECOND);
    return () => clearInterval(timer);
  }, [gameRef, paused]);
  // Browsers only start audio after a tap: unlock it on the first one.
  useEffect(() => {
    const kick = () => unlockAudio();
    if (typeof document === 'undefined') return;
    document.addEventListener('pointerdown', kick, { once: true });
    return () => document.removeEventListener('pointerdown', kick);
  }, []);
}
