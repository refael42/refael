// The sound mix (M11, owner approved). The sounds themselves are made by
// scripts/make-sounds.mjs; this is how loud each one plays and how often at most (a busy
// restaurant pays dozens of bills a minute: one coin sound per payment would be a din).

export type SoundId = 'tap' | 'coin' | 'serve' | 'upgrade' | 'fanfare' | 'levelup' | 'hire' | 'cash' | 'hammer' | 'done' | 'sparkle' | 'rush' | 'crash';

export const MIX: Readonly<Record<SoundId, { volume: number; gapMs: number }>> = {
  tap: { volume: 0.45, gapMs: 40 },
  coin: { volume: 0.35, gapMs: 140 },
  serve: { volume: 0.35, gapMs: 120 },
  upgrade: { volume: 0.55, gapMs: 80 },
  fanfare: { volume: 0.65, gapMs: 900 },
  levelup: { volume: 0.5, gapMs: 300 },
  hire: { volume: 0.55, gapMs: 300 },
  cash: { volume: 0.6, gapMs: 600 },
  hammer: { volume: 0.4, gapMs: 180 },
  done: { volume: 0.6, gapMs: 300 },
  sparkle: { volume: 0.5, gapMs: 400 },
  rush: { volume: 0.5, gapMs: 1500 },
  crash: { volume: 0.5, gapMs: 400 },
};

/** Background music volume, and voices per effect (the same sound can overlap itself this often). */
export const MUSIC_VOLUME = 0.28;
export const VOICES = 3;
