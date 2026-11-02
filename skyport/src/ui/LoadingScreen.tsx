import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { C } from './theme';

/** Plain React Native (no Skia) so it can show before CanvasKit loads. */
export function LoadingScreen({ progress, label }: { progress: number; label?: string }) {
  const p = Math.max(0.05, Math.min(1, progress));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 90);
    return () => clearInterval(id);
  }, []);
  const shift = (tick * 4) % 28;
  return (
    <View style={styles.root}>
      <View style={[styles.glow, { top: '18%', left: '-20%', backgroundColor: 'rgba(99,102,241,0.2)' }]} />
      <View style={[styles.glow, { bottom: '10%', right: '-25%', backgroundColor: 'rgba(16,185,129,0.14)' }]} />
      <Text style={styles.title}>SKYPORT</Text>
      <Text style={styles.sub}>TYCOON</Text>
      <View style={styles.sky}>
        {(() => {
          // a little plane rolls down the runway and lifts off, again and again
          const k = (tick % 40) / 40;
          const lift = Math.max(0, k - 0.55) / 0.45;
          return (
            <View style={[styles.plane, { left: `${4 + k * 82}%`, transform: [{ translateY: -lift * 46 }, { rotate: `${-lift * 14}deg` }] }]}>
              <View style={styles.fuselage} />
              <View style={styles.wing} />
              <View style={styles.tail} />
              <View style={[styles.shadow, { opacity: 0.35 - lift * 0.25, transform: [{ translateY: 14 + lift * 46 }] }]} />
            </View>
          );
        })()}
      </View>
      <View style={styles.runway}>
        <View style={[styles.fill, { width: `${p * 100}%` }]} />
        <View style={[styles.dashes, { transform: [{ translateX: -shift }] }]} pointerEvents="none">
          {Array.from({ length: 16 }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' },
  glow: { position: 'absolute', width: 420, height: 420, borderRadius: 210, filter: 'blur(60px)' },
  title: { color: '#ffffff', fontSize: 42, fontWeight: '900', letterSpacing: 10 },
  sub: { color: '#a5b4fc', fontSize: 13, fontWeight: '700', letterSpacing: 14, marginTop: 2, marginBottom: 40 },
  sky: { width: '72%', maxWidth: 340, height: 64 },
  plane: { position: 'absolute', bottom: 0, width: 46, height: 18 },
  fuselage: { position: 'absolute', left: 0, top: 6, width: 46, height: 8, borderRadius: 4, backgroundColor: '#ffffff' },
  wing: { position: 'absolute', left: 16, top: 0, width: 10, height: 20, borderRadius: 3, backgroundColor: '#c7d2fe' },
  tail: { position: 'absolute', left: 0, top: 0, width: 6, height: 10, borderRadius: 2, backgroundColor: '#818cf8' },
  shadow: { position: 'absolute', left: 4, top: 6, width: 40, height: 4, borderRadius: 2, backgroundColor: '#000' },
  runway: { width: '72%', maxWidth: 340, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 7, backgroundColor: '#818cf8' },
  dashes: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '200%', flexDirection: 'row', alignItems: 'center', gap: 14 },
  dash: { width: 14, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)' },
  label: { color: 'rgba(255,255,255,0.6)', marginTop: 16, fontSize: 13, fontWeight: '600' },
});
