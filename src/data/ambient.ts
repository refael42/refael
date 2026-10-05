// Ambient life that makes the street feel alive even when nobody is coming in.

export const AMBIENT = {
  /** People strolling along the sidewalk at any moment. */
  pedestrians: 3,
  pedestrianSpeed: { min: 0.8, max: 1.5 },
  /** Stress-test walkers roam everywhere walkable and pause between trips. */
  stressPause: { min: 0.5, max: 2.5 },
} as const;
