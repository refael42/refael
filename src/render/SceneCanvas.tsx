import { Canvas, Picture, Skia, type SkPicture, type SkPictureRecorder } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PixelRatio, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useFrameCallback, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated';
import type { SceneDef } from '../data/scenes';
import { STEP_MS, STEP_SEC } from '../data/sim';
import type { Snapshot } from '../sim/snapshot';
import { buildRenderAssets, type RenderAssets } from './assets';
import { drawScene, type Camera } from './draw/drawScene';

function emptyPicture(): SkPicture {
  const rec = Skia.PictureRecorder();
  rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return rec.finishRecordingAsPicture();
}

interface Props {
  scene: SceneDef;
  snapshot: SharedValue<Snapshot>;
  uiFps: SharedValue<number>;
  /** Smoothed milliseconds spent recording each frame on the UI thread. */
  buildMs: SharedValue<number>;
  /** Reports the world->screen camera so the UI can place labels over the scene. */
  onCamera?: (cam: Camera) => void;
}

/**
 * The ONE scene canvas. Each UI-thread frame records a fresh SkPicture: interpolated entities,
 * time-based effects, overlays. Nothing here re-renders React per frame.
 */
export function SceneCanvas({ scene, snapshot, uiFps, buildMs, onCamera }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [assets, setAssets] = useState<RenderAssets | null>(null);
  const empty = useMemo(emptyPicture, []);
  const picture = useSharedValue<SkPicture>(empty);
  const previous = useSharedValue<SkPicture[]>([]);
  const recorder = useSharedValue<SkPictureRecorder | null>(null);
  const arrival = useSharedValue(0);
  const lastSeq = useSharedValue(-1);
  const fpsFrames = useSharedValue(0);
  const fpsStart = useSharedValue(0);

  const camera = useMemo<Camera>(
    () => ({ zoom: size.width > 0 ? size.width / scene.width : 1, x: 0, y: 0 }),
    [size.width, scene.width],
  );

  useEffect(() => {
    if (onCamera) onCamera(camera);
  }, [camera, onCamera]);

  useEffect(() => {
    if (size.width === 0) return;
    // Bake after first paint so a loading state can show; the atlas is crisp at this zoom.
    const id = setTimeout(() => {
      setAssets(buildRenderAssets(scene, Math.min(5, PixelRatio.get() * camera.zoom * 1.1)));
    }, 0);
    return () => clearTimeout(id);
  }, [scene, size.width, camera.zoom]);

  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      const now = info.timestamp;
      if (fpsStart.value === 0) fpsStart.value = now;
      fpsFrames.value += 1;
      if (now - fpsStart.value >= 1000) {
        uiFps.value = (fpsFrames.value * 1000) / (now - fpsStart.value);
        fpsFrames.value = 0;
        fpsStart.value = now;
      }
      if (!assets) return;
      const snap = snapshot.value;
      if (snap.seq !== lastSeq.value) {
        lastSeq.value = snap.seq;
        arrival.value = now;
      }
      // Render one tick behind the newest state, sliding from prev to current position.
      const alpha = Math.min(1, (now - arrival.value) / STEP_MS);
      const t = snap.time - STEP_SEC * (1 - alpha);
      const started = performance.now();
      if (!recorder.value) recorder.value = Skia.PictureRecorder();
      const c = recorder.value.beginRecording(Skia.XYWHRect(0, 0, assets.scene.width * camera.zoom, assets.scene.height * camera.zoom));
      drawScene(c, assets, snap, alpha, t, camera);
      const next = recorder.value.finishRecordingAsPicture();
      // Free pictures two frames old: the one on screen is still in use until the next draw.
      const prev = previous.value;
      if (prev.length >= 2) {
        const stale = prev[0]!;
        if (stale !== empty) stale.dispose();
        previous.value = [prev[1]!, picture.value];
      } else {
        previous.value = [...prev, picture.value];
      }
      picture.value = next;
      buildMs.value = buildMs.value * 0.9 + (performance.now() - started) * 0.1;
    },
    [assets, camera, empty, snapshot, uiFps, buildMs, picture, previous, recorder, arrival, lastSeq, fpsFrames, fpsStart],
  );
  useFrameCallback(onFrame);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {size.width > 0 && (
        <Canvas style={styles.fill}>
          <Picture picture={picture} />
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
