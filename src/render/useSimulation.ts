import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { SAVE } from '../data/economy';
import type { MapDef } from '../data/maps';
import type { SceneDef } from '../data/scenes';
import { SIM, STEP_MS, STEP_SEC } from '../data/sim';
import { peopleTargets, queueCommand, stationTargets, tapTargets } from '../sim/game/commands';
import { createGame } from '../sim/game/create';
import { gameSnapshot, stepGame } from '../sim/game/step';
import type { Command, GameState } from '../sim/game/types';
import { addStressWalkers, removeStressWalkers } from '../sim/game/walkers';
import { advance, createStepper } from '../sim/loop';
import type { OfflineEarnings } from '../sim/offline';
import { makeSave, restoreGame, type SaveData } from '../sim/save';
import { EMPTY_SNAPSHOT, type Snapshot } from '../sim/snapshot';
import type { PropKind } from '../sim/types';
import { createWorld, stepWorld, worldSnapshot } from '../sim/world';
import { writeSave } from '../store/persistence';
import type { Camera } from './draw/fx';
import { isoX, isoY } from './iso';

export interface SimStats {
  jsFps: number;
  entities: number;
  droppedMs: number;
}

/** Finger radius for tapping things in the scene (px). Generous: phones are imprecise. */
const TAP_RADIUS = 36;
/** Stations are big: they catch taps from farther away. */
const STATION_RADIUS = 48;
/** An action this many px farther than a station still wins (actions are what you usually mean). */
const ACTION_BIAS = 6;

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

/** What the game starts from: a save (or nothing), plus earnings while away. */
export interface GameBoot {
  save: SaveData | null;
  offline: OfflineEarnings | null;
}

/** What a tap hit: an action (already queued), a person, a station with upgrades, or nothing. */
export type TapHit = 'action' | { station: PropKind } | { person: number } | null;

/** Nearest projected target to a screen point. */
function nearest<T extends { x: number; y: number; height: number }>(targets: T[], x: number, y: number, cam: Camera) {
  let best: { target: T; dist: number } | null = null;
  for (const target of targets) {
    const sx = cam.x + isoX(target.x, target.y) * cam.zoom;
    const sy = cam.y + isoY(target.x, target.y, target.height) * cam.zoom;
    const dist = Math.hypot(sx - x, sy - y);
    if (!best || dist < best.dist) best = { target, dist };
  }
  return best;
}

/**
 * The playable restaurant: simulation, taps, autosave and the stress toggle. `paused` freezes
 * the sim (and saving) while the welcome-back screen is up, so nothing earned can be lost.
 */
export function useGame(map: MapDef, seed: number, stress: number, boot: GameBoot, paused: { current: boolean }) {
  const gameRef = useRef<GameState | null>(null);
  const loop = useFixedLoop(() => {
    const game = boot.save ? restoreGame(map, boot.save, seed) : createGame(map, seed);
    gameRef.current = game;
    return {
      step: () => {
        if (!paused.current) stepGame(game, STEP_SEC);
      },
      publish: (seq) => gameSnapshot(game, seq),
      entities: () => game.customers.length + game.walkers.length + game.props.length + game.tables.length + 1,
    };
  }, [map, seed, boot]);

  useEffect(() => {
    const save = () => {
      const game = gameRef.current;
      if (game && !paused.current) void writeSave(makeSave(game, Date.now()));
    };
    const timer = setInterval(save, SAVE.intervalSeconds * 1000);
    // Phones kill background apps without warning: save the moment we leave the foreground.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') save();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      save();
    };
  }, [paused]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    removeStressWalkers(game);
    if (stress > 0) addStressWalkers(game, stress);
  }, [stress]);

  /**
   * Screen-space hit test. Actions (seat, serve, clean, wash) win when they are about as close
   * as a station; otherwise a tapped station is returned so the UI can open its upgrades.
   */
  const tap = useCallback((x: number, y: number, cam: Camera): TapHit => {
    const game = gameRef.current;
    if (!game) return null;
    const scale = Math.max(1, cam.zoom * 0.8);
    const action = nearest(tapTargets(game), x, y, cam);
    const person = nearest(peopleTargets(game), x, y, cam);
    const station = nearest(stationTargets(game), x, y, cam);
    if (action && action.dist <= TAP_RADIUS * scale && (!station || action.dist <= station.dist + ACTION_BIAS)) {
      queueCommand(game, action.target.command);
      return 'action';
    }
    // People are small: they win over the station they stand at when the tap is on them.
    if (person && person.dist <= TAP_RADIUS * scale && (!station || person.dist <= station.dist + ACTION_BIAS)) return { person: person.target.id };
    return station && station.dist <= STATION_RADIUS * scale ? { station: station.target.kind } : null;
  }, []);

  const command = useCallback((cmd: Command) => {
    if (gameRef.current) queueCommand(gameRef.current, cmd);
  }, []);

  return { ...loop, tap, command, gameRef };
}

/** Reads something from the live game a few times per second (menus only, never per frame). */
export function usePoll<T>(gameRef: { current: GameState | null }, read: (s: GameState) => T, hz: number): T | null {
  const [value, setValue] = useState<T | null>(() => (gameRef.current ? read(gameRef.current) : null));
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    const tick = () => {
      if (gameRef.current) setValue(readRef.current(gameRef.current));
    };
    tick();
    const timer = setInterval(tick, 1000 / hz);
    return () => clearInterval(timer);
  }, [gameRef, hz]);
  return value;
}
