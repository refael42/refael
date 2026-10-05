import { useEffect, useRef } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { SceneDef } from '../data/scenes';
import { SIM, STEP_MS, STEP_SEC } from '../data/sim';
import { advance, createStepper } from '../sim/loop';
import { EMPTY_SNAPSHOT, packSnapshot, type Snapshot } from '../sim/snapshot';
import { addWanderers, removeWanderers } from '../sim/stress';
import type { World } from '../sim/types';
import { createWorld, stepWorld } from '../sim/world';

export interface SimStats {
  jsFps: number;
  entities: number;
  droppedMs: number;
}

/**
 * Runs the deterministic simulation on the JS thread at a fixed 20 Hz and publishes a compact
 * snapshot to the UI thread. React never re-renders per tick: the snapshot is a shared value.
 */
export function useSimulation(scene: SceneDef, stress: number): { snapshot: SharedValue<Snapshot>; stats: SimStats } {
  const snapshot = useSharedValue<Snapshot>(EMPTY_SNAPSHOT);
  const stats = useRef<SimStats>({ jsFps: 0, entities: 0, droppedMs: 0 }).current;
  const worldRef = useRef<World | null>(null);

  useEffect(() => {
    const world = createWorld(scene);
    worldRef.current = world;
    const stepper = createStepper(STEP_MS, SIM.maxStepsPerFrame);
    let seq = 1;
    snapshot.value = packSnapshot(world, seq);
    let last = performance.now();
    let fpsStart = last;
    let frames = 0;
    let raf = 0;
    const loop = (now: number) => {
      const steps = advance(stepper, now - last);
      last = now;
      for (let i = 0; i < steps; i++) stepWorld(world, STEP_SEC);
      if (steps > 0) snapshot.value = packSnapshot(world, ++seq);
      frames += 1;
      if (now - fpsStart >= 1000) {
        stats.jsFps = (frames * 1000) / (now - fpsStart);
        stats.entities = world.characters.length + world.props.length;
        stats.droppedMs = stepper.droppedMs;
        frames = 0;
        fpsStart = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      worldRef.current = null;
    };
  }, [scene, snapshot, stats]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    removeWanderers(world);
    if (stress > 0) addWanderers(world, scene, stress);
  }, [stress, scene]);

  return { snapshot, stats };
}
