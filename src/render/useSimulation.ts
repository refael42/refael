import { useCallback, useEffect, useRef } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { MapDef } from '../data/maps';
import type { SceneDef } from '../data/scenes';
import { SIM, STEP_MS, STEP_SEC } from '../data/sim';
import { queueCommand, tapTargets } from '../sim/game/commands';
import { createGame } from '../sim/game/create';
import { gameSnapshot, stepGame } from '../sim/game/step';
import type { GameState } from '../sim/game/types';
import { addStressWalkers, removeStressWalkers } from '../sim/game/walkers';
import { advance, createStepper } from '../sim/loop';
import { EMPTY_SNAPSHOT, type Snapshot } from '../sim/snapshot';
import { createWorld, stepWorld, worldSnapshot } from '../sim/world';
import type { Camera } from './draw/fx';
import { isoX, isoY } from './iso';

export interface SimStats {
  jsFps: number;
  entities: number;
  droppedMs: number;
}

/** Finger radius for tapping things in the scene (px). Generous: phones are imprecise. */
const TAP_RADIUS = 36;

interface Runner {
  step: () => void;
  publish: (seq: number) => Snapshot;
  entities: () => number;
}

/**
 * Runs a deterministic simulation on the JS thread at a fixed 20 Hz and publishes a compact
 * snapshot to the UI thread. React never re-renders per tick: the snapshot is a shared value.
 */
function useFixedLoop(make: () => Runner, deps: unknown[]): { snapshot: SharedValue<Snapshot>; stats: SimStats } {
  const snapshot = useSharedValue<Snapshot>(EMPTY_SNAPSHOT);
  const stats = useRef<SimStats>({ jsFps: 0, entities: 0, droppedMs: 0 }).current;
  useEffect(() => {
    const runner = make();
    const stepper = createStepper(STEP_MS, SIM.maxStepsPerFrame);
    let seq = 1;
    snapshot.value = runner.publish(seq);
    let last = performance.now();
    let fpsStart = last;
    let frames = 0;
    let raf = 0;
    const loop = (now: number) => {
      const steps = advance(stepper, now - last);
      last = now;
      for (let i = 0; i < steps; i++) runner.step();
      if (steps > 0) snapshot.value = runner.publish(++seq);
      frames += 1;
      if (now - fpsStart >= 1000) {
        stats.jsFps = (frames * 1000) / (now - fpsStart);
        stats.entities = runner.entities();
        stats.droppedMs = stepper.droppedMs;
        frames = 0;
        fpsStart = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { snapshot, stats };
}

/** The scripted cast lineup. */
export function useLineup(scene: SceneDef) {
  return useFixedLoop(() => {
    const world = createWorld(scene);
    return {
      step: () => stepWorld(world, STEP_SEC),
      publish: (seq) => worldSnapshot(world, seq),
      entities: () => world.characters.length + world.props.length,
    };
  }, [scene]);
}

/** The playable restaurant: simulation, taps and the stress toggle. */
export function useGame(map: MapDef, seed: number, stress: number) {
  const gameRef = useRef<GameState | null>(null);
  const loop = useFixedLoop(() => {
    const game = createGame(map, seed);
    gameRef.current = game;
    return {
      step: () => stepGame(game, STEP_SEC),
      publish: (seq) => gameSnapshot(game, seq),
      entities: () => game.customers.length + game.walkers.length + game.props.length + game.tables.length + 1,
    };
  }, [map, seed]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    removeStressWalkers(game);
    if (stress > 0) addStressWalkers(game, stress);
  }, [stress]);

  /** Screen-space hit test: project every tappable thing and take the nearest under the finger. */
  const tap = useCallback((x: number, y: number, cam: Camera) => {
    const game = gameRef.current;
    if (!game) return;
    let best: { dist: number; command: Parameters<typeof queueCommand>[1] } | null = null;
    for (const target of tapTargets(game)) {
      const sx = cam.x + isoX(target.x, target.y) * cam.zoom;
      const sy = cam.y + isoY(target.x, target.y, target.height) * cam.zoom;
      const dist = Math.hypot(sx - x, sy - y);
      const radius = TAP_RADIUS * Math.max(1, cam.zoom * 0.8);
      if (dist <= radius && (!best || dist < best.dist)) best = { dist, command: target.command };
    }
    if (best) queueCommand(game, best.command);
  }, []);

  return { ...loop, tap };
}
