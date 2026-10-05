import { Canvas, Picture, Skia, TileMode, vec, type SkPaint, type SkPicture, type SkPictureRecorder } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, runOnUI, useFrameCallback, useSharedValue, withDecay, type FrameInfo, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { STEP_MS, STEP_SEC } from '../data/sim';
import type { Snapshot } from '../sim/snapshot';
import type { BackgroundDef } from './art/background';
import { buildRenderAssets, type RenderAssets } from './assets';
import { drawScene } from './draw/drawScene';
import { createFx, FxKind, spawnFx, type Camera, type FxState } from './draw/fx';
import type { HudLayout } from './draw/hud';
import { isoX, isoY } from './iso';

const MAX_ZOOM = 2.8;
const EDGE = 60;

function emptyPicture(): SkPicture {
  const rec = Skia.PictureRecorder();
  rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return rec.finishRecordingAsPicture();
}

function vignettePaint(w: number, h: number): SkPaint {
  const p = Skia.Paint();
  p.setShader(
    Skia.Shader.MakeRadialGradient(
      vec(w / 2, h / 2),
      Math.max(w, h) * 0.72,
      [Skia.Color('rgba(20,6,26,0)'), Skia.Color('rgba(20,6,26,0)'), Skia.Color('rgba(20,6,26,0.45)')],
      [0, 0.62, 1],
      TileMode.Clamp,
    ),
  );
  return p;
}

/** The bits of a DOM element the web wheel-zoom needs (no DOM typings in the app). */
interface WheelHost {
  addEventListener(type: 'wheel', fn: (e: WheelLike) => void, options: { passive: boolean }): void;
  removeEventListener(type: 'wheel', fn: (e: WheelLike) => void): void;
  getBoundingClientRect(): { left: number; top: number };
}
interface WheelLike {
  deltaY: number;
  clientX: number;
  clientY: number;
  preventDefault(): void;
}

interface Props {
  snapshot: SharedValue<Snapshot>;
  background: BackgroundDef;
  /** Floor point (tiles) the camera starts centered on, and the starting zoom. */
  focus: { x: number; y: number; zoom: number };
  hud?: HudLayout;
  uiFps: SharedValue<number>;
  buildMs: SharedValue<number>;
  /** Screen tap (px) plus the camera at that moment, for hit-testing on the JS thread. */
  onTap?: (x: number, y: number, cam: Camera) => void;
  /** Called when the camera settles (labels overlay). */
  onCamera?: (cam: Camera) => void;
  /** Prop kind to outline (the station whose upgrades are open), -1 for none. */
  selected?: SharedValue<number>;
}

/**
 * The ONE scene canvas. Each UI-thread frame records a fresh SkPicture: background, sorted
 * entities, effects, HUD. Camera pan/zoom runs on the UI thread too; React never re-renders
 * per frame.
 */
