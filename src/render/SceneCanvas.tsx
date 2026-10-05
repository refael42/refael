import { Canvas, Picture, Skia, TileMode, vec, type SkPaint, type SkPicture, type SkPictureRecorder } from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, View, type GestureResponderEvent, type GestureResponderHandlers, type LayoutChangeEvent } from 'react-native';
import { useFrameCallback, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated';
import { STEP_MS, STEP_SEC } from '../data/sim';
import type { Snapshot } from '../sim/snapshot';
import { trace } from '../trace';
import type { BackgroundDef } from './art/background';
import { buildRenderAssets, type RenderAssets } from './assets';
import { centerOn, clampCam, glide, zoomAt, type Cam, type WorldBounds } from './camera';
import { drawScene, type BuildOverlay } from './draw/drawScene';
import { createFx, FxKind, spawnFx, type Camera, type FxState } from './draw/fx';
import type { HudLayout } from './draw/hud';
import { isoX, isoY } from './iso';
import { touchEnd, touchMove, touchStart, type Finger, type TouchTracker } from './touches';

const DISPOSE_PICTURES = Platform.OS === 'web';
/** Pictures kept alive after they leave the screen (web only). */
const KEEP_PICTURES = 3;
/** Touches logged to the dev terminal (enough to see where a phone-only crash happens). */
const TRACED_TOUCHES = 3;
/** How long the camera takes to pan to a new focus (ms). */
const PAN_MS = 900;

type NativeTouch = { identifier?: number | string; pageX: number; pageY: number };

/**
 * Fingers on the map, in the map view's own pixels. A mouse (web) has no touch list: the
 * event itself is the one finger. `lifted` drops fingers that just went up.
 */
function fingersOf(e: GestureResponderEvent, origin: { x: number; y: number }, lifted = false): Finger[] {
  const ne = e.nativeEvent as unknown as NativeTouch & { touches?: NativeTouch[]; changedTouches?: NativeTouch[] };
  let list: NativeTouch[] = ne.touches && ne.touches.length > 0 ? ne.touches : lifted ? [] : [ne];
  if (lifted && ne.changedTouches) {
    const up = new Set(ne.changedTouches.map((t) => Number(t.identifier ?? 0)));
    list = list.filter((t) => !up.has(Number(t.identifier ?? 0)));
  }
  return list.map((t) => ({ id: Number(t.identifier ?? 0), x: t.pageX - origin.x, y: t.pageY - origin.y }));
}

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
  /** Character id to ring (the worker or applicant whose card is open), -1 for none. */
  selectedId?: SharedValue<number>;
  /** Build mode marks (free tiles, the picked one), or null outside build mode. */
  build?: SharedValue<BuildOverlay | null>;
}

/**
 * The ONE scene canvas. Each UI-thread frame records a fresh SkPicture: background, sorted
 * entities, effects, HUD. React never re-renders per frame.
 *
 * Touches use React Native's own responder events on the JS thread, and the camera lives
 * there too; the UI thread only reads it to draw. (A gesture-handler + worklet setup crashed
 * the app natively on the owner's phone at the first touch, with no error to read.)
 */
