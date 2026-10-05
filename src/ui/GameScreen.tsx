import { useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STAND_MAP } from '../data/maps';
import { LINEUP } from '../data/scenes';
import { isRTL, useT } from '../i18n';
import type { BackgroundDef } from '../render/art/background';
import type { Camera } from '../render/draw/fx';
import { isoX, isoY } from '../render/iso';
import { SceneCanvas, type SceneCanvasHandle } from '../render/SceneCanvas';
import { useGame, useLineup } from '../render/useSimulation';
import { useSettings } from '../store/settings';
import { JuicyButton } from './JuicyButton';
import { PerfOverlay } from './PerfOverlay';
import { theme } from './theme';

const GAME_BG: BackgroundDef = { width: STAND_MAP.width, height: STAND_MAP.height, areas: STAND_MAP.areas, building: STAND_MAP.building, wallHeight: STAND_MAP.wallHeight, backdrop: STAND_MAP.backdrop };
const CAST_BG: BackgroundDef = { width: LINEUP.width, height: LINEUP.height, areas: LINEUP.areas };
const GAME_FOCUS = { x: 8.6, y: 6.4, zoom: 1 };
const CAST_FOCUS = { x: 7.6, y: 4.9, zoom: 1.7 };
const GAME_SEED = 20251005;

/** Name tags under the cast and props, so the owner can review each piece. */
function Labels({ camera }: { camera: Camera }) {
  const t = useT();
  const items = [
    ...LINEUP.cast.filter((m) => m.label).map((m) => ({ label: m.label!, x: m.x, y: m.y })),
    ...LINEUP.props.filter((p) => p.label).map((p) => ({ label: p.label!, x: p.x, y: p.y })),
  ];
  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[styles.tag, { left: camera.x + isoX(item.x, item.y) * camera.zoom - 50, top: camera.y + isoY(item.x, item.y) * camera.zoom + 10 }]}
        >
          <Text style={styles.tagText}>{t(item.label)}</Text>
        </View>
      ))}
    </View>
  );
}

function GameView({ canvasRef }: { canvasRef: React.RefObject<SceneCanvasHandle | null> }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { showPerf, stress } = useSettings();
  const { snapshot, stats, tap } = useGame(STAND_MAP, GAME_SEED, stress);
  const uiFps = useSharedValue(0);
  const buildMs = useSharedValue(0);
  const hud = { left: insets.left + 12, top: insets.top + 10, right: width - insets.right - 12 };
  return (
    <>
      <SceneCanvas ref={canvasRef} snapshot={snapshot} background={GAME_BG} focus={GAME_FOCUS} hud={hud} uiFps={uiFps} buildMs={buildMs} onTap={tap} />
      {showPerf && <PerfOverlay uiFps={uiFps} buildMs={buildMs} stats={stats} />}
    </>
  );
}

function CastView({ canvasRef }: { canvasRef: React.RefObject<SceneCanvasHandle | null> }) {
  const { showPerf } = useSettings();
  const { snapshot, stats } = useLineup(LINEUP);
  const uiFps = useSharedValue(0);
  const buildMs = useSharedValue(0);
  const [camera, setCamera] = useState<Camera | null>(null);
  return (
    <>
      <SceneCanvas ref={canvasRef} snapshot={snapshot} background={CAST_BG} focus={CAST_FOCUS} uiFps={uiFps} buildMs={buildMs} onCamera={setCamera} />
      {camera && <Labels camera={camera} />}
      {showPerf && <PerfOverlay uiFps={uiFps} buildMs={buildMs} stats={stats} />}
    </>
  );
}

export function GameScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { lang, setLang, showPerf, togglePerf, stress, toggleStress, view, setView } = useSettings();
  const canvasRef = useRef<SceneCanvasHandle | null>(null);
  return (
    <View style={[styles.root, { direction: isRTL(lang) ? 'rtl' : 'ltr' }]}>
      {view === 'game' ? <GameView key="game" canvasRef={canvasRef} /> : <CastView key="cast" canvasRef={canvasRef} />}
      <View style={[styles.toolbar, { bottom: insets.bottom + 10, start: insets.left + 10 }]}>
        <JuicyButton label={view === 'game' ? t('tab.cast') : t('tab.game')} onPress={() => setView(view === 'game' ? 'cast' : 'game')} />
        {view === 'game' && <JuicyButton label={t('btn.stress')} active={stress > 0} onPress={toggleStress} />}
        <JuicyButton label={t('btn.perf')} active={showPerf} onPress={togglePerf} />
        <JuicyButton label={t('btn.lang')} onPress={() => setLang(lang === 'he' ? 'en' : 'he')} />
      </View>
      <View style={[styles.zoom, { bottom: insets.bottom + 10, end: insets.right + 10 }]}>
        <JuicyButton label={t('btn.zoomOut')} onPress={() => canvasRef.current?.zoomBy(1 / 1.25)} />
        <JuicyButton label={t('btn.zoomIn')} onPress={() => canvasRef.current?.zoomBy(1.25)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1022' },
  toolbar: { position: 'absolute', flexDirection: 'row', gap: 8 },
  zoom: { position: 'absolute', flexDirection: 'row', gap: 8 },
  passThrough: { pointerEvents: 'none' },
  tag: { position: 'absolute', width: 100, alignItems: 'center' },
  tagText: {
    backgroundColor: 'rgba(42,21,48,0.88)',
    color: theme.cream,
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2B13C',
  },
});
