// `node scripts/make-sounds.mjs`: writes the game's sound effects and its music loop to
// assets/sounds/*.wav. Every sound is synthesized here from oscillators, noise and envelopes,
// so the game owns all of its audio (no downloads, no licenses). Re-run after changing a recipe.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

// ---------- building blocks ----------

const TAU = Math.PI * 2;
let seed = 12345;
/** Deterministic noise: the same files every run. */
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};

const osc = {
  sine: (p) => Math.sin(TAU * p),
  tri: (p) => 1 - 4 * Math.abs(((p + 0.25) % 1) - 0.5),
  square: (p) => (p % 1 < 0.5 ? 0.6 : -0.6),
  saw: (p) => 2 * (p % 1) - 1,
};

/** Note name to frequency ("A4" = 440). */
function hz(note) {
  const names = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const m = /^([A-G])(#|b)?(\d)$/.exec(note);
  const semis = names[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
}

/** A buffer of `seconds` of silence. */
const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE));

/**
 * Adds one tone: a waveform at a frequency (a fixed one or a glide `[from, to]`), with a quick
 * attack and an exponential decay, starting at `at` seconds.
 */
function tone(buf, { at = 0, dur, freq, wave = 'sine', vol = 0.5, attack = 0.004, decay = 6, vibrato = 0 }) {
  const [f0, f1] = Array.isArray(freq) ? freq : [freq, freq];
  let phase = 0;
  const start = Math.floor(at * RATE);
  const n = Math.floor(dur * RATE);
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / RATE;
    const f = f0 + (f1 - f0) * (i / n) + (vibrato ? Math.sin(TAU * 5.5 * t) * vibrato : 0);
    phase += f / RATE;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t) * Math.min(1, (n - i) / (RATE * 0.01));
    buf[start + i] += osc[wave](phase) * vol * env;
  }
}

/** Adds a burst of noise, low-passed (`tone` 0..1: dark to bright), with a decay. */
function hiss(buf, { at = 0, dur, vol = 0.4, decay = 20, bright = 0.5, attack = 0.002 }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(dur * RATE);
  let lp = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / RATE;
    lp += (noise() - lp) * bright;
    buf[start + i] += lp * vol * Math.min(1, t / attack) * Math.exp(-decay * t);
  }
}

/** A bell: a few inharmonic partials that ring out. */
function bell(buf, at, f, vol = 0.3, decay = 5) {
  for (const [k, v] of [[1, 1], [2.4, 0.45], [3.9, 0.25], [5.4, 0.12]]) tone(buf, { at, dur: 1.2, freq: f * k, vol: vol * v, decay: decay * (1 + k * 0.25) });
}

/** Normalizes to `peak`, then 16-bit mono WAV bytes. */
function wav(buf, peak = 0.85) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  const k = max > 0 ? peak / max : 0;
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * k)) * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

// ---------- the sounds ----------