export function SceneCanvas({ snapshot, background, focus, hud, uiFps, buildMs, onTap, onCamera, selected }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [assets, setAssets] = useState<RenderAssets | null>(null);
  const empty = useMemo(emptyPicture, []);
  const picture = useSharedValue<SkPicture>(empty);
  const previous = useSharedValue<SkPicture[]>([]);
  const recorder = useSharedValue<SkPictureRecorder | null>(null);
  const fx = useSharedValue<FxState | null>(null);
  const arrival = useSharedValue(0);
  const lastSeq = useSharedValue(-1);
  const lastNow = useSharedValue(0);
  const fpsFrames = useSharedValue(0);
  const fpsStart = useSharedValue(0);
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const zoom = useSharedValue(1);
  const W = size.width;
  const H = size.height;
  const vignette = useMemo(() => (W > 0 ? vignettePaint(W, H) : null), [W, H]);

  useEffect(() => {
    if (W === 0) return;
    // Bake after first paint; crisp up to the max zoom (capped to keep the texture small).
    const id = setTimeout(() => setAssets(buildRenderAssets(background, Math.min(5, PixelRatio.get() * 2), PixelRatio.get())), 0);
    return () => clearTimeout(id);
  }, [background, W]);

  const world = assets?.world;

  const notifyCamera = useCallback((cx: number, cy: number, z: number) => onCamera?.({ x: cx, y: cy, zoom: z }), [onCamera]);

  // Start centered on the focus point.
  useEffect(() => {
    if (W === 0) return;
    zoom.value = focus.zoom;
    camX.value = W / 2 - isoX(focus.x, focus.y) * focus.zoom;
    camY.value = H / 2 - isoY(focus.x, focus.y) * focus.zoom;
    notifyCamera(camX.value, camY.value, zoom.value);
  }, [W, H, focus, camX, camY, zoom, notifyCamera]);

  /** Keeps the map covering the screen (or centered when it is smaller than the screen). */
  const clampCam = useCallback(() => {
    'worklet';
    if (!world) return;
    const z = zoom.value;
    const ww = (world.maxX - world.minX) * z;
    const wh = (world.maxY - world.minY) * z;
    camX.value = ww <= W ? (W - ww) / 2 - world.minX * z : Math.min(-world.minX * z + EDGE, Math.max(W - world.maxX * z - EDGE, camX.value));
    camY.value = wh <= H ? (H - wh) / 2 - world.minY * z : Math.min(-world.minY * z + EDGE, Math.max(H - world.maxY * z - EDGE, camY.value));
  }, [world, W, H, camX, camY, zoom]);

  const minZoom = world ? Math.max(0.45, Math.min(W / (world.maxX - world.minX), H / (world.maxY - world.minY))) : 0.5;

  /** Zoom around a focal point so the spot under the fingers stays under the fingers. */
  const applyZoom = useCallback(
    (factor: number, fx0: number, fy0: number) => {
      'worklet';
      const nz = Math.min(MAX_ZOOM, Math.max(minZoom, zoom.value * factor));
      const k = nz / zoom.value;
      camX.value = fx0 - (fx0 - camX.value) * k;
      camY.value = fy0 - (fy0 - camY.value) * k;
      zoom.value = nz;
      clampCam();
    },
    [minZoom, zoom, camX, camY, clampCam],
  );

  // Zoom is pinch-only on phones; on web (testing in a browser) the mouse wheel zooms too.
  const host = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !host.current) return;
    const el = host.current as unknown as WheelHost;
    const onWheel = (e: WheelLike) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      runOnUI(applyZoom)(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  const notifyTap = useCallback((x: number, y: number, cx: number, cy: number, z: number) => onTap?.(x, y, { x: cx, y: cy, zoom: z }), [onTap]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(6)
      .onBegin(() => {
        cancelAnimation(camX);
        cancelAnimation(camY);
      })
      .onChange((e) => {
        camX.value += e.changeX;
        camY.value += e.changeY;
        clampCam();
      })
      .onEnd((e) => {
        if (!world) return;
        const z = zoom.value;
        const a = W - world.maxX * z - EDGE;
        const b = -world.minX * z + EDGE;
        const c = H - world.maxY * z - EDGE;
        const d = -world.minY * z + EDGE;
        // Inertia: the map keeps gliding after a flick, then settles inside the limits.
        camX.value = withDecay({ velocity: e.velocityX, clamp: [Math.min(a, b), Math.max(a, b)] }, (done) => {
          if (done) scheduleOnRN(notifyCamera, camX.value, camY.value, zoom.value);
        });
        camY.value = withDecay({ velocity: e.velocityY, clamp: [Math.min(c, d), Math.max(c, d)] });
      });
    const pinch = Gesture.Pinch()
      .onChange((e) => applyZoom(e.scaleChange, e.focalX, e.focalY))
      .onEnd(() => scheduleOnRN(notifyCamera, camX.value, camY.value, zoom.value));
    const tap = Gesture.Tap()
      .maxDistance(12)
      .onEnd((e, success) => {
        if (!success) return;
        const s = fx.value;
        if (s) spawnFx(s, FxKind.Ripple, s.lastFrame, 0.4, e.x, e.y);
        scheduleOnRN(notifyTap, e.x, e.y, camX.value, camY.value, zoom.value);
      });
    return Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);
  }, [camX, camY, zoom, clampCam, applyZoom, world, W, H, fx, notifyTap, notifyCamera]);

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
      if (fx.value === null) fx.value = createFx();
      const s = fx.value!;
      const snap = snapshot.value;
      if (snap.seq !== lastSeq.value) {
        lastSeq.value = snap.seq;
        arrival.value = now;
      }
      // Render one tick behind the newest state, sliding from the previous to the current one.
      const alpha = Math.min(1, (now - arrival.value) / STEP_MS);
      const t = snap.time - STEP_SEC * (1 - alpha);
      const dt = lastNow.value > 0 ? Math.min(0.1, (now - lastNow.value) / 1000) : 0;
      lastNow.value = now;
      s.lastFrame = t;
      const started = performance.now();
      if (!recorder.value) recorder.value = Skia.PictureRecorder();
      const c = recorder.value.beginRecording(Skia.XYWHRect(0, 0, W, H));
      drawScene(c, assets, snap, alpha, t, dt, { x: camX.value, y: camY.value, zoom: zoom.value }, s, hud ?? null, vignette, W, H, selected ? selected.value : -1);
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
    [assets, empty, snapshot, uiFps, buildMs, picture, previous, recorder, fx, arrival, lastSeq, lastNow, fpsFrames, fpsStart, camX, camY, zoom, hud, vignette, W, H, selected],
  );
  useFrameCallback(onFrame);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <View ref={host} style={styles.fill} onLayout={onLayout}>
      {W > 0 && (
        <GestureDetector gesture={gesture}>
          <Canvas style={styles.fill}>
            <Picture picture={picture} />
          </Canvas>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
