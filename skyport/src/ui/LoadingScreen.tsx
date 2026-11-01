import { StyleSheet, Text, View } from 'react-native';

import { C } from './theme';

/** Plain React Native (no Skia) so it can show before CanvasKit loads. */
export function LoadingScreen({ progress, label }: { progress: number; label?: string }) {
  const p = Math.max(0.05, Math.min(1, progress));
  return (
    <View style={styles.root}>
      <Text style={styles.title}>SKYPORT</Text>
      <Text style={styles.sub}>TYCOON</Text>
      <View style={styles.runway}>
        <View style={[styles.fill, { width: `${p * 100}%` }]} />
        <View style={styles.dashes} pointerEvents="none">
          {Array.from({ length: 9 }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1b2a4a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: C.text, fontSize: 40, fontWeight: '900', letterSpacing: 6 },
  sub: { color: C.gold, fontSize: 16, fontWeight: '800', letterSpacing: 10, marginBottom: 36 },
  runway: { width: '78%', maxWidth: 360, height: 26, borderRadius: 8, backgroundColor: '#3a4256', overflow: 'hidden', borderWidth: 2, borderColor: C.ink },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#55607a' },
  dashes: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  dash: { width: 16, height: 3, borderRadius: 2, backgroundColor: '#f4f6fb' },
  label: { color: C.textDim, marginTop: 14, fontSize: 14 },
});
