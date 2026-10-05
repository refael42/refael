import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useT } from '../i18n';
import type { SimStats } from '../render/useSimulation';

interface Props {
  uiFps: SharedValue<number>;
  buildMs: SharedValue<number>;
  stats: SimStats;
}

/** Polls twice a second, never per frame, so measuring performance does not cost performance. */
export function PerfOverlay({ uiFps, buildMs, stats }: Props) {
  const t = useT();
  const [ui, setUi] = useState(0);
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setUi(Math.round(uiFps.value));
      setMs(buildMs.value);
    }, 500);
    return () => clearInterval(id);
  }, [uiFps, buildMs]);
  const color = ui >= 55 ? '#7CE08A' : ui >= 40 ? '#F4C542' : '#FF7A6A';
  // Label and value are separate Text nodes: mixing Hebrew and numbers in one string lets the
  // bidi algorithm reorder them ("ms 0.7 ציור").
  const rows: [string, string, string?][] = [
    [t('perf.ui'), `${ui} fps`, color],
    [t('perf.js'), `${Math.round(stats.jsFps)} fps`],
    [t('perf.draw'), `${ms.toFixed(1)} ms`],
    [t('perf.entities'), `${stats.entities}`],
  ];
  return (
    <View style={styles.box}>
      {rows.map(([label, value, tint]) => (
        <View key={label} style={styles.row}>
          <Text style={[styles.text, tint ? { color: tint } : null]}>{label}</Text>
          <Text style={[styles.text, tint ? { color: tint } : null]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    pointerEvents: 'none',
    position: 'absolute',
    bottom: 70,
    start: 12,
    backgroundColor: 'rgba(42,26,20,0.78)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  text: { color: '#FFF4E3', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
