import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCENES, type SceneDef } from '../data/scenes';
import { isRTL, useT } from '../i18n';
import type { Camera } from '../render/draw/drawScene';
import { SceneCanvas } from '../render/SceneCanvas';
import { useSimulation } from '../render/useSimulation';
import { useSettings } from '../store/settings';
import { JuicyButton } from './JuicyButton';
import { PerfOverlay } from './PerfOverlay';
import { theme } from './theme';

/** Name tags under the cast/props in the lineup view, so the owner can review each piece. */
function Labels({ scene, camera }: { scene: SceneDef; camera: Camera }) {
  const t = useT();
  const items = [
    ...scene.cast.filter((m) => m.label).map((m) => ({ label: m.label!, x: m.x, y: m.y + 6 })),
    ...scene.props.filter((p) => p.label).map((p) => ({ label: p.label!, x: p.x, y: p.y + 4 })),
  ];
  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
      {items.map((item) => (
        <View key={item.label} style={[styles.tag, { left: camera.x + item.x * camera.zoom - 50, top: camera.y + item.y * camera.zoom }]}>
          <Text style={styles.tagText}>{t(item.label)}</Text>
        </View>
      ))}
    </View>
  );
}

export function StyleTestScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { lang, setLang, showPerf, togglePerf, stress, toggleStress, view, setView } = useSettings();
  const scene = SCENES[view];
  const { snapshot, stats } = useSimulation(scene, stress);
  const uiFps = useSharedValue(0);
  const buildMs = useSharedValue(0);
  const [camera, setCamera] = useState<Camera | null>(null);

  return (
    <View style={[styles.root, { direction: isRTL(lang) ? 'rtl' : 'ltr', paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('app.title')}</Text>
        <View style={styles.row}>
          <JuicyButton label={t('tab.scene')} active={view === 'styleTest'} onPress={() => setView('styleTest')} />
          <JuicyButton label={t('tab.lineup')} active={view === 'lineup'} onPress={() => setView('lineup')} />
          <View style={styles.spacer} />
          <JuicyButton label={t('btn.stress')} active={stress > 0} onPress={toggleStress} />
          <JuicyButton label={t('btn.perf')} active={showPerf} onPress={togglePerf} />
          <JuicyButton label={t('btn.lang')} onPress={() => setLang(lang === 'he' ? 'en' : 'he')} />
        </View>
      </View>
      <View style={styles.stage}>
        <SceneCanvas key={view} scene={scene} snapshot={snapshot} uiFps={uiFps} buildMs={buildMs} onCamera={setCamera} />
        {view === 'lineup' && camera && <Labels scene={scene} camera={camera} />}
        {showPerf && <PerfOverlay uiFps={uiFps} buildMs={buildMs} stats={stats} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.paper },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: theme.cream,
    borderBottomWidth: 3,
    borderColor: theme.ink,
  },
  title: { fontSize: 22, fontWeight: '900', color: theme.ink, textAlign: 'auto' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spacer: { flex: 1 },
  passThrough: { pointerEvents: 'none' },
  stage: { flex: 1, overflow: 'hidden', backgroundColor: '#E6B985' },
  tag: {
    position: 'absolute',
    width: 100,
    alignItems: 'center',
  },
  tagText: {
    backgroundColor: 'rgba(255,244,227,0.92)',
    color: theme.ink,
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.ink,
  },
});
