/**
 * Camera: drag to pan, pinch to zoom, tap to select. Uses the React Native
 * responder system on a plain View (not gesture-handler on the canvas, which
 * crashed on the first touch in a previous project).
 */
import { useMemo, useRef } from 'react';
import { PanResponder, type GestureResponderEvent, type PanResponderInstance } from 'react-native';

export interface Camera {
  /** World-screen pixel at the center of the view. */
  x: number;
  y: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  /** World-screen bounds the center may move within. */
  bounds: { x0: number; y0: number; x1: number; y1: number };
  viewW: number;
  viewH: number;
  /** Smooth pan target (world-screen px); cleared when the user touches. */
  target: { x: number; y: number } | null;
}

export function makeCamera(x: number, y: number, zoom: number): Camera {
  return { x, y, zoom, minZoom: 0.3, maxZoom: 2.4, bounds: { x0: -1e5, y0: -1e5, x1: 1e5, y1: 1e5 }, viewW: 1, viewH: 1, target: null };
}

export function clampCamera(c: Camera): void {
  c.zoom = Math.max(c.minZoom, Math.min(c.maxZoom, c.zoom));
  c.x = Math.max(c.bounds.x0, Math.min(c.bounds.x1, c.x));
  c.y = Math.max(c.bounds.y0, Math.min(c.bounds.y1, c.y));
}

/** Eases the camera toward its target, if any. */
export function updateCamera(c: Camera, dt: number): void {
  if (!c.target) return;
  const k = Math.min(1, dt * 5);
  c.x += (c.target.x - c.x) * k;
  c.y += (c.target.y - c.y) * k;
  clampCamera(c);
  if (Math.hypot(c.target.x - c.x, c.target.y - c.y) < 2) c.target = null;
}

/** View point (px) -> world-screen point. */
export function viewToWorld(c: Camera, vx: number, vy: number): { x: number; y: number } {
  return { x: c.x + (vx - c.viewW / 2) / c.zoom, y: c.y + (vy - c.viewH / 2) / c.zoom };
}

/** Zooms by factor keeping the view point (vx, vy) fixed. */
export function zoomAt(c: Camera, factor: number, vx: number, vy: number): void {
  const before = viewToWorld(c, vx, vy);
  c.zoom = Math.max(c.minZoom, Math.min(c.maxZoom, c.zoom * factor));
  const after = viewToWorld(c, vx, vy);
  c.x += before.x - after.x;
  c.y += before.y - after.y;
  clampCamera(c);
}

interface TouchState {
  count: number;
  cx: number;
  cy: number;
  dist: number;
  startX: number;
  startY: number;
  startT: number;
  moved: number;
  multi: boolean;
}

function readTouches(e: GestureResponderEvent) {
  const ts = e.nativeEvent.touches;
  const n = ts.length;
  if (n === 0) {
    return { n: 0, cx: e.nativeEvent.locationX, cy: e.nativeEvent.locationY, dist: 0 };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += ts[i].pageX;
    cy += ts[i].pageY;
  }
  cx /= n;
  cy /= n;
  let dist = 0;
  if (n >= 2) dist = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
  return { n, cx, cy, dist };
}

export function useCameraResponder(
  cam: Camera,
  onTap: (vx: number, vy: number) => void,
  viewOffset: { current: { x: number; y: number } },
): PanResponderInstance {
  const tapRef = useRef(onTap);
  tapRef.current = onTap;
  return useMemo(() => {
    const st: TouchState = { count: 0, cx: 0, cy: 0, dist: 0, startX: 0, startY: 0, startT: 0, moved: 0, multi: false };
    const sync = (e: GestureResponderEvent) => {
      const t = readTouches(e);
      st.count = t.n;
      st.cx = t.cx;
      st.cy = t.cy;
      st.dist = t.dist;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        cam.target = null;
        sync(e);
        st.startX = e.nativeEvent.locationX;
        st.startY = e.nativeEvent.locationY;
        st.startT = Date.now();
        st.moved = 0;
        st.multi = st.count > 1;
      },
      onPanResponderMove: (e) => {
        const t = readTouches(e);
        if (t.n !== st.count) {
          // finger added or lifted: re-baseline, no jump
          sync(e);
          if (t.n > 1) st.multi = true;
          return;
        }
        const dx = t.cx - st.cx;
        const dy = t.cy - st.cy;
        st.moved += Math.abs(dx) + Math.abs(dy);
        cam.x -= dx / cam.zoom;
        cam.y -= dy / cam.zoom;
        if (t.n >= 2 && st.dist > 0 && t.dist > 0) {
          const vx = t.cx - viewOffset.current.x;
          const vy = t.cy - viewOffset.current.y;
          zoomAt(cam, t.dist / st.dist, vx, vy);
        }
        clampCamera(cam);
        st.cx = t.cx;
        st.cy = t.cy;
        st.dist = t.dist;
      },
      onPanResponderRelease: () => {
        const quick = Date.now() - st.startT < 450;
        if (!st.multi && st.moved < 10 && quick) tapRef.current(st.startX, st.startY);
        st.count = 0;
      },
      onPanResponderTerminate: () => {
        st.count = 0;
      },
    });
  }, [cam, viewOffset]);
}