const SOUNDS = {
  /** A soft pop for buttons. */
  tap() {
    const b = buffer(0.08);
    tone(b, { dur: 0.07, freq: [900, 520], wave: 'sine', vol: 0.6, decay: 40 });
    return wav(b, 0.6);
  },
  /** The classic two-note coin. */
  coin() {
    const b = buffer(0.3);
    tone(b, { dur: 0.07, freq: hz('B5'), wave: 'square', vol: 0.35, decay: 10 });
    tone(b, { at: 0.06, dur: 0.24, freq: hz('E6'), wave: 'square', vol: 0.35, decay: 12 });
    return wav(b, 0.55);
  },
  /** A dish lands on the table: a short porcelain clink. */
  serve() {
    const b = buffer(0.35);
    bell(b, 0, 1850, 0.3, 14);
    hiss(b, { dur: 0.03, vol: 0.25, decay: 120, bright: 0.9 });
    return wav(b, 0.5);
  },
  /** An upgrade: a quick rising arpeggio. */
  upgrade() {
    const b = buffer(0.45);
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(b, { at: i * 0.06, dur: 0.22, freq: hz(n), wave: 'tri', vol: 0.45, decay: 9 }));
    return wav(b, 0.6);
  },
  /** A milestone or a new building: a little fanfare with a sparkle on top. */
  fanfare() {
    const b = buffer(1.4);
    const notes = [['G4', 0], ['C5', 0.12], ['E5', 0.24], ['G5', 0.36], ['C6', 0.52]];
    for (const [n, at] of notes) {
      tone(b, { at, dur: n === 'C6' ? 0.85 : 0.2, freq: hz(n), wave: 'square', vol: 0.22, decay: n === 'C6' ? 2.5 : 8, vibrato: n === 'C6' ? 4 : 0 });
      tone(b, { at, dur: n === 'C6' ? 0.85 : 0.2, freq: hz(n) / 2, wave: 'tri', vol: 0.3, decay: n === 'C6' ? 2.5 : 8 });
    }
    for (let k = 0; k < 6; k++) bell(b, 0.6 + k * 0.07, 2600 + k * 220, 0.08, 9);
    return wav(b, 0.7);
  },
  /** A worker levels up: two bright notes. */
  levelup() {
    const b = buffer(0.4);
    tone(b, { dur: 0.1, freq: hz('E5'), wave: 'tri', vol: 0.5, decay: 10 });
    tone(b, { at: 0.09, dur: 0.3, freq: hz('A5'), wave: 'tri', vol: 0.5, decay: 7 });
    return wav(b, 0.55);
  },
  /** Someone is hired: a cheerful little "ta-da". */
  hire() {
    const b = buffer(0.5);
    tone(b, { dur: 0.12, freq: hz('G5'), wave: 'square', vol: 0.3, decay: 9 });
    tone(b, { at: 0.12, dur: 0.35, freq: hz('C6'), wave: 'square', vol: 0.3, decay: 5 });
    return wav(b, 0.5);
  },
  /** Payday and big bonuses: a cash register (bell plus the drawer). */
  cash() {
    const b = buffer(0.8);
    hiss(b, { dur: 0.12, vol: 0.5, decay: 30, bright: 0.25 });
    tone(b, { dur: 0.08, freq: [180, 90], wave: 'sine', vol: 0.6, decay: 30 });
    bell(b, 0.08, 1320, 0.35, 4);
    bell(b, 0.16, 1760, 0.25, 4);
    return wav(b, 0.6);
  },
  /** A crew hammers away (and every tap on the site). */
  hammer() {
    const b = buffer(0.22);
    tone(b, { dur: 0.08, freq: [240, 110], wave: 'sine', vol: 0.8, decay: 45 });
    hiss(b, { dur: 0.06, vol: 0.5, decay: 70, bright: 0.6 });
    bell(b, 0.004, 2100, 0.08, 25);
    return wav(b, 0.6);
  },
  /** A big upgrade is done: a clear chime. */
  done() {
    const b = buffer(1);
    bell(b, 0, hz('E6'), 0.3, 3.5);
    bell(b, 0.1, hz('B6'), 0.2, 3.5);
    return wav(b, 0.55);
  },
  /** A five-star review: a sparkle. */
  sparkle() {
    const b = buffer(0.7);
    for (let k = 0; k < 7; k++) bell(b, k * 0.05, 2200 + ((k * 370) % 1400), 0.12, 8);
    return wav(b, 0.5);
  },
  /** Rush hour: a whoosh going up. */
  rush() {
    const b = buffer(0.6);
    const n = b.length;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      lp += (noise() - lp) * (0.05 + t * 0.4);
      b[i] = lp * Math.sin(Math.PI * t) * 0.8;
    }
    tone(b, { dur: 0.55, freq: [220, 660], wave: 'tri', vol: 0.15, decay: 1 });
    return wav(b, 0.5);
  },
  /** A dropped dish. */
  crash() {
    const b = buffer(0.5);
    hiss(b, { dur: 0.45, vol: 0.6, decay: 9, bright: 0.85 });
    for (const f of [2300, 3100, 1700]) bell(b, 0.01 + (noise() + 1) * 0.025, f, 0.1, 18);
    return wav(b, 0.5);
  },
  // The two below use no noise, so adding them left every other file exactly as it was.
  /** The lucky wheel's peg flicking the pointer: a tiny wooden click. */
  tick() {
    const b = buffer(0.05);
    tone(b, { dur: 0.035, freq: [2400, 1500], wave: 'square', vol: 0.3, decay: 90 });
    tone(b, { dur: 0.03, freq: 900, wave: 'sine', vol: 0.5, decay: 120 });
    return wav(b, 0.5);
  },
  /** The wheel's jackpot: a slot machine's ringing run, then a bright chord. */
  jackpot() {
    const b = buffer(1.8);
    const run = ['C6', 'E6', 'G6', 'E6'];
    for (let k = 0; k < 12; k++) tone(b, { at: k * 0.065, dur: 0.07, freq: hz(run[k % 4]), wave: 'square', vol: 0.2, decay: 14 });
    for (const n of ['C5', 'E5', 'G5', 'C6']) tone(b, { at: 0.8, dur: 0.95, freq: hz(n), wave: 'tri', vol: 0.22, decay: 2.2, vibrato: 3 });
    for (let k = 0; k < 8; k++) bell(b, 0.85 + k * 0.06, 2400 + ((k * 410) % 1600), 0.09, 7);
    return wav(b, 0.7);
  },
};

