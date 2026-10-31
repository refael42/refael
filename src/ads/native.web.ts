import type { AdProvider } from './types';

/** No ad network on the web: src/ads/index.ts uses the test ad there (outside store builds). */
export const nativeAds = (): AdProvider | null => null;
