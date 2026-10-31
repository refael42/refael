/** How a rewarded ad ended: watched to the end (pay the reward), closed early, or none could be shown. */
export type AdResult = 'rewarded' | 'closed' | 'failed';

/**
 * Where ads come from: the real ad network in a native build (`ads`), or a test ad drawn by the
 * game itself (`demo`: the web build and test builds, never a store build).
 */
export interface AdProvider {
  mode: 'ads' | 'demo';
  /** Start loading the next ad (call early: a rewarded ad takes a few seconds to load). */
  load(): void;
  /** An ad is loaded and can be shown now. */
  ready(): boolean;
  /** Shows it; resolves when it is closed. */
  show(): Promise<AdResult>;
}
