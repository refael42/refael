import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DEMO_AD_SECONDS, useDemoAd } from '../ads/demo';
import { useT } from '../i18n';
import { gold } from './theme';

// The test ad (src/ads/demo.ts): the web build and test builds show this instead of a real
// rewarded ad. It counts down; closed early, no reward (as with a real one).

export function DemoAd() {
  const t = useT();
  const playing = useDemoAd((a) => a.playing);
  const finish = useDemoAd((a) => a.finish);
  const [left, setLeft] = useState(DEMO_AD_SECONDS);
  useEffect(() => {
    if (!playing) return;
    setLeft(DEMO_AD_SECONDS);
    const id = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(id);
  }, [playing]);
  useEffect(() => {
    if (playing && left <= 0) finish('rewarded');
  }, [left, playing, finish]);
  if (!playing) return null;
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.label}>{t('ads.testAd')}</Text>
        <Text style={styles.count}>{Math.max(0, left)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="close-ad" onPress={() => finish('closed')} style={styles.close}>
          <Text style={styles.closeText}>{t('ads.closeEarly')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,4,12,0.92)', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  card: { alignItems: 'center', gap: 10 },
  label: { color: '#E8D7F0', fontSize: 16, fontWeight: '800' },
  count: { color: gold, fontSize: 64, fontWeight: '900' },
  close: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, borderColor: '#7A6A82' },
  closeText: { color: '#C9B3D6', fontSize: 13, fontWeight: '800' },
});
