import { create } from 'zustand';

// App start, in order: the opening animation plays its intro, then the game mounts underneath
// it (loading the save and baking the art take a moment), then the animation gets out of the way.

interface LaunchState {
  /** The intro has played: mount the game under the splash and start loading. */
  mounted: boolean;
  /** The restaurant's art is baked and it is on screen. */
  ready: boolean;
  /** The splash has finished leaving. */
  done: boolean;
}

export const useLaunch = create<LaunchState>(() => ({ mounted: false, ready: false, done: false }));

export const mountGame = () => useLaunch.setState({ mounted: true });
export const markReady = () => useLaunch.setState({ ready: true });
export const finishSplash = () => useLaunch.setState({ done: true });
