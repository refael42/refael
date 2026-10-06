import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AppState, Platform } from 'react-native';
import { MIX, MUSIC_VOLUME, VOICES, type SoundId } from '../data/audio';

// Sound effects, the music loop and vibration (M11). Everything here is best effort: a phone
// without sound, a browser that blocks audio until the first tap, or a missing vibration motor
// must never stop the game, so every call is wrapped and failures are ignored.

const SOURCES: Readonly<Record<SoundId | 'music', number>> = {
  tap: require('../../assets/sounds/tap.wav'),
  coin: require('../../assets/sounds/coin.wav'),
  serve: require('../../assets/sounds/serve.wav'),
  upgrade: require('../../assets/sounds/upgrade.wav'),
  fanfare: require('../../assets/sounds/fanfare.wav'),
  levelup: require('../../assets/sounds/levelup.wav'),
  hire: require('../../assets/sounds/hire.wav'),
  cash: require('../../assets/sounds/cash.wav'),
  hammer: require('../../assets/sounds/hammer.wav'),
  done: require('../../assets/sounds/done.wav'),
  sparkle: require('../../assets/sounds/sparkle.wav'),
  rush: require('../../assets/sounds/rush.wav'),
  crash: require('../../assets/sounds/crash.wav'),
  music: require('../../assets/sounds/music.wav'),
};

const on = { sound: true, music: true, haptics: true };
const pools: Partial<Record<SoundId, { players: AudioPlayer[]; next: number }>> = {};
const lastPlay: Partial<Record<SoundId, number>> = {};
let music: AudioPlayer | null = null;
let ready = false;
let foreground = true;
/** Browsers refuse to play anything before the first tap (and log an error if asked): wait for it. */
let unlocked = Platform.OS !== 'web';

/** The first tap on the page (browsers): audio may start now. */
export function unlockAudio(): void {
  unlocked = true;
  syncMusic();
}

const safe = (f: () => void) => {
  try {
    f();
  } catch {
    // Audio is a nice-to-have: never let it break the game.
  }
};

/** Once at start: mix with other apps, respect the silent switch, pause in the background. */
export function initAudio(): void {
  if (ready) return;
  ready = true;
  void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => undefined);
  AppState.addEventListener('change', (state) => {
    // 'inactive' is a passing state (a pulled-down menu, an unfocused browser tab): keep playing.
    foreground = state !== 'background';
    syncMusic();
  });
}

/** The settings switches (sound effects, music, vibration). */
export function setAudioPrefs(prefs: { sound: boolean; music: boolean; haptics: boolean }): void {
  Object.assign(on, prefs);
  syncMusic();
}

export function playSound(id: SoundId): void {
  if (!on.sound || !foreground || !unlocked) return;
  const now = Date.now();
  const mix = MIX[id];
  if (now - (lastPlay[id] ?? 0) < mix.gapMs) return;
  lastPlay[id] = now;
  safe(() => {
    let pool = pools[id];
    if (!pool) {
      pool = { players: Array.from({ length: VOICES }, () => createAudioPlayer(SOURCES[id])), next: 0 };
      pools[id] = pool;
    }
    const p = pool.players[pool.next]!;
    pool.next = (pool.next + 1) % pool.players.length;
    p.volume = mix.volume;
    void p.seekTo(0).catch(() => undefined);
    p.play();
  });
}

/** Music plays while it is switched on and the app is in front (browsers: after the first tap). */
export function syncMusic(): void {
  safe(() => {
    const want = on.music && foreground && ready && unlocked;
    if (want && !music) {
      music = createAudioPlayer(SOURCES.music);
      music.loop = true;
      music.volume = MUSIC_VOLUME;
    }
    if (!music) return;
    if (want && !music.playing) music.play();
    else if (!want && music.playing) music.pause();
  });
}

export type Buzz = 'tap' | 'light' | 'success';

/** A short vibration (phones only). */
export function buzz(kind: Buzz): void {
  if (!on.haptics || Platform.OS === 'web') return;
  safe(() => {
    const done = kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : kind === 'light' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.selectionAsync();
    void done.catch(() => undefined);
  });
}

/** A button press: a soft pop and a tick. */
export function tapFeedback(): void {
  playSound('tap');
  buzz('tap');
}
