import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../i18n';
import { frameStats } from '../render/useFrameLoop';

/** FPS of the JS frame loop and the average ms spent per frame (sim + snapshot). */
export function FpsMeter() {
  const t = useT();
  const [v, setV] = useState({ fps: 0, ms: 0 });
  useEffect(() => {
    let last = performance.now();
    let lastFrames = frameStats.frames;
    let lastWork = frameStats.workMs;
    const id = setInterval(() => {
      const now = performance.now();
      const frames = frameStats.frames - lastFrames;
      const work = frameStats.workMs - lastWork;
      const fps = Math.round((frames * 1000) / Math.max(1, now - last));
      const ms = frames > 0 ? Math.round((work / frames) * 10) / 10 : 0;
      last = now;
      lastFrames = frameStats.frames;
      lastWork = frameStats.workMs;
      setV((old) => (old.fps === fps && old.ms === ms ? old : { fps, ms }));
    }, 500);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.box} pointerEvents="none">
      <Text style={styles.text}>{t('hud.fps', { fps: v.fps, ms: v.ms })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: 'rgba(20,26,40,0.75)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  text: { color: '#c8f7c5', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
