/**
 * Fixed-timestep accumulator. Real time goes in, an integer number of fixed steps comes out,
 * so the simulation is identical no matter the device frame rate.
 */
export interface Stepper {
  readonly stepMs: number;
  readonly maxSteps: number;
  accumulatorMs: number;
  tick: number;
  /** Real time thrown away because the device could not keep up. Reported by the perf overlay. */
  droppedMs: number;
}

export function createStepper(stepMs: number, maxSteps: number): Stepper {
  return { stepMs, maxSteps, accumulatorMs: 0, tick: 0, droppedMs: 0 };
}

/** Adds elapsed real time and returns how many fixed steps the caller must run now. */
export function advance(s: Stepper, elapsedMs: number): number {
  s.accumulatorMs += Math.max(0, elapsedMs);
  let steps = Math.floor(s.accumulatorMs / s.stepMs);
  if (steps > s.maxSteps) {
    s.droppedMs += (steps - s.maxSteps) * s.stepMs;
    s.accumulatorMs -= (steps - s.maxSteps) * s.stepMs;
    steps = s.maxSteps;
  }
  s.accumulatorMs -= steps * s.stepMs;
  s.tick += steps;
  return steps;
}

/** How far we are into the next step, 0..1. */
export function stepAlpha(s: Stepper): number {
  return s.accumulatorMs / s.stepMs;
}