export const SceneCanvas = memo(function SceneCanvas({ snapshot, background, focus, hud, uiFps, buildMs, onTap, onCamera, selected, selectedId, build }: Props) {
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
  const camera = useSharedValue<Cam>({ x: 0, y: 0, zoom: 1 });
  /** The last tap, for the ripple drawn under the finger (n counts taps). */
  const ripple = useSharedValue({ x: 0, y: 0, n: 0 });
  const lastRipple = useSharedValue(0);
  const W = size.width;
  const H = size.height;
  const vignette = useMemo(() => (W > 0 ? vignettePaint(W, H) : null), [W, H]);

  useEffect(() => {
    if (W === 0) return;
    trace(`canvas ${Math.round(W)}x${Math.round(H)}`);
    // Bake after first paint; crisp up to the max zoom (capped to keep the texture small).
    const id = setTimeout(() => {
      const started = Date.now();
      setAssets(buildRenderAssets(background, Math.min(5, PixelRatio.get() * 2), PixelRatio.get()));
      trace(`assets baked in ${Date.now() - started} ms`);
    }, 0);
    return () => clearTimeout(id);
  }, [background, W, H]);

  // Everything the touch handlers read lives in refs, so the handlers never change.
  const cam = useRef<Cam>({ x: 0, y: 0, zoom: 1 });
  const geo = useRef<{ world: WorldBounds | null; W: number; H: number }>({ world: null, W: 0, H: 0 });
  geo.current = { world: assets?.world ?? null, W, H };
  const callbacks = useRef({ onTap, onCamera });
  callbacks.current = { onTap, onCamera };

  /** Hands the camera to the UI thread (a fresh object: values sent there are frozen). */
  const publish = useCallback(() => {
    camera.value = { x: cam.current.x, y: cam.current.y, zoom: cam.current.zoom };
  }, [camera]);
  const settled = useCallback(() => callbacks.current.onCamera?.({ ...cam.current }), []);

  // The glide after a flick and the pans to a new focus, on the JS thread like the rest of the camera.
  const glideFrame = useRef(0);
  const stopGlide = useCallback(() => {
    if (glideFrame.current) cancelAnimationFrame(glideFrame.current);
    glideFrame.current = 0;
  }, []);

  // Start centered on the focus point; later focus changes (a building site, a new building)
  // pan there smoothly instead of jumping.
  const focused = useRef(false);
  useEffect(() => {
    if (W === 0) return;
    const to: Cam = { x: 0, y: 0, zoom: 1 };
    centerOn(to, isoX(focus.x, focus.y), isoY(focus.x, focus.y), focus.zoom, W, H);
    if (!focused.current) {
      focused.current = true;
      cam.current = to;
      publish();
      settled();
      return;
    }
    stopGlide();
    const from = { ...cam.current };
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / PAN_MS);
      const e = p * p * (3 - 2 * p);
      cam.current = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, zoom: from.zoom + (to.zoom - from.zoom) * e };
      publish();
      glideFrame.current = p < 1 ? requestAnimationFrame(step) : 0;
      if (p >= 1) settled();
    };
    glideFrame.current = requestAnimationFrame(step);
  }, [W, H, focus, publish, settled, stopGlide]);
  const startGlide = useCallback(
    (vel: { x: number; y: number }) => {
      stopGlide();
      let last = performance.now();
      const step = (now: number) => {
        const { world, W: w, H: h } = geo.current;
        if (!world) return;
        const going = glide(cam.current, vel, Math.min(50, now - last), world, w, h);
        last = now;
        publish();
        glideFrame.current = going ? requestAnimationFrame(step) : 0;
        if (!going) settled();
      };
      glideFrame.current = requestAnimationFrame(step);
    },
    [stopGlide, publish, settled],
  );
  useEffect(() => stopGlide, [stopGlide]);

  // Zoom is pinch-only on phones; on web (testing in a browser) the mouse wheel zooms too.
  const host = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !host.current) return;
    const el = host.current as unknown as WheelHost;
    const onWheel = (e: WheelLike) => {
      e.preventDefault();
      const { world, W: w, H: h } = geo.current;
      if (!world) return;
      const r = el.getBoundingClientRect();
      zoomAt(cam.current, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top, world, w, h);
      publish();
      settled();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [publish, settled]);

  const touches = useMemo((): GestureResponderHandlers => {
    let tracker: TouchTracker | null = null;
    let origin = { x: 0, y: 0 };
    let traced = 0;
    let taps = 0;
    const move = (e: GestureResponderEvent, lifted = false) => {
      const { world, W: w, H: h } = geo.current;
      if (!tracker || !world) return;
      const d = touchMove(tracker, fingersOf(e, origin, lifted), performance.now());
      if (!d) return;
      cam.current.x += d.dx;
      cam.current.y += d.dy;
      if (d.scale !== 1) zoomAt(cam.current, d.scale, d.cx, d.cy, world, w, h);
      else clampCam(cam.current, world, w, h);
      publish();
    };
    return {
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      // The map keeps the touch: nothing else should steal a drag that started on it.
      onResponderTerminationRequest: () => false,
      onResponderGrant: (e) => {
        stopGlide();
        const ne = e.nativeEvent;
        origin = { x: ne.pageX - ne.locationX, y: ne.pageY - ne.locationY };
        tracker = touchStart(fingersOf(e, origin), performance.now());
        if (traced < TRACED_TOUCHES) trace(`touch ${++traced} start`);
      },
      onResponderStart: (e) => move(e),
      onResponderMove: (e) => move(e),
      onResponderEnd: (e) => move(e, true),
      onResponderRelease: () => {
        if (!tracker) return;
        const { tap, fling } = touchEnd(tracker, performance.now());
        tracker = null;
        if (tap) {
          ripple.value = { x: tap.x, y: tap.y, n: ++taps };
          trace(`tap ${Math.round(tap.x)},${Math.round(tap.y)}`);
          callbacks.current.onTap?.(tap.x, tap.y, { ...cam.current });
        } else if (fling) {
          startGlide(fling);
        } else {
          settled();
        }
      },
      onResponderTerminate: () => {
        tracker = null;
        settled();
      },
    };
  }, [publish, settled, startGlide, stopGlide, ripple]);

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
      const r = ripple.value;
      if (r.n !== lastRipple.value) {
        lastRipple.value = r.n;
        spawnFx(s, FxKind.Ripple, s.lastFrame, 0.4, r.x, r.y);
      }
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
      drawScene(c, assets, snap, alpha, t, dt, camera.value, s, hud ?? null, vignette, W, H, selected ? selected.value : -1, selectedId ? selectedId.value : -1, build ? build.value : null);
      const next = recorder.value.finishRecordingAsPicture();
      // Web (CanvasKit/WASM) never garbage-collects Skia objects: free pictures a few frames old.
      // Native frees them by itself, and freeing by hand there can pull a picture out from under
      // a redraw that runs late (a crash), so we never do.
      if (DISPOSE_PICTURES) {
        const prev = previous.value;
        if (prev.length >= KEEP_PICTURES) {
          const stale = prev[0]!;
          if (stale !== empty) stale.dispose();
          previous.value = [...prev.slice(1), picture.value];
        } else {
          previous.value = [...prev, picture.value];
        }
      }
      picture.value = next;
      buildMs.value = buildMs.value * 0.9 + (performance.now() - started) * 0.1;
    },
    [assets, empty, snapshot, uiFps, buildMs, picture, previous, recorder, fx, ripple, lastRipple, arrival, lastSeq, lastNow, fpsFrames, fpsStart, camera, hud, vignette, W, H, selected, selectedId, build],
  );
  useFrameCallback(onFrame);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <View ref={host} style={[styles.fill, Platform.OS === 'web' && styles.webTouch]} onLayout={onLayout} {...touches}>
      {W > 0 && (
        <Canvas style={styles.fill} pointerEvents="none">
          <Picture picture={picture} />
        </Canvas>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // The browser must not pinch-zoom or scroll the page: the map handles every finger itself.
  webTouch: { touchAction: 'none' } as object,
});
