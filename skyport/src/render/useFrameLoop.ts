import { useEffect, useRef } from 'react';

/** Calls cb on every animation frame of the JS thread with the elapsed ms. */
export function useFrameLoop(cb: (dtMs: number, nowMs: number) => void, active = true): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    let id = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(250, Math.max(0, now - last));
      last = now;
      try {
        ref.current(dt, now);
      } finally {
        id = requestAnimationFrame(tick);
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

/** Frame statistics, read by the FPS meter twice per second. */
export const frameStats = { frames: 0, workMs: 0 };

export function recordFrame(workMs: number): void {
  frameStats.frames++;
  frameStats.workMs += workMs;
}
