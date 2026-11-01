import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tapFeedback } from '../audio/sound';
import { FLIP } from '../data/flip';
import { useT } from '../i18n';
import { usePoll } from '../render/useSimulation';
import type { Command, GameState } from '../sim/game/types';
import { gold, panel, textShadow } from './theme';

// The golden pan's game (owner: idea 7, src/data/flip.ts): a needle sweeps a bar back and forth;
// tap while it is in the green zone. Three rounds, the zone smaller and the needle faster each
// time; every hit is a perfect flip. The result goes back to the sim, which pays it.

const readPlaying = (s: GameState) => s.flip.playing;

/** The needle's place (0-1) `ms` into a round whose sweep takes `sweep` seconds. */
const needleAt = (ms: number, sweep: number) => {
  const k = (ms / 1000 / sweep) % 2;
  return k < 1 ? k : 2 - k;
};

export function FlipGame({ gameRef, onCommand }: { gameRef: { current: GameState | null }; onCommand: (cmd: Command) => void }) {
  const t = useT();
  const playing = usePoll(gameRef, readPlaying, 4);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState<boolean[]>([]);
  const [pos, setPos] = useState(0);
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const start = useRef(0);
  const done = hits.length >= FLIP.rounds.length;
  useEffect(() => {
    if (!playing) {
      setRound(0);
      setHits([]);
      setFlash(null);
      return;
    }
    if (done || flash) return;
    start.current = performance.now();
    let raf = 0;
    const tick = () => {
      setPos(needleAt(performance.now() - start.current, FLIP.rounds[round]!.sweep));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, round, done, flash]);
  // After the last round, the score shows a moment, then the sim pays it.
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => onCommand({ type: 'flipDone', hits: hits.filter(Boolean).length }), 1400);
    return () => clearTimeout(id);
  }, [done, hits, onCommand]);
  if (!playing) return null;
  const r = FLIP.rounds[Math.min(round, FLIP.rounds.length - 1)]!;
  const zoneFrom = 0.5 - r.zone / 2;
  const tap = () => {
    if (done || flash) return;
    const p = needleAt(performance.now() - start.current, r.sweep);
    const hit = p >= zoneFrom && p <= zoneFrom + r.zone;
    tapFeedback();
    setPos(p);
    setFlash(hit ? 'hit' : 'miss');
    setTimeout(() => {
      setHits((h) => [...h, hit]);
      setRound((n) => n + 1);
      setFlash(null);
    }, 550);
  };
  const score = hits.filter(Boolean).length;
  return (
    <View style={styles.backdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="flip" onPress={tap} style={styles.card}>
        <Text style={styles.title}>{t('flip.title')}</Text>
        <Text style={styles.sub}>{done ? t(score === 3 ? 'flip.perfect' : score > 0 ? 'flip.good' : 'flip.miss').replace('{n}', String(score)) : t('flip.howTo')}</Text>
        <View style={styles.bar}>
          <View style={[styles.zone, { left: `${zoneFrom * 100}%`, width: `${r.zone * 100}%` }, flash === 'hit' && styles.zoneHit]} />
          {!done && <View style={[styles.needle, { left: `${pos * 100}%` }, flash === 'miss' && styles.needleMiss]} />}
        </View>
        <View style={styles.pans}>
          {FLIP.rounds.map((_, i) => (
            <View key={i} style={[styles.pip, i < hits.length && (hits[i] ? styles.pipHit : styles.pipMiss), i === round && !done && styles.pipNow]} />
          ))}
        </View>
        {!done && <Text style={styles.tap}>{t('flip.tap')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,6,18,0.55)', alignItems: 'center', justifyContent: 'center' },
  card: { width: 440, maxWidth: '92%', backgroundColor: panel.bg, borderRadius: 22, borderWidth: 3, borderColor: gold, paddingHorizontal: 18, paddingVertical: 16, alignItems: 'center', gap: 10 },
  title: { color: '#FFE9A8', fontSize: 22, fontWeight: '900', ...textShadow('#2A1530', 2, 2) },
  sub: { color: '#E8D7F0', fontSize: 13.5, fontWeight: '800', textAlign: 'center' },
  bar: { width: '100%', height: 34, borderRadius: 17, backgroundColor: '#2A1832', borderWidth: 2, borderColor: '#5A4A62', overflow: 'hidden', direction: 'ltr' },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#35B957' },
  zoneHit: { backgroundColor: '#7CF29A' },
  needle: { position: 'absolute', top: -2, bottom: -2, width: 6, marginLeft: -3, backgroundColor: '#FFE27A', borderRadius: 3 },
  needleMiss: { backgroundColor: '#E5372B' },
  pans: { flexDirection: 'row', gap: 10 },
  pip: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#3A2A44', borderWidth: 2, borderColor: '#5A4A62' },
  pipNow: { borderColor: '#FFE27A' },
  pipHit: { backgroundColor: '#F2C14E', borderColor: '#FFF4E3' },
  pipMiss: { backgroundColor: '#6A2A2A', borderColor: '#9A4A4A' },
  tap: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