// ---------- the music: a relaxed cafe loop ----------

/** 8 bars of an easy swing-ish loop at 104 BPM: bass, soft chords (Rhodes-like) and a tune. */
function music() {
  const bpm = 104;
  const beat = 60 / bpm;
  const bars = 8;
  const b = buffer(bars * 4 * beat);
  // I - vi - ii - V, twice, in C.
  const chords = [['C3', 'E4', 'G4', 'B4'], ['A2', 'C4', 'E4', 'G4'], ['D3', 'F4', 'A4', 'C5'], ['G2', 'D4', 'F4', 'B4']];
  const tune = [
    ['E5', 0, 1], ['G5', 1, 0.5], ['E5', 1.5, 0.5], ['D5', 2, 1.5],
    ['C5', 4, 1], ['E5', 5, 1], ['A4', 6, 1.5],
    ['F5', 8, 1], ['E5', 9, 0.5], ['D5', 9.5, 0.5], ['C5', 10, 1], ['A4', 11, 1],
    ['B4', 12, 1], ['D5', 13, 1], ['G5', 14, 1.5],
    ['E5', 16, 0.5], ['F5', 16.5, 0.5], ['G5', 17, 1], ['C6', 18, 1.5],
    ['B5', 20, 1], ['A5', 21, 0.5], ['G5', 21.5, 0.5], ['E5', 22, 1.5],
    ['F5', 24, 1], ['A5', 25, 1], ['G5', 26, 0.5], ['F5', 26.5, 0.5], ['D5', 27, 1],
    ['G5', 28, 1], ['F5', 29, 0.5], ['D5', 29.5, 0.5], ['C5', 30, 2],
  ];
  for (let bar = 0; bar < bars; bar++) {
    const [root, ...upper] = chords[bar % 4];
    const t0 = bar * 4 * beat;
    // Walking bass: root on 1 and 3, the fifth up an octave on the off beats.
    for (const [k, mult] of [[0, 1], [1, 1.5], [2, 1], [3, 2]]) tone(b, { at: t0 + k * beat, dur: beat * 0.9, freq: hz(root) * mult, wave: 'tri', vol: 0.32, decay: 3 });
    // Soft chords on 2 and 4 (swung a little late).
    for (const k of [1.08, 3.08]) for (const n of upper) tone(b, { at: t0 + k * beat, dur: beat * 0.8, freq: hz(n), wave: 'sine', vol: 0.07, decay: 4, attack: 0.01 });
    // Brushes: a soft hiss on every off beat.
    for (let k = 0; k < 4; k++) hiss(b, { at: t0 + (k + 0.5) * beat, dur: 0.12, vol: 0.05, decay: 25, bright: 0.7 });
  }
  for (const [n, at, len] of tune) {
    tone(b, { at: at * beat, dur: len * beat, freq: hz(n), wave: 'tri', vol: 0.16, decay: 1.8, attack: 0.02, vibrato: 2 });
    tone(b, { at: at * beat, dur: len * beat, freq: hz(n) * 2, wave: 'sine', vol: 0.03, decay: 3 });
  }
  return wav(b, 0.6);
}

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(SOUNDS)) writeFileSync(join(OUT, `${name}.wav`), make());
writeFileSync(join(OUT, 'music.wav'), music());
console.log(`Wrote ${Object.keys(SOUNDS).length + 1} files to ${OUT}`);
